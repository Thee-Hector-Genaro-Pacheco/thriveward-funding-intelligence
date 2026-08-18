-- Runtime Privilege Policy & Security Assertions
-- File: apps/api/prisma/runtime-grants.sql

-- 1. Revoke default privileges & sequences access
REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM bridge_ai_runtime;
REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM bridge_ai_runtime;

-- 2. Explicitly revoke all privileges on _prisma_migrations ledger
REVOKE ALL PRIVILEGES ON TABLE public."_prisma_migrations" FROM bridge_ai_runtime;

-- 3. Source-justified DML grants for 60 application tables
GRANT SELECT, INSERT, UPDATE ON TABLE public."User" TO bridge_ai_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public."UserSession" TO bridge_ai_runtime;
GRANT SELECT, INSERT ON TABLE public."SecurityAuditEvent" TO bridge_ai_runtime;
GRANT SELECT, UPDATE ON TABLE public."FundingOpportunity" TO bridge_ai_runtime;
GRANT SELECT, UPDATE ON TABLE public."OrganizationProfile" TO bridge_ai_runtime;
GRANT SELECT, INSERT, UPDATE ON TABLE public."AiEvaluation" TO bridge_ai_runtime;
GRANT SELECT, INSERT, UPDATE ON TABLE public."AiEvaluationRecoveryRecord" TO bridge_ai_runtime;
GRANT SELECT, INSERT, UPDATE ON TABLE public."AiEvaluationRetrievalRun" TO bridge_ai_runtime;
GRANT SELECT, INSERT ON TABLE public."AiEvaluationRetrievalEvidence" TO bridge_ai_runtime;
GRANT SELECT, INSERT, UPDATE ON TABLE public."FundingDocument" TO bridge_ai_runtime;
GRANT SELECT, INSERT, UPDATE ON TABLE public."FundingDocumentVersion" TO bridge_ai_runtime;
GRANT SELECT, INSERT ON TABLE public."FundingDocumentPage" TO bridge_ai_runtime;
GRANT SELECT, INSERT, UPDATE ON TABLE public."FundingDocumentIdempotency" TO bridge_ai_runtime;
GRANT SELECT, INSERT, UPDATE ON TABLE public."FundingDocumentIndex" TO bridge_ai_runtime;
GRANT SELECT, INSERT, UPDATE ON TABLE public."FundingDocumentIndexIdempotency" TO bridge_ai_runtime;
GRANT SELECT, INSERT, DELETE ON TABLE public."FundingDocumentChunk" TO bridge_ai_runtime;
GRANT SELECT, INSERT, UPDATE ON TABLE public."StrategicPartnerCandidate" TO bridge_ai_runtime;
GRANT SELECT, INSERT, UPDATE ON TABLE public."OpportunityPartnerMatch" TO bridge_ai_runtime;
GRANT SELECT, INSERT ON TABLE public."PartnerWorkflowHistory" TO bridge_ai_runtime;
GRANT SELECT, INSERT, UPDATE ON TABLE public."OpportunityReadinessPlan" TO bridge_ai_runtime;
GRANT SELECT, INSERT, UPDATE ON TABLE public."ReadinessPlanTask" TO bridge_ai_runtime;
GRANT SELECT, INSERT, UPDATE ON TABLE public."OutreachEngagement" TO bridge_ai_runtime;
GRANT SELECT, INSERT, UPDATE ON TABLE public."OutreachDraftVersion" TO bridge_ai_runtime;
GRANT SELECT, INSERT, UPDATE ON TABLE public."OutreachFollowUp" TO bridge_ai_runtime;
GRANT SELECT, INSERT, UPDATE ON TABLE public."OutreachDeliveryRecord" TO bridge_ai_runtime;
GRANT SELECT, INSERT, UPDATE ON TABLE public."OutreachDiscoveryCall" TO bridge_ai_runtime;
GRANT SELECT, INSERT, UPDATE ON TABLE public."OutreachHumanApproval" TO bridge_ai_runtime;
GRANT SELECT, INSERT, UPDATE ON TABLE public."OutreachResponseRecord" TO bridge_ai_runtime;
GRANT SELECT, INSERT, UPDATE ON TABLE public."OutreachAttachmentRef" TO bridge_ai_runtime;
GRANT SELECT, INSERT ON TABLE public."OutreachWorkflowHistory" TO bridge_ai_runtime;
GRANT SELECT, INSERT ON TABLE public."ContactEvidenceSnapshot" TO bridge_ai_runtime;
GRANT SELECT, INSERT, UPDATE ON TABLE public."MouChecklistItem" TO bridge_ai_runtime;
GRANT SELECT, INSERT, UPDATE ON TABLE public."FiscalSponsorCandidate" TO bridge_ai_runtime;
GRANT SELECT, INSERT, UPDATE ON TABLE public."OpportunitySponsorMatch" TO bridge_ai_runtime;
GRANT SELECT, INSERT ON TABLE public."SponsorDiscoveryQueryLog" TO bridge_ai_runtime;
GRANT SELECT, INSERT ON TABLE public."SponsorSourceCitation" TO bridge_ai_runtime;
GRANT SELECT, INSERT, UPDATE ON TABLE public."PartnerContactChannel" TO bridge_ai_runtime;
GRANT SELECT, INSERT ON TABLE public."PartnerSourceCitation" TO bridge_ai_runtime;
GRANT SELECT, INSERT, UPDATE ON TABLE public."OpportunityAnalysis" TO bridge_ai_runtime;
GRANT SELECT, INSERT, UPDATE ON TABLE public."AnalysisDimension" TO bridge_ai_runtime;
GRANT SELECT, INSERT, UPDATE ON TABLE public."AnalysisReview" TO bridge_ai_runtime;
GRANT SELECT, INSERT, UPDATE ON TABLE public."EligibilityFinding" TO bridge_ai_runtime;
GRANT SELECT, INSERT, UPDATE ON TABLE public."EligibilityRequirement" TO bridge_ai_runtime;
GRANT SELECT, INSERT, UPDATE ON TABLE public."ParticipantSupportFinding" TO bridge_ai_runtime;
GRANT SELECT, INSERT, UPDATE ON TABLE public."RequiredDocument" TO bridge_ai_runtime;
GRANT SELECT, INSERT, UPDATE ON TABLE public."AllowableCost" TO bridge_ai_runtime;
GRANT SELECT, INSERT, UPDATE ON TABLE public."ScoringCriterion" TO bridge_ai_runtime;
GRANT SELECT, INSERT, UPDATE ON TABLE public."OpportunityRelevance" TO bridge_ai_runtime;
GRANT SELECT, INSERT, UPDATE ON TABLE public."RelevanceCitation" TO bridge_ai_runtime;
GRANT SELECT, INSERT ON TABLE public."PursuitHistory" TO bridge_ai_runtime;
GRANT SELECT, INSERT ON TABLE public."ReadinessPlanHistory" TO bridge_ai_runtime;
GRANT SELECT, INSERT, UPDATE ON TABLE public."FundingSource" TO bridge_ai_runtime;
GRANT SELECT, INSERT, UPDATE ON TABLE public."GrantCalendarItem" TO bridge_ai_runtime;
GRANT SELECT, INSERT, UPDATE ON TABLE public."IngestionRun" TO bridge_ai_runtime;
GRANT SELECT, INSERT, UPDATE ON TABLE public."Program" TO bridge_ai_runtime;
GRANT SELECT, INSERT, UPDATE ON TABLE public."SecurityAuditEventClassification" TO bridge_ai_runtime;
GRANT SELECT, INSERT, UPDATE ON TABLE public."SecurityAuditClassificationBatch" TO bridge_ai_runtime;
GRANT SELECT, INSERT, UPDATE ON TABLE public."FundingOpportunityRecoveryRecord" TO bridge_ai_runtime;
GRANT SELECT, INSERT ON TABLE public."SourceCitation" TO bridge_ai_runtime;
GRANT SELECT, INSERT ON TABLE public."SourceSnapshot" TO bridge_ai_runtime;

-- 4. Sequence permissions
GRANT SELECT, USAGE ON ALL SEQUENCES IN SCHEMA public TO bridge_ai_runtime;

-- 5. Fail-Closed Security Assertions
DO $$
BEGIN
  -- Assert 1: bridge_ai_runtime has NO privilege on _prisma_migrations
  IF has_table_privilege('bridge_ai_runtime', 'public."_prisma_migrations"', 'SELECT') OR
     has_table_privilege('bridge_ai_runtime', 'public."_prisma_migrations"', 'INSERT') OR
     has_table_privilege('bridge_ai_runtime', 'public."_prisma_migrations"', 'UPDATE') OR
     has_table_privilege('bridge_ai_runtime', 'public."_prisma_migrations"', 'DELETE') OR
     has_table_privilege('bridge_ai_runtime', 'public."_prisma_migrations"', 'TRUNCATE') OR
     has_table_privilege('bridge_ai_runtime', 'public."_prisma_migrations"', 'REFERENCES') OR
     has_table_privilege('bridge_ai_runtime', 'public."_prisma_migrations"', 'TRIGGER') THEN
    RAISE EXCEPTION 'SECURITY ASSERTION FAILED: bridge_ai_runtime has privilege on _prisma_migrations';
  END IF;

  -- Assert 2: bridge_ai_runtime owns 0 relations
  IF (SELECT count(*) FROM pg_class WHERE relowner = 'bridge_ai_runtime'::regrole) > 0 OR
     (SELECT count(*) FROM pg_type WHERE typowner = 'bridge_ai_runtime'::regrole) > 0 OR
     (SELECT count(*) FROM pg_namespace WHERE nspowner = 'bridge_ai_runtime'::regrole) > 0 THEN
    RAISE EXCEPTION 'SECURITY ASSERTION FAILED: bridge_ai_runtime owns database objects';
  END IF;

  -- Assert 3: bridge_ai_runtime is not a member of privileged roles
  IF pg_has_role('bridge_ai_runtime', 'bridge_ai_migrator', 'MEMBER') OR
     pg_has_role('bridge_ai_runtime', 'bridge_admin', 'MEMBER') OR
     pg_has_role('bridge_ai_runtime', 'bridge_ai_test_runner', 'MEMBER') THEN
    RAISE EXCEPTION 'SECURITY ASSERTION FAILED: bridge_ai_runtime has membership in privileged role';
  END IF;

  -- Assert 4: bridge_ai_runtime has NO TEMPORARY or CREATE on bridge_ai_db
  IF has_database_privilege('bridge_ai_runtime', 'bridge_ai_db', 'TEMPORARY') OR
     has_database_privilege('bridge_ai_runtime', 'bridge_ai_db', 'CREATE') THEN
    RAISE EXCEPTION 'SECURITY ASSERTION FAILED: bridge_ai_runtime has TEMPORARY or CREATE privilege on database';
  END IF;

  -- Assert 5: bridge_ai_runtime has NO schema CREATE privilege
  IF has_schema_privilege('bridge_ai_runtime', 'public', 'CREATE') THEN
    RAISE EXCEPTION 'SECURITY ASSERTION FAILED: bridge_ai_runtime has CREATE privilege on schema public';
  END IF;
END $$;
