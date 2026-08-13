-- CreateEnum
CREATE TYPE "RelevanceStatus" AS ENUM ('RELEVANT', 'POSSIBLY_RELEVANT', 'IRRELEVANT', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "PursuitStage" AS ENUM ('NEW', 'REVIEWING', 'QUALIFIED', 'LOCKED', 'DISMISSED');

-- AlterTable
ALTER TABLE "FundingOpportunity" ADD COLUMN "pursuitStage" "PursuitStage" NOT NULL DEFAULT 'NEW',
ADD COLUMN "dismissedReason" TEXT,
ADD COLUMN "discoverySearchTerms" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "OpportunityRelevance" (
    "id" TEXT NOT NULL,
    "fundingOpportunityId" TEXT NOT NULL,
    "relevanceStatus" "RelevanceStatus" NOT NULL DEFAULT 'UNKNOWN',
    "relevanceScore" INTEGER NOT NULL DEFAULT 0,
    "positiveReasons" TEXT[],
    "exclusionReasons" TEXT[],
    "explanation" TEXT NOT NULL,
    "evidenceFields" TEXT[],
    "analysisVersion" TEXT NOT NULL DEFAULT '1.0',
    "profileVersion" TEXT NOT NULL DEFAULT '1.1.0-phase1d',
    "profileHash" TEXT NOT NULL,
    "isCurrent" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OpportunityRelevance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RelevanceCitation" (
    "id" TEXT NOT NULL,
    "opportunityRelevanceId" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "matchedTerm" TEXT NOT NULL,
    "contextSnippet" TEXT NOT NULL,

    CONSTRAINT "RelevanceCitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PursuitHistory" (
    "id" TEXT NOT NULL,
    "fundingOpportunityId" TEXT NOT NULL,
    "fromStage" "PursuitStage" NOT NULL,
    "toStage" "PursuitStage" NOT NULL,
    "actorId" TEXT NOT NULL,
    "notes" TEXT,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PursuitHistory_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "OpportunityRelevance" ADD CONSTRAINT "OpportunityRelevance_fundingOpportunityId_fkey" FOREIGN KEY ("fundingOpportunityId") REFERENCES "FundingOpportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RelevanceCitation" ADD CONSTRAINT "RelevanceCitation_opportunityRelevanceId_fkey" FOREIGN KEY ("opportunityRelevanceId") REFERENCES "OpportunityRelevance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PursuitHistory" ADD CONSTRAINT "PursuitHistory_fundingOpportunityId_fkey" FOREIGN KEY ("fundingOpportunityId") REFERENCES "FundingOpportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
