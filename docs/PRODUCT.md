# Thriveward Funding Intelligence — Product Specification

## 1. Product Vision & Philosophy

**Thriveward Funding Intelligence** is an AI-assisted funding intelligence and nonprofit operations platform built for **Project Thriveward**, a California nonprofit in planning dedicated to successful reentry and long-term independence for system-impacted young adults and justice-involved adults.

### Core Product Principle

> **Project Thriveward is human-led and technology-enabled.**
>
> AI assists authorized humans with research, analysis, organization, and drafting. AI must **never**:
> 1. Autonomously submit grant applications.
> 2. Fabricate organizational facts, achievements, or metrics.
> 3. Fabricate source citations or URLs.
> 4. Represent uncertain eligibility as confirmed.
> 5. Make final organizational decisions.
>
> Every important AI-generated conclusion must be reviewable and explicitly approved by a human operator.

---

## 2. Capability Scope: Funding Intelligence

The primary phase of Thriveward Funding Intelligence focuses on **Funding Intelligence**, transforming unstructured funding opportunities into structured, verifiable insights.

### Functional Capabilities
- **Official Grants.gov REST Ingestion**: Ingest official federal grant notices directly from the Grants.gov API using unauthenticated `search2` and `fetchOpportunity` endpoints, preserving exact source provenance and official URLs (`https://www.grants.gov/search-results-detail/{opportunityId}`).
- **Source-Owned vs. Human-Owned Field Isolation**: Re-ingestion updates official source fields (title, agency, deadlines, amounts, synopsis) while preserving human notes, determinations, and scoring reviews intact.
- **Audit Logging & Payload Hashing**: Store SHA-256 payload hashes and raw JSON snapshots (`SourceSnapshot`) for every imported or updated official opportunity.
- **Opportunity Extraction**: Extract grant titles, funding agencies, programs, deadlines, award floors/ceilings, total program funding, geographic restrictions, match requirements, allowable/prohibited costs, and required application documents.
- **Participant Support Analysis**: Explicitly identify allowable participant support categories:
  - Training stipends
  - Needs-related payments
  - Transportation assistance
  - Meals & nutrition support
  - Childcare assistance
  - Equipment, tools & PPE
  - Work clothing & gear
  - Laptops & technology hardware
  - Training equipment
  - Industry certifications & testing fees
  - Paid work experience & subsidized employment
  - On-the-job training (OJT)
  - Emergency financial assistance
- **Bridge Fit Scoring Engine**: Evaluate opportunities against Project Thriveward's versioned profile across 12 distinct dimensions, outputting a transparent `0–100` score alongside an explicit eligibility classification (`HIGH PRIORITY`, `INVESTIGATE`, `FUTURE OPPORTUNITY`, `NOT ELIGIBLE`).
- **Separation of Eligibility and Alignment**: Prevent semantic alignment from masking mandatory eligibility disqualifiers (e.g., 3-year operating history requirement for a pre-incorporation organization).
- **Source Citation & Provenance**: Store exact source URLs, verification timestamps, and quoted excerpts for every extracted claim.

---

## 3. Human-in-the-Loop Workflow

```
[ Unstructured Grant Notice / RFP ]
                │
                ▼
[ Automated Parsing & Feature Extraction ]
                │
                ▼
[ Structured DB Storage + Citation Linking ]
                │
                ▼
[ Bridge Profile Eligibility & Fit Scoring Engine ]
                │
                ▼
[ Human Review Dashboard (Pending Review Status) ]
                │
         ┌──────┴──────┐
         ▼             ▼
   [ Approved ]   [ Rejected / Flagged ]
         │             │
         ▼             ▼
[ Operational Use ]  [ Feedback Loop / Archived ]
```

---

## 4. Anti-Goals (Strict Phase 0 / MVP Boundaries)

- ❌ **NO Autonomous Grant Submissions**: No system actions that communicate directly with grant portals.
- ❌ **NO Data Fabrication**: Missing data is strictly classified as `UNKNOWN`.
- ❌ **NO Autonomous Decision Making**: No automated commitment of organizational resources.
- ❌ **NO Invented History**: No claiming of completed cohorts, past grant awards, or active government contracts before they exist.
