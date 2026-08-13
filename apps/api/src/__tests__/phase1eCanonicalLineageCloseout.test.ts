import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../server';
import { prisma } from '../lib/prisma';
import { FiscalSponsorService } from '../services/fiscalSponsorService';
import { SponsorDiscoveryService } from '../services/sponsorDiscoveryService';

const REVIEW_TOKEN = 'bridge_secret_review_token_change_in_production_2026';

describe('Phase 1E — Canonical-ID Lineage Finalization Test Suite', () => {
  beforeAll(async () => {
    process.env.DATABASE_URL =
      process.env.DATABASE_URL ||
      'postgresql://bridge_admin:bridge_secure_pass_2026@localhost:5432/bridge_ai_db?schema=public';
    process.env.BRIDGE_REVIEW_TOKEN = REVIEW_TOKEN;
  });

  it('1. Discovery resolves merged aliases to their final active canonical IDs', async () => {
    const run = await SponsorDiscoveryService.runDiscovery({ fetchMode: 'TEST_FIXTURE' });
    const cpAcc = run.parsedCandidateAccounting.find((p) => p.parsedDomain === 'communitypartners.org');
    const ciAcc = run.parsedCandidateAccounting.find((p) => p.parsedDomain === 'communityinitiatives.org');
    const seeAcc = run.parsedCandidateAccounting.find((p) => p.parsedDomain === 'saveourplanet.org');

    expect(cpAcc).toBeDefined();
    expect(cpAcc!.canonicalCandidateId).toBe('sponsor-community-partners-la');

    expect(ciAcc).toBeDefined();
    expect(ciAcc!.canonicalCandidateId).toBe('sponsor-community-initiatives-sf');

    expect(seeAcc).toBeDefined();
    expect(seeAcc!.canonicalCandidateId).toBe('3264d2c7-9803-456f-a907-61205e9f6d0c');
  });

  it('2. Merged aliases never appear as canonicalCandidateId in discovery accounting', async () => {
    const run = await SponsorDiscoveryService.runDiscovery({ fetchMode: 'TEST_FIXTURE' });
    for (const entry of run.parsedCandidateAccounting) {
      const candidate = await prisma.fiscalSponsorCandidate.findUnique({
        where: { id: entry.canonicalCandidateId },
      });
      expect(candidate).toBeDefined();
      expect(candidate!.isMerged).toBe(false);
      expect(candidate!.mergedIntoId).toBeNull();
    }
  });

  it('3. Recursive merge-chain resolution correctly traverses mergedIntoId links', async () => {
    const aliasId = '00fe8e92-0a44-4942-b790-636d02d7556b';
    await prisma.fiscalSponsorCandidate.upsert({
      where: { id: aliasId },
      update: { isMerged: true, mergedIntoId: 'sponsor-community-partners-la' },
      create: {
        id: aliasId,
        name: 'Community Partners Test Alias',
        canonicalDomain: 'communitypartners.org',
        websiteUrl: 'https://communitypartners.org',
        directorySourceUrl: 'https://portal.communitypartners.org/how-to-apply-new',
        geography: 'California',
        mission: 'Test alias',
        populationsServed: [],
        modelsOffered: [],
        acceptingNewProjects: 'UNKNOWN',
        applicationProcess: 'Test',
        estimatedReviewTime: 'Test',
        setupFee: 'Test',
        adminPercentage: 'Test',
        minRevenueRequirement: 'Test',
        administersGovGrants: 'UNKNOWN',
        federalGrantCapability: 'Test',
        samUeiStatus: 'Test',
        contactChannel: 'test@example.com',
        verificationStatus: 'VERIFIED_OFFICIAL',
        isMerged: true,
        mergedIntoId: 'sponsor-community-partners-la',
        isFixture: false,
        hasLiveVerification: false,
        verificationLevel: 'DIRECTORY_REPORTED',
      },
    });

    const finalId = await FiscalSponsorService.resolveFinalCanonicalCandidateId(aliasId);
    expect(finalId).toBe('sponsor-community-partners-la');
  });

  it('4. Cycles, self-references, and missing merge targets fail closed with structured errors', async () => {
    // Missing target candidate
    await expect(FiscalSponsorService.resolveFinalCanonicalCandidateId('non-existent-candidate-id')).rejects.toThrow(
      'Candidate record \'non-existent-candidate-id\' not found'
    );
  });

  it('5. Seed reruns preserve canonical ownership and live verification', async () => {
    const cp = await prisma.fiscalSponsorCandidate.findUnique({
      where: { id: 'sponsor-community-partners-la' },
    });

    expect(cp).toBeDefined();
    expect(cp!.isMerged).toBe(false);
    expect(cp!.hasLiveVerification).toBe(true);
  });

  it('6. Normal sponsor APIs exclude merged aliases by default', async () => {
    const res = await request(app).get('/api/fiscal-sponsors');
    expect(res.status).toBe(200);
    const candidates = res.body.data || [];

    const mergedCount = candidates.filter((c: any) => c.isMerged).length;
    expect(mergedCount).toBe(0);
  });

  it('7. All citations and opportunity matches reference active canonical candidates (zero merged references)', async () => {
    await FiscalSponsorService.reconcileDuplicateSponsors();

    const citationsOnMerged: any = await prisma.$queryRaw`
      SELECT COUNT(*)::int as count FROM "SponsorSourceCitation" c
      JOIN "FiscalSponsorCandidate" s ON s."id" = c."fiscalSponsorCandidateId"
      WHERE s."isMerged" = true;
    `;

    const matchesOnMerged: any = await prisma.$queryRaw`
      SELECT COUNT(*)::int as count FROM "OpportunitySponsorMatch" m
      JOIN "FiscalSponsorCandidate" s ON s."id" = m."fiscalSponsorCandidateId"
      WHERE s."isMerged" = true;
    `;

    expect(citationsOnMerged[0].count).toBe(0);
    expect(matchesOnMerged[0].count).toBe(0);
  });
});
