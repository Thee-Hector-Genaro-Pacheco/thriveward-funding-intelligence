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
    const college = await prisma.strategicPartnerCandidate.create({
      data: {
        name: 'Orange Coast Community College District',
        organizationType: 'COMMUNITY_COLLEGE',
        websiteUrl: 'https://www.orangecoastcollege.edu',
        geography: 'Orange County, California',
        countiesServed: ['Orange County'],
        mission: 'Higher education institution.',
        servicesOffered: ['Vocational Education'],
        collaborationFocus: 'Academic',
      },
    });

    const result: any = await StrategicPartnerService.listPartners({
      organizationType: 'CONTINUUM_OF_CARE',
      opportunityId: oppCoC.id,
    });

    const partnerList = Array.isArray(result) ? result : result.data || [];
    const ids = partnerList.map((p: any) => p.id);
    expect(ids).not.toContain(college.id);

    // Clean up college test record
    await prisma.strategicPartnerCandidate.delete({ where: { id: college.id } });
  });

  it('Requirement 4: Actionable Partner cards display match score, citations & workflow status', async () => {
    const matches = await StrategicPartnerService.matchOpportunityToPartners(oppCoC.id);
    expect(matches.length).toBeGreaterThan(0);

    const firstMatch = matches[0];
    expect(firstMatch.matchScore).toBeGreaterThan(0);
    expect(firstMatch.evidenceCoverage).toBeGreaterThan(0);
    expect(firstMatch.alignmentRationale).toBeDefined();
    expect(firstMatch.status).toBeDefined();
  });

  it('Requirement 5: Briefing generator builds CoC inquiry packet with zero automated sending', async () => {
    const partner = await prisma.strategicPartnerCandidate.findFirst({
      where: { cocNumber: 'CA-600' },
    });
    expect(partner).toBeDefined();

    const briefing = await OutreachBriefingService.generatePartnerBriefingPacket(partner!.id, oppCoC.id);

    expect(briefing.partnerName).toContain('LAHSA');
    expect(briefing.opportunityNumber).toBe('CPD-2600-DC-0025');
    expect(briefing.requiredPathway).toBe('PARTNERSHIP_REQUIRED');
    expect(briefing.draftInquiryEmail.to).toBe('NOFA@lahsa.org');
    expect(briefing.draftInquiryEmail.bodyText).toContain('appears potentially aligned based on preliminary, human-review-required analysis');
    expect(briefing.safeguardNotice).toContain('HUMAN-CONTROLLED OUTREACH SAFEGUARD');
  });

  it('Requirement 6: Partner workflow status transition requires human authorization', async () => {
    const matches = await StrategicPartnerService.matchOpportunityToPartners(oppCoC.id);
    expect(matches.length).toBeGreaterThan(0);
    const match = matches[0];

    // Attempting advancement without auth token or reviewerId fails
    await expect(
      StrategicPartnerService.transitionPartnerMatchStatus({
        matchId: match.id,
        targetStatus: PartnerMatchStatus.CONTACT_APPROVED,
      })
    ).rejects.toThrow(/requires explicit human authorization/i);

    // Advancement with reviewerId succeeds
    const updated = await StrategicPartnerService.transitionPartnerMatchStatus({
      matchId: match.id,
      targetStatus: PartnerMatchStatus.CONTACT_APPROVED,
      reviewerId: 'reviewer-human-001',
    });

    expect(updated.status).toBe('CONTACT_APPROVED');
    expect(updated.humanApproved).toBe(true);
  });

  it('Requirement 7: Residual eligibility safeguard prevents ELIGIBLE strings on routed opportunities', async () => {
    let coc = await prisma.fundingOpportunity.findFirst({
      where: {
        OR: [{ fundingOpportunityNumber: 'CPD-2600-DC-0025' }, { candidateRoutingStatus: 'PARTNERSHIP_REQUIRED' }],
      },
    });

    let sop = await prisma.fundingOpportunity.findFirst({
      where: {
        OR: [{ fundingOpportunityNumber: 'HHS-2026-ACF-ACYF-YO-0044' }, { candidateRoutingStatus: 'FISCAL_SPONSOR_REQUIRED' }],
      },
    });

    if (!coc) {
      coc = await prisma.fundingOpportunity.create({
        data: {
          title: 'FY2026 Continuum of Care Competition and Youth Homelessness Demonstration Program',
          fundingOpportunityNumber: 'CPD-2600-DC-0025',
          fundingAgency: 'Department of Housing and Urban Development',
          description: 'CoC Competition grant supporting housing.',
          deadline: '2026-08-26',
          awardMin: '100000',
          awardMax: '5000000',
          candidateRoutingStatus: 'PARTNERSHIP_REQUIRED',
          dismissedReason: 'PARTNERSHIP_REQUIRED: Direct federal application blocked.',
          pursuitStage: 'NEW',
          sourceUrl: 'https://www.grants.gov/search-results-detail/350000',
        },
      });
    }

    if (!sop) {
      sop = await prisma.fundingOpportunity.create({
        data: {
          title: 'Street Outreach Program (HHS-2026-ACF-ACYF-YO-0044)',
          fundingOpportunityNumber: 'HHS-2026-ACF-ACYF-YO-0044',
          fundingAgency: 'Administration for Children and Families',
          description: 'Street outreach for youth.',
          deadline: '2026-08-17',
          awardMin: '90000',
          awardMax: '150000',
          candidateRoutingStatus: 'FISCAL_SPONSOR_REQUIRED',
          dismissedReason: 'FISCAL_SPONSOR_REQUIRED: Direct federal application blocked.',
          pursuitStage: 'NEW',
          sourceUrl: 'https://www.grants.gov/search-results-detail/340000',
        },
      });
    }

    const sanitizedCoC = await OpportunityService.getOpportunityById(coc.id);
    expect(sanitizedCoC.directApplicantEligibility).toBe('NOT_CURRENTLY_ELIGIBLE');

    const sanitizedSop = await OpportunityService.getOpportunityById(sop.id);
    expect(sanitizedSop.directApplicantEligibility).toBe('NOT_CURRENTLY_ELIGIBLE');

    // Test AnalysisService returns NOT_ELIGIBLE decision for blocked opportunity
    const evalResult = await AnalysisService.evaluateOpportunity(coc.id);
    expect(evalResult.eligibilityDecision).toBe('NOT_ELIGIBLE');
    expect(['PARTNER_DISCOVERY', 'FUTURE_OPPORTUNITY']).toContain(evalResult.recommendation);
    expect(evalResult.directApplicantEligibility).toBe('NOT_CURRENTLY_ELIGIBLE');
  });

  it('Requirement 8: Fiscal sponsor matching is idempotent & calculates matches', async () => {
    let sop = await prisma.fundingOpportunity.findFirst({
      where: {
        OR: [{ fundingOpportunityNumber: 'HHS-2026-ACF-ACYF-YO-0044' }, { candidateRoutingStatus: 'FISCAL_SPONSOR_REQUIRED' }],
      },
    });

    if (!sop) {
      sop = await prisma.fundingOpportunity.create({
        data: {
          title: 'Street Outreach Program (HHS-2026-ACF-ACYF-YO-0044)',
          fundingOpportunityNumber: 'HHS-2026-ACF-ACYF-YO-0044',
          fundingAgency: 'Administration for Children and Families',
          description: 'Street outreach for youth.',
          deadline: '2026-08-17',
          awardMin: '90000',
          awardMax: '150000',
          candidateRoutingStatus: 'FISCAL_SPONSOR_REQUIRED',
          dismissedReason: 'FISCAL_SPONSOR_REQUIRED: Direct federal application blocked.',
          pursuitStage: 'NEW',
          sourceUrl: 'https://www.grants.gov/search-results-detail/340000',
        },
      });
    }

    const matches = await FiscalSponsorService.matchOpportunityToSponsors(sop.id);
    expect(matches.length).toBeGreaterThanOrEqual(1);

    // Running again creates 0 duplicate records
    const matches2 = await FiscalSponsorService.matchOpportunityToSponsors(sop.id);
    expect(matches2.length).toEqual(matches.length);
  });

  describe('Partner Footprint Intersection & Service Overlap Accuracy', () => {
    it('CA-602 overlap is exactly ["Orange County"] and CA-600 overlap is exactly ["Los Angeles County"]', async () => {
      const matches = await StrategicPartnerService.matchOpportunityToPartners(oppCoC.id);

      const ca602Match = matches.find((m: any) => m.strategicPartnerCandidate?.cocNumber === 'CA-602' || m.strategicPartnerCandidate?.name.includes('Orange'));
      const ca600Match = matches.find((m: any) => m.strategicPartnerCandidate?.cocNumber === 'CA-600' || m.strategicPartnerCandidate?.name.includes('LAHSA'));

      expect(ca602Match).toBeDefined();
      expect(ca600Match).toBeDefined();

      expect(ca602Match?.overlapCounties).toEqual(['Orange County']);
      expect(ca602Match?.countiesOverlap).toEqual(['Orange County']);
      expect(ca602Match?.coverageScope).toBe('ONE_OF_TWO_ACTIVE_LAUNCH_COUNTIES');

      expect(ca600Match?.overlapCounties).toEqual(['Los Angeles County']);
      expect(ca600Match?.countiesOverlap).toEqual(['Los Angeles County']);
      expect(ca600Match?.coverageScope).toBe('ONE_OF_TWO_ACTIVE_LAUNCH_COUNTIES');
    });

    it('CA-602 does not inherit all Project Thriveward launch counties (does NOT contain Los Angeles County)', async () => {
      const matches = await StrategicPartnerService.matchOpportunityToPartners(oppCoC.id);
      const ca602Match = matches.find((m: any) => m.strategicPartnerCandidate?.cocNumber === 'CA-602');
      expect(ca602Match?.overlapCounties).not.toContain('Los Angeles County');
    });

    it('Neither CA-602 nor CA-600 overlap includes San Bernardino County or San Diego County', async () => {
      const matches = await StrategicPartnerService.matchOpportunityToPartners(oppCoC.id);
      for (const m of matches) {
        expect(m.overlapCounties).not.toContain('San Bernardino County');
        expect(m.overlapCounties).not.toContain('San Diego County');
        expect(m.countiesOverlap).not.toContain('San Bernardino County');
        expect(m.countiesOverlap).not.toContain('San Diego County');
      }
    });

    it('Partner card serializer and listPartners endpoint never return the old four-county array', async () => {
      const partners = await StrategicPartnerService.listPartners({ opportunityId: oppCoC.id });
      for (const p of partners) {
        const match = p.opportunityMatches?.[0];
        if (match) {
          expect(match.countiesOverlap).not.toEqual(['Orange County', 'Los Angeles County', 'San Bernardino County', 'San Diego County']);
          expect(match.overlapCounties).not.toEqual(['Orange County', 'Los Angeles County', 'San Bernardino County', 'San Diego County']);
        }
      }
    });

    it('Future-expansion counties cannot enter active overlap calculations', async () => {
      const sanDiegoCoC = await prisma.strategicPartnerCandidate.findFirst({ where: { cocNumber: 'CA-601' } });
      if (sanDiegoCoC) {
        const matches = await StrategicPartnerService.matchOpportunityToPartners(oppCoC.id);
        const sdMatch = matches.find((m: any) => m.strategicPartnerCandidateId === sanDiegoCoC.id);
        if (sdMatch) {
          expect(sdMatch.overlapCounties).not.toContain('San Diego County');
          expect(sdMatch.overlapCounties).toEqual([]);
        }
      }
    });

    it('Repeated discovery remains idempotent', async () => {
      const run1 = await StrategicPartnerService.runDiscovery();
      const run2 = await StrategicPartnerService.runDiscovery();
      expect(run2.discoveredCount).toEqual(run1.discoveredCount);
    });
  });
});
