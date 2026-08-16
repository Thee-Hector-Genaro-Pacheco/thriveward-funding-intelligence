# Thriveward Funding Intelligence — Architecture Specification

## System Overview

Thriveward Funding Intelligence is designed using a **clean monorepo architecture** that isolates domain concerns, separates service boundaries, and maintains strict typing across web interfaces, backend API services, AI extraction agents, and shared domain models.

```mermaid
flowchart TD
    subgraph Frontend ["Web Dashboard (apps/web)"]
        UI[React 18 + Vite Shell]
        State[Dashboard & Review State]
    end

    subgraph Backend ["Backend API (apps/api)"]
        Server[Express + TypeScript Server]
        Prisma[Prisma ORM]
        Routes[Health & Opportunity Routes]
    end

    subgraph AIService ["AI Service (services/funding-agent)"]
        PyAgent[Python FastAPI Service]
        Extractor[Extraction & Scoring Logic]
    end

    subgraph Shared ["Shared Package (packages/shared)"]
        Types[TypeScript Domain Interfaces & Enums]
    end

    subgraph Storage ["Database"]
        PG[(PostgreSQL Database)]
    end

    UI -->|HTTP REST| Server
    Server -->|HTTP Proxy/Request| PyAgent
    Server --> Prisma
    Prisma --> PG
    UI -.-> Types
    Server -.-> Types
```

---

## Service Boundaries

### 1. `apps/web` (Frontend Shell)
- **Tech Stack**: React 18, TypeScript, Vite, Vanilla CSS design system.
- **Responsibilities**: Human-in-the-loop review dashboard, fit score visualizer, organization profile view, and health monitor.

### 2. `apps/api` (Core Gateway & REST API)
- **Tech Stack**: Node.js, TypeScript, Express, Prisma ORM.
- **Responsibilities**: REST API routing, database transactions, human approval auditing, data persistence, and orchestration with Python services.

### 3. `services/funding-agent` (Python Funding Intelligence Agent)
- **Tech Stack**: Python 3.10+, FastAPI, Pydantic.
- **Responsibilities**: Text processing, eligibility parsing engine, participant support extraction, provenance citation binding, and fit scoring calculations.

### 4. `packages/shared` (Shared Domain Contracts)
- **Tech Stack**: TypeScript (ESM/CJS compiled).
- **Responsibilities**: Canonical entity contracts, enum definitions (`EligibilityStatus`, `ParticipantSupportCategory`), and fit score calculation interfaces shared between `web` and `api`.

---

## Data Provenance & Citation Model

Every extracted fact stored in Thriveward Funding Intelligence adheres to strict provenance standards:

```typescript
interface SourceCitation {
  id: string;
  opportunityId: string;
  sourceUrl: string;
  sourceTitle?: string;
  sourceOrganization?: string;
  verificationDate: string;
  quotedSection?: string;
  extractedClaim: string;
}
```

No claim may exist in the system without an associated citation or an explicit tag designating it as `AI_GENERATED_DRAFT` requiring human verification.

---

## Phase 1A Architecture — Database Persistence & Read APIs

```
[ HTTP GET /api/opportunities ]
               │
               ▼
   [ Opportunity Router ]  ── (Validates query params: status, minimumFitScore, limit, page)
               │
               ▼
   [ Opportunity Service ] ── (Executes Prisma relation queries with pagination)
               │
               ▼
   [ Singleton Prisma Client ]
               │
               ▼
   [ PostgreSQL Database ] ── (Holds seeded DEMO fixtures & migration 20260812003912_init_phase1a)
```

### 1. Prisma Persistence Layer
- **Singleton Management**: Singleton instance in `apps/api/src/lib/prisma.ts` attached to `globalThis` in development to prevent hot-reload connection leaks, handling disconnect gracefully on `SIGINT` / `SIGTERM`.
- **Database Schema**: Managed via Prisma migrations (`prisma/migrations/20260812003912_init_phase1a/migration.sql`), enforcing relational integrity across opportunities, sources, requirements, allowable costs, scoring criteria, participant support matrices, and citations.

### 2. Service / Repository Boundary
- `OpportunityService` (`apps/api/src/services/opportunityService.ts`) encapsulates all database interaction logic, query construction, filtering (`status`, `fundingType`, `minimumFitScore`), and pagination metadata generation.
- Express route handlers delegate directly to `OpportunityService`, keeping HTTP transport concerns separate from data persistence.

### 3. Read-Only Opportunity API
- **`GET /api/opportunities`**: Returns paginated opportunity summaries including latest fit score analysis. Rejects invalid or unexpected query parameters with HTTP 400.
- **`GET /api/opportunities/:id`**: Returns complete relation graph for deep review. Returns structured HTTP 404 error payload for non-existent IDs.

### 4. Fixture-Versus-Verified Data Distinction
- All synthetic demonstration records carry `isDemo: true` in the database schema and explicit `[DEMO]` prefix in titles.
- Provenance citations for demo records explicitly state their synthetic nature.
- The API and React UI enforce visual distinction (`DEMO FIXTURE` badges) so demonstration data is never blurred with future verified live opportunities.

---

## Phase 1B Architecture — Verified Grants.gov Ingestion & Field Ownership

```
┌────────────────────────────────────────────────────────────────────────┐
│                   Grants.gov Official REST API                         │
│   POST /v1/api/search2  │  POST /v1/api/fetchOpportunity               │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Unauthenticated HTTP REST
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                 GrantsGovClient & GrantsGovMapper                      │
│   • Timeout (15s) & Exponential Backoff Retry (HTTP 429/5xx)           │
│   • Zod Runtime Payload Validation (grantsGovSchemas.ts)               │
│   • Pure Mapper: Null safety, strict date parsing, no invented claims  │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                    IngestionService & Storage                          │
│   • IngestionRun Audit Logging                                         │
│   • SHA-256 Payload Hash Comparison (Idempotent execution)             │
│   • Field Ownership Boundary Enforcement                               │
│   • Transactional Upsert & SourceSnapshot Creation                     │
└────────────────────────────────────────────────────────────────────────┘
```

### 1. Grants.gov Integration Layer
- **Client (`GrantsGovClient`)**: Executes unauthenticated REST POST requests to Grants.gov (`/v1/api/search2`, `/v1/api/fetchOpportunity`). Retries transient 429/5xx failures up to 3 times with exponential delay. Sends custom `User-Agent: Thriveward-FundingIntelligence/1.0`.
- **Validation (`grantsGovSchemas`)**: Uses Zod runtime schemas to validate external API responses before processing.
- **Mapper (`GrantsGovMapper`)**: Normalizes external fields to `FundingOpportunity` schema. Preserves missing/null values as `UNKNOWN` or `null`. Official human-readable URLs are constructed as `https://www.grants.gov/search-results-detail/{opportunityId}`.

### 2. Field Ownership Boundary (Source-Owned vs. Human-Owned)
- **Source-Owned Fields** (Overwritten on re-ingestion if SHA-256 payload hash changes):
  - `title`, `fundingOpportunityNumber`, `fundingAgency`, `program`, `description`, `sourceUrl`, `openingDate`, `deadline`, `awardMin`, `awardMax`, `totalAvailableFunding`, `eligibleApplicantTypes`, `allowableCosts`, `sourceLastUpdatedTimestamp`, `sourcePayloadHash`.
- **Human-Owned Protected Fields** (NEVER overwritten by automated re-ingestion):
  - `verificationStatus` (when updated to `HUMAN_VERIFIED` or `REJECTED`), human review notes, manual eligibility determinations, human-entered participant support allowability, locally authored analyses.

### 3. Provenance & Audit Logging
- **`IngestionRun`**: Tracks execution metadata (`searchParameters`, `startTime`, `completionTime`, `status`, `recordsDiscovered`, `recordsCreated`, `recordsUpdated`, `recordsUnchanged`, `recordsFailed`, `errorSummary`).
- **`SourceSnapshot`**: Preserves complete raw JSON payload, SHA-256 payload hash, and retrieval timestamp for every imported/updated record.

---

## Phase 1C Architecture — Eligibility and Fit Analysis Foundation

```
[ POST /api/opportunities/:id/analyze ] ──> [ AnalysisService ] ──> Reads BRIDGE_FORWARD_PROFILE
                                                                ──> Computes sourceFingerprint & profileHash
                                                                ──> Calculates 12 Dimension Scores (Weights sum to 100)
                                                                ──> Calculates 15 Participant Support Findings
                                                                ──> Links SourceCitation records
                                                                ──> Creates/Updates OpportunityAnalysis (isCurrent=true)

[ POST /api/opportunities/:id/analysis/review ] ──> [ Auth Check: Bearer <BRIDGE_REVIEW_TOKEN> ]
                                                  ──> [ AnalysisService.reviewAnalysis ]
                                                  ──> Transactionally creates immutable AnalysisReview audit record
                                                  ──> Updates OpportunityAnalysis reviewStatus = "HUMAN_REVIEWED"
                                                  ──> Preserves Phase 1B FundingOpportunity.verificationStatus & lastVerifiedTimestamp
```

