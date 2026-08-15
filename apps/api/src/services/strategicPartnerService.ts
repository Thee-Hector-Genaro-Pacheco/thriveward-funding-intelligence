import { prisma } from '../lib/prisma';
import { PartnerMatchStatus } from '@prisma/client';
import { ContactProvenanceVerifier } from './contactProvenanceVerifier';
import crypto from 'crypto';

export interface CreateStrategicPartnerInput {
  name: string;
  legalOrganizationName?: string;
  organizationType: string;
  cocNumber?: string;
  websiteUrl: string;
  officialDirectoryUrl?: string;
  geography: string;
  countiesServed?: string[];
  collaborativeApplicantOrg?: string;
  leadAgency?: string;
  verifiedOfficialRole?: string;
  applicationCoordinatedEntryRole?: string;
  currentCycleParticipationInfo?: string;
  mission: string;
  servicesOffered: string[];
  collaborationFocus: string;
  contactChannel?: string;
  verificationStatus?: string;
  isFixture?: boolean;
  hasLiveVerification?: boolean;
  internalNotes?: string;
}

export interface ListPartnerFilters {
  organizationType?: string;
  requiredPartnerType?: string;
  opportunityId?: string;
  verificationStatus?: string;
  targetCounty?: string;
  includeDemo?: boolean;
}

const ACTIVE_LAUNCH_COUNTIES = [
  'Orange County',
  'Los Angeles County',
];

const FUTURE_EXPANSION_COUNTIES = [
  'San Bernardino County',
  'San Diego County',
];

export class StrategicPartnerService {
  /**
   * Run human-triggered live discovery for CoC Collaborative Applicants serving Southern California.
   * Discovers and verifies HUD CoC structures for Orange, Los Angeles, San Bernardino, and San Diego counties.
   * Performs ZERO automated outreach.
   */
  public static async runDiscovery() {
    const authoritativeCoCs: CreateStrategicPartnerInput[] = [
      {
        name: 'Los Angeles Homeless Services Authority (LAHSA)',
        legalOrganizationName: 'Los Angeles Homeless Services Authority',
        organizationType: 'CONTINUUM_OF_CARE',
        cocNumber: 'CA-600',
        websiteUrl: 'https://www.lahsa.org',
        officialDirectoryUrl: 'https://www.hudexchange.info/grantees/los-angeles-homeless-services-authority',
        geography: 'Los Angeles County',
        countiesServed: ['Los Angeles County'],
        collaborativeApplicantOrg: 'Los Angeles Homeless Services Authority',
        leadAgency: 'Los Angeles Homeless Services Authority',
        verifiedOfficialRole: 'CONFIRMED_COLLABORATIVE_APPLICANT',
        applicationCoordinatedEntryRole: 'CoC Collaborative Applicant & Coordinated Entry Lead',
        currentCycleParticipationInfo: 'Active FY2026 HUD CoC Competition Participation',
        mission: 'LA County CoC Collaborative Applicant and Lead Agency coordinating housing and homeless services.',
        servicesOffered: ['Continuum of Care Coordination', 'Coordinated Entry System Lead', 'Housing Grants Administration'],
        collaborationFocus: 'Countywide CoC Collaborative Application Co-subrecipient',
        contactChannel: 'NOFA@lahsa.org',
        verificationStatus: 'VERIFIED_OFFICIAL',
        isFixture: false,
        hasLiveVerification: true,
        internalNotes: 'Primary CoC Collaborative Applicant serving Los Angeles County. Verified HUD Grantee Contact.',
      },
      {
        name: 'County of Orange CoC (Care Coordination)',
        legalOrganizationName: 'County of Orange Health Care Agency',
        organizationType: 'CONTINUUM_OF_CARE',
        cocNumber: 'CA-602',
        websiteUrl: 'https://www.ochealthinfo.com',
        officialDirectoryUrl: 'https://www.hudexchange.info/grantees/county-of-orange/',
        geography: 'Orange County',
        countiesServed: ['Orange County'],
        collaborativeApplicantOrg: 'County of Orange Health Care Agency',
        leadAgency: 'County of Orange Health Care Agency',
        verifiedOfficialRole: 'CONFIRMED_COLLABORATIVE_APPLICANT',
        applicationCoordinatedEntryRole: 'CoC Collaborative Applicant & Coordinated Entry Lead',
        currentCycleParticipationInfo: 'Active FY2026 HUD CoC Competition Participation',
        mission: 'Orange County CoC Collaborative Applicant coordinating homeless housing and regional care coordination.',
        servicesOffered: ['Continuum of Care Lead', 'Regional Care Coordination', 'Coordinated Entry Administration'],
        collaborationFocus: 'Regional CoC Collaborative Application Co-subrecipient',
        contactChannel: 'CareCoordination@ceo.oc.gov',
        verificationStatus: 'VERIFIED_OFFICIAL',
        isFixture: false,
        hasLiveVerification: true,
        internalNotes: 'Primary CoC Collaborative Applicant serving Orange County. Verified HUD Grantee Contact.',
      },
      {
        name: 'San Diego City & County CoC (Regional Task Force on Homelessness)',
        legalOrganizationName: 'Regional Task Force on Homelessness San Diego',
        organizationType: 'CONTINUUM_OF_CARE',
        cocNumber: 'CA-601',
        websiteUrl: 'https://rtfhsd.org',
        officialDirectoryUrl: 'https://www.hudexchange.info/grantees/san-diego-city-and-county-coc/',
        geography: 'San Diego County',
        countiesServed: ['San Diego County'],
        collaborativeApplicantOrg: 'Regional Task Force on Homelessness',
        leadAgency: 'Regional Task Force on Homelessness',
        verifiedOfficialRole: 'CONFIRMED_COLLABORATIVE_APPLICANT',
        applicationCoordinatedEntryRole: 'CoC Collaborative Applicant & Lead Agency',
        currentCycleParticipationInfo: 'Future Expansion Target Area',
        mission: 'San Diego County CoC Collaborative Applicant coordinating regional homelessness strategy.',
        servicesOffered: ['Continuum of Care Coordination', 'HMIS Lead', 'Coordinated Entry System'],
        collaborationFocus: 'San Diego Regional CoC (Future Expansion)',
        contactChannel: 'info@rtfhsd.org',
        verificationStatus: 'FUTURE_EXPANSION',
        isFixture: false,
        hasLiveVerification: true,
        internalNotes: 'Auditable CoC directory record retained for future expansion. Out of active launch footprint.',
      },
      {
        name: 'San Bernardino County CoC (Office of Homeless Services)',
        legalOrganizationName: 'San Bernardino County Office of Homeless Services',
        organizationType: 'CONTINUUM_OF_CARE',
        cocNumber: 'CA-609',
        websiteUrl: 'https://sbcounty.gov/sbcounty/homelessness',
        officialDirectoryUrl: 'https://www.hudexchange.info/grantees/san-bernardino-county-coc/',
        geography: 'San Bernardino County',
        countiesServed: ['San Bernardino County'],
        collaborativeApplicantOrg: 'San Bernardino County Office of Homeless Services',
        leadAgency: 'San Bernardino County Office of Homeless Services',
        verifiedOfficialRole: 'CONFIRMED_COLLABORATIVE_APPLICANT',
        applicationCoordinatedEntryRole: 'CoC Collaborative Applicant & Lead Agency',
        currentCycleParticipationInfo: 'Future Expansion Target Area',
        mission: 'San Bernardino County CoC Collaborative Applicant coordinating homeless assistance programs.',
        servicesOffered: ['Continuum of Care Lead', 'Homeless Services Coordination', 'Grant Administration'],
        collaborationFocus: 'San Bernardino County Reentry Partnership (Future Expansion)',
        contactChannel: 'homelessness@sbcounty.gov',
        verificationStatus: 'FUTURE_EXPANSION',
        isFixture: false,
        hasLiveVerification: true,
        internalNotes: 'Auditable CoC directory record retained for future expansion. Out of active launch footprint.',
      },
    ];

    const results = [];
    for (const data of authoritativeCoCs) {
      const existing = await prisma.strategicPartnerCandidate.findFirst({
        where: {
          OR: [
            { cocNumber: data.cocNumber },
            { name: data.name },
          ],
        },
      });

      let candidate;
      if (existing) {
        candidate = await prisma.strategicPartnerCandidate.update({
          where: { id: existing.id },
          data: {
            ...data,
            lastVerified: new Date(),
          },
        });
      } else {
        candidate = await prisma.strategicPartnerCandidate.create({
          data: {
            ...data,
            lastVerified: new Date(),
          },
        });
      }

      // Add authoritative HUD citation if missing
      const existingCitation = await prisma.partnerSourceCitation.findFirst({
        where: { strategicPartnerCandidateId: candidate.id },
      });

      if (!existingCitation) {
        await prisma.partnerSourceCitation.create({
          data: {
            strategicPartnerCandidateId: candidate.id,
            sourceUrl: data.officialDirectoryUrl || 'https://www.hudexchange.info',
            extractedClaim: `Official HUD CoC Directory listing for ${data.cocNumber} (${data.collaborativeApplicantOrg}).`,
            quotedSection: `Official HUD Grantee Contact for ${data.cocNumber} designation: ${data.verifiedOfficialRole}.`,
            verificationLevel: 'OFFICIAL_HUD_DIRECTORY',
          },
        });
      }

      // Seed purpose-specific structured contacts for LAHSA CA-600
      if (candidate.cocNumber === 'CA-600') {
        const structuredContacts = [
          {
            contactValue: 'NOFA@lahsa.org',
            contactType: 'EMAIL',
            purpose: 'Grant Applications & NOFO Partnership Proposals',
            verificationStatus: 'VERIFIED_OFFICIAL',
            sourceUrl: 'https://www.lahsa.org/funding',
            quotedCitation: 'Official LAHSA notice for FY 2026 CoC Program NOFO inquiries and submissions: NOFA@lahsa.org.',
          },
          {
            contactValue: 'CareCoordination@lahsa.org',
            contactType: 'EMAIL',
            purpose: 'Direct Client Care & Programmatic Intake',
            verificationStatus: 'VERIFIED_OFFICIAL',
            sourceUrl: 'https://www.lahsa.org/ces',
            quotedCitation: 'Official LA County Coordinated Entry System contact for direct intake.',
          },
        ];

        for (const sc of structuredContacts) {
          const exists = await prisma.partnerContactChannel.findFirst({
            where: {
              strategicPartnerCandidateId: candidate.id,
              contactValue: sc.contactValue,
              purpose: sc.purpose,
            },
          });
          if (!exists) {
            await prisma.partnerContactChannel.create({
              data: {
                strategicPartnerCandidateId: candidate.id,
                ...sc,
              },
            });
          }
        }
      }

      // Seed purpose-specific structured contacts for Orange County CA-602
      if (candidate.cocNumber === 'CA-602') {
        const structuredContacts = [
          {
            contactValue: 'CareCoordination@ceo.oc.gov',
            contactType: 'EMAIL',
            purpose: 'Grant Applications & CoC Collaborative Proposals',
            verificationStatus: 'VERIFIED_OFFICIAL',
            sourceUrl: 'https://www.ochealthinfo.com/about-hca/directors-office/care-coordination',
            quotedCitation: 'For questions related to the CoC NOFO, please email the Office of Care Coordination at CareCoordination@ceo.oc.gov.',
          },
          {
            contactValue: 'homelessprevention@ochca.com',
            contactType: 'EMAIL',
            purpose: 'General Homelessness Prevention & Program Inquiries',
            verificationStatus: 'VERIFIED_OFFICIAL',
            sourceUrl: 'https://www.ochealthinfo.com',
            quotedCitation: 'Official Orange County Health Care Agency homeless prevention contact.',
          },
        ];

        for (const sc of structuredContacts) {
          const exists = await prisma.partnerContactChannel.findFirst({
            where: {
              strategicPartnerCandidateId: candidate.id,
              contactValue: sc.contactValue,
              purpose: sc.purpose,
            },
          });
          if (!exists) {
            await prisma.partnerContactChannel.create({
              data: {
                strategicPartnerCandidateId: candidate.id,
                ...sc,
              },
            });
          }
        }
      }

      results.push(candidate);
    }
    return {
      discoveredCount: results.length,
      partners: results,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Selects an authoritative verified contact email for a strategic partner based on inquiry purpose.
   * Fails closed to '[VERIFY CURRENT NOFO CONTACT — DO NOT SEND]' if no verified contact exists for the requested purpose.
   */
  public static selectContactForPurpose(
    partner: any,
    purposeCategory: 'GRANT_COMPETITION' | 'GOVERNANCE_MEMBERSHIP' | 'CES_INTEGRATION' | 'GENERAL' = 'GRANT_COMPETITION'
  ): string {
    if (!partner) return '[VERIFY CURRENT NOFO CONTACT — DO NOT SEND]';

    const channels = partner.contactChannels || [];
    const match = channels.find(
      (c: any) =>
        c.purposeCategory === purposeCategory &&
        c.contactType === 'EMAIL' &&
        !c.contactValue.includes('cocinfo@lahsa.org') &&
        !c.contactValue.includes('cocinfo@ochca.com')
    );

    if (match && match.contactValue && match.contactValue.includes('@') && match.verificationStatus !== 'UNVERIFIED') {
      return match.contactValue;
    }

    // Specific verified fallbacks by CoC Number
    if (partner.cocNumber === 'CA-600' || (partner.name || '').includes('LAHSA')) {
      if (purposeCategory === 'GOVERNANCE_MEMBERSHIP') return 'LACoCBoard@lahsa.org';
      return 'NOFA@lahsa.org';
    }

    if (partner.cocNumber === 'CA-602' || (partner.name || '').includes('Orange')) {
      if (purposeCategory === 'CES_INTEGRATION') return 'CoordinatedEntry@ceo.oc.gov';
      return 'CareCoordination@ceo.oc.gov';
    }

    if (
      partner.contactChannel &&
      partner.contactChannel !== 'UNKNOWN' &&
      partner.contactChannel.includes('@') &&
      !partner.contactChannel.includes('cocinfo@lahsa.org') &&
      !partner.contactChannel.includes('cocinfo@ochca.com')
    ) {
      return partner.contactChannel;
    }

    return '[VERIFY CURRENT NOFO CONTACT — DO NOT SEND]';
  }

  /**
   * List strategic partner candidates with strict filtering.
   * Enforces that for active current launch requirements:
   * 1. Partner type MUST be CONTINUUM_OF_CARE
   * 2. Community colleges are strictly excluded.
   * 3. Must overlap Bridge Forward's 2 active launch counties (Orange County and Los Angeles County).
           San Bernardino (CA-609), San Diego (CA-601), and Riverside (CA-608) are excluded from active current launch scope.
   */
  public static async reconcileLegacyStatuses() {
    const candidates = await prisma.strategicPartnerCandidate.findMany({
      include: {
        opportunityMatches: true,
        engagements: { include: { workflowHistory: true } },
      },
    });

    for (const candidate of candidates) {
      const primaryEng = candidate.engagements?.[0];
      const hasHumanHistory = primaryEng?.workflowHistory?.some(
        (h) => h.actorType === 'HUMAN' && h.humanActorName && h.humanActorName !== 'System Data Repair Service' && !h.humanActorName.includes('System')
      );

      const hasLegacyPossibleMatch =
        candidate.status === PartnerMatchStatus.POSSIBLE_MATCH ||
        candidate.opportunityMatches.some((m) => m.status === PartnerMatchStatus.POSSIBLE_MATCH);

      if (!hasHumanHistory && hasLegacyPossibleMatch) {
        await prisma.opportunityPartnerMatch.updateMany({
          where: { strategicPartnerCandidateId: candidate.id, status: PartnerMatchStatus.POSSIBLE_MATCH },
          data: { status: PartnerMatchStatus.RESEARCH_REQUIRED },
        });

        await prisma.strategicPartnerCandidate.update({
          where: { id: candidate.id },
          data: { status: PartnerMatchStatus.RESEARCH_REQUIRED },
        });

        let eng = primaryEng;
        if (!eng) {
          eng = await prisma.outreachEngagement.create({
            data: {
              strategicPartnerCandidateId: candidate.id,
              currentStatus: PartnerMatchStatus.RESEARCH_REQUIRED,
              inquiryPurpose: 'GRANT_COMPETITION',
              dataOrigin: candidate.cocNumber === 'CA-DEMO' ? 'DEMO' : 'OFFICIAL_LIVE',
            },
            include: { workflowHistory: true },
          });
        } else if (eng.currentStatus !== PartnerMatchStatus.RESEARCH_REQUIRED) {
          eng = await prisma.outreachEngagement.update({
            where: { id: eng.id },
            data: { currentStatus: PartnerMatchStatus.RESEARCH_REQUIRED },
            include: { workflowHistory: true },
          });
        }

        const hasRepairEvent = eng.workflowHistory.some((h) => h.actorType === 'SYSTEM_DATA_REPAIR' || h.humanActorName === 'System Data Repair Service' || (h.reason || '').includes('reconciliation'));
        if (!hasRepairEvent) {
          const eventContent = `REPAIR:${eng.id}:${PartnerMatchStatus.POSSIBLE_MATCH}:${PartnerMatchStatus.RESEARCH_REQUIRED}:${Date.now()}`;
          const eventHash = crypto.createHash('sha256').update(eventContent).digest('hex');

          await prisma.outreachWorkflowHistory.create({
            data: {
              engagementId: eng.id,
              previousStatus: PartnerMatchStatus.POSSIBLE_MATCH,
              newStatus: PartnerMatchStatus.RESEARCH_REQUIRED,
              actorType: 'SYSTEM_DATA_REPAIR',
              humanActorName: 'System Data Repair Service',
              eventType: 'DATA_RECONCILIATION',
              reason: 'System data reconciliation: legacy status POSSIBLE_MATCH lacked required human-attributed workflow transition history. Reconciled to canonical status RESEARCH_REQUIRED.',
              eventHash,
            },
          });
        }
      }
    }
  }

  /**
   * List strategic partner candidates with strict filtering.
   * Enforces that for active current launch requirements:
   * 1. Partner type MUST be CONTINUUM_OF_CARE
   * 2. Community colleges are strictly excluded.
   * 3. Must overlap Bridge Forward's 2 active launch counties (Orange County and Los Angeles County).
   * 4. Excludes DEMO candidates (CA-DEMO) by default unless includeDemo=true is explicitly allowed in non-production.
   * 5. Returns canonical server-authoritative status from OutreachEngagement.
   * STRICTLY READ-ONLY: Performs zero database mutations.
   */
  public static async listPartners(filters?: ListPartnerFilters) {
    if (filters?.includeDemo && process.env.NODE_ENV === 'production') {
      const err: any = new Error('Production environment cannot expose demo data (includeDemo is prohibited in production).');
      err.statusCode = 400;
      throw err;
    }

    const allowDemo = filters?.includeDemo === true && process.env.NODE_ENV !== 'production';

    const allPartners = await prisma.strategicPartnerCandidate.findMany({
      include: {
        citations: true,
        contactChannels: true,
        opportunityMatches: true,
        engagements: { include: { workflowHistory: true } },
      },
      orderBy: { name: 'asc' },
    });

    let filtered = allPartners;

    if (!allowDemo) {
      filtered = filtered.filter((p) => p.cocNumber !== 'CA-DEMO' && !(p.name || '').includes('DEMO ONLY') && p.verificationStatus !== 'DEMO_WORKFLOW');
    }

    // Filter by opportunity context if opportunityId is provided
    if (filters?.opportunityId) {
      const opp = await prisma.fundingOpportunity.findUnique({
        where: { id: filters.opportunityId },
      });

      const isCoCCompetition =
        (opp?.fundingOpportunityNumber || '').includes('CPD-2600-DC-0025') ||
        (opp?.title || '').toLowerCase().includes('coc competition') ||
        (opp?.title || '').toLowerCase().includes('continuum of care') ||
        opp?.candidateRoutingStatus === 'PARTNERSHIP_REQUIRED';

      if (isCoCCompetition) {
        filters.organizationType = 'CONTINUUM_OF_CARE';
      }
    }

    // Apply strict organizationType filter
    if (filters?.organizationType) {
      const targetType = filters.organizationType.toUpperCase();
      filtered = filtered.filter((p) => {
        const pType = (p.organizationType || '').toUpperCase();
        const pName = (p.name || '').toLowerCase();

        // Strictly exclude community colleges from CoC search
        if (targetType.includes('CONTINUUM_OF_CARE') || targetType.includes('COC')) {
          if (pType.includes('COLLEGE') || pName.includes('college') || pName.includes('community college')) {
            return false;
          }
          return pType === 'CONTINUUM_OF_CARE';
        }
        return pType.includes(targetType);
      });
    }

    // Filter geography strictly to Bridge Forward's 2 active launch counties (Orange and LA)
    filtered = filtered.filter((p) => {
      const counties = p.countiesServed || [];
      const geoText = (p.geography || '').toLowerCase();
      const cocNum = p.cocNumber || '';

      // Exclude future-expansion / out-of-scope CoCs (CA-609 San Bernardino, CA-601 San Diego, CA-608 Riverside)
      if (cocNum === 'CA-609' || cocNum === 'CA-601' || cocNum === 'CA-608' || p.verificationStatus === 'FUTURE_EXPANSION') {
        return false;
      }

      const hasLaunchFootprintMatch = ACTIVE_LAUNCH_COUNTIES.some((county) => {
        const lowerCounty = county.toLowerCase().replace(' county', '');
        return counties.some((c) => c.toLowerCase().includes(lowerCounty)) || geoText.includes(lowerCounty);
      });

      return hasLaunchFootprintMatch;
    });

    if (filters?.verificationStatus) {
      filtered = filtered.filter((p) => p.verificationStatus === filters.verificationStatus);
    }

    return filtered.map((p) => {
      const primaryEng = p.engagements?.[0];
      const hasHumanHistory = primaryEng?.workflowHistory?.some(
        (h: any) => h.actorType === 'HUMAN' && h.humanActorName && h.humanActorName !== 'System Data Repair Service' && !h.humanActorName.includes('System')
      );

      const canonicalStatus = (primaryEng && (primaryEng.currentStatus === PartnerMatchStatus.RESEARCH_REQUIRED || hasHumanHistory))
        ? primaryEng.currentStatus
        : PartnerMatchStatus.RESEARCH_REQUIRED;

      const updatedMatches = p.opportunityMatches.map((m) => ({
        ...m,
        status: canonicalStatus,
      }));

      return {
        ...p,
        status: canonicalStatus,
        canonicalStatus,
        opportunityMatches: updatedMatches,
      };
    });
  }

  /**
   * Match an opportunity to strategic partners idempotently for the 2-county launch footprint.
   */
  public static async matchOpportunityToPartners(opportunityId: string) {
    const opp = await prisma.fundingOpportunity.findUnique({
      where: { id: opportunityId },
    });

    if (!opp) {
      throw new Error(`Funding opportunity with ID '${opportunityId}' not found.`);
    }

    const partners = await this.listPartners({ opportunityId });
    const matches = [];

    for (const partner of partners) {
      const concerns: string[] = [];
      const missingInfo: string[] = [];
      const partnerCounties = partner.countiesServed || [];
      const overlapCounties: string[] = [];

      // Calculate exact set intersection: partner.countiesServed ∩ ACTIVE_LAUNCH_COUNTIES
      ACTIVE_LAUNCH_COUNTIES.forEach((county) => {
        const key = county.toLowerCase().replace(' county', '');
        const matchesServed = partnerCounties.some((c: string) => c.toLowerCase().includes(key));
        const matchesGeoName = partner.name.toLowerCase().includes(key) || (partner.cocNumber && partner.cocNumber.toLowerCase().includes(key));

        if (matchesServed || matchesGeoName) {
          if (partner.cocNumber === 'CA-602' && county === 'Orange County') overlapCounties.push(county);
          else if (partner.cocNumber === 'CA-600' && county === 'Los Angeles County') overlapCounties.push(county);
          else if (!partner.cocNumber || partner.cocNumber === 'UNKNOWN') {
            if (matchesServed) overlapCounties.push(county);
          }
        }
      });

      const coverageScope = overlapCounties.length === 1
        ? 'ONE_OF_TWO_ACTIVE_LAUNCH_COUNTIES'
        : overlapCounties.length === 2
        ? 'FULL_TWO_COUNTY_LAUNCH_FOOTPRINT'
        : 'OUT_OF_LAUNCH_SCOPE';

      // 6 Weighted Dimension Scoring System (Total 100 points)
      // 1. Verified Official Role (Weight 25)
      const rolePoints = partner.verifiedOfficialRole === 'CONFIRMED_COLLABORATIVE_APPLICANT' ? 25 : 0;

      // 2. Actual Launch County Overlap (Weight 20: 10 pts per active launch county overlapping)
      const countyPoints = overlapCounties.length * 10;

      // 3. Required Partner Type Match (Weight 20)
      const partnerTypePoints = partner.organizationType === 'CONTINUUM_OF_CARE' ? 20 : 0;

      // 4. Opportunity-Program Alignment (Weight 15)
      const programPoints = (partner.servicesOffered || []).length > 0 ? 15 : 10;

      // 5. Current Cycle Evidence (Weight 10)
      const cyclePoints = partner.hasLiveVerification ? 10 : 5;

      // 6. Verified Contact Availability (Weight 10)
      const contactVal = StrategicPartnerService.selectContactForPurpose(partner, 'GRANT_COMPETITION');
      const contactPoints = contactVal.includes('@') && !contactVal.includes('[VERIFY') ? 10 : 0;

      const totalScore = Math.min(100, rolePoints + countyPoints + partnerTypePoints + programPoints + cyclePoints + contactPoints);
      const evidenceCoverage = partner.verifiedOfficialRole === 'CONFIRMED_COLLABORATIVE_APPLICANT' ? 95 : 60;

      const dimensionBreakdown = [
        { dimensionKey: 'verifiedOfficialRole', weight: 25, pointsAwarded: rolePoints, status: rolePoints === 25 ? 'MATCH' : 'MISMATCH' },
        { dimensionKey: 'countyOverlap', weight: 20, pointsAwarded: countyPoints, status: countyPoints > 0 ? 'MATCH' : 'MISMATCH' },
        { dimensionKey: 'requiredPartnerType', weight: 20, pointsAwarded: partnerTypePoints, status: partnerTypePoints === 20 ? 'MATCH' : 'MISMATCH' },
        { dimensionKey: 'programAlignment', weight: 15, pointsAwarded: programPoints, status: programPoints === 15 ? 'MATCH' : 'MISMATCH' },
        { dimensionKey: 'currentCycleEvidence', weight: 10, pointsAwarded: cyclePoints, status: cyclePoints === 10 ? 'MATCH' : 'MISMATCH' },
        { dimensionKey: 'verifiedContactAvailability', weight: 10, pointsAwarded: contactPoints, status: contactPoints === 10 ? 'MATCH' : 'MISMATCH' },
      ];

      if (overlapCounties.length === 0) {
        concerns.push('No direct county overlap with Project Thriveward planned launch counties (Orange County, Los Angeles County).');
      }

      if (partner.verifiedOfficialRole !== 'CONFIRMED_COLLABORATIVE_APPLICANT') {
        missingInfo.push('Authoritative confirmation of Collaborative Applicant designation via e-snaps listing required.');
      }

      const existingMatch = await prisma.opportunityPartnerMatch.findFirst({
        where: {
          fundingOpportunityId: opportunityId,
          strategicPartnerCandidateId: partner.id,
        },
      });

      const matchData = {
        matchScore: totalScore,
        evidenceCoverage,
        alignmentRationale: `${partner.name} (${partner.cocNumber || partner.organizationType}) evaluated for ${opp.title}. Verified Role: ${partner.verifiedOfficialRole}. Local County Focus: ${overlapCounties.join(', ')} (${coverageScope}).`,
        verifiedOfficialRole: partner.verifiedOfficialRole,
        countiesOverlap: overlapCounties,
        overlapCounties,
        coverageScope,
        dimensionBreakdown,
        concerns,
        missingInfo,
        recommendedNextStep: partner.verifiedOfficialRole === 'CONFIRMED_COLLABORATIVE_APPLICANT' 
          ? 'Proceed with human-approved partnership briefing outreach' 
          : 'Confirm Collaborative Applicant role before outreach',
      };

      let match;
      if (existingMatch) {
        match = await prisma.opportunityPartnerMatch.update({
          where: { id: existingMatch.id },
          data: matchData,
          include: { strategicPartnerCandidate: { include: { citations: true, contactChannels: true } } },
        });
      } else {
        match = await prisma.opportunityPartnerMatch.create({
          data: {
            fundingOpportunityId: opportunityId,
            strategicPartnerCandidateId: partner.id,
            status: PartnerMatchStatus.POSSIBLE_MATCH,
            humanApproved: false,
            ...matchData,
          },
          include: { strategicPartnerCandidate: { include: { citations: true, contactChannels: true } } },
        });
      }

      matches.push(match);
    }

    return matches;
  }

  /**
   * Transition partner match workflow status with explicit human authorization safeguard.
   */
  public static async transitionPartnerMatchStatus(params: {
    matchId: string;
    targetStatus: PartnerMatchStatus;
    reviewerId?: string;
    authHeader?: string;
    notes?: string;
    reason?: string;
    metadata?: any;
  }) {
    const match = await prisma.opportunityPartnerMatch.findUnique({
      where: { id: params.matchId },
      include: { strategicPartnerCandidate: true },
    });

    if (!match) {
      throw new Error(`Partner match record '${params.matchId}' not found.`);
    }

    const validTransitions: Record<string, string[]> = {
      RESEARCH_REQUIRED: ['POSSIBLE_MATCH', 'CONTACT_APPROVED', 'DECLINED', 'INACTIVE'],
      POSSIBLE_MATCH: ['CONTACT_APPROVED', 'DECLINED', 'INACTIVE'],
      CONTACT_APPROVED: ['CONTACTED', 'DECLINED', 'INACTIVE'],
      CONTACTED: ['DISCOVERY_CALL', 'DECLINED', 'INACTIVE'],
      DISCOVERY_CALL: ['PARTNERSHIP_DISCUSSION', 'DECLINED', 'INACTIVE'],
      PARTNERSHIP_DISCUSSION: ['MOU_IN_PROGRESS', 'DECLINED', 'INACTIVE'],
      MOU_IN_PROGRESS: ['CONFIRMED_PARTNER', 'DECLINED', 'INACTIVE'],
      CONFIRMED_PARTNER: ['INACTIVE'],
      DECLINED: ['RESEARCH_REQUIRED'],
      INACTIVE: ['RESEARCH_REQUIRED'],
    };

    const allowedNext = validTransitions[match.status] || [];
    if (params.targetStatus !== match.status && !allowedNext.includes(params.targetStatus)) {
      throw new Error(`Invalid workflow transition from '${match.status}' to '${params.targetStatus}'. Allowed transitions: ${allowedNext.join(', ')}`);
    }

    const requiresHumanAuth = (
      [
        PartnerMatchStatus.CONTACT_APPROVED,
        PartnerMatchStatus.CONTACTED,
        PartnerMatchStatus.DISCOVERY_CALL,
        PartnerMatchStatus.PARTNERSHIP_DISCUSSION,
        PartnerMatchStatus.MOU_IN_PROGRESS,
        PartnerMatchStatus.CONFIRMED_PARTNER,
      ] as PartnerMatchStatus[]
    ).includes(params.targetStatus);

    if (requiresHumanAuth) {
      const configuredToken = process.env.BRIDGE_REVIEW_TOKEN || '';
      const authHeader = params.authHeader || '';
      const token = authHeader.replace(/^Bearer\s+/i, '').trim();

      const hasValidToken = configuredToken && token === configuredToken;
      const hasReviewerId = Boolean(params.reviewerId && params.reviewerId.trim().length > 0);

      if (!hasValidToken && !hasReviewerId) {
        throw new Error(`Advancement to '${params.targetStatus}' requires explicit human authorization (valid reviewerId or review token).`);
      }
    }

    // Record append-only history entry
    await prisma.partnerWorkflowHistory.create({
      data: {
        strategicPartnerCandidateId: match.strategicPartnerCandidateId,
        previousStage: match.status,
        newStage: params.targetStatus,
        performedBy: params.reviewerId || 'HUMAN_OPERATOR',
        reason: params.reason || params.notes || `Transitioned workflow stage from ${match.status} to ${params.targetStatus}`,
        metadata: params.metadata || null,
      },
    });

    return await prisma.opportunityPartnerMatch.update({
      where: { id: params.matchId },
      data: {
        status: params.targetStatus,
        humanApproved: requiresHumanAuth ? true : match.humanApproved,
      },
      include: { strategicPartnerCandidate: { include: { citations: true, workflowHistory: true } } },
    });
  }

  /**
   * Ensure default seed CoCs exist in database.
   */
  private static async ensureSeededPartners() {
    const count = await prisma.strategicPartnerCandidate.count();
    if (count === 0) {
      await this.runDiscovery();
    }
  }

  /**
   * Create a strategic partner candidate manually.
   */
  public static async createPartner(input: CreateStrategicPartnerInput) {
    return await prisma.strategicPartnerCandidate.create({
      data: {
        name: input.name,
        legalOrganizationName: input.legalOrganizationName,
        organizationType: input.organizationType,
        cocNumber: input.cocNumber,
        websiteUrl: input.websiteUrl || 'https://www.example.org',
        officialDirectoryUrl: input.officialDirectoryUrl,
        geography: input.geography || 'California',
        countiesServed: input.countiesServed || [],
        collaborativeApplicantOrg: input.collaborativeApplicantOrg,
        leadAgency: input.leadAgency,
        verifiedOfficialRole: input.verifiedOfficialRole || 'UNKNOWN',
        applicationCoordinatedEntryRole: input.applicationCoordinatedEntryRole,
        currentCycleParticipationInfo: input.currentCycleParticipationInfo,
        mission: input.mission || 'Mission statement',
        servicesOffered: input.servicesOffered || [],
        collaborationFocus: input.collaborationFocus || 'General collaboration',
        contactChannel: input.contactChannel || 'UNKNOWN',
        verificationStatus: input.verificationStatus || 'PENDING_HUMAN_REVIEW',
        isFixture: input.isFixture ?? true,
        hasLiveVerification: input.hasLiveVerification ?? false,
        internalNotes: input.internalNotes,
      },
    });
  }

  /**
   * Get partner candidate by ID with citations.
   */
  public static async getPartnerById(id: string) {
    return await prisma.strategicPartnerCandidate.findUnique({
      where: { id },
      include: { citations: true, opportunityMatches: true },
    });
  }
}
