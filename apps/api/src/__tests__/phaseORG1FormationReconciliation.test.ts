import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../server';
import { prisma } from '../lib/prisma';

describe('Phase ORG-1 • Formation Evidence Reconciliation & Match Impact Preview', () => {
  beforeEach(async () => {
    process.env.AI_FUNDING_ANALYST_ENABLED = 'false';
    process.env.AI_DOCUMENT_GROUNDING_ENABLED = 'false';
    process.env.DOCUMENT_INGESTION_ENABLED = 'false';

    // Reset organization profile status if previously modified in test run
    await prisma.organizationProfile.updateMany({
      where: { name: 'Project Thriveward' },
      data: {
        status: 'PRE_INCORPORATION',
        taxStatus: 'NOT_OBTAINED',
      },
    });
  });

  describe('1. Authentication & Role Safeguards', () => {
    it('rejects unauthenticated formation reconciliation requests with 401', async () => {
      const res = await request(app)
        .post('/api/organization/reconcile-formation')
        .set('x-test-unauthenticated', 'true')
        .send({ entityNumber: 'B20260372748' });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('rejects non-ADMIN roles (e.g. VIEWER or OPERATOR) with 403', async () => {
      const viewerRes = await request(app)
        .post('/api/organization/reconcile-formation')
        .set('x-test-role', 'VIEWER')
        .set('X-Thriveward-CSRF', '1')
        .send({ entityNumber: 'B20260372748' });

      expect(viewerRes.status).toBe(403);
      expect(viewerRes.body.success).toBe(false);

      const opRes = await request(app)
        .post('/api/organization/reconcile-formation')
        .set('x-test-role', 'OPERATOR')
        .set('X-Thriveward-CSRF', '1')
        .send({ entityNumber: 'B20260372748' });

      expect(opRes.status).toBe(403);
      expect(opRes.body.success).toBe(false);
    });

    it('rejects client-supplied actor identity fields with 400', async () => {
      const res = await request(app)
        .post('/api/organization/reconcile-formation')
        .set('x-test-role', 'ADMIN')
        .set('X-Thriveward-CSRF', '1')
        .send({
          entityNumber: 'B20260372748',
          actorUserId: 'fake-user-id',
          humanActorName: 'Spoofed Actor',
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Client-supplied actor identity is rejected');
    });

    it('rejects invalid or missing California entity numbers', async () => {
      const res = await request(app)
        .post('/api/organization/reconcile-formation')
        .set('x-test-role', 'ADMIN')
        .set('X-Thriveward-CSRF', '1')
        .send({ entityNumber: 'WRONG_NUMBER' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('B20260372748');
    });
  });

  describe('2. Verified vs Unverified Formation Facts & Idempotency', () => {
    it('successfully reconciles formation evidence for ADMIN role', async () => {
      const res = await request(app)
        .post('/api/organization/reconcile-formation')
        .set('x-test-role', 'ADMIN')
        .set('X-Thriveward-CSRF', '1')
        .send({ entityNumber: 'B20260372748' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const { verifiedFacts, unverifiedStatuses, organizationProfile } = res.body.data;

      // Verified facts
      expect(verifiedFacts.legalOrganizationName).toBe('Project Thriveward');
      expect(verifiedFacts.californiaEntityNumber).toBe('B20260372748');
      expect(verifiedFacts.formationJurisdiction).toBe('California');
      expect(verifiedFacts.entityType).toBe('California Nonprofit Public Benefit Corporation');
      expect(verifiedFacts.formationStatus).toBe('INCORPORATED');

      // Unverified facts remain explicit
      expect(unverifiedStatuses.irs501c3).toBe('NOT_VERIFIED');
      expect(unverifiedStatuses.irsEin).toBe('NOT_OBTAINED');
      expect(unverifiedStatuses.samGovUeiRegistration).toBe('NOT_REGISTERED');
      expect(unverifiedStatuses.grantsGovRegistration).toBe('NOT_REGISTERED');
      expect(unverifiedStatuses.taxStatus).toBe('NOT_OBTAINED');

      // Profile in DB is updated
      expect(organizationProfile.status).toBe('INCORPORATED');
      expect(organizationProfile.taxStatus).toBe('NOT_OBTAINED');
    });

    it('is idempotent: repeated reconciliation creates zero duplicate audit events', async () => {
      // First call
      const res1 = await request(app)
        .post('/api/organization/reconcile-formation')
        .set('x-test-role', 'ADMIN')
        .set('X-Thriveward-CSRF', '1')
        .send({ entityNumber: 'B20260372748' });

      expect(res1.status).toBe(200);
      expect(res1.body.data.alreadyReconciled).toBe(false);

      const auditCountAfterFirst = await prisma.securityAuditEvent.count({
        where: { eventType: 'ORGANIZATION_FORMATION_RECONCILED' },
      });

      // Second call (identical)
      const res2 = await request(app)
        .post('/api/organization/reconcile-formation')
        .set('x-test-role', 'ADMIN')
        .set('X-Thriveward-CSRF', '1')
        .send({ entityNumber: 'B20260372748' });

      expect(res2.status).toBe(200);
      expect(res2.body.data.alreadyReconciled).toBe(true);

      const auditCountAfterSecond = await prisma.securityAuditEvent.count({
        where: { eventType: 'ORGANIZATION_FORMATION_RECONCILED' },
      });

      expect(auditCountAfterSecond).toBe(auditCountAfterFirst);
    });

    it('records security audit event with ORGANIZATION_FORMATION_RECONCILED semantics', async () => {
      await request(app)
        .post('/api/organization/reconcile-formation')
        .set('x-test-role', 'ADMIN')
        .set('X-Thriveward-CSRF', '1')
        .send({ entityNumber: 'B20260372748' });

      const auditEvent = await prisma.securityAuditEvent.findFirst({
        where: { eventType: 'ORGANIZATION_FORMATION_RECONCILED' },
        orderBy: { timestamp: 'desc' },
      });

      expect(auditEvent).toBeDefined();
      expect(auditEvent!.details).toContain('B20260372748');
      expect(auditEvent!.details).toContain('INCORPORATED');
    });
  });

  describe('3. Read-Only Match Impact Preview Engine', () => {
    it('returns match impact preview for all 14 opportunities via GET', async () => {
      const res = await request(app)
        .get('/api/organization/match-impact-preview')
        .set('x-test-role', 'VIEWER');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.opportunityCount).toBeGreaterThanOrEqual(14);
      expect(res.body.data.previewResults.length).toBeGreaterThanOrEqual(14);

      // Verify Street Outreach Program preview item
      const sopItem = res.body.data.previewResults.find((item: any) =>
        item.title.toLowerCase().includes('street outreach')
      );
      expect(sopItem).toBeDefined();
      expect(sopItem.previousEligibilityClassification).toBe('FISCAL_SPONSOR_REQUIRED');
      expect(sopItem.previewEligibilityClassification).toBe('FISCAL_SPONSOR_REQUIRED');
      expect(sopItem.changedBlockingReasons.length).toBeGreaterThan(0);
      expect(sopItem.remainingBlockingReasons.length).toBeGreaterThan(0);
      expect(sopItem.recommendedPathway).toBe('FISCAL_SPONSOR_REQUIRED');
    });

    it('is completely read-only and performs zero database record mutations', async () => {
      const oppCountBefore = await prisma.fundingOpportunity.count();
      const evalCountBefore = await prisma.aiEvaluation.count();
      const auditCountBefore = await prisma.securityAuditEvent.count();

      await request(app)
        .get('/api/organization/match-impact-preview')
        .set('x-test-role', 'ADMIN');

      const oppCountAfter = await prisma.fundingOpportunity.count();
      const evalCountAfter = await prisma.aiEvaluation.count();
      const auditCountAfter = await prisma.securityAuditEvent.count();

      expect(oppCountAfter).toBe(oppCountBefore);
      expect(evalCountAfter).toBe(evalCountBefore);
      expect(auditCountAfter).toBe(auditCountBefore);
    });

    it('preserves protected invariants for CA-600, CA-602, and CA-DEMO', async () => {
      const res = await request(app)
        .get('/api/organization/match-impact-preview')
        .set('x-test-role', 'OPERATOR');

      const items = res.body.data.previewResults;

      // CA-600 / EE-0026
      const ca600 = items.find((i: any) => i.fundingOpportunityNumber.includes('HHS-2026-ACF-OCS-EE-0026'));
      if (ca600) {
        expect(ca600.recommendedPathway).toBe('FISCAL_SPONSOR_REQUIRED');
      }

      // CA-602 / CoC
      const ca602 = items.find((i: any) => i.fundingOpportunityNumber.includes('CPD-2600-DC-0025'));
      if (ca602) {
        expect(ca602.recommendedPathway).toBe('PARTNERSHIP_REQUIRED');
      }

      // CA-DEMO
      const demoItem = items.find((i: any) => i.opportunityId === 'demo-opp-001');
      expect(demoItem).toBeDefined();
      expect(demoItem.isDemo).toBe(true);
    });
  });

  describe('4. Readiness Summary Endpoint', () => {
    it('returns readiness summary for authenticated users', async () => {
      const res = await request(app)
        .get('/api/organization/readiness')
        .set('x-test-role', 'VIEWER');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.organizationName).toBe('Project Thriveward');
      expect(res.body.data.irs501c3Status).toBe('NOT_VERIFIED');
      expect(res.body.data.samGovUeiStatus).toBe('NOT_REGISTERED');
      expect(res.body.data.noticeText).toContain('California incorporation has been verified');
    });
  });
});
