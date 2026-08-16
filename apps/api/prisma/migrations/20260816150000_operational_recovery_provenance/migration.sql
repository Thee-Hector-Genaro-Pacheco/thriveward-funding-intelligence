-- CreateTable
CREATE TABLE "SecurityAuditClassificationBatch" (
    "id" TEXT NOT NULL,
    "batchName" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "eventCount" INTEGER NOT NULL,
    "manifestDigest" TEXT NOT NULL,
    "evidence" TEXT,
    "actorType" TEXT NOT NULL DEFAULT 'SYSTEM_DATA_REPAIR',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SecurityAuditClassificationBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SecurityAuditEventClassification" (
    "id" TEXT NOT NULL,
    "securityAuditEventId" TEXT NOT NULL,
    "classificationBatchId" TEXT NOT NULL,
    "classification" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SecurityAuditEventClassification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FundingOpportunityRecoveryRecord" (
    "id" TEXT NOT NULL,
    "originalOpportunityId" TEXT NOT NULL,
    "currentOpportunityId" TEXT NOT NULL,
    "fundingOpportunityNumber" TEXT NOT NULL,
    "recoveryReason" TEXT NOT NULL,
    "recoveryMechanism" TEXT NOT NULL,
    "sourceEvidence" TEXT NOT NULL,
    "originalDeletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actorType" TEXT NOT NULL DEFAULT 'SYSTEM_DATA_REPAIR',

    CONSTRAINT "FundingOpportunityRecoveryRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiEvaluationRecoveryRecord" (
    "id" TEXT NOT NULL,
    "aiEvaluationId" TEXT NOT NULL,
    "originalOpportunityId" TEXT NOT NULL,
    "currentOpportunityId" TEXT NOT NULL,
    "originalAuditEventId" TEXT,
    "inputHash" TEXT NOT NULL,
    "providerResponseId" TEXT,
    "recoveryReason" TEXT NOT NULL,
    "recoveryMechanism" TEXT NOT NULL,
    "fieldEquivalenceResult" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actorType" TEXT NOT NULL DEFAULT 'SYSTEM_DATA_REPAIR',

    CONSTRAINT "AiEvaluationRecoveryRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SecurityAuditEventClassification_securityAuditEventId_idx" ON "SecurityAuditEventClassification"("securityAuditEventId");

-- CreateIndex
CREATE INDEX "SecurityAuditEventClassification_classificationBatchId_idx" ON "SecurityAuditEventClassification"("classificationBatchId");

-- CreateIndex
CREATE UNIQUE INDEX "SecurityAuditEventClassification_securityAuditEventId_class_key" ON "SecurityAuditEventClassification"("securityAuditEventId", "classificationBatchId");

-- CreateIndex
CREATE INDEX "FundingOpportunityRecoveryRecord_currentOpportunityId_idx" ON "FundingOpportunityRecoveryRecord"("currentOpportunityId");

-- CreateIndex
CREATE INDEX "FundingOpportunityRecoveryRecord_originalOpportunityId_idx" ON "FundingOpportunityRecoveryRecord"("originalOpportunityId");

-- CreateIndex
CREATE INDEX "AiEvaluationRecoveryRecord_aiEvaluationId_idx" ON "AiEvaluationRecoveryRecord"("aiEvaluationId");

-- CreateIndex
CREATE INDEX "AiEvaluationRecoveryRecord_originalOpportunityId_idx" ON "AiEvaluationRecoveryRecord"("originalOpportunityId");

-- AddForeignKey
ALTER TABLE "SecurityAuditEventClassification" ADD CONSTRAINT "SecurityAuditEventClassification_securityAuditEventId_fkey" FOREIGN KEY ("securityAuditEventId") REFERENCES "SecurityAuditEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SecurityAuditEventClassification" ADD CONSTRAINT "SecurityAuditEventClassification_classificationBatchId_fkey" FOREIGN KEY ("classificationBatchId") REFERENCES "SecurityAuditClassificationBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FundingOpportunityRecoveryRecord" ADD CONSTRAINT "FundingOpportunityRecoveryRecord_currentOpportunityId_fkey" FOREIGN KEY ("currentOpportunityId") REFERENCES "FundingOpportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiEvaluationRecoveryRecord" ADD CONSTRAINT "AiEvaluationRecoveryRecord_aiEvaluationId_fkey" FOREIGN KEY ("aiEvaluationId") REFERENCES "AiEvaluation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
