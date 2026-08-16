-- Phase 1G Prerequisite: Add missing status column to StrategicPartnerCandidate
-- Allows historical migration 20260815120000_phase1g_actor_semantics_and_data_repair to execute on blank databases
-- while remaining a complete no-op on existing databases (such as bridge_ai_db).

ALTER TABLE "StrategicPartnerCandidate"
ADD COLUMN IF NOT EXISTS "status" "PartnerMatchStatus" NOT NULL DEFAULT 'RESEARCH_REQUIRED';
