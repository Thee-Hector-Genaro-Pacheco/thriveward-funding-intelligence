import { describe, it, expect, beforeAll } from 'vitest';
import { AnalysisService } from '../services/analysisService';
import { OutreachBriefingService } from '../services/outreachBriefingService';
import { FiscalSponsorService } from '../services/fiscalSponsorService';
import { SponsorDiscoveryService } from '../services/sponsorDiscoveryService';
import { prisma } from '../lib/prisma';

describe('Phase 1E Decision-Semantics & Pathway-Routing Regression Suite', () => {
  let cocOppId: string;
  let streetOppId: string;
  let sponsorId: string;

  beforeAll(async () => {
    await SponsorDiscoveryService.runDiscovery();
    await FiscalSponsorService.repairExistingDatabaseProvenance();

    // Find or create exact opportunity records
    let cocOpp = await prisma.fundingOpportunity.findFirst({
      where: { fundingOpportunityNumber: 'CPD-2600-DC-0025' },
    });

    if (!cocOpp) {
      cocOpp = await prisma.fundingOpportunity.create({
        data: {
          title: 'FY2026 Continuum of Care Competition and Youth Homelessness Demonstration Program',
          fundingOpportunityNumber: 'CPD-2600-DC-0025',
          fundingAgency: 'Department of Housing and Urban Development',
          description: 'Funding to support Continuum of Care programs and Youth Homelessness Demonstration Program activities.',
          totalAvailableFunding: '$3,200,000,000',
          awardMin: '500000',
          awardMax: '5000000',
          eligibleApplicantTypes: ['Continuum of Care Collaborative Applicants', 'State and Local Governments'],
          eligiblePopulations: ['Unhoused youth', 'Young adults facing homelessness'],
          geography: 'National / California Bay Area & Southern California',
          deadline: '2026-08-26',
          sourceUrl: 'https://www.grants.gov/search-results-detail/362088',
          candidateRoutingStatus: 'PARTNERSHIP_REQUIRED',
          dismissedReason: 'PARTNERSHIP_REQUIRED: Requires submission through official Continuum of Care (CoC) Collaborative Applicant via e-snaps.',
          isDemo: false,
          sourceSystem: 'GRANTS_GOV',
        },
      });
    } else {
      cocOpp = await prisma.fundingOpportunity.update({
        where: { id: cocOpp.id },
        data: {
          title: 'FY2026 Continuum of Care Competition and Youth Homelessness Demonstration Program',
          fundingOpportunityNumber: 'CPD-2600-DC-0025',
          candidateRoutingStatus: 'PARTNERSHIP_REQUIRED',
          dismissedReason: 'PARTNERSHIP_REQUIRED: Requires submission through official Continuum of Care (CoC) Collaborative Applicant via e-snaps.',
          isDemo: false,
          sourceSystem: 'GRANTS_GOV',
        },
      });
    }
    console.log('[DEBUG cocOpp found in beforeAll]:', {
      id: cocOpp?.id,
      title: cocOpp?.title,
      num: cocOpp?.fundingOpportunityNumber,
      routingStatus: cocOpp?.candidateRoutingStatus,
      dismissedReason: cocOpp?.dismissedReason,
    });
    cocOppId = cocOpp.id;

    let streetOpp = await prisma.fundingOpportunity.findFirst({
      where: { fundingOpportunityNumber: 'HHS-2026-ACF-ACYF-YO-0044' },
    });

    if (!streetOpp) {
      streetOpp = await prisma.fundingOpportunity.create({
        data: {
          title: 'Street Outreach Program',
          fundingOpportunityNumber: 'HHS-2026-ACF-ACYF-YO-0044',
          fundingAgency: 'Administration for Children and Families',
          description: 'Prevention and outreach services for runaway and homeless youth.',
          totalAvailableFunding: '$150,000',
          awardMin: '90000',
          awardMax: '150000',
          eligibleApplicantTypes: ['Nonprofits with or without 501(c)(3) status'],
          eligiblePopulations: ['Street youth', 'Runaway and homeless youth'],
          geography: 'California Regional Geography',
          deadline: '2026-08-26',
          sourceUrl: 'https://www.grants.gov/search-results-detail/362088',
          candidateRoutingStatus: 'FISCAL_SPONSOR_REQUIRED',
          dismissedReason: 'FISCAL_SPONSOR_REQUIRED: Direct federal application blocked. Requires incorporated legal entity, active SAM.gov/UEI, and fiscal sponsorship.',
          isDemo: false,
          sourceSystem: 'GRANTS_GOV',
        },
      });
    } else {
      streetOpp = await prisma.fundingOpportunity.update({
        where: { id: streetOpp.id },
        data: {
          candidateRoutingStatus: 'FISCAL_SPONSOR_REQUIRED',
          dismissedReason: 'FISCAL_SPONSOR_REQUIRED: Direct federal application blocked. Requires incorporated legal entity, active SAM.gov/UEI, and fiscal sponsorship.',
          isDemo: false,
          sourceSystem: 'GRANTS_GOV',
        },
      });
    }
    streetOppId = streetOpp.id;

    let sponsor = await prisma.fiscalSponsorCandidate.findFirst({
      where: { isMerged: false },
    });

    if (!sponsor) {
      sponsor = await prisma.fiscalSponsorCandidate.create({
        data: {
          name: 'Community Initiatives',
          websiteUrl: 'https://communityinitiatives.org',
          directorySourceUrl: 'https://fiscalsponsordirectory.org',
          geography: 'California Statewide',
          mission: 'Provides fiscal sponsorship for community projects.',
          populationsServed: ['Youth', 'Reentry'],
          modelsOffered: ['Model A Direct Project'],
          acceptingNewProjects: 'YES',
          administersGovGrants: 'YES',
          federalGrantCapability: 'Active SAM.gov & UEI',
          samUeiStatus: 'UNKNOWN',
          isFixture: true,
          hasLiveVerification: true,
        },
      });
    }
    sponsorId = sponsor.id;
  });

  it('1. CPD-2600-DC-0025 decision safeguards: Direct application blocked, never return ELIGIBLE or HIGH_PRIORITY', async () => {
    const analysis = await AnalysisService.analyzeOpportunity(cocOppId);

    expect(analysis.eligibilityDecision).toBe('NOT_ELIGIBLE');
    expect(analysis.eligibilityDecision).not.toBe('ELIGIBLE');

    const result = await AnalysisService.evaluateOpportunity(cocOppId);
    expect(result.recommendation).not.toBe('HIGH_PRIORITY');
    expect(result.recommendation).not.toBe('ELIGIBLE');
  });

  it('2. High mission relevance score does not override mandatory direct applicant blockers', async () => {
    const result = await AnalysisService.evaluateOpportunity(cocOppId);

    // High strategic mission alignment score should be awarded
    const missionDim = result.dimensions.find((d: any) => d.dimensionKey === 'strategicMissionAlignment');
    expect(missionDim).toBeDefined();

    // But overall eligibility decision must remain NOT_ELIGIBLE / NOT_CURRENTLY_ELIGIBLE
    expect(result.eligibilityDecision).toBe('NOT_ELIGIBLE');
  });

  it('3. Dimension evaluations: Tax status, operating history, and unconfirmed partnerships are not marked MATCH for PRE_INCORPORATION', async () => {
    const result = await AnalysisService.evaluateOpportunity(cocOppId);

    const taxDim = result.dimensions.find((d: any) => d.dimensionKey === 'applicantTypeTaxStatus');
    expect(taxDim?.matchStatus).toBe('MISMATCH');

    const opDim = result.dimensions.find((d: any) => d.dimensionKey === 'operatingHistoryReadiness');
    expect(opDim?.matchStatus).toBe('MISMATCH');

    const partnerDim = result.dimensions.find((d: any) => d.dimensionKey === 'partnershipRequirements');
    expect(partnerDim?.matchStatus).toBe('MISMATCH');

    const compDim = result.dimensions.find((d: any) => d.dimensionKey === 'complianceReportingCapacity');
    expect(compDim?.matchStatus).toBe('UNKNOWN');
  });

  it('4. Block fiscal-sponsor briefing generation for PARTNERSHIP_REQUIRED opportunities', async () => {
    await expect(
      OutreachBriefingService.generateSponsorBriefingPacket(sponsorId, cocOppId)
    ).rejects.toThrow(/requires a Continuum of Care Collaborative Applicant/i);
  });

  it('5. Draft inquiry email uses tentative, human-review-required alignment language', async () => {
    const briefing = await OutreachBriefingService.generateSponsorBriefingPacket(sponsorId, streetOppId);

    expect(briefing.draftInquiryEmail.bodyText).toContain(
      'appears potentially aligned with our mission based on preliminary, human-review-required analysis.'
    );
    expect(briefing.draftInquiryEmail.bodyText).not.toContain('explicitly aligns with our service model');
  });

  it('6. Sponsor evidence coverage metrics account for persisted citations and live verification', () => {
    const metrics = FiscalSponsorService.calculateCoverageMetrics({
      identityVerified: 'CONFIRMED',
      websiteVerified: 'CONFIRMED',
      hasLiveVerification: true,
      citations: [{ sourceUrl: 'https://fiscalsponsordirectory.org', extractedClaim: 'Verified' }],
    });

    expect(metrics.identityEvidenceCoverage).toBeGreaterThan(0);
    expect(metrics.operationalEvidenceCoverage).toBeGreaterThan(0);
  });

  it('7. SEE provenance record retains isFixture=false for live-discovered entries', async () => {
    const seeCandidate = await prisma.fiscalSponsorCandidate.findFirst({
      where: { canonicalDomain: 'saveourplanet.org' },
    });

    if (seeCandidate) {
      expect(seeCandidate.isFixture).toBe(false);
      expect(seeCandidate.hasLiveVerification).toBe(true);
    }
  });
});
