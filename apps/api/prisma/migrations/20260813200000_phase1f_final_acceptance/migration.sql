-- AlterEnum
ALTER TYPE "RelevanceStatus" ADD VALUE IF NOT EXISTS 'STRONGLY_RELEVANT';

-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "PartnerMatchStatus" AS ENUM ('RESEARCH_REQUIRED', 'POSSIBLE_MATCH', 'CONTACT_APPROVED', 'CONTACTED', 'DISCOVERY_CALL', 'PARTNERSHIP_DISCUSSION', 'MOU_IN_PROGRESS', 'CONFIRMED_PARTNER', 'DECLINED', 'INACTIVE');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "PartnerSourceCitation" (
    "id" TEXT NOT NULL,
    "strategicPartnerCandidateId" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "quotedSection" TEXT,
    "extractedClaim" TEXT NOT NULL,
    "verificationLevel" TEXT NOT NULL DEFAULT 'OFFICIAL_DIRECTORY',
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PartnerSourceCitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "PartnerContactChannel" (
    "id" TEXT NOT NULL,
    "strategicPartnerCandidateId" TEXT NOT NULL,
    "contactValue" TEXT NOT NULL,
    "contactType" TEXT NOT NULL DEFAULT 'EMAIL',
    "purpose" TEXT NOT NULL,
    "purposeCategory" TEXT NOT NULL DEFAULT 'GENERAL',
    "sourceUrl" TEXT NOT NULL,
    "quotedCitation" TEXT NOT NULL,
    "verifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "verificationStatus" TEXT NOT NULL DEFAULT 'VERIFIED_HUMAN_REVIEWED',
    "lastHttpStatus" INTEGER,
    "responseByteCount" INTEGER,
    "responseHash" TEXT,
    "verificationMode" TEXT NOT NULL DEFAULT 'LIVE_HTTP',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartnerContactChannel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "OpportunityPartnerMatch" (
    "id" TEXT NOT NULL,
    "fundingOpportunityId" TEXT NOT NULL,
    "strategicPartnerCandidateId" TEXT NOT NULL,
    "matchScore" INTEGER NOT NULL DEFAULT 0,
    "evidenceCoverage" INTEGER NOT NULL DEFAULT 0,
    "status" "PartnerMatchStatus" NOT NULL DEFAULT 'POSSIBLE_MATCH',
    "humanApproved" BOOLEAN NOT NULL DEFAULT false,
    "alignmentRationale" TEXT NOT NULL,
    "verifiedOfficialRole" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "countiesOverlap" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "overlapCounties" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "coverageScope" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "dimensionBreakdown" JSONB,
    "concerns" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "missingInfo" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "recommendedNextStep" TEXT NOT NULL DEFAULT 'Review partnership potential',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OpportunityPartnerMatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "PartnerWorkflowHistory" (
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
CREATE INDEX IF NOT EXISTS "PartnerWorkflowHistory_strategicPartnerCandidateId_idx" ON "PartnerWorkflowHistory"("strategicPartnerCandidateId");

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "PartnerSourceCitation" ADD CONSTRAINT "PartnerSourceCitation_strategicPartnerCandidateId_fkey" FOREIGN KEY ("strategicPartnerCandidateId") REFERENCES "StrategicPartnerCandidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "PartnerContactChannel" ADD CONSTRAINT "PartnerContactChannel_strategicPartnerCandidateId_fkey" FOREIGN KEY ("strategicPartnerCandidateId") REFERENCES "StrategicPartnerCandidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "OpportunityPartnerMatch" ADD CONSTRAINT "OpportunityPartnerMatch_fundingOpportunityId_fkey" FOREIGN KEY ("fundingOpportunityId") REFERENCES "FundingOpportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "OpportunityPartnerMatch" ADD CONSTRAINT "OpportunityPartnerMatch_strategicPartnerCandidateId_fkey" FOREIGN KEY ("strategicPartnerCandidateId") REFERENCES "StrategicPartnerCandidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "PartnerWorkflowHistory" ADD CONSTRAINT "PartnerWorkflowHistory_strategicPartnerCandidateId_fkey" FOREIGN KEY ("strategicPartnerCandidateId") REFERENCES "StrategicPartnerCandidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
