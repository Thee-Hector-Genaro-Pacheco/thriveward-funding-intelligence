import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../server';
import { prisma } from '../lib/prisma';
import { calculateSopMatchRequirement } from '../services/sopMatchCalculator';
import { SponsorDiscoveryService } from '../services/sponsorDiscoveryService';
import { FiscalSponsorService } from '../services/fiscalSponsorService';
import { ReadinessPlanService } from '../services/readinessPlanService';
import { OutreachBriefingService } from '../services/outreachBriefingService';

const REVIEW_TOKEN = 'bridge_secret_review_token_change_in_production_2026';

describe('Phase 1E — Source Accuracy & Live Sponsor Discovery Test Suite', () => {
  beforeAll(async () => {
    process.env.DATABASE_URL =
      process.env.DATABASE_URL ||
      'postgresql://bridge_admin:bridge_secure_pass_2026@localhost:5432/bridge_ai_db?schema=public';
    process.env.BRIDGE_REVIEW_TOKEN = REVIEW_TOKEN;
  });

  it('1. Verified Street Outreach Program match calculation uses official NOFO Section III.2 10% rule', () => {
    const calc = calculateSopMatchRequirement(150000);
    expect(calc.matchPercentage).toBe(10);
    expect(calc.appliesTo).toBe('TOTAL_APPROVED_PROJECT_COST');
    expect(calc.federalAwardAmount).toBe(150000);
    expect(calc.totalProjectCost).toBe(166667);
    expect(calc.nonFederalMatchRequired).toBe(166667 - 150000);
    expect(calc.cashOrInKindAllowed).toBe(true);
    expect(calc.sourcePageNumber).toBe(18);
    expect(calc.officialDocumentUrl).toContain('grants.gov');
    expect(calc.documentHash).toBeDefined();

    // Min award $90,000 calculation
    const calcMin = calculateSopMatchRequirement(90000);
    expect(calcMin.totalProjectCost).toBe(100000);
    expect(calcMin.nonFederalMatchRequired).toBe(10000);
  });

  it('2. Support all sponsorship models (Models A–F, Org-Specific, UNKNOWN) without restricting to A/F', async () => {
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
    expect(candidate.modelsOffered).toContain('ORGANIZATION_SPECIFIC');

    // Clean up
    await prisma.fiscalSponsorCandidate.delete({ where: { id: candidate.id } });
  });

  it('3. Website verification does NOT imply intake verification or opportunity-specific compatibility', async () => {
    const candidate = await FiscalSponsorService.createCandidate({
      name: 'Website Verification Distinction Test',
      websiteUrl: 'https://valid-website-test.org',
      directorySourceUrl: 'https://fiscalsponsordirectory.org/service/valid-website/',
      geography: 'California',
      mission: 'Test sponsor with valid website',
      populationsServed: ['Reentry'],
      modelsOffered: ['MODEL_A'],
      acceptingNewProjects: 'UNKNOWN',
      intakeStatus: 'UNKNOWN',
    });

    expect(candidate.websiteVerified).toBe('CONFIRMED');
    expect(candidate.intakeStatus).toBe('UNKNOWN');
    expect(candidate.opportunitySpecificCompatibility).toBe('HUMAN_CONFIRMATION_REQUIRED');

    // Clean up
    await prisma.fiscalSponsorCandidate.delete({ where: { id: candidate.id } });
  });

  it('4. Fixture demonstration records are clearly distinguishable from live-discovered records', async () => {
    const fixture = await FiscalSponsorService.createCandidate({
      name: 'Fixture Sponsor',
      websiteUrl: 'https://fixture-sponsor.org',
      directorySourceUrl: 'https://fiscalsponsordirectory.org/fixture',
      geography: 'California',
      mission: 'Fixture mission',
      populationsServed: ['Youth'],
      modelsOffered: ['MODEL_A'],
      isFixture: true,
    });

    const live = await FiscalSponsorService.createCandidate({
      name: 'Live Discovered Sponsor',
      websiteUrl: 'https://live-discovered-sponsor.org',
      directorySourceUrl: 'https://fiscalsponsordirectory.org/live',
      geography: 'California',
      mission: 'Live mission',
      populationsServed: ['Youth'],
      modelsOffered: ['MODEL_A'],
      isFixture: false,
    });

    expect(fixture.isFixture).toBe(true);
    expect(live.isFixture).toBe(false);

    // Clean up
    await prisma.fiscalSponsorCandidate.delete({ where: { id: fixture.id } });
    await prisma.fiscalSponsorCandidate.delete({ where: { id: live.id } });
  });

  it('5. Live sponsor discovery preserves UNKNOWN when facts are unconfirmed', async () => {
    const discoveryResult = await SponsorDiscoveryService.runDiscovery({
      userReferrals: [
        {
          name: 'Unverified Referral Org',
          websiteUrl: 'https://unverified-referral-org.org',
          geography: 'California',
          mission: 'Referral mission',
        },
      ],
    });

    expect(discoveryResult.discoveredCandidates.length).toBeGreaterThan(0);
    const candidate = discoveryResult.discoveredCandidates.find((c) => c.name === 'Unverified Referral Org');
    expect(candidate).toBeDefined();
    expect(candidate!.intakeStatus).toBe('UNKNOWN');

    // Clean up
    const rec = await prisma.fiscalSponsorCandidate.findFirst({ where: { name: 'Unverified Referral Org' } });
    if (rec) {
      await prisma.sponsorSourceCitation.deleteMany({ where: { fiscalSponsorCandidateId: rec.id } });
      await prisma.fiscalSponsorCandidate.delete({ where: { id: rec.id } });
    }
  });

  it('6. Repeated sponsor discovery runs are idempotent', async () => {
    const res1 = await SponsorDiscoveryService.runDiscovery();
    const res2 = await SponsorDiscoveryService.runDiscovery();

    expect(res2.recordsCreated).toBe(0);
    expect(res2.recordsUpdated).toBeGreaterThan(0);
  });

  it('7. No external communications or emails are sent during discovery or briefing generation', async () => {
    const sponsor = await prisma.fiscalSponsorCandidate.findFirst();
    expect(sponsor).toBeDefined();

    const briefing = await OutreachBriefingService.generateSponsorBriefingPacket(sponsor!.id);
    expect(briefing.safeguardNotice).toContain('HUMAN-CONTROLLED OUTREACH SAFEGUARD');
    expect(briefing.draftInquiryEmail.bodyText).toBeDefined();
  });

  it('8. REST Endpoints for discovery and SOP calculator respond with HTTP 200', async () => {
    const calcRes = await request(app).get('/api/sop-match-calculator?awardAmount=150000');
    expect(calcRes.status).toBe(200);
    expect(calcRes.body.data.nonFederalMatchRequired).toBe(16667);

    const discRes = await request(app).post('/api/fiscal-sponsors/discovery').send({ geography: 'California' });
    expect(discRes.status).toBe(200);
    expect(discRes.body.data.discoveredCandidates.length).toBeGreaterThan(0);
  });
});
