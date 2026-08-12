# Bridge AI — Funding Intelligence Platform

**Bridge AI** is an AI-assisted funding intelligence and nonprofit operations platform developed for **Bridge Forward Foundation**, a planned California nonprofit focused on successful reentry and long-term independence for system-impacted young adults and justice-involved adults.

---

## Core Product Principle

> **Bridge Forward is human-led and technology-enabled.**
>
> AI assists authorized humans with research, analysis, organization, and drafting. AI must **never** autonomously submit grant applications, fabricate organizational facts, fabricate citations, represent uncertain eligibility as confirmed, or make final organizational decisions.
>
> Every important AI-generated conclusion is reviewable by a human.

---

## Workspace Structure

```
BridgeAI/
├── apps/
│   ├── api/             # Node.js + TypeScript + Express API + Prisma ORM
│   └── web/             # React + TypeScript + Vite Dashboard Frontend
├── services/
│   └── funding-agent/   # Python 3 + FastAPI Service for Funding Intelligence
├── packages/
│   └── shared/          # Shared TypeScript Interfaces, Enums & Utilities
├── docs/                # Architectural & Product Specifications
│   ├── PRODUCT.md
│   ├── ARCHITECTURE.md
│   ├── BRIDGE_PROFILE.md
│   └── FUNDING_SCHEMA.md
├── docker-compose.yml
├── .env.example
├── .gitignore
└── package.json
```

---

## Quick Start & Verification (Phase 1A)

### Prerequisites
- **Node.js**: `v18+`
- **npm**: `v9+`
- **PostgreSQL**: `v16+` (Native or Docker Compose)
- **Python**: `3.10+`

---

### Step-by-Step Execution Guide

1. **Install Monorepo Dependencies**:
   ```bash
   npm install
   ```

2. **Build Shared Types**:
   ```bash
   npm run build --workspace=packages/shared
   ```

3. **Configure Environment Variables**:
   ```bash
   cp .env.example .env
   cp apps/api/.env.example apps/api/.env
   ```

4. **Database Startup & Migration**:
   ```bash
   npm run prisma:migrate --workspace=apps/api
   ```

5. **Seed Demonstration Records**:
   ```bash
   npm run prisma:seed --workspace=apps/api
   ```

6. **Controlled Grants.gov Ingestion CLI (Phase 1B)**:
   - *Dry-Run (Simulate API search & detail parsing without DB mutation)*:
     ```bash
     npm run ingest:grants-gov --workspace=apps/api -- --keyword "reentry" --limit 3 --dry-run
     ```
   - *Persist Import (Transactionally save official Grants.gov records & snapshots)*:
     ```bash
     npm run ingest:grants-gov --workspace=apps/api -- --keyword "reentry" --limit 3 --persist
     ```

7. **Phase 1C Eligibility & Fit Analysis Foundation**:
   - *Trigger Deterministic Analysis*: `POST http://localhost:4000/api/opportunities/:id/analyze`
   - *Retrieve Full Analysis Breakdown*: `GET http://localhost:4000/api/opportunities/:id/analysis`
   - *Submit Human Review Decision*: `POST http://localhost:4000/api/opportunities/:id/analysis/review` (Requires `Authorization: Bearer <BRIDGE_REVIEW_TOKEN>`)

8. **Run Automated Test Suite (93 Tests)**:
   ```bash
   npm run test --workspace=apps/api
   ```

9. **Run Backend REST API**:
   ```bash
   npm run dev:api
   ```
   *Health Check*: `http://localhost:4000/health`  
   *List Opportunities*: `http://localhost:4000/api/opportunities`

9. **Run Web Dashboard Shell**:
   ```bash
   npm run dev:web
   ```
   *Web Dashboard*: `http://localhost:3000`

---

### Example cURL Verification Commands

```bash
# 1. Core API Health Check
curl -s http://localhost:4000/health

# 2. List All Opportunities (Default Pagination)
curl -s http://localhost:4000/api/opportunities

# 3. Filter Official Grants.gov Ingested Records Only
curl -s "http://localhost:4000/api/opportunities?dataKind=official"

# 4. Filter Demonstration Fixtures Only
curl -s "http://localhost:4000/api/opportunities?dataKind=demo"

# 5. Filter Opportunities by Status
curl -s "http://localhost:4000/api/opportunities?status=PENDING_HUMAN_REVIEW"

# 6. Retrieve Complete Opportunity Record by ID
curl -s http://localhost:4000/api/opportunities/demo-opp-001
```

---

## Documentation Index

- 📘 [PRODUCT.md](file:///Users/hectorpacheco/Desktop/BridgeAI/docs/PRODUCT.md): Vision, Principles, Capabilities & Roadmap.
- 📐 [ARCHITECTURE.md](file:///Users/hectorpacheco/Desktop/BridgeAI/docs/ARCHITECTURE.md): System Architecture & Provenance Model.
- 🏢 [BRIDGE_PROFILE.md](file:///Users/hectorpacheco/Desktop/BridgeAI/docs/BRIDGE_PROFILE.md): Versioned Organization Profile & Operational Constraints.
- 📊 [FUNDING_SCHEMA.md](file:///Users/hectorpacheco/Desktop/BridgeAI/docs/FUNDING_SCHEMA.md): Data Dictionary & Bridge Fit Scoring Model.
