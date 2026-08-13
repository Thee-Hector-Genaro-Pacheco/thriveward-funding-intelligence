import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../server';
import { prisma } from '../lib/prisma';
import { execSync } from 'child_process';
import path from 'path';

const REVIEW_TOKEN = 'bridge_secret_review_token_change_in_production_2026';

describe('Phase 1D — Runtime Contract, Proxy & Migration Audit Suite', () => {
  beforeAll(async () => {
    process.env.DATABASE_URL =
      process.env.DATABASE_URL ||
      'postgresql://bridge_admin:bridge_secure_pass_2026@localhost:5432/bridge_ai_db?schema=public';
    process.env.BRIDGE_REVIEW_TOKEN = REVIEW_TOKEN;
  });

  // --- Suite 1: Health & Database Schema Query ---
  describe('1. Health Endpoint & Real DB Query Verification', () => {
    it('returns HTTP 200 with DB readiness verified via real query on /health', async () => {
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('UP');
      expect(res.body.integrations.database.healthy).toBe(true);
      expect(res.body.integrations.database.status).toContain('PostgreSQL 16');
    });

    it('returns HTTP 200 on proxy path /api/health', async () => {
      const res = await request(app).get('/api/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('UP');
      expect(res.body.integrations.database.healthy).toBe(true);
    });
  });

  // --- Suite 2: Opportunities API Path & Query Parameters ---
  describe('2. Opportunities API Path & Query Parameters', () => {
    it('returns HTTP 200 for empty or specific dataKind queries', async () => {
      const resOfficial = await request(app).get('/api/opportunities?dataKind=official');
      expect(resOfficial.status).toBe(200);
      expect(Array.isArray(resOfficial.body.data)).toBe(true);

      const resDemo = await request(app).get('/api/opportunities?dataKind=demo');
      expect(resDemo.status).toBe(200);
      expect(Array.isArray(resDemo.body.data)).toBe(true);
    });

    it('returns HTTP 200 for query params (pursuitStage=QUALIFIED, DISMISSED, etc.)', async () => {
      const resQual = await request(app).get('/api/opportunities?pursuitStage=QUALIFIED');
      expect(resQual.status).toBe(200);
      expect(Array.isArray(resQual.body.data)).toBe(true);

      const resDism = await request(app).get('/api/opportunities?pursuitStage=DISMISSED');
      expect(resDism.status).toBe(200);
      expect(Array.isArray(resDism.body.data)).toBe(true);
    });

    it('returns HTTP 200 with pagination data object even when results are 0', async () => {
      const res = await request(app).get('/api/opportunities?relevanceStatus=IRRELEVANT&dataKind=demo');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('data');
      expect(res.body).toHaveProperty('pagination');
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });

  // --- Suite 3: Non-Actionable Qualification & Lock Action Guards ---
  describe('3. Non-Actionable Qualification & Lock Guards', () => {
    it('returns HTTP 400 when attempting to mark a non-actionable (DISMISSED/routed) opportunity as QUALIFIED', async () => {
      const opp = await prisma.fundingOpportunity.create({
        data: {
          fundingOpportunityNumber: 'TEST-RUNTIME-GUARD-001',
          title: 'Runtime Guard Test Federal Notice',
          fundingAgency: 'DOJ',
          description: 'Federal grant requiring SAM.gov/UEI.',
          pursuitStage: 'DISMISSED',
          dismissedReason: 'FISCAL_SPONSOR_REQUIRED: Direct federal submission requires incorporated 501(c)(3) entity.',
          sourceSystem: 'GRANTS_GOV',
          externalOpportunityId: 'test-runtime-guard-001',
          sourceUrl: 'https://www.grants.gov/search-results-detail/test-runtime-guard-001',
        },
      });

      const res = await request(app)
        .post(`/api/opportunities/${opp.id}/pursuit`)
        .set('Authorization', `Bearer ${REVIEW_TOKEN}`)
        .send({
          targetStage: 'QUALIFIED',
          reviewerId: 'test-reviewer',
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('not currently eligible to apply directly');

      // Verify zero DB mutations occurred
      const reFetched = await prisma.fundingOpportunity.findUnique({ where: { id: opp.id } });
      expect(reFetched?.pursuitStage).toBe('DISMISSED');

      // Cleanup
      await prisma.fundingOpportunity.delete({ where: { id: opp.id } });
    });
  });

  // --- Suite 4: Seed Idempotency & Migration Status Verification ---
  describe('4. Deterministic Seed & Migration Deployment Verification', () => {
    it('verifies prisma migrate deploy completes cleanly', () => {
      const schemaPath = path.resolve(__dirname, '../../prisma/schema.prisma');
      const output = execSync(`npx prisma migrate status --schema="${schemaPath}"`, {
        env: process.env,
        encoding: 'utf-8',
      });
      expect(output).toContain('Database schema is up to date');
    });

    it('verifies deterministic seed executes idempotently without duplicate records', async () => {
      const countBefore = await prisma.fundingOpportunity.count({ where: { isDemo: true } });
      expect(countBefore).toBeGreaterThanOrEqual(3);

      const seedPath = path.resolve(__dirname, '../../prisma/seed.ts');
      execSync(`npx tsx "${seedPath}"`, { env: process.env, encoding: 'utf-8' });

      const countAfter = await prisma.fundingOpportunity.count({ where: { isDemo: true } });
      expect(countAfter).toBe(countBefore);
    });
  });
});
