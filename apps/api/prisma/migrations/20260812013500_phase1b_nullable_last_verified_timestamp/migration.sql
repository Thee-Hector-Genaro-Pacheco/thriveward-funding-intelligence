-- AlterTable
ALTER TABLE "FundingOpportunity" ALTER COLUMN "lastVerifiedTimestamp" DROP NOT NULL,
ALTER COLUMN "lastVerifiedTimestamp" DROP DEFAULT;

-- Clear auto-default lastVerifiedTimestamp on records pending human review
UPDATE "FundingOpportunity" SET "lastVerifiedTimestamp" = NULL WHERE "verificationStatus" = 'PENDING_HUMAN_REVIEW';
