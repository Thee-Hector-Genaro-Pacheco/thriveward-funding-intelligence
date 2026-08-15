-- CreateTable
CREATE TABLE "OutreachEngagement" (
    "id" TEXT NOT NULL,
    "strategicPartnerCandidateId" TEXT NOT NULL,
    "fundingOpportunityId" TEXT,
    "opportunityPartnerMatchId" TEXT,
    "inquiryPurpose" TEXT NOT NULL DEFAULT 'GRANT_COMPETITION',
    "currentStatus" "PartnerMatchStatus" NOT NULL DEFAULT 'RESEARCH_REQUIRED',
    "dataOrigin" TEXT NOT NULL DEFAULT 'OFFICIAL_LIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OutreachEngagement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutreachDraftVersion" (
    "id" TEXT NOT NULL,
    "engagementId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "inquiryPurpose" TEXT NOT NULL,
    "creatorType" TEXT NOT NULL DEFAULT 'AI_GENERATED',
    "contentHash" TEXT NOT NULL,
    "contactEvidenceRef" TEXT,
    "orgProfileVersion" TEXT NOT NULL DEFAULT '1.3.0-phase1f',
    "orgProfileHash" TEXT,
    "opportunityAnalysisRef" TEXT,
    "creatorActorName" TEXT NOT NULL DEFAULT 'Bridge AI Agent',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OutreachDraftVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContactEvidenceSnapshot" (
    "id" TEXT NOT NULL,
    "engagementId" TEXT NOT NULL,
    "recipientEmail" TEXT NOT NULL,
    "inquiryPurpose" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "requestedUrl" TEXT,
    "finalUrl" TEXT,
    "httpStatus" INTEGER,
    "contentType" TEXT,
    "retrievedByteCount" INTEGER,
    "retrievalTimestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "responseSha256" TEXT,
    "quotedCitation" TEXT NOT NULL,
    "evidenceMode" TEXT NOT NULL DEFAULT 'LIVE_HTTP',
    "snapshotHash" TEXT NOT NULL,

    CONSTRAINT "ContactEvidenceSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutreachHumanApproval" (
    "id" TEXT NOT NULL,
    "engagementId" TEXT NOT NULL,
    "draftVersionId" TEXT NOT NULL,
    "evidenceSnapshotId" TEXT,
    "humanReviewerName" TEXT NOT NULL,
    "approvalTimestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvalReason" TEXT NOT NULL,
    "approvedContentHash" TEXT NOT NULL,
    "zeroTransmissionAck" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "OutreachHumanApproval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutreachDeliveryRecord" (
    "id" TEXT NOT NULL,
    "engagementId" TEXT NOT NULL,
    "approvedDraftVersionId" TEXT,
    "actualRecipient" TEXT NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'EMAIL',
    "sentTimestamp" TIMESTAMP(3) NOT NULL,
    "humanActorName" TEXT NOT NULL,
    "exactSubject" TEXT NOT NULL,
    "exactBodyHash" TEXT NOT NULL,
    "notes" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OutreachDeliveryRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutreachWorkflowHistory" (
    "id" TEXT NOT NULL,
    "engagementId" TEXT NOT NULL,
    "previousStatus" TEXT NOT NULL,
    "newStatus" TEXT NOT NULL,
    "humanActorName" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reason" TEXT NOT NULL,
    "relatedRecordId" TEXT,
    "eventHash" TEXT NOT NULL,

    CONSTRAINT "OutreachWorkflowHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutreachResponseRecord" (
    "id" TEXT NOT NULL,
    "engagementId" TEXT NOT NULL,
    "deliveryRecordId" TEXT,
    "receivedTimestamp" TIMESTAMP(3) NOT NULL,
    "senderIdentity" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "quotedExcerpt" TEXT,
    "nextAction" TEXT,
    "humanRecorderName" TEXT NOT NULL,
    "idempotencyKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OutreachResponseRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutreachFollowUp" (
    "id" TEXT NOT NULL,
    "engagementId" TEXT NOT NULL,
    "dueDateTime" TIMESTAMP(3) NOT NULL,
    "timeZone" TEXT NOT NULL DEFAULT 'America/Los_Angeles',
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "completedTimestamp" TIMESTAMP(3),
    "notes" TEXT,
    "humanActorName" TEXT NOT NULL,
    "idempotencyKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OutreachFollowUp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutreachDiscoveryCall" (
    "id" TEXT NOT NULL,
    "engagementId" TEXT NOT NULL,
    "callState" TEXT NOT NULL DEFAULT 'SCHEDULED',
    "callDateTime" TIMESTAMP(3) NOT NULL,
    "timeZone" TEXT NOT NULL DEFAULT 'America/Los_Angeles',
    "participants" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "meetingMethod" TEXT NOT NULL DEFAULT 'VIDEO_CONFERENCE',
    "notes" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "nextAction" TEXT NOT NULL,
    "humanRecorderName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OutreachDiscoveryCall_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MouChecklistItem" (
    "id" TEXT NOT NULL,
    "engagementId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'NOT_STARTED',
    "responsibleParty" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3),
    "evidenceRef" TEXT,
    "completedTimestamp" TIMESTAMP(3),
    "humanActorName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MouChecklistItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutreachAttachmentRef" (
    "id" TEXT NOT NULL,
    "engagementId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mediaType" TEXT NOT NULL,
    "byteSize" INTEGER,
    "sha256Hash" TEXT,
    "storageRef" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OutreachAttachmentRef_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OutreachEngagement_strategicPartnerCandidateId_fundingOpportunityId_inquiryPurpose_key" ON "OutreachEngagement"("strategicPartnerCandidateId", "fundingOpportunityId", "inquiryPurpose");

-- CreateIndex
CREATE UNIQUE INDEX "OutreachDeliveryRecord_idempotencyKey_key" ON "OutreachDeliveryRecord"("idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "OutreachResponseRecord_idempotencyKey_key" ON "OutreachResponseRecord"("idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "OutreachFollowUp_idempotencyKey_key" ON "OutreachFollowUp"("idempotencyKey");

-- AddForeignKey
ALTER TABLE "OutreachEngagement" ADD CONSTRAINT "OutreachEngagement_strategicPartnerCandidateId_fkey" FOREIGN KEY ("strategicPartnerCandidateId") REFERENCES "StrategicPartnerCandidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutreachEngagement" ADD CONSTRAINT "OutreachEngagement_fundingOpportunityId_fkey" FOREIGN KEY ("fundingOpportunityId") REFERENCES "FundingOpportunity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutreachDraftVersion" ADD CONSTRAINT "OutreachDraftVersion_engagementId_fkey" FOREIGN KEY ("engagementId") REFERENCES "OutreachEngagement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactEvidenceSnapshot" ADD CONSTRAINT "ContactEvidenceSnapshot_engagementId_fkey" FOREIGN KEY ("engagementId") REFERENCES "OutreachEngagement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutreachHumanApproval" ADD CONSTRAINT "OutreachHumanApproval_engagementId_fkey" FOREIGN KEY ("engagementId") REFERENCES "OutreachEngagement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutreachHumanApproval" ADD CONSTRAINT "OutreachHumanApproval_draftVersionId_fkey" FOREIGN KEY ("draftVersionId") REFERENCES "OutreachDraftVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutreachHumanApproval" ADD CONSTRAINT "OutreachHumanApproval_evidenceSnapshotId_fkey" FOREIGN KEY ("evidenceSnapshotId") REFERENCES "ContactEvidenceSnapshot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutreachDeliveryRecord" ADD CONSTRAINT "OutreachDeliveryRecord_engagementId_fkey" FOREIGN KEY ("engagementId") REFERENCES "OutreachEngagement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutreachWorkflowHistory" ADD CONSTRAINT "OutreachWorkflowHistory_engagementId_fkey" FOREIGN KEY ("engagementId") REFERENCES "OutreachEngagement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutreachResponseRecord" ADD CONSTRAINT "OutreachResponseRecord_engagementId_fkey" FOREIGN KEY ("engagementId") REFERENCES "OutreachEngagement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutreachResponseRecord" ADD CONSTRAINT "OutreachResponseRecord_deliveryRecordId_fkey" FOREIGN KEY ("deliveryRecordId") REFERENCES "OutreachDeliveryRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutreachFollowUp" ADD CONSTRAINT "OutreachFollowUp_engagementId_fkey" FOREIGN KEY ("engagementId") REFERENCES "OutreachEngagement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutreachDiscoveryCall" ADD CONSTRAINT "OutreachDiscoveryCall_engagementId_fkey" FOREIGN KEY ("engagementId") REFERENCES "OutreachEngagement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MouChecklistItem" ADD CONSTRAINT "MouChecklistItem_engagementId_fkey" FOREIGN KEY ("engagementId") REFERENCES "OutreachEngagement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutreachAttachmentRef" ADD CONSTRAINT "OutreachAttachmentRef_engagementId_fkey" FOREIGN KEY ("engagementId") REFERENCES "OutreachEngagement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
