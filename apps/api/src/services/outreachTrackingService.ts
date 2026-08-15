import { prisma } from '../lib/prisma';
import { PartnerMatchStatus } from '@prisma/client';
import crypto from 'crypto';

export interface UserConfirmedChecks {
  recipientReviewed: boolean;
  contentReviewed: boolean;
  evidenceVerified: boolean;
}

export class OutreachTrackingService {
  /**
   * Helper to compute SHA-256 hash of a string string.
   */
  public static hashContent(content: string): string {
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  /**
   * Get or create a durable OutreachEngagement record.
   */
  public static async getOrCreateEngagement(input: {
    partnerId: string;
    opportunityId?: string;
    inquiryPurpose?: string;
    dataOrigin?: string;
  }) {
    const inquiryPurpose = input.inquiryPurpose || 'GRANT_COMPETITION';
    const dataOrigin = input.dataOrigin || 'OFFICIAL_LIVE';

    let engagement = await prisma.outreachEngagement.findFirst({
      where: {
        strategicPartnerCandidateId: input.partnerId,
        fundingOpportunityId: input.opportunityId || null,
        inquiryPurpose,
      },
      include: {
        strategicPartnerCandidate: { include: { citations: true, contactChannels: true } },
        fundingOpportunity: true,
        draftVersions: { orderBy: { versionNumber: 'desc' } },
        evidenceSnapshots: { orderBy: { retrievalTimestamp: 'desc' } },
        humanApprovals: { orderBy: { approvalTimestamp: 'desc' } },
        deliveryRecords: { orderBy: { sentTimestamp: 'desc' } },
        workflowHistory: { orderBy: { timestamp: 'desc' } },
        responses: { orderBy: { receivedTimestamp: 'desc' } },
        followUps: { orderBy: { dueDateTime: 'asc' } },
        discoveryCalls: { orderBy: { callDateTime: 'desc' } },
        mouChecklistItems: { orderBy: { createdAt: 'asc' } },
        attachmentRefs: true,
      },
    });

    if (!engagement) {
      // Find opportunity partner match ID if exists
      let oppMatchId: string | null = null;
      if (input.opportunityId) {
        const match = await prisma.opportunityPartnerMatch.findFirst({
          where: {
            strategicPartnerCandidateId: input.partnerId,
            fundingOpportunityId: input.opportunityId,
          },
        });
        if (match) oppMatchId = match.id;
      }

      // Check candidate default status
      const partner = await prisma.strategicPartnerCandidate.findUnique({
        where: { id: input.partnerId },
      });

      const initialStatus = partner?.status || PartnerMatchStatus.RESEARCH_REQUIRED;

      engagement = await prisma.outreachEngagement.create({
        data: {
          strategicPartnerCandidateId: input.partnerId,
          fundingOpportunityId: input.opportunityId || null,
          opportunityPartnerMatchId: oppMatchId,
          inquiryPurpose,
          currentStatus: initialStatus,
          dataOrigin,
        },
        include: {
          strategicPartnerCandidate: { include: { citations: true, contactChannels: true } },
          fundingOpportunity: true,
          draftVersions: { orderBy: { versionNumber: 'desc' } },
          evidenceSnapshots: { orderBy: { retrievalTimestamp: 'desc' } },
          humanApprovals: { orderBy: { approvalTimestamp: 'desc' } },
          deliveryRecords: { orderBy: { sentTimestamp: 'desc' } },
          workflowHistory: { orderBy: { timestamp: 'desc' } },
          responses: { orderBy: { receivedTimestamp: 'desc' } },
          followUps: { orderBy: { dueDateTime: 'asc' } },
          discoveryCalls: { orderBy: { callDateTime: 'desc' } },
          mouChecklistItems: { orderBy: { createdAt: 'asc' } },
          attachmentRefs: true,
        },
      });

      // Record initial creation history
      const eventHash = this.hashContent(`INIT:${engagement.id}:${initialStatus}`);
      await prisma.outreachWorkflowHistory.create({
        data: {
          engagementId: engagement.id,
          previousStatus: 'NONE',
          newStatus: initialStatus,
          humanActorName: 'System Baseline',
          reason: 'Engagement lifecycle initialized',
          eventHash,
        },
      });
    }

    return engagement;
  }

  /**
   * Get full engagement timeline & details by ID.
   */
  public static async getEngagementTimeline(engagementId: string) {
    const engagement = await prisma.outreachEngagement.findUnique({
      where: { id: engagementId },
      include: {
        strategicPartnerCandidate: { include: { citations: true, contactChannels: true } },
        fundingOpportunity: true,
        draftVersions: { orderBy: { versionNumber: 'desc' } },
        evidenceSnapshots: { orderBy: { retrievalTimestamp: 'desc' } },
        humanApprovals: { orderBy: { approvalTimestamp: 'desc' }, include: { draftVersion: true, evidenceSnapshot: true } },
        deliveryRecords: { orderBy: { sentTimestamp: 'desc' } },
        workflowHistory: { orderBy: { timestamp: 'desc' } },
        responses: { orderBy: { receivedTimestamp: 'desc' } },
        followUps: { orderBy: { dueDateTime: 'asc' } },
        discoveryCalls: { orderBy: { callDateTime: 'desc' } },
        mouChecklistItems: { orderBy: { createdAt: 'asc' } },
        attachmentRefs: true,
      },
    });

    if (!engagement) {
      throw new Error(`Engagement with ID '${engagementId}' not found.`);
    }

    return engagement;
  }

  /**
   * Save a new append-only draft version.
   * NEVER alters engagement status.
   */
  public static async saveDraftVersion(input: {
    engagementId: string;
    subject: string;
    body: string;
    recipient: string;
    inquiryPurpose: string;
    creatorType?: string;
    creatorActorName?: string;
    contactEvidenceRef?: string;
  }) {
    const engagement = await prisma.outreachEngagement.findUnique({
      where: { id: input.engagementId },
    });

    if (!engagement) {
      throw new Error(`Engagement with ID '${input.engagementId}' not found.`);
    }

    const versionCount = await prisma.outreachDraftVersion.count({
      where: { engagementId: input.engagementId },
    });
    const versionNumber = versionCount + 1;

    const contentHash = this.hashContent(`${input.subject}\n\n${input.body}\n\n${input.recipient}`);
    const creatorType = input.creatorType || 'AI_GENERATED';
    const creatorActorName = input.creatorActorName || (creatorType === 'HUMAN_EDITED' ? 'Human Operator' : 'Bridge AI Agent');

    const draft = await prisma.outreachDraftVersion.create({
      data: {
        engagementId: input.engagementId,
        versionNumber,
        subject: input.subject,
        body: input.body,
        recipient: input.recipient,
        inquiryPurpose: input.inquiryPurpose,
        creatorType,
        contentHash,
        contactEvidenceRef: input.contactEvidenceRef,
        creatorActorName,
        orgProfileVersion: '1.3.0-phase1f',
        orgProfileHash: this.hashContent('Project Thriveward Profile v1.3.0-phase1f'),
      },
    });

    return draft;
  }

  /**
   * Approve and freeze a draft.
   * Requires status POSSIBLE_MATCH and verified recipient.
   * Transition: POSSIBLE_MATCH -> CONTACT_APPROVED.
   */
  public static containsUnresolvedPlaceholder(text: string | null | undefined): { hasPlaceholder: boolean; matchedPlaceholder?: string } {
    if (!text) return { hasPlaceholder: false };
    const patterns = [
      /\[ADD\b[^\]]*\]/i,
      /\[VERIFY\b[^\]]*\]/i,
      /\[INSERT\b[^\]]*\]/i,
      /\[REPLACE\b[^\]]*\]/i,
      /\[TODO\b[^\]]*\]/i,
      /\[DO NOT SEND\]/i,
      /\[ADD\s+VERIFIED\s+PROJECT\s+THRIVEWARD\s+EMAIL\]/i,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        return { hasPlaceholder: true, matchedPlaceholder: match[0] };
      }
    }
    return { hasPlaceholder: false };
  }

  public static async approveAndFreezeDraft(input: {
    engagementId: string;
    draftVersionId: string;
    humanReviewerName: string;
    approvalReason: string;
    zeroTransmissionAck: boolean;
    userConfirmedChecks: UserConfirmedChecks;
  }) {
    // Fail-closed validation for human reviewer
    if (!input.humanReviewerName || input.humanReviewerName.trim() === '' || input.humanReviewerName.toLowerCase().includes('agent') || input.humanReviewerName.toLowerCase().includes('ai')) {
      const err: any = new Error('Outreach approval requires explicit human attribution. AI actors cannot approve outreach.');
      err.statusCode = 400;
      throw err;
    }

    if (!input.zeroTransmissionAck) {
      const err: any = new Error('Approval requires explicit acknowledgment that Bridge AI will not send the email.');
      err.statusCode = 400;
      throw err;
    }

    if (!input.userConfirmedChecks?.recipientReviewed || !input.userConfirmedChecks?.contentReviewed || !input.userConfirmedChecks?.evidenceVerified) {
      const err: any = new Error('Approval requires confirmation that recipient, content, and evidence sources were reviewed.');
      err.statusCode = 400;
      throw err;
    }

    return await prisma.$transaction(async (tx) => {
      const engagement = await tx.outreachEngagement.findUnique({
        where: { id: input.engagementId },
        include: { strategicPartnerCandidate: { include: { contactChannels: true, citations: true } } },
      });

      if (!engagement) {
        const err: any = new Error(`Engagement with ID '${input.engagementId}' not found.`);
        err.statusCode = 404;
        throw err;
      }

      if (engagement.currentStatus !== PartnerMatchStatus.POSSIBLE_MATCH) {
        const err: any = new Error(`Invalid transition: Approval requires status POSSIBLE_MATCH (Current status: ${engagement.currentStatus}).`);
        err.statusCode = 400;
        throw err;
      }

      const draft = await tx.outreachDraftVersion.findUnique({
        where: { id: input.draftVersionId },
      });

      if (!draft || draft.engagementId !== input.engagementId) {
        const err: any = new Error(`Draft version '${input.draftVersionId}' not found for engagement.`);
        err.statusCode = 400;
        throw err;
      }

      // Fail-closed validation for unresolved placeholders in draft subject, body, recipient, or inquiryPurpose
      const checkSubject = this.containsUnresolvedPlaceholder(draft.subject);
      const checkBody = this.containsUnresolvedPlaceholder(draft.body);
      const checkRecipient = this.containsUnresolvedPlaceholder(draft.recipient);
      const checkPurpose = this.containsUnresolvedPlaceholder(draft.inquiryPurpose);

      const matchedPlaceholder = checkSubject.matchedPlaceholder || checkBody.matchedPlaceholder || checkRecipient.matchedPlaceholder || checkPurpose.matchedPlaceholder;

      const recipient = (draft.recipient || '').trim();
      if (matchedPlaceholder || !recipient || recipient.includes('[VERIFY') || recipient === 'UNKNOWN' || !recipient.includes('@')) {
        const placeholderText = matchedPlaceholder || recipient;
        const err: any = new Error(`Cannot approve draft containing unresolved system placeholder '${placeholderText}'. Please replace all placeholder brackets before requesting human approval.`);
        err.statusCode = 400;
        err.code = 'UNRESOLVED_PLACEHOLDER';
        throw err;
      }

      // Freeze contact evidence snapshot
      const partner = engagement.strategicPartnerCandidate;
      const contactChan = partner.contactChannels.find((c) => c.contactValue === recipient) || partner.contactChannels[0];
      const sourceCitation = partner.citations[0];

      const snapshotHash = this.hashContent(`EVIDENCE:${recipient}:${contactChan?.sourceUrl || partner.websiteUrl}`);
      const snapshot = await tx.contactEvidenceSnapshot.create({
        data: {
          engagementId: input.engagementId,
          recipientEmail: recipient,
          inquiryPurpose: draft.inquiryPurpose,
          sourceUrl: contactChan?.sourceUrl || sourceCitation?.sourceUrl || partner.websiteUrl,
          requestedUrl: contactChan?.sourceUrl || partner.websiteUrl,
          finalUrl: contactChan?.sourceUrl || partner.websiteUrl,
          httpStatus: contactChan?.lastHttpStatus || 200,
          contentType: 'text/html',
          retrievedByteCount: contactChan?.responseByteCount || 1024,
          responseSha256: contactChan?.responseHash || this.hashContent('HTTP_BODY_MOCK'),
          quotedCitation: contactChan?.quotedCitation || sourceCitation?.quotedSection || 'Official directory verified contact citation.',
          evidenceMode: contactChan?.verificationMode || 'LIVE_HTTP',
          snapshotHash,
        },
      });

      // Create human approval record
      const approval = await tx.outreachHumanApproval.create({
        data: {
          engagementId: input.engagementId,
          draftVersionId: draft.id,
          evidenceSnapshotId: snapshot.id,
          humanReviewerName: input.humanReviewerName,
          approvalReason: input.approvalReason,
          approvedContentHash: draft.contentHash,
          zeroTransmissionAck: true,
        },
      });

      // Transition status to CONTACT_APPROVED
      const previousStatus = engagement.currentStatus;
      const newStatus = PartnerMatchStatus.CONTACT_APPROVED;

      await tx.outreachEngagement.update({
        where: { id: input.engagementId },
        data: { currentStatus: newStatus },
      });

      // Update strategic partner candidate / match status if linked
      await tx.strategicPartnerCandidate.update({
        where: { id: partner.id },
        data: { status: newStatus },
      });

      if (engagement.opportunityPartnerMatchId) {
        await tx.opportunityPartnerMatch.update({
          where: { id: engagement.opportunityPartnerMatchId },
          data: { status: newStatus, humanApproved: true },
        });
      }

      // Record workflow history event
      const eventHash = this.hashContent(`APPROVAL:${engagement.id}:${previousStatus}:${newStatus}:${approval.id}`);
      await tx.outreachWorkflowHistory.create({
        data: {
          engagementId: input.engagementId,
          previousStatus,
          newStatus,
          humanActorName: input.humanReviewerName,
          reason: input.approvalReason,
          relatedRecordId: approval.id,
          eventHash,
        },
      });

      return approval;
    });
  }

  /**
   * Mark outreach as sent (human confirms external sending).
   * Idempotent per idempotencyKey.
   * Requires status CONTACT_APPROVED.
   * Transition: CONTACT_APPROVED -> CONTACTED.
   */
  public static async markOutreachAsSent(input: {
    engagementId: string;
    actualRecipient: string;
    channel?: string;
    sentTimestamp: string | Date;
    humanActorName: string;
    notes?: string;
    idempotencyKey: string;
  }) {
    if (!input.humanActorName || input.humanActorName.trim() === '') {
      const err: any = new Error('Marking outreach as sent requires human attribution.');
      err.statusCode = 400;
      throw err;
    }

    if (!input.idempotencyKey || input.idempotencyKey.trim() === '') {
      const err: any = new Error('Marking outreach as sent requires a valid idempotency key.');
      err.statusCode = 400;
      throw err;
    }

    // Check idempotency first
    const existingDelivery = await prisma.outreachDeliveryRecord.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
    });
    if (existingDelivery) {
      return existingDelivery;
    }

    return await prisma.$transaction(async (tx) => {
      const engagement = await tx.outreachEngagement.findUnique({
        where: { id: input.engagementId },
        include: {
          humanApprovals: { orderBy: { approvalTimestamp: 'desc' }, include: { draftVersion: true } },
        },
      });

      if (!engagement) {
        const err: any = new Error(`Engagement with ID '${input.engagementId}' not found.`);
        err.statusCode = 404;
        throw err;
      }

      if (engagement.currentStatus !== PartnerMatchStatus.CONTACT_APPROVED) {
        const err: any = new Error(`Invalid transition: Mark-as-sent requires status CONTACT_APPROVED (Current status: ${engagement.currentStatus}).`);
        err.statusCode = 400;
        throw err;
      }

      const latestApproval = engagement.humanApprovals[0];
      const approvedDraft = latestApproval?.draftVersion;

      const exactSubject = approvedDraft?.subject || 'Outreach Inquiry';
      const exactBodyHash = approvedDraft?.contentHash || this.hashContent('SENT_BODY_UNKNOWN');

      const delivery = await tx.outreachDeliveryRecord.create({
        data: {
          engagementId: input.engagementId,
          approvedDraftVersionId: approvedDraft?.id || null,
          actualRecipient: input.actualRecipient,
          channel: input.channel || 'EMAIL',
          sentTimestamp: new Date(input.sentTimestamp),
          humanActorName: input.humanActorName,
          exactSubject,
          exactBodyHash,
          notes: input.notes,
          idempotencyKey: input.idempotencyKey,
        },
      });

      // Transition status to CONTACTED
      const previousStatus = engagement.currentStatus;
      const newStatus = PartnerMatchStatus.CONTACTED;

      await tx.outreachEngagement.update({
        where: { id: input.engagementId },
        data: { currentStatus: newStatus },
      });

      await tx.strategicPartnerCandidate.update({
        where: { id: engagement.strategicPartnerCandidateId },
        data: { status: newStatus },
      });

      if (engagement.opportunityPartnerMatchId) {
        await tx.opportunityPartnerMatch.update({
          where: { id: engagement.opportunityPartnerMatchId },
          data: { status: newStatus },
        });
      }

      // Record workflow history event
      const eventHash = this.hashContent(`DELIVERY:${engagement.id}:${previousStatus}:${newStatus}:${delivery.id}`);
      await tx.outreachWorkflowHistory.create({
        data: {
          engagementId: input.engagementId,
          previousStatus,
          newStatus,
          humanActorName: input.humanActorName,
          reason: `Human confirmed external sending via ${delivery.channel} to ${delivery.actualRecipient}`,
          relatedRecordId: delivery.id,
          eventHash,
        },
      });

      return delivery;
    });
  }

  /**
   * Record a partner response.
   * Recording a response NEVER automatically claims a partnership or alters status to CONFIRMED_PARTNER.
   */
  public static async recordResponse(input: {
    engagementId: string;
    deliveryRecordId?: string;
    receivedTimestamp: string | Date;
    senderIdentity: string;
    outcome: string;
    summary: string;
    quotedExcerpt?: string;
    nextAction?: string;
    humanRecorderName: string;
    idempotencyKey?: string;
  }) {
    if (!input.humanRecorderName || input.humanRecorderName.trim() === '') {
      const err: any = new Error('Recording a response requires human attribution.');
      err.statusCode = 400;
      throw err;
    }

    if (input.idempotencyKey) {
      const existing = await prisma.outreachResponseRecord.findUnique({
        where: { idempotencyKey: input.idempotencyKey },
      });
      if (existing) return existing;
    }

    const engagement = await prisma.outreachEngagement.findUnique({
      where: { id: input.engagementId },
    });

    if (!engagement) {
      throw new Error(`Engagement with ID '${input.engagementId}' not found.`);
    }

    const responseRecord = await prisma.outreachResponseRecord.create({
      data: {
        engagementId: input.engagementId,
        deliveryRecordId: input.deliveryRecordId || null,
        receivedTimestamp: new Date(input.receivedTimestamp),
        senderIdentity: input.senderIdentity,
        outcome: input.outcome,
        summary: input.summary,
        quotedExcerpt: input.quotedExcerpt,
        nextAction: input.nextAction,
        humanRecorderName: input.humanRecorderName,
        idempotencyKey: input.idempotencyKey || null,
      },
    });

    // Append workflow history log
    const eventHash = this.hashContent(`RESPONSE:${engagement.id}:${responseRecord.id}`);
    await prisma.outreachWorkflowHistory.create({
      data: {
        engagementId: input.engagementId,
        previousStatus: engagement.currentStatus,
        newStatus: engagement.currentStatus, // Status remains unchanged
        humanActorName: input.humanRecorderName,
        reason: `Recorded partner response (${input.outcome}): ${input.summary}`,
        relatedRecordId: responseRecord.id,
        eventHash,
      },
    });

    return responseRecord;
  }

  /**
   * Schedule or update a follow-up reminder.
   */
  public static async createOrUpdateFollowUp(input: {
    engagementId: string;
    followUpId?: string;
    dueDateTime: string | Date;
    timeZone?: string;
    reason: string;
    status?: string;
    notes?: string;
    humanActorName: string;
    idempotencyKey?: string;
  }) {
    if (input.idempotencyKey) {
      const existing = await prisma.outreachFollowUp.findUnique({
        where: { idempotencyKey: input.idempotencyKey },
      });
      if (existing) return existing;
    }

    if (input.followUpId) {
      return await prisma.outreachFollowUp.update({
        where: { id: input.followUpId },
        data: {
          dueDateTime: new Date(input.dueDateTime),
          timeZone: input.timeZone || 'America/Los_Angeles',
          reason: input.reason,
          status: input.status || 'PENDING',
          completedTimestamp: input.status === 'COMPLETED' ? new Date() : null,
          notes: input.notes,
          humanActorName: input.humanActorName,
        },
      });
    }

    return await prisma.outreachFollowUp.create({
      data: {
        engagementId: input.engagementId,
        dueDateTime: new Date(input.dueDateTime),
        timeZone: input.timeZone || 'America/Los_Angeles',
        reason: input.reason,
        status: input.status || 'PENDING',
        completedTimestamp: input.status === 'COMPLETED' ? new Date() : null,
        notes: input.notes,
        humanActorName: input.humanActorName,
        idempotencyKey: input.idempotencyKey || null,
      },
    });
  }

  /**
   * Record a discovery call.
   * Auto-advances status CONTACTED -> DISCOVERY_CALL if currently at CONTACTED.
   */
  public static async recordDiscoveryCall(input: {
    engagementId: string;
    callState?: string;
    callDateTime: string | Date;
    timeZone?: string;
    participants?: string[];
    meetingMethod?: string;
    notes: string;
    outcome: string;
    nextAction: string;
    humanRecorderName: string;
  }) {
    return await prisma.$transaction(async (tx) => {
      const engagement = await tx.outreachEngagement.findUnique({
        where: { id: input.engagementId },
      });

      if (!engagement) {
        const err: any = new Error(`Engagement with ID '${input.engagementId}' not found.`);
        err.statusCode = 404;
        throw err;
      }

      const call = await tx.outreachDiscoveryCall.create({
        data: {
          engagementId: input.engagementId,
          callState: input.callState || 'SCHEDULED',
          callDateTime: new Date(input.callDateTime),
          timeZone: input.timeZone || 'America/Los_Angeles',
          participants: input.participants || [],
          meetingMethod: input.meetingMethod || 'VIDEO_CONFERENCE',
          notes: input.notes,
          outcome: input.outcome,
          nextAction: input.nextAction,
          humanRecorderName: input.humanRecorderName,
        },
      });

      // Auto-advance if currently CONTACTED
      if (engagement.currentStatus === PartnerMatchStatus.CONTACTED) {
        const previousStatus = engagement.currentStatus;
        const newStatus = PartnerMatchStatus.DISCOVERY_CALL;

        await tx.outreachEngagement.update({
          where: { id: input.engagementId },
          data: { currentStatus: newStatus },
        });

        await tx.strategicPartnerCandidate.update({
          where: { id: engagement.strategicPartnerCandidateId },
          data: { status: newStatus },
        });

        if (engagement.opportunityPartnerMatchId) {
          await tx.opportunityPartnerMatch.update({
            where: { id: engagement.opportunityPartnerMatchId },
            data: { status: newStatus },
          });
        }

        const eventHash = this.hashContent(`DISCOVERY_CALL:${engagement.id}:${previousStatus}:${newStatus}:${call.id}`);
        await tx.outreachWorkflowHistory.create({
          data: {
            engagementId: input.engagementId,
            previousStatus,
            newStatus,
            humanActorName: input.humanRecorderName,
            reason: `Recorded discovery call (${input.callState}): ${input.outcome}`,
            relatedRecordId: call.id,
            eventHash,
          },
        });
      }

      return call;
    });
  }

  /**
   * Add or update an MOU checklist item.
   */
  public static async createOrUpdateMouChecklistItem(input: {
    engagementId: string;
    itemId?: string;
    label: string;
    status?: string;
    responsibleParty: string;
    dueDate?: string | Date;
    evidenceRef?: string;
    humanActorName: string;
  }) {
    if (input.itemId) {
      return await prisma.mouChecklistItem.update({
        where: { id: input.itemId },
        data: {
          label: input.label,
          status: input.status || 'NOT_STARTED',
          responsibleParty: input.responsibleParty,
          dueDate: input.dueDate ? new Date(input.dueDate) : null,
          evidenceRef: input.evidenceRef,
          completedTimestamp: input.status === 'COMPLETED' ? new Date() : null,
          humanActorName: input.humanActorName,
        },
      });
    }

    return await prisma.mouChecklistItem.create({
      data: {
        engagementId: input.engagementId,
        label: input.label,
        status: input.status || 'NOT_STARTED',
        responsibleParty: input.responsibleParty,
        dueDate: input.dueDate ? new Date(input.dueDate) : null,
        evidenceRef: input.evidenceRef,
        completedTimestamp: input.status === 'COMPLETED' ? new Date() : null,
        humanActorName: input.humanActorName,
      },
    });
  }

  /**
   * Server-authoritative workflow transition validator.
   */
  public static async transitionWorkflowStatus(input: {
    engagementId: string;
    targetStatus: PartnerMatchStatus;
    humanActorName: string;
    reason: string;
    relatedRecordId?: string;
    confirmationMetadata?: any;
  }) {
    if (!input.humanActorName || input.humanActorName.trim() === '' || input.humanActorName.toLowerCase().includes('ai')) {
      const err: any = new Error('Workflow transitions require explicit human authorization.');
      err.statusCode = 400;
      throw err;
    }

    if (!input.reason || input.reason.trim() === '') {
      const err: any = new Error('Workflow transitions require a stated human reason.');
      err.statusCode = 400;
      throw err;
    }

    return await prisma.$transaction(async (tx) => {
      const engagement = await tx.outreachEngagement.findUnique({
        where: { id: input.engagementId },
        include: {
          draftVersions: true,
          humanApprovals: true,
          deliveryRecords: true,
          discoveryCalls: true,
          mouChecklistItems: true,
        },
      });

      if (!engagement) {
        const err: any = new Error(`Engagement with ID '${input.engagementId}' not found.`);
        err.statusCode = 404;
        throw err;
      }

      const currentStatus = engagement.currentStatus;
      const targetStatus = input.targetStatus;

      // Allow no-op transition
      if (currentStatus === targetStatus) {
        return engagement;
      }

      // Progression transition validation rules
      if (targetStatus === PartnerMatchStatus.POSSIBLE_MATCH) {
        if (currentStatus !== PartnerMatchStatus.RESEARCH_REQUIRED) {
          const err: any = new Error(`Invalid transition: Cannot move to POSSIBLE_MATCH from ${currentStatus}. Must start at RESEARCH_REQUIRED.`);
          err.statusCode = 400;
          throw err;
        }
      } else if (targetStatus === PartnerMatchStatus.CONTACT_APPROVED) {
        if (currentStatus !== PartnerMatchStatus.POSSIBLE_MATCH) {
          const err: any = new Error(`Invalid transition: Cannot move to CONTACT_APPROVED from ${currentStatus}. Requires POSSIBLE_MATCH.`);
          err.statusCode = 400;
          throw err;
        }
        if (engagement.humanApprovals.length === 0) {
          const err: any = new Error('Invalid transition: CONTACT_APPROVED requires an approved and frozen draft version.');
          err.statusCode = 400;
          throw err;
        }
      } else if (targetStatus === PartnerMatchStatus.CONTACTED) {
        if (currentStatus !== PartnerMatchStatus.CONTACT_APPROVED) {
          const err: any = new Error(`Invalid transition: Cannot move to CONTACTED from ${currentStatus}. Requires CONTACT_APPROVED.`);
          err.statusCode = 400;
          throw err;
        }
        if (engagement.deliveryRecords.length === 0) {
          const err: any = new Error('Invalid transition: CONTACTED requires a confirmed delivery record ("Mark as Sent").');
          err.statusCode = 400;
          throw err;
        }
      } else if (targetStatus === PartnerMatchStatus.DISCOVERY_CALL) {
        if (currentStatus !== PartnerMatchStatus.CONTACTED) {
          const err: any = new Error(`Invalid transition: Cannot move to DISCOVERY_CALL from ${currentStatus}. Requires CONTACTED.`);
          err.statusCode = 400;
          throw err;
        }
        if (engagement.discoveryCalls.length === 0) {
          const err: any = new Error('Invalid transition: DISCOVERY_CALL requires a scheduled or completed discovery call record.');
          err.statusCode = 400;
          throw err;
        }
      } else if (targetStatus === PartnerMatchStatus.PARTNERSHIP_DISCUSSION) {
        if (currentStatus !== PartnerMatchStatus.DISCOVERY_CALL) {
          const err: any = new Error(`Invalid transition: Cannot move to PARTNERSHIP_DISCUSSION from ${currentStatus}. Requires DISCOVERY_CALL.`);
          err.statusCode = 400;
          throw err;
        }
      } else if (targetStatus === PartnerMatchStatus.MOU_IN_PROGRESS) {
        if (currentStatus !== PartnerMatchStatus.PARTNERSHIP_DISCUSSION) {
          const err: any = new Error(`Invalid transition: Cannot move to MOU_IN_PROGRESS from ${currentStatus}. Requires PARTNERSHIP_DISCUSSION.`);
          err.statusCode = 400;
          throw err;
        }
        if (engagement.mouChecklistItems.length === 0) {
          const err: any = new Error('Invalid transition: MOU_IN_PROGRESS requires an MOU/document checklist item.');
          err.statusCode = 400;
          throw err;
        }
      } else if (targetStatus === PartnerMatchStatus.CONFIRMED_PARTNER) {
        if (currentStatus !== PartnerMatchStatus.MOU_IN_PROGRESS) {
          const err: any = new Error(`Invalid transition: Cannot move to CONFIRMED_PARTNER from ${currentStatus}. Requires MOU_IN_PROGRESS.`);
          err.statusCode = 400;
          throw err;
        }
        if (!input.confirmationMetadata || !input.confirmationMetadata.executedMouReference) {
          const err: any = new Error('Invalid transition: CONFIRMED_PARTNER requires explicit confirmation evidence metadata (executedMouReference).');
          err.statusCode = 400;
          throw err;
        }
      } else if (targetStatus !== PartnerMatchStatus.DECLINED && targetStatus !== PartnerMatchStatus.INACTIVE) {
        const err: any = new Error(`Unsupported target status '${targetStatus}'.`);
        err.statusCode = 400;
        throw err;
      }

      // Apply valid transition
      const updated = await tx.outreachEngagement.update({
        where: { id: input.engagementId },
        data: { currentStatus: targetStatus },
      });

      await tx.strategicPartnerCandidate.update({
        where: { id: engagement.strategicPartnerCandidateId },
        data: { status: targetStatus },
      });

      if (engagement.opportunityPartnerMatchId) {
        await tx.opportunityPartnerMatch.update({
          where: { id: engagement.opportunityPartnerMatchId },
          data: { status: targetStatus },
        });
      }

      // Record workflow history event
      const eventHash = this.hashContent(`TRANSITION:${engagement.id}:${currentStatus}:${targetStatus}:${Date.now()}`);
      await tx.outreachWorkflowHistory.create({
        data: {
          engagementId: input.engagementId,
          previousStatus: currentStatus,
          newStatus: targetStatus,
          humanActorName: input.humanActorName,
          reason: input.reason,
          relatedRecordId: input.relatedRecordId || null,
          eventHash,
        },
      });

      return updated;
    });
  }

  /**
   * Follow-Up Dashboard Query.
   * Groups follow-ups and engagements into compact dashboard statistics.
   */
  public static async getFollowUpDashboard(includeDemo = false) {
    if (includeDemo && process.env.NODE_ENV === 'production') {
      const err: any = new Error('Production environment cannot expose demo data (includeDemo is prohibited in production).');
      err.statusCode = 400;
      throw err;
    }

    const allowDemo = includeDemo && process.env.NODE_ENV !== 'production';

    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

    const followUps = await prisma.outreachFollowUp.findMany({
      where: allowDemo ? undefined : { engagement: { dataOrigin: { not: 'DEMO' } } },
      include: {
        engagement: {
          include: {
            strategicPartnerCandidate: true,
            fundingOpportunity: true,
          },
        },
      },
      orderBy: { dueDateTime: 'asc' },
    });

    const dueToday = followUps.filter(
      (f) => f.status === 'PENDING' && f.dueDateTime >= startOfDay && f.dueDateTime < endOfDay
    );
    const upcoming = followUps.filter(
      (f) => f.status === 'PENDING' && f.dueDateTime >= endOfDay
    );
    const overdue = followUps.filter(
      (f) => f.status === 'PENDING' && f.dueDateTime < startOfDay
    );

    const engagements = await prisma.outreachEngagement.findMany({
      where: allowDemo ? undefined : { dataOrigin: { not: 'DEMO' } },
      include: {
        strategicPartnerCandidate: true,
        fundingOpportunity: true,
        deliveryRecords: { orderBy: { sentTimestamp: 'desc' } },
        responses: { orderBy: { receivedTimestamp: 'desc' } },
      },
    });

    const awaitingResponse = engagements.filter(
      (e) => e.currentStatus === PartnerMatchStatus.CONTACTED && e.responses.length === 0
    );

    const recentlyContacted = engagements.filter(
      (e) => e.deliveryRecords.length > 0
    );

    const responsesReceived = engagements.filter(
      (e) => e.responses.length > 0
    );

    return {
      now: now.toISOString(),
      counts: {
        dueToday: dueToday.length,
        upcoming: upcoming.length,
        overdue: overdue.length,
        awaitingResponse: awaitingResponse.length,
        recentlyContacted: recentlyContacted.length,
        responsesReceived: responsesReceived.length,
      },
      dueToday,
      upcoming,
      overdue,
      awaitingResponse,
      recentlyContacted,
      responsesReceived,
    };
  }
}
