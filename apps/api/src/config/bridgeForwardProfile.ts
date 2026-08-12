import crypto from 'crypto';

export interface BridgeForwardProfile {
  profileId: string;
  profileVersion: string;
  effectiveDate: string;
  organizationStage: string;
  taxStatus: string;
  fiscalSponsorStatus: string;
  operatingHistoryYears: number | 'UNKNOWN';
  serviceGeographies: string[];
  targetPopulations: string[];
  programModels: string[];
  participantSupportPriorities: string[];
  knownConstraints: string[];
}

export const BRIDGE_FORWARD_PROFILE: BridgeForwardProfile = {
  profileId: 'bridge-forward-org-profile',
  profileVersion: '1.0.0-phase0',
  effectiveDate: '2026-08-11',
  organizationStage: 'PRE_INCORPORATION',
  taxStatus: 'NOT_OBTAINED',
  fiscalSponsorStatus: 'NOT_OBTAINED',
  operatingHistoryYears: 0,
  serviceGeographies: ['California', 'Bay Area', 'Northern California'],
  targetPopulations: ['Justice-involved adults', 'System-impacted young adults'],
  programModels: [
    'Bridge Inside',
    'Bridge Reentry',
    'Bridge Career Pathways',
    'Controls to Code',
    'Bridge Work',
  ],
  participantSupportPriorities: [
    'Training Stipends',
    'Needs-Related Payments',
    'Transportation',
    'Meals',
    'Laptops & Technology',
    'Tools & PPE',
    'Certifications',
  ],
  knownConstraints: [
    'Pre-incorporation',
    'No 501(c)(3)',
    'No Grant History',
    'No Cohort Outcomes',
    'No Past Job Placement Metrics',
    'Employer Partnerships In Development',
    'No Government Contracts',
  ],
};

/**
 * Returns a canonical, deterministic JSON string representation of the profile.
 */
export function getCanonicalProfileJson(profile: BridgeForwardProfile = BRIDGE_FORWARD_PROFILE): string {
  const canonicalObj = {
    profileId: profile.profileId,
    profileVersion: profile.profileVersion,
    effectiveDate: profile.effectiveDate,
    organizationStage: profile.organizationStage,
    taxStatus: profile.taxStatus,
    fiscalSponsorStatus: profile.fiscalSponsorStatus,
    operatingHistoryYears: profile.operatingHistoryYears,
    serviceGeographies: [...profile.serviceGeographies].sort(),
    targetPopulations: [...profile.targetPopulations].sort(),
    programModels: [...profile.programModels].sort(),
    participantSupportPriorities: [...profile.participantSupportPriorities].sort(),
    knownConstraints: [...profile.knownConstraints].sort(),
  };
  return JSON.stringify(canonicalObj);
}

/**
 * Returns the lowercase 64-character SHA-256 digest of the canonical profile.
 */
export function getProfileHash(profile: BridgeForwardProfile = BRIDGE_FORWARD_PROFILE): string {
  return crypto.createHash('sha256').update(getCanonicalProfileJson(profile)).digest('hex');
}
