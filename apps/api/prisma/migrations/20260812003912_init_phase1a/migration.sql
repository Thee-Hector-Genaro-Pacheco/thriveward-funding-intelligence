-- CreateEnum
CREATE TYPE "EligibilityStatus" AS ENUM ('HIGH_PRIORITY', 'INVESTIGATE', 'FUTURE_OPPORTUNITY', 'NOT_ELIGIBLE');

-- CreateEnum
CREATE TYPE "TriStateStatus" AS ENUM ('YES', 'NO', 'CONDITIONAL', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "OpportunityStatus" AS ENUM ('EXTRACTED', 'PENDING_HUMAN_REVIEW', 'VERIFIED', 'ARCHIVED');

-- CreateTable
CREATE TABLE "OrganizationProfile" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Bridge Forward Foundation',
    "status" TEXT NOT NULL DEFAULT 'PRE_INCORPORATION',
    "taxStatus" TEXT NOT NULL DEFAULT 'NOT_OBTAINED',
    "primaryPopulations" TEXT[],
    "primaryOutcome" TEXT NOT NULL,
    "coreModel" TEXT NOT NULL,
    "limitations" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganizationProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Program" (
    "id" TEXT NOT NULL,
    "organizationProfileId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "isOperational" BOOLEAN NOT NULL DEFAULT true,
    "keyFocus" TEXT,

    CONSTRAINT "Program_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FundingSource" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "agencyType" TEXT NOT NULL,
    "websiteUrl" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FundingSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FundingOpportunity" (
    "id" TEXT NOT NULL,
    "fundingSourceId" TEXT,
    "title" TEXT NOT NULL,
    "fundingAgency" TEXT NOT NULL,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "program" TEXT,
    "description" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "status" "OpportunityStatus" NOT NULL DEFAULT 'PENDING_HUMAN_REVIEW',
    "openingDate" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "deadline" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "awardMin" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "awardMax" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "totalAvailableFunding" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "geography" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "eligibleApplicantTypes" TEXT[],
    "eligiblePopulations" TEXT[],
    "matchRequirement" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "periodOfPerformance" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "allowableCosts" TEXT[],
    "prohibitedCosts" TEXT[],
    "participantCompensationRules" TEXT,
    "requiredPartnerships" TEXT,
    "operatingHistoryRequirements" TEXT,
    "lastVerifiedTimestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "supportTrainingStipends" "TriStateStatus" NOT NULL DEFAULT 'UNKNOWN',
    "supportNeedsRelatedPayments" "TriStateStatus" NOT NULL DEFAULT 'UNKNOWN',
    "supportTransportation" "TriStateStatus" NOT NULL DEFAULT 'UNKNOWN',
    "supportMeals" "TriStateStatus" NOT NULL DEFAULT 'UNKNOWN',
    "supportChildcare" "TriStateStatus" NOT NULL DEFAULT 'UNKNOWN',
    "supportTools" "TriStateStatus" NOT NULL DEFAULT 'UNKNOWN',
    "supportPPE" "TriStateStatus" NOT NULL DEFAULT 'UNKNOWN',
    "supportWorkClothing" "TriStateStatus" NOT NULL DEFAULT 'UNKNOWN',
    "supportLaptops" "TriStateStatus" NOT NULL DEFAULT 'UNKNOWN',
    "supportTrainingEquipment" "TriStateStatus" NOT NULL DEFAULT 'UNKNOWN',
    "supportCertifications" "TriStateStatus" NOT NULL DEFAULT 'UNKNOWN',
    "supportPaidWorkExperience" "TriStateStatus" NOT NULL DEFAULT 'UNKNOWN',
    "supportSubsidizedEmployment" "TriStateStatus" NOT NULL DEFAULT 'UNKNOWN',
    "supportOnTheJobTraining" "TriStateStatus" NOT NULL DEFAULT 'UNKNOWN',
    "supportEmergencyAssistance" "TriStateStatus" NOT NULL DEFAULT 'UNKNOWN',

    CONSTRAINT "FundingOpportunity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EligibilityRequirement" (
    "id" TEXT NOT NULL,
    "fundingOpportunityId" TEXT NOT NULL,
    "criteriaCategory" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "isMandatory" BOOLEAN NOT NULL DEFAULT true,
    "verifiedStatus" "TriStateStatus" NOT NULL DEFAULT 'UNKNOWN',
    "notes" TEXT,

    CONSTRAINT "EligibilityRequirement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AllowableCost" (
    "id" TEXT NOT NULL,
    "fundingOpportunityId" TEXT NOT NULL,
    "costCategory" TEXT NOT NULL,
    "isAllowable" "TriStateStatus" NOT NULL DEFAULT 'UNKNOWN',
    "restrictions" TEXT,
    "citationRefId" TEXT,

    CONSTRAINT "AllowableCost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RequiredDocument" (
    "id" TEXT NOT NULL,
    "fundingOpportunityId" TEXT NOT NULL,
    "documentName" TEXT NOT NULL,
    "description" TEXT,
    "isMandatory" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "RequiredDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScoringCriterion" (
    "id" TEXT NOT NULL,
    "fundingOpportunityId" TEXT NOT NULL,
    "criterionName" TEXT NOT NULL,
    "maxPoints" INTEGER,
    "description" TEXT,
    "evaluationFocus" TEXT,

    CONSTRAINT "ScoringCriterion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SourceCitation" (
    "id" TEXT NOT NULL,
    "fundingOpportunityId" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "sourceTitle" TEXT,
    "sourceOrganization" TEXT,
    "verificationDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "quotedSection" TEXT,
    "extractedClaim" TEXT NOT NULL,

    CONSTRAINT "SourceCitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OpportunityAnalysis" (
    "id" TEXT NOT NULL,
    "fundingOpportunityId" TEXT NOT NULL,
    "overallFitScore" INTEGER NOT NULL,
    "eligibilityStatus" "EligibilityStatus" NOT NULL,
    "missingEligibilityRequirements" TEXT[],
    "missingCapabilities" TEXT[],
    "reasoningSummary" TEXT NOT NULL,
    "missionAlignmentScore" INTEGER NOT NULL DEFAULT 0,
    "populationAlignmentScore" INTEGER NOT NULL DEFAULT 0,
    "programAlignmentScore" INTEGER NOT NULL DEFAULT 0,
    "geographicEligibilityScore" INTEGER NOT NULL DEFAULT 0,
    "applicantEligibilityScore" INTEGER NOT NULL DEFAULT 0,
    "taxStatusEligibilityScore" INTEGER NOT NULL DEFAULT 0,
    "organizationalMaturityScore" INTEGER NOT NULL DEFAULT 0,
    "requiredPartnershipsScore" INTEGER NOT NULL DEFAULT 0,
    "allowableCostAlignmentScore" INTEGER NOT NULL DEFAULT 0,
    "awardSizeSuitabilityScore" INTEGER NOT NULL DEFAULT 0,
    "deadlineFeasibilityScore" INTEGER NOT NULL DEFAULT 0,
    "evidenceTrackRecordScore" INTEGER NOT NULL DEFAULT 0,
    "humanReviewRequired" BOOLEAN NOT NULL DEFAULT true,
    "humanReviewedAt" TIMESTAMP(3),
    "humanReviewedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OpportunityAnalysis_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Program" ADD CONSTRAINT "Program_organizationProfileId_fkey" FOREIGN KEY ("organizationProfileId") REFERENCES "OrganizationProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FundingOpportunity" ADD CONSTRAINT "FundingOpportunity_fundingSourceId_fkey" FOREIGN KEY ("fundingSourceId") REFERENCES "FundingSource"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EligibilityRequirement" ADD CONSTRAINT "EligibilityRequirement_fundingOpportunityId_fkey" FOREIGN KEY ("fundingOpportunityId") REFERENCES "FundingOpportunity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AllowableCost" ADD CONSTRAINT "AllowableCost_fundingOpportunityId_fkey" FOREIGN KEY ("fundingOpportunityId") REFERENCES "FundingOpportunity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequiredDocument" ADD CONSTRAINT "RequiredDocument_fundingOpportunityId_fkey" FOREIGN KEY ("fundingOpportunityId") REFERENCES "FundingOpportunity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScoringCriterion" ADD CONSTRAINT "ScoringCriterion_fundingOpportunityId_fkey" FOREIGN KEY ("fundingOpportunityId") REFERENCES "FundingOpportunity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceCitation" ADD CONSTRAINT "SourceCitation_fundingOpportunityId_fkey" FOREIGN KEY ("fundingOpportunityId") REFERENCES "FundingOpportunity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpportunityAnalysis" ADD CONSTRAINT "OpportunityAnalysis_fundingOpportunityId_fkey" FOREIGN KEY ("fundingOpportunityId") REFERENCES "FundingOpportunity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
