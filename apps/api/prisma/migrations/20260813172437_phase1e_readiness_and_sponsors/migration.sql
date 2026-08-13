-- CreateEnum
CREATE TYPE "SponsorMatchStatus" AS ENUM ('RESEARCH_REQUIRED', 'POSSIBLE_MATCH', 'CONTACT_APPROVED', 'CONTACTED', 'DISCOVERY_CALL', 'APPLICATION_SUBMITTED', 'ACCEPTED', 'DECLINED', 'INACTIVE');

-- CreateEnum
CREATE TYPE "RecurrenceConfidence" AS ENUM ('CONFIRMED_FORECAST', 'HISTORICALLY_RECURRING', 'POSSIBLY_RECURRING', 'ONE_TIME_OR_UNKNOWN');

-- CreateEnum
CREATE TYPE "PlanTaskStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'BLOCKED');

-- AlterTable
ALTER TABLE "OpportunityAnalysis" ALTER COLUMN "profileVersion" SET DEFAULT '1.1.0-phase1d',
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateTable
CREATE TABLE "FiscalSponsorCandidate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "websiteUrl" TEXT NOT NULL,
    "directorySourceUrl" TEXT NOT NULL,
    "geography" TEXT NOT NULL,
    "mission" TEXT NOT NULL,
    "populationsServed" TEXT[],
    "modelsOffered" TEXT[],
    "acceptingNewProjects" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "applicationProcess" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "estimatedReviewTime" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "setupFee" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "adminPercentage" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "minRevenueRequirement" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "administersGovGrants" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "federalGrantCapability" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "samUeiStatus" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "contactChannel" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "verificationStatus" TEXT NOT NULL DEFAULT 'PENDING_HUMAN_REVIEW',
    "lastVerifiedTimestamp" TIMESTAMP(3),
    "internalNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FiscalSponsorCandidate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SponsorSourceCitation" (
    "id" TEXT NOT NULL,
    "fiscalSponsorCandidateId" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "quotedSection" TEXT,
    "extractedClaim" TEXT NOT NULL,
    "verificationDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SponsorSourceCitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StrategicPartnerCandidate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "organizationType" TEXT NOT NULL,
    "websiteUrl" TEXT NOT NULL,
    "geography" TEXT NOT NULL,
    "mission" TEXT NOT NULL,
    "servicesOffered" TEXT[],
    "collaborationFocus" TEXT NOT NULL,
    "contactChannel" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "verificationStatus" TEXT NOT NULL DEFAULT 'PENDING_HUMAN_REVIEW',
    "lastVerified" TIMESTAMP(3),
    "internalNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StrategicPartnerCandidate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OpportunitySponsorMatch" (
    "id" TEXT NOT NULL,
    "fundingOpportunityId" TEXT NOT NULL,
    "fiscalSponsorCandidateId" TEXT NOT NULL,
    "matchScore" INTEGER NOT NULL DEFAULT 0,
    "evidenceCoverage" INTEGER NOT NULL DEFAULT 0,
    "matchedLanes" TEXT[],
    "status" "SponsorMatchStatus" NOT NULL DEFAULT 'POSSIBLE_MATCH',
    "humanApproved" BOOLEAN NOT NULL DEFAULT false,
    "alignmentRationale" TEXT NOT NULL,
    "legalApplicantCapability" TEXT NOT NULL,
    "govGrantAdminCapability" TEXT NOT NULL,
    "arrangementAllowed" TEXT NOT NULL,
    "feeAndLeadTimeNotes" TEXT NOT NULL,
    "humanConfirmationRequired" TEXT[],
    "concerns" TEXT[],
    "missingInfo" TEXT[],
    "recommendedNextStep" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OpportunitySponsorMatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OpportunityReadinessPlan" (
    "id" TEXT NOT NULL,
    "fundingOpportunityId" TEXT NOT NULL,
    "targetNextCycle" TEXT NOT NULL,
    "currentBlocker" TEXT NOT NULL,
    "requiredRegistrations" TEXT[],
    "fiscalSponsorOrPartnerRequirements" TEXT[],
    "operatingHistoryAndCapacityGaps" TEXT[],
    "requiredDocuments" TEXT[],
    "matchFundStrategy" TEXT NOT NULL,
    "responsibleOwner" TEXT NOT NULL DEFAULT 'Unassigned',
    "targetCompletionDate" TIMESTAMP(3),
    "isComplete" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OpportunityReadinessPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReadinessPlanTask" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "responsibleOwner" TEXT NOT NULL DEFAULT 'Unassigned',
    "targetDate" TIMESTAMP(3),
    "status" "PlanTaskStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "sourceEvidence" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReadinessPlanTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReadinessPlanHistory" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "fromStatus" TEXT NOT NULL,
    "toStatus" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReadinessPlanHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GrantCalendarItem" (
    "id" TEXT NOT NULL,
    "fundingOpportunityId" TEXT,
    "opportunityTitle" TEXT NOT NULL,
    "agency" TEXT NOT NULL,
    "forecastedPostDate" TIMESTAMP(3),
    "postedDate" TIMESTAMP(3),
    "deadline" TIMESTAMP(3),
    "priorCycleDates" TEXT[],
    "recurrenceConfidence" "RecurrenceConfidence" NOT NULL DEFAULT 'POSSIBLY_RECURRING',
    "expectedNextCyclePrepDate" TIMESTAMP(3),
    "recurrenceEvidenceSource" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GrantCalendarItem_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "SponsorSourceCitation" ADD CONSTRAINT "SponsorSourceCitation_fiscalSponsorCandidateId_fkey" FOREIGN KEY ("fiscalSponsorCandidateId") REFERENCES "FiscalSponsorCandidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpportunitySponsorMatch" ADD CONSTRAINT "OpportunitySponsorMatch_fundingOpportunityId_fkey" FOREIGN KEY ("fundingOpportunityId") REFERENCES "FundingOpportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpportunitySponsorMatch" ADD CONSTRAINT "OpportunitySponsorMatch_fiscalSponsorCandidateId_fkey" FOREIGN KEY ("fiscalSponsorCandidateId") REFERENCES "FiscalSponsorCandidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpportunityReadinessPlan" ADD CONSTRAINT "OpportunityReadinessPlan_fundingOpportunityId_fkey" FOREIGN KEY ("fundingOpportunityId") REFERENCES "FundingOpportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReadinessPlanTask" ADD CONSTRAINT "ReadinessPlanTask_planId_fkey" FOREIGN KEY ("planId") REFERENCES "OpportunityReadinessPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReadinessPlanHistory" ADD CONSTRAINT "ReadinessPlanHistory_planId_fkey" FOREIGN KEY ("planId") REFERENCES "OpportunityReadinessPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GrantCalendarItem" ADD CONSTRAINT "GrantCalendarItem_fundingOpportunityId_fkey" FOREIGN KEY ("fundingOpportunityId") REFERENCES "FundingOpportunity"("id") ON DELETE SET NULL ON UPDATE CASCADE;
