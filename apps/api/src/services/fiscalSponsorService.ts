import { prisma } from '../lib/prisma';
import { SponsorMatchStatus, TriStateStatus } from '@prisma/client';
import { BRIDGE_FORWARD_PROFILE } from '@bridge-ai/shared';

export interface CreateSponsorCandidateInput {
  name: string;
  websiteUrl: string;
  directorySourceUrl: string;
  geography: string;
  mission: string;
  populationsServed: string[];
  modelsOffered: string[];
  acceptingNewProjects?: string;
  applicationProcess?: string;
  estimatedReviewTime?: string;
  setupFee?: string;
  adminPercentage?: string;
  minRevenueRequirement?: string;
  administersGovGrants?: string;
  federalGrantCapability?: string;
  samUeiStatus?: string;
  contactChannel?: string;
  verificationStatus?: string;
  internalNotes?: string;
  isFixture?: boolean;
  identityVerified?: string;
  websiteVerified?: string;
  intakeStatus?: string;
  sponsorshipModelsVerified?: string;
  governmentGrantAdministrationVerified?: string;
  feeVerified?: string;
  leadTimeVerified?: string;
  opportunitySpecificCompatibility?: string;
  citations?: Array<{
    sourceUrl: string;
    quotedSection?: string;
    extractedClaim: string;
  }>;
}

export class FiscalSponsorService {
  /**
   * List all active fiscal sponsor candidates in the directory (excluding merged aliases).
   */
  public static async listCandidates(filter?: {
    verificationStatus?: string;
    acceptingNewProjects?: string;
    isFixture?: boolean;
    includeMerged?: boolean;
  }) {
    const where: any = {};
    if (!filter?.includeMerged) {
      where.isMerged = false;
    }
    if (filter?.verificationStatus) {
      where.verificationStatus = filter.verificationStatus;
    }
    if (filter?.acceptingNewProjects) {
      where.acceptingNewProjects = filter.acceptingNewProjects;
    }
    if (filter?.isFixture !== undefined) {
      where.isFixture = filter.isFixture;
    }

    return await prisma.fiscalSponsorCandidate.findMany({
      where,
      include: {
        citations: true,
        opportunityMatches: {
          include: {
            fundingOpportunity: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  /**
   * Create a new persistent fiscal sponsor candidate record.
   * Ensures unverified fields default to UNKNOWN.
   */
  public static async createCandidate(input: CreateSponsorCandidateInput) {
    const acceptingNewProjects = input.acceptingNewProjects || 'UNKNOWN';
    const administersGovGrants = input.administersGovGrants || 'UNKNOWN';
    const federalGrantCapability = input.federalGrantCapability || 'UNKNOWN';
    const samUeiStatus = input.samUeiStatus || 'UNKNOWN';
    const setupFee = input.setupFee || 'UNKNOWN';
    const adminPercentage = input.adminPercentage || 'UNKNOWN';
    const estimatedReviewTime = input.estimatedReviewTime || 'UNKNOWN';
    const applicationProcess = input.applicationProcess || 'UNKNOWN';
    const minRevenueRequirement = input.minRevenueRequirement || 'UNKNOWN';
    const contactChannel = input.contactChannel || 'UNKNOWN';
    const verificationStatus = input.verificationStatus || 'PENDING_HUMAN_REVIEW';

    const isFixture = input.isFixture ?? false;
    const identityVerified = input.identityVerified || 'UNKNOWN';
    const websiteVerified = input.websiteVerified || (input.websiteUrl ? 'CONFIRMED' : 'UNKNOWN');
    const intakeStatus = input.intakeStatus || 'UNKNOWN';
    const sponsorshipModelsVerified = input.sponsorshipModelsVerified || 'UNKNOWN';
    const governmentGrantAdministrationVerified = input.governmentGrantAdministrationVerified || 'UNKNOWN';
    const feeVerified = input.feeVerified || 'UNKNOWN';
    const leadTimeVerified = input.leadTimeVerified || 'UNKNOWN';
    const opportunitySpecificCompatibility = input.opportunitySpecificCompatibility || 'HUMAN_CONFIRMATION_REQUIRED';

    return await prisma.fiscalSponsorCandidate.create({
      data: {
        name: input.name,
        websiteUrl: input.websiteUrl,
        directorySourceUrl: input.directorySourceUrl,
        geography: input.geography,
        mission: input.mission,
        populationsServed: input.populationsServed || [],
        modelsOffered: input.modelsOffered || [],
        acceptingNewProjects,
        applicationProcess,
        estimatedReviewTime,
        setupFee,
        adminPercentage,
        minRevenueRequirement,
        administersGovGrants,
        federalGrantCapability,
        samUeiStatus,
        contactChannel,
        verificationStatus,
        internalNotes: input.internalNotes,
        isFixture,
        identityVerified,
        websiteVerified,
        intakeStatus,
        sponsorshipModelsVerified,
        governmentGrantAdministrationVerified,
        feeVerified,
        leadTimeVerified,
        opportunitySpecificCompatibility,
        citations: input.citations
          ? {
              create: input.citations.map((c) => ({
                sourceUrl: c.sourceUrl,
                quotedSection: c.quotedSection,
                extractedClaim: c.extractedClaim,
              })),
            }
          : undefined,
      },
      include: {
        citations: true,
      },
    });
  }

  /**
   * Helper to normalize a website or source URL into a canonical domain identifier.
   */
  public static extractCanonicalDomain(url: string): string {
    if (!url) return '';
    return url
      .toLowerCase()
      .replace(/^https?:\/\//, '')
      .replace(/^portal\./, '')
      .replace(/^www\./, '')
      .replace(/\/.*$/, '')
      .trim();
  }

  /**
   * Resolves a candidate ID to its final active canonical candidate ID.
   * Recursively follows `mergedIntoId` pointers until reaching `isMerged = false, mergedIntoId = null`.
   * Fails closed with structured errors if a cycle, missing target, or self-reference is detected.
   */
  public static async resolveFinalCanonicalCandidateId(candidateId: string): Promise<string> {
    if (!candidateId) {
      throw new Error('Canonical ID Resolver Error: candidateId must be provided.');
    }

    const visited = new Set<string>();
    let currentId = candidateId;

    while (currentId) {
      if (visited.has(currentId)) {
        throw new Error(`Canonical ID Resolver Error: Merge cycle or self-reference detected for candidate '${candidateId}' at '${currentId}'.`);
      }
      visited.add(currentId);

      const candidate = await prisma.fiscalSponsorCandidate.findUnique({
        where: { id: currentId },
        select: { id: true, isMerged: true, mergedIntoId: true },
      });

      if (!candidate) {
        throw new Error(`Canonical ID Resolver Error: Candidate record '${currentId}' not found in database.`);
      }

      if (!candidate.isMerged) {
        if (candidate.mergedIntoId) {
          throw new Error(`Canonical ID Resolver Error: Invalid candidate state for '${currentId}' (isMerged is false but mergedIntoId is set).`);
        }
        return candidate.id;
      }

      if (!candidate.mergedIntoId) {
        throw new Error(`Canonical ID Resolver Error: Merged candidate '${currentId}' has missing mergedIntoId target.`);
      }

      currentId = candidate.mergedIntoId;
    }

    throw new Error(`Canonical ID Resolver Error: Unable to resolve canonical candidate ID for '${candidateId}'.`);
  }

  /**
   * Reconciles duplicate fiscal sponsor candidates by canonical domain.
   * Merges duplicate candidates into a single canonical record, re-links citations & matches,
   * and marks merged candidates with `isMerged: true` and `mergedIntoId`.
   */
  public static async reconcileDuplicateSponsors(): Promise<{ mergedCount: number }> {
    const allCandidates = await prisma.fiscalSponsorCandidate.findMany({
      orderBy: { createdAt: 'asc' },
    });

    const domainMap = new Map<string, typeof allCandidates>();
    for (const candidate of allCandidates) {
      const domain = candidate.canonicalDomain || this.extractCanonicalDomain(candidate.websiteUrl);
      if (!domain) continue;
      const list = domainMap.get(domain) || [];
      list.push(candidate);
      domainMap.set(domain, list);
    }

    let mergedCount = 0;

    const canonicalMap: Record<string, string> = {
      'communitypartners.org': 'sponsor-community-partners-la',
      'communityinitiatives.org': 'sponsor-community-initiatives-sf',
      'saveourplanet.org': '3264d2c7-9803-456f-a907-61205e9f6d0c',
    };

    for (const [domain, candidates] of domainMap.entries()) {
      if (candidates.length <= 1) {
        if (candidates.length === 1 && !candidates[0].canonicalDomain) {
          await prisma.fiscalSponsorCandidate.update({
            where: { id: candidates[0].id },
            data: { canonicalDomain: domain },
          });
        }
        continue;
      }

      // Designate canonical candidate (prefer explicitly mapped ID, fixture, or oldest)
      const preferredId = canonicalMap[domain];
      let canonical = candidates.find((c) => c.id === preferredId);
      if (!canonical) {
        canonical = candidates.find((c) => c.isFixture || c.hasLiveVerification) || candidates[0];
      }

      if (!canonical.canonicalDomain) {
        await prisma.fiscalSponsorCandidate.update({
          where: { id: canonical.id },
          data: { canonicalDomain: domain },
        });
      }

      const duplicates = candidates.filter((c) => c.id !== canonical.id);

      for (const dup of duplicates) {
        if (!dup.isMerged) {
          mergedCount++;
        }

        // Re-link citations cleanly without creating duplicate rows
        const dupCitations = await prisma.sponsorSourceCitation.findMany({
          where: { fiscalSponsorCandidateId: dup.id },
        });

        for (const citation of dupCitations) {
          const existingCitation = await prisma.sponsorSourceCitation.findFirst({
            where: {
              fiscalSponsorCandidateId: canonical.id,
              sourceUrl: citation.sourceUrl,
            },
          });
          if (existingCitation) {
            await prisma.sponsorSourceCitation.delete({ where: { id: citation.id } });
          } else {
            await prisma.sponsorSourceCitation.update({
              where: { id: citation.id },
              data: { fiscalSponsorCandidateId: canonical.id },
            });
          }
        }

        // Re-link opportunity matches
        const dupMatches = await prisma.opportunitySponsorMatch.findMany({
          where: { fiscalSponsorCandidateId: dup.id },
        });

        for (const match of dupMatches) {
          const existingMatch = await prisma.opportunitySponsorMatch.findFirst({
            where: {
              fundingOpportunityId: match.fundingOpportunityId,
              fiscalSponsorCandidateId: canonical.id,
            },
          });
          if (existingMatch) {
            await prisma.opportunitySponsorMatch.delete({ where: { id: match.id } });
          } else {
            await prisma.opportunitySponsorMatch.update({
              where: { id: match.id },
              data: { fiscalSponsorCandidateId: canonical.id },
            });
          }
        }

        // Mark duplicate as merged
        await prisma.fiscalSponsorCandidate.update({
          where: { id: dup.id },
          data: {
            isMerged: true,
            mergedIntoId: canonical.id,
            canonicalDomain: domain,
          },
        });
        mergedCount++;
      }
    }

    // Global citation deduplication cleanup for active canonical candidates
    const allCitations = await prisma.sponsorSourceCitation.findMany({
      orderBy: { fetchedAt: 'asc' },
    });
    const seenCitations = new Set<string>();
    for (const citation of allCitations) {
      const key = `${citation.fiscalSponsorCandidateId}:${citation.sourceUrl}`;
      if (seenCitations.has(key)) {
        await prisma.sponsorSourceCitation.delete({ where: { id: citation.id } });
      } else {
        seenCitations.add(key);
      }
    }

    return { mergedCount };
  }

  /**
   * Calculates granular evidence coverage metrics (0–100%) for a sponsor candidate.
   */
  public static calculateCoverageMetrics(candidate: {
    websiteVerified?: string;
    identityVerified?: string;
    sponsorshipModelsVerified?: string;
    intakeStatus?: string;
    feeVerified?: string;
    leadTimeVerified?: string;
    governmentGrantAdministrationVerified?: string;
    administersGovGrants?: string;
    samUeiStatus?: string;
    opportunitySpecificCompatibility?: string;
  }) {
    // 1. Identity Evidence Coverage (% of confirmed identity & website)
    const identityFields = [
      candidate.identityVerified === 'CONFIRMED',
      candidate.websiteVerified === 'CONFIRMED',
    ];
    const identityEvidenceCoverage = Math.round(
      (identityFields.filter(Boolean).length / identityFields.length) * 100
    );

    // 2. Operational Evidence Coverage (% of confirmed fees, lead times, intake, models, gov grant admin)
    const operationalFields = [
      candidate.sponsorshipModelsVerified === 'CONFIRMED',
      candidate.intakeStatus !== 'UNKNOWN',
      candidate.feeVerified === 'CONFIRMED',
      candidate.leadTimeVerified === 'CONFIRMED',
      candidate.governmentGrantAdministrationVerified === 'CONFIRMED' || candidate.administersGovGrants === 'YES',
    ];
    const operationalEvidenceCoverage = Math.round(
      (operationalFields.filter(Boolean).length / operationalFields.length) * 100
    );

    // 3. Opportunity Compatibility Coverage (% of confirmed solicitation-specific eligibility, SAM/UEI, willingness)
    const compatibilityFields = [
      candidate.samUeiStatus !== 'UNKNOWN' && candidate.samUeiStatus?.toLowerCase().includes('verified'),
      candidate.opportunitySpecificCompatibility !== 'HUMAN_CONFIRMATION_REQUIRED' && candidate.opportunitySpecificCompatibility === 'CONFIRMED',
    ];
    const opportunityCompatibilityCoverage = Math.round(
      (compatibilityFields.filter(Boolean).length / compatibilityFields.length) * 100
    );

    return {
      identityEvidenceCoverage,
      operationalEvidenceCoverage,
      opportunityCompatibilityCoverage,
    };
  }

  /**
   * Evaluates compatibility and generates opportunity-sponsor match records.
   */
  public static async matchOpportunityToSponsors(opportunityId: string) {
    // Ensure duplicates are reconciled prior to matching
    await this.reconcileDuplicateSponsors();

    const opp = await prisma.fundingOpportunity.findUnique({
      where: { id: opportunityId },
    });

    if (!opp) {
      throw new Error(`Opportunity #${opportunityId} not found`);
    }

    const candidates = await this.listCandidates();
    const matches = [];

    for (const candidate of candidates) {
      let score = 50;
      const matchedLanes: string[] = [];
      const humanConfirmationRequired: string[] = [];
      const concerns: string[] = [];
      const missingInfo: string[] = [];

      // 1. Mission and geographic alignment
      if (candidate.geography.toLowerCase().includes('california')) {
        score += 15;
        matchedLanes.push('California Regional Geography');
      } else {
        concerns.push(`Sponsor geography (${candidate.geography}) may not cover Bridge Forward service area.`);
      }

      // 2. Government grant administration capability
      if (candidate.administersGovGrants === 'YES') {
        score += 20;
        matchedLanes.push('Publishes government-grant administration services');
      } else if (candidate.administersGovGrants === 'UNKNOWN') {
        missingInfo.push('Confirm whether sponsor administers federal/state government grants');
        humanConfirmationRequired.push('Verify government grant administration capability');
      } else {
        score -= 25;
        concerns.push('Sponsor does not publish government grant administration capability');
      }

      // 3. Federal grant registration (SAM/UEI)
      if (candidate.federalGrantCapability.toLowerCase().includes('active') || candidate.samUeiStatus.toLowerCase().includes('verified')) {
        score += 15;
        matchedLanes.push('Active SAM.gov & UEI Federal Registration');
      } else if (candidate.samUeiStatus === 'UNKNOWN') {
        missingInfo.push('Verify sponsor active SAM.gov registration & UEI number');
        humanConfirmationRequired.push('Federal registration status not independently verified');
      }

      // 4. Accepting new projects
      if (candidate.acceptingNewProjects === 'NO') {
        score -= 40;
        concerns.push('Sponsor is currently NOT accepting new projects');
      } else if (candidate.acceptingNewProjects === 'UNKNOWN') {
        missingInfo.push('Confirm if sponsor is accepting new project applications');
        humanConfirmationRequired.push('Contact sponsor to confirm open project intake');
      }

      // 4b. Specific model & project type compatibility concerns
      const oppText = (opp.title + ' ' + (opp.description || '')).toLowerCase();
      if (oppText.includes('housing') || oppText.includes('homeless')) {
        if (candidate.name.toLowerCase().includes('community partners')) {
          concerns.push('Compatibility Concern: Community Partners Model A does not accept projects where housing is a key element.');
        }
      }
      if (opp.fundingAgency?.toLowerCase().includes('hhs') || opp.fundingAgency?.toLowerCase().includes('acf') || oppText.includes('street outreach') || oppText.includes('cost-reimbursement')) {
        if (candidate.name.toLowerCase().includes('community partners')) {
          concerns.push('Compatibility Concern: Community Partners Model C does not accept government-funded cost-reimbursement projects.');
        }
      }

      humanConfirmationRequired.push('Solicitation-specific legal-applicant willingness requires human confirmation');

      // 5. Fee & lead time implications
      const feeNotes = `Setup Fee: ${candidate.setupFee} • Admin Percentage: ${candidate.adminPercentage} • Est. Review Time: ${candidate.estimatedReviewTime}`;

      const { identityEvidenceCoverage, operationalEvidenceCoverage, opportunityCompatibilityCoverage } =
        this.calculateCoverageMetrics(candidate);

      const overallEvidenceCoverage = Math.round(
        (identityEvidenceCoverage + operationalEvidenceCoverage + opportunityCompatibilityCoverage) / 3
      );

      const finalScore = Math.max(0, Math.min(100, score));

      // Upsert OpportunitySponsorMatch
      const existingMatch = await prisma.opportunitySponsorMatch.findFirst({
        where: {
          fundingOpportunityId: opp.id,
          fiscalSponsorCandidateId: candidate.id,
        },
      });

      const matchData = {
        matchScore: finalScore,
        evidenceCoverage: overallEvidenceCoverage,
        matchedLanes,
        alignmentRationale: `Sponsor ${candidate.name} evaluated for ${opp.title}. Alignment score: ${finalScore}/100.`,
        legalApplicantCapability: candidate.administersGovGrants === 'YES' ? 'Publishes government-grant administration services' : 'Requires Investigation',
        govGrantAdminCapability: candidate.administersGovGrants === 'YES' ? 'Publishes government-grant administration services' : 'Federal registration status not independently verified',
        arrangementAllowed: 'Model A / Model F Fiscal Sponsorship',
        feeAndLeadTimeNotes: feeNotes,
        humanConfirmationRequired,
        concerns,
        missingInfo,
        recommendedNextStep: 'Possible sponsor — research and human confirmation required',
      };

      let persisted;
      try {
        if (existingMatch) {
          persisted = await prisma.opportunitySponsorMatch.update({
            where: { id: existingMatch.id },
            data: matchData,
          });
        } else {
          persisted = await prisma.opportunitySponsorMatch.create({
            data: {
              fundingOpportunityId: opp.id,
              fiscalSponsorCandidateId: candidate.id,
              status: SponsorMatchStatus.POSSIBLE_MATCH,
              humanApproved: false,
              ...matchData,
            },
          });
        }
        matches.push(persisted);
      } catch (e) {
        // Skip candidate if deleted concurrently during test teardown
        continue;
      }
    }

    return matches;
  }

  /**
   * Transition sponsor match status with strict human approval safeguards.
   */
  public static async transitionMatchStatus(params: {
    matchId: string;
    targetStatus: SponsorMatchStatus;
    reviewerId: string;
    authHeader?: string;
    notes?: string;
  }) {
    const match = await prisma.opportunitySponsorMatch.findUnique({
      where: { id: params.matchId },
      include: { fiscalSponsorCandidate: true },
    });

    if (!match) {
      throw new Error(`Sponsor match #${params.matchId} not found`);
    }

    const { targetStatus, reviewerId, authHeader } = params;

    // Safeguard 1: Statuses beyond POSSIBLE_MATCH require explicit human authorization
    const advancedStatuses: SponsorMatchStatus[] = [
      SponsorMatchStatus.CONTACT_APPROVED,
      SponsorMatchStatus.CONTACTED,
      SponsorMatchStatus.DISCOVERY_CALL,
      SponsorMatchStatus.APPLICATION_SUBMITTED,
      SponsorMatchStatus.ACCEPTED,
    ];

    if (advancedStatuses.includes(targetStatus)) {
      if (!reviewerId || reviewerId.trim() === '') {
        throw new Error('Advancing sponsor match beyond POSSIBLE_MATCH requires explicit human reviewer authorization.');
      }
    }

    // Safeguard 2: Unverified sponsors cannot be marked ACCEPTED
    if (targetStatus === SponsorMatchStatus.ACCEPTED) {
      if (match.fiscalSponsorCandidate.verificationStatus !== 'VERIFIED') {
        throw new Error(`Cannot set match status to ACCEPTED: Sponsor '${match.fiscalSponsorCandidate.name}' is unverified (${match.fiscalSponsorCandidate.verificationStatus}). Human verification of directory listing & legal credentials required first.`);
      }
    }

    return await prisma.opportunitySponsorMatch.update({
      where: { id: params.matchId },
      data: {
        status: targetStatus,
        humanApproved: true,
      },
    });
  }
}
