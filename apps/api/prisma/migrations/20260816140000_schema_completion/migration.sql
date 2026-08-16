-- Phase 1J Forward Schema Completion Migration
-- Idempotently synchronizes all un-migrated DDL elements to achieve 100% exact alignment with schema.prisma

-- 1. FundingOpportunity Schema Completion
ALTER TABLE "FundingOpportunity" ADD COLUMN IF NOT EXISTS "currentCycleStatus" TEXT DEFAULT 'ACTIVE';
ALTER TABLE "FundingOpportunity" ADD COLUMN IF NOT EXISTS "hasSourceConflict" BOOLEAN NOT NULL DEFAULT false;

-- 2. Defaults Alignment
ALTER TABLE "OrganizationProfile" ALTER COLUMN "name" SET DEFAULT 'Project Thriveward';
ALTER TABLE "OutreachDraftVersion" ALTER COLUMN "creatorActorName" SET DEFAULT 'Thriveward Funding Intelligence Agent';
ALTER TABLE "PartnerContactChannel" ALTER COLUMN "purposeCategory" SET DEFAULT 'GRANT_COMPETITION';

-- 3. StrategicPartnerCandidate Schema Completion
ALTER TABLE "StrategicPartnerCandidate" ADD COLUMN IF NOT EXISTS "legalOrganizationName" TEXT NOT NULL DEFAULT 'UNKNOWN';
ALTER TABLE "StrategicPartnerCandidate" ADD COLUMN IF NOT EXISTS "cocNumber" TEXT NOT NULL DEFAULT 'UNKNOWN';
ALTER TABLE "StrategicPartnerCandidate" ADD COLUMN IF NOT EXISTS "officialDirectoryUrl" TEXT NOT NULL DEFAULT 'UNKNOWN';
ALTER TABLE "StrategicPartnerCandidate" ADD COLUMN IF NOT EXISTS "countiesServed" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "StrategicPartnerCandidate" ADD COLUMN IF NOT EXISTS "collaborativeApplicantOrg" TEXT NOT NULL DEFAULT 'UNKNOWN';
ALTER TABLE "StrategicPartnerCandidate" ADD COLUMN IF NOT EXISTS "leadAgency" TEXT NOT NULL DEFAULT 'UNKNOWN';
ALTER TABLE "StrategicPartnerCandidate" ADD COLUMN IF NOT EXISTS "verifiedOfficialRole" TEXT NOT NULL DEFAULT 'UNKNOWN';
ALTER TABLE "StrategicPartnerCandidate" ADD COLUMN IF NOT EXISTS "applicationCoordinatedEntryRole" TEXT NOT NULL DEFAULT 'UNKNOWN';
ALTER TABLE "StrategicPartnerCandidate" ADD COLUMN IF NOT EXISTS "currentCycleParticipationInfo" TEXT NOT NULL DEFAULT 'UNKNOWN';
ALTER TABLE "StrategicPartnerCandidate" ADD COLUMN IF NOT EXISTS "isFixture" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "StrategicPartnerCandidate" ADD COLUMN IF NOT EXISTS "hasLiveVerification" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "StrategicPartnerCandidate" ADD COLUMN IF NOT EXISTS "status" "PartnerMatchStatus" NOT NULL DEFAULT 'RESEARCH_REQUIRED';

-- 4. Index Alignment & Guarded Index Rename
CREATE INDEX IF NOT EXISTS "PartnerContactChannel_strategicPartnerCandidateId_idx" ON "PartnerContactChannel"("strategicPartnerCandidateId");

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relname = 'OutreachEngagement_strategicPartnerCandidateId_fundingOpportuni'
          AND n.nspname = 'public'
    ) AND NOT EXISTS (
        SELECT 1 FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relname = 'OutreachEngagement_strategicPartnerCandidateId_fundingOppor_key'
          AND n.nspname = 'public'
    ) THEN
        ALTER INDEX "OutreachEngagement_strategicPartnerCandidateId_fundingOpportuni"
        RENAME TO "OutreachEngagement_strategicPartnerCandidateId_fundingOppor_key";
    END IF;
END $$;
