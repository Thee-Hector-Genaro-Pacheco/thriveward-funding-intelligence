-- AlterTable
ALTER TABLE "OpportunityAnalysis" ADD COLUMN     "analysisVersion" TEXT NOT NULL DEFAULT '1.0',
ADD COLUMN     "eligibilityDecision" TEXT NOT NULL DEFAULT 'INVESTIGATE',
ADD COLUMN     "evidenceCoverage" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "isCurrent" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "profileHash" TEXT NOT NULL,
ADD COLUMN     "profileSnapshot" JSONB NOT NULL,
ADD COLUMN     "profileVersion" TEXT NOT NULL DEFAULT '1.0.0-phase0',
ADD COLUMN     "recommendation" TEXT NOT NULL DEFAULT 'INVESTIGATE',
ADD COLUMN     "reviewStatus" TEXT NOT NULL DEFAULT 'PENDING_HUMAN_REVIEW',
ADD COLUMN     "reviewedAt" TIMESTAMP(3),
ADD COLUMN     "reviewerId" TEXT,
ADD COLUMN     "reviewerNotes" TEXT,
ADD COLUMN     "sourceFingerprint" TEXT NOT NULL,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ALTER COLUMN "overallFitScore" SET DEFAULT 0,
ALTER COLUMN "eligibilityStatus" SET DEFAULT 'INVESTIGATE',
ALTER COLUMN "reasoningSummary" SET DEFAULT 'Analysis pending.';

-- CreateTable
CREATE TABLE "EligibilityFinding" (
    "id" TEXT NOT NULL,
    "opportunityAnalysisId" TEXT NOT NULL,
    "criterionKey" TEXT NOT NULL,
    "criterionText" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "remediable" BOOLEAN NOT NULL DEFAULT false,
    "rationale" TEXT NOT NULL,
    "evidenceStatus" TEXT NOT NULL,
    "sourceCitationId" TEXT,
    "evidenceQuote" TEXT,

    CONSTRAINT "EligibilityFinding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnalysisDimension" (
    "id" TEXT NOT NULL,
    "opportunityAnalysisId" TEXT NOT NULL,
    "dimensionKey" TEXT NOT NULL,
    "weight" INTEGER NOT NULL,
    "matchStatus" TEXT NOT NULL,
    "scoreAwarded" INTEGER NOT NULL,
    "rationale" TEXT NOT NULL,
    "evidenceStatus" TEXT NOT NULL,
    "sourceCitationId" TEXT,
    "evidenceQuote" TEXT,

    CONSTRAINT "AnalysisDimension_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParticipantSupportFinding" (
    "id" TEXT NOT NULL,
    "opportunityAnalysisId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "automatedStatus" "TriStateStatus" NOT NULL DEFAULT 'UNKNOWN',
    "automatedRationale" TEXT NOT NULL,
    "evidenceStatus" TEXT NOT NULL,
    "sourceCitationId" TEXT,
    "evidenceQuote" TEXT,
    "humanOverrideStatus" "TriStateStatus",
    "humanOverrideNotes" TEXT,
    "humanOverrideReviewerId" TEXT,
    "humanOverrideAt" TIMESTAMP(3),

    CONSTRAINT "ParticipantSupportFinding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnalysisReview" (
    "id" TEXT NOT NULL,
    "opportunityAnalysisId" TEXT NOT NULL,
    "decision" TEXT NOT NULL,
    "reviewerId" TEXT NOT NULL,
    "reviewerNotes" TEXT NOT NULL,
    "reviewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnalysisReview_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AnalysisDimension_opportunityAnalysisId_dimensionKey_key" ON "AnalysisDimension"("opportunityAnalysisId", "dimensionKey");
CREATE UNIQUE INDEX "ParticipantSupportFinding_opportunityAnalysisId_category_key" ON "ParticipantSupportFinding"("opportunityAnalysisId", "category");

-- OpportunityAnalysis CHECK Constraints
ALTER TABLE "OpportunityAnalysis" ADD CONSTRAINT "check_opp_analysis_fit_score" CHECK ("overallFitScore" >= 0 AND "overallFitScore" <= 100);
ALTER TABLE "OpportunityAnalysis" ADD CONSTRAINT "check_opp_analysis_evidence_coverage" CHECK ("evidenceCoverage" >= 0 AND "evidenceCoverage" <= 100);
ALTER TABLE "OpportunityAnalysis" ADD CONSTRAINT "check_opp_analysis_source_fingerprint_hex" CHECK ("sourceFingerprint" ~ '^[0-9a-f]{64}$');
ALTER TABLE "OpportunityAnalysis" ADD CONSTRAINT "check_opp_analysis_profile_hash_hex" CHECK ("profileHash" ~ '^[0-9a-f]{64}$');
ALTER TABLE "OpportunityAnalysis" ADD CONSTRAINT "check_opp_analysis_source_fingerprint_not_zero" CHECK ("sourceFingerprint" != '0000000000000000000000000000000000000000000000000000000000000000');
ALTER TABLE "OpportunityAnalysis" ADD CONSTRAINT "check_opp_analysis_profile_hash_not_zero" CHECK ("profileHash" != '0000000000000000000000000000000000000000000000000000000000000000');
ALTER TABLE "OpportunityAnalysis" ADD CONSTRAINT "check_opp_analysis_analysis_version_nonempty" CHECK (length(trim("analysisVersion")) > 0);
ALTER TABLE "OpportunityAnalysis" ADD CONSTRAINT "check_opp_analysis_profile_version_nonempty" CHECK (length(trim("profileVersion")) > 0);
ALTER TABLE "OpportunityAnalysis" ADD CONSTRAINT "check_opp_analysis_profile_snapshot_nonempty" CHECK ("profileSnapshot"::text != '{}' AND "profileSnapshot"::text != 'null');
ALTER TABLE "OpportunityAnalysis" ADD CONSTRAINT "check_opp_analysis_review_consistency" CHECK (
  ("reviewStatus" = 'PENDING_HUMAN_REVIEW' AND "reviewedAt" IS NULL AND "reviewerId" IS NULL AND "reviewerNotes" IS NULL) OR
  ("reviewStatus" = 'HUMAN_REVIEWED' AND "reviewedAt" IS NOT NULL AND "reviewerId" IS NOT NULL AND length(trim("reviewerId")) > 0 AND "reviewerNotes" IS NOT NULL AND length(trim("reviewerNotes")) > 0)
);

-- Partial Unique Index (exactly one current analysis per opportunity)
CREATE UNIQUE INDEX "unique_current_analysis_per_opportunity" ON "OpportunityAnalysis" ("fundingOpportunityId") WHERE "isCurrent" = true;

-- AnalysisDimension CHECK Constraints
ALTER TABLE "AnalysisDimension" ADD CONSTRAINT "check_dimension_weight_range" CHECK ("weight" >= 1 AND "weight" <= 100);
ALTER TABLE "AnalysisDimension" ADD CONSTRAINT "check_dimension_score_awarded_range" CHECK ("scoreAwarded" >= 0 AND "scoreAwarded" <= "weight");
ALTER TABLE "AnalysisDimension" ADD CONSTRAINT "check_dimension_evidence_consistency" CHECK (
  ("matchStatus" = 'UNKNOWN' AND "evidenceStatus" = 'MISSING_EVIDENCE' AND "sourceCitationId" IS NULL AND "evidenceQuote" IS NULL) OR
  ("matchStatus" IN ('MATCH', 'PARTIAL', 'MISMATCH') AND "evidenceStatus" = 'EVIDENCE_PRESENT' AND "sourceCitationId" IS NOT NULL AND "evidenceQuote" IS NOT NULL AND length(trim("evidenceQuote")) > 0)
);

-- EligibilityFinding CHECK Constraints
ALTER TABLE "EligibilityFinding" ADD CONSTRAINT "check_eligibility_finding_evidence_consistency" CHECK (
  ("outcome" = 'UNKNOWN' AND "evidenceStatus" = 'MISSING_EVIDENCE' AND "sourceCitationId" IS NULL AND "evidenceQuote" IS NULL) OR
  ("outcome" IN ('SATISFIED', 'FAILED') AND "evidenceStatus" = 'EVIDENCE_PRESENT' AND "sourceCitationId" IS NOT NULL AND "evidenceQuote" IS NOT NULL AND length(trim("evidenceQuote")) > 0)
);

-- ParticipantSupportFinding CHECK Constraints
ALTER TABLE "ParticipantSupportFinding" ADD CONSTRAINT "check_ps_finding_evidence_consistency" CHECK (
  ("automatedStatus" = 'UNKNOWN' AND "evidenceStatus" = 'MISSING_EVIDENCE' AND "sourceCitationId" IS NULL AND "evidenceQuote" IS NULL) OR
  ("automatedStatus" IN ('YES', 'NO', 'CONDITIONAL') AND "evidenceStatus" = 'EVIDENCE_PRESENT' AND "sourceCitationId" IS NOT NULL AND "evidenceQuote" IS NOT NULL AND length(trim("evidenceQuote")) > 0)
);
ALTER TABLE "ParticipantSupportFinding" ADD CONSTRAINT "check_ps_finding_override_consistency" CHECK (
  ("humanOverrideStatus" IS NULL AND "humanOverrideNotes" IS NULL AND "humanOverrideReviewerId" IS NULL AND "humanOverrideAt" IS NULL) OR
  ("humanOverrideStatus" IS NOT NULL AND "humanOverrideNotes" IS NOT NULL AND length(trim("humanOverrideNotes")) > 0 AND "humanOverrideReviewerId" IS NOT NULL AND length(trim("humanOverrideReviewerId")) > 0 AND "humanOverrideAt" IS NOT NULL)
);

-- AnalysisReview CHECK Constraints
ALTER TABLE "AnalysisReview" ADD CONSTRAINT "check_analysis_review_fields" CHECK (
  "decision" IN ('APPROVED', 'REJECTED', 'FLAGGED') AND
  length(trim("reviewerId")) > 0 AND
  length(trim("reviewerNotes")) > 0 AND
  "reviewedAt" IS NOT NULL
);

-- AddForeignKey
ALTER TABLE "OpportunityAnalysis" DROP CONSTRAINT IF EXISTS "OpportunityAnalysis_fundingOpportunityId_fkey";
ALTER TABLE "OpportunityAnalysis" ADD CONSTRAINT "OpportunityAnalysis_fundingOpportunityId_fkey" FOREIGN KEY ("fundingOpportunityId") REFERENCES "FundingOpportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EligibilityFinding" ADD CONSTRAINT "EligibilityFinding_opportunityAnalysisId_fkey" FOREIGN KEY ("opportunityAnalysisId") REFERENCES "OpportunityAnalysis"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EligibilityFinding" ADD CONSTRAINT "EligibilityFinding_sourceCitationId_fkey" FOREIGN KEY ("sourceCitationId") REFERENCES "SourceCitation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AnalysisDimension" ADD CONSTRAINT "AnalysisDimension_opportunityAnalysisId_fkey" FOREIGN KEY ("opportunityAnalysisId") REFERENCES "OpportunityAnalysis"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AnalysisDimension" ADD CONSTRAINT "AnalysisDimension_sourceCitationId_fkey" FOREIGN KEY ("sourceCitationId") REFERENCES "SourceCitation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ParticipantSupportFinding" ADD CONSTRAINT "ParticipantSupportFinding_opportunityAnalysisId_fkey" FOREIGN KEY ("opportunityAnalysisId") REFERENCES "OpportunityAnalysis"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ParticipantSupportFinding" ADD CONSTRAINT "ParticipantSupportFinding_sourceCitationId_fkey" FOREIGN KEY ("sourceCitationId") REFERENCES "SourceCitation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AnalysisReview" ADD CONSTRAINT "AnalysisReview_opportunityAnalysisId_fkey" FOREIGN KEY ("opportunityAnalysisId") REFERENCES "OpportunityAnalysis"("id") ON DELETE CASCADE ON UPDATE CASCADE;
