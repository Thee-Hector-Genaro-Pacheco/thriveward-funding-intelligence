import crypto from 'crypto';
import { prisma } from '../lib/prisma';
import { GrantsGovClient } from '../integrations/grantsGov/grantsGovClient';
import { GrantsGovMapper } from '../integrations/grantsGov/grantsGovMapper';
import { GrantsGovSearchHit } from '../integrations/grantsGov/grantsGovTypes';

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
  recordsDiscovered: number;
  recordsCreated: number;
  recordsUpdated: number;
  recordsUnchanged: number;
  recordsFailed: number;
  status: 'COMPLETED' | 'PARTIAL_SUCCESS' | 'FAILED';
  errorSummary?: string;
}

export const BRIDGE_FORWARD_SEARCH_TERMS = [
  'justice involved',
  'returning citizens',
  'recidivism',
  'reentry workforce',
  'workforce development',
  'youth employment',
  'career technical education',
  'apprenticeship',
  'digital skills',
  'technology training',
  'community services',
];

export class IngestionService {
  private client: GrantsGovClient;

  constructor(client?: GrantsGovClient) {
    this.client = client || new GrantsGovClient();
  }

  /**
   * Execute Grants.gov ingestion run with dry-run / persist options, identity invariants, idempotency, and field-ownership protection.
   */
  async ingestFromGrantsGov(options: IngestionOptions): Promise<IngestionSummary> {
    const isDryRun = options.dryRun !== false;
    const limit = Math.min(options.limit || 3, 10);
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
            limit,
          },
          status: 'IN_PROGRESS',
        },
      });
      runId = run.id;
    }

    let recordsDiscovered = 0;
    let recordsCreated = 0;
    let recordsUpdated = 0;
    let recordsUnchanged = 0;
    let recordsFailed = 0;
    const errors: string[] = [];

    try {
      // Collect hits (either single keyword or multi-term profile)
      const hitsMap = new Map<string, { hit: GrantsGovSearchHit; searchTerms: Set<string> }>();

      if (options.profile === 'bridge-forward') {
        for (const term of BRIDGE_FORWARD_SEARCH_TERMS) {
          try {
            const searchRes = await this.client.searchOpportunities({
              keyword: term,
              oppStatuses: searchStatuses,
              rows: limit,
            });
            const hits = searchRes.opportunityHits || [];
            for (const h of hits) {
              const extId = String(h.id);
              if (!hitsMap.has(extId)) {
                hitsMap.set(extId, { hit: h, searchTerms: new Set([term]) });
              } else {
                hitsMap.get(extId)?.searchTerms.add(term);
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
          rows: limit,
        });
        const hits = searchRes.opportunityHits || [];
        for (const h of hits) {
          const extId = String(h.id);
          hitsMap.set(extId, { hit: h, searchTerms: new Set([keyword]) });
        }
      }

      const uniqueHits = Array.from(hitsMap.values());
      recordsDiscovered = uniqueHits.length;

      for (const { hit, searchTerms } of uniqueHits.slice(0, limit)) {
        try {
          const hitId = String(hit.id);
          const termsArray = Array.from(searchTerms);

          // Dry run execution
          if (isDryRun) {
            try {
              const detail = await this.client.fetchOpportunity(hitId);
              GrantsGovMapper.mapDetailToOpportunity(detail);
            } catch {
              GrantsGovMapper.mapSearchHitToOpportunity(hit);
            }
            recordsCreated++;
            continue;
          }

          // PERSISTED IMPORT REQUIRES VALIDATED fetchOpportunity DETAIL RESPONSE
          const detail = await this.client.fetchOpportunity(hitId);
          const mapped = GrantsGovMapper.mapDetailToOpportunity(detail);

          if (mapped.externalOpportunityId !== hitId) {
            throw new Error(`Identity Mismatch: Requested opp ID '${hitId}' does not match response detail ID '${mapped.externalOpportunityId}'`);
          }

          const expectedUrl = `https://www.grants.gov/search-results-detail/${hitId}`;
          if (mapped.sourceUrl !== expectedUrl) {
            throw new Error(`Identity Mismatch: Mapped source URL '${mapped.sourceUrl}' does not match expected '${expectedUrl}'`);
          }

          const payloadHash = crypto
            .createHash('sha256')
            .update(JSON.stringify(detail))
            .digest('hex');

          const now = new Date();

          const existing = await prisma.fundingOpportunity.findUnique({
            where: {
              sourceSystem_externalOpportunityId: {
                sourceSystem: 'GRANTS_GOV',
                externalOpportunityId: mapped.externalOpportunityId,
              },
            },
            include: {
              fundingSource: true,
            },
          });

          if (existing && existing.sourcePayloadHash === payloadHash) {
            const mergedTerms = Array.from(new Set([...(existing.discoverySearchTerms || []), ...termsArray]));
            await prisma.fundingOpportunity.update({
              where: { id: existing.id },
              data: {
                lastRetrievedAt: now,
                discoverySearchTerms: mergedTerms,
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
                eligibleApplicantTypes: mapped.eligibleApplicantTypes,
                eligiblePopulations: mapped.eligiblePopulations,
                allowableCosts: mapped.allowableCosts,
                sourceLastUpdatedTimestamp: mapped.sourceLastUpdatedTimestamp,
                sourcePayloadHash: payloadHash,
                lastRetrievedAt: now,
                discoverySearchTerms: mergedTerms,
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
            recordsDiscovered,
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
        recordsDiscovered,
        recordsCreated,
        recordsUpdated,
        recordsUnchanged,
        recordsFailed,
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
}
