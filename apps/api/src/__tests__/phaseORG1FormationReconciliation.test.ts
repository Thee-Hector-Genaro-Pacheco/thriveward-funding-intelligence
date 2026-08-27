import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../server';
import { prisma } from '../lib/prisma';

describe('Phase ORG-1 • Formation Evidence Reconciliation & Match Impact Preview', () => {
  let initialOrgState: {
    status: string;
    taxStatus: string;
    limitations: string[];
  } | null = null;

  let initialEnvVars: {
    AI_FUNDING_ANALYST_ENABLED?: string;
    AI_DOCUMENT_GROUNDING_ENABLED?: string;
    DOCUMENT_INGESTION_ENABLED?: string;
  } = {};

  let baselineAuditIds = new Set<string>();

  beforeAll(async () => {
    initialEnvVars = {
      AI_FUNDING_ANALYST_ENABLED: process.env.AI_FUNDING_ANALYST_ENABLED,
      AI_DOCUMENT_GROUNDING_ENABLED: process.env.AI_DOCUMENT_GROUNDING_ENABLED,
      DOCUMENT_INGESTION_ENABLED: process.env.DOCUMENT_INGESTION_ENABLED,
    };

    const org = await prisma.organizationProfile.findFirst({
      where: { name: 'Project Thriveward' },
    });

    if (org) {
      initialOrgState = {
        status: org.status,
        taxStatus: org.taxStatus,
        limitations: [...org.limitations],
      };
    }

    const baselineAudits = await prisma.securityAuditEvent.findMany({
      where: { eventType: 'ORGANIZATION_FORMATION_RECONCILED' },
      select: { id: true },
    });
    baselineAuditIds = new Set(baselineAudits.map((e) => e.id));
  });

  afterAll(async () => {
    // Delete ONLY audit events created during this test suite run
    const currentAudits = await prisma.securityAuditEvent.findMany({
      where: { eventType: 'ORGANIZATION_FORMATION_RECONCILED' },
      select: { id: true },
    });

    const suiteCreatedIds = currentAudits
      .map((e) => e.id)
      .filter((id) => !baselineAuditIds.has(id));

    if (suiteCreatedIds.length > 0) {
      await prisma.securityAuditEvent.deleteMany({
        where: { id: { in: suiteCreatedIds } },
      });
    }

    // Restore pre-existing OrganizationProfile state
    if (initialOrgState) {
      await prisma.organizationProfile.updateMany({
        where: { name: 'Project Thriveward' },
        data: {
          status: initialOrgState.status,
          taxStatus: initialOrgState.taxStatus,
          limitations: initialOrgState.limitations,
        },
      });
    }

    // Restore environment variables
    if (initialEnvVars.AI_FUNDING_ANALYST_ENABLED !== undefined) {
      process.env.AI_FUNDING_ANALYST_ENABLED = initialEnvVars.AI_FUNDING_ANALYST_ENABLED;
    } else {
      delete process.env.AI_FUNDING_ANALYST_ENABLED;
    }
    if (initialEnvVars.AI_DOCUMENT_GROUNDING_ENABLED !== undefined) {
      process.env.AI_DOCUMENT_GROUNDING_ENABLED = initialEnvVars.AI_DOCUMENT_GROUNDING_ENABLED;
    } else {
      delete process.env.AI_DOCUMENT_GROUNDING_ENABLED;
    }
    if (initialEnvVars.DOCUMENT_INGESTION_ENABLED !== undefined) {
      process.env.DOCUMENT_INGESTION_ENABLED = initialEnvVars.DOCUMENT_INGESTION_ENABLED;
    } else {
      delete process.env.DOCUMENT_INGESTION_ENABLED;
    }
  });

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
        limitations: [],
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

    it('enforces CSRF protection for mutating POST reconciliation requests', async () => {
      const res = await request(app)
        .post('/api/organization/reconcile-formation')
        .set('x-test-role', 'ADMIN')
        .set('x-test-reject-csrf', 'true')
        .send({ entityNumber: 'B20260372748' });

      expect(res.status).toBe(403);
      expect(res.body.error).toContain('CSRF');
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

    it('rejects missing or incorrect entity numbers with 400', async () => {
      // 1. Incorrect entity number
      const wrongRes = await request(app)
        .post('/api/organization/reconcile-formation')
        .set('x-test-role', 'ADMIN')
        .set('X-Thriveward-CSRF', '1')
        .send({ entityNumber: 'B99999999999' });

      expect(wrongRes.status).toBe(400);
      expect(wrongRes.body.error).toContain('B20260372748');

      // 2. Missing entity number
      const missingRes = await request(app)
        .post('/api/organization/reconcile-formation')
        .set('x-test-role', 'ADMIN')
        .set('X-Thriveward-CSRF', '1')
        .send({});

      expect(missingRes.status).toBe(400);
      expect(missingRes.body.error).toContain('B20260372748');
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
      expect(unverifiedStatuses.californiaAttorneyGeneralRegistration).toBe('NOT_REGISTERED');
      expect(unverifiedStatuses.taxStatus).toBe('NOT_OBTAINED');

      // Profile in DB is updated
      expect(organizationProfile.status).toBe('INCORPORATED');
      expect(organizationProfile.taxStatus).toBe('NOT_OBTAINED');
    });

    it('is strictly idempotent: repeated identical requests generate exactly one reconciliation audit event', async () => {
      const beforeAudits = await prisma.securityAuditEvent.findMany({
        where: { eventType: 'ORGANIZATION_FORMATION_RECONCILED' },
        select: { id: true },
      });
      const beforeAuditIds = new Set(beforeAudits.map((e) => e.id));

      // Call 1
      const res1 = await request(app)
        .post('/api/organization/reconcile-formation')
        .set('x-test-role', 'ADMIN')
        .set('X-Thriveward-CSRF', '1')
        .send({ entityNumber: 'B20260372748' });

      expect(res1.status).toBe(200);

      // Call 2
      const res2 = await request(app)
        .post('/api/organization/reconcile-formation')
        .set('x-test-role', 'ADMIN')
        .set('X-Thriveward-CSRF', '1')
        .send({ entityNumber: 'B20260372748' });

      expect(res2.status).toBe(200);
      expect(res2.body.data.alreadyReconciled).toBe(true);

      // Call 3
      const res3 = await request(app)
        .post('/api/organization/reconcile-formation')
        .set('x-test-role', 'ADMIN')
        .set('X-Thriveward-CSRF', '1')
        .send({ entityNumber: 'B20260372748' });

      expect(res3.status).toBe(200);
      expect(res3.body.data.alreadyReconciled).toBe(true);

      const afterAudits = await prisma.securityAuditEvent.findMany({
        where: { eventType: 'ORGANIZATION_FORMATION_RECONCILED' },
        select: { id: true },
      });

      const newAuditIds = afterAudits.map((e) => e.id).filter((id) => !beforeAuditIds.has(id));
      expect(newAuditIds.length).toBe(1);
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

  describe('3. Read-Only Match Impact Preview Engine & Blocker Isolation', () => {
    it('returns match impact preview comparing pre vs post incorporation profiles for all 14 opportunities', async () => {
      const res = await request(app)
        .get('/api/organization/match-impact-preview')
        .set('x-test-role', 'VIEWER');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.opportunityCount).toBeGreaterThanOrEqual(14);
      expect(res.body.data.previewResults.length).toBeGreaterThanOrEqual(14);

      // Verify both sides of comparison are present
      const item = res.body.data.previewResults[0];
      expect(item.previousFormationStatus).toBe('PRE_INCORPORATION');
      expect(item.updatedFormationStatus).toBe('INCORPORATED');
    });

    it('is completely read-only and performs zero database record mutations or workflow changes', async () => {
      const oppsBefore = await prisma.fundingOpportunity.findMany();
      const evalCountBefore = await prisma.aiEvaluation.count();
      const auditCountBefore = await prisma.securityAuditEvent.count();

      await request(app)
        .get('/api/organization/match-impact-preview')
        .set('x-test-role', 'ADMIN');

      const oppsAfter = await prisma.fundingOpportunity.findMany();
      const evalCountAfter = await prisma.aiEvaluation.count();
      const auditCountAfter = await prisma.securityAuditEvent.count();

      expect(oppsAfter.length).toBe(oppsBefore.length);
      expect(evalCountAfter).toBe(evalCountBefore);
      expect(auditCountAfter).toBe(auditCountBefore);

      // Verify no automatic qualification or locking of opportunity routing status occurred in DB
      for (let i = 0; i < oppsBefore.length; i++) {
        expect(oppsAfter[i].candidateRoutingStatus).toBe(oppsBefore[i].candidateRoutingStatus);
      }
    });

    it('enforces blocker isolation for Street Outreach Program: loses ONLY incorporation blocker', async () => {
      const res = await request(app)
        .get('/api/organization/match-impact-preview')
        .set('x-test-role', 'OPERATOR');

      const sopItem = res.body.data.previewResults.find((item: any) =>
        item.title.toLowerCase().includes('street outreach')
      );

      expect(sopItem).toBeDefined();

      // Resolved blocker: only legal entity status blocker
      expect(sopItem.changedBlockingReasons.length).toBe(1);
      expect(sopItem.changedBlockingReasons[0]).toContain('Legal entity status blocker resolved');

      // Remaining blockers: fiscal sponsor, SAM/UEI, Grants.gov, operating history remain strictly enforced
      expect(sopItem.remainingBlockingReasons).toContain('Fiscal sponsor required for immediate submission');
      expect(sopItem.remainingBlockingReasons).toContain('SAM.gov / UEI registration NOT_REGISTERED');
      expect(sopItem.remainingBlockingReasons).toContain('Grants.gov organization registration NOT_REGISTERED');

      // Recommended pathway remains FISCAL_SPONSOR_REQUIRED (no direct qualification)
      expect(sopItem.recommendedPathway).toBe('FISCAL_SPONSOR_REQUIRED');
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

    it('does not falsely promote any opportunity to CURRENTLY_ACTIONABLE without 501(c)(3) and SAM.gov/UEI evidence', async () => {
      const res = await request(app)
        .get('/api/organization/match-impact-preview')
        .set('x-test-role', 'ADMIN');

      const actionableOpps = res.body.data.previewResults.filter(
        (item: any) => item.updatedRoutingStatus === 'CURRENTLY_ACTIONABLE'
      );

      expect(actionableOpps.length).toBe(0);
    });
  });

  describe('4. Readiness Summary Endpoint & Unverified Fact Enforcement', () => {
    it('returns readiness summary asserting California AG and Grants.gov remain unverified', async () => {
      const res = await request(app)
        .get('/api/organization/readiness')
        .set('x-test-role', 'VIEWER');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.organizationName).toBe('Project Thriveward');
      expect(res.body.data.irs501c3Status).toBe('NOT_VERIFIED');
      expect(res.body.data.samGovUeiStatus).toBe('NOT_REGISTERED');
      expect(res.body.data.grantsGovStatus).toBe('NOT_REGISTERED');
      expect(res.body.data.californiaCharitableRegistration).toBe('NOT_REGISTERED');
      expect(res.body.data.noticeText).toContain('California incorporation has been verified');
    });
  });

  describe('5. Modal Stacking, Portal & Accessibility Contract', () => {
    it('verifies MatchImpactPreviewModal source includes React portal, high z-index backdrop, scroll locking, and dialog accessibility attributes', async () => {
      const fs = await import('fs');
      const path = await import('path');
      const modalPath = path.resolve(__dirname, '../../../web/src/components/MatchImpactPreviewModal.tsx');
      const content = fs.readFileSync(modalPath, 'utf-8');

      expect(content).toContain('createPortal(');
      expect(content).toContain('document.body');
      expect(content).toContain("overflow = 'hidden'");
      expect(content).toContain('role="dialog"');
      expect(content).toContain('aria-modal="true"');
      expect(content).toContain('aria-labelledby="match-impact-title"');
      expect(content).toContain("e.key === 'Escape'");
      expect(content).toContain('zIndex: 99999');
    });

    it('verifies global header and footer display ORG-1 phase badges', async () => {
      const fs = await import('fs');
      const path = await import('path');
      const appPath = path.resolve(__dirname, '../../../web/src/App.tsx');
      const content = fs.readFileSync(appPath, 'utf-8');

      expect(content).toContain('ORG-1 • FORMATION EVIDENCE & MATCH IMPACT PREVIEW');
      expect(content).toContain('Thriveward Funding Intelligence Platform • ORG-1 • Formation Evidence & Match Impact Preview • Project Thriveward');
    });

    it('verifies OrganizationReadinessCard renders AG registration, evidence dates, and 14 Stored Candidates terminology', async () => {
      const fs = await import('fs');
      const path = await import('path');
      const cardPath = path.resolve(__dirname, '../../../web/src/components/OrganizationReadinessCard.tsx');
      const content = fs.readFileSync(cardPath, 'utf-8');

      expect(content).toContain('California AG Charitable Reg.');
      expect(content).toContain('Articles Filed:</strong> August 15, 2026');
      expect(content).toContain('Filing Approval Acknowledged:</strong> August 17, 2026');
      expect(content).toContain('Match Impact Preview (14 Stored Candidates)');
    });

    it('verifies MatchImpactPreviewModal renders separate sections for 11 official notices and 3 demo fixtures', async () => {
      const fs = await import('fs');
      const path = await import('path');
      const modalPath = path.resolve(__dirname, '../../../web/src/components/MatchImpactPreviewModal.tsx');
      const content = fs.readFileSync(modalPath, 'utf-8');

      expect(content).toContain('Official Notice Candidates');
      expect(content).toContain('Demo & Test Fixtures');
      expect(content).toContain('EXCLUDED FROM LIVE OPPORTUNITY FEED');
      expect(content).toContain('40% — FISCAL_SPONSOR_REQUIRED');
    });
  });
});
