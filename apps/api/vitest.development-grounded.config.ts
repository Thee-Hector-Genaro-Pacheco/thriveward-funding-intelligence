import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: [
      'src/__tests__/developmentGroundedEvaluationWorkflow.test.ts',
      'src/__tests__/documentRetrievalAssembly.test.ts',
      'src/__tests__/groundedEvaluationFailClosed.test.ts',
    ],
  },
});
