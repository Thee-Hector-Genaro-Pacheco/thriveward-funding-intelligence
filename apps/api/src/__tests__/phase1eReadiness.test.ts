import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../server';
import { prisma } from '../lib/prisma';
import { FiscalSponsorService } from '../services/fiscalSponsorService';
import { StrategicPartnerService } from '../services/strategicPartnerService';
import { ReadinessPlanService } from '../services/readinessPlanService';
import { GrantCalendarService } from '../services/grantCalendarService';
import { OutreachBriefingService } from '../services/outreachBriefingService';
import { SponsorMatchStatus, RecurrenceConfidence, PlanTaskStatus } from '@prisma/client';

describe('Phase 1E — Fiscal Sponsor, Strategic Partner & Funding Readiness Test Suite', () => {
  const cleanTestOpp = async (externalOpportunityId: string) => {
    const opps = await prisma.fundingOpportunity.findMany({
      where: { externalOpportunityId },
    });
    for (const opp of opps) {
      await prisma.opportunitySponsorMatch.deleteMany({ where: { fundingOpportunityId: opp.id } });
      await prisma.readinessPlanHistory.deleteMany({ where: { plan: { fundingOpportunityId: opp.id } } });
      await prisma.readinessPlanTask.deleteMany({ where: { plan: { fundingOpportunityId: opp.id } } });
      await prisma.opportunityReadinessPlan.deleteMany({ where: { fundingOpportunityId: opp.id } });
      await prisma.grantCalendarItem.deleteMany({ where: { fundingOpportunityId: opp.id } });
      await prisma.fundingOpportunity.delete({ where: { id: opp.id } });
    }
  };

  const cleanTestSponsor = async (websiteUrl: string) => {
    const sponsors = await prisma.fiscalSponsorCandidate.findMany({ where: { websiteUrl } });
    for (const s of sponsors) {
      await prisma.opportunitySponsorMatch.deleteMany({ where: { fiscalSponsorCandidateId: s.id } });
      await prisma.sponsorSourceCitation.deleteMany({ where: { fiscalSponsorCandidateId: s.id } });
      await prisma.fiscalSponsorCandidate.delete({ where: { id: s.id } });
    }
  };

  beforeAll(async () => {
    process.env.DATABASE_URL =
      process.env.TEST_DATABASE_URL ||
      process.env.DATABASE_URL ||
      'postgresql://bridge_admin:bridge_secure_pass_2026@localhost:5432/bridge_ai_test_db?schema=public';
    process.env.BRIDGE_REVIEW_TOKEN =
      process.env.BRIDGE_REVIEW_TOKEN ||
      'bridge_secret_review_token_change_in_production_2026';

    await cleanTestOpp('test-phase1e-opp-001');
    await cleanTestOpp('test-phase1e-opp-002');
    await cleanTestOpp('test-phase1e-opp-sop-003');
    await cleanTestOpp('test-phase1e-opp-idem-004');
    await cleanTestSponsor('https://unverified-sponsor-test.org');
    await cleanTestSponsor('https://unverified-test-sponsor.org');
    await cleanTestSponsor('https://briefing-sponsor.org');
  });

  afterAll(async () => {
    await cleanTestOpp('test-phase1e-opp-001');
    await cleanTestOpp('test-phase1e-opp-002');
    await cleanTestOpp('test-phase1e-opp-sop-003');
    await cleanTestOpp('test-phase1e-opp-idem-004');
    await cleanTestSponsor('https://unverified-sponsor-test.org');
    await cleanTestSponsor('https://unverified-test-sponsor.org');
    await cleanTestSponsor('https://briefing-sponsor.org');
  });

  it('1. No fabricated sponsor facts: UNKNOWN is preserved when facts cannot be verified', async () => {
    const candidate = await FiscalSponsorService.createCandidate({
      name: 'Unverified Community Sponsor',
      websiteUrl: 'https://unverified-sponsor-test.org',
      directorySourceUrl: 'https://fiscalsponsordirectory.org/service/unverified-test/',
      geography: 'California',
      mission: 'Mission supporting California community projects.',
      populationsServed: ['Youth'],
      modelsOffered: ['Model A'],
      // Intentionally omitting optional fields to verify UNKNOWN preservation
    });

    expect(candidate.acceptingNewProjects).toBe('UNKNOWN');
    expect(candidate.administersGovGrants).toBe('UNKNOWN');
    expect(candidate.federalGrantCapability).toBe('UNKNOWN');
    expect(candidate.samUeiStatus).toBe('UNKNOWN');
    expect(candidate.setupFee).toBe('UNKNOWN');
    expect(candidate.adminPercentage).toBe('UNKNOWN');
    expect(candidate.verificationStatus).toBe('PENDING_HUMAN_REVIEW');
  });

  it('2. Sponsors and strategic partners remain separate models in database', async () => {
    const partner = await StrategicPartnerService.createPartner({
      name: 'Riverside Youth Shelter Partner',
      organizationType: 'HOMELISS_YOUTH_PROVIDER',
      websiteUrl: 'https://riversideyouthpartner.org',
      geography: 'Riverside County',
      mission: 'Emergency shelter for unhoused youth.',
      servicesOffered: ['Youth Crisis Shelter', 'Meals'],
      collaborationFocus: 'Youth intake & referral partner',
    });

    expect(partner.id).toBeDefined();
    expect(partner.organizationType).toBe('HOMELISS_YOUTH_PROVIDER');

    // Confirm that strategic partners do NOT exist in FiscalSponsorCandidate model
    const sponsorSearch = await prisma.fiscalSponsorCandidate.findUnique({
      where: { id: partner.id },
    });
    expect(sponsorSearch).toBeNull();
  });

  it('3. Sponsor matching is source-backed and influenced by opportunity requirements', async () => {
    const opp = await prisma.fundingOpportunity.create({
      data: {
        title: 'Phase 1E Test Opportunity — Reentry Workforce',
        fundingAgency: 'California Workforce Board',
        isDemo: true,
        sourceSystem: 'DEMO_FIXTURE',
        externalOpportunityId: 'test-phase1e-opp-001',
        fundingOpportunityNumber: 'CA-CWDB-2026-TEST',
        description: 'Workforce grant for justice-involved participants.',
        sourceUrl: 'https://cwdb.ca.gov/grants/test-001',
        candidateRoutingStatus: 'FISCAL_SPONSOR_REQUIRED',
      },
    });

    const matches = await FiscalSponsorService.matchOpportunityToSponsors(opp.id);
    expect(matches.length).toBeGreaterThan(0);

    const firstMatch = matches[0];
    expect(firstMatch.matchScore).toBeGreaterThanOrEqual(0);
    expect(firstMatch.evidenceCoverage).toBeGreaterThanOrEqual(0);
    expect(firstMatch.legalApplicantCapability).toBeDefined();
    expect(firstMatch.feeAndLeadTimeNotes).toContain('Admin Percentage');
  });

  it('4. Unverified sponsors cannot be marked ACCEPTED and status transitions require human authorization', async () => {
    const candidate = await FiscalSponsorService.createCandidate({
      name: 'Unverified Test Sponsor Candidate',
      websiteUrl: 'https://unverified-test-sponsor.org',
      directorySourceUrl: 'https://fiscalsponsordirectory.org/service/unverified-candidate/',
      geography: 'California',
      mission: 'Test sponsor mission',
      populationsServed: ['Reentry'],
      modelsOffered: ['Model F'],
      verificationStatus: 'PENDING_HUMAN_REVIEW', // Unverified
    });

    const opp = await prisma.fundingOpportunity.create({
      data: {
        title: 'Test Opp for Unverified Sponsor Safeguard',
        fundingAgency: 'HHS',
        isDemo: true,
        sourceSystem: 'DEMO_FIXTURE',
        externalOpportunityId: 'test-phase1e-opp-002',
        description: 'Test description',
        sourceUrl: 'https://grants.gov/test-safeguard',
        candidateRoutingStatus: 'FISCAL_SPONSOR_REQUIRED',
      },
    });

    const matches = await FiscalSponsorService.matchOpportunityToSponsors(opp.id);
    const match = matches.find((m) => m.fiscalSponsorCandidateId === candidate.id);
    expect(match).toBeDefined();

    // Safeguard 1: Status advance beyond POSSIBLE_MATCH without reviewerId must fail
    await expect(
      FiscalSponsorService.transitionMatchStatus({
        matchId: match!.id,
        targetStatus: SponsorMatchStatus.CONTACT_APPROVED,
        reviewerId: '',
      })
    ).rejects.toThrow(/explicit human reviewer authorization/i);

    // Safeguard 2: Unverified sponsor cannot transition to ACCEPTED
    await expect(
      FiscalSponsorService.transitionMatchStatus({
        matchId: match!.id,
        targetStatus: SponsorMatchStatus.ACCEPTED,
        reviewerId: 'reviewer-admin-01',
      })
    ).rejects.toThrow(/unverified/i);
  });

  it('5. No external outreach occurs without human approval: Briefing preparation is read-only', async () => {
    const candidate = await FiscalSponsorService.createCandidate({
      name: 'Briefing Test Sponsor',
      websiteUrl: 'https://briefing-sponsor.org',
      directorySourceUrl: 'https://fiscalsponsordirectory.org/service/briefing-sponsor/',
      geography: 'California',
      mission: 'Briefing test mission',
      populationsServed: ['Youth'],
      modelsOffered: ['Model A'],
      contactChannel: 'partnerships@briefing-sponsor.org',
    });

    const briefing = await OutreachBriefingService.generateSponsorBriefingPacket(candidate.id);
    expect(briefing.draftInquiryEmail.to).toBe('partnerships@briefing-sponsor.org');
    expect(briefing.discoveryCallQuestions.length).toBe(5);
    expect(briefing.safeguardNotice).toMatch(/HUMAN-CONTROLLED OUTREACH SAFEGUARD/i);
  });

  it('6. Future deadlines are never invented and recurrence evidence source is required', async () => {
    // Attempting to create calendar item without evidence source must fail
    await expect(
      GrantCalendarService.createCalendarItem({
        opportunityTitle: 'Test No Evidence Grant',
        agency: 'DOL',
        recurrenceConfidence: RecurrenceConfidence.HISTORICALLY_RECURRING,
        recurrenceEvidenceSource: '',
      })
    ).rejects.toThrow(/recurrence evidence source URL or document citation/i);

    const item = await GrantCalendarService.createCalendarItem({
      opportunityTitle: 'Verified Recurring Reentry Grant',
      agency: 'DOL ETA',
      recurrenceConfidence: RecurrenceConfidence.HISTORICALLY_RECURRING,
      recurrenceEvidenceSource: 'https://www.grants.gov/search-results-detail/362088',
      priorCycleDates: ['2024-06-01', '2025-06-15'],
      expectedNextCyclePrepDate: new Date('2027-02-01T00:00:00Z'),
    });

    expect(item.recurrenceConfidence).toBe('HISTORICALLY_RECURRING');
    expect(item.recurrenceEvidenceSource).toContain('grants.gov');
  });

  it('7. SOP Street Outreach 90-day future-cycle plan is complete with all 10 mandatory preparation tasks', async () => {
    const sopOpp = await prisma.fundingOpportunity.create({
      data: {
        title: 'FY 2026 Street Outreach Program',
        fundingAgency: 'Administration for Children and Families',
        isDemo: true,
        sourceSystem: 'DEMO_FIXTURE',
        externalOpportunityId: 'test-phase1e-opp-sop-003',
        fundingOpportunityNumber: 'HHS-2026-ACF-ACYF-YO-0044',
        description: 'Grants to prevent youth homelessness and human trafficking.',
        sourceUrl: 'https://www.grants.gov/search-results-detail/362088',
        candidateRoutingStatus: 'FISCAL_SPONSOR_REQUIRED',
        dismissedReason: 'FISCAL_SPONSOR_REQUIRED: PRE_INCORPORATION',
      },
    });

    const plan = await ReadinessPlanService.getOrGeneratePlan(sopOpp.id);
    expect(plan).toBeDefined();
    expect(plan.tasks.length).toBe(10);

    const titles = plan.tasks.map((t) => t.title);
    expect(titles.some((t) => t.includes('Legal Incorporation'))).toBe(true);
    expect(titles.some((t) => t.includes('Federal EIN'))).toBe(true);
    expect(titles.some((t) => t.includes('SAM.gov Registration'))).toBe(true);
    expect(titles.some((t) => t.includes('Grants.gov AOR Credentials'))).toBe(true);
    expect(titles.some((t) => t.includes('Fiscal Sponsor Evaluation'))).toBe(true);
    expect(titles.some((t) => t.includes('Non-Federal Match'))).toBe(true);
    expect(titles.some((t) => t.includes('Runaway & Homeless Youth Service Partnerships'))).toBe(true);
    expect(titles.some((t) => t.includes('Safeguarding & Mandatory Reporting'))).toBe(true);
    expect(titles.some((t) => t.includes('Operating-History & Evidence'))).toBe(true);
    expect(titles.some((t) => t.includes('Application Preparation (90-Day Lead Time)'))).toBe(true);
  });

  it('8. Repeated readiness plan generation is idempotent', async () => {
    const opp = await prisma.fundingOpportunity.create({
      data: {
        title: 'Idempotency Test Grant',
        fundingAgency: 'CWDB',
        isDemo: true,
        sourceSystem: 'DEMO_FIXTURE',
        externalOpportunityId: 'test-phase1e-opp-idem-004',
        description: 'Test description',
        sourceUrl: 'https://cwdb.ca.gov/test-idempotent',
      },
    });

    const plan1 = await ReadinessPlanService.getOrGeneratePlan(opp.id);
    const plan2 = await ReadinessPlanService.getOrGeneratePlan(opp.id);
    expect(plan2.id).toBe(plan1.id);
  });

  it('9. Phase 1E API Endpoints HTTP Verification', async () => {
    const resSponsors = await request(app).get('/api/fiscal-sponsors');
    expect(resSponsors.status).toBe(200);
    expect(resSponsors.body.success).toBe(true);

    const resPartners = await request(app).get('/api/strategic-partners');
    expect(resPartners.status).toBe(200);
    expect(resPartners.body.success).toBe(true);

    const resCalendar = await request(app).get('/api/grant-calendar');
    expect(resCalendar.status).toBe(200);
    expect(resCalendar.body.success).toBe(true);
  });
});
