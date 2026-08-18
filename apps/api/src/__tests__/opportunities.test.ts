import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../server';

describe('Thriveward Funding Intelligence API — Opportunity & Health Read Endpoints', () => {
  beforeAll(() => {
    process.env.BRIDGE_REVIEW_TOKEN =
      process.env.BRIDGE_REVIEW_TOKEN ||
      'bridge_secret_review_token_change_in_production_2026';
  });

  describe('GET /health', () => {
    it('returns system health status and governance flags', async () => {
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('UP');
      expect(res.body.service).toBe('Thriveward Funding Intelligence Core API');
      expect(res.body.governance.humanInTheLoopEnforced).toBe(true);
      expect(res.body.governance.autonomousSubmissionsAllowed).toBe(false);
    });
  });

  describe('GET /api/opportunities', () => {
    it('returns paginated demonstration opportunities list', async () => {
      const res = await request(app).get('/api/opportunities');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('data');
      expect(res.body).toHaveProperty('pagination');
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);

      // Verify structure of demo item
      const item = res.body.data.find((opp: any) => opp.isDemo) || res.body.data[0];
      expect(item).toHaveProperty('id');
      expect(item).toHaveProperty('title');
      expect(item).toHaveProperty('isDemo');
      expect(item).toHaveProperty('fundingSource');
      expect(item).toHaveProperty('eligibilityRequirements');
      expect(item).toHaveProperty('allowableCostItems');
      expect(item).toHaveProperty('requiredDocuments');
      expect(item).toHaveProperty('scoringCriteria');
      expect(item).toHaveProperty('sourceCitations');
      expect(item).toHaveProperty('opportunityAnalyses');
    });

    it('filters opportunities by minimumFitScore', async () => {
      const res = await request(app).get('/api/opportunities?minimumFitScore=80');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      res.body.data.forEach((opp: any) => {
        expect(opp.opportunityAnalyses.length).toBeGreaterThan(0);
        expect(opp.opportunityAnalyses[0].overallFitScore).toBeGreaterThanOrEqual(80);
      });
    });

    it('filters opportunities by status', async () => {
      const res = await request(app).get('/api/opportunities?status=PENDING_HUMAN_REVIEW');
      expect(res.status).toBe(200);
      res.body.data.forEach((opp: any) => {
        expect(opp.status).toBe('PENDING_HUMAN_REVIEW');
      });
    });

    it('returns HTTP 400 for unknown query parameter', async () => {
      const res = await request(app).get('/api/opportunities?invalidQuery=abc');
      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error', 'Bad Request');
      expect(res.body.message).toContain('Invalid query parameter');
    });

    it('returns HTTP 400 for invalid minimumFitScore', async () => {
      const res = await request(app).get('/api/opportunities?minimumFitScore=invalid');
      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error', 'Bad Request');
    });

    it('returns HTTP 400 for limit exceeding 100', async () => {
      const res = await request(app).get('/api/opportunities?limit=500');
      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error', 'Bad Request');
      expect(res.body.message).toContain('cannot exceed maximum allowed page size');
    });
  });

  describe('GET /api/opportunities/:id', () => {
    it('returns full opportunity record for valid ID demo-opp-001', async () => {
      const res = await request(app).get('/api/opportunities/demo-opp-001');
      expect(res.status).toBe(200);
      expect(res.body.id).toBe('demo-opp-001');
      expect(res.body.isDemo).toBe(true);
      expect(res.body.title).toContain('[DEMO]');
      expect(res.body.fundingAgency).toBe('[DEMO] California State Workforce Board');
      expect(res.body.fundingSource.name).toContain('[DEMO]');
      expect(res.body.eligibilityRequirements.length).toBeGreaterThan(0);
      expect(res.body.allowableCostItems.length).toBeGreaterThan(0);
      expect(res.body.requiredDocuments.length).toBeGreaterThan(0);
      expect(res.body.scoringCriteria.length).toBeGreaterThan(0);
      expect(res.body.sourceCitations.length).toBeGreaterThan(0);
      expect(res.body.sourceCitations[0].quotedSection).toContain('synthetic demonstration fixture');
      expect(res.body.opportunityAnalyses.length).toBeGreaterThan(0);
      expect(res.body.opportunityAnalyses[0].overallFitScore).toBeGreaterThan(0);
    });

    it('returns HTTP 404 for unknown opportunity ID', async () => {
      const res = await request(app).get('/api/opportunities/unknown-opp-id-9999');
      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty('error', 'Not Found');
      expect(res.body.message).toContain("Funding opportunity with ID 'unknown-opp-id-9999' not found");
    });
  });
});
