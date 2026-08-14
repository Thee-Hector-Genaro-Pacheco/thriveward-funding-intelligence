-- AlterEnum
ALTER TYPE "RelevanceStatus" ADD VALUE 'STRONGLY_RELEVANT';

-- AlterTable
ALTER TABLE "OpportunityPartnerMatch" ADD COLUMN     "coverageScope" TEXT NOT NULL DEFAULT 'UNKNOWN',
ADD COLUMN     "dimensionBreakdown" JSONB,
ADD COLUMN     "overlapCounties" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "PartnerContactChannel" ADD COLUMN     "lastHttpStatus" INTEGER,
ADD COLUMN     "responseByteCount" INTEGER,
ADD COLUMN     "responseHash" TEXT,
ADD COLUMN     "verificationMode" TEXT NOT NULL DEFAULT 'LIVE_HTTP';

-- CreateTable
CREATE TABLE "PartnerWorkflowHistory" (
    "id" TEXT NOT NULL,
    "strategicPartnerCandidateId" TEXT NOT NULL,
    "previousStage" "PartnerMatchStatus" NOT NULL,
    "newStage" "PartnerMatchStatus" NOT NULL,
    "performedBy" TEXT NOT NULL DEFAULT 'HUMAN_OPERATOR',
    "reason" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PartnerWorkflowHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PartnerWorkflowHistory_strategicPartnerCandidateId_idx" ON "PartnerWorkflowHistory"("strategicPartnerCandidateId");

-- AddForeignKey
ALTER TABLE "PartnerWorkflowHistory" ADD CONSTRAINT "PartnerWorkflowHistory_strategicPartnerCandidateId_fkey" FOREIGN KEY ("strategicPartnerCandidateId") REFERENCES "StrategicPartnerCandidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
