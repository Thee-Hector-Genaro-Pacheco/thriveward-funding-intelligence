import fs from 'fs';
import path from 'path';
import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../server';
import { prisma } from '../lib/prisma';
import { AiFundingAnalystService } from '../services/aiFundingAnalystService';
import { MockFundingAnalystProvider } from '../services/ai/mockFundingAnalystProvider';
import { OpenAiFundingAnalystProvider } from '../services/ai/openAiFundingAnalystProvider';
import { EvidenceCatalogBuilder } from '../services/ai/evidenceCatalogBuilder';
import { AuthService } from '../services/authService';

describe('AI-1 — Structured AI Funding Analyst Complete Test Suite', () => {
  const TEST_FIXTURE_OPPORTUNITY_ID = 'test-ai1-opp-fixture-9999';
  const IMMUTABLE_PRESERVED_EVALUATION_IDS = [
    '536c89cb-4b0c-4cd7-b61a-0f8b762ebec9', // Live OpenAI evaluation
    '8c2245c9-0cd5-49e8-965e-db983b1d92f5', // Baseline mock evaluation
  ];

  let testOpportunity: any;
  const testCreatedEvalIds = new Set<string>();

  const cleanTestCreatedEvaluations = async () => {
    // Ensure immutable production / baseline records are never deleted
    IMMUTABLE_PRESERVED_EVALUATION_IDS.forEach((id) => testCreatedEvalIds.delete(id));

    if (testCreatedEvalIds.size > 0) {
      await prisma.aiEvaluation.deleteMany({
        where: {
          id: { in: Array.from(testCreatedEvalIds) },
        },
      });
      testCreatedEvalIds.clear();
    }

    // Clean up any remaining evaluations tied specifically to the test fixture opportunity
    await prisma.aiEvaluation.deleteMany({
      where: {
        opportunityId: TEST_FIXTURE_OPPORTUNITY_ID,
        id: { notIn: IMMUTABLE_PRESERVED_EVALUATION_IDS },
      },
    });
  };

  beforeAll(async () => {
    // Ensure admin@projectthriveward.org user exists for login test
    const existingAdmin = await prisma.user.findUnique({ where: { email: 'admin@projectthriveward.org' } });
    if (!existingAdmin) {
      const passwordHash = await AuthService.hashPassword('h3lloWorld!!');
      await prisma.user.create({
        data: {
          id: 'ac0b7f55-0e42-43ae-897f-627ff7d9fb75',
          email: 'admin@projectthriveward.org',
          displayName: 'Hector Pacheco',
          passwordHash,
          role: 'ADMIN',
          accountState: 'ACTIVE',
        },
      });
    }

    // Create dedicated, isolated test opportunity fixture
    testOpportunity = await prisma.fundingOpportunity.upsert({
      where: { id: TEST_FIXTURE_OPPORTUNITY_ID },
      update: {},
      create: {
        id: TEST_FIXTURE_OPPORTUNITY_ID,
        title: 'Test AI Opportunity Notice (Isolated Fixture)',
        fundingAgency: 'U.S. Department of Labor',
        fundingOpportunityNumber: 'DOL-AI-2026-FIXTURE',
        description: 'A test workforce grant opportunity.',
        sourceSystem: 'GRANTS_GOV',
        sourceUrl: 'https://example.gov/test-ai-fixture-opp',
        candidateRoutingStatus: 'DIRECT_FEDERAL_ELIGIBLE',
        pursuitStage: 'NEW',
      },
    });

    await cleanTestCreatedEvaluations();
  });

  beforeEach(async () => {
    AiFundingAnalystService.clearRateLimits();
    await cleanTestCreatedEvaluations();
    // Enforce Mock provider for all test runs
    AiFundingAnalystService.setProvider(new MockFundingAnalystProvider());
  });

  afterEach(async () => {
    AiFundingAnalystService.resetProvider();
    await cleanTestCreatedEvaluations();
  });

  afterAll(async () => {
    await cleanTestCreatedEvaluations();

    // Remove audit logs and test opportunity created specifically for tests
    await prisma.securityAuditEvent.deleteMany({
      where: {
        userId: { in: ['test-user-admin', 'test-user-operator'] },
        details: { contains: TEST_FIXTURE_OPPORTUNITY_ID },
      },
    });

    await prisma.fundingOpportunity.deleteMany({
      where: { id: TEST_FIXTURE_OPPORTUNITY_ID },
    });
  });

  describe('1. Endpoint Authentication, CSRF & RBAC Protections', () => {
    it('unauthenticated POST /api/opportunities/:id/ai-evaluations is rejected with 401', async () => {
      const res = await request(app)
        .post(`/api/opportunities/${testOpportunity.id}/ai-evaluations`)
        .set('x-test-unauthenticated', 'true');
      expect(res.status).toBe(401);
    });

    it('VIEWER role cannot generate AI evaluations (receives 403 Forbidden)', async () => {
      const res = await request(app)
        .post(`/api/opportunities/${testOpportunity.id}/ai-evaluations`)
        .set('x-test-role', 'VIEWER')
        .set('X-Thriveward-CSRF', '1');
      expect(res.status).toBe(403);
      expect(res.body.error).toContain('Forbidden');
    });

    it('VIEWER role can read evaluation history via GET (mutation-free)', async () => {
      const res = await request(app)
        .get(`/api/opportunities/${testOpportunity.id}/ai-evaluations`)
        .set('x-test-role', 'VIEWER');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('VIEWER role cannot review AI evaluations (receives 403 Forbidden)', async () => {
      const res = await request(app)
        .post('/api/ai-evaluations/some-fake-id/review')
        .set('x-test-role', 'VIEWER')
        .set('X-Thriveward-CSRF', '1')
        .send({ decision: 'APPROVED', reason: 'Attempting viewer review' });
      expect(res.status).toBe(403);
    });
  });

  describe('2. Fail-Closed Behavior when Provider Unconfigured', () => {
    it('returns 503 AI_ANALYST_NOT_CONFIGURED when AI analyst is disabled and creates 0 DB rows', async () => {
      AiFundingAnalystService.resetProvider();
      const originalEnv = process.env.AI_FUNDING_ANALYST_ENABLED;
      process.env.AI_FUNDING_ANALYST_ENABLED = 'false';

      try {
        const countBefore = await prisma.aiEvaluation.count({ where: { opportunityId: testOpportunity.id } });

        const res = await request(app)
          .post(`/api/opportunities/${testOpportunity.id}/ai-evaluations`)
          .set('x-test-role', 'ADMIN')
          .set('X-Thriveward-CSRF', '1');

        expect(res.status).toBe(503);
        expect(res.body.error).toContain('AI_ANALYST_NOT_CONFIGURED');

        const countAfter = await prisma.aiEvaluation.count({ where: { opportunityId: testOpportunity.id } });
        expect(countAfter).toBe(countBefore);
      } finally {
        process.env.AI_FUNDING_ANALYST_ENABLED = originalEnv;
      }
    });

    it('production OpenAiFundingAnalystProvider cannot silently use mock implementation', () => {
      const prodProvider = new OpenAiFundingAnalystProvider();
      expect(prodProvider.getModelName()).toBe(process.env.OPENAI_MODEL || 'gpt-5.6-luna');
      if (process.env.AI_FUNDING_ANALYST_ENABLED !== 'true' || !process.env.OPENAI_API_KEY) {
        expect(prodProvider.isConfigured()).toBe(false);
      }
    });

    it('verifies docker-compose.yml forwards required AI analyst variables without hardcoded secrets', () => {
      const composePath = path.resolve(__dirname, '../../../../docker-compose.yml');
      const composeContent = fs.readFileSync(composePath, 'utf8');

      expect(composeContent).toContain('AI_FUNDING_ANALYST_ENABLED: ${AI_FUNDING_ANALYST_ENABLED:-false}');
      expect(composeContent).toContain('OPENAI_API_KEY: ${OPENAI_API_KEY:-}');
      expect(composeContent).toContain('OPENAI_MODEL: ${OPENAI_MODEL:-gpt-5.6-luna}');
      expect(composeContent).toContain('OPENAI_TIMEOUT_MS: ${OPENAI_TIMEOUT_MS:-30000}');
      expect(composeContent).toContain('OPENAI_MAX_OUTPUT_TOKENS: ${OPENAI_MAX_OUTPUT_TOKENS:-2500}');
      expect(composeContent).toContain('AI_EVALUATION_RATE_LIMIT_PER_HOUR: ${AI_EVALUATION_RATE_LIMIT_PER_HOUR:-5}');

      expect(composeContent).not.toMatch(/sk-[A-Za-z0-9_-]{16,}/);
    });
  });

  describe('3. Durable Database-Backed Idempotency & Rate Limiting Verification', () => {
    it('an idempotency key survives database query & service lookup without duplicate provider calls', async () => {
      const idempotencyKey = `durable_idem_${Date.now()}`;

      const res1 = await request(app)
        .post(`/api/opportunities/${testOpportunity.id}/ai-evaluations`)
        .set('x-test-role', 'ADMIN')
        .set('X-Thriveward-CSRF', '1')
        .set('X-Idempotency-Key', idempotencyKey);

      expect(res1.status).toBe(201);
      const eval1Id = res1.body.data.id;
      testCreatedEvalIds.add(eval1Id);

      // Verify stored in DB with idempotencyKey
      const dbRow = await prisma.aiEvaluation.findUnique({ where: { id: eval1Id } });
      expect(dbRow?.idempotencyKey).toBe(idempotencyKey);

      // Second call with same idempotency key retrieves existing row from DB
      const res2 = await request(app)
        .post(`/api/opportunities/${testOpportunity.id}/ai-evaluations`)
        .set('x-test-role', 'ADMIN')
        .set('X-Thriveward-CSRF', '1')
        .set('X-Idempotency-Key', idempotencyKey);

      expect(res2.status).toBe(201);
      expect(res2.body.data.id).toBe(eval1Id);
    });

    it('concurrent requests with same key trigger exactly 1 provider invocation', async () => {
      const idempotencyKey = `concurrent_idem_${Date.now()}`;

      const reqs = Array.from({ length: 4 }).map(() =>
        request(app)
          .post(`/api/opportunities/${testOpportunity.id}/ai-evaluations`)
          .set('x-test-role', 'ADMIN')
          .set('X-Thriveward-CSRF', '1')
          .set('X-Idempotency-Key', idempotencyKey)
      );

      const results = await Promise.all(reqs);
      results.forEach((r) => {
        expect(r.status).toBe(201);
        if (r.body?.data?.id) testCreatedEvalIds.add(r.body.data.id);
      });

      const ids = new Set(results.map((r) => r.body.data.id));
      expect(ids.size).toBe(1);
    });

    it('enforces 5 evaluations per hour per user rate limit and returns 429', async () => {
      let user = await prisma.user.findUnique({ where: { email: 'test.admin@projectthriveward.org' } });
      if (!user) {
        user = await prisma.user.create({
          data: {
            id: 'test-user-admin',
            email: 'test.admin@projectthriveward.org',
            displayName: 'Test Admin User',
            passwordHash: '$argon2id$',
            role: 'ADMIN',
            accountState: 'ACTIVE',
          },
        });
      }

      for (let i = 0; i < 5; i++) {
        const ev = await prisma.aiEvaluation.create({
          data: {
            opportunityId: testOpportunity.id,
            version: i + 1,
            alignmentScore: 80,
            eligibility: 'POSSIBLY_ELIGIBLE',
            summary: 'Test summary',
            strengths: [],
            risks: [],
            requirements: [],
            recommendedNextAction: 'Test action',
            confidence: 0.9,
            limitations: [],
            evidenceSnapshot: [],
            inputSnapshot: {},
            inputHash: 'hash',
            generatedByUserId: user!.id,
            createdAt: new Date(),
          },
        });
        testCreatedEvalIds.add(ev.id);
      }

      const res = await request(app)
        .post(`/api/opportunities/${testOpportunity.id}/ai-evaluations`)
        .set('x-test-role', 'ADMIN')
        .set('X-Thriveward-CSRF', '1');

      expect(res.status).toBe(429);
      expect(res.body.error).toContain('RATE_LIMIT_EXCEEDED');
      expect(res.body.error).toContain('hour');
    });

    it('AI rate limiter does not alter login endpoint functionality', async () => {
      const loginRes = await request(app)
        .post('/api/auth/login')
        .set('X-Thriveward-CSRF', '1')
        .send({ email: 'admin@projectthriveward.org', password: 'h3lloWorld!!' });

      expect(loginRes.status).toBe(200);
    });
  });

  describe('4. Server-Authoritative Input Snapshot & Validation Invariants', () => {
    it('rejects output citing unknown evidence reference IDs', () => {
      const invalidResult: any = {
        alignmentScore: 90,
        eligibility: 'POSSIBLY_ELIGIBLE',
        summary: 'Invalid citation test',
        strengths: [{ text: 'Invalid strength', evidenceRefs: ['UNKNOWN.CITATION.ID'] }],
        risks: [],
        requirements: [],
        recommendedNextAction: 'Action',
        confidence: 0.9,
        limitations: [],
      };

      const catalog = [{ id: 'OPP.title', category: 'OPPORTUNITY', label: 'Title', value: 'Val' }] as any;

      expect(() => EvidenceCatalogBuilder.validateEvidenceRefs(invalidResult, catalog)).toThrow(
        'Model output cited invalid evidence reference IDs: UNKNOWN.CITATION.ID'
      );
    });

    it('creating subsequent analysis increments version immutably (v1 -> v2)', async () => {
      const res1 = await request(app)
        .post(`/api/opportunities/${testOpportunity.id}/ai-evaluations`)
        .set('x-test-role', 'ADMIN')
        .set('X-Thriveward-CSRF', '1');

      expect(res1.status).toBe(201);
      testCreatedEvalIds.add(res1.body.data.id);
      const v1 = res1.body.data.version;

      const res2 = await request(app)
        .post(`/api/opportunities/${testOpportunity.id}/ai-evaluations`)
        .set('x-test-role', 'ADMIN')
        .set('X-Thriveward-CSRF', '1');

      expect(res2.status).toBe(201);
      testCreatedEvalIds.add(res2.body.data.id);
      const v2 = res2.body.data.version;
      expect(v2).toBe(v1 + 1);
    });
  });

  describe('5. Atomic Human Review, Security & Workflow Non-Advancement', () => {
    it('OPERATOR can submit human review approval with detailed reason', async () => {
      const genRes = await request(app)
        .post(`/api/opportunities/${testOpportunity.id}/ai-evaluations`)
        .set('x-test-role', 'ADMIN')
        .set('X-Thriveward-CSRF', '1');

      expect(genRes.status).toBe(201);
      const evalId = genRes.body.data.id;
      testCreatedEvalIds.add(evalId);

      const reviewRes = await request(app)
        .post(`/api/ai-evaluations/${evalId}/review`)
        .set('x-test-role', 'OPERATOR')
        .set('X-Thriveward-CSRF', '1')
        .send({
          decision: 'APPROVED',
          reason: 'Verified alignment score and risk assessments against official DOL grant guidelines.',
        });

      expect(reviewRes.status).toBe(200);
      expect(reviewRes.body.data.status).toBe('APPROVED');
      expect(reviewRes.body.data.reviewReason).toContain('Verified alignment score');
    });

    it('rejects human review without minimum 5 character reason', async () => {
      const genRes = await request(app)
        .post(`/api/opportunities/${testOpportunity.id}/ai-evaluations`)
        .set('x-test-role', 'ADMIN')
        .set('X-Thriveward-CSRF', '1');

      expect(genRes.status).toBe(201);
      const evalId = genRes.body.data.id;
      testCreatedEvalIds.add(evalId);

      const reviewRes = await request(app)
        .post(`/api/ai-evaluations/${evalId}/review`)
        .set('x-test-role', 'ADMIN')
        .set('X-Thriveward-CSRF', '1')
        .send({ decision: 'APPROVED', reason: '  ok ' });

      expect(reviewRes.status).toBe(400);
      expect(reviewRes.body.error).toContain('minimum 5 characters');
    });

    it('AI evaluation generation and approval DO NOT alter opportunity canonical status or advance workflow', async () => {
      const partner = await prisma.strategicPartnerCandidate.upsert({
        where: { id: 'test-partner-ca-600' },
        update: { status: 'RESEARCH_REQUIRED' },
        create: {
          id: 'test-partner-ca-600',
          name: 'Test CA-600 Partner',
          legalOrganizationName: 'Test CA-600 Partner',
          organizationType: 'CONTINUUM_OF_CARE',
          cocNumber: 'CA-600',
          websiteUrl: 'https://example.org',
          officialDirectoryUrl: 'https://example.org',
          geography: 'CA',
          countiesServed: ['Orange County'],
          collaborativeApplicantOrg: 'Test CA-600',
          leadAgency: 'Test CA-600',
          verifiedOfficialRole: 'CONFIRMED_COLLABORATIVE_APPLICANT',
          applicationCoordinatedEntryRole: 'CoC Collaborative Applicant',
          currentCycleParticipationInfo: 'Test',
          mission: 'Test',
          servicesOffered: ['CoC Competition'],
          collaborationFocus: 'Test',
          contactChannel: 'test@example.org',
          verificationStatus: 'VERIFIED_HUMAN_REVIEWED',
          isFixture: true,
          hasLiveVerification: true,
          status: 'RESEARCH_REQUIRED',
        },
      });

      expect(partner?.status).toBe('RESEARCH_REQUIRED');

      const genRes = await request(app)
        .post(`/api/opportunities/${testOpportunity.id}/ai-evaluations`)
        .set('x-test-role', 'ADMIN')
        .set('X-Thriveward-CSRF', '1');

      expect(genRes.status).toBe(201);
      const evalId = genRes.body.data.id;
      testCreatedEvalIds.add(evalId);

      await request(app)
        .post(`/api/ai-evaluations/${evalId}/review`)
        .set('x-test-role', 'ADMIN')
        .set('X-Thriveward-CSRF', '1')
        .send({ decision: 'APPROVED', reason: 'Human approval for testing' });

      // Re-query partner status
      const updatedPartner = await prisma.strategicPartnerCandidate.findFirst({
        where: { cocNumber: 'CA-600' },
      });

      expect(updatedPartner?.status).toBe('RESEARCH_REQUIRED');
    });
  });

  describe('6. UI Label Contract & Governance Verification', () => {
    it('verifies frontend App.tsx renders active phase label AI-1 • Structured AI Funding Analyst', () => {
      const appTsxPath = path.resolve(__dirname, '../../../web/src/App.tsx');
      const appContent = fs.readFileSync(appTsxPath, 'utf8');

      expect(appContent).toContain('AI-2A • Official Notice Ingestion & Citation Foundation');
      expect(appContent).not.toContain('Phase 1H • Secure Authentication, RBAC & Verified Human Attribution');

    });

    it('verifies frontend AiEvaluationPanel.tsx explicitly displays Model confidence', () => {
      const panelPath = path.resolve(__dirname, '../../../web/src/components/AiEvaluationPanel.tsx');
      const panelContent = fs.readFileSync(panelPath, 'utf8');

      expect(panelContent).toContain('Model confidence:');
      expect(panelContent).toContain('AI-GENERATED — HUMAN REVIEW REQUIRED');
      expect(panelContent).not.toContain('eligibility probability');
    });
  });
});
