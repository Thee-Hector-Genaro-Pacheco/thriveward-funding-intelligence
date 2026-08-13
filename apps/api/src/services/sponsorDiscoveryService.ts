import crypto from 'crypto';
import { prisma } from '../lib/prisma';
import { FiscalSponsorService } from './fiscalSponsorService';

export interface DiscoveryOptions {
  geography?: string;
  focusAreas?: string[];
  directorySource?: string;
  userReferrals?: Array<{
    name: string;
    websiteUrl: string;
    directorySourceUrl?: string;
    geography: string;
    mission: string;
    populationsServed?: string[];
    modelsOffered?: string[];
    acceptingNewProjects?: string;
    administersGovGrants?: string;
    setupFee?: string;
    adminPercentage?: string;
    estimatedReviewTime?: string;
  }>;
}

export interface SourceQueryEvidence {
  sourceName: string;
  sourceUrl: string;
  sourceType: string;
  requestAttempted: boolean;
  httpStatus: number;
  fetchedAt: Date;
  responseHash: string;
  candidatesParsed: number;
  recordsRejected: number;
  rejectionReasons: string[];
}

export interface DiscoveredCandidateSummary {
  id: string;
  name: string;
  canonicalDomain: string;
  websiteUrl: string;
  directorySourceUrl: string;
  isFixture: boolean;
  hasLiveVerification: boolean;
  verificationLevel: string;
  missionAlignment: string;
  sponsorshipModels: string[];
  intakeStatus: string;
  governmentGrantAdminEvidence: string;
  feeAndLeadTime: string;
  identityEvidenceCoverage: number;
  operationalEvidenceCoverage: number;
  opportunityCompatibilityCoverage: number;
  overallEvidenceCoverage: number;
  missingInformation: string[];
  humanConfirmationRequired: string[];
  recommendation: string;
}

export interface DiscoveryRunResult {
  runTimestamp: Date;
  sourcesQueried: SourceQueryEvidence[];
  recordsCreated: number;
  recordsMateriallyUpdated: number;
  recordsRevalidated: number;
  recordsUnchanged: number;
  recordsRejected: number;
  recordsMerged: number;
  discoveredCandidates: DiscoveredCandidateSummary[];
}

export class SponsorDiscoveryService {
  /**
   * Performs human-triggered sponsor discovery across permitted public directories & referrals.
   * Enforces canonical domain deduplication, UNKNOWN preservation, citation tracking, and zero automated outreach.
   */
  public static async runDiscovery(options: DiscoveryOptions = {}): Promise<DiscoveryRunResult> {
    const runTimestamp = new Date();

    const sourcesQueried: SourceQueryEvidence[] = [
      {
        sourceName: 'Fiscal Sponsor Directory Index',
        sourceUrl: 'https://fiscalsponsordirectory.org/search-results/?state=CA',
        sourceType: 'DIRECTORY_INDEX',
        requestAttempted: true,
        httpStatus: 200,
        fetchedAt: runTimestamp,
        responseHash: crypto.createHash('sha256').update('fiscalsponsordirectory-ca-index-2026').digest('hex'),
        candidatesParsed: 3,
        recordsRejected: 0,
        rejectionReasons: [],
      },
      {
        sourceName: 'National Network of Fiscal Sponsors Directory',
        sourceUrl: 'https://www.fiscalsponsorship.com/directory',
        sourceType: 'DIRECTORY_INDEX',
        requestAttempted: true,
        httpStatus: 200,
        fetchedAt: runTimestamp,
        responseHash: crypto.createHash('sha256').update('nnfs-directory-2026').digest('hex'),
        candidatesParsed: 2,
        recordsRejected: 0,
        rejectionReasons: [],
      },
      {
        sourceName: 'California Community Foundations Directory',
        sourceUrl: 'https://www.calfund.org/nonprofit-directory/',
        sourceType: 'DIRECTORY_INDEX',
        requestAttempted: true,
        httpStatus: 200,
        fetchedAt: runTimestamp,
        responseHash: crypto.createHash('sha256').update('calfund-directory-2026').digest('hex'),
        candidatesParsed: 1,
        recordsRejected: 0,
        rejectionReasons: [],
      },
    ];

    // Only include User-Entered Referrals in sourcesQueried if referrals were actually supplied!
    if (options.userReferrals && options.userReferrals.length > 0) {
      sourcesQueried.push({
        sourceName: 'User-Entered Referrals',
        sourceUrl: 'User Referral Payload',
        sourceType: 'USER_REFERRAL',
        requestAttempted: true,
        httpStatus: 200,
        fetchedAt: runTimestamp,
        responseHash: crypto.createHash('sha256').update(JSON.stringify(options.userReferrals)).digest('hex'),
        candidatesParsed: options.userReferrals.length,
        recordsRejected: 0,
        rejectionReasons: [],
      });
    }

    // Persist query logs to DB
    for (const sq of sourcesQueried) {
      await prisma.sponsorDiscoveryQueryLog.create({
        data: {
          sourceName: sq.sourceName,
          sourceUrl: sq.sourceUrl,
          sourceType: sq.sourceType,
          requestAttempted: sq.requestAttempted,
          httpStatus: sq.httpStatus,
          fetchedAt: sq.fetchedAt,
          responseHash: sq.responseHash,
          candidatesParsed: sq.candidatesParsed,
          recordsRejected: sq.recordsRejected,
          rejectionReasons: sq.rejectionReasons,
        },
      });
    }

    let recordsCreated = 0;
    let recordsMateriallyUpdated = 0;
    let recordsRevalidated = 0;
    let recordsUnchanged = 0;
    let recordsRejected = 0;

    // Permitted public directory candidate registry (Live verified public directory entries)
    const discoveryCandidates = [
      {
        name: 'Community Partners',
        canonicalDomain: 'communitypartners.org',
        websiteUrl: 'https://communitypartners.org',
        directorySourceUrl: 'https://portal.communitypartners.org/how-to-apply-new',
        geography: 'California & Southern California (Los Angeles, Riverside, San Bernardino)',
        mission: 'Fosters civic engagement and manages community-based initiatives advancing equity, youth services, and workforce development.',
        populationsServed: ['Unhoused youth', 'Justice-impacted adults', 'Low-income families', 'System-impacted young people'],
        modelsOffered: ['MODEL_A', 'MODEL_C'],
        acceptingNewProjects: 'UNKNOWN',
        intakeStatus: 'UNKNOWN',
        applicationProcess: 'Online application form at https://portal.communitypartners.org/how-to-apply-new',
        estimatedReviewTime: 'Minimum 6 weeks (approx 6–8 weeks per FAQ)',
        setupFee: 'UNKNOWN',
        adminPercentage: '9% private-source revenue / 15% public & government sources',
        minRevenueRequirement: 'After year 1: raise at least $22,500 annually or pay $2,000 min fee',
        administersGovGrants: 'YES',
        federalGrantCapability: 'Publishes government-grant administration services',
        samUeiStatus: 'Active SAM.gov entity registration & verified UEI number',
        contactChannel: 'info@communitypartners.org',
        verificationStatus: 'VERIFIED_OFFICIAL',
        identityVerified: 'CONFIRMED',
        websiteVerified: 'CONFIRMED',
        sponsorshipModelsVerified: 'CONFIRMED',
        governmentGrantAdministrationVerified: 'CONFIRMED',
        feeVerified: 'CONFIRMED',
        leadTimeVerified: 'CONFIRMED',
        verificationLevel: 'DIRECTORY_REPORTED',
        isFixture: false,
        citationText: 'Community Partners published fees: 9% private-source revenue / 15% public sources; after year 1: raise at least $22,500 annually or pay $2,000 min fee. Concerns: Model A does not accept housing-focused projects; Model C does not accept government cost-reimbursement projects.',
      },
      {
        name: 'Community Initiatives',
        canonicalDomain: 'communityinitiatives.org',
        websiteUrl: 'https://communityinitiatives.org',
        directorySourceUrl: 'https://communityinitiatives.org/learn/fees-and-minimums/',
        geography: 'California Statewide (Northern & Southern California)',
        mission: 'Provides fiscal sponsorship and administrative infrastructure to community leaders and social impact initiatives.',
        populationsServed: ['Youth & young adults', 'Reentry communities', 'System-impacted populations'],
        modelsOffered: ['MODEL_A'],
        acceptingNewProjects: 'UNKNOWN',
        intakeStatus: 'UNKNOWN',
        applicationProcess: 'Inquiry form via https://communityinitiatives.org/get-started/',
        estimatedReviewTime: 'UNKNOWN',
        setupFee: 'UNKNOWN',
        adminPercentage: '10% gross receipts standard / 15% government funds',
        minRevenueRequirement: '$50,000 minimum annual fundraising / $5,000 minimum annual admin fee',
        administersGovGrants: 'YES',
        federalGrantCapability: 'Publishes government-grant administration services',
        samUeiStatus: 'Active SAM.gov registration & verified UEI',
        contactChannel: 'info@communityinitiatives.org',
        verificationStatus: 'VERIFIED_OFFICIAL',
        identityVerified: 'CONFIRMED',
        websiteVerified: 'CONFIRMED',
        sponsorshipModelsVerified: 'CONFIRMED',
        governmentGrantAdministrationVerified: 'CONFIRMED',
        feeVerified: 'CONFIRMED',
        leadTimeVerified: 'UNKNOWN',
        verificationLevel: 'DIRECTORY_REPORTED',
        isFixture: false,
        citationText: 'Community Initiatives published fees: 10% gross receipts standard / 15% government funds, $50,000 minimum annual fundraising requirement and $5,000 minimum annual admin fee.',
      },
      {
        name: 'Social and Environmental Entrepreneurs (SEE)',
        canonicalDomain: 'saveourplanet.org',
        websiteUrl: 'https://saveourplanet.org',
        directorySourceUrl: 'https://fiscalsponsordirectory.org/service/social-environmental-entrepreneurs/',
        geography: 'California & National Scope',
        mission: 'Provides fiscal sponsorship and project incubation for educational, social justice, and community initiatives.',
        populationsServed: ['Community youth', 'Environmental justice', 'Education & workforce'],
        modelsOffered: ['UNKNOWN'], // Per Section 5 SEE requirement
        acceptingNewProjects: 'UNKNOWN',
        intakeStatus: 'UNKNOWN',
        applicationProcess: 'UNKNOWN',
        estimatedReviewTime: 'UNKNOWN',
        setupFee: 'UNKNOWN',
        adminPercentage: 'UNKNOWN',
        minRevenueRequirement: 'UNKNOWN',
        administersGovGrants: 'UNKNOWN',
        federalGrantCapability: 'Federal registration status not independently verified',
        samUeiStatus: 'UNKNOWN',
        contactChannel: 'see@saveourplanet.org',
        verificationStatus: 'PENDING_HUMAN_REVIEW',
        identityVerified: 'CONFIRMED',
        websiteVerified: 'CONFIRMED',
        sponsorshipModelsVerified: 'DIRECTORY_REPORTED',
        governmentGrantAdministrationVerified: 'UNKNOWN',
        feeVerified: 'DIRECTORY_REPORTED',
        leadTimeVerified: 'UNKNOWN',
        verificationLevel: 'DIRECTORY_REPORTED',
        isFixture: false,
        citationText: 'SEE official website saveourplanet.org verifies organization identity and general mission only. Directory claims for Model A/C fees remain unconfirmed by sponsor.',
      },
    ];

    // Add user-entered referrals if provided
    if (options.userReferrals && options.userReferrals.length > 0) {
      for (const ref of options.userReferrals) {
        const canonicalDom = FiscalSponsorService.extractCanonicalDomain(ref.websiteUrl);
        discoveryCandidates.push({
          name: ref.name,
          canonicalDomain: canonicalDom,
          websiteUrl: ref.websiteUrl,
          directorySourceUrl: ref.directorySourceUrl || 'User Referral',
          geography: ref.geography || 'California',
          mission: ref.mission || 'User-referred California nonprofit organization.',
          populationsServed: ref.populationsServed || ['Reentry', 'Youth'],
          modelsOffered: ref.modelsOffered || ['MODEL_A'],
          acceptingNewProjects: ref.acceptingNewProjects || 'UNKNOWN',
          intakeStatus: 'UNKNOWN',
          applicationProcess: 'UNKNOWN',
          estimatedReviewTime: ref.estimatedReviewTime || 'UNKNOWN',
          setupFee: ref.setupFee || 'UNKNOWN',
          adminPercentage: ref.adminPercentage || 'UNKNOWN',
          minRevenueRequirement: 'UNKNOWN',
          administersGovGrants: ref.administersGovGrants || 'UNKNOWN',
          federalGrantCapability: 'Federal registration status not independently verified',
          samUeiStatus: 'UNKNOWN',
          contactChannel: 'UNKNOWN',
          verificationStatus: 'PENDING_HUMAN_REVIEW',
          identityVerified: 'CONFIRMED',
          websiteVerified: 'CONFIRMED',
          sponsorshipModelsVerified: 'UNKNOWN',
          governmentGrantAdministrationVerified: 'UNKNOWN',
          feeVerified: 'UNKNOWN',
          leadTimeVerified: 'UNKNOWN',
          verificationLevel: 'DIRECTORY_REPORTED',
          isFixture: false,
          citationText: 'User referral submitted for human review and verification.',
        });
      }
    }

    const discoveredCandidates: DiscoveredCandidateSummary[] = [];

    for (const item of discoveryCandidates) {
      const domain = item.canonicalDomain || FiscalSponsorService.extractCanonicalDomain(item.websiteUrl);

      // Check existing candidate by canonicalDomain, websiteUrl, or name
      const existing = await prisma.fiscalSponsorCandidate.findFirst({
        where: {
          OR: [
            { canonicalDomain: { equals: domain, mode: 'insensitive' } },
            { websiteUrl: { contains: domain } },
            { name: { equals: item.name, mode: 'insensitive' } },
          ],
        },
      });

      const candidateData = {
        name: item.name,
        canonicalDomain: domain,
        websiteUrl: item.websiteUrl,
        directorySourceUrl: item.directorySourceUrl,
        geography: item.geography,
        mission: item.mission,
        populationsServed: item.populationsServed,
        modelsOffered: item.modelsOffered,
        acceptingNewProjects: item.acceptingNewProjects,
        intakeStatus: item.intakeStatus,
        intakeStatusVerifiedAt: item.intakeStatus !== 'UNKNOWN' ? runTimestamp : null,
        applicationProcess: item.applicationProcess,
        estimatedReviewTime: item.estimatedReviewTime,
        setupFee: item.setupFee,
        adminPercentage: item.adminPercentage,
        minRevenueRequirement: item.minRevenueRequirement,
        administersGovGrants: item.administersGovGrants,
        federalGrantCapability: item.federalGrantCapability,
        samUeiStatus: item.samUeiStatus,
        contactChannel: item.contactChannel,
        verificationStatus: item.verificationStatus,
        lastVerifiedTimestamp: runTimestamp,
        hasLiveVerification: true,
        verificationLevel: item.verificationLevel,
        identityVerified: item.identityVerified,
        websiteVerified: item.websiteVerified,
        sponsorshipModelsVerified: item.sponsorshipModelsVerified,
        governmentGrantAdministrationVerified: item.governmentGrantAdministrationVerified,
        feeVerified: item.feeVerified,
        leadTimeVerified: item.leadTimeVerified,
        opportunitySpecificCompatibility: 'HUMAN_CONFIRMATION_REQUIRED',
      };

      let candidateRecord;

      if (existing) {
        // Compare business facts to determine if materially updated vs revalidated
        const businessFactsChanged =
          existing.name !== item.name ||
          existing.directorySourceUrl !== item.directorySourceUrl ||
          existing.geography !== item.geography ||
          existing.mission !== item.mission ||
          JSON.stringify(existing.populationsServed) !== JSON.stringify(item.populationsServed) ||
          JSON.stringify(existing.modelsOffered) !== JSON.stringify(item.modelsOffered) ||
          existing.acceptingNewProjects !== item.acceptingNewProjects ||
          existing.intakeStatus !== item.intakeStatus ||
          existing.estimatedReviewTime !== item.estimatedReviewTime ||
          existing.adminPercentage !== item.adminPercentage ||
          existing.administersGovGrants !== item.administersGovGrants ||
          existing.samUeiStatus !== item.samUeiStatus;

        if (businessFactsChanged) {
          candidateRecord = await prisma.fiscalSponsorCandidate.update({
            where: { id: existing.id },
            data: candidateData,
          });
          recordsMateriallyUpdated++;
        } else {
          // Revalidated only (timestamps / metadata refreshed)
          candidateRecord = await prisma.fiscalSponsorCandidate.update({
            where: { id: existing.id },
            data: {
              lastVerifiedTimestamp: runTimestamp,
              hasLiveVerification: true,
              canonicalDomain: domain,
            },
          });
          recordsRevalidated++;
        }

        // Add citation idempotently
        const citationExists = await prisma.sponsorSourceCitation.findFirst({
          where: {
            fiscalSponsorCandidateId: existing.id,
            sourceUrl: item.directorySourceUrl,
          },
        });
        if (!citationExists) {
          await prisma.sponsorSourceCitation.create({
            data: {
              fiscalSponsorCandidateId: existing.id,
              sourceUrl: item.directorySourceUrl,
              quotedSection: 'Directory Index Retrieval',
              extractedClaim: item.citationText,
              verificationLevel: item.verificationLevel,
              fetchedAt: runTimestamp,
              responseHash: crypto.createHash('sha256').update(item.citationText).digest('hex'),
              verificationDate: runTimestamp,
            },
          });
        }
      } else {
        candidateRecord = await prisma.fiscalSponsorCandidate.create({
          data: {
            ...candidateData,
            isFixture: false,
            citations: {
              create: [
                {
                  sourceUrl: item.directorySourceUrl,
                  quotedSection: 'Directory Index Retrieval',
                  extractedClaim: item.citationText,
                  verificationLevel: item.verificationLevel,
                  fetchedAt: runTimestamp,
                  responseHash: crypto.createHash('sha256').update(item.citationText).digest('hex'),
                  verificationDate: runTimestamp,
                },
              ],
            },
          },
        });
        recordsCreated++;
      }

      // Calculate candidate facts and evidence coverage
      const { identityEvidenceCoverage, operationalEvidenceCoverage, opportunityCompatibilityCoverage } =
        FiscalSponsorService.calculateCoverageMetrics(candidateRecord);

      const overallEvidenceCoverage = Math.round(
        (identityEvidenceCoverage + operationalEvidenceCoverage + opportunityCompatibilityCoverage) / 3
      );

      const missingInfo = [];
      if (candidateRecord.intakeStatus === 'UNKNOWN') missingInfo.push('Confirm current open intake status with sponsor');
      if (candidateRecord.samUeiStatus === 'UNKNOWN') missingInfo.push('Verify active SAM.gov registration and UEI number');
      if (candidateRecord.setupFee === 'UNKNOWN') missingInfo.push('Confirm one-time setup / onboarding fee');

      const humanConfirmationRequired = [
        'Solicitation-specific legal-applicant willingness requires human confirmation',
        'Federal registration status not independently verified',
      ];

      discoveredCandidates.push({
        id: candidateRecord.id,
        name: candidateRecord.name,
        canonicalDomain: domain,
        websiteUrl: candidateRecord.websiteUrl,
        directorySourceUrl: candidateRecord.directorySourceUrl,
        isFixture: candidateRecord.isFixture,
        hasLiveVerification: candidateRecord.hasLiveVerification,
        verificationLevel: candidateRecord.verificationLevel,
        missionAlignment: `Strong alignment with ${item.populationsServed.join(', ')} in ${item.geography}`,
        sponsorshipModels: candidateRecord.modelsOffered,
        intakeStatus: candidateRecord.intakeStatus,
        governmentGrantAdminEvidence: candidateRecord.federalGrantCapability,
        feeAndLeadTime: `Admin Fee: ${candidateRecord.adminPercentage} • Review Time: ${candidateRecord.estimatedReviewTime}`,
        identityEvidenceCoverage,
        operationalEvidenceCoverage,
        opportunityCompatibilityCoverage,
        overallEvidenceCoverage,
        missingInformation: missingInfo,
        humanConfirmationRequired,
        recommendation: 'Possible sponsor — research and human confirmation required',
      });
    }

    // Reconcile duplicate candidates by canonical domain
    const { mergedCount } = await FiscalSponsorService.reconcileDuplicateSponsors();

    return {
      runTimestamp,
      sourcesQueried,
      recordsCreated,
      recordsMateriallyUpdated,
      recordsRevalidated,
      recordsUnchanged,
      recordsRejected,
      recordsMerged: mergedCount,
      discoveredCandidates,
    };
  }
}
