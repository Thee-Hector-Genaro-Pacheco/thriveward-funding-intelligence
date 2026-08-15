import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../server';
import { prisma } from '../lib/prisma';
import { StrategicPartnerService } from '../services/strategicPartnerService';
import { PartnerMatchStatus } from '@prisma/client';

describe('Phase 1G — CA-600 Workflow Status Source-of-Truth Reconciliation', () => {
  let ca600Id: string;
  let ca602Id: string;

  beforeAll(async () => {
    // 1. Ensure seeded partners exist & legacy statuses are reconciled
    await StrategicPartnerService.runDiscovery();
    await StrategicPartnerService.reconcileLegacyStatuses();

    const ca600 = await prisma.strategicPartnerCandidate.findFirst({
      where: { cocNumber: 'CA-600' },
    });
    ca600Id = ca600!.id;

    const ca602 = await prisma.strategicPartnerCandidate.findFirst({
      where: { cocNumber: 'CA-602' },
    });
    ca602Id = ca602!.id;
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

      // Check Outreach Workspace engagement endpoint
      const engRes = await request(app)
        .get(`/api/outreach/engagements/${ca600Id}`)
        .expect(200);

      expect(engRes.body.data.currentStatus).toBe('RESEARCH_REQUIRED');
    });

    it('reconciles legacy POSSIBLE_MATCH without human history to RESEARCH_REQUIRED', async () => {
      const ca600 = await prisma.strategicPartnerCandidate.findUnique({
        where: { id: ca600Id },
        include: { opportunityMatches: true, engagements: { include: { workflowHistory: true } } },
      });

      expect(ca600?.status).toBe(PartnerMatchStatus.RESEARCH_REQUIRED);
      expect(ca600?.opportunityMatches.every((m) => m.status === PartnerMatchStatus.RESEARCH_REQUIRED)).toBe(true);

      // Verify no human attribution was fabricated
      const allHistory = (ca600?.engagements || []).flatMap((e) => e.workflowHistory);
      const hasHumanActor = allHistory.some((h) => h.humanActorName !== 'System Data Repair Service' && !h.humanActorName.includes('System'));
      expect(hasHumanActor).toBe(false);

      // Verify system repair record exists
      const repairEvent = allHistory.find((h) => h.humanActorName === 'System Data Repair Service');
      expect(repairEvent).toBeDefined();
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

  describe('2. Atomic Human Transitions and Discovery Invariants', () => {
    it('failed status transition produces zero database mutations', async () => {
      const engRes = await request(app)
        .get(`/api/outreach/engagements/${ca600Id}`)
        .expect(200);
      const engagementId = engRes.body.data.id;

      const historyBefore = await prisma.outreachWorkflowHistory.count({ where: { engagementId } });

      // Attempt invalid direct transition from RESEARCH_REQUIRED to CONTACT_APPROVED without draft approval
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
      // Re-run discovery
      await StrategicPartnerService.runDiscovery();

      // Verify CA-600 canonical status is still RESEARCH_REQUIRED
      const listRes = await request(app)
        .get('/api/strategic-partners')
        .expect(200);

      const ca600Card = listRes.body.data.find((p: any) => p.cocNumber === 'CA-600');
      expect(ca600Card.canonicalStatus).toBe('RESEARCH_REQUIRED');
    });
  });
});
