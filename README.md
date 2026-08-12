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

## Quick Start (Phase 0 Foundation)

### Prerequisites
- **Node.js**: `v18+`
- **npm**: `v9+`
- **Python**: `3.10+`
- **Docker & Docker Compose** (Optional for local containerized DB)

### Installation & Build

1. **Install Node dependencies across workspace**:
   ```bash
   npm install
   ```

2. **Build Shared Package**:
   ```bash
   npm run build --workspace=packages/shared
   ```

3. **Configure Environment**:
   ```bash
   cp .env.example .env
   ```

4. **Run Backend API**:
   ```bash
   npm run dev:api
   ```
   *Health Check*: `http://localhost:4000/health`

5. **Run Python Funding Agent**:
   ```bash
   cd services/funding-agent
   python3 -m venv venv
   source venv/bin/activate
   pip install -r requirements.txt
   python main.py
   ```
   *Health Check*: `http://localhost:8000/health`

6. **Run Frontend Web Shell**:
   ```bash
   npm run dev:web
   ```
   *Web Dashboard*: `http://localhost:3000`

---

## Documentation Index

- 📘 [PRODUCT.md](file:///Users/hectorpacheco/Desktop/BridgeAI/docs/PRODUCT.md): Vision, Principles, Capabilities & Roadmap.
- 📐 [ARCHITECTURE.md](file:///Users/hectorpacheco/Desktop/BridgeAI/docs/ARCHITECTURE.md): System Architecture & Provenance Model.
- 🏢 [BRIDGE_PROFILE.md](file:///Users/hectorpacheco/Desktop/BridgeAI/docs/BRIDGE_PROFILE.md): Versioned Organization Profile & Operational Constraints.
- 📊 [FUNDING_SCHEMA.md](file:///Users/hectorpacheco/Desktop/BridgeAI/docs/FUNDING_SCHEMA.md): Data Dictionary & Bridge Fit Scoring Model.
