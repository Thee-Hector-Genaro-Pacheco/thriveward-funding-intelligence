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

// 3. Relevance Classification Status
export type RelevanceStatus =
  | 'RELEVANT'
  | 'POSSIBLY_RELEVANT'
  | 'IRRELEVANT'
  | 'UNKNOWN';

// 4. Human-Led Pursuit Stage
export type PursuitStage =
  | 'NEW'
  | 'REVIEWING'
  | 'QUALIFIED'
  | 'LOCKED'
  | 'DISMISSED';

// 5. Organization Operational Status
export type OrgStatus = 'PRE_INCORPORATION' | 'INCORPORATED' | 'ACTIVE';

// 6. Tax-Exempt Status
export type TaxStatus = 'NOT_OBTAINED' | 'PENDING' | 'APPROVED_501C3';

// 7. Participant Support Categories
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

// 8. Source Citation Provenance Model
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

// 9. Scoring Dimension Breakdown (0-100 scale)
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

// 10. Opportunity Analysis Result
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

// 11. Organization Profile Model
export interface BridgeOrganizationProfile {
  name: string;
  status: OrgStatus;
  taxStatus: TaxStatus;
  statewideGeography: string;
  initialServiceAreas: string[];
  primaryPopulations: string[];
  primaryOutcome: string;
  coreModel: string;
  missionStatement: string;
  programs: Array<{
    name: string;
    description: string;
    isOperational: boolean;
  }>;
  knownLimitations: string[];
}

// 12. Default Ground-Truth Profile for Bridge Forward Foundation
export const BRIDGE_FORWARD_PROFILE: BridgeOrganizationProfile = {
  name: 'Bridge Forward Foundation',
  status: 'PRE_INCORPORATION',
  taxStatus: 'NOT_OBTAINED',
  statewideGeography: 'California',
  initialServiceAreas: [
    'Orange County',
    'Los Angeles County',
    'San Bernardino County',
    'San Diego County',
  ],
  primaryPopulations: [
    'Justice-involved adults',
    'System-impacted young adults',
  ],
  primaryOutcome: 'Successful reentry and long-term independence',
  coreModel:
    'Individualized reentry support combined with career-connected education, mentorship, workforce development, employer partnerships, and continued follow-up.',
  missionStatement:
    'Bridge Forward Foundation advances successful reentry and long-term independence for justice-involved adults and system-impacted young adults through individualized support, career-connected education, mentorship, workforce development, employer partnerships, and sustained follow-up.',
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

/**
 * Safely strips HTML markup and decodes standard HTML entities to plain text
 * without using dangerouslySetInnerHTML or altering raw source snapshots.
 */
export function sanitizeHtmlToText(rawInput: string | null | undefined): string {
  if (!rawInput) return '';

  let text = rawInput;

  // 1. Remove scripts and style blocks entirely
  text = text.replace(/<script\b[^<]*>([\s\S]*?)<\/script>/gi, '');
  text = text.replace(/<style\b[^<]*>([\s\S]*?)<\/style>/gi, '');

  // 2. Replace line-breaking HTML tags with newlines/spaces
  text = text.replace(/<\/(p|div|li|tr|h[1-6])>/gi, '\n');
  text = text.replace(/<(br|hr)\s*\/?>/gi, '\n');

  // 3. Strip all remaining HTML tags
  text = text.replace(/<[^>]+>/g, ' ');

  // 4. Decode HTML entities
  text = text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ');

  // Numeric decimal entities (e.g. &#8217;)
  text = text.replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(Number(dec)));
  // Numeric hex entities (e.g. &#x2013;)
  text = text.replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)));

  // 5. Normalize whitespace
  text = text.replace(/[ \t]+/g, ' ');
  text = text.replace(/\n\s*\n/g, '\n\n');

  return text.trim();
}
