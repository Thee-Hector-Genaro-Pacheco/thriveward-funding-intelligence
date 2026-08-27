import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globalSetup: ['./src/__tests__/setup/globalTestDbSetup.ts'],
    setupFiles: ['./src/__tests__/setup/testDbGuard.ts'],
    fileParallelism: false,
  },
});
