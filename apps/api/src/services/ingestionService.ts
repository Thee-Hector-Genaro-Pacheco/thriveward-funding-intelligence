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
  rawSearchHitsCount: number;
  recordsInspected: number;
  recordsExcluded: number;
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
  persistedOpportunityNumbers: string[];
  status: 'COMPLETED' | 'PARTIAL_SUCCESS' | 'FAILED';
  errorSummary?: string;
}

export const BRIDGE_FORWARD_SEARCH_TERMS = [
  '"reentry" AND workforce',
  '"formerly incarcerated" AND employment',
  '"justice-involved" AND training',
  '"returning citizens" AND housing',
  '"youth homelessness" AND supportive services',
  '"juvenile justice" AND mentorship',
  '"digital equity" AND workforce',
  '"career pathways" AND disadvantaged youth',
  '"housing stabilization" AND nonprofit',
  '"community economic development" AND employment',
];

export class IngestionService {
  private client: GrantsGovClient;

  constructor(client?: GrantsGovClient) {
    this.client = client || new GrantsGovClient();
  }

  /**
   * Execute Grants.gov ingestion run with detail-level source identity verification, applicant readiness checks, and routing.
   */
  async ingestFromGrantsGov(options: IngestionOptions): Promise<IngestionSummary> {
    const isDryRun = options.dryRun !== false;
    const targetLimit = Math.min(options.limit || 3, 20);
    const searchStatuses = options.statuses || 'forecasted|posted';

    let runId = `dry-run-${Date.now()}`;
    if (!isDryRun) {
      const run = await prisma.ingestionRun.create({
        data: {
          sourceSystem: 'GRANTS_GOV',
          searchParameters: {
            keyword: options.keyword || '',
            profile: options.profile || null,
            statuses: searchStatuses,
            limit: targetLimit,
          },
          status: 'IN_PROGRESS',
        },
      });
      runId = run.id;
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
    const persistedOpportunityNumbers: string[] = [];
    const errors: string[] = [];

    const exclusionReasonsCount: Record<string, number> = {
      EXCLUDED_FOREIGN_PLACE_OF_PERFORMANCE: 0,
      EXCLUDED_RESEARCH_ONLY: 0,
      EXCLUDED_CLINICAL_RESEARCH: 0,
      EXCLUDED_LAW_ENFORCEMENT_PROGRAM: 0,
      EXCLUDED_APPLICANT_TYPE: 0,
      EXCLUDED_RFI: 0,
      EXCLUDED_INVITED_ONLY: 0,
      EXCLUDED_REIMBURSEMENT_PROGRAM: 0,
      EXCLUDED_CONTEXTUALLY_IRRELEVANT: 0,
      NO_MISSION_LANE_MATCH: 0,
      FISCAL_SPONSOR_REQUIRED: 0,
      PARTNERSHIP_REQUIRED: 0,
      FUTURE_OPPORTUNITY: 0,
    };

    try {
      const hitsMap = new Map<string, { hit: GrantsGovSearchHit; searchTerms: Set<string> }>();

      if (options.profile === 'bridge-forward') {
        for (const term of BRIDGE_FORWARD_SEARCH_TERMS) {
          try {
            const searchRes = await this.client.searchOpportunities({
              keyword: term,
              oppStatuses: searchStatuses,
              rows: 25,
            });
            const hits = searchRes.opportunityHits || [];
            rawSearchHitsCount += hits.length;

            for (const h of hits) {
              const extId = String(h.id);
              if (!hitsMap.has(extId)) {
                hitsMap.set(extId, { hit: h, searchTerms: new Set([term]) });
              } else {
                hitsMap.get(extId)?.searchTerms.add(term);
                recordsDeduplicated++;
              }
            }
          } catch (err: any) {
            console.warn(`[IngestionService] Discovery warning for term '${term}':`, err.message);
          }
        }
      } else {
        const keyword = options.keyword || 'reentry';
        const searchRes = await this.client.searchOpportunities({
          keyword,
          oppStatuses: searchStatuses,
          rows: 25,
        });
        const hits = searchRes.opportunityHits || [];
        rawSearchHitsCount = hits.length;
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

            if (!isDryRun) {
              await this.persistNonActionableRecord({
                runId,
                mapped,
                detail,
                hitId,
                termsArray,
                pursuitStage: 'DISMISSED',
                dismissedReason: `${reasonKey}: ${evalRes.explanation}`,
                relevanceStatus: 'IRRELEVANT',
                evalRes,
              });
            }
            continue;
          }

          if (evalRes.routingStatus === 'FISCAL_SPONSOR_REQUIRED') {
            recordsRoutedFiscalSponsor++;
            exclusionReasonsCount['FISCAL_SPONSOR_REQUIRED'] = (exclusionReasonsCount['FISCAL_SPONSOR_REQUIRED'] || 0) + 1;

            if (!isDryRun) {
              await this.persistNonActionableRecord({
                runId,
                mapped,
                detail,
                hitId,
                termsArray,
                pursuitStage: 'DISMISSED',
                dismissedReason: `FISCAL_SPONSOR_REQUIRED: ${evalRes.blockingReason || evalRes.explanation}`,
                relevanceStatus: 'RELEVANT',
                evalRes,
              });
            }
            continue;
          }

          if (evalRes.routingStatus === 'PARTNERSHIP_REQUIRED') {
            recordsRoutedPartnership++;
            exclusionReasonsCount['PARTNERSHIP_REQUIRED'] = (exclusionReasonsCount['PARTNERSHIP_REQUIRED'] || 0) + 1;

            if (!isDryRun) {
              await this.persistNonActionableRecord({
                runId,
                mapped,
                detail,
                hitId,
                termsArray,
                pursuitStage: 'DISMISSED',
                dismissedReason: `PARTNERSHIP_REQUIRED: ${evalRes.blockingReason || evalRes.explanation}`,
                relevanceStatus: 'RELEVANT',
                evalRes,
              });
            }
            continue;
          }

          if (evalRes.routingStatus === 'FUTURE_OPPORTUNITY') {
            recordsRoutedFuture++;
            exclusionReasonsCount['FUTURE_OPPORTUNITY'] = (exclusionReasonsCount['FUTURE_OPPORTUNITY'] || 0) + 1;

            if (!isDryRun) {
              await this.persistNonActionableRecord({
                runId,
                mapped,
                detail,
                hitId,
                termsArray,
                pursuitStage: 'DISMISSED',
                dismissedReason: `FUTURE_OPPORTUNITY: ${evalRes.blockingReason || evalRes.explanation}`,
                relevanceStatus: 'POSSIBLY_RELEVANT',
                evalRes,
              });
            }
            continue;
          }

          // Candidate is CURRENTLY_ACTIONABLE!
          recordsAccepted++;
          persistedOpportunityNumbers.push(mapped.fundingOpportunityNumber);

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
            await prisma.fundingOpportunity.update({
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
                discoverySearchTerms: mergedTerms,
                pursuitStage: 'NEW',
                dismissedReason: null,
              },
            });

            await prisma.sourceSnapshot.create({
              data: {
                ingestionRunId: runId,
                fundingOpportunityId: existing.id,
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
                lastVerifiedTimestamp: null,
                pursuitStage: 'NEW',
                dismissedReason: null,
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

            await prisma.sourceCitation.create({
              data: {
                fundingOpportunityId: newOpp.id,
                sourceUrl: mapped.sourceUrl,
                sourceTitle: `Grants.gov Official Notice #${mapped.fundingOpportunityNumber}`,
                sourceOrganization: mapped.fundingAgency,
                quotedSection: mapped.description.slice(0, 300),
                extractedClaim: `Official opportunity announcement for ${mapped.title} published by ${mapped.fundingAgency}.`,
              },
            });

            recordsCreated++;
          }
        } catch (itemErr: any) {
          recordsFailed++;
          const errStr = `Error importing opp #${hit.id}: ${itemErr.message || itemErr}`;
          console.error(`[IngestionService] ${errStr}`);
          errors.push(errStr);
        }
      }

      const finalStatus =
        recordsFailed === 0
          ? 'COMPLETED'
          : recordsCreated > 0 || recordsUpdated > 0
          ? 'PARTIAL_SUCCESS'
          : 'FAILED';

      if (!isDryRun) {
        await prisma.ingestionRun.update({
          where: { id: runId },
          data: {
            completionTime: new Date(),
            status: finalStatus,
            recordsDiscovered: rawSearchHitsCount,
            recordsCreated,
            recordsUpdated,
            recordsUnchanged,
            recordsFailed,
            errorSummary: errors.length > 0 ? errors.join('; ') : null,
          },
        });
      }

      return {
        ingestionRunId: runId,
        sourceSystem: 'GRANTS_GOV',
        dryRun: isDryRun,
        rawSearchHitsCount,
        recordsInspected,
        recordsExcluded,
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
        status: finalStatus,
        errorSummary: errors.length > 0 ? errors.join('; ') : undefined,
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
    dismissedReason: string;
    relevanceStatus: 'IRRELEVANT' | 'RELEVANT' | 'POSSIBLY_RELEVANT';
    evalRes: any;
  }) {
    const { runId, mapped, detail, termsArray, pursuitStage, dismissedReason, relevanceStatus, evalRes } = params;
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

    if (existing) {
      await prisma.fundingOpportunity.update({
        where: { id: existing.id },
        data: {
          title: mapped.title,
          fundingAgency: mapped.fundingAgency,
          description: mapped.description,
          sourceUrl: mapped.sourceUrl,
          pursuitStage,
          dismissedReason,
          sourcePayloadHash: payloadHash,
          lastRetrievedAt: now,
        },
      });
    } else {
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
          dismissedReason,
          discoverySearchTerms: termsArray,
        },
      });
      oppId = newOpp.id;
    }

    if (oppId) {
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
          explanation: dismissedReason,
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
  }
}
