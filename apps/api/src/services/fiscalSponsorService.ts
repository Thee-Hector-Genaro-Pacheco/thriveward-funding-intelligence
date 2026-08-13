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
  citations?: Array<{
    sourceUrl: string;
    quotedSection?: string;
    extractedClaim: string;
  }>;
}

export class FiscalSponsorService {
  /**
   * List all fiscal sponsor candidates in the directory.
   */
  public static async listCandidates(filter?: {
    verificationStatus?: string;
    acceptingNewProjects?: string;
  }) {
    const where: any = {};
    if (filter?.verificationStatus) {
      where.verificationStatus = filter.verificationStatus;
    }
    if (filter?.acceptingNewProjects) {
      where.acceptingNewProjects = filter.acceptingNewProjects;
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
   * Match fiscal sponsors against a specific opportunity requiring a fiscal sponsor.
   */
  public static async matchOpportunityToSponsors(fundingOpportunityId: string) {
    const opp = await prisma.fundingOpportunity.findUnique({
      where: { id: fundingOpportunityId },
    });

    if (!opp) {
      throw new Error(`Opportunity #${fundingOpportunityId} not found`);
    }

    const candidates = await prisma.fiscalSponsorCandidate.findMany({
      include: { citations: true },
    });

    const matches = [];

    for (const candidate of candidates) {
      // Deterministic evidence-backed scoring
      let score = 50; // Base score
      const concerns: string[] = [];
      const missingInfo: string[] = [];
      const matchedLanes: string[] = [];
      const humanConfirmationRequired: string[] = [];

      // 1. Geography evaluation
      const candidateGeo = candidate.geography.toLowerCase();
      if (candidateGeo.includes('california') || candidateGeo.includes('national') || candidateGeo.includes('southern california')) {
        score += 15;
        matchedLanes.push('California Geographic Coverage');
      } else {
        concerns.push(`Sponsor geography (${candidate.geography}) may not cover Bridge Forward service area.`);
      }

      // 2. Government grant administration
      if (candidate.administersGovGrants === 'YES') {
        score += 20;
        matchedLanes.push('Government Grant Administration');
      } else if (candidate.administersGovGrants === 'UNKNOWN') {
        missingInfo.push('Confirm whether sponsor administers federal/state government grants');
        humanConfirmationRequired.push('Verify federal grant administration policy');
      } else {
        score -= 25;
        concerns.push('Sponsor does not administer government grants');
      }

      // 3. Federal grant capability (SAM/UEI)
      if (candidate.federalGrantCapability.toLowerCase().includes('active') || candidate.samUeiStatus.toLowerCase().includes('verified')) {
        score += 15;
        matchedLanes.push('Active SAM.gov & UEI Federal Registration');
      } else if (candidate.samUeiStatus === 'UNKNOWN') {
        missingInfo.push('Verify sponsor active SAM.gov registration & UEI number');
      }

      // 4. Accepting new projects
      if (candidate.acceptingNewProjects === 'NO') {
        score -= 40;
        concerns.push('Sponsor is currently NOT accepting new projects');
      } else if (candidate.acceptingNewProjects === 'UNKNOWN') {
        missingInfo.push('Confirm if sponsor is accepting new project applications');
        humanConfirmationRequired.push('Contact sponsor to confirm open project intake');
      }

      // 5. Fee & lead time implications
      const feeNotes = `Setup Fee: ${candidate.setupFee} • Admin Percentage: ${candidate.adminPercentage} • Est. Review Time: ${candidate.estimatedReviewTime}`;

      // Calculate evidence coverage %
      const knownFields = [
        candidate.acceptingNewProjects !== 'UNKNOWN',
        candidate.administersGovGrants !== 'UNKNOWN',
        candidate.federalGrantCapability !== 'UNKNOWN',
        candidate.samUeiStatus !== 'UNKNOWN',
        candidate.setupFee !== 'UNKNOWN',
        candidate.adminPercentage !== 'UNKNOWN',
        candidate.estimatedReviewTime !== 'UNKNOWN',
      ];
      const evidenceCoverage = Math.round((knownFields.filter(Boolean).length / knownFields.length) * 100);

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
        evidenceCoverage,
        matchedLanes,
        alignmentRationale: `Sponsor ${candidate.name} evaluated for ${opp.title}. Alignment score: ${finalScore}/100.`,
        legalApplicantCapability: candidate.administersGovGrants === 'YES' ? 'Eligible Legal Applicant' : 'Requires Investigation',
        govGrantAdminCapability: candidate.federalGrantCapability,
        arrangementAllowed: 'Model A / Model F Fiscal Sponsorship',
        feeAndLeadTimeNotes: feeNotes,
        humanConfirmationRequired,
        concerns,
        missingInfo,
        recommendedNextStep: finalScore >= 70 ? 'Schedule Discovery Call & Review Intake Form' : 'Conduct Preliminary Inquiry',
      };

      let persisted;
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
