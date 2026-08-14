import { describe, it, expect, beforeAll } from 'vitest';
import { OpportunityNarrativeService } from '../services/opportunityNarrativeService';
import { OutreachBriefingService } from '../services/outreachBriefingService';
import { StrategicPartnerService } from '../services/strategicPartnerService';
import { BRIDGE_FORWARD_PROFILE } from '@bridge-ai/shared';
import { prisma } from '../lib/prisma';
import crypto from 'crypto';

describe('Phase 1F — Opportunity-Specific Organization Narrative & Positioning Safeguards', () => {
  let oppCoC: any;
  let orangePartner: any;
  let lahsaPartner: any;
  let sponsorCandidate: any;
  let initialMasterMissionHash: string;

  beforeAll(async () => {
    // 1. Capture hash of canonical master mission
    initialMasterMissionHash = crypto
      .createHash('sha256')
      .update(BRIDGE_FORWARD_PROFILE.missionStatement)
      .digest('hex');

    // 2. Populate partners and fetch opp
    await StrategicPartnerService.runDiscovery();

    oppCoC = await prisma.fundingOpportunity.findFirst({
      where: {
        OR: [
          { fundingOpportunityNumber: 'CPD-2600-DC-0025' },
          { title: { contains: 'Continuum of Care', mode: 'insensitive' } },
        ],
      },
    });

    if (!oppCoC) {
      oppCoC = await prisma.fundingOpportunity.create({
        data: {
          title: 'FY2026 Continuum of Care Competition and Youth Homelessness Demonstration Program',
          fundingOpportunityNumber: 'CPD-2600-DC-0025',
          fundingAgency: 'Department of Housing and Urban Development',
          description: 'CoC Competition grant supporting housing and supportive services for youth.',
          deadline: '2026-08-26',
          awardMin: '100000',
          awardMax: '5000000',
          candidateRoutingStatus: 'PARTNERSHIP_REQUIRED',
          pursuitStage: 'NEW',
          sourceUrl: 'https://www.grants.gov/search-results-detail/350000',
          hasSourceConflict: true,
          currentCycleStatus: 'INVESTIGATE — CONFLICTING OFFICIAL SOURCES',
        },
      });
    }

    orangePartner = await prisma.strategicPartnerCandidate.findFirst({
      where: {
        OR: [{ cocNumber: 'CA-602' }, { name: { contains: 'Orange', mode: 'insensitive' } }],
      },
    });

    lahsaPartner = await prisma.strategicPartnerCandidate.findFirst({
      where: {
        OR: [{ cocNumber: 'CA-600' }, { name: { contains: 'LAHSA', mode: 'insensitive' } }],
      },
    });

    sponsorCandidate = await prisma.fiscalSponsorCandidate.findFirst();
    if (!sponsorCandidate) {
      sponsorCandidate = await prisma.fiscalSponsorCandidate.create({
        data: {
          name: 'Community Partners (Southern California)',
          websiteUrl: 'https://communitypartners.org',
          directorySourceUrl: 'https://communitypartners.org',
          geography: 'Southern California',
          mission: 'Fiscal sponsorship for Southern California community projects',
          modelsOffered: ['MODEL_A'],
          setupFee: '$0',
          adminPercentage: '10%',
          estimatedReviewTime: '2-3 weeks',
          verificationStatus: 'VERIFIED_HUMAN_REVIEWED',
        },
      });
    }
  });

  it('1. CPD-2600-DC-0025 deterministically selects youth justice, housing stability, and supportive services lenses', () => {
    const result = OpportunityNarrativeService.buildOpportunitySpecificNarrative({
      opportunity: oppCoC,
      organizationProfile: BRIDGE_FORWARD_PROFILE,
      selectedPartner: orangePartner,
    });

    expect(result.selectedNarrativeLenses).toEqual([
      'YOUTH_JUSTICE_REENTRY',
      'HOUSING_STABILITY',
      'SUPPORTIVE_SERVICES',
    ]);
  });

  it('2. Positioning narrative mentions young people transitioning from juvenile justice involvement', () => {
    const result = OpportunityNarrativeService.buildOpportunitySpecificNarrative({
      opportunity: oppCoC,
      organizationProfile: BRIDGE_FORWARD_PROFILE,
      selectedPartner: orangePartner,
    });

    expect(result.opportunitySpecificOrganizationNarrative).toContain(
      'young people transitioning from juvenile justice involvement'
    );
    expect(result.opportunitySpecificOrganizationNarrative).toContain(
      'justice-involved and system-impacted youth and young adults'
    );
  });

  it('3. Narrative does NOT lead with adult reentry or technology education for CoC opportunity', () => {
    const result = OpportunityNarrativeService.buildOpportunitySpecificNarrative({
      opportunity: oppCoC,
      organizationProfile: BRIDGE_FORWARD_PROFILE,
      selectedPartner: orangePartner,
    });

    expect(result.selectedNarrativeLenses).not.toContain('ADULT_REENTRY');
    expect(result.selectedNarrativeLenses).not.toContain('TECHNOLOGY_EDUCATION');
    expect(result.opportunitySpecificOrganizationNarrative).not.toContain('Industrial automation');
    expect(result.opportunitySpecificOrganizationNarrative).not.toContain('Controls to Code');
  });

  it('4. Master mission statement and canonical profile hash remain immutable', () => {
    // Generate narrative
    OpportunityNarrativeService.buildOpportunitySpecificNarrative({
      opportunity: oppCoC,
      organizationProfile: BRIDGE_FORWARD_PROFILE,
      selectedPartner: orangePartner,
    });

    const currentHash = crypto
      .createHash('sha256')
      .update(BRIDGE_FORWARD_PROFILE.missionStatement)
      .digest('hex');

    expect(currentHash).toBe(initialMasterMissionHash);
    expect(BRIDGE_FORWARD_PROFILE.status).toBe('PRE_INCORPORATION');
  });

  it('5. PRE_INCORPORATION produces "emerging Southern California nonprofit initiative", not "incorporated nonprofit"', () => {
    const result = OpportunityNarrativeService.buildOpportunitySpecificNarrative({
      opportunity: oppCoC,
      organizationProfile: BRIDGE_FORWARD_PROFILE,
      selectedPartner: orangePartner,
    });

    expect(result.opportunitySpecificOrganizationNarrative).toContain(
      'an emerging Southern California nonprofit initiative'
    );
    expect(result.opportunitySpecificOrganizationNarrative).not.toContain('incorporated nonprofit');
    expect(result.opportunitySpecificOrganizationNarrative).not.toContain('501(c)(3) registered applicant');
  });

  it('6. Orange County CA-602 produces Orange County-specific geographic context', () => {
    const result = OpportunityNarrativeService.buildOpportunitySpecificNarrative({
      opportunity: oppCoC,
      organizationProfile: BRIDGE_FORWARD_PROFILE,
      selectedPartner: orangePartner,
    });

    expect(result.geographicContextNarrative).toContain(
      'specifically concerns potential participation in Orange County’s CA-602 Continuum of Care process'
    );
    expect(result.geographicContextNarrative).toContain(
      'Although our planned service footprint includes Orange, Los Angeles, San Bernardino, and San Diego counties'
    );
  });

  it('7. LAHSA CA-600 produces Los Angeles County-specific geographic context', () => {
    const result = OpportunityNarrativeService.buildOpportunitySpecificNarrative({
      opportunity: oppCoC,
      organizationProfile: BRIDGE_FORWARD_PROFILE,
      selectedPartner: lahsaPartner,
    });

    expect(result.geographicContextNarrative).toContain(
      'specifically concerns potential participation in Los Angeles County’s CA-600 Continuum of Care process'
    );
  });

  it('8. Conflicting current-cycle sources produce information-seeking wording', async () => {
    const briefing = await OutreachBriefingService.generatePartnerBriefingPacket(
      orangePartner.id,
      oppCoC.id,
      'GRANT_COMPETITION'
    );

    const body = briefing.draftInquiryEmail.bodyText;
    expect(body).toContain('We are evaluating this opportunity and seeking guidance regarding its current status');
    expect(body).not.toContain('We are applying');
    expect(body).not.toContain('We are actively preparing an application');
    expect(body).not.toContain('We are eligible');
    expect(body).not.toContain('We will submit');
  });

  it('9. Zero fabricated programs, outcomes, partnerships, or operating history appear', () => {
    const result = OpportunityNarrativeService.buildOpportunitySpecificNarrative({
      opportunity: oppCoC,
      organizationProfile: BRIDGE_FORWARD_PROFILE,
      selectedPartner: orangePartner,
    });

    expect(result.narrativeEvidenceFacts).toContain(
      'All operational and planned programs are developing or pre-release support models; zero prior cohort outcomes fabricated'
    );
    expect(result.opportunitySpecificOrganizationNarrative).toContain('We are developing a youth-centered service model');
  });

  it('10. Repeated briefing generation is deterministic and idempotent', () => {
    const run1 = OpportunityNarrativeService.buildOpportunitySpecificNarrative({
      opportunity: oppCoC,
      organizationProfile: BRIDGE_FORWARD_PROFILE,
      selectedPartner: orangePartner,
    });

    const run2 = OpportunityNarrativeService.buildOpportunitySpecificNarrative({
      opportunity: oppCoC,
      organizationProfile: BRIDGE_FORWARD_PROFILE,
      selectedPartner: orangePartner,
    });

    expect(run1).toEqual(run2);
  });

  it('11. Fiscal-sponsor and strategic-partner briefings both use narrative safeguards', async () => {
    const partnerBriefing = await OutreachBriefingService.generatePartnerBriefingPacket(
      orangePartner.id,
      oppCoC.id,
      'GRANT_COMPETITION'
    );

    expect(partnerBriefing.selectedNarrativeLenses).toBeDefined();
    expect(partnerBriefing.opportunitySpecificOrganizationNarrative).toBeDefined();
    expect(partnerBriefing.geographicContextNarrative).toBeDefined();
    expect(partnerBriefing.narrativeEvidenceFacts).toBeDefined();
    expect(partnerBriefing.narrativeSafeguardsApplied).toBeDefined();

    // Test sponsor briefing (using general inquiry or Non-CoC opp)
    const sponsorBriefing = await OutreachBriefingService.generateSponsorBriefingPacket(
      sponsorCandidate.id
    );

    expect(sponsorBriefing.selectedNarrativeLenses).toBeDefined();
    expect(sponsorBriefing.opportunitySpecificOrganizationNarrative).toBeDefined();
    expect(sponsorBriefing.geographicContextNarrative).toBeDefined();
    expect(sponsorBriefing.narrativeEvidenceFacts).toBeDefined();
    expect(sponsorBriefing.narrativeSafeguardsApplied).toBeDefined();
  });
});
