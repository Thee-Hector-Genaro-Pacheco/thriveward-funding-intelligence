-- AlterTable
ALTER TABLE "OutreachWorkflowHistory" ADD COLUMN "actorType" TEXT NOT NULL DEFAULT 'HUMAN';
ALTER TABLE "OutreachWorkflowHistory" ADD COLUMN "eventType" TEXT NOT NULL DEFAULT 'WORKFLOW_TRANSITION';

-- Update existing System Data Repair events
UPDATE "OutreachWorkflowHistory"
SET "actorType" = 'SYSTEM_DATA_REPAIR', "eventType" = 'DATA_RECONCILIATION'
WHERE "humanActorName" = 'System Data Repair Service' OR "reason" LIKE '%reconciliation%';

-- Data Repair: Reconcile legacy POSSIBLE_MATCH candidates lacking human history to RESEARCH_REQUIRED
UPDATE "OpportunityPartnerMatch"
SET "status" = 'RESEARCH_REQUIRED'
WHERE "status" = 'POSSIBLE_MATCH'
  AND "strategicPartnerCandidateId" NOT IN (
    SELECT DISTINCT e."strategicPartnerCandidateId"
    from "OutreachEngagement" e
    JOIN "OutreachWorkflowHistory" h ON h."engagementId" = e."id"
    WHERE h."actorType" = 'HUMAN' AND h."humanActorName" NOT LIKE '%System%'
  );

UPDATE "StrategicPartnerCandidate"
SET "status" = 'RESEARCH_REQUIRED'
WHERE "status" = 'POSSIBLE_MATCH'
  AND "id" NOT IN (
    SELECT DISTINCT e."strategicPartnerCandidateId"
    from "OutreachEngagement" e
    JOIN "OutreachWorkflowHistory" h ON h."engagementId" = e."id"
    WHERE h."actorType" = 'HUMAN' AND h."humanActorName" NOT LIKE '%System%'
  );
