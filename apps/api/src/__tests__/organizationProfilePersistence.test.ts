import { describe, expect, it, vi } from 'vitest';
import {
  createOrganizationProfile,
  ensureSeedOrganizationProfile,
} from '../services/organizationProfilePersistenceService';

const completeInput = {
  name: 'Current Organization',
  status: 'INCORPORATED',
  taxStatus: 'UNKNOWN',
  primaryPopulations: [],
  primaryOutcome: 'NOT_ESTABLISHED',
  coreModel: 'NOT_ESTABLISHED',
  limitations: [],
};

describe('organization profile application persistence boundary', () => {
  it('does not downgrade an existing incorporated profile during seed setup', async () => {
    const existing = {
      id: 'authoritative-profile',
      name: 'Current Organization',
      status: 'INCORPORATED',
      taxStatus: 'VERIFIED',
    };
    const store = {
      findFirst: vi.fn().mockResolvedValue(existing),
      create: vi.fn(),
    };

    const result = await ensureSeedOrganizationProfile(store, {
      ...completeInput,
      status: 'PRE_INCORPORATION',
      taxStatus: 'NOT_OBTAINED',
    });

    expect(result).toBe(existing);
    expect(store.create).not.toHaveBeenCalled();
  });

  it.each(['name', 'status', 'taxStatus'] as const)(
    'rejects creation when %s is missing',
    async (field) => {
      const store = { create: vi.fn() };
      const input = { ...completeInput, [field]: '' };

      await expect(createOrganizationProfile(store, input)).rejects.toThrow(
        `ORGANIZATION_PROFILE_AUTHORITATIVE_STATE_REQUIRED: ${field}`
      );
      expect(store.create).not.toHaveBeenCalled();
    }
  );
});
