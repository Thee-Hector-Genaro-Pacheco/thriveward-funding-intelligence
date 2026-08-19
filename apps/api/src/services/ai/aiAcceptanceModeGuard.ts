import { DocumentIndexingService } from '../documentIndexingService';
import { AiFundingAnalystService } from '../aiFundingAnalystService';
import { DeterministicDocumentEmbeddingProvider } from './deterministicDocumentEmbeddingProvider';
import { MockFundingAnalystProvider } from './mockFundingAnalystProvider';

export function parseDatabaseName(connectionUrl: string): string {
  if (!connectionUrl) return '';
  try {
    const parsed = new URL(connectionUrl);
    return parsed.pathname.replace(/^\//, '');
  } catch {
    const match = connectionUrl.match(/@[^/]+\/([^?#]+)/);
    return match ? match[1] : '';
  }
}

export function initAiAcceptanceModeGuard(): boolean {
  const isAcceptanceMode = process.env.AI_ACCEPTANCE_MODE === 'true';

  if (!isAcceptanceMode) {
    return false;
  }

  const nodeEnv = process.env.NODE_ENV || 'development';
  if (nodeEnv !== 'development' && nodeEnv !== 'test') {
    throw new Error(
      'AI_ACCEPTANCE_MODE_FORBIDDEN_IN_PRODUCTION: AI_ACCEPTANCE_MODE is strictly forbidden in production.'
    );
  }

  const dbUrl = process.env.DATABASE_URL || process.env.RUNTIME_DATABASE_URL || '';
  const dbName = parseDatabaseName(dbUrl);

  if (dbName !== 'bridge_ai_test_db') {
    throw new Error(
      `AI_ACCEPTANCE_MODE_REQUIRES_TEST_DB: AI_ACCEPTANCE_MODE can only run against bridge_ai_test_db (refused connection to non-test database).`
    );
  }

  const isAnalystEnabled = process.env.AI_FUNDING_ANALYST_ENABLED === 'true';
  const isGroundingEnabled = process.env.AI_DOCUMENT_GROUNDING_ENABLED === 'true';

  if (!isAnalystEnabled || !isGroundingEnabled) {
    throw new Error(
      'AI_ACCEPTANCE_MODE_PARTIALLY_CONFIGURED: Both AI_FUNDING_ANALYST_ENABLED and AI_DOCUMENT_GROUNDING_ENABLED must be true in acceptance mode.'
    );
  }

  // Wire mock & deterministic providers safely for acceptance mode
  DocumentIndexingService.setProvider(new DeterministicDocumentEmbeddingProvider());
  AiFundingAnalystService.setProvider(new MockFundingAnalystProvider());

  console.log(
    '🛡️ [AI_ACCEPTANCE_MODE] Active — Mock AI Funding Analyst & Deterministic Embedding Providers safely wired for bridge_ai_test_db.'
  );

  return true;
}
