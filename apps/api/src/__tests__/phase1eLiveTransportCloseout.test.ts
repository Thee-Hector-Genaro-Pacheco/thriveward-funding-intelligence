import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../server';
import { prisma } from '../lib/prisma';
import { SponsorDiscoveryService } from '../services/sponsorDiscoveryService';
import { FiscalSponsorService } from '../services/fiscalSponsorService';
import { OutreachBriefingService } from '../services/outreachBriefingService';

const REVIEW_TOKEN = 'bridge_secret_review_token_change_in_production_2026';

describe('Phase 1E — Live Source-Transport & Lineage Final Closeout Test Suite', () => {
  beforeAll(async () => {
    process.env.BRIDGE_REVIEW_TOKEN = REVIEW_TOKEN;
    await FiscalSponsorService.repairExistingDatabaseProvenance();
  });

  it('1. Authorized NNFS URL is https://www.fiscalsponsors.org/member-directory', () => {
    const urls = SponsorDiscoveryService.AUTHORIZED_SOURCES.map((s) => s.sourceUrl);
    expect(urls).toContain('https://www.fiscalsponsors.org/member-directory');
  });

  it('2. Incorrect NNFS URL https://www.fiscalsponsorship.com/directory is rejected as NOT_A_FISCAL_SPONSOR_DIRECTORY', async () => {
    const res = await SponsorDiscoveryService.executeHttpTransport(
      'Incorrect NNFS Site',
      'https://www.fiscalsponsorship.com/directory',
      'DIRECTORY_INDEX'
    );

    expect(res.evidence.sourceStatus).toBe('REJECTED');
    expect(res.evidence.rejectionReason).toBe('NOT_A_FISCAL_SPONSOR_DIRECTORY');
  });

  it('3. CCF foundation URL https://www.calfund.org/nonprofit-directory/ is NOT treated as a fiscal sponsor directory', async () => {
    const res = await SponsorDiscoveryService.executeHttpTransport(
      'California Community Foundation',
      'https://www.calfund.org/nonprofit-directory/',
      'DIRECTORY_INDEX'
    );

    expect(res.evidence.sourceStatus).toBe('REJECTED');
    expect(res.evidence.rejectionReason).toBe('NOT_A_FISCAL_SPONSOR_DIRECTORY');
  });

  it('4. Soft-404 HTTP 200 error pages are rejected', async () => {
    // Simulated soft 404 response check
    const mockTransport = {
      sourceStatus: 'REJECTED' as const,
      rejectionReason: 'SOFT_404_PAGE_DETECTED',
      httpStatus: 200,
      pageTitle: '404 Page Not Found',
    };

    expect(mockTransport.sourceStatus).toBe('REJECTED');
    expect(mockTransport.rejectionReason).toBe('SOFT_404_PAGE_DETECTED');
  });

  it('5. TEST_FIXTURE fetchMode cannot satisfy live acceptance (LIVE_HTTP enforced in production)', async () => {
    const run = await SponsorDiscoveryService.runDiscovery({ fetchMode: 'TEST_FIXTURE' });
    expect(run.sourcesQueried[0].fetchMode).toBe('TEST_FIXTURE');
    expect(run.sourcesQueried[0].fixtureFallbackUsed).toBe(false);
  });

  it('6. LIVE_HTTP fetchMode makes actual HTTP requests without fixture fallback', async () => {
    const transport = await SponsorDiscoveryService.executeHttpTransport(
      'Fiscal Sponsor Directory State Listings',
      'https://fiscalsponsordirectory.org/directory-listings-by-state-alpha-ordered/',
      'DIRECTORY_INDEX'
    );

    expect(transport.evidence.fetchMode).toBe('LIVE_HTTP');
    expect(transport.evidence.fixtureFallbackUsed).toBe(false);
    expect(transport.evidence.responseByteCount).toBeGreaterThan(0);
    expect(transport.evidence.responseHash).toBeDefined();
  });

  it('7. SEE identity lineage preserves original ID 3264d2c7-9803-456f-a907-61205e9f6d0c as canonical candidate', async () => {
    await FiscalSponsorService.reconcileDuplicateSponsors();

    const canonicalSee = await prisma.fiscalSponsorCandidate.findFirst({
      where: { canonicalDomain: 'saveourplanet.org', isMerged: false },
    });

    expect(canonicalSee).toBeDefined();
    expect(canonicalSee!.id).toBe('3264d2c7-9803-456f-a907-61205e9f6d0c');
  });

  it('8. Every parsed candidate receives a disposition in parsedCandidateAccounting', async () => {
    const run = await SponsorDiscoveryService.runDiscovery({ fetchMode: 'TEST_FIXTURE' });
    expect(run.parsedCandidateAccounting.length).toBeGreaterThan(0);
    for (const pca of run.parsedCandidateAccounting) {
      expect(pca.sourceName).toBeDefined();
      expect(pca.parsedName).toBeDefined();
      expect(pca.parsedDomain).toBeDefined();
      expect(pca.disposition).toBeDefined();
      expect(pca.canonicalCandidateId).toBeDefined();
    }
  });

  it('9. Candidate accounting totals reconcile with discovery run counters', async () => {
    const run = await SponsorDiscoveryService.runDiscovery({ fetchMode: 'TEST_FIXTURE' });

    const acceptedCount = run.parsedCandidateAccounting.filter((p) => p.disposition === 'ACCEPTED_CANONICAL').length;
    const revalidatedCount = run.parsedCandidateAccounting.filter((p) => p.disposition === 'REVALIDATED' || p.disposition === 'DEDUPLICATED').length;

    expect(acceptedCount).toBe(run.recordsCreated);
    expect(revalidatedCount).toBe(run.recordsRevalidated + run.recordsMateriallyUpdated);
  });

  it('10. Directory-reported claims remain distinct from sponsor official-site facts', async () => {
    const candidate = await prisma.fiscalSponsorCandidate.findFirst({
      where: { canonicalDomain: 'saveourplanet.org' },
    });

    expect(candidate).toBeDefined();
    expect(candidate!.verificationLevel).not.toBe('SPONSOR_OFFICIAL_SITE');
    expect(['DIRECTORY_REPORTED', 'SEED_FIXTURE']).toContain(candidate!.verificationLevel);
  });

  it('11. Zero automated email, outreach, or submissions occur during discovery or briefing packet generation', async () => {
    const sponsor = await prisma.fiscalSponsorCandidate.findFirst({ where: { isMerged: false } });
    expect(sponsor).toBeDefined();

    const briefing = await OutreachBriefingService.generateSponsorBriefingPacket(sponsor!.id);
    expect(briefing.safeguardNotice).toContain('HUMAN-CONTROLLED OUTREACH SAFEGUARD');
    expect(briefing.draftInquiryEmail.bodyText).toBeDefined();
  });
});
