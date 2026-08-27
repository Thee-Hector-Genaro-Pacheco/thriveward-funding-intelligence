import fs from 'fs/promises';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DevelopmentIndexArguments,
  DevelopmentIndexDependencies,
  runDevelopmentDocumentIndexing,
  validateDevelopmentIndexDatabaseName,
} from '../services/developmentDocumentIndexingWorkflow';

const args: DevelopmentIndexArguments = {
  documentVersionId: 'bb81f944-8ddf-4f6e-bd82-b2fcb78314a0',
  requestedByUserId: '46183730-66cc-42d8-93a5-4d2990d0a8c2',
  expectedOpportunityId: '384fe777-5794-4562-bf97-f1beac40b7fc',
  expectedDocumentId: '0064dbc6-9bbc-42ab-87d3-be688044623e',
  expectedSha256: '4934fd71855aa474851ea569602d682f26d5aaf01512d7289bd290209461023e',
  expectedPageCount: 17,
  expectedProvider: 'OPENAI',
  expectedModel: 'text-embedding-3-small',
  preflight: true,
};
const identity = { provider: 'OPENAI', model: 'text-embedding-3-small', dimensions: 1536 };

function version(overrides: Record<string, unknown> = {}) {
  return {
    id: args.documentVersionId,
    status: 'READY',
    sha256: args.expectedSha256,
    pageCount: 17,
    fundingDocumentId: args.expectedDocumentId,
    fundingDocument: {
      id: args.expectedDocumentId,
      fundingOpportunityId: args.expectedOpportunityId,
      documentType: 'OFFICIAL_NOTICE',
    },
    pages: Array.from({ length: 17 }, (_, index) => ({
      pageId: `page-${index + 1}`,
      pageNumber: index + 1,
      text: `Extracted page ${index + 1} content for deterministic planning.`,
    })),
    ...overrides,
  };
}

function dependencies(overrides: Partial<DevelopmentIndexDependencies> = {}): DevelopmentIndexDependencies {
  return {
    getCurrentDatabaseName: vi.fn().mockResolvedValue('bridge_ai_dev'),
    findDocumentVersion: vi.fn().mockResolvedValue(version()),
    findRequester: vi.fn().mockResolvedValue({
      id: args.requestedByUserId,
      role: 'ADMIN',
      accountState: 'ACTIVE',
    }),
    findCompatibleIndex: vi.fn().mockResolvedValue(null),
    indexDocument: vi.fn().mockResolvedValue({
      id: 'new-index',
      status: 'READY',
      sourceManifestHash: 'manifest',
      configurationHash: 'configuration',
      chunkCount: 17,
      embeddingProvider: 'OPENAI',
      embeddingModel: 'text-embedding-3-small',
      embeddingDimensions: 1536,
    }),
    ...overrides,
  };
}

describe('development document indexing harness', () => {
  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    process.env.NODE_ENV = 'development';
  });

  afterEach(() => {
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnv;
    vi.restoreAllMocks();
  });

  it('rejects non-development execution before database or indexing calls', async () => {
    process.env.NODE_ENV = 'test';
    const deps = dependencies();
    await expect(runDevelopmentDocumentIndexing(args, identity, 32, deps)).rejects.toThrow('ENVIRONMENT_REJECTED');
    expect(deps.getCurrentDatabaseName).not.toHaveBeenCalled();
    expect(deps.indexDocument).not.toHaveBeenCalled();
  });

  it.each(['bridge_ai_db', 'bridge_ai_test_db', 'bridge_ai_vitest_abc', 'postgres', '', 'unknown'])(
    'rejects database %s',
    (databaseName) => expect(() => validateDevelopmentIndexDatabaseName(databaseName)).toThrow('DATABASE_REJECTED')
  );

  it('accepts only bridge_ai_dev', () => {
    expect(() => validateDevelopmentIndexDatabaseName('bridge_ai_dev')).not.toThrow();
  });

  it('rejects a missing document version', async () => {
    const deps = dependencies({ findDocumentVersion: vi.fn().mockResolvedValue(null) });
    await expect(runDevelopmentDocumentIndexing(args, identity, 32, deps)).rejects.toThrow('exact version was not found');
    expect(deps.indexDocument).not.toHaveBeenCalled();
  });

  it('rejects a non-READY document version', async () => {
    const deps = dependencies({ findDocumentVersion: vi.fn().mockResolvedValue(version({ status: 'FAILED' })) });
    await expect(runDevelopmentDocumentIndexing(args, identity, 32, deps)).rejects.toThrow('status must be READY');
    expect(deps.indexDocument).not.toHaveBeenCalled();
  });

  it.each([
    ['SHA-256', { sha256: '0'.repeat(64) }, 'SHA-256 differs'],
    ['document ID', { fundingDocumentId: 'wrong' }, 'funding document ID differs'],
    ['opportunity ID', { fundingDocument: { id: args.expectedDocumentId, fundingOpportunityId: 'wrong', documentType: 'OFFICIAL_NOTICE' } }, 'opportunity ID differs'],
  ])('rejects wrong %s', async (_label, override, message) => {
    const deps = dependencies({ findDocumentVersion: vi.fn().mockResolvedValue(version(override as Record<string, unknown>)) });
    await expect(runDevelopmentDocumentIndexing(args, identity, 32, deps)).rejects.toThrow(message as string);
    expect(deps.indexDocument).not.toHaveBeenCalled();
  });

  it('rejects page count and page-number integrity mismatches', async () => {
    const countDeps = dependencies({ findDocumentVersion: vi.fn().mockResolvedValue(version({ pageCount: 16 })) });
    await expect(runDevelopmentDocumentIndexing(args, identity, 32, countDeps)).rejects.toThrow('PAGE_INTEGRITY_REJECTED');
    const brokenPages = version().pages;
    brokenPages[16] = { ...brokenPages[16], pageNumber: 16 };
    const sequenceDeps = dependencies({ findDocumentVersion: vi.fn().mockResolvedValue(version({ pages: brokenPages })) });
    await expect(runDevelopmentDocumentIndexing(args, identity, 32, sequenceDeps)).rejects.toThrow('PAGE_INTEGRITY_REJECTED');
  });

  it('rejects requester identity, role, or state mismatch', async () => {
    const deps = dependencies({
      findRequester: vi.fn().mockResolvedValue({ id: args.requestedByUserId, role: 'VIEWER', accountState: 'ACTIVE' }),
    });
    await expect(runDevelopmentDocumentIndexing(args, identity, 32, deps)).rejects.toThrow('REQUESTER_REJECTED');
    expect(deps.indexDocument).not.toHaveBeenCalled();
  });

  it('rejects provider, model, and fixed-vector dimension mismatches before database access', async () => {
    for (const invalidIdentity of [
      { ...identity, provider: 'OTHER' },
      { ...identity, model: 'other-model' },
      { ...identity, dimensions: 3072 },
    ]) {
      const deps = dependencies();
      await expect(runDevelopmentDocumentIndexing(args, invalidIdentity, 32, deps)).rejects.toThrow(/PROVIDER_REJECTED|MODEL_REJECTED|DIMENSIONS_REJECTED/);
      expect(deps.getCurrentDatabaseName).not.toHaveBeenCalled();
    }
  });

  it('reuses an existing compatible READY index without invoking indexing', async () => {
    const existing = {
      id: 'existing-index',
      status: 'READY',
      sourceManifestHash: 'manifest',
      configurationHash: 'configuration',
      chunkCount: 17,
      embeddingProvider: 'OPENAI',
      embeddingModel: 'text-embedding-3-small',
      embeddingDimensions: 1536,
    };
    const deps = dependencies({ findCompatibleIndex: vi.fn().mockResolvedValue(existing) });
    const output = await runDevelopmentDocumentIndexing(args, identity, 32, deps);
    expect(output).toEqual(expect.objectContaining({ mode: 'existing', disposition: 'reused', documentIndexId: 'existing-index' }));
    expect(deps.indexDocument).not.toHaveBeenCalled();
  });

  it('fails explicitly for a compatible non-READY index', async () => {
    const deps = dependencies({
      findCompatibleIndex: vi.fn().mockResolvedValue({
        id: 'processing-index', status: 'PROCESSING', sourceManifestHash: 'm', configurationHash: 'c',
        chunkCount: 0, embeddingProvider: 'OPENAI', embeddingModel: 'text-embedding-3-small', embeddingDimensions: 1536,
      }),
    });
    await expect(runDevelopmentDocumentIndexing(args, identity, 32, deps)).rejects.toThrow('compatible index status is PROCESSING');
    expect(deps.indexDocument).not.toHaveBeenCalled();
  });

  it('valid preflight plans chunks and requests without invoking indexing or a provider', async () => {
    const deps = dependencies();
    const output = await runDevelopmentDocumentIndexing(args, identity, 32, deps);
    expect(output).toEqual(expect.objectContaining({
      mode: 'preflight',
      disposition: 'would-create',
      chunkCount: 17,
      expectedProviderRequests: 1,
      dimensions: 1536,
      targetTokens: 500,
      overlapTokens: 75,
    }));
    expect(deps.findCompatibleIndex).toHaveBeenCalledOnce();
    expect(deps.indexDocument).not.toHaveBeenCalled();
  });

  it('calls the existing indexing boundary exactly once for valid non-preflight execution', async () => {
    const deps = dependencies();
    const output = await runDevelopmentDocumentIndexing({ ...args, preflight: false }, identity, 32, deps);
    expect(deps.indexDocument).toHaveBeenCalledOnce();
    expect(deps.indexDocument).toHaveBeenCalledWith(expect.objectContaining({
      documentVersionId: args.documentVersionId,
      userId: args.requestedByUserId,
      idempotencyKey: expect.stringMatching(/^dev-index:/),
    }));
    expect(output.mode).toBe('indexed');
    expect(JSON.stringify(output)).not.toMatch(/apiKey|password|accessToken|rawEmbedding|\"embedding\":/i);
  });

  it('does not import auth, login/session, provider, or AI-evaluation services in the harness', async () => {
    const workflowSource = await fs.readFile(
      path.resolve(__dirname, '../services/developmentDocumentIndexingWorkflow.ts'),
      'utf8'
    );
    const scriptSource = await fs.readFile(
      path.resolve(__dirname, '../scripts/developmentDocumentIndexing.ts'),
      'utf8'
    );
    const sources = `${workflowSource}\n${scriptSource}`;
    expect(sources).not.toMatch(/authService|login|session|OpenAiDocumentEmbeddingProvider|aiFundingAnalystService/);
    expect(scriptSource).toContain("import('../services/documentIndexingService')");
  });
});
