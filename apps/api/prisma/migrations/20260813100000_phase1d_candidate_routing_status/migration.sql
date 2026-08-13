-- CreateEnum
CREATE TYPE "CandidateRoutingStatus" AS ENUM (
  'DIRECT_FEDERAL_ELIGIBLE',
  'FISCAL_SPONSOR_REQUIRED',
  'PARTNERSHIP_REQUIRED',
  'FUTURE_OPPORTUNITY',
  'EXCLUDED'
);

-- AlterTable
ALTER TABLE "FundingOpportunity" ADD COLUMN "candidateRoutingStatus" "CandidateRoutingStatus";

-- CreateIndex
CREATE INDEX "FundingOpportunity_candidateRoutingStatus_idx" ON "FundingOpportunity"("candidateRoutingStatus");
