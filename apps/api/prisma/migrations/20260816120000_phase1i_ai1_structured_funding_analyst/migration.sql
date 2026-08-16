-- CreateEnum
CREATE TYPE "AiEvaluationStatus" AS ENUM ('GENERATED', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "AiEligibilityRating" AS ENUM ('LIKELY_ELIGIBLE', 'POSSIBLY_ELIGIBLE', 'UNLIKELY_ELIGIBLE', 'INSUFFICIENT_INFORMATION');

-- CreateTable
CREATE TABLE "AiEvaluation" (
    "id" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" "AiEvaluationStatus" NOT NULL DEFAULT 'GENERATED',
    "alignmentScore" INTEGER NOT NULL,
    "eligibility" "AiEligibilityRating" NOT NULL,
    "summary" TEXT NOT NULL,
    "strengths" JSONB NOT NULL,
    "risks" JSONB NOT NULL,
    "requirements" JSONB NOT NULL,
    "recommendedNextAction" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "limitations" TEXT[],
    "evidenceSnapshot" JSONB NOT NULL,
    "inputSnapshot" JSONB NOT NULL,
    "inputHash" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'OPENAI',
    "model" TEXT NOT NULL DEFAULT 'gpt-5.6-luna',
    "promptVersion" TEXT NOT NULL DEFAULT 'funding-analyst-v1',
    "providerResponseId" TEXT,
    "inputTokenCount" INTEGER,
    "outputTokenCount" INTEGER,
    "generatedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedByUserId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewReason" TEXT,

    CONSTRAINT "AiEvaluation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AiEvaluation_opportunityId_version_idx" ON "AiEvaluation"("opportunityId", "version");

-- CreateIndex
CREATE INDEX "AiEvaluation_generatedByUserId_idx" ON "AiEvaluation"("generatedByUserId");

-- CreateIndex
CREATE INDEX "AiEvaluation_status_idx" ON "AiEvaluation"("status");

-- AddForeignKey
ALTER TABLE "AiEvaluation" ADD CONSTRAINT "AiEvaluation_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "FundingOpportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiEvaluation" ADD CONSTRAINT "AiEvaluation_generatedByUserId_fkey" FOREIGN KEY ("generatedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiEvaluation" ADD CONSTRAINT "AiEvaluation_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
