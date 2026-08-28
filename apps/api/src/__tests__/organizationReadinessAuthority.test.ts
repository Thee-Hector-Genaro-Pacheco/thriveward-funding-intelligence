import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  profile: null as any,
  findFirst: vi.fn(),
}));

vi.mock('../lib/prisma', () => ({
  prisma: {
    $queryRaw: vi.fn().mockResolvedValue([{ '?column?': 1 }]),
    fundingOpportunity: { count: vi.fn().mockResolvedValue(0) },
    organizationProfile: { findFirst: mocks.findFirst },
  },
}));

import { buildHealthOrganizationStatus } from '../routes/health';
import { OrganizationProfileService } from '../services/organizationProfileService';

describe('organization readiness authority', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    mocks.profile = null;
    mocks.findFirst.mockReset().mockImplementation(async () => mocks.profile);
  });

  it('uses the same persisted formation status for readiness and health', async () => {
    mocks.profile = {
      name: 'Current Organization',
      status: 'INCORPORATED',
      taxStatus: 'NOT_OBTAINED',
      limitations: [
        'California incorporation verified (Entity #B20260372748).',
        '501(c)(3) status has not yet been obtained.',
        'EIN NOT_OBTAINED.',
        'California FTB tax exemption NOT_VERIFIED.',
        'SI-100 NOT_FILED.',
        'California Attorney General charitable registration NOT_REGISTERED.',
        'SAM.gov/UEI registration NOT_REGISTERED.',
        'Grants.gov organization registration NOT_REGISTERED.',
      ],
    };

    const readiness = await OrganizationProfileService.getReadinessStatus();
    const healthOrganization = buildHealthOrganizationStatus(readiness);

    expect(healthOrganization.status).toBe(readiness.status);
    expect(readiness).toMatchObject({
      status: 'INCORPORATED',
      formationStatus: 'INCORPORATED',
      taxStatus: 'NOT_OBTAINED',
      irs501c3Status: 'NOT_OBTAINED',
      einStatus: 'NOT_OBTAINED',
      californiaIncorporation: 'VERIFIED',
      californiaTaxExemption: 'NOT_VERIFIED',
      si100Status: 'NOT_FILED',
      californiaCharitableRegistration: 'NOT_REGISTERED',
      samGovUeiStatus: 'NOT_REGISTERED',
      grantsGovStatus: 'NOT_REGISTERED',
    });
    expect(healthOrganization).toMatchObject({
      status: readiness.status,
      taxStatus: readiness.taxStatus,
      irs501c3Status: readiness.irs501c3Status,
      einStatus: readiness.einStatus,
      californiaIncorporation: readiness.californiaIncorporation,
      samGovUeiStatus: readiness.samGovUeiStatus,
      grantsGovStatus: readiness.grantsGovStatus,
    });
  });

  it('reports UNKNOWN consistently when no authoritative profile exists', async () => {
    const readiness = await OrganizationProfileService.getReadinessStatus();
    const healthOrganization = buildHealthOrganizationStatus(readiness);

    expect(readiness.status).toBe('UNKNOWN');
    expect(healthOrganization.status).toBe('UNKNOWN');
    expect(readiness.einStatus).toBe('UNKNOWN');
    expect(readiness.californiaTaxExemption).toBe('UNKNOWN');
    expect(readiness.samGovUeiStatus).toBe('UNKNOWN');
    expect(readiness.grantsGovStatus).toBe('UNKNOWN');
  });

  it('keeps profile and readiness formation status on the same authoritative projection', async () => {
    mocks.profile = {
      name: 'Current Organization',
      status: 'INCORPORATED',
      taxStatus: 'UNKNOWN',
      limitations: [],
    };

    const profile = await OrganizationProfileService.getProfile();
    const readiness = await OrganizationProfileService.getReadinessStatus();

    expect(profile.status).toBe(readiness.status);
    expect(profile.formationStatus).toBe(readiness.formationStatus);
  });

  it('does not infer federal 501(c)(3) status from generic taxStatus', async () => {
    mocks.profile = {
      name: 'Current Organization',
      status: 'INCORPORATED',
      taxStatus: 'VERIFIED',
      limitations: [],
    };

    const readiness = await OrganizationProfileService.getReadinessStatus();

    expect(readiness.taxStatus).toBe('VERIFIED');
    expect(readiness.irs501c3Status).toBe('UNKNOWN');
  });
});
