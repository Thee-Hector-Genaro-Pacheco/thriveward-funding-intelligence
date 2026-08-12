# Bridge AI — Architecture Specification

## System Overview

Bridge AI is designed using a **clean monorepo architecture** that isolates domain concerns, separates service boundaries, and maintains strict typing across web interfaces, backend API services, AI extraction agents, and shared domain models.

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

Every extracted fact stored in Bridge AI adheres to strict provenance standards:

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

## Security & Environment Integrity

- Secrets and environment-specific configs are managed strictly through standard environment variables (`.env`).
- Database credentials and API keys are strictly excluded from source repositories (`.gitignore`).
- All API endpoints strictly audit human review actions (`humanReviewedAt`, `humanReviewedBy`).
