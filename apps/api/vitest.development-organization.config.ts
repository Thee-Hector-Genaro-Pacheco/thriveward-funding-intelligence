import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: [
      'src/__tests__/developmentOrganizationWorkflow.test.ts',
      'src/__tests__/organizationReadinessAuthority.test.ts',
      'src/__tests__/organizationProfilePersistence.test.ts',
      'src/__tests__/organizationProfileSchemaContract.test.ts',
    ],
  },
});
