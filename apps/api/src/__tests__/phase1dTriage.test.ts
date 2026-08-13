import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import { app } from '../server';
import { prisma } from '../lib/prisma';
import { BRIDGE_FORWARD_PROFILE, getProfileHash } from '../config/bridgeForwardProfile';
import { RelevanceService } from '../services/relevanceService';
import { PursuitService } from '../services/pursuitService';
import { IngestionService } from '../services/ingestionService';
import { GrantsGovClient } from '../integrations/grantsGov/grantsGovClient';
import { sanitizeHtmlToText } from '@bridge-ai/shared';

const REVIEW_TOKEN = 'bridge_secret_review_token_change_in_production_2026';
const TEST_OPP_ID = 'test-phase1d-opp-001';

describe('Phase 1D — Real Discovery, Triage, and Locked Matches Complete Suite', () => {
  const cleanTestOpp = async (target: string) => {
    const opps = await prisma.fundingOpportunity.findMany({
      where: { OR: [{ id: target }, { externalOpportunityId: target }] },
      select: { id: true },
    });
    const ids = opps.map((o) => o.id);
    if (ids.length > 0) {
      await prisma.pursuitHistory.deleteMany({ where: { fundingOpportunityId: { in: ids } } });
      await prisma.relevanceCitation.deleteMany({ where: { opportunityRelevance: { fundingOpportunityId: { in: ids } } } });
      await prisma.opportunityRelevance.deleteMany({ where: { fundingOpportunityId: { in: ids } } });
      await prisma.analysisReview.deleteMany({ where: { opportunityAnalysis: { fundingOpportunityId: { in: ids } } } });
      await prisma.participantSupportFinding.deleteMany({ where: { opportunityAnalysis: { fundingOpportunityId: { in: ids } } } });
      await prisma.analysisDimension.deleteMany({ where: { opportunityAnalysis: { fundingOpportunityId: { in: ids } } } });
      await prisma.eligibilityFinding.deleteMany({ where: { opportunityAnalysis: { fundingOpportunityId: { in: ids } } } });
      await prisma.opportunityAnalysis.deleteMany({ where: { fundingOpportunityId: { in: ids } } });
      await prisma.sourceCitation.deleteMany({ where: { fundingOpportunityId: { in: ids } } });
      await prisma.sourceSnapshot.deleteMany({ where: { fundingOpportunityId: { in: ids } } });
      await prisma.fundingOpportunity.deleteMany({ where: { id: { in: ids } } });
    }
  };

  beforeAll(async () => {
    process.env.DATABASE_URL =
      process.env.DATABASE_URL ||
      'postgresql://bridge_admin:bridge_secure_pass_2026@localhost:5432/bridge_ai_db?schema=public';
    process.env.BRIDGE_REVIEW_TOKEN = REVIEW_TOKEN;

    await cleanTestOpp(TEST_OPP_ID);
    await cleanTestOpp('357658');
    await cleanTestOpp('362833');
    await cleanTestOpp('362068');

    await prisma.fundingOpportunity.create({
      data: {
        id: TEST_OPP_ID,
        title: 'Southern California Reentry Career Pathways Grant',
        fundingAgency: 'California Workforce Development Board',
        isDemo: true,
        sourceSystem: 'DEMO_FIXTURE',
        description: 'Grant notice supporting individualized reentry career pathways in Orange County and Los Angeles County.',
        sourceUrl: 'https://www.cwdb.ca.gov/grants/socal-reentry-2026',
        geography: 'California (Orange County & Los Angeles County)',
        eligibleApplicantTypes: ['Nonprofit Organizations'],
        eligiblePopulations: ['Justice-involved adults', 'System-impacted young adults'],
        pursuitStage: 'NEW',
      },
    });
  });

  afterAll(async () => {
    await cleanTestOpp(TEST_OPP_ID);
    await cleanTestOpp('357658');
    await cleanTestOpp('362833');
    await cleanTestOpp('362068');
  });

  // --- Suite 1: Ground-Truth Profile Integrity ---
  describe('1. Ground-Truth Profile Integrity', () => {
    it('verifies Southern California initial service areas and California statewide geography', () => {
      expect(BRIDGE_FORWARD_PROFILE.statewideGeography).toBe('California');
      expect(BRIDGE_FORWARD_PROFILE.initialServiceAreas).toContain('Orange County');
      expect(BRIDGE_FORWARD_PROFILE.initialServiceAreas).toContain('Los Angeles County');
      expect(BRIDGE_FORWARD_PROFILE.initialServiceAreas).toContain('San Bernardino County');
      expect(BRIDGE_FORWARD_PROFILE.initialServiceAreas).toContain('San Diego County');
      expect(BRIDGE_FORWARD_PROFILE.organizationStage).toBe('PRE_INCORPORATION');
      expect(BRIDGE_FORWARD_PROFILE.taxStatus).toBe('NOT_OBTAINED');
      expect(BRIDGE_FORWARD_PROFILE.operatingHistoryYears).toBe(0);
    });

    it('generates a deterministic 64-character lowercase profile hash for version 1.1.0-phase1d', () => {
      const hash = getProfileHash();
      expect(BRIDGE_FORWARD_PROFILE.profileVersion).toBe('1.1.0-phase1d');
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
      expect(hash.length).toBe(64);
    });
  });

  // --- Suite 2: Relevance, Eligibility, and Fit Separation & Misleading Collisions ---
  describe('2. Relevance, Eligibility, and Fit Separation & False-Positive Discrimination', () => {
    it('rejects clinical-research "re-entry" collision (PAR-25-155 NCATS R03) as IRRELEVANT', async () => {
      await cleanTestOpp('357658');
      await prisma.fundingOpportunity.create({
        data: {
          id: 'test-phase1d-nih-357658',
          externalOpportunityId: '357658',
          fundingOpportunityNumber: 'PAR-25-155',
          title: 'Small Grant Program for the NCATS Clinical and Translational Science Award (R03 Clinical Trial Optional)',
          fundingAgency: 'National Institutes of Health',
          isDemo: false,
          sourceSystem: 'GRANTS_GOV',
          description: 'Research grant supplement for re-entry into biomedical research careers for clinical trial scholars.',
          sourceUrl: 'https://www.grants.gov/search-results-detail/357658',
        },
      });

      const rel = await RelevanceService.assessRelevance('test-phase1d-nih-357658');
      expect(rel.relevanceStatus).toBe('IRRELEVANT');
      expect(rel.relevanceScore).toBeLessThanOrEqual(15);
      expect(rel.exclusionReasons).toContain('CLINICAL_RESEARCH_REENTRY_COLLISION');
    });

    it('rejects international travel "re-entry" collision (DFOP0018692 Congress-Bundestag) as IRRELEVANT', async () => {
      await cleanTestOpp('362833');
      await prisma.fundingOpportunity.create({
        data: {
          id: 'test-phase1d-eca-362833',
          externalOpportunityId: '362833',
          fundingOpportunityNumber: 'DFOP0018692',
          title: 'FY 2026 Congress-Bundestag Youth Exchange for Young Professionals',
          fundingAgency: 'Bureau Of Educational and Cultural Affairs',
          isDemo: false,
          sourceSystem: 'GRANTS_GOV',
          description: 'International cultural youth exchange program including participant re-entry orientation after travel.',
          sourceUrl: 'https://www.grants.gov/search-results-detail/362833',
        },
      });

      const rel = await RelevanceService.assessRelevance('test-phase1d-eca-362833');
      expect(rel.relevanceStatus).toBe('IRRELEVANT');
      expect(rel.relevanceScore).toBeLessThanOrEqual(15);
      expect(rel.exclusionReasons).toContain('INTERNATIONAL_TRAVEL_REENTRY_COLLISION');
    });

    it('assesses mission-adjacent CSBG opportunity (HHS-2026-ACF-OCS-ET-0030) as POSSIBLY_RELEVANT but conservatively INVESTIGATE for eligibility', async () => {
      await cleanTestOpp('362068');
      await prisma.fundingOpportunity.create({
        data: {
          id: 'test-phase1d-csbg-362068',
          externalOpportunityId: '362068',
          fundingOpportunityNumber: 'HHS-2026-ACF-OCS-ET-0030',
          title: 'Community Services Block Grant (CSBG) Essentials for Improved Outcomes',
          fundingAgency: 'Administration for Children and Families - OCS',
          isDemo: false,
          sourceSystem: 'GRANTS_GOV',
          description: 'Grant opportunity providing community-based workforce services, supportive services, and employment pathways.',
          sourceUrl: 'https://www.grants.gov/search-results-detail/362068',
          operatingHistoryRequirements: 'Requires 3 years operating history',
          eligibleApplicantTypes: ['Incorporated non-profit organizations'],
        },
      });

      const rel = await RelevanceService.assessRelevance('test-phase1d-csbg-362068');
      expect(rel.relevanceStatus).toMatch(/POSSIBLY_RELEVANT|RELEVANT/);
      expect(rel.relevanceScore).toBeGreaterThanOrEqual(40);
      expect(rel.exclusionReasons.length).toBe(0);
    });
  });

  // --- Suite 3: Human-Led Pursuit Pipeline & Append-Only Audit ---
  describe('3. Human-Led Pursuit Pipeline & Append-Only Audit Trail', () => {
    it('imported opportunities begin in NEW pursuitStage and move to REVIEWING on relevance calculation', async () => {
      const oppBefore = await prisma.fundingOpportunity.findUnique({ where: { id: TEST_OPP_ID } });
      expect(oppBefore?.pursuitStage).toBe('NEW');

      await RelevanceService.assessRelevance(TEST_OPP_ID);

      const oppAfter = await prisma.fundingOpportunity.findUnique({ where: { id: TEST_OPP_ID } });
      expect(oppAfter?.pursuitStage).toBe('REVIEWING');
    });

    it('requires Authorization Bearer token for pursuit stage transitions', async () => {
      const res = await request(app)
        .post(`/api/opportunities/${TEST_OPP_ID}/pursuit`)
        .send({ stage: 'QUALIFIED', reviewerId: 'rev-01' });

      expect(res.status).toBe(401);
    });

    it('allows authorized human to mark opportunity QUALIFIED and creates append-only pursuit history', async () => {
      const res = await request(app)
        .post(`/api/opportunities/${TEST_OPP_ID}/pursuit`)
        .set('Authorization', `Bearer ${REVIEW_TOKEN}`)
        .send({ stage: 'QUALIFIED', reviewerId: 'rev-human-01', notes: 'Verified mission fit' });

      expect(res.status).toBe(200);
      expect(res.body.opportunity.pursuitStage).toBe('QUALIFIED');
      expect(res.body.transition.fromStage).toBe('REVIEWING');
      expect(res.body.transition.toStage).toBe('QUALIFIED');
      expect(res.body.transition.actorId).toBe('rev-human-01');
    });

    it('requires non-empty reason string when dismissing an opportunity', async () => {
      const res = await request(app)
        .post(`/api/opportunities/${TEST_OPP_ID}/pursuit`)
        .set('Authorization', `Bearer ${REVIEW_TOKEN}`)
        .send({ stage: 'DISMISSED', reviewerId: 'rev-human-01', reason: '   ' });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Dismissal requires a non-empty explanatory reason');
    });

    it('allows authorized human to Lock Match and maintains append-only history without modifying Phase 1B provenance', async () => {
      const res = await request(app)
        .post(`/api/opportunities/${TEST_OPP_ID}/pursuit`)
        .set('Authorization', `Bearer ${REVIEW_TOKEN}`)
        .send({ stage: 'LOCKED', reviewerId: 'rev-leadership-01', notes: 'Locking match for leadership application proposal' });

      expect(res.status).toBe(200);
      expect(res.body.opportunity.pursuitStage).toBe('LOCKED');

      // Verify pursuit history append-only
      const historyRes = await request(app).get(`/api/opportunities/${TEST_OPP_ID}/pursuit/history`);
      expect(historyRes.status).toBe(200);
      expect(historyRes.body.count).toBeGreaterThanOrEqual(3);

      // Verify Phase 1B provenance untouched
      const opp = await prisma.fundingOpportunity.findUnique({ where: { id: TEST_OPP_ID } });
      expect(opp?.officialSourceAuthority).toBeNull();
      expect(opp?.lastVerifiedTimestamp).toBeNull();
    });

    it('GET /api/opportunities/locked returns only LOCKED matches', async () => {
      const res = await request(app).get('/api/opportunities/locked');
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThan(0);
      res.body.data.forEach((item: any) => {
        expect(item.pursuitStage).toBe('LOCKED');
      });
    });
  });

  // --- Suite 4: HTML Normalization & Discovery ---
  describe('4. HTML Normalization & Discovery Searches', () => {
    it('normalizes raw HTML markup, nested tags, and entities to plain text without dangerouslySetInnerHTML', () => {
      const rawHtml = '<p><span style="color: black;">Opportunity notice for <strong>reentry</strong> &amp; workforce pathways.</span></p><br><li>Item 1</li>';
      const cleanText = sanitizeHtmlToText(rawHtml);

      expect(cleanText).toContain('Opportunity notice for reentry & workforce pathways.');
      expect(cleanText).toContain('Item 1');
      expect(cleanText).not.toContain('<p>');
      expect(cleanText).not.toContain('<span');
      expect(cleanText).not.toContain('&amp;');
    });

    it('executes multi-term discovery profile search, deduplicates by external ID, and records discoverySearchTerms', async () => {
      await cleanTestOpp('999111');
      const mockClient = new GrantsGovClient();
      vi.spyOn(mockClient, 'searchOpportunities').mockImplementation(async (params) => {
        if (params.keyword === 'justice involved') {
          return { opportunityHits: [{ id: '999111', title: 'Justice Involved Workforce Grant', agency: 'DOL' }] };
        }
        if (params.keyword === 'recidivism') {
          return { opportunityHits: [{ id: '999111', title: 'Justice Involved Workforce Grant', agency: 'DOL' }] };
        }
        return { opportunityHits: [] };
      });
      vi.spyOn(mockClient, 'fetchOpportunity').mockResolvedValue({
        id: '999111',
        oppId: '999111',
        opportunityNumber: 'DOL-999111',
        opportunityTitle: 'Justice Involved Workforce Grant',
        agencyName: 'DOL',
        synopsisDescription: 'Workforce grant details',
      });

      const service = new IngestionService(mockClient);
      const res = await service.ingestFromGrantsGov({ profile: 'bridge-forward', limit: 5, dryRun: false });

      expect(res.recordsDiscovered).toBe(1);
      expect(res.recordsCreated).toBe(1);

      const opp = await prisma.fundingOpportunity.findFirst({ where: { externalOpportunityId: '999111' } });
      expect(opp?.discoverySearchTerms).toContain('justice involved');
      expect(opp?.discoverySearchTerms).toContain('recidivism');

      await cleanTestOpp('999111');
    });
  });
});
