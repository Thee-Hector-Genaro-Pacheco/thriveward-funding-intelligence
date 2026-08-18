# AI-2B • Document-Grounded Retrieval & Citation-Constrained Analysis Walkthrough

## Executive Summary & System Classification

- **System Version**: Phase AI-2B (Semantic Retrieval Grounding & Citation Validation)
- **Status Classification**: `AI-2B LIVE ACCEPTANCE COMPLETE — PROCEDURAL LOGIN DEVIATION DOCUMENTED`
- **Canonical Protected Commit**: `9de24b21d117ad15d99e6ca35ec623fa5eefb644`
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
3. **Prompt Injection Containment**: Document text is isolated inside user prompt evidence catalogs. System prompt untrusted-data boundary rules state that text inside retrieved chunks cannot alter output schemas, allowed evidence references, human-review safeguards, or developer instructions.

---

## 5. Security & Governance Safeguards

- **RBAC**: `ADMIN` and `OPERATOR` roles can trigger indexing and grounded evaluations. `VIEWER` is strictly read-only.
- **Fail-Closed Feature Flag**: Controlled via `AI_DOCUMENT_GROUNDING_ENABLED=false` (returns 503 `AI_DOCUMENT_GROUNDING_NOT_CONFIGURED`).
- **Human-in-the-Loop Attestation**: Grounded evaluations do not auto-authorize submissions. All outputs require explicit human approval/rejection with attestation reasons.
- **Audit Logging**: Indexing completions, failures, reconciliations, and grounded evaluations generate immutable `SecurityAuditEvent` records.

---

## 6. Verification Evidence

### Automated Regression Test Suite (`phase2bDocumentGroundedRetrieval.test.ts`)
- **Total Test Cases**: 22 comprehensive security & retrieval tests
- **Passing Status**: 22 / 22 passed
- **Total Workspace Test Suite**: 372 / 372 passed

### Operational Database Baseline & Fingerprint
- `FundingOpportunity`: 14
- `AiEvaluation`: 2 (Version 1 baseline + Version 2 grounded evaluation)
- `SecurityAuditEvent`: 517
- `FundingDocument`: 1
- `FundingDocumentVersion`: 1 (`84e50a30-406e-4da7-8e22-106f094b7001`, 66 pages)
- `FundingDocumentIndex`: 1 (`debde606-6230-43ba-9962-21e21cab05ba`, `READY`)
- `FundingDocumentChunk`: 83 vector chunks
- `AiEvaluationRetrievalRun`: 1 (`4eb561ae-c5ba-4968-8c42-c00c60b30b0c`)
- `AiEvaluationRetrievalEvidence`: 15 records
- Database Migrations: 26 total applied migrations

---

## 7. Live Acceptance Evidence & Audit Findings

The controlled live acceptance run was completed on August 18, 2026:

1. **Official Notice Indexing**:
   - Processed 66-page notice for `Street Outreach Program` (`84e50a30-406e-4da7-8e22-106f094b7001`).
   - Created **83 page-bounded chunks** using `document-chunker-v1` (pages 1–66).
   - Generated embeddings via OpenAI `text-embedding-3-small` (1536 dimensions) across 3 API batch requests (24,388 input tokens).
   - Stored vectors in PostgreSQL `pgvector` with HNSW cosine distance indexing (`debde606-6230-43ba-9962-21e21cab05ba`, status `READY`).

2. **Semantic Retrieval & Grounded AI Analysis**:
   - Executed 5 server-controlled semantic retrieval query categories.
   - Retained **15 persisted retrieval-evidence items** in `AiEvaluationRetrievalEvidence`.
   - Generated grounded evaluation `34e7aba3-dcec-40f1-8fce-85a6575ccdaa` (Version 2) using `gpt-5.6-luna` (`funding-analyst-document-grounded-v1`).
   - **Citation Enforcement**: 100% compliant. Every requirement item cites at least one retrieved `DOC.84e50a30-406e-4da7-8e22-106f094b7001.PAGE.<pageNumber>` reference. Pre-transaction validation ensured zero unretrieved or cross-opportunity citations were accepted.

3. **Provider Cost Reconciliation**:
   - Document Indexing Embeddings (24,388 tokens @ $0.02/1M): **$0.00048776**
   - Retrieval Query Embeddings (~75 tokens @ $0.02/1M): **$0.00000150**
   - Evaluation Input Tokens (8,474 tokens @ $0.20/1M): **$0.00169480**
   - Evaluation Output Tokens (1,857 tokens @ $1.20/1M): **$0.00222840**
   - **Total Provider Cost**: **$0.00441246 USD** (~ $0.0044 USD)

4. **Audit History & Procedural Login Deviation**:
   - A manual browser login occurred (`Audit Event ID: 219e69bb-a80d-4014-9bc5-3310856ae2a2`).
   - A separate automated API login via `curl` occurred (`Audit Event ID: 56c91358-6ecc-4823-b724-4501a8646ce1`).
   - **Lesson Learned & Integrity:** The procedural API login deviation was retained in append-only audit logs without modification or concealment. It did not create extra index records or modify evaluation outcomes. Future acceptance procedures will strictly reuse existing manual browser sessions.

5. **Post-Acceptance Security State**:
   - `AI_DOCUMENT_GROUNDING_ENABLED` restored to **`false`** (verified live in `/api/health`).
   - Mandatory human review remains required for Evaluation Version 2 (`status: GENERATED`).

---

## 8. Interview-Ready Architecture Talking Points

When presenting the Phase AI-2B document-grounded retrieval implementation in technical interviews:

- **Deterministic Ingestion & Chunking**: We enforce page-bounded chunking (`document-chunker-v1`) that never crosses page boundaries, preserving exact source page citations (`DOC.<verId>.PAGE.<pageNum>`).
- **Server-Authoritative Retrieval**: The server executes 5 predefined, domain-specific semantic queries against PostgreSQL `pgvector` HNSW indexes. Clients cannot pass arbitrary retrieval query strings, preventing vector search manipulation.
- **Untrusted-Data Boundary Defense**: Retrieved document text is treated strictly as evidence data in the user message payload. System prompts explicitly instruct the model that document text cannot alter output schemas, tool rules, or safety boundaries.
- **Pre-Transaction Citation Validation**: Model responses undergo strict citation verification before opening a database transaction. If the model cites an unretrieved page or invents a citation ID, the request fails closed with zero database writes.
- **Append-Only Audit Honesty**: Every authentication attempt, document indexing run, and AI evaluation is logged to an immutable append-only audit table (`SecurityAuditEvent`), ensuring complete operational traceability.
- **Human-Led Governance**: AI evaluation is strictly decision-support (`GENERATED`). It cannot alter opportunity routing status, authorize grant applications, or submit external requests without explicit human attestation.

### Systems Engineering Boundaries & Non-Claims
- **No Autonomous Submissions**: The system does not write or submit grant applications autonomously.
- **No Legal Eligibility Guarantee**: A rating of `POSSIBLY_ELIGIBLE` represents model decision-support alignment, not formal legal qualification.
- **No Autonomous Outreach**: The system does not transmit emails, outreach messages, or external API calls to funding agencies.
- **Environment Control**: Grounding and ingestion features are disabled by default and require explicit administrative flag enablement.
