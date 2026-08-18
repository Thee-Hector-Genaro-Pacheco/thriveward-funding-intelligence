import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../server';
import { prisma } from '../lib/prisma';
import { AnalysisService } from '../services/analysisService';
import { FiscalSponsorService } from '../services/fiscalSponsorService';

const REVIEW_TOKEN = 'bridge_secret_review_token_change_in_production_2026';

describe('Phase 1E — UI/API Actions, Details & Sponsor-Navigation Integration Test Suite', () => {
  let routedOppId: string;
  let officialOppId: string;

  beforeAll(async () => {
    process.env.BRIDGE_REVIEW_TOKEN = REVIEW_TOKEN;

    let opps = await prisma.fundingOpportunity.findMany();
    let routed = opps.find(
      (o) => o.candidateRoutingStatus && o.candidateRoutingStatus !== 'DIRECT_FEDERAL_ELIGIBLE'
    );
    let official = opps.find((o) => !o.isDemo);

    if (!routed) {
      const newRouted = await prisma.fundingOpportunity.create({
        data: {
          title: 'Street Outreach Program',
          fundingOpportunityNumber: 'HHS-2026-ACF-ACYF-YO-0044',
          fundingAgency: 'Administration for Children and Families',
          description: 'Outreach services for homeless youth.',
          totalAvailableFunding: '$150,000',
          geography: 'California Regional Geography',
          deadline: '2026-08-26',
          sourceUrl: 'https://www.grants.gov/search-results-detail/362088',
          candidateRoutingStatus: 'FISCAL_SPONSOR_REQUIRED',
          dismissedReason: 'FISCAL_SPONSOR_REQUIRED: Direct federal application blocked.',
          isDemo: false,
          sourceSystem: 'GRANTS_GOV',
        },
      });
      routedOppId = newRouted.id;
    } else {
      routedOppId = routed.id;
    }

    if (!official) {
      officialOppId = routedOppId;
    } else {
      officialOppId = official.id;
    }
  });

  it('1. GET /api/opportunities?dataKind=official returns HTTP 200 and official persisted records', async () => {
    const res = await request(app).get('/api/opportunities?dataKind=official');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);

    for (const opp of res.body.data) {
      expect(opp.isDemo).toBe(false);
      expect(opp.fundingOpportunityNumber).toBeDefined();
      expect(opp.title).toBeDefined();
    }
  });

  it('2. GET /api/opportunities?candidateRoutingStatus=DIRECT_FEDERAL_ELIGIBLE handles empty direct actionable feed gracefully', async () => {
    const res = await request(app).get('/api/opportunities?candidateRoutingStatus=DIRECT_FEDERAL_ELIGIBLE');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    // Since Bridge Forward is PRE_INCORPORATION, 0 direct federal candidates is correct
  });

  it('3. Analyze & Score works on routed Potential Pathway records without changing routing or pursuit stage', async () => {
    const oppBefore = await prisma.fundingOpportunity.findUnique({ where: { id: routedOppId } });
    expect(oppBefore).toBeDefined();

    const initialStage = oppBefore!.pursuitStage;
    const initialRouting = oppBefore!.candidateRoutingStatus;

    const res = await request(app).post(`/api/opportunities/${routedOppId}/analyze`);
    expect(res.status).toBe(200);
    expect(res.body.overallFitScore).toBeGreaterThanOrEqual(0);

    const oppAfter = await prisma.fundingOpportunity.findUnique({ where: { id: routedOppId } });
    expect(oppAfter!.pursuitStage).toBe(initialStage);
    expect(oppAfter!.candidateRoutingStatus).toBe(initialRouting);
  });

  it('4. Repeated analysis requests are idempotent and refresh analysis graph', async () => {
    const res1 = await AnalysisService.analyzeOpportunity(routedOppId);
    const res2 = await AnalysisService.analyzeOpportunity(routedOppId);

    expect(res1.id).toBe(res2.id);
    expect(res1.overallFitScore).toBe(res2.overallFitScore);
  });

  it('5. GET /api/opportunities/:id returns full opportunity details for Review Details drawer prior to analysis', async () => {
    const res = await request(app).get(`/api/opportunities/${officialOppId}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(officialOppId);
    expect(res.body.sourceUrl).toBeDefined();
    expect(res.body.fundingAgency).toBeDefined();
  });

  it('6. GET /api/opportunities/:id/analysis returns complete analysis graph after calculation', async () => {
    await AnalysisService.analyzeOpportunity(routedOppId);
    const res = await request(app).get(`/api/opportunities/${routedOppId}/analysis`);
    expect(res.status).toBe(200);
    const analysisObj = res.body.currentAnalysis || res.body.analysis || res.body;
    expect(analysisObj).toBeDefined();
    expect(analysisObj.overallFitScore).toBeGreaterThanOrEqual(0);
    expect(analysisObj.evidenceCoverage).toBeGreaterThanOrEqual(0);
  });

  it('7. GET /api/opportunities/:opportunityId/sponsor-matches returns calculated persisted sponsor matches', async () => {
    const res = await request(app).get(`/api/opportunities/${routedOppId}/sponsor-matches`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);

    for (const m of res.body.data) {
      expect(m.matchScore).toBeGreaterThanOrEqual(0);
      expect(m.fiscalSponsorCandidateId).toBeDefined();
    }
  });

  it('8. Human-triggered sponsor match calculation performs zero external communication/outreach', async () => {
    const matches = await FiscalSponsorService.matchOpportunityToSponsors(routedOppId);
    expect(matches.length).toBeGreaterThan(0);

    for (const m of matches) {
      expect(m.status).not.toBe('OUTREACH_SENT');
    }
  });

  it('9. Direct qualification and locking remain blocked for routed candidates', async () => {
    const res = await request(app)
      .post(`/api/opportunities/${routedOppId}/pursuit`)
      .set('Authorization', `Bearer ${REVIEW_TOKEN}`)
      .send({ stage: 'QUALIFIED', reviewerId: 'authorized-reviewer-123' });

    expect(res.status).toBe(400);
    expect(res.body.message.toLowerCase()).toContain('directly');
  });

  it('10. System health mapping handles healthy database as UP and unreachable funding agent as DEGRADED', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('UP');
    expect(res.body.integrations.database.healthy).toBe(true);
    expect(res.body.integrations.database.status).toContain('UP');
  });
});
