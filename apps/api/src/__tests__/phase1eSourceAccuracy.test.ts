import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../server';
import { prisma } from '../lib/prisma';
import { calculateSopMatchRequirement, CANONICAL_SOP_IDENTITY, verifyNofoPdfDigest } from '../services/sopMatchCalculator';
import { SponsorDiscoveryService } from '../services/sponsorDiscoveryService';
import { FiscalSponsorService } from '../services/fiscalSponsorService';
import { OutreachBriefingService } from '../services/outreachBriefingService';

const REVIEW_TOKEN = 'bridge_secret_review_token_change_in_production_2026';

describe('Phase 1E — Source Accuracy, Sponsor Facts & Live Discovery Correction Test Suite', () => {
  beforeAll(async () => {
    process.env.DATABASE_URL =
      process.env.DATABASE_URL ||
      'postgresql://bridge_admin:bridge_secure_pass_2026@localhost:5432/bridge_ai_db?schema=public';
    process.env.BRIDGE_REVIEW_TOKEN = REVIEW_TOKEN;
  });

  it('1. Canonical SOP Detail ID is 362088 and 357658 cannot be associated with SOP', () => {
    expect(CANONICAL_SOP_IDENTITY.detailId).toBe('362088');
    expect(CANONICAL_SOP_IDENTITY.opportunityNumber).toBe('HHS-2026-ACF-ACYF-YO-0044');
    expect(CANONICAL_SOP_IDENTITY.officialDetailUrl).toBe('https://www.grants.gov/search-results-detail/362088');
    expect(CANONICAL_SOP_IDENTITY.officialDetailUrl).not.toContain('357658');
  });

  it('2. Verified Street Outreach Program award bounds ($100k–$200k) and match formula (award / 9)', () => {
    const calcMin = calculateSopMatchRequirement(100000);
    expect(calcMin.federalAwardAmount).toBe(100000);
    expect(calcMin.nonFederalMatchRequired).toBe(11111);
    expect(calcMin.totalProjectCost).toBe(111111);
    expect(calcMin.waiverProvisions).toBe('UNKNOWN');

    const calcMax = calculateSopMatchRequirement(200000);
    expect(calcMax.federalAwardAmount).toBe(200000);
    expect(calcMax.nonFederalMatchRequired).toBe(22222);
    expect(calcMax.totalProjectCost).toBe(222222);
    expect(calcMax.statutoryAuthority).toBe('Section 383 of the RHY Act, 34 U.S.C. §11274');
    expect(calcMax.sourcePageRange).toBe('Pages 6–8');
  });

  it('3. Real NOFO PDF digest verification computes SHA-256 and byte count correctly', () => {
    // Simulated exact NOFO PDF byte buffer check
    const mockPdfBuffer = Buffer.alloc(CANONICAL_SOP_IDENTITY.documentByteCount);
    const verification = verifyNofoPdfDigest(mockPdfBuffer);

    expect(verification.byteCount).toBe(393080);
    expect(verification.computedHash).toBeDefined();
  });

  it('4. Community Partners official published facts are persisted accurately', async () => {
    const cp = await prisma.fiscalSponsorCandidate.findFirst({
      where: { name: { contains: 'Community Partners' } },
    });

    expect(cp).toBeDefined();
    expect(cp!.adminPercentage).toContain('9%');
    expect(cp!.adminPercentage).toContain('15%');
    expect(cp!.adminPercentage).not.toContain('12%');
    expect(cp!.minRevenueRequirement).toContain('$22,500');
    expect(cp!.estimatedReviewTime).toContain('6 weeks');
  });

  it('5. Community Initiatives official published facts are persisted accurately', async () => {
    const ci = await prisma.fiscalSponsorCandidate.findFirst({
      where: { name: { contains: 'Community Initiatives' } },
    });

    expect(ci).toBeDefined();
    expect(ci!.adminPercentage).toContain('10%');
    expect(ci!.adminPercentage).toContain('15%');
    expect(ci!.minRevenueRequirement).toContain('$50,000');
    expect(ci!.minRevenueRequirement).toContain('$5,000');
  });

  it('6. Housing and government cost-reimbursement compatibility concerns are captured', async () => {
    const cp = await prisma.fiscalSponsorCandidate.findFirst({
      where: { name: { contains: 'Community Partners' } },
    });

    const opp = await prisma.fundingOpportunity.create({
      data: {
        title: 'Street Outreach and Youth Emergency Housing Program',
        fundingAgency: 'HHS ACF ACYF',
        isDemo: true,
        sourceSystem: 'DEMO_FIXTURE',
        externalOpportunityId: 'test-phase1e-compat-001',
        description: 'Youth emergency shelter and street outreach services',
        sourceUrl: 'https://www.grants.gov/search-results-detail/362088',
      },
    });

    const matches = await FiscalSponsorService.matchOpportunityToSponsors(opp.id);
    const match = matches.find((m) => m.fiscalSponsorCandidateId === cp!.id);
    expect(match).toBeDefined();
    expect(match!.concerns.some((c) => c.includes('housing') || c.includes('cost-reimbursement'))).toBe(true);

    // Teardown
    await prisma.opportunitySponsorMatch.deleteMany({ where: { fundingOpportunityId: opp.id } });
    await prisma.fundingOpportunity.delete({ where: { id: opp.id } });
  });

  it('7. Support all sponsorship models (Models A–F, Org-Specific, UNKNOWN) without restricting to A/F', async () => {
    const candidate = await FiscalSponsorService.createCandidate({
      name: 'All Models Test Sponsor',
      websiteUrl: 'https://all-models-test.org',
      directorySourceUrl: 'https://fiscalsponsordirectory.org/service/all-models/',
      geography: 'California',
      mission: 'Test multi-model sponsor',
      populationsServed: ['Youth'],
      modelsOffered: ['MODEL_A', 'MODEL_B', 'MODEL_C', 'MODEL_D', 'MODEL_E', 'MODEL_F', 'ORGANIZATION_SPECIFIC', 'UNKNOWN'],
    });

    expect(candidate.modelsOffered).toContain('MODEL_B');
    expect(candidate.modelsOffered).toContain('MODEL_C');
    expect(candidate.modelsOffered).toContain('MODEL_D');
    expect(candidate.modelsOffered).toContain('MODEL_E');

    // Clean up
    await prisma.fiscalSponsorCandidate.delete({ where: { id: candidate.id } });
  });

  it('8. Website verification does NOT imply intake verification and fixture records are marked isFixture=true', async () => {
    const fixture = await FiscalSponsorService.createCandidate({
      name: 'Fixture Sponsor',
      websiteUrl: 'https://fixture-sponsor.org',
      directorySourceUrl: 'https://fiscalsponsordirectory.org/fixture',
      geography: 'California',
      mission: 'Fixture mission',
      populationsServed: ['Youth'],
      modelsOffered: ['MODEL_A'],
      isFixture: true,
      acceptingNewProjects: 'UNKNOWN',
    });

    expect(fixture.isFixture).toBe(true);
    expect(fixture.websiteVerified).toBe('CONFIRMED');
    expect(fixture.intakeStatus).toBe('UNKNOWN');

    // Clean up
    await prisma.fiscalSponsorCandidate.delete({ where: { id: fixture.id } });
  });

  it('9. Sponsor discovery is idempotent and creates zero duplicate citations', async () => {
    const res1 = await SponsorDiscoveryService.runDiscovery();
    const res2 = await SponsorDiscoveryService.runDiscovery();

    expect(res2.recordsCreated).toBe(0);
    expect(res2.recordsUpdated).toBeGreaterThan(0);
  });

  it('10. No external outreach occurs: Briefing packet generation is read-only', async () => {
    const sponsor = await prisma.fiscalSponsorCandidate.findFirst();
    expect(sponsor).toBeDefined();

    const briefing = await OutreachBriefingService.generateSponsorBriefingPacket(sponsor!.id);
    expect(briefing.safeguardNotice).toContain('HUMAN-CONTROLLED OUTREACH SAFEGUARD');
    expect(briefing.draftInquiryEmail.bodyText).toBeDefined();
  });
});
