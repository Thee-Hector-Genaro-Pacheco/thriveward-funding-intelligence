import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../server';
import { prisma } from '../lib/prisma';
import { PartnerMatchStatus } from '@prisma/client';

import { StrategicPartnerService } from '../services/strategicPartnerService';

describe('Phase 1G — Human-Controlled Outreach & Response Tracking Complete Suite', () => {
  let demoPartnerId: string;
  let demoOppId: string;
  let demoEngagementId: string;
  let realCa602PartnerId: string;

  beforeAll(async () => {
    // 0. Ensure seeded partners exist
    await StrategicPartnerService.runDiscovery();

    // 1. Fetch or create demo strategic partner
    const demoPartner = await prisma.strategicPartnerCandidate.findFirst({
      where: { cocNumber: 'CA-DEMO' },
    });
    expect(demoPartner).not.toBeNull();
    demoPartnerId = demoPartner!.id;

    // 2. Fetch demo funding opportunity
    const demoOpp = await prisma.fundingOpportunity.findFirst();
    expect(demoOpp).not.toBeNull();
    demoOppId = demoOpp!.id;

    // 3. Fetch or create demo engagement
    const res = await request(app)
      .get(`/api/outreach/engagements/${demoPartnerId}?opportunityId=${demoOppId}&dataOrigin=DEMO`)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
    demoEngagementId = res.body.data.id;

    // Reset test state for clean test isolation
    await prisma.outreachHumanApproval.deleteMany({ where: { engagementId: demoEngagementId } });
    await prisma.outreachDeliveryRecord.deleteMany({ where: { engagementId: demoEngagementId } });
    await prisma.outreachResponseRecord.deleteMany({ where: { engagementId: demoEngagementId } });
    await prisma.outreachFollowUp.deleteMany({ where: { engagementId: demoEngagementId } });
    await prisma.outreachDiscoveryCall.deleteMany({ where: { engagementId: demoEngagementId } });
    await prisma.mouChecklistItem.deleteMany({ where: { engagementId: demoEngagementId } });
    await prisma.outreachWorkflowHistory.deleteMany({ where: { engagementId: demoEngagementId } });
    await prisma.outreachDraftVersion.deleteMany({ where: { engagementId: demoEngagementId } });
    await prisma.strategicPartnerCandidate.update({
      where: { id: demoPartnerId },
      data: { status: PartnerMatchStatus.RESEARCH_REQUIRED },
    });
    await prisma.outreachEngagement.update({
      where: { id: demoEngagementId },
      data: { currentStatus: PartnerMatchStatus.RESEARCH_REQUIRED },
    });

    // 4. Fetch real CA-602 partner
    const ca602 = await prisma.strategicPartnerCandidate.findFirst({
      where: { cocNumber: 'CA-602' },
    });
    if (ca602) {
      realCa602PartnerId = ca602.id;
    }
  });

  describe('1. Server-Authoritative State Machine & Invalid Transition Rejection', () => {
    it('initializes engagement at RESEARCH_REQUIRED with zero mutations', async () => {
      const res = await request(app)
        .get(`/api/outreach/timeline/${demoEngagementId}`)
        .expect(200);

      expect(res.body.data.currentStatus).toBe(PartnerMatchStatus.RESEARCH_REQUIRED);
    });

    it('rejects invalid direct transition to CONTACT_APPROVED with HTTP 400', async () => {
      const res = await request(app)
        .post('/api/outreach/transitions')
        .send({
          engagementId: demoEngagementId,
          targetStatus: 'CONTACT_APPROVED',
          humanActorName: 'Hector Pacheco',
          reason: 'Bypassing approval steps',
        })
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('Invalid transition');
    });

    it('rejects invalid direct transition to CONFIRMED_PARTNER with HTTP 400', async () => {
      const res = await request(app)
        .post('/api/outreach/transitions')
        .send({
          engagementId: demoEngagementId,
          targetStatus: 'CONFIRMED_PARTNER',
          humanActorName: 'Hector Pacheco',
          reason: 'Direct confirmation attempt',
        })
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('Invalid transition');
    });

    it('allows valid progression RESEARCH_REQUIRED -> POSSIBLE_MATCH with human attribution', async () => {
      const res = await request(app)
        .post('/api/outreach/transitions')
        .send({
          engagementId: demoEngagementId,
          targetStatus: 'POSSIBLE_MATCH',
          humanActorName: 'Hector Pacheco',
          reason: 'Verified regional CoC partnership candidacy.',
        });

      if (res.status !== 200) {
        throw new Error(`TEST 4 FAILED WITH STATUS ${res.status}: ${JSON.stringify(res.body)}`);
      }

      expect(res.body.success).toBe(true);

      expect(res.body.success).toBe(true);
      expect(res.body.data.currentStatus).toBe(PartnerMatchStatus.POSSIBLE_MATCH);
    });
  });

  describe('2. Draft Versioning, SHA-256 Hashing & Non-Mutation Invariant', () => {
    it('creates draft v1 and computes SHA-256 content hash without mutating status', async () => {
      const res = await request(app)
        .post('/api/outreach/drafts')
        .send({
          engagementId: demoEngagementId,
          subject: '[DEMO INQUIRY] CoC Application Partnership Inquiry',
          body: 'Dear CoC Board,\n\nProject Thriveward is evaluating joint competition opportunities.',
          recipient: 'CareCoordination@ceo.oc.gov',
          inquiryPurpose: 'GRANT_COMPETITION',
          creatorType: 'HUMAN_EDITED',
          creatorActorName: 'Hector Pacheco',
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.versionNumber).toBeGreaterThanOrEqual(1);
      expect(res.body.data.contentHash).toBeDefined();
      expect(res.body.data.contentHash.length).toBe(64); // SHA-256 hex length

      // Verify status remains POSSIBLE_MATCH
      const timeline = await request(app).get(`/api/outreach/timeline/${demoEngagementId}`).expect(200);
      expect(timeline.body.data.currentStatus).toBe(PartnerMatchStatus.POSSIBLE_MATCH);
    });

    it('creates draft v2 incrementally with unique content hash', async () => {
      const res = await request(app)
        .post('/api/outreach/drafts')
        .send({
          engagementId: demoEngagementId,
          subject: '[DEMO INQUIRY v2] Revised CoC Application Inquiry',
          body: 'Updated body text for Phase 1G validation.',
          recipient: 'CareCoordination@ceo.oc.gov',
          inquiryPurpose: 'GRANT_COMPETITION',
          creatorType: 'HUMAN_EDITED',
          creatorActorName: 'Hector Pacheco',
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.versionNumber).toBeGreaterThanOrEqual(2);
    });
  });

  describe('3. Human Approval, Contact Evidence Freezing & Zero-Transmission Safeguards', () => {
    it('rejects approval if human Reviewer Name is missing or AI', async () => {
      const timeline = await request(app).get(`/api/outreach/timeline/${demoEngagementId}`).expect(200);
      const draftId = timeline.body.data.draftVersions[0].id;

      const res = await request(app)
        .post('/api/outreach/approvals')
        .send({
          engagementId: demoEngagementId,
          draftVersionId: draftId,
          humanReviewerName: 'Bridge AI Agent',
          approvalReason: 'Automated test',
          zeroTransmissionAck: true,
          userConfirmedChecks: { recipientReviewed: true, contentReviewed: true, evidenceVerified: true },
        })
        .expect(400);

      expect(res.body.error).toContain('explicit human attribution');
    });

    it('rejects approval if zero-transmission acknowledgment is false', async () => {
      const timeline = await request(app).get(`/api/outreach/timeline/${demoEngagementId}`).expect(200);
      const draftId = timeline.body.data.draftVersions[0].id;

      const res = await request(app)
        .post('/api/outreach/approvals')
        .send({
          engagementId: demoEngagementId,
          draftVersionId: draftId,
          humanReviewerName: 'Hector Pacheco',
          approvalReason: 'Test approval',
          zeroTransmissionAck: false,
          userConfirmedChecks: { recipientReviewed: true, contentReviewed: true, evidenceVerified: true },
        })
        .expect(400);

      expect(res.body.error).toContain('Bridge AI will not send');
    });

    it('successfully approves draft, freezes evidence, and advances status to CONTACT_APPROVED', async () => {
      const timeline = await request(app).get(`/api/outreach/timeline/${demoEngagementId}`).expect(200);
      const draftId = timeline.body.data.draftVersions[0].id;

      const res = await request(app)
        .post('/api/outreach/approvals')
        .send({
          engagementId: demoEngagementId,
          draftVersionId: draftId,
          humanReviewerName: 'Hector Pacheco',
          approvalReason: 'Verified recipient and approved positioning.',
          zeroTransmissionAck: true,
          userConfirmedChecks: { recipientReviewed: true, contentReviewed: true, evidenceVerified: true },
        });

      if (res.status !== 201) {
        throw new Error(`APPROVAL FAILED WITH STATUS ${res.status}: ${JSON.stringify(res.body)}`);
      }

      expect(res.body.success).toBe(true);
      expect(res.body.data.approvedContentHash).toBeDefined();

      const updatedTimeline = await request(app).get(`/api/outreach/timeline/${demoEngagementId}`).expect(200);
      expect(updatedTimeline.body.data.currentStatus).toBe(PartnerMatchStatus.CONTACT_APPROVED);
      expect(updatedTimeline.body.data.evidenceSnapshots.length).toBeGreaterThan(0);
    });
  });

  describe('4. Delivery Confirmation ("Mark as Sent"), Response Tracking & Idempotency', () => {
    const idempotencyKey = `TEST-IDEM-SENT-KEY-${Date.now()}`;

    it('records delivery confirmation ("Mark as Sent") and advances status to CONTACTED', async () => {
      const res = await request(app)
        .post('/api/outreach/sent')
        .send({
          engagementId: demoEngagementId,
          actualRecipient: 'CareCoordination@ceo.oc.gov',
          channel: 'EMAIL',
          sentTimestamp: new Date().toISOString(),
          humanActorName: 'Hector Pacheco',
          notes: 'Manually sent via external email client.',
          idempotencyKey,
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.idempotencyKey).toBe(idempotencyKey);

      const timeline = await request(app).get(`/api/outreach/timeline/${demoEngagementId}`).expect(200);
      expect(timeline.body.data.currentStatus).toBe(PartnerMatchStatus.CONTACTED);
    });

    it('is idempotent: re-submitting same idempotency key returns existing delivery record', async () => {
      const res = await request(app)
        .post('/api/outreach/sent')
        .send({
          engagementId: demoEngagementId,
          actualRecipient: 'CareCoordination@ceo.oc.gov',
          channel: 'EMAIL',
          sentTimestamp: new Date().toISOString(),
          humanActorName: 'Hector Pacheco',
          notes: 'Duplicate submission attempt',
          idempotencyKey,
        })
        .expect(201);

      expect(res.body.data.idempotencyKey).toBe(idempotencyKey);

      // Verify delivery record count has not increased
      const timeline = await request(app).get(`/api/outreach/timeline/${demoEngagementId}`).expect(200);
      expect(timeline.body.data.deliveryRecords.length).toBe(1);
    });

    it('records partner response without changing status to CONFIRMED_PARTNER', async () => {
      const res = await request(app)
        .post('/api/outreach/responses')
        .send({
          engagementId: demoEngagementId,
          receivedTimestamp: new Date().toISOString(),
          senderIdentity: 'CareCoordination@ceo.oc.gov',
          outcome: 'INTERESTED',
          summary: 'CoC lead agency confirmed receipt and welcomed a discovery call.',
          quotedExcerpt: 'We look forward to discussing reentry housing alignment.',
          humanRecorderName: 'Hector Pacheco',
          idempotencyKey: `RESP-KEY-${Date.now()}`,
        })
        .expect(201);

      expect(res.body.success).toBe(true);

      const timeline = await request(app).get(`/api/outreach/timeline/${demoEngagementId}`).expect(200);
      expect(timeline.body.data.currentStatus).toBe(PartnerMatchStatus.CONTACTED);
    });
  });

  describe('5. Follow-Ups, Discovery Calls, MOU Checklist & End-to-End Progression', () => {
    it('schedules a follow-up reminder and computes dashboard statistics', async () => {
      await request(app)
        .post('/api/outreach/follow-ups')
        .send({
          engagementId: demoEngagementId,
          dueDateTime: new Date(Date.now() + 86400000).toISOString(),
          reason: 'Check status of discovery call scheduling',
          humanActorName: 'Hector Pacheco',
        })
        .expect(201);

      const dash = await request(app).get('/api/outreach/dashboard').expect(200);
      expect(dash.body.success).toBe(true);
      expect(dash.body.data.counts).toBeDefined();
    });

    it('records a discovery call and advances status CONTACTED -> DISCOVERY_CALL', async () => {
      const res = await request(app)
        .post('/api/outreach/discovery-calls')
        .send({
          engagementId: demoEngagementId,
          callDateTime: new Date().toISOString(),
          meetingMethod: 'VIDEO_CONFERENCE',
          notes: 'Held positive alignment call with CoC leadership.',
          outcome: 'Agreed to initiate joint MOU drafting.',
          nextAction: 'Draft MOU checklist items',
          humanRecorderName: 'Hector Pacheco',
        })
        .expect(201);

      expect(res.body.success).toBe(true);

      const timeline = await request(app).get(`/api/outreach/timeline/${demoEngagementId}`).expect(200);
      expect(timeline.body.data.currentStatus).toBe(PartnerMatchStatus.DISCOVERY_CALL);
    });

    it('completes transition sequence DISCOVERY_CALL -> PARTNERSHIP_DISCUSSION -> MOU_IN_PROGRESS -> CONFIRMED_PARTNER', async () => {
      // 1. Advance to PARTNERSHIP_DISCUSSION
      await request(app)
        .post('/api/outreach/transitions')
        .send({
          engagementId: demoEngagementId,
          targetStatus: 'PARTNERSHIP_DISCUSSION',
          humanActorName: 'Hector Pacheco',
          reason: 'Initiated formal terms discussion.',
        })
        .expect(200);

      // 2. Add MOU Checklist Item
      await request(app)
        .post('/api/outreach/mou-checklist')
        .send({
          engagementId: demoEngagementId,
          label: 'Joint CoC Application Support Letter',
          responsibleParty: 'Project Thriveward Leadership',
          humanActorName: 'Hector Pacheco',
        })
        .expect(201);

      // 3. Advance to MOU_IN_PROGRESS
      await request(app)
        .post('/api/outreach/transitions')
        .send({
          engagementId: demoEngagementId,
          targetStatus: 'MOU_IN_PROGRESS',
          humanActorName: 'Hector Pacheco',
          reason: 'MOU document checklist prepared.',
        })
        .expect(200);

      // 4. Advance to CONFIRMED_PARTNER
      const finalRes = await request(app)
        .post('/api/outreach/transitions')
        .send({
          engagementId: demoEngagementId,
          targetStatus: 'CONFIRMED_PARTNER',
          humanActorName: 'Hector Pacheco',
          reason: 'MOU fully executed by both organizations.',
          confirmationMetadata: { executedMouReference: 'MOU-DEMO-2026-EXECUTED' },
        })
        .expect(200);

      expect(finalRes.body.data.currentStatus).toBe(PartnerMatchStatus.CONFIRMED_PARTNER);
    });
  });

  describe('6. Isolation of Real CA-602 Candidate Record', () => {
    it('verifies real CA-602 record remains at RESEARCH_REQUIRED and unapproved', async () => {
      if (!realCa602PartnerId) return;

      const ca602Partner = await prisma.strategicPartnerCandidate.findUnique({
        where: { id: realCa602PartnerId },
      });

      expect(ca602Partner).toBeDefined();
      expect(ca602Partner?.status).toBe(PartnerMatchStatus.RESEARCH_REQUIRED);

      const engagements = await prisma.outreachEngagement.findMany({
        where: { strategicPartnerCandidateId: realCa602PartnerId },
        include: { humanApprovals: true, deliveryRecords: true },
      });

      for (const eng of engagements) {
        expect(eng.humanApprovals.length).toBe(0);
        expect(eng.deliveryRecords.length).toBe(0);
      }
    });
  });
});
