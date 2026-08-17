# AI-2B • Document-Grounded Retrieval & Citation-Constrained Analysis Walkthrough

## Executive Summary & System Classification

- **System Version**: Phase AI-2B (Semantic Retrieval Grounding & Citation Validation)
- **Status Classification**: `AI-2B IMPLEMENTED — LIVE INDEXING AND GROUNDED-ANALYSIS ACCEPTANCE PENDING`
- **Canonical Protected Commit**: `e990cbbe078838634ca5ecdd9c80135c22e1646d`
- **Database Engine**: PostgreSQL 16.10 with `pgvector` 0.8.0 extension enabled.

Phase AI-2B transforms page-level document evidence from Phase AI-2A into a secure semantic retrieval system that grounds AI Funding Analyst evaluations in official notice text. All evaluations produced during grounded analysis are strictly citation-constrained to page-level document references (`DOC.<documentVersionId>.PAGE.<pageNumber>`).

---

## 1. Architectural Blueprint & Data Flow

```
[ Official PDF Notice ] 
         │ (Phase AI-2A Extraction)
         ▼
[ FundingDocumentPage (READY) ]
         │ (DocumentChunkerService: document-chunker-v1)
         ▼
[ Page-Bounded Chunks (500 tokens, 75 overlap) ] 
         │ (DocumentEmbeddingProvider: text-embedding-3-small, 1536d)
         ▼
[ FundingDocumentChunk (pgvector vector(1536) + HNSW Index) ]
         │
         │ (5 Controlled Server-Authoritative Queries)
         ▼
[ DocumentRetrievalService (ORDER BY embedding <=> $queryVector ASC) ]
         │
         │ (Evidence Catalog Snapshot: DOC.<verId>.PAGE.<pageNum>)
         ▼
[ AiFundingAnalystService (funding-analyst-document-grounded-v1) ]
         │
         │ (EvidenceCatalogBuilder Citation Constraint Validation)
         ▼
[ AiEvaluation + AiEvaluationRetrievalRun + AiEvaluationRetrievalEvidence ]
```

---

## 2. PostgreSQL + pgvector Database Schema

### Prisma Forward Migration (`20260817120000_phase2b_document_grounded_retrieval`)

1. **Extension**: `CREATE EXTENSION IF NOT EXISTS vector;`
2. **`FundingDocumentIndex` Table**: Tracks index jobs, provider, dimensions, status (`NOT_INDEXED`, `PROCESSING`, `READY`, `FAILED`), chunk count, SHA-256 source and configuration hashes.
3. **`FundingDocumentChunk` Table**: Stores page-bounded chunks with `embedding vector(1536)`. Indexed via HNSW cosine distance index:
   ```sql
   CREATE INDEX "FundingDocumentChunk_embedding_hnsw_idx" 
   ON "FundingDocumentChunk" 
   USING hnsw (embedding vector_cosine_ops);
   ```
4. **`AiEvaluationRetrievalRun` & `AiEvaluationRetrievalEvidence` Tables**: Immutable audit snapshot of every retrieved semantic evidence chunk used in a grounded evaluation.

---

## 3. Server-Authoritative Controlled Retrieval Queries

Retrieval uses 5 server-defined query categories (client-supplied queries are strictly ignored):

1. **`ELIGIBILITY_AND_DISQUALIFYING_FACTORS`**: Direct eligibility requirements, applicant organization types, disqualifying factors.
2. **`PROGRAM_PURPOSE_AND_SERVICE_POPULATION`**: Funding objectives, program scope, target service population, participant criteria.
3. **`APPLICATION_REQUIREMENTS_AND_DEADLINES`**: Submission deadlines, required narrative attachments, budget forms, SAM.gov UEI.
4. **`AWARD_AMOUNT_COST_SHARE_AND_PERIOD`**: Funding ceiling/floor, mandatory cost-share/matching requirements, period of performance.
5. **`ORGANIZATIONAL_CAPACITY_AND_PARTNERSHIP_REQUIREMENTS`**: Single audit requirements, mandatory MOUs with workforce boards or Continuum of Care.

---

## 4. Citation Constraint Enforcement & Prompt Injection Defense

1. **Citation Format**: Every chunk maps to `DOC.<documentVersionId>.PAGE.<pageNumber>`.
2. **Validation**: `EvidenceCatalogBuilder.validateGroundedEvidenceRefs` verifies that every requirement cited in the model response resolves to a valid, retrieved `DOC.*` citation snapshot.
3. **Prompt Injection Containment**: Document text is isolated inside system prompt delimited blocks. Grounded citation validation fails closed if prompt injection text attempts to alter system rules or fabricate unretrieved citations.

---

## 5. Security & Governance Safeguards

- **RBAC**: `ADMIN` and `OPERATOR` roles can trigger indexing and grounded evaluations. `VIEWER` is strictly read-only.
- **Fail-Closed Feature Flag**: Controlled via `AI_DOCUMENT_GROUNDING_ENABLED=false` (returns 503 `AI_DOCUMENT_GROUNDING_NOT_CONFIGURED`).
- **Human-in-the-Loop Attestation**: Grounded evaluations do not auto-authorize submissions. All outputs require explicit human approval/rejection with attestation reasons.
- **Audit Logging**: Indexing completions, failures, reconciliations, and grounded evaluations generate immutable `SecurityAuditEvent` records.

---

## 6. Verification Evidence

### Automated Regression Test Suite (`phase2bDocumentGroundedRetrieval.test.ts`)
- **Total Test Cases**: 17 comprehensive tests
- **Passing Status**: 17 / 17 passed
- **Total Project Test Suite**: 367 / 367 passed

### Operational Database Integrity Counts
- `FundingOpportunity`: 14
- `AiEvaluation`: 1 (Baseline: `536c89cb-4b0c-4cd7-b61a-0f8b762ebec9`)
- `SecurityAuditEvent`: 513+
- `FundingDocument`: 1
- `FundingDocumentVersion`: 1 (`84e50a30-406e-4da7-8e22-106f094b7001`, 66 pages)
- `FundingDocumentIndex`: 0 (No live indexing performed during test/build)
- `FundingDocumentChunk`: 0
- Database Migrations: 26 total applied migrations
