/**
 * Bridge AI — Shared Domain Interfaces & Types
 */

// 1. Eligibility Classification Status
export type EligibilityStatus =
  | 'HIGH_PRIORITY'
  | 'INVESTIGATE'
  | 'FUTURE_OPPORTUNITY'
  | 'NOT_ELIGIBLE';

// 2. Tri-state Status for Participant Support & Requirements
export type TriStateStatus = 'YES' | 'NO' | 'CONDITIONAL' | 'UNKNOWN';

// 3. Organization Operational Status
export type OrgStatus = 'PRE_INCORPORATION' | 'INCORPORATED' | 'ACTIVE';

// 4. Tax-Exempt Status
export type TaxStatus = 'NOT_OBTAINED' | 'PENDING' | 'APPROVED_501C3';

// 5. Participant Support Categories
export interface ParticipantSupportMatrix {
  trainingStipends: TriStateStatus;
  needsRelatedPayments: TriStateStatus;
  transportation: TriStateStatus;
  meals: TriStateStatus;
  childcare: TriStateStatus;
  tools: TriStateStatus;
  ppe: TriStateStatus;
  workClothing: TriStateStatus;
  laptopsAndHardware: TriStateStatus;
  trainingEquipment: TriStateStatus;
  certifications: TriStateStatus;
  paidWorkExperience: TriStateStatus;
  subsidizedEmployment: TriStateStatus;
  onTheJobTraining: TriStateStatus;
  emergencyAssistance: TriStateStatus;
  otherSupportiveServices?: TriStateStatus;
}

// 6. Source Citation Provenance Model
export interface SourceCitation {
  id: string;
  opportunityId: string;
  sourceUrl: string;
  sourceTitle?: string;
  sourceOrganization?: string;
  verificationDate: string;
  quotedSection?: string;
  extractedClaim: string;
}

// 7. Scoring Dimension Breakdown (0-100 scale)
export interface BridgeFitScoreBreakdown {
  missionAlignment: number;
  populationAlignment: number;
  programAlignment: number;
  geographicEligibility: number;
  applicantEligibility: number;
  taxStatusEligibility: number;
  organizationalMaturity: number;
  requiredPartnerships: number;
  allowableCostAlignment: number;
  awardSizeSuitability: number;
  deadlineFeasibility: number;
  evidenceTrackRecord: number;
}

// 8. Opportunity Analysis Result
export interface OpportunityAnalysis {
  id: string;
  opportunityId: string;
  overallFitScore: number; // 0–100
  eligibilityStatus: EligibilityStatus;
  missingEligibilityRequirements: string[];
  missingCapabilities: string[];
  reasoningSummary: string;
  scoreBreakdown: BridgeFitScoreBreakdown;
  humanReviewRequired: boolean;
  humanReviewedAt?: string;
  humanReviewedBy?: string;
}

// 9. Organization Profile Model
export interface BridgeOrganizationProfile {
  name: string;
  status: OrgStatus;
  taxStatus: TaxStatus;
  primaryPopulations: string[];
  primaryOutcome: string;
  coreModel: string;
  programs: Array<{
    name: string;
    description: string;
    isOperational: boolean;
  }>;
  knownLimitations: string[];
}

// 10. Default Ground-Truth Profile for Bridge Forward Foundation
export const BRIDGE_FORWARD_PROFILE: BridgeOrganizationProfile = {
  name: 'Bridge Forward Foundation',
  status: 'PRE_INCORPORATION',
  taxStatus: 'NOT_OBTAINED',
  primaryPopulations: [
    'Justice-involved adults',
    'System-impacted young adults',
  ],
  primaryOutcome: 'Successful reentry and long-term independence',
  coreModel:
    'Individualized reentry support combined with career-connected education, mentorship, workforce development, employer partnerships, and continued follow-up.',
  programs: [
    { name: 'Bridge Inside', description: 'Pre-release preparation and reentry planning.', isOperational: true },
    { name: 'Bridge Reentry', description: 'Individualized Bridge Plans, mentorship, life skills.', isOperational: true },
    { name: 'Bridge Career Pathways', description: 'Career exploration & education pathways.', isOperational: true },
    { name: 'Controls to Code', description: 'Industrial automation, PLCs, Python, IoT, software development.', isOperational: true },
    { name: 'Bridge Work', description: 'Employer partnerships, placement & retention support.', isOperational: true },
    { name: 'Future Construction & Trades Pathway', description: 'Trades instruction (Painting, skilled trades).', isOperational: false },
  ],
  knownLimitations: [
    'Organization has not yet incorporated.',
    '501(c)(3) status has not yet been obtained.',
    'No grant awards have been received.',
    'No cohort has yet been completed.',
    'No employment outcomes should be claimed.',
    'Employer partnerships are currently being developed.',
    'Government contracts have not been obtained.',
  ],
};
