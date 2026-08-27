import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  bootstrapDevelopmentOrganization,
  DEVELOPMENT_ORGANIZATION_PROFILE,
  DevelopmentOrganizationRecord,
  DevelopmentOrganizationStore,
  inspectDevelopmentOrganization,
  validateDevelopmentOrganizationDatabaseName,
} from '../services/developmentOrganizationWorkflow';

function matchingRecord(): DevelopmentOrganizationRecord {
  return {
    id: 'project-thriveward',
    name: DEVELOPMENT_ORGANIZATION_PROFILE.name,
    status: DEVELOPMENT_ORGANIZATION_PROFILE.status,
    taxStatus: DEVELOPMENT_ORGANIZATION_PROFILE.taxStatus,
    limitations: [...DEVELOPMENT_ORGANIZATION_PROFILE.limitations],
  };
}

function makeStore(overrides: Partial<DevelopmentOrganizationStore> = {}): DevelopmentOrganizationStore {
  return {
    getCurrentDatabaseName: vi.fn().mockResolvedValue('bridge_ai_dev'),
    findProjectThriveward: vi.fn().mockResolvedValue(null),
    createProjectThriveward: vi.fn().mockResolvedValue(matchingRecord()),
    ...overrides,
  };
}

describe('development-only organization profile workflow', () => {
  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    process.env.NODE_ENV = 'development';
  });

  afterEach(() => {
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnv;
    vi.restoreAllMocks();
  });

  it.each(['bridge_ai_db', 'bridge_ai_test_db', 'bridge_ai_vitest_123_random'])(
    'rejects protected or disposable database %s',
    (databaseName) => {
      expect(() => validateDevelopmentOrganizationDatabaseName(databaseName)).toThrow('DATABASE_REJECTED');
    }
  );

  it('accepts only bridge_ai_dev', () => {
    expect(() => validateDevelopmentOrganizationDatabaseName('bridge_ai_dev')).not.toThrow();
    expect(() => validateDevelopmentOrganizationDatabaseName('another_local_db')).toThrow('DATABASE_REJECTED');
  });

  it('creates only the intended organization profile when absent', async () => {
    const createProjectThriveward = vi.fn().mockResolvedValue(matchingRecord());
    const result = await bootstrapDevelopmentOrganization(makeStore({ createProjectThriveward }));

    expect(result.status).toBe('created');
    expect(createProjectThriveward).toHaveBeenCalledOnce();
    expect(createProjectThriveward).toHaveBeenCalledWith(DEVELOPMENT_ORGANIZATION_PROFILE);
    expect(Object.keys(makeStore()).sort()).toEqual([
      'createProjectThriveward', 'findProjectThriveward', 'getCurrentDatabaseName',
    ]);
  });

  it('is idempotent and performs no mutation when readiness state matches', async () => {
    const createProjectThriveward = vi.fn();
    const result = await bootstrapDevelopmentOrganization(makeStore({
      findProjectThriveward: vi.fn().mockResolvedValue(matchingRecord()),
      createProjectThriveward,
    }));

    expect(result.status).toBe('existing');
    expect(createProjectThriveward).not.toHaveBeenCalled();
  });

  it('fails closed with safe field names and does not overwrite divergent state', async () => {
    const createProjectThriveward = vi.fn();
    const divergent = { ...matchingRecord(), status: 'PRE_INCORPORATION', taxStatus: 'VERIFIED' };
    await expect(bootstrapDevelopmentOrganization(makeStore({
      findProjectThriveward: vi.fn().mockResolvedValue(divergent),
      createProjectThriveward,
    }))).rejects.toThrow('fields=formationStatus,taxStatus');
    expect(createProjectThriveward).not.toHaveBeenCalled();
  });

  it('inspect is read-only and returns only requested metadata', async () => {
    const createProjectThriveward = vi.fn();
    const result = await inspectDevelopmentOrganization(makeStore({
      findProjectThriveward: vi.fn().mockResolvedValue(matchingRecord()),
      createProjectThriveward,
    }));

    expect(result).toEqual({
      status: 'existing',
      metadata: {
        organizationName: 'Project Thriveward',
        formationStatus: 'INCORPORATED',
        californiaEntityNumber: 'B20260372748',
        taxStatus: 'NOT_OBTAINED',
        irs501c3Status: 'NOT_OBTAINED',
        samGovUeiStatus: 'NOT_REGISTERED',
        grantsGovStatus: 'NOT_REGISTERED',
      },
    });
    expect(createProjectThriveward).not.toHaveBeenCalled();
    expect(JSON.stringify(result)).not.toMatch(/password|token|session|provider|opportunity|user/i);
  });

  it('rejects non-development execution before reading profile state', async () => {
    process.env.NODE_ENV = 'test';
    const findProjectThriveward = vi.fn();
    await expect(bootstrapDevelopmentOrganization(makeStore({ findProjectThriveward })))
      .rejects.toThrow('ENVIRONMENT_REJECTED');
    expect(findProjectThriveward).not.toHaveBeenCalled();
  });
});
