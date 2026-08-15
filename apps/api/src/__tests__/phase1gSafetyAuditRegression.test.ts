import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../server';
import { prisma } from '../lib/prisma';
import { mapScoreToRelevanceStatus, formatRelevanceStatusLabel } from '@bridge-ai/shared';
import { StrategicPartnerService } from '../services/strategicPartnerService';
import { PartnerMatchStatus, OpportunityStatus, PursuitStage } from '@prisma/client';

describe('Phase 1G — Safety Audit & Regression Complete Test Suite', () => {
  let demoPartnerId: string;
  let demoOppId: string;
  let demoEngagementId: string;

  beforeAll(async () => {
    // 1. Fetch or ensure seeded partners
    await StrategicPartnerService.runDiscovery();

    // 2. Locate or create DEMO candidate and opportunity
    const demoPartner = await prisma.strategicPartnerCandidate.findFirst({
      where: { cocNumber: 'CA-DEMO' },
    });

    if (demoPartner) {
      demoPartnerId = demoPartner.id;
    } else {
      const created = await prisma.strategicPartnerCandidate.create({
        data: {
          name: '[DEMO WORKFLOW] Southern California Regional CoC Alliance (DEMO ONLY)',
          organizationType: 'CONTINUUM_OF_CARE',
          cocNumber: 'CA-DEMO',
          websiteUrl: 'https://demo.coc-alliance.org',
          geography: 'Orange County & Los Angeles County',
          countiesServed: ['Orange County', 'Los Angeles County'],
          collaborativeApplicantOrg: 'Southern California Regional CoC Alliance (DEMO)',
          verifiedOfficialRole: 'DEMO_COLLABORATIVE_APPLICANT',
          mission: 'DEMO ONLY - Test workflow candidate',
          servicesOffered: ['DEMO_SERVICE'],
          collaborationFocus: 'DEMO_FOCUS',
          contactChannel: 'CareCoordination@ceo.oc.gov',
          verificationStatus: 'DEMO_WORKFLOW',
          isFixture: true,
          hasLiveVerification: false,
        },
      });
      demoPartnerId = created.id;
    }

    const demoOpp = await prisma.fundingOpportunity.findFirst({
      where: { isDemo: true },
    });

    if (demoOpp) {
      demoOppId = demoOpp.id;
    } else {
      const opp = await prisma.fundingOpportunity.create({
        data: {
          fundingOpportunityNumber: 'DEMO-NOFO-2026-001',
          title: '[DEMO] Regional Care Coordination Grant',
          fundingAgency: 'U.S. Department of Housing and Urban Development',
          geography: 'California',
          description: 'Demo opportunity for Phase 1G test workflow isolation',
          sourceUrl: 'https://www.grants.gov/demo-2026',
          status: OpportunityStatus.VERIFIED,
          isDemo: true,
          pursuitStage: PursuitStage.NEW,
        },
      });
      demoOppId = opp.id;
    }

    // Fetch demo engagement
    const res = await request(app)
      .get(`/api/outreach/engagements/${demoPartnerId}?opportunityId=${demoOppId}&dataOrigin=DEMO`)
      .expect(200);

    demoEngagementId = res.body.data.id;

    // Reset test isolation state for DEMO engagement
    await prisma.outreachHumanApproval.deleteMany({ where: { engagementId: demoEngagementId } });
    await prisma.outreachDeliveryRecord.deleteMany({ where: { engagementId: demoEngagementId } });
    await prisma.outreachResponseRecord.deleteMany({ where: { engagementId: demoEngagementId } });
    await prisma.outreachFollowUp.deleteMany({ where: { engagementId: demoEngagementId } });
    await prisma.outreachDiscoveryCall.deleteMany({ where: { engagementId: demoEngagementId } });
    await prisma.mouChecklistItem.deleteMany({ where: { engagementId: demoEngagementId } });
    await prisma.outreachWorkflowHistory.deleteMany({ where: { engagementId: demoEngagementId } });
    await prisma.outreachDraftVersion.deleteMany({ where: { engagementId: demoEngagementId } });
    await prisma.outreachEngagement.update({
      where: { id: demoEngagementId },
      data: { currentStatus: PartnerMatchStatus.POSSIBLE_MATCH },
    });
  });

  describe('1. CA-DEMO API and Service Isolation', () => {
    it('normal partner directory endpoint excludes CA-DEMO records by default', async () => {
      const res = await request(app)
        .get('/api/strategic-partners')
        .expect(200);

      expect(res.body.success).toBe(true);
      const partners = res.body.data;
      const hasDemo = partners.some((p: any) => p.cocNumber === 'CA-DEMO' || (p.name || '').includes('DEMO ONLY'));
      expect(hasDemo).toBe(false);
    });

    it('follow-up dashboard excludes DEMO engagements by default', async () => {
      const res = await request(app)
        .get('/api/outreach/dashboard')
        .expect(200);

      expect(res.body.success).toBe(true);
      const data = res.body.data;
      const demoInRecentlyContacted = data.recentlyContacted?.some((e: any) => e.dataOrigin === 'DEMO');
      expect(demoInRecentlyContacted).toBe(false);
    });

    it('production mode rejects includeDemo=true with HTTP 400', async () => {
      const originalEnv = process.env.NODE_ENV;
      try {
        process.env.NODE_ENV = 'production';

        const partnerRes = await request(app)
          .get('/api/strategic-partners?includeDemo=true')
          .expect(400);

        expect(partnerRes.body.error).toContain('Production environment cannot expose demo data');

        const dashboardRes = await request(app)
          .get('/api/outreach/dashboard?includeDemo=true')
          .expect(400);

        expect(dashboardRes.body.error).toContain('Production environment cannot expose demo data');
      } finally {
        process.env.NODE_ENV = originalEnv;
      }
    });
  });

  describe('2. Unresolved-Placeholder Approval Blocking Safeguard', () => {
    it('rejects approval of a draft containing [ADD VERIFIED PROJECT THRIVEWARD EMAIL] with HTTP 400 UNRESOLVED_PLACEHOLDER and 0 mutations', async () => {
      // 1. Create a demo draft version containing unresolved placeholder
      const draftRes = await request(app)
        .post('/api/outreach/drafts')
        .send({
          engagementId: demoEngagementId,
          subject: '[DEMO INQUIRY] CoC Partnership Inquiry',
          body: 'Dear Board,\n\nPlease contact us at [ADD VERIFIED PROJECT THRIVEWARD EMAIL] for details.\n\nSincerely,\nProject Thriveward Team',
          recipient: 'CareCoordination@ceo.oc.gov',
          inquiryPurpose: 'GRANT_COMPETITION',
          creatorType: 'HUMAN_EDITED',
          creatorIdentity: 'Authorized Reviewer',
        })
        .expect(201);

      const placeholderDraftId = draftRes.body.data.id;

      // Record baseline database counts before approval attempt
      const approvalsBefore = await prisma.outreachHumanApproval.count();
      const snapshotsBefore = await prisma.contactEvidenceSnapshot.count();
      const historyBefore = await prisma.outreachWorkflowHistory.count();
      const engagementBefore = await prisma.outreachEngagement.findUnique({ where: { id: demoEngagementId } });

      // Attempt to approve placeholder draft
      const approvalRes = await request(app)
        .post('/api/outreach/approvals')
        .send({
          engagementId: demoEngagementId,
          draftVersionId: placeholderDraftId,
          humanReviewerName: 'Jane Doe',
          approvalReason: 'Attempting approval of placeholder draft',
          zeroTransmissionAck: true,
          userConfirmedChecks: {
            recipientReviewed: true,
            contentReviewed: true,
            evidenceVerified: true,
          },
        })
        .expect(400);

      expect(approvalRes.body.success).toBe(false);
      expect(approvalRes.body.code).toBe('UNRESOLVED_PLACEHOLDER');
      expect(approvalRes.body.error).toContain('unresolved system placeholder');

      // Record database counts after approval attempt to prove zero mutations
      const approvalsAfter = await prisma.outreachHumanApproval.count();
      const snapshotsAfter = await prisma.contactEvidenceSnapshot.count();
      const historyAfter = await prisma.outreachWorkflowHistory.count();
      const engagementAfter = await prisma.outreachEngagement.findUnique({ where: { id: demoEngagementId } });

      expect(approvalsAfter).toBe(approvalsBefore);
      expect(snapshotsAfter).toBe(snapshotsBefore);
      expect(historyAfter).toBe(historyBefore);
      expect(engagementAfter?.currentStatus).toBe(engagementBefore?.currentStatus);
      expect(engagementAfter?.currentStatus).toBe(PartnerMatchStatus.POSSIBLE_MATCH);
    });

    it('rejects approval if subject, recipient, or body contains [VERIFY ...], [INSERT ...], [TODO ...], or [DO NOT SEND]', async () => {
      const draftRes = await request(app)
        .post('/api/outreach/drafts')
        .send({
          engagementId: demoEngagementId,
          subject: '[VERIFY NOFO NUMBER] CoC Inquiry',
          body: 'Working text [TODO FILL DETAILS]',
          recipient: '[VERIFY RECIPIENT]@lahsa.org',
          inquiryPurpose: 'GRANT_COMPETITION',
          creatorType: 'HUMAN_EDITED',
          creatorIdentity: 'Authorized Reviewer',
        })
        .expect(201);

      const approvalRes = await request(app)
        .post('/api/outreach/approvals')
        .send({
          engagementId: demoEngagementId,
          draftVersionId: draftRes.body.data.id,
          humanReviewerName: 'Jane Doe',
          approvalReason: 'Attempting approval',
          zeroTransmissionAck: true,
          userConfirmedChecks: {
            recipientReviewed: true,
            contentReviewed: true,
            evidenceVerified: true,
          },
        })
        .expect(400);

      expect(approvalRes.body.code).toBe('UNRESOLVED_PLACEHOLDER');
    });
  });

  describe('3. Copy Workflow Safeguards & Working Draft Creation', () => {
    it('saving a working draft from briefing modal does NOT advance workflow status', async () => {
      const initialEngagement = await prisma.outreachEngagement.findUnique({ where: { id: demoEngagementId } });
      const initialStatus = initialEngagement?.currentStatus;

      const draftRes = await request(app)
        .post('/api/outreach/drafts')
        .send({
          engagementId: demoEngagementId,
          subject: 'Working Draft Created from Briefing Modal',
          body: 'This is a clean working draft without placeholders.',
          recipient: 'CareCoordination@ceo.oc.gov',
          inquiryPurpose: 'GRANT_COMPETITION',
          creatorType: 'HUMAN_EDITED',
          creatorIdentity: 'Authorized Operator',
        })
        .expect(201);

      expect(draftRes.body.success).toBe(true);

      const postDraftEngagement = await prisma.outreachEngagement.findUnique({ where: { id: demoEngagementId } });
      expect(postDraftEngagement?.currentStatus).toBe(initialStatus);
    });

    it('unapproved draft cannot perform delivery confirmation ("Mark as Sent")', async () => {
      await request(app)
        .post('/api/outreach/sent')
        .send({
          engagementId: demoEngagementId,
          actualRecipient: 'CareCoordination@ceo.oc.gov',
          channel: 'EMAIL',
          sentTimestamp: new Date().toISOString(),
          humanActorName: 'Jane Doe',
          notes: 'Attempting sent confirmation without approval',
        })
        .expect(400);
    });
  });

  describe('4. Score Mapping, Subtitle, and Eligibility Canonicalization', () => {
    it('relevance score of 40 maps deterministically to POSSIBLY_RELEVANT and "Possibly Relevant" label', () => {
      const status = mapScoreToRelevanceStatus(40);
      const label = formatRelevanceStatusLabel(40);

      expect(status).toBe('POSSIBLY_RELEVANT');
      expect(label).toBe('Possibly Relevant');
      expect(label).not.toBe('Strong');
      expect(label).not.toBe('Strongly Relevant');
    });

    it('relevance score boundary mapping is consistent across 0-24, 25-49, 50-74, 75-100', () => {
      expect(mapScoreToRelevanceStatus(0)).toBe('IRRELEVANT');
      expect(mapScoreToRelevanceStatus(24)).toBe('IRRELEVANT');
      expect(mapScoreToRelevanceStatus(25)).toBe('POSSIBLY_RELEVANT');
      expect(mapScoreToRelevanceStatus(49)).toBe('POSSIBLY_RELEVANT');
      expect(mapScoreToRelevanceStatus(50)).toBe('RELEVANT');
      expect(mapScoreToRelevanceStatus(74)).toBe('RELEVANT');
      expect(mapScoreToRelevanceStatus(75)).toBe('STRONGLY_RELEVANT');
      expect(mapScoreToRelevanceStatus(100)).toBe('STRONGLY_RELEVANT');
    });

    it('CA-602 (County of Orange) candidate remains unmutated at status RESEARCH_REQUIRED', async () => {
      const ca602 = await prisma.strategicPartnerCandidate.findFirst({
        where: { cocNumber: 'CA-602' },
      });

      expect(ca602).toBeDefined();
      expect(ca602?.status).toBe(PartnerMatchStatus.RESEARCH_REQUIRED);
    });
  });
});
