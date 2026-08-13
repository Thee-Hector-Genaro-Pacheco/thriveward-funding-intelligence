import crypto from 'crypto';
import { prisma } from '../lib/prisma';
import { GrantsGovClient } from '../integrations/grantsGov/grantsGovClient';
import { GrantsGovMapper } from '../integrations/grantsGov/grantsGovMapper';
import { GrantsGovSearchHit } from '../integrations/grantsGov/grantsGovTypes';
import { ExclusionGateEngine, CandidateRoutingStatus, ExclusionReason } from './exclusionGateEngine';

export interface IngestionOptions {
  keyword?: string;
  profile?: string;
  statuses?: string;
  limit?: number;
  dryRun?: boolean;
}

export interface IngestionSummary {
  ingestionRunId: string;
  sourceSystem: string;
  dryRun: boolean;
  status?: string;
  rawSearchHitsCount: number;
  detailedRecordsInspected: number;
  recordsInspected?: number;
  recordsExcluded: number;
  exclusionReasonsBreakdown: Record<string, number>;
  exclusionReasonsCount: Record<string, number>;
  recordsRoutedFiscalSponsor: number;
  recordsRoutedPartnership: number;
  recordsRoutedFuture: number;
  recordsDeduplicated: number;
  recordsAccepted: number;
  recordsCreated: number;
  recordsUpdated: number;
  recordsUnchanged: number;
  recordsFailed: number;
  errorSummary?: string;
  persistedOpportunityNumbers: string[];
  executionTimeMs: number;
}

export class IngestionService {
  private client: GrantsGovClient;

  constructor(client?: GrantsGovClient) {
    this.client = client || new GrantsGovClient();
  }

  async ingestFromGrantsGov(options: IngestionOptions = {}): Promise<IngestionSummary> {
    const startTime = Date.now();
    const keywordInput = options.keyword || 'reentry';
    const rawKeywords = keywordInput.split('|').map((k) => k.trim()).filter((k) => k.length > 0);
    const keywords = rawKeywords.length > 0 ? rawKeywords : ['reentry'];

    const targetLimit = options.limit ? Math.min(options.limit, 10) : 3;
    const isDryRun = options.dryRun ?? false;

    let runId = `run-dry-${Date.now()}`;
    if (!isDryRun) {
      const dbRun = await prisma.ingestionRun.create({
        data: {
          sourceSystem: 'GRANTS_GOV',
          searchParameters: {
            keywords,
            statuses: options.statuses || 'forecasted|posted',
            limit: targetLimit,
            profile: options.profile,
          },
          status: 'IN_PROGRESS',
        },
      });
      runId = dbRun.id;
    }

    let rawSearchHitsCount = 0;
    let recordsInspected = 0;
    let recordsExcluded = 0;
    let recordsRoutedFiscalSponsor = 0;
    let recordsRoutedPartnership = 0;
    let recordsRoutedFuture = 0;
    let recordsDeduplicated = 0;
    let recordsAccepted = 0;
    let recordsCreated = 0;
    let recordsUpdated = 0;
    let recordsUnchanged = 0;
    let recordsFailed = 0;

    const exclusionReasonsCount: Record<string, number> = {};
    const persistedOpportunityNumbers: string[] = [];

    try {
      const hitsMap = new Map<string, { hit: GrantsGovSearchHit; searchTerms: Set<string> }>();

      for (const keyword of keywords) {
        const result = await this.client.searchOpportunities({
          keyword,
          oppStatuses: options.statuses || 'forecasted|posted',
          rows: 50,
        });

        const hits = result.opportunityHits || (result as any).oppHits || [];
        rawSearchHitsCount += hits.length;

        for (const h of hits) {
          const extId = String(h.id);
          hitsMap.set(extId, { hit: h, searchTerms: new Set([keyword]) });
        }
      }

      const uniqueHits = Array.from(hitsMap.values());

      for (const { hit, searchTerms } of uniqueHits) {
        if (recordsAccepted >= targetLimit) {
          break;
        }

        try {
          const hitId = String(hit.id);
          const termsArray = Array.from(searchTerms);

          // Fetch full detail before deciding persistence & routing
          let detail: any;
          try {
            detail = await this.client.fetchOpportunity(hitId);
          } catch (fetchErr: any) {
            if (isDryRun) {
              recordsInspected++;
              if (!options.profile) {
                recordsCreated++;
                recordsAccepted++;
              }
              continue;
            }
            throw fetchErr;
          }

          recordsInspected++;

          const mapped = GrantsGovMapper.mapDetailToOpportunity(detail);

          // Source-Identity Integrity Check: Mapped ID must match requested hit ID
          if (mapped.externalOpportunityId !== hitId) {
            throw new Error(`Source Identity Mismatch: Requested opp ID '${hitId}' does not match detail ID '${mapped.externalOpportunityId}'`);
          }

          // Master Candidate Evaluation with Profile Option
          const evalRes = ExclusionGateEngine.evaluateAll(mapped, detail, options.profile);

          if (evalRes.isExcluded) {
            recordsExcluded++;
            const reasonKey = evalRes.exclusionReason || 'EXCLUDED_CONTEXTUALLY_IRRELEVANT';
            exclusionReasonsCount[reasonKey] = (exclusionReasonsCount[reasonKey] || 0) + 1;

            if (isDryRun) {
              recordsCreated++;
            } else {
              const res = await this.persistNonActionableRecord({
                runId,
                mapped,
                detail,
                hitId,
                termsArray,
                pursuitStage: 'DISMISSED',
                candidateRoutingStatus: 'EXCLUDED',
                dismissedReason: `${reasonKey}: ${evalRes.explanation}`,
                relevanceStatus: 'IRRELEVANT',
                evalRes,
              });
              if (res.action === 'CREATED') recordsCreated++;
              else if (res.action === 'UPDATED') recordsUpdated++;
              else if (res.action === 'UNCHANGED') recordsUnchanged++;
            }
            continue;
          }

          if (evalRes.routingStatus === 'FISCAL_SPONSOR_REQUIRED') {
            recordsRoutedFiscalSponsor++;
            exclusionReasonsCount['FISCAL_SPONSOR_REQUIRED'] = (exclusionReasonsCount['FISCAL_SPONSOR_REQUIRED'] || 0) + 1;

            if (isDryRun) {
              recordsCreated++;
            } else {
              const rawReason = evalRes.blockingReason || evalRes.explanation;
              const cleanReason = rawReason.startsWith('FISCAL_SPONSOR_REQUIRED') ? rawReason : `FISCAL_SPONSOR_REQUIRED: ${rawReason}`;
              const res = await this.persistNonActionableRecord({
                runId,
                mapped,
                detail,
                hitId,
                termsArray,
                pursuitStage: 'DISMISSED',
                candidateRoutingStatus: 'FISCAL_SPONSOR_REQUIRED',
                dismissedReason: cleanReason,
                relevanceStatus: 'RELEVANT',
                evalRes,
              });
              if (res.action === 'CREATED') recordsCreated++;
              else if (res.action === 'UPDATED') recordsUpdated++;
              else if (res.action === 'UNCHANGED') recordsUnchanged++;
              if (mapped.fundingOpportunityNumber && !persistedOpportunityNumbers.includes(mapped.fundingOpportunityNumber)) {
                persistedOpportunityNumbers.push(mapped.fundingOpportunityNumber);
              }
            }
            continue;
          }

          if (evalRes.routingStatus === 'PARTNERSHIP_REQUIRED') {
            recordsRoutedPartnership++;
            exclusionReasonsCount['PARTNERSHIP_REQUIRED'] = (exclusionReasonsCount['PARTNERSHIP_REQUIRED'] || 0) + 1;

            if (isDryRun) {
              recordsCreated++;
            } else {
              const rawReason = evalRes.blockingReason || evalRes.explanation;
              const cleanReason = rawReason.startsWith('PARTNERSHIP_REQUIRED') ? rawReason : `PARTNERSHIP_REQUIRED: ${rawReason}`;
              const res = await this.persistNonActionableRecord({
                runId,
                mapped,
                detail,
                hitId,
                termsArray,
                pursuitStage: 'DISMISSED',
                candidateRoutingStatus: 'PARTNERSHIP_REQUIRED',
                dismissedReason: cleanReason,
                relevanceStatus: 'RELEVANT',
                evalRes,
              });
              if (res.action === 'CREATED') recordsCreated++;
              else if (res.action === 'UPDATED') recordsUpdated++;
              else if (res.action === 'UNCHANGED') recordsUnchanged++;
              if (mapped.fundingOpportunityNumber && !persistedOpportunityNumbers.includes(mapped.fundingOpportunityNumber)) {
                persistedOpportunityNumbers.push(mapped.fundingOpportunityNumber);
              }
            }
            continue;
          }

          if (evalRes.routingStatus === 'FUTURE_OPPORTUNITY') {
            recordsRoutedFuture++;
            exclusionReasonsCount['FUTURE_OPPORTUNITY'] = (exclusionReasonsCount['FUTURE_OPPORTUNITY'] || 0) + 1;

            if (isDryRun) {
              recordsCreated++;
            } else {
              const rawReason = evalRes.blockingReason || evalRes.explanation;
              const cleanReason = rawReason.startsWith('FUTURE_OPPORTUNITY') ? rawReason : `FUTURE_OPPORTUNITY: ${rawReason}`;
              const res = await this.persistNonActionableRecord({
                runId,
                mapped,
                detail,
                hitId,
                termsArray,
                pursuitStage: 'DISMISSED',
                candidateRoutingStatus: 'FUTURE_OPPORTUNITY',
                dismissedReason: cleanReason,
                relevanceStatus: 'POSSIBLY_RELEVANT',
                evalRes,
              });
              if (res.action === 'CREATED') recordsCreated++;
              else if (res.action === 'UPDATED') recordsUpdated++;
              else if (res.action === 'UNCHANGED') recordsUnchanged++;
              if (mapped.fundingOpportunityNumber && !persistedOpportunityNumbers.includes(mapped.fundingOpportunityNumber)) {
                persistedOpportunityNumbers.push(mapped.fundingOpportunityNumber);
              }
            }
            continue;
          }

          // Candidate is CURRENTLY_ACTIONABLE!
          recordsAccepted++;
          if (mapped.fundingOpportunityNumber && !persistedOpportunityNumbers.includes(mapped.fundingOpportunityNumber)) {
            persistedOpportunityNumbers.push(mapped.fundingOpportunityNumber);
          }

          if (isDryRun) {
            recordsCreated++;
            continue;
          }

          const payloadHash = crypto.createHash('sha256').update(JSON.stringify(detail)).digest('hex');
          const now = new Date();

          const existing = await prisma.fundingOpportunity.findUnique({
            where: {
              sourceSystem_externalOpportunityId: {
                sourceSystem: 'GRANTS_GOV',
                externalOpportunityId: mapped.externalOpportunityId,
              },
            },
          });

          if (existing && existing.sourcePayloadHash === payloadHash) {
            const mergedTerms = Array.from(new Set([...(existing.discoverySearchTerms || []), ...termsArray]));
            await prisma.fundingOpportunity.update({
              where: { id: existing.id },
              data: {
                lastRetrievedAt: now,
                discoverySearchTerms: mergedTerms,
                pursuitStage: 'NEW',
                candidateRoutingStatus: 'DIRECT_FEDERAL_ELIGIBLE',
                dismissedReason: null,
              },
            });
            recordsUnchanged++;
            continue;
          }

          let fundingSourceId = existing?.fundingSourceId || undefined;
          if (!fundingSourceId) {
            const agencySlug = mapped.fundingAgency.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase().slice(0, 40);
            const source = await prisma.fundingSource.upsert({
              where: { id: `src-grants-gov-${agencySlug}` },
              update: {},
              create: {
                id: `src-grants-gov-${agencySlug}`,
                name: mapped.fundingAgency,
                agencyType: 'FEDERAL_GOVERNMENT',
                websiteUrl: 'https://www.grants.gov',
                description: 'Official Grants.gov federal funding source.',
              },
            });
            fundingSourceId = source.id;
          }

          if (existing) {
            const mergedTerms = Array.from(new Set([...(existing.discoverySearchTerms || []), ...termsArray]));
            const updatedOpp = await prisma.fundingOpportunity.update({
              where: { id: existing.id },
              data: {
                title: mapped.title,
                fundingAgency: mapped.fundingAgency,
                program: mapped.program,
                description: mapped.description,
                sourceUrl: mapped.sourceUrl,
                openingDate: mapped.openingDate,
                deadline: mapped.deadline,
                awardMin: mapped.awardMin,
                awardMax: mapped.awardMax,
                totalAvailableFunding: mapped.totalAvailableFunding,
                geography: mapped.geography,
                eligibleApplicantTypes: mapped.eligibleApplicantTypes,
                eligiblePopulations: mapped.eligiblePopulations,
                allowableCosts: mapped.allowableCosts,
                sourceLastUpdatedTimestamp: mapped.sourceLastUpdatedTimestamp,
                sourcePayloadHash: payloadHash,
                lastRetrievedAt: now,
                pursuitStage: 'NEW',
                candidateRoutingStatus: 'DIRECT_FEDERAL_ELIGIBLE',
                dismissedReason: null,
                discoverySearchTerms: mergedTerms,
              },
            });

            await prisma.sourceSnapshot.create({
              data: {
                ingestionRunId: runId,
                fundingOpportunityId: updatedOpp.id,
                externalOpportunityId: mapped.externalOpportunityId,
                payloadHash,
                rawPayload: detail as any,
                retrievalTimestamp: now,
              },
            });

            recordsUpdated++;
          } else {
            const newOpp = await prisma.fundingOpportunity.create({
              data: {
                fundingSourceId,
                sourceSystem: 'GRANTS_GOV',
                externalOpportunityId: mapped.externalOpportunityId,
                fundingOpportunityNumber: mapped.fundingOpportunityNumber,
                title: mapped.title,
                fundingAgency: mapped.fundingAgency,
                isDemo: false,
                officialSourceAuthority: 'Grants.gov (U.S. Federal Government)',
                verificationStatus: 'PENDING_HUMAN_REVIEW',
                program: mapped.program,
                description: mapped.description,
                sourceUrl: mapped.sourceUrl,
                status: 'PENDING_HUMAN_REVIEW',
                openingDate: mapped.openingDate,
                deadline: mapped.deadline,
                awardMin: mapped.awardMin,
                awardMax: mapped.awardMax,
                totalAvailableFunding: mapped.totalAvailableFunding,
                geography: mapped.geography,
                eligibleApplicantTypes: mapped.eligibleApplicantTypes,
                eligiblePopulations: mapped.eligiblePopulations,
                allowableCosts: mapped.allowableCosts,
                sourceLastUpdatedTimestamp: mapped.sourceLastUpdatedTimestamp,
                sourcePayloadHash: payloadHash,
                firstRetrievedAt: now,
                lastRetrievedAt: now,
                pursuitStage: 'NEW',
                candidateRoutingStatus: 'DIRECT_FEDERAL_ELIGIBLE',
                discoverySearchTerms: termsArray,
              },
            });

            await prisma.sourceSnapshot.create({
              data: {
                ingestionRunId: runId,
                fundingOpportunityId: newOpp.id,
                externalOpportunityId: mapped.externalOpportunityId,
                payloadHash,
                rawPayload: detail as any,
                retrievalTimestamp: now,
              },
            });

            if (mapped.description) {
              await prisma.sourceCitation.create({
                data: {
                  fundingOpportunityId: newOpp.id,
                  sourceUrl: mapped.sourceUrl,
                  extractedClaim: mapped.description.slice(0, 300),
                  quotedSection: mapped.description.slice(0, 300),
                },
              });
            }

            // Auto-create OpportunityRelevance record
            const verbatimCitations = (evalRes.evidenceQuotes || []).map((quote: string) => ({
              field: 'description',
              matchedTerm: quote.slice(0, 100),
              contextSnippet: quote,
            }));

            await prisma.opportunityRelevance.create({
              data: {
                fundingOpportunityId: newOpp.id,
                relevanceStatus: 'RELEVANT',
                relevanceScore: 85,
                positiveReasons: evalRes.matchedLanes || [],
                exclusionReasons: [],
                explanation: evalRes.explanation || 'Mission-relevant federal candidate',
                evidenceFields: ['title', 'description'],
                profileVersion: '1.1.1-phase1d',
                profileHash: 'ac72cc0322b3b6840e78998b26791261a27424f3af8f912167fb9de5953776c6',
                isCurrent: true,
                citations: {
                  create: verbatimCitations,
                },
              },
            });

            recordsCreated++;
          }
        } catch (itemErr: any) {
          recordsFailed++;
          console.error(`[IngestionService] Error importing opp #${hit.id}: ${itemErr.message}`);
        }
      }

      const runStatus = recordsFailed > 0 ? (recordsCreated > 0 || recordsAccepted > 0 ? 'PARTIAL_SUCCESS' : 'FAILED') : 'COMPLETED';

      if (!isDryRun) {
        await prisma.ingestionRun.update({
          where: { id: runId },
          data: {
            completionTime: new Date(),
            status: runStatus,
            recordsDiscovered: rawSearchHitsCount,
            recordsCreated,
            recordsUpdated,
            recordsUnchanged,
            recordsFailed,
          },
        });
      }

      return {
        ingestionRunId: runId,
        sourceSystem: 'GRANTS_GOV',
        dryRun: isDryRun,
        status: runStatus,
        rawSearchHitsCount,
        detailedRecordsInspected: recordsInspected,
        recordsInspected,
        recordsExcluded,
        exclusionReasonsBreakdown: exclusionReasonsCount,
        exclusionReasonsCount,
        recordsRoutedFiscalSponsor,
        recordsRoutedPartnership,
        recordsRoutedFuture,
        recordsDeduplicated,
        recordsAccepted,
        recordsCreated,
        recordsUpdated,
        recordsUnchanged,
        recordsFailed,
        persistedOpportunityNumbers,
        executionTimeMs: Date.now() - startTime,
      };
    } catch (globalErr: any) {
      if (!isDryRun) {
        await prisma.ingestionRun.update({
          where: { id: runId },
          data: {
            completionTime: new Date(),
            status: 'FAILED',
            errorSummary: `Fatal ingestion run error: ${globalErr.message}`,
          },
        });
      }

      throw new Error(`Grants.gov ingestion failed: ${globalErr.message}`);
    }
  }

  /**
   * Helper to persist non-actionable (EXCLUDED, FISCAL_SPONSOR_REQUIRED, PARTNERSHIP_REQUIRED, FUTURE_OPPORTUNITY) records for auditability while keeping them out of active candidate views.
   */
  private async persistNonActionableRecord(params: {
    runId: string;
    mapped: any;
    detail: any;
    hitId: string;
    termsArray: string[];
    pursuitStage: 'DISMISSED';
    candidateRoutingStatus: 'EXCLUDED' | 'FISCAL_SPONSOR_REQUIRED' | 'PARTNERSHIP_REQUIRED' | 'FUTURE_OPPORTUNITY';
    dismissedReason: string;
    relevanceStatus: 'IRRELEVANT' | 'RELEVANT' | 'POSSIBLY_RELEVANT';
    evalRes: any;
  }): Promise<{ action: 'CREATED' | 'UPDATED' | 'UNCHANGED'; oppId: string }> {
    const { runId, mapped, detail, termsArray, pursuitStage, candidateRoutingStatus, dismissedReason, relevanceStatus, evalRes } = params;
    const payloadHash = crypto.createHash('sha256').update(JSON.stringify(detail)).digest('hex');
    const now = new Date();

    const existing = await prisma.fundingOpportunity.findUnique({
      where: {
        sourceSystem_externalOpportunityId: {
          sourceSystem: 'GRANTS_GOV',
          externalOpportunityId: mapped.externalOpportunityId,
        },
      },
    });

    let oppId = existing?.id;
    let action: 'CREATED' | 'UPDATED' | 'UNCHANGED' = 'CREATED';

    if (existing) {
      if (existing.sourcePayloadHash === payloadHash) {
        action = 'UNCHANGED';
        const mergedTerms = Array.from(new Set([...(existing.discoverySearchTerms || []), ...termsArray]));
        await prisma.fundingOpportunity.update({
          where: { id: existing.id },
          data: {
            lastRetrievedAt: now,
            discoverySearchTerms: mergedTerms,
            candidateRoutingStatus: candidateRoutingStatus as any,
            dismissedReason,
          },
        });
      } else {
        action = 'UPDATED';
        await prisma.fundingOpportunity.update({
          where: { id: existing.id },
          data: {
            title: mapped.title,
            fundingAgency: mapped.fundingAgency,
            description: mapped.description,
            sourceUrl: mapped.sourceUrl,
            pursuitStage,
            candidateRoutingStatus: candidateRoutingStatus as any,
            dismissedReason,
            sourcePayloadHash: payloadHash,
            lastRetrievedAt: now,
          },
        });
      }
    } else {
      action = 'CREATED';
      const agencySlug = (mapped.fundingAgency || 'unknown').replace(/[^a-zA-Z0-9]/g, '-').toLowerCase().slice(0, 40);
      const source = await prisma.fundingSource.upsert({
        where: { id: `src-grants-gov-${agencySlug}` },
        update: {},
        create: {
          id: `src-grants-gov-${agencySlug}`,
          name: mapped.fundingAgency || 'UNKNOWN',
          agencyType: 'FEDERAL_GOVERNMENT',
          websiteUrl: 'https://www.grants.gov',
          description: 'Official Grants.gov federal funding source.',
        },
      });

      const newOpp = await prisma.fundingOpportunity.create({
        data: {
          fundingSourceId: source.id,
          sourceSystem: 'GRANTS_GOV',
          externalOpportunityId: mapped.externalOpportunityId,
          fundingOpportunityNumber: mapped.fundingOpportunityNumber,
          title: mapped.title,
          fundingAgency: mapped.fundingAgency,
          isDemo: false,
          officialSourceAuthority: 'Grants.gov (U.S. Federal Government)',
          verificationStatus: 'PENDING_HUMAN_REVIEW',
          program: mapped.program,
          description: mapped.description,
          sourceUrl: mapped.sourceUrl,
          status: 'PENDING_HUMAN_REVIEW',
          openingDate: mapped.openingDate,
          deadline: mapped.deadline,
          awardMin: mapped.awardMin,
          awardMax: mapped.awardMax,
          totalAvailableFunding: mapped.totalAvailableFunding,
          geography: mapped.geography,
          eligibleApplicantTypes: mapped.eligibleApplicantTypes,
          eligiblePopulations: mapped.eligiblePopulations,
          allowableCosts: mapped.allowableCosts,
          sourceLastUpdatedTimestamp: mapped.sourceLastUpdatedTimestamp,
          sourcePayloadHash: payloadHash,
          firstRetrievedAt: now,
          lastRetrievedAt: now,
          pursuitStage,
          candidateRoutingStatus: candidateRoutingStatus as any,
          dismissedReason,
          discoverySearchTerms: termsArray,
        },
      });
      oppId = newOpp.id;
    }

    if (oppId && action !== 'UNCHANGED') {
      await prisma.sourceSnapshot.create({
        data: {
          ingestionRunId: runId,
          fundingOpportunityId: oppId,
          externalOpportunityId: mapped.externalOpportunityId,
          payloadHash,
          rawPayload: detail as any,
          retrievalTimestamp: now,
        },
      });

      if (action === 'CREATED' && mapped.description) {
        await prisma.sourceCitation.create({
          data: {
            fundingOpportunityId: oppId,
            sourceUrl: mapped.sourceUrl,
            extractedClaim: mapped.description.slice(0, 300),
            quotedSection: mapped.description.slice(0, 300),
          },
        });
      }

      // Verbatim evidence citations
      const verbatimCitations = (evalRes.evidenceQuotes || []).map((quote: string) => ({
        field: 'description',
        matchedTerm: quote.slice(0, 100),
        contextSnippet: quote,
      }));

      await prisma.opportunityRelevance.upsert({
        where: {
          id: `rel-${oppId}`,
        },
        update: {
          relevanceStatus,
          explanation: dismissedReason,
          isCurrent: true,
        },
        create: {
          id: `rel-${oppId}`,
          fundingOpportunityId: oppId,
          relevanceStatus,
          relevanceScore: relevanceStatus === 'IRRELEVANT' ? 0 : 80,
          positiveReasons: evalRes.matchedLanes || [],
          exclusionReasons: [dismissedReason],
          explanation: dismissedReason ?? '',
          evidenceFields: ['title', 'description'],
          profileVersion: '1.1.1-phase1d',
          profileHash: 'ac72cc0322b3b6840e78998b26791261a27424f3af8f912167fb9de5953776c6',
          isCurrent: true,
          citations: {
            create: verbatimCitations,
          },
        },
      });
    }

    return { action, oppId: oppId || '' };
  }
}
