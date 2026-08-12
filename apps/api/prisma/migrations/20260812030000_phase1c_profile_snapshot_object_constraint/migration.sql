-- AlterTable
ALTER TABLE "OpportunityAnalysis" DROP CONSTRAINT IF EXISTS "check_opp_analysis_profile_snapshot_nonempty";

ALTER TABLE "OpportunityAnalysis" ADD CONSTRAINT "check_opp_analysis_profile_snapshot_object" CHECK (
  jsonb_typeof("profileSnapshot") = 'object'
  AND "profileSnapshot" <> '{}'::jsonb
);
