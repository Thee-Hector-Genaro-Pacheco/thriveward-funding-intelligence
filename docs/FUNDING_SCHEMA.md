# Bridge AI — Funding Intelligence Schema Specification

## 1. Domain Entities

### OrganizationProfile
Represents the organization against which opportunities are evaluated.
- `id`: Unique identifier
- `name`: Organization name (`Bridge Forward Foundation`)
- `status`: Operational status (`PRE_INCORPORATION`)
- `taxStatus`: Tax-exempt status (`NOT_OBTAINED`)
- `primaryPopulations`: Array of strings (`["Justice-involved adults", "System-impacted young adults"]`)
- `primaryOutcome`: Desired outcome (`Successful reentry and long-term independence`)
- `coreModel`: Narrative model description
- `limitations`: Array of honest organizational constraint flags

### FundingOpportunity
Primary entity representing a grant or funding notice.
- `id`: UUID
- `sourceSystem`: System origin (`GRANTS_GOV` or `DEMO_FIXTURE`)
- `externalOpportunityId`: Official external ID (e.g. `350123`)
- `fundingOpportunityNumber`: Official opportunity number (e.g. `ETA-2026-REENTRY-01`)
- `title`: Opportunity title
- `fundingAgency`: Agency or foundation name
- `isDemo`: Boolean flag (`false` for official API imports, `true` for fixtures)
- `verificationStatus`: Audit review state (`PENDING_HUMAN_REVIEW`, `HUMAN_VERIFIED`, `REJECTED`, `STALE`)
- `sourcePayloadHash`: SHA-256 hash of latest raw JSON payload
- `sourceLastUpdatedTimestamp`: Date provided by official source
- `program`: Sub-program or ALN/CFDA identifier
- `description`: Complete overview / synopsis
- `sourceUrl`: Official human-readable URL (`https://www.grants.gov/search-results-detail/{opportunityId}`)
- `status`: Extraction/verification state (`EXTRACTED`, `PENDING_HUMAN_REVIEW`, `VERIFIED`, `ARCHIVED`)
- `openingDate`: Date string (ISO 8601) or `UNKNOWN`
- `deadline`: Date string (ISO 8601) or `UNKNOWN`
- `awardMin`: Minimum award amount or `UNKNOWN`
- `awardMax`: Maximum award amount or `UNKNOWN`
- `totalAvailableFunding`: Total program budget or `UNKNOWN`
- `geography`: Eligible states/counties/regions
- `eligibleApplicantTypes`: Tax statuses/entities allowed
- `eligiblePopulations`: Target participant criteria
- `matchRequirement`: Cash/in-kind match rules
- `periodOfPerformance`: Grant duration
- `allowableCosts`: List of allowable budget line items
- `prohibitedCosts`: List of restricted items
- `participantCompensationRules`: Guidance on stipends & wages
- `requiredPartnerships`: Mandatory coalition/MOUs
- `operatingHistoryRequirements`: Minimum operational track record required
- `requiredDocuments`: Required attachments
- `scoringCriteria`: Evaluation rubrics
- `sourceCitations`: Provenance references
- `lastVerifiedTimestamp`: ISO string

---

## 2. Participant Support Matrix

Each funding opportunity evaluates allowable participant supports across 15 structured categories. Every category stores a tri-state classification (`YES`, `NO`, `CONDITIONAL`, `UNKNOWN`) alongside a citation reference.

1. **Training Stipends**: Payments while attending training.
2. **Needs-Related Payments**: Assistance for basic living needs.
3. **Transportation**: Bus passes, mileage, transit support.
4. **Meals**: Food assistance during program hours.
5. **Childcare**: Subsidized care during training/work.
6. **Tools**: Specialized trade equipment.
7. **PPE**: Personal protective equipment & safety gear.
8. **Work Clothing**: Boots, uniforms, workplace attire.
9. **Laptops & Hardware**: Computers and digital access tools.
10. **Training Equipment**: Technical learning hardware (e.g. PLCs, sensors, Raspberry Pi).
11. **Certifications**: Testing & licensure fees.
12. **Paid Work Experience**: Internship/WBL wages.
13. **Subsidized Employment**: Employer wage reimbursement.
14. **On-the-Job Training (OJT)**: Direct skill training reimbursement.
15. **Emergency Assistance**: One-time urgent support.

---

## 3. Bridge Fit Scoring & Classification Engine

Bridge AI evaluates opportunities along **12 core dimensions**:

1. **Mission Alignment**: Fit with reentry and independence goals.
2. **Population Alignment**: Fit with justice-involved adults / system-impacted youth.
3. **Program Alignment**: Fit with Controls to Code, Bridge Reentry, Bridge Work, etc.
4. **Geographic Eligibility**: California / target region match.
5. **Applicant Eligibility**: Pre-incorporation entity compatibility.
6. **Tax-Status Eligibility**: Non-501(c)(3) / fiscal sponsor compatibility.
7. **Organizational Maturity**: Track record and operating history requirements.
8. **Required Partnerships**: Feasibility of mandatory MOUs.
9. **Allowable-Cost Alignment**: Program cost eligibility.
10. **Award-Size Suitability**: Budget size vs. pilot capacity (~15 participants).
11. **Deadline Feasibility**: Application preparation timeframe.
12. **Evidence / Track-Record Requirements**: Required prior cohort outcome metrics.

### Classification Categories

- **HIGH PRIORITY**: Strong fit across dimensions + 100% mandatory eligibility met.
- **INVESTIGATE**: Potential fit, minor unknown variables or conditional requirements.
- **FUTURE OPPORTUNITY**: High alignment, but requires future milestones (e.g., 501(c)(3) approval or 1 completed cohort).
- **NOT ELIGIBLE**: Mandatory eligibility failure (e.g., requires 3+ years operating history or existing 501(c)(3)).

> **Mandatory Disqualifier Rule**: If any mandatory eligibility criterion is failed, the opportunity status **MUST** be set to `NOT ELIGIBLE` regardless of semantic fit score.
