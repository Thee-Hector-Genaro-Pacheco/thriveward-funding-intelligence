-- AlterTable
ALTER TABLE "FundingOpportunity" ADD COLUMN     "firstRetrievedAt" TIMESTAMP(3),
ADD COLUMN     "lastRetrievedAt" TIMESTAMP(3),
ALTER COLUMN "officialSourceAuthority" DROP NOT NULL,
ALTER COLUMN "officialSourceAuthority" DROP DEFAULT;

-- Clear default authority from DEMO records
UPDATE "FundingOpportunity" SET "officialSourceAuthority" = NULL WHERE "isDemo" = true;

-- Constraint: Prevent officialSourceAuthority on DEMO records
ALTER TABLE "FundingOpportunity" ADD CONSTRAINT "check_demo_no_authority" CHECK ("isDemo" = false OR "officialSourceAuthority" IS NULL);
