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

export interface FundingOpportunity {
  id: string;
  title: string;
  fundingOpportunityNumber: string;
  fundingAgency: string;
  description: string;
  deadline?: string;
  awardMin?: string;
  awardMax?: string;
  candidateRoutingStatus?: string;
  dismissedReason?: string;
  isDemo?: boolean;
  hasSourceConflict?: boolean;
  currentCycleStatus?: string;
  sourceConflictDetails?: any;
  opportunityMatches?: any[];
  opportunityAnalyses?: any[];
  relevanceAnalyses?: any[];
}

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
    'Bridge Forward Foundation advances successful reentry and long-term independence for justice-involved adults and system-impacted young people through housing and basic-needs stabilization, individualized reentry support, career-connected education, technology and skilled-trades training, mentorship, employment pathways, and sustained community support.',
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

  // 4. Decode HTML entities (named and numeric)
  text = text
    .replace(/&ldquo;/gi, '"')
    .replace(/&rdquo;/gi, '"')
    .replace(/&lsquo;/gi, "'")
    .replace(/&rsquo;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&mdash;/gi, '—')
    .replace(/&ndash;/gi, '–');

  // Numeric decimal entities (e.g. &#8220;, &#8221;, &#8217;)
  text = text.replace(/&#(\d+);/g, (_, dec) => {
    const num = Number(dec);
    if (num === 8220 || num === 8221) return '"';
    if (num === 8216 || num === 8217) return "'";
    if (num === 8211) return '–';
    if (num === 8212) return '—';
    return String.fromCharCode(num);
  });
  // Numeric hex entities (e.g. &#x201c;)
  text = text.replace(/&#x([0-9a-f]+);/gi, (_, hex) => {
    const num = parseInt(hex, 16);
    if (num === 0x201c || num === 0x201d) return '"';
    if (num === 0x2018 || num === 0x2019) return "'";
    return String.fromCharCode(num);
  });

  // 5. Normalize whitespace
  text = text.replace(/[ \t]+/g, ' ');
  text = text.replace(/\n\s*\n/g, '\n\n');

  return text.trim();
}
