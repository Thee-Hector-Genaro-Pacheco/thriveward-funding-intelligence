export const DEVELOPMENT_ORGANIZATION_DATABASE_NAME = 'bridge_ai_dev';

export const DEVELOPMENT_ORGANIZATION_PROFILE = {
  name: 'Project Thriveward',
  status: 'INCORPORATED',
  taxStatus: 'NOT_OBTAINED',
  primaryPopulations: ['Justice-involved adults', 'System-impacted young people'],
  primaryOutcome: 'Successful reentry and long-term independence',
  coreModel:
    'Individualized reentry support combined with career-connected education, mentorship, workforce development, employer partnerships, and continued follow-up.',
  limitations: [
    'California incorporation verified (Entity #B20260372748).',
    '501(c)(3) status has not yet been obtained.',
    'No grant awards have been received.',
    'No cohort has yet been completed.',
    'No employment outcomes should be claimed.',
    'Employer partnerships are currently being developed.',
    'Government contracts have not been obtained.',
    'Housing and rental assistance planned (not currently operational).',
    'SAM.gov/UEI registration NOT_REGISTERED.',
    'Grants.gov organization registration NOT_REGISTERED.',
  ],
} as const;

export interface DevelopmentOrganizationRecord {
  id: string;
  name: string;
  status: string;
  taxStatus: string;
  limitations: string[];
}

export interface DevelopmentOrganizationStore {
  getCurrentDatabaseName(): Promise<string>;
  findProjectThriveward(): Promise<DevelopmentOrganizationRecord | null>;
  createProjectThriveward(
    input: typeof DEVELOPMENT_ORGANIZATION_PROFILE
  ): Promise<DevelopmentOrganizationRecord>;
}

export interface DevelopmentOrganizationMetadata {
  organizationName: string;
  formationStatus: string;
  californiaEntityNumber: string | null;
  taxStatus: string;
  irs501c3Status: string;
  samGovUeiStatus: string;
  grantsGovStatus: string;
}

export interface DevelopmentOrganizationResult {
  status: 'created' | 'existing' | 'not-found';
  metadata: DevelopmentOrganizationMetadata | null;
}

export function validateDevelopmentOrganizationDatabaseName(databaseName: string): void {
  if (databaseName !== DEVELOPMENT_ORGANIZATION_DATABASE_NAME) {
    throw new Error(
      `DEVELOPMENT_ORGANIZATION_DATABASE_REJECTED: connected database must be exactly ${DEVELOPMENT_ORGANIZATION_DATABASE_NAME}.`
    );
  }
}

async function validateEnvironmentAndDatabase(store: DevelopmentOrganizationStore): Promise<void> {
  if (process.env.NODE_ENV !== 'development') {
    throw new Error('DEVELOPMENT_ORGANIZATION_ENVIRONMENT_REJECTED: NODE_ENV must be development.');
  }
  validateDevelopmentOrganizationDatabaseName(await store.getCurrentDatabaseName());
}

function arraysEqual(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function findDivergentFields(record: DevelopmentOrganizationRecord): string[] {
  const differences: string[] = [];
  if (record.name !== DEVELOPMENT_ORGANIZATION_PROFILE.name) differences.push('organizationName');
  if (record.status !== DEVELOPMENT_ORGANIZATION_PROFILE.status) differences.push('formationStatus');
  if (record.taxStatus !== DEVELOPMENT_ORGANIZATION_PROFILE.taxStatus) differences.push('taxStatus');
  if (!arraysEqual(record.limitations, DEVELOPMENT_ORGANIZATION_PROFILE.limitations)) differences.push('limitations');
  return differences;
}

function toMetadata(record: DevelopmentOrganizationRecord): DevelopmentOrganizationMetadata {
  const entityLimitation = record.limitations.find((value) => /Entity #B[0-9A-Z]+/i.test(value));
  const entityMatch = entityLimitation?.match(/Entity #(B[0-9A-Z]+)/i);
  const c3Limitation = record.limitations.find((value) => /501\(c\)\(3\)/i.test(value));
  const samLimitation = record.limitations.find((value) => /SAM\.gov\/UEI/i.test(value));
  const grantsLimitation = record.limitations.find((value) => /Grants\.gov/i.test(value));

  return {
    organizationName: record.name,
    formationStatus: record.status,
    californiaEntityNumber: entityMatch?.[1] || null,
    taxStatus: record.taxStatus,
    irs501c3Status: c3Limitation && /not yet been obtained/i.test(c3Limitation) ? 'NOT_OBTAINED' : 'UNKNOWN',
    samGovUeiStatus: samLimitation && /NOT_REGISTERED/i.test(samLimitation) ? 'NOT_REGISTERED' : 'UNKNOWN',
    grantsGovStatus: grantsLimitation && /NOT_REGISTERED/i.test(grantsLimitation) ? 'NOT_REGISTERED' : 'UNKNOWN',
  };
}

export async function bootstrapDevelopmentOrganization(
  store: DevelopmentOrganizationStore
): Promise<DevelopmentOrganizationResult> {
  await validateEnvironmentAndDatabase(store);
  const existing = await store.findProjectThriveward();
  if (existing) {
    const differences = findDivergentFields(existing);
    if (differences.length > 0) {
      throw new Error(`DEVELOPMENT_ORGANIZATION_STATE_DIVERGED: fields=${differences.join(',')}`);
    }
    return { status: 'existing', metadata: toMetadata(existing) };
  }

  const created = await store.createProjectThriveward(DEVELOPMENT_ORGANIZATION_PROFILE);
  return { status: 'created', metadata: toMetadata(created) };
}

export async function inspectDevelopmentOrganization(
  store: DevelopmentOrganizationStore
): Promise<DevelopmentOrganizationResult> {
  await validateEnvironmentAndDatabase(store);
  const existing = await store.findProjectThriveward();
  return existing
    ? { status: 'existing', metadata: toMetadata(existing) }
    : { status: 'not-found', metadata: null };
}
