import crypto from 'crypto';
import { prisma } from '../lib/prisma';
import { GrantsGovClient } from '../integrations/grantsGov/grantsGovClient';
import { GrantsGovMapper } from '../integrations/grantsGov/grantsGovMapper';

export interface IngestionOptions {
  keyword?: string;
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
    const searchParams = {
      keyword: options.keyword || '',
      oppStatuses: options.statuses || 'forecasted|posted',
      rows: limit,
    };

    let runId = `dry-run-${Date.now()}`;
    if (!isDryRun) {
      const run = await prisma.ingestionRun.create({
        data: {
          sourceSystem: 'GRANTS_GOV',
          searchParameters: searchParams,
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
      const searchRes = await this.client.searchOpportunities(searchParams);
      const hits = searchRes.opportunityHits || [];
      recordsDiscovered = hits.length;

      for (const hit of hits.slice(0, limit)) {
        try {
          const hitId = String(hit.id);

          // Dry run may display search-hit metadata without database persistence
          if (isDryRun) {
            try {
              const detail = await this.client.fetchOpportunity(hitId);
              GrantsGovMapper.mapDetailToOpportunity(detail);
            } catch {
              // Dry-run fallback validation
              GrantsGovMapper.mapSearchHitToOpportunity(hit);
            }
            recordsCreated++;
            continue;
          }

          // PERSISTED IMPORT REQUIRES SUCCESSFUL, VALIDATED fetchOpportunity DETAIL RESPONSE!
          // No search-hit fallback data may be persisted as a completed official detail import.
          const detail = await this.client.fetchOpportunity(hitId);
          const mapped = GrantsGovMapper.mapDetailToOpportunity(detail);

          // Identity Invariant 1: Detail response ID must match search hit ID
          if (mapped.externalOpportunityId !== hitId) {
            throw new Error(`Identity Mismatch: Requested opp ID '${hitId}' does not match response detail ID '${mapped.externalOpportunityId}'`);
          }

          // Identity Invariant 2: Official URL ID must equal externalOpportunityId
          const expectedUrl = `https://www.grants.gov/search-results-detail/${hitId}`;
          if (mapped.sourceUrl !== expectedUrl) {
            throw new Error(`Identity Mismatch: Mapped source URL '${mapped.sourceUrl}' does not match expected '${expectedUrl}'`);
          }

          // Calculate SHA-256 payload hash
          const payloadHash = crypto
            .createHash('sha256')
            .update(JSON.stringify(detail))
            .digest('hex');

          const now = new Date();

          // Check existing record in DB
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

          // Check idempotency: If payload hash is identical, update lastRetrievedAt, skip field update & skip snapshot creation
          if (existing && existing.sourcePayloadHash === payloadHash) {
            await prisma.fundingOpportunity.update({
              where: { id: existing.id },
              data: { lastRetrievedAt: now },
            });
            recordsUnchanged++;
            continue;
          }

          // Ensure FundingSource exists
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
                websiteUrl: mapped.sourceUrl,
                description: 'Official federal funding agency via Grants.gov',
              },
            });
            fundingSourceId = source.id;
          }

          if (!existing) {
            // Create new official opportunity record
            const newOpp = await prisma.fundingOpportunity.create({
              data: {
                sourceSystem: 'GRANTS_GOV',
                externalOpportunityId: mapped.externalOpportunityId,
                fundingOpportunityNumber: mapped.fundingOpportunityNumber,
                fundingSourceId,
                isDemo: false,
                officialSourceAuthority: 'Grants.gov (U.S. Federal Government)',
                firstRetrievedAt: now,
                lastRetrievedAt: now,
                title: mapped.title,
                fundingAgency: mapped.fundingAgency,
                program: mapped.program,
                description: mapped.description,
                sourceUrl: mapped.sourceUrl,
                status: 'PENDING_HUMAN_REVIEW',
                verificationStatus: 'PENDING_HUMAN_REVIEW',
                openingDate: mapped.openingDate,
                deadline: mapped.deadline,
                awardMin: mapped.awardMin,
                awardMax: mapped.awardMax,
                totalAvailableFunding: mapped.totalAvailableFunding,
                geography: mapped.geography,
                eligibleApplicantTypes: mapped.eligibleApplicantTypes,
                eligiblePopulations: mapped.eligiblePopulations,
                matchRequirement: mapped.matchRequirement,
                periodOfPerformance: mapped.periodOfPerformance,
                allowableCosts: mapped.allowableCosts,
                prohibitedCosts: mapped.prohibitedCosts,
                sourceLastUpdatedTimestamp: mapped.sourceLastUpdatedTimestamp,
                sourcePayloadHash: payloadHash,

                // All 15 participant support categories strictly UNKNOWN
                supportTrainingStipends: 'UNKNOWN',
                supportNeedsRelatedPayments: 'UNKNOWN',
                supportTransportation: 'UNKNOWN',
                supportMeals: 'UNKNOWN',
                supportChildcare: 'UNKNOWN',
                supportTools: 'UNKNOWN',
                supportPPE: 'UNKNOWN',
                supportWorkClothing: 'UNKNOWN',
                supportLaptops: 'UNKNOWN',
                supportTrainingEquipment: 'UNKNOWN',
                supportCertifications: 'UNKNOWN',
                supportPaidWorkExperience: 'UNKNOWN',
                supportSubsidizedEmployment: 'UNKNOWN',
                supportOnTheJobTraining: 'UNKNOWN',
                supportEmergencyAssistance: 'UNKNOWN',

                sourceCitations: {
                  create: [
                    {
                      sourceUrl: mapped.sourceUrl,
                      sourceTitle: `Grants.gov Official Notice (${mapped.fundingOpportunityNumber})`,
                      sourceOrganization: mapped.fundingAgency,
                      quotedSection: `Official record imported via Grants.gov REST API. Opp ID: ${mapped.externalOpportunityId}.`,
                      extractedClaim: `Official opportunity title: ${mapped.title}`,
                    },
                  ],
                },

                opportunityAnalyses: {
                  create: [
                    {
                      overallFitScore: 0,
                      eligibilityStatus: 'INVESTIGATE',
                      missingEligibilityRequirements: ['Official source record imported via Grants.gov API pending human review'],
                      missingCapabilities: ['Unreviewed external grant notice'],
                      reasoningSummary: 'Official Grants.gov opportunity imported successfully. Human review required to confirm eligibility and score fit.',
                      humanReviewRequired: true,
                    },
                  ],
                },
              },
            });

            // Create SourceSnapshot
            await prisma.sourceSnapshot.create({
              data: {
                ingestionRunId: runId,
                fundingOpportunityId: newOpp.id,
                externalOpportunityId: mapped.externalOpportunityId,
                payloadHash,
                rawPayload: detail as any,
              },
            });

            recordsCreated++;
          } else {
            // Update EXISTING record — ONLY UPDATE SOURCE-OWNED FIELDS!
            // Protected human-owned fields (verificationStatus if VERIFIED/REJECTED, human notes, reviews, participant support) ARE PRESERVED!
            const updateData: any = {
              title: mapped.title,
              fundingOpportunityNumber: mapped.fundingOpportunityNumber,
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
              sourceLastUpdatedTimestamp: mapped.sourceLastUpdatedTimestamp,
              sourcePayloadHash: payloadHash,
              lastRetrievedAt: now,
            };

            const updatedOpp = await prisma.fundingOpportunity.update({
              where: { id: existing.id },
              data: updateData,
            });

            // Create SourceSnapshot for updated payload
            await prisma.sourceSnapshot.create({
              data: {
                ingestionRunId: runId,
                fundingOpportunityId: updatedOpp.id,
                externalOpportunityId: mapped.externalOpportunityId,
                payloadHash,
                rawPayload: detail as any,
              },
            });

            recordsUpdated++;
          }
        } catch (err: any) {
          recordsFailed++;
          errors.push(`Failed to import Grants.gov opp #${hit.id}: ${err.message || err}`);
          console.error(`[IngestionService] Error importing opp #${hit.id}:`, err);
        }
      }

      // Status determination: FAILED if all failed, PARTIAL_SUCCESS if some failed, COMPLETED if 0 failed
      const finalStatus: 'COMPLETED' | 'PARTIAL_SUCCESS' | 'FAILED' =
        recordsFailed === 0
          ? 'COMPLETED'
          : (recordsCreated > 0 || recordsUpdated > 0 || recordsUnchanged > 0)
          ? 'PARTIAL_SUCCESS'
          : 'FAILED';

      const errorSummary = errors.length > 0 ? errors.join('; ') : undefined;

      if (!isDryRun) {
        await prisma.ingestionRun.update({
          where: { id: runId },
          data: {
            status: finalStatus,
            completionTime: new Date(),
            recordsDiscovered,
            recordsCreated,
            recordsUpdated,
            recordsUnchanged,
            recordsFailed,
            errorSummary,
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
        errorSummary,
      };
    } catch (err: any) {
      if (!isDryRun) {
        await prisma.ingestionRun.update({
          where: { id: runId },
          data: {
            status: 'FAILED',
            completionTime: new Date(),
            errorSummary: err.message || 'Fatal ingestion error',
          },
        });
      }
      throw err;
    }
  }
}
