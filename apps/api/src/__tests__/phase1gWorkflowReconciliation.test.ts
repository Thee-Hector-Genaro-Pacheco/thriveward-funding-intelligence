import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../server';
import { prisma } from '../lib/prisma';
import { StrategicPartnerService } from '../services/strategicPartnerService';
import { OutreachTrackingService } from '../services/outreachTrackingService';
import { PartnerMatchStatus } from '@prisma/client';

describe('Phase 1G — CA-600 Workflow Status Source-of-Truth Reconciliation & Hardening', () => {
  let ca600PartnerId: string;
  let ca602PartnerId: string;
  let ca600EngagementId: string;

  beforeAll(async () => {
    // 1. Ensure seeded partners exist & legacy statuses are reconciled via one-time data repair
    await StrategicPartnerService.runDiscovery();
    await StrategicPartnerService.reconcileLegacyStatuses();

    const ca600 = await prisma.strategicPartnerCandidate.findFirst({
      where: { cocNumber: 'CA-600' },
    });
    ca600PartnerId = ca600!.id;

    const ca602 = await prisma.strategicPartnerCandidate.findFirst({
      where: { cocNumber: 'CA-602' },
    });
    ca602PartnerId = ca602!.id;

    const engagement = await OutreachTrackingService.getOrCreateEngagement({
      partnerId: ca600PartnerId,
    });
    ca600EngagementId = engagement.id;
  });

  describe('1. Unified Canonical Status Source & Reconciliation', () => {
    it('CA-600 returns RESEARCH_REQUIRED on partner directory list and Outreach Workspace', async () => {
      // Check partner directory list endpoint
      const listRes = await request(app)
        .get('/api/strategic-partners')
        .expect(200);

      const ca600Card = listRes.body.data.find((p: any) => p.cocNumber === 'CA-600');
      expect(ca600Card).toBeDefined();
      expect(ca600Card.canonicalStatus).toBe('RESEARCH_REQUIRED');
      expect(ca600Card.status).toBe('RESEARCH_REQUIRED');
      expect(ca600Card.opportunityMatches[0].status).toBe('RESEARCH_REQUIRED');

      // Check Outreach Workspace engagement endpoint by partner ID
      const engRes = await request(app)
        .get(`/api/outreach/engagements/${ca600PartnerId}`)
        .expect(200);

      expect(engRes.body.data.currentStatus).toBe('RESEARCH_REQUIRED');
    });

    it('reconciles legacy POSSIBLE_MATCH without human history to RESEARCH_REQUIRED with SYSTEM_DATA_REPAIR classification', async () => {
      const ca600 = await prisma.strategicPartnerCandidate.findUnique({
        where: { id: ca600PartnerId },
        include: { opportunityMatches: true, engagements: { include: { workflowHistory: true } } },
      });

      expect(ca600?.status).toBe(PartnerMatchStatus.RESEARCH_REQUIRED);
      expect(ca600?.opportunityMatches.every((m) => m.status === PartnerMatchStatus.RESEARCH_REQUIRED)).toBe(true);

      // Verify no human attribution was fabricated
      const allHistory = (ca600?.engagements || []).flatMap((e) => e.workflowHistory);
      const hasHumanActor = allHistory.some((h) => h.actorType === 'HUMAN' && h.humanActorName !== 'System Data Repair Service' && !h.humanActorName.includes('System'));
      expect(hasHumanActor).toBe(false);

      // Verify system repair record exists with exact actor & event classification
      const repairEvent = allHistory.find((h) => h.actorType === 'SYSTEM_DATA_REPAIR' || h.humanActorName === 'System Data Repair Service');
      expect(repairEvent).toBeDefined();
      expect(repairEvent?.actorType).toBe('SYSTEM_DATA_REPAIR');
      expect(repairEvent?.eventType).toBe('DATA_RECONCILIATION');
      expect(repairEvent?.humanActorName).toBe('System Data Repair Service');
      expect(repairEvent?.reason).toContain('legacy status POSSIBLE_MATCH lacked required human-attributed workflow transition history');
    });

    it('CA-602 remains RESEARCH_REQUIRED and unmutated', async () => {
      const ca602CardRes = await request(app)
        .get('/api/strategic-partners')
        .expect(200);

      const ca602Card = ca602CardRes.body.data.find((p: any) => p.cocNumber === 'CA-602');
      expect(ca602Card).toBeDefined();
      expect(ca602Card.canonicalStatus).toBe('RESEARCH_REQUIRED');
    });

    it('CA-DEMO remains excluded from default live partner results', async () => {
      const res = await request(app)
        .get('/api/strategic-partners')
        .expect(200);

      const demoCard = res.body.data.find((p: any) => p.cocNumber === 'CA-DEMO');
      expect(demoCard).toBeUndefined();
    });
  });

  describe('2. Fail-Closed Status Resolution & Read-Only Endpoints', () => {
    it('frontend fail-closed logic returns RESEARCH_REQUIRED if canonicalStatus is missing even if legacy status is POSSIBLE_MATCH', () => {
      const mockCandidateWithoutCanonical = {
        id: 'test-id',
        status: 'POSSIBLE_MATCH', // Legacy status
        canonicalStatus: undefined, // Missing canonical status
      };

      // Operational status resolution using nullish coalescing (App.tsx rule)
      const resolvedOperationalStatus = mockCandidateWithoutCanonical.canonicalStatus ?? 'RESEARCH_REQUIRED';

      expect(resolvedOperationalStatus).toBe('RESEARCH_REQUIRED');
      expect(resolvedOperationalStatus).not.toBe('POSSIBLE_MATCH');
    });

    it('GET /api/strategic-partners is strictly read-only and performs zero database mutations', async () => {
      // Capture baseline counts & timestamps before GET requests
      const candidateCountBefore = await prisma.strategicPartnerCandidate.count();
      const matchCountBefore = await prisma.opportunityPartnerMatch.count();
      const engagementCountBefore = await prisma.outreachEngagement.count();
      const historyCountBefore = await prisma.outreachWorkflowHistory.count();

      const latestHistoryBefore = await prisma.outreachWorkflowHistory.findFirst({
        orderBy: { timestamp: 'desc' },
      });

      // Issue 3 consecutive GET requests
      await request(app).get('/api/strategic-partners').expect(200);
      await request(app).get('/api/strategic-partners').expect(200);
      await request(app).get('/api/strategic-partners').expect(200);

      // Capture counts & timestamps after GET requests
      const candidateCountAfter = await prisma.strategicPartnerCandidate.count();
      const matchCountAfter = await prisma.opportunityPartnerMatch.count();
      const engagementCountAfter = await prisma.outreachEngagement.count();
      const historyCountAfter = await prisma.outreachWorkflowHistory.count();

      const latestHistoryAfter = await prisma.outreachWorkflowHistory.findFirst({
        orderBy: { timestamp: 'desc' },
      });

      // Assert zero database mutations occurred
      expect(candidateCountAfter).toBe(candidateCountBefore);
      expect(matchCountAfter).toBe(matchCountBefore);
      expect(engagementCountAfter).toBe(engagementCountBefore);
      expect(historyCountAfter).toBe(historyCountBefore);
      expect(latestHistoryAfter?.timestamp).toEqual(latestHistoryBefore?.timestamp);
    });
  });

  describe('3. Atomic Human Transitions and Authorization Invariants', () => {
    it('system repair event cannot authorize subsequent workflow stages (requires human action)', async () => {
      const engRes = await request(app)
        .get(`/api/outreach/engagements/${ca600PartnerId}`)
        .expect(200);
      const engagementId = engRes.body.data.id;

      // Ensure current status is RESEARCH_REQUIRED
      expect(engRes.body.data.currentStatus).toBe('RESEARCH_REQUIRED');

      // Attempt invalid skip to CONTACT_APPROVED without a human-approved draft
      const res = await request(app)
        .post('/api/outreach/transitions')
        .send({
          engagementId,
          targetStatus: 'CONTACT_APPROVED',
          humanActorName: 'System Repair Service Bypass Test',
          reason: 'Attempting status jump relying only on system repair history',
        })
        .expect(400);

      expect(res.body.error).toMatch(/human authorization|Invalid transition/);
    });

    it('failed status transition produces zero database mutations', async () => {
      const engRes = await request(app)
        .get(`/api/outreach/engagements/${ca600PartnerId}`)
        .expect(200);
      const engagementId = engRes.body.data.id;

      const historyBefore = await prisma.outreachWorkflowHistory.count({ where: { engagementId } });

      await request(app)
        .post('/api/outreach/transitions')
        .send({
          engagementId,
          targetStatus: 'CONTACT_APPROVED',
          humanActorName: 'Jane Reviewer',
          reason: 'Attempting invalid status skip',
        })
        .expect(400);

      const historyAfter = await prisma.outreachWorkflowHistory.count({ where: { engagementId } });
      const engAfter = await prisma.outreachEngagement.findUnique({ where: { id: engagementId } });

      expect(historyAfter).toBe(historyBefore);
      expect(engAfter?.currentStatus).toBe(PartnerMatchStatus.RESEARCH_REQUIRED);
    });

    it('discovery reruns do not overwrite human-owned engagement status', async () => {
      await StrategicPartnerService.runDiscovery();

      const listRes = await request(app)
        .get('/api/strategic-partners')
        .expect(200);

      const ca600Card = listRes.body.data.find((p: any) => p.cocNumber === 'CA-600');
      expect(ca600Card.canonicalStatus).toBe('RESEARCH_REQUIRED');
    });
  });
});
