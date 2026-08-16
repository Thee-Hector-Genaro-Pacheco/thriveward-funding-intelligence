-- CreateTable
CREATE TABLE "FundingDocumentIdempotency" (
    "id" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "authenticatedUserId" TEXT NOT NULL,
    "documentTitle" TEXT NOT NULL,
    "payloadSha256" TEXT NOT NULL,
    "resultingDocumentId" TEXT,
    "resultingVersionId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PROCESSING',
    "responsePayload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "FundingDocumentIdempotency_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FundingDocumentIdempotency_opportunityId_payloadSha256_idx" ON "FundingDocumentIdempotency"("opportunityId", "payloadSha256");

-- CreateIndex
CREATE INDEX "FundingDocumentIdempotency_authenticatedUserId_idx" ON "FundingDocumentIdempotency"("authenticatedUserId");

-- CreateIndex
CREATE UNIQUE INDEX "FundingDocumentIdempotency_opportunityId_idempotencyKey_key" ON "FundingDocumentIdempotency"("opportunityId", "idempotencyKey");
