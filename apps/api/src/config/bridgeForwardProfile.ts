import crypto from 'crypto';

export interface BridgeForwardProfile {
  profileId: string;
  profileVersion: string;
  effectiveDate: string;
  organizationName: string;
  organizationStage: string;
  taxStatus: string;
  fiscalSponsorStatus: string;
  operatingHistoryYears: number | 'UNKNOWN';
  completedCohorts: number;
  governmentContracts: string;
  grantHistory: string;
  registrations: string;
  statewideGeography: string;
  initialServiceAreas: string[];
  serviceGeographies: string[];
  targetPopulations: string[];
  primaryPopulations: string[];
  primaryLaunchModel: string;
  plannedProgram: string;
  coreServices: string[];
  primaryOutcome: string;
  missionStatement: string;
  programModels: string[];
  participantSupportPriorities: string[];
  knownConstraints: string[];
}

export const BRIDGE_FORWARD_PROFILE: BridgeForwardProfile = {
  profileId: 'bridge-forward-org-profile',
  profileVersion: '1.1.1-phase1d',
  effectiveDate: '2026-08-12',
  organizationName: 'Bridge Forward Foundation',
  organizationStage: 'PRE_INCORPORATION',
  taxStatus: 'NOT_OBTAINED',
  fiscalSponsorStatus: 'NOT_OBTAINED',
  operatingHistoryYears: 0,
  completedCohorts: 0,
  governmentContracts: 'none',
  grantHistory: 'none',
  registrations: 'UNKNOWN',
  statewideGeography: 'California',
  initialServiceAreas: [
    'Orange County',
    'Los Angeles County',
    'San Bernardino County',
    'San Diego County',
  ],
  serviceGeographies: [
    'California',
    'Orange County',
    'Los Angeles County',
    'San Bernardino County',
    'San Diego County',
  ],
  targetPopulations: [
    'Justice-involved adults',
    'System-impacted young people',
  ],
  primaryPopulations: [
    'Justice-involved adults',
    'System-impacted young people',
  ],
  primaryLaunchModel: 'Individualized reentry support',
  plannedProgram: 'Controls to Code',
  coreServices: [
    'Housing and basic-needs stabilization (planned)',
    'Individualized reentry support',
    'Career-connected education',
    'Technology and skilled-trades training',
    'Mentorship',
    'Employment pathways',
    'Sustained community support',
  ],
  primaryOutcome: 'Successful reentry and long-term independence',
  missionStatement:
    'Bridge Forward Foundation advances successful reentry and long-term independence for justice-involved adults and system-impacted young people through housing and basic-needs stabilization, individualized reentry support, career-connected education, technology and skilled-trades training, mentorship, employment pathways, and sustained community support.',
  programModels: [
    'Bridge Inside',
    'Bridge Reentry',
    'Bridge Career Pathways',
    'Controls to Code',
    'Bridge Work',
    'Housing & Stabilization (Planned)',
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
    'Government Contracts Not Obtained',
    'SAM.gov/UEI Registration UNKNOWN',
    'Housing & Rental Assistance Planned (Not Currently Operational)',
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
    organizationName: profile.organizationName,
    organizationStage: profile.organizationStage,
    taxStatus: profile.taxStatus,
    fiscalSponsorStatus: profile.fiscalSponsorStatus,
    operatingHistoryYears: profile.operatingHistoryYears,
    completedCohorts: profile.completedCohorts,
    governmentContracts: profile.governmentContracts,
    grantHistory: profile.grantHistory,
    registrations: profile.registrations,
    statewideGeography: profile.statewideGeography,
    initialServiceAreas: [...profile.initialServiceAreas].sort(),
    serviceGeographies: [...profile.serviceGeographies].sort(),
    primaryPopulations: [...(profile.targetPopulations || profile.primaryPopulations)].sort(),
    primaryLaunchModel: profile.primaryLaunchModel,
    plannedProgram: profile.plannedProgram,
    coreServices: [...profile.coreServices].sort(),
    primaryOutcome: profile.primaryOutcome,
    missionStatement: profile.missionStatement,
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
