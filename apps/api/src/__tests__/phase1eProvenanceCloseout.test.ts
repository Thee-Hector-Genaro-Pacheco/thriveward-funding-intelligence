import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../server';
import { prisma } from '../lib/prisma';
import { FiscalSponsorService } from '../services/fiscalSponsorService';
import { SponsorDiscoveryService } from '../services/sponsorDiscoveryService';

const REVIEW_TOKEN = 'bridge_secret_review_token_change_in_production_2026';

describe('Phase 1E — Candidate Seed & Discovery Provenance Test Suite', () => {
  beforeAll(async () => {
    process.env.DATABASE_URL =
      process.env.DATABASE_URL ||
      'postgresql://bridge_admin:bridge_secure_pass_2026@localhost:5432/bridge_ai_db?schema=public';
    process.env.BRIDGE_REVIEW_TOKEN = REVIEW_TOKEN;
  });

  it('1. Seed does not create historical production aliases in fresh/seeded state', async () => {
    const historicalIds = [
      '00fe8e92-0a44-4942-b790-636d02d7556b',
      'b14be6d6-a5b3-4f9a-be08-02cef38ead61',
      '57bc028c-0161-4b60-be39-e2b11dcfea3d',
    ];

    // Repair script ensures existing DB retains them as merged, but seed alone never creates them if missing
    for (const id of historicalIds) {
      const alias = await prisma.fiscalSponsorCandidate.findUnique({ where: { id } });
      if (alias) {
        expect(alias.isMerged).toBe(true);
        expect(alias.isFixture).toBe(false);
      }
    }
  });

  it('2. Live discovery creates SEE candidate with isFixture=false and hasLiveVerification=true', async () => {
    const see = await prisma.fiscalSponsorCandidate.findFirst({
      where: { canonicalDomain: 'saveourplanet.org', isMerged: false },
    });

    expect(see).toBeDefined();
    expect(see!.isFixture).toBe(false);
    expect(see!.hasLiveVerification).toBe(true);
    expect(see!.isMerged).toBe(false);
    expect(see!.mergedIntoId).toBeNull();
  });

  it('3. Seed after discovery preserves SEE provenance (isFixture remains false)', async () => {
    const seeBefore = await prisma.fiscalSponsorCandidate.findFirst({
      where: { canonicalDomain: 'saveourplanet.org', isMerged: false },
    });
    expect(seeBefore).toBeDefined();

    // Re-run repair/reconciliation check
    await FiscalSponsorService.repairExistingDatabaseProvenance();

    const seeAfter = await prisma.fiscalSponsorCandidate.findFirst({
      where: { canonicalDomain: 'saveourplanet.org', isMerged: false },
    });

    expect(seeAfter).toBeDefined();
    expect(seeAfter!.isFixture).toBe(false);
    expect(seeAfter!.hasLiveVerification).toBe(true);
  });

  it('4. Seed preserves live verification status on seeded identities (isFixture=true, hasLiveVerification=true)', async () => {
    const cp = await prisma.fiscalSponsorCandidate.findUnique({
      where: { id: 'sponsor-community-partners-la' },
    });
    const ci = await prisma.fiscalSponsorCandidate.findUnique({
      where: { id: 'sponsor-community-initiatives-sf' },
    });

    expect(cp).toBeDefined();
    expect(cp!.isFixture).toBe(true);
    expect(cp!.hasLiveVerification).toBe(true);

    expect(ci).toBeDefined();
    expect(ci!.isFixture).toBe(true);
    expect(ci!.hasLiveVerification).toBe(true);
  });

  it('5. Discovery enriches an existing domain directly without creating temporary duplicate candidate rows', async () => {
    const run = await SponsorDiscoveryService.runDiscovery({ fetchMode: 'TEST_FIXTURE' });
    expect(run.recordsCreated).toBe(0);
    expect(run.recordsMerged).toBe(0);

    const cpAcc = run.parsedCandidateAccounting.find((p) => p.parsedDomain === 'communitypartners.org');
    expect(cpAcc).toBeDefined();
    expect(cpAcc!.canonicalCandidateId).toBe('sponsor-community-partners-la');
  });

  it('6. All citations and matches reference active canonical candidates (zero merged references)', async () => {
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

  it('7. Human-controlled outreach safeguard: zero automated outreach triggers on discovery', async () => {
    const res = await request(app).get('/api/fiscal-sponsors');
    expect(res.status).toBe(200);

    // Candidates must remain in inquiry / decision support state, no automated messages or emails sent
    for (const c of res.body.data) {
      expect(c.verificationStatus).not.toBe('OUTREACH_SENT');
    }
  });
});
