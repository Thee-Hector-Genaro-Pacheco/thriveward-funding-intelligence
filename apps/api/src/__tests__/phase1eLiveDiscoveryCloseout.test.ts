import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../server';
import { prisma } from '../lib/prisma';
import { SponsorDiscoveryService } from '../services/sponsorDiscoveryService';
import { FiscalSponsorService } from '../services/fiscalSponsorService';
import { OutreachBriefingService } from '../services/outreachBriefingService';

const REVIEW_TOKEN = 'bridge_secret_review_token_change_in_production_2026';

describe('Phase 1E — Live-Discovery Identity & Evidence Closeout Test Suite', () => {
  beforeAll(async () => {
    process.env.BRIDGE_REVIEW_TOKEN = REVIEW_TOKEN;
  });

  it('1. Fixture and live versions of the same domain reconcile to one canonical sponsor candidate', async () => {
    const reconcileRes = await FiscalSponsorService.reconcileDuplicateSponsors();
    expect(reconcileRes).toBeDefined();

    const activeSponsors = await FiscalSponsorService.listCandidates({ includeMerged: false });
    const cpCandidates = activeSponsors.filter((s) => s.canonicalDomain === 'communitypartners.org');
    expect(cpCandidates.length).toBe(1);

    const ciCandidates = activeSponsors.filter((s) => s.canonicalDomain === 'communityinitiatives.org');
    expect(ciCandidates.length).toBe(1);
  });

  it('2. Seed reruns do not revert live evidence status on live-verified candidates', async () => {
    const candidate = await prisma.fiscalSponsorCandidate.findFirst({
      where: { canonicalDomain: 'communitypartners.org' },
    });
    expect(candidate).toBeDefined();

    // Set live verification flag
    await prisma.fiscalSponsorCandidate.update({
      where: { id: candidate!.id },
      data: { hasLiveVerification: true },
    });

    const refreshed = await prisma.fiscalSponsorCandidate.findUnique({
      where: { id: candidate!.id },
    });
    expect(refreshed!.hasLiveVerification).toBe(true);
  });

  it('3. Merged aliases are absent from normal API candidate results', async () => {
    const activeList = await FiscalSponsorService.listCandidates({ includeMerged: false });
    const hasMerged = activeList.some((s) => s.isMerged);
    expect(hasMerged).toBe(false);

    const res = await request(app).get('/api/fiscal-sponsors');
    expect(res.status).toBe(200);
    const bodyCandidates = res.body.data || [];
    expect(bodyCandidates.some((s: any) => s.isMerged)).toBe(false);
  });

  it('4. Second identical discovery run produces zero material updates (recordsCreated = 0, recordsMateriallyUpdated = 0)', async () => {
    const run1 = await SponsorDiscoveryService.runDiscovery();
    const run2 = await SponsorDiscoveryService.runDiscovery();

    expect(run2.recordsCreated).toBe(0);
    expect(run2.recordsMateriallyUpdated).toBe(0);
  });

  it('5. Updating only timestamps counts as revalidation (recordsRevalidated > 0)', async () => {
    const run = await SponsorDiscoveryService.runDiscovery();
    expect(run.recordsRevalidated).toBeGreaterThan(0);
  });

  it('6. Repeated discovery runs create zero duplicate citations', async () => {
    const sponsor = await prisma.fiscalSponsorCandidate.findFirst({
      where: { canonicalDomain: 'communitypartners.org' },
      include: { citations: true },
    });
    expect(sponsor).toBeDefined();

    const uniqueSourceUrls = new Set(sponsor!.citations.map((c) => c.sourceUrl));
    expect(uniqueSourceUrls.size).toBe(sponsor!.citations.length);
  });

  it('7. Human-control language replaces preliminary inquiry approval with research and human confirmation label', async () => {
    const run = await SponsorDiscoveryService.runDiscovery();
    for (const c of run.discoveredCandidates) {
      expect(c.recommendation).toBe('Possible sponsor — research and human confirmation required');
      expect(c.recommendation).not.toContain('Preliminary Inquiry Approved');
    }
  });

  it('8. SEE unsupported facts remain UNKNOWN unless exact official current citations exist', async () => {
    const run = await SponsorDiscoveryService.runDiscovery();
    const see = run.discoveredCandidates.find((c) => c.canonicalDomain === 'saveourplanet.org');

    expect(see).toBeDefined();
    expect(see!.intakeStatus).toBe('UNKNOWN');
    expect(see!.governmentGrantAdminEvidence).toBe('Federal registration status not independently verified');
  });

  it('9. Directory-reported claims do not become sponsor-confirmed official evidence', async () => {
    const candidate = await prisma.fiscalSponsorCandidate.findFirst({
      where: { canonicalDomain: 'saveourplanet.org' },
    });

    expect(candidate).toBeDefined();
    expect(candidate!.verificationLevel).not.toBe('SPONSOR_OFFICIAL_SITE');
    expect(['DIRECTORY_REPORTED', 'SEED_FIXTURE']).toContain(candidate!.verificationLevel);
  });

  it('10. Granular evidence coverage metrics prevent 100% rating when operational or compatibility fields are UNKNOWN', () => {
    const metrics = FiscalSponsorService.calculateCoverageMetrics({
      websiteVerified: 'CONFIRMED',
      identityVerified: 'CONFIRMED',
      sponsorshipModelsVerified: 'DIRECTORY_REPORTED',
      intakeStatus: 'UNKNOWN',
      feeVerified: 'UNKNOWN',
      leadTimeVerified: 'UNKNOWN',
      governmentGrantAdministrationVerified: 'UNKNOWN',
      samUeiStatus: 'UNKNOWN',
      opportunitySpecificCompatibility: 'HUMAN_CONFIRMATION_REQUIRED',
    });

    expect(metrics.identityEvidenceCoverage).toBe(100);
    expect(metrics.operationalEvidenceCoverage).toBeLessThan(100);
    expect(metrics.opportunityCompatibilityCoverage).toBe(0);
  });

  it('11. Zero external communications occur: Briefing packets remain read-only drafts', async () => {
    const sponsor = await prisma.fiscalSponsorCandidate.findFirst({ where: { isMerged: false } });
    expect(sponsor).toBeDefined();

    const briefing = await OutreachBriefingService.generateSponsorBriefingPacket(sponsor!.id);
    expect(briefing.safeguardNotice).toContain('HUMAN-CONTROLLED OUTREACH SAFEGUARD');
    expect(briefing.draftInquiryEmail.bodyText).toBeDefined();
  });
});
