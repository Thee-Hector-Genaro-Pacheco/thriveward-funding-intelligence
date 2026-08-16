-- Phase 1F Prerequisite: Safe idempotent creation of PartnerSourceCitation, PartnerContactChannel, and OpportunityPartnerMatch
-- Allows historical migration 20260813200000_phase1f_final_acceptance to apply cleanly on blank databases
-- while remaining a complete no-op on existing databases (such as bridge_ai_db).

DO $$ BEGIN
    CREATE TYPE "PartnerMatchStatus" AS ENUM ('RESEARCH_REQUIRED', 'POSSIBLE_MATCH', 'CONTACT_APPROVED', 'CONTACTED', 'DISCOVERY_CALL', 'PARTNERSHIP_DISCUSSION', 'MOU_IN_PROGRESS', 'CONFIRMED_PARTNER', 'DECLINED', 'INACTIVE');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

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
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartnerContactChannel_pkey" PRIMARY KEY ("id")
);

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
    "concerns" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "missingInfo" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "recommendedNextStep" TEXT NOT NULL DEFAULT 'Review partnership potential',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OpportunityPartnerMatch_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
    ALTER TABLE "PartnerSourceCitation" ADD CONSTRAINT "PartnerSourceCitation_strategicPartnerCandidateId_fkey" FOREIGN KEY ("strategicPartnerCandidateId") REFERENCES "StrategicPartnerCandidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    ALTER TABLE "PartnerContactChannel" ADD CONSTRAINT "PartnerContactChannel_strategicPartnerCandidateId_fkey" FOREIGN KEY ("strategicPartnerCandidateId") REFERENCES "StrategicPartnerCandidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    ALTER TABLE "OpportunityPartnerMatch" ADD CONSTRAINT "OpportunityPartnerMatch_fundingOpportunityId_fkey" FOREIGN KEY ("fundingOpportunityId") REFERENCES "FundingOpportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    ALTER TABLE "OpportunityPartnerMatch" ADD CONSTRAINT "OpportunityPartnerMatch_strategicPartnerCandidateId_fkey" FOREIGN KEY ("strategicPartnerCandidateId") REFERENCES "StrategicPartnerCandidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
