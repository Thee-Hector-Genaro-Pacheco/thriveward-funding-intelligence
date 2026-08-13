import { describe, it, expect, beforeAll } from 'vitest';
import { StrategicPartnerService } from '../services/strategicPartnerService';
import { FiscalSponsorService } from '../services/fiscalSponsorService';
import { OutreachBriefingService } from '../services/outreachBriefingService';
import { OpportunityService } from '../services/opportunityService';
import { AnalysisService } from '../services/analysisService';
import { prisma } from '../lib/prisma';
import { PartnerMatchStatus } from '@prisma/client';

describe('Phase 1F — Strategic Partner Discovery, Actionable Directory, & Eligibility Safeguards', () => {
  let oppCoC: any;
  let oppStreetOutreach: any;

  beforeAll(async () => {
    // 1. Seed/ensure test opportunities exist
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
          description: 'CoC Competition grant supporting housing and supportive services.',
          deadline: '2026-08-26',
          awardMin: '100000',
          awardMax: '5000000',
          candidateRoutingStatus: 'PARTNERSHIP_REQUIRED',
          dismissedReason: 'PARTNERSHIP_REQUIRED: Direct federal application blocked. Requires submission through official Continuum of Care (CoC) Collaborative Applicant via e-snaps.',
          pursuitStage: 'NEW',
          sourceUrl: 'https://www.grants.gov/search-results-detail/350000',
        },
      });
    }

    oppStreetOutreach = await prisma.fundingOpportunity.findFirst({
      where: {
        OR: [
          { fundingOpportunityNumber: 'HHS-2026-ACF-ACYF-YO-0044' },
          { title: { contains: 'Street Outreach', mode: 'insensitive' } },
        ],
      },
    });

    if (!oppStreetOutreach) {
      oppStreetOutreach = await prisma.fundingOpportunity.create({
        data: {
          title: 'Street Outreach Program (HHS-2026-ACF-ACYF-YO-0044)',
          fundingOpportunityNumber: 'HHS-2026-ACF-ACYF-YO-0044',
          fundingAgency: 'Administration for Children and Families',
          description: 'Street outreach and drop-in center services for runaway and homeless youth.',
          deadline: '2026-08-17',
          awardMin: '90000',
          awardMax: '150000',
          candidateRoutingStatus: 'FISCAL_SPONSOR_REQUIRED',
          dismissedReason: 'FISCAL_SPONSOR_REQUIRED: Direct federal application blocked. Pre-incorporation status lacks 501(c)(3), EIN, UEI, SAM.gov registration, and Grants.gov credentials.',
          pursuitStage: 'NEW',
          sourceUrl: 'https://www.grants.gov/search-results-detail/340000',
        },
      });
    }

    // Run discovery to seed CoCs
    await StrategicPartnerService.runDiscovery();
  });

  it('Requirement 1 & 3: Human-triggered discovery seeds Southern California CoCs with HUD citations', async () => {
    const discovery = await StrategicPartnerService.runDiscovery();
    expect(discovery.discoveredCount).toBeGreaterThanOrEqual(4);

    const partners = discovery.partners;
    const cocNumbers = partners.map((p) => p.cocNumber);
    expect(cocNumbers).toContain('CA-600'); // LAHSA
    expect(cocNumbers).toContain('CA-602'); // Orange County
    expect(cocNumbers).toContain('CA-601'); // RTFH San Diego
    expect(cocNumbers).toContain('CA-609'); // San Bernardino
  });

  it('Requirement 2: Partner-type filtering excludes community colleges & out-of-footprint CoCs', async () => {
    // Create a dummy community college candidate to verify filtering
    const college = await prisma.strategicPartnerCandidate.create({
      data: {
        name: 'Orange Coast Community College District',
        organizationType: 'COMMUNITY_COLLEGE',
        websiteUrl: 'https://www.orangecoastcollege.edu',
        geography: 'Orange County, California',
        countiesServed: ['Orange County'],
        mission: 'Community college education.',
        servicesOffered: ['Workforce education'],
        collaborationFocus: 'Youth skilled trades training',
      },
    });

    const filteredForCoC = await StrategicPartnerService.listPartners({
      opportunityId: oppCoC.id,
      organizationType: 'CONTINUUM_OF_CARE',
    });

    const ids = filteredForCoC.map((p) => p.id);
    expect(ids).not.toContain(college.id);

    // Verify all returned candidates are CoCs
    filteredForCoC.forEach((p) => {
      expect(p.organizationType).toBe('CONTINUUM_OF_CARE');
    });

    // Cleanup dummy college
    await prisma.strategicPartnerCandidate.delete({ where: { id: college.id } });
  });

  it('Requirement 4: Idempotent partner matching calculates scores & overlap counties', async () => {
    const matches1 = await StrategicPartnerService.matchOpportunityToPartners(oppCoC.id);
    expect(matches1.length).toBeGreaterThanOrEqual(4);

    matches1.forEach((match) => {
      expect(match.matchScore).toBeGreaterThanOrEqual(50);
      expect(match.evidenceCoverage).toBeGreaterThanOrEqual(75);
      expect(match.alignmentRationale).toContain('evaluated for');
      expect(match.verifiedOfficialRole).toBe('CONFIRMED_COLLABORATIVE_APPLICANT');
    });

    // Run matching a second time and prove 0 duplicate records created
    const matches2 = await StrategicPartnerService.matchOpportunityToPartners(oppCoC.id);
    expect(matches2.length).toEqual(matches1.length);
  });

  it('Requirement 5: Strategic Partner briefing packet population & required phrasing', async () => {
    const partners = await StrategicPartnerService.listPartners({ opportunityId: oppCoC.id });
    const partner = partners[0];

    const briefing = await OutreachBriefingService.generatePartnerBriefingPacket(partner.id, oppCoC.id);

    expect(briefing.partnerName).toEqual(partner.name);
    expect(briefing.opportunityNumber).toEqual('CPD-2600-DC-0025');
    expect(briefing.requiredPathway).toEqual('PARTNERSHIP_REQUIRED');
    expect(briefing.bridgeForwardSummary.serviceCounties).toContain('Orange County');
    expect(briefing.bridgeForwardSummary.serviceCounties).toContain('Los Angeles County');
    expect(briefing.bridgeForwardSummary.serviceCounties).toContain('San Bernardino County');
    expect(briefing.bridgeForwardSummary.serviceCounties).toContain('San Diego County');
    expect(briefing.draftInquiryEmail.bodyText).toContain('appears potentially aligned based on preliminary, human-review-required analysis.');
    expect(briefing.discoveryCallQuestions.length).toBeGreaterThanOrEqual(5);
    expect(briefing.safeguardNotice).toContain('HUMAN-CONTROLLED OUTREACH SAFEGUARD');
  });

  it('Requirement 6: Partner workflow status transition requires human authorization', async () => {
    const matches = await StrategicPartnerService.matchOpportunityToPartners(oppCoC.id);
    const match = matches[0];

    // Attempt advancement without authorization should fail
    await expect(
      StrategicPartnerService.transitionPartnerMatchStatus({
        matchId: match.id,
        targetStatus: PartnerMatchStatus.CONTACT_APPROVED,
      })
    ).rejects.toThrow(/Advancement to 'CONTACT_APPROVED' requires explicit human authorization/);

    // Advancement with reviewerId succeeds
    const updated = await StrategicPartnerService.transitionPartnerMatchStatus({
      matchId: match.id,
      targetStatus: PartnerMatchStatus.CONTACT_APPROVED,
      reviewerId: 'reviewer-human-123',
    });

    expect(updated.status).toBe('CONTACT_APPROVED');
    expect(updated.humanApproved).toBe(true);
  });

  it('Requirement 7: Residual eligibility safeguard prevents ELIGIBLE strings on routed opportunities', async () => {
    const sanitizedCoC = await OpportunityService.getOpportunityById(oppCoC.id);
    expect(sanitizedCoC.directApplicantEligibility).toBe('NOT_CURRENTLY_ELIGIBLE');

    const sanitizedSop = await OpportunityService.getOpportunityById(oppStreetOutreach.id);
    expect(sanitizedSop.directApplicantEligibility).toBe('NOT_CURRENTLY_ELIGIBLE');

    // Test AnalysisService returns NOT_ELIGIBLE decision for blocked opportunity
    const evalResult = await AnalysisService.evaluateOpportunity(oppCoC.id);
    expect(evalResult.eligibilityDecision).toBe('NOT_ELIGIBLE');
    expect(['PARTNER_DISCOVERY', 'FUTURE_OPPORTUNITY']).toContain(evalResult.recommendation);
    expect(evalResult.directApplicantEligibility).toBe('NOT_CURRENTLY_ELIGIBLE');
  });

  it('Requirement 8: Fiscal sponsor matching is idempotent & calculates matches', async () => {
    const matches = await FiscalSponsorService.matchOpportunityToSponsors(oppStreetOutreach.id);
    expect(matches.length).toBeGreaterThanOrEqual(1);

    // Running again creates 0 duplicate records
    const matches2 = await FiscalSponsorService.matchOpportunityToSponsors(oppStreetOutreach.id);
    expect(matches2.length).toEqual(matches.length);
  });
});
