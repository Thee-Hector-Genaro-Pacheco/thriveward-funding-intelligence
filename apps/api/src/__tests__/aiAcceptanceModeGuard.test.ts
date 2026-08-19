import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { initAiAcceptanceModeGuard, parseDatabaseName } from '../services/ai/aiAcceptanceModeGuard';
import { DocumentIndexingService } from '../services/documentIndexingService';
import { AiFundingAnalystService } from '../services/aiFundingAnalystService';
import { DeterministicDocumentEmbeddingProvider } from '../services/ai/deterministicDocumentEmbeddingProvider';
import { MockFundingAnalystProvider } from '../services/ai/mockFundingAnalystProvider';
import { EvidenceCatalogBuilder } from '../services/ai/evidenceCatalogBuilder';
import { OpenAiFundingAnalystProvider } from '../services/ai/openAiFundingAnalystProvider';

describe('AI Acceptance Mode Guard & Provider Wiring Suite', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.AI_ACCEPTANCE_MODE;
    process.env.AI_FUNDING_ANALYST_ENABLED = 'false';
    process.env.AI_DOCUMENT_GROUNDING_ENABLED = 'false';
    DocumentIndexingService.resetProvider();
    AiFundingAnalystService.resetProvider();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    DocumentIndexingService.resetProvider();
    AiFundingAnalystService.resetProvider();
  });

  it('1. parseDatabaseName correctly extracts db name without revealing credentials', () => {
    const testUrl = 'postgresql://usr:secret_pass@localhost:5432/bridge_ai_test_db?schema=public';
    const prodUrl = 'postgresql://usr:secret_pass@postgres:5432/bridge_ai_db?schema=public';

    expect(parseDatabaseName(testUrl)).toBe('bridge_ai_test_db');
    expect(parseDatabaseName(prodUrl)).toBe('bridge_ai_db');
  });

  it('2. Acceptance mode is disabled by default', () => {
    delete process.env.AI_ACCEPTANCE_MODE;
    const result = initAiAcceptanceModeGuard();
    expect(result).toBe(false);
  });

  it('3. Selects mock providers only for bridge_ai_test_db', () => {
    process.env.AI_ACCEPTANCE_MODE = 'true';
    process.env.NODE_ENV = 'development';
    process.env.DATABASE_URL = 'postgresql://usr:pass@localhost:5432/bridge_ai_test_db?schema=public';
    process.env.AI_FUNDING_ANALYST_ENABLED = 'true';
    process.env.AI_DOCUMENT_GROUNDING_ENABLED = 'true';

    const result = initAiAcceptanceModeGuard();
    expect(result).toBe(true);

    const indexingProvider = DocumentIndexingService.getActiveProvider();
    const analystProvider = AiFundingAnalystService.getActiveProvider();

    expect(indexingProvider).toBeInstanceOf(DeterministicDocumentEmbeddingProvider);
    expect(analystProvider).toBeInstanceOf(MockFundingAnalystProvider);
    expect(AiFundingAnalystService.getConfigurationStatus().provider).toBe('MOCK_OPENAI');
  });

  it('4. Refuses to start for bridge_ai_db', () => {
    process.env.AI_ACCEPTANCE_MODE = 'true';
    process.env.NODE_ENV = 'development';
    process.env.DATABASE_URL = 'postgresql://usr:pass@postgres:5432/bridge_ai_db?schema=public';
    process.env.AI_FUNDING_ANALYST_ENABLED = 'true';
    process.env.AI_DOCUMENT_GROUNDING_ENABLED = 'true';

    expect(() => initAiAcceptanceModeGuard()).toThrow(
      /AI_ACCEPTANCE_MODE_REQUIRES_TEST_DB/
    );
  });

  it('5. Refuses to start when NODE_ENV is production', () => {
    process.env.AI_ACCEPTANCE_MODE = 'true';
    process.env.NODE_ENV = 'production';
    process.env.DATABASE_URL = 'postgresql://usr:pass@localhost:5432/bridge_ai_test_db?schema=public';
    process.env.AI_FUNDING_ANALYST_ENABLED = 'true';
    process.env.AI_DOCUMENT_GROUNDING_ENABLED = 'true';

    expect(() => initAiAcceptanceModeGuard()).toThrow(
      /AI_ACCEPTANCE_MODE_FORBIDDEN_IN_PRODUCTION/
    );
  });

  it('6. Refuses partially configured acceptance mode', () => {
    process.env.AI_ACCEPTANCE_MODE = 'true';
    process.env.NODE_ENV = 'development';
    process.env.DATABASE_URL = 'postgresql://usr:pass@localhost:5432/bridge_ai_test_db?schema=public';
    process.env.AI_FUNDING_ANALYST_ENABLED = 'true';
    process.env.AI_DOCUMENT_GROUNDING_ENABLED = 'false';

    expect(() => initAiAcceptanceModeGuard()).toThrow(
      /AI_ACCEPTANCE_MODE_PARTIALLY_CONFIGURED/
    );
  });

  it('7. Unconfigured 503 behavior remains unchanged when acceptance mode is off', () => {
    delete process.env.AI_ACCEPTANCE_MODE;
    delete process.env.OPENAI_API_KEY;
    process.env.AI_FUNDING_ANALYST_ENABLED = 'false';
    process.env.AI_DOCUMENT_GROUNDING_ENABLED = 'false';

    expect(DocumentIndexingService.isGroundingEnabled()).toBe(false);
    expect(AiFundingAnalystService.isConfigured()).toBe(false);
  });

  it('8. MockFundingAnalystProvider returns honest DETERMINISTIC_MOCK metadata & test disclosure', async () => {
    const provider = new MockFundingAnalystProvider();
    const snapshot = EvidenceCatalogBuilder.buildSnapshot(
      { title: 'Reentry Grant', candidateRoutingStatus: 'FISCAL_SPONSOR_REQUIRED' },
      { primaryPopulations: ['Adults'] }
    );
    const response = await provider.analyze(snapshot);

    expect(response.meta.provider).toBe('DETERMINISTIC_MOCK');
    expect(response.meta.model).toBe('deterministic-mock-v1');
    expect(response.result.limitations).toContain(
      'Deterministic acceptance/test output; no live AI provider call occurred.'
    );
  });

  it('9. MockFundingAnalystProvider output excludes unsupported workforce-technology claim', async () => {
    const provider = new MockFundingAnalystProvider();
    const snapshot = EvidenceCatalogBuilder.buildSnapshot(
      { title: 'Reentry Grant', candidateRoutingStatus: 'FISCAL_SPONSOR_REQUIRED' },
      { primaryPopulations: ['Adults'] }
    );
    const response = await provider.analyze(snapshot);

    const strengthTexts = response.result.strengths.map((s) => s.text);
    const hasWorkforceClaim = strengthTexts.some((t) => t.includes('Control to Code'));
    expect(hasWorkforceClaim).toBe(false);
  });

  it('10. OpenAiFundingAnalystProvider retains production model configuration', () => {
    process.env.OPENAI_MODEL = 'gpt-5.6-luna';
    const provider = new OpenAiFundingAnalystProvider();
    expect(provider.getModelName()).toBe('gpt-5.6-luna');
  });
});
