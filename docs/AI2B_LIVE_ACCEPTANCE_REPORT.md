# AI-2B Live Acceptance Report

**Final classification:** `AI-2B LIVE ACCEPTANCE COMPLETE — PROCEDURAL LOGIN DEVIATION DOCUMENTED`

**Acceptance Date:** August 18, 2026

---

## 1. Repository Baseline & Environment Verification

- **Baseline & Pre-Closeout Commit:** [`9de24b21d117ad15d99e6ca35ec623fa5eefb644`](file:///Users/hectorpacheco/Desktop/BridgeAI)
- **Live-Acceptance Working Tree:** Clean
- **Tracked Implementation Changes During Live Acceptance:** None

---

## 2. External Pre-Operation Backup Evidence

- **Backup Strategy:** External pre-operation database backup created outside the repository.
- **Directory Permissions:** `700` (`rwx------`)
- **File Permissions:** `600` (`rw-------`)
- **Validation:** `pg_restore --list` validation passed (exit code `0`).
- **SHA-256 Checksum:** `b5b51c17f364a3719648c91d2ae308939844ad38e16f5a3410da21b2c893ef94`
- **Location Privacy:** The absolute local filesystem path was intentionally omitted from repository documentation for portability and privacy.

---

## 3. Target Official Notice Specification

- **Opportunity Title:** Street Outreach Program
- **Opportunity ID:** `e9943e0c-120c-4035-b445-25ff5dfd888a`
- **Document ID:** `eee68530-96b9-471a-a86a-d0d2f875dd53`
- **Document Version ID:** `84e50a30-406e-4da7-8e22-106f094b7001`
- **Document Version Number:** 1
- **Page Count:** 66 pages
- **Document SHA-256:** `23d74f59f218b286e1af584cb9f43ca759f67cf33bae30c753322a10089378f3`

---

## 4. Document Indexing Execution & Vector Persistence

- **User-Triggered Indexing POST Requests:** 1
- **Retries:** 0
- **Index ID:** `debde606-6230-43ba-9962-21e21cab05ba`
- **Terminal Status:** `READY`
- **Embedding Provider & Model:** `text-embedding-3-small` (1536 dimensions)
- **Embedding Provider Requests:** 3 batch requests (batch size 32)
- **Total Embedding Input Tokens:** 24,388 tokens
- **Deterministic Chunk Count:** 83 chunks (`document-chunker-v1`, source pages 1–66)
- **Source Manifest Hash:** `a78c094e540d15e292978860cce12e3b67b47fc82e9fb0fa3eb0151e92293c77`
- **Configuration Hash:** `52ceb4cfddb5114d2d8ad9bbd9bb4a319a4892245c893b96eddc7797419c3792`

> **Page-Bounded Citation Rule:** Document chunks never cross page boundaries and resolve strictly to page-bounded citation strings formatted as:
> `DOC.84e50a30-406e-4da7-8e22-106f094b7001.PAGE.<pageNumber>`

---

## 5. Controlled Semantic Retrieval Catalog

Retrieval was executed across five server-controlled query categories using pgvector cosine similarity search (`document-retrieval-v1`):

1. `ELIGIBILITY_AND_DISQUALIFYING_FACTORS`
2. `PROGRAM_PURPOSE_AND_SERVICE_POPULATION`
3. `APPLICATION_REQUIREMENTS_AND_DEADLINES`
4. `AWARD_AMOUNT_COST_SHARE_AND_PERIOD`
5. `ORGANIZATIONAL_CAPACITY_AND_PARTNERSHIP_REQUIREMENTS`

---

## 6. Document-Grounded AI Evaluation Results

- **User-Triggered Grounded-Evaluation POST Requests:** 1
- **Retries:** 0
- **Retrieval Query Embedding Requests:** 5 requests
- **Responses API Model Requests:** 1 request
- **AI Analyst Model:** `gpt-5.6-luna`
- **Prompt Version:** `funding-analyst-document-grounded-v1`
- **Evaluation ID:** `34e7aba3-dcec-40f1-8fce-85a6575ccdaa`
- **Evaluation Version:** 2
- **Evaluation Status:** `GENERATED`
- **Alignment Score:** 35 / 100
- **Eligibility Assessment:** `POSSIBLY_ELIGIBLE`
- **Retrieval Run ID:** `4eb561ae-c5ba-4968-8c42-c00c60b30b0c`
- **Persisted Retrieval Evidence Records:** 15 records
- **Input Tokens:** 8,474 tokens
- **Output Tokens:** 1,857 tokens

*(Note: Provider response ID was persisted operationally in the database but omitted from repository documentation as part of data minimization.)*

### Key Governance & Validation Integrity Rules
- Every item in `requirements[]` contains at least one retrieved `DOC.*` citation.
- Every strength and risk evidence reference resolves strictly to the permitted server evidence catalog.
- No unretrieved page or cross-opportunity citation was accepted.
- Citation validation completed prior to database transaction persistence.
- The evaluation remains strictly advisory decision-support pending mandatory human review.
- An assessment of `POSSIBLY_ELIGIBLE` does not establish legal eligibility.
- The alignment score of 35/100 accurately reflects unresolved pre-incorporation eligibility considerations, lack of current street outreach operations, and the requirement for a fiscal sponsor.

---

## 7. Provider Pricing & Cost Reconciliation

Official OpenAI model pricing rates snapshot as of August 18, 2026:
- **`text-embedding-3-small`**: [$0.02 per 1M input tokens](https://developers.openai.com/api/docs/models/text-embedding-3-small)
- **`gpt-5.6-luna`**: [$0.20 per 1M input tokens](https://developers.openai.com/api/docs/models/gpt-5.6-luna) | $0.02 per 1M cached input tokens | $1.20 per 1M output tokens

### Corrected No-Cache Cost Estimate

| Item | Usage | Estimated Cost |
| :--- | :--- | :--- |
| **Document-index embeddings** | 24,388 tokens | $0.00048776 |
| **Retrieval-query embeddings** | Approximately 75 tokens | $0.00000150 |
| **Evaluation input** | 8,474 tokens | $0.00169480 |
| **Evaluation output** | 1,857 tokens | $0.00222840 |
| **Total Approximate Cost** | — | **$0.00441246** |

*(Note: Actual billing may vary slightly due to provider token accounting, caching, rounding, or account-specific billing.)*

---

## 8. Audit History & Procedural Login Deviation

- **Manual Action:** One manual browser login occurred (`Audit Event ID: 219e69bb-a80d-4014-9bc5-3310856ae2a2`).
- **Procedural Deviation:** One additional automated API login occurred via `curl` (`Audit Event ID: 56c91358-6ecc-4823-b724-4501a8646ce1`).
- **Audit Retainability:** The automated login was outside the intended manual-login procedure but was preserved intact in append-only audit history. It was not deleted, altered, or concealed.
- **Impact Assessment:** The deviation created a separate session entry but did not create duplicate index records, duplicate evaluations, modify workflow status, or weaken citation enforcement.
- **Corrective Guidance:** Future live acceptance procedures must reuse the manually authenticated browser session and avoid issuing separate API login commands.

*(Sensitive fields including user UUIDs, full User-Agent values, IP addresses, credentials, cookies, session hashes, tokens, and authorization headers have been omitted from repository documentation.)*

---

## 9. Pre- and Post-Operation Database Fingerprint

| Database Record | Before | After | Delta |
| :--- | :--- | :--- | :--- |
| FundingOpportunity | 14 | 14 | 0 |
| AiEvaluation | 1 | 2 | +1 |
| SecurityAuditEvent | 513 | 517 | +4 |
| FundingDocument | 1 | 1 | 0 |
| FundingDocumentVersion | 1 | 1 | 0 |
| FundingDocumentPage | 66 | 66 | 0 |
| FundingDocumentIndex | 0 | 1 | +1 |
| FundingDocumentChunk | 0 | 83 | +83 |
| AiEvaluationRetrievalRun | 0 | 1 | +1 |
| AiEvaluationRetrievalEvidence | 0 | 15 | +15 |
| FundingDocumentIndexIdempotency | 0 | 1 | +1 |

### New Security Audit Events Logged
1. `LOGIN_SUCCESS` — manual browser login
2. `LOGIN_SUCCESS` — automated curl login (procedural deviation)
3. `FUNDING_DOCUMENT_INDEXING_COMPLETED`
4. `AI_DOCUMENT_GROUNDED_EVALUATION_GENERATED`

---

## 10. Final Governance Declarations

- Document grounding (`AI_DOCUMENT_GROUNDING_ENABLED`) was restored to `disabled`.
- Document ingestion (`DOCUMENT_INGESTION_ENABLED`) remained `disabled`.
- Baseline evaluation Version 1 remained intact.
- Grounded evaluation Version 2 remains in `GENERATED` status requiring human review.
- No human approval or rejection occurred.
- No canonical opportunity status changed (`Street Outreach Program` remains `FISCAL_SPONSOR_REQUIRED`, `CA-600` & `CA-602` remain `RESEARCH_REQUIRED`, `CA-DEMO` remains excluded).
- No email, outreach draft, application, submission, or workflow advancement occurred.
- No secrets or credentials were exposed or committed.
- No paid LLM provider call occurred after the two authorized live operations.
