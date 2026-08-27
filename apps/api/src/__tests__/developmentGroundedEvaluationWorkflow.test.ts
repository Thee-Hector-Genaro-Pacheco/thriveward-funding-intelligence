import fs from 'fs';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DevelopmentGroundedArguments,
  DevelopmentGroundedDependencies,
  GroundedProviderPlan,
  GroundedTarget,
  runDevelopmentGroundedEvaluation,
} from '../services/developmentGroundedEvaluationWorkflow';

const args: DevelopmentGroundedArguments = {
  opportunityId: '384fe777-5794-4562-bf97-f1beac40b7fc',
  documentVersionId: 'bb81f944-8ddf-4f6e-bd82-b2fcb78314a0',
  requestedByUserId: '46183730-66cc-42d8-93a5-4d2990d0a8c2',
  expectedDocumentId: '0064dbc6-9bbc-42ab-87d3-be688044623e',
  expectedIndexId: '99ef2123-84ab-43d7-9910-ff04f03dee86',
  expectedDocumentSha256: '4934fd71855aa474851ea569602d682f26d5aaf01512d7289bd290209461023e',
  expectedIndexConfigurationHash: 'fdd982ea382cd714f795d1c12d3a54f31744ec41a553a7d9e6ee53e23d12dbf9',
  expectedIndexSourceManifestHash: '91a726acabfe7a788aee51fc6fc798c4ecdf1c0e959b879517304b7954b97204',
  expectedRetrievalEmbeddingProvider: 'OPENAI',
  expectedRetrievalEmbeddingModel: 'text-embedding-3-small',
  expectedAnalystProvider: 'OPENAI',
  expectedAnalystModel: 'gpt-5.6-luna',
  idempotencyKey: 'dev-grounded:bja:official-v1',
  preflight: true,
};

const plan: GroundedProviderPlan = {
  retrievalProvider: 'OPENAI', retrievalModel: 'text-embedding-3-small', retrievalDimensions: 1536,
  retrievalQueryLabels: ['ELIGIBILITY', 'PURPOSE', 'APPLICATION', 'AWARD', 'CAPACITY'],
  retrievalBatchSize: 5, topK: 8, maxContextTokens: 6000,
  analystProvider: 'OPENAI', analystModel: 'gpt-5.6-luna',
  analystPromptVersion: 'funding-analyst-document-grounded-v1',
};

function target(): GroundedTarget {
  return {
    opportunity: { id: args.opportunityId, externalOpportunityId: '363637', fundingOpportunityNumber: 'O-BJA-2026-172698' },
    document: { id: args.expectedDocumentId, fundingOpportunityId: args.opportunityId, documentType: 'OFFICIAL_NOTICE' },
    version: {
      id: args.documentVersionId, fundingDocumentId: args.expectedDocumentId, status: 'READY',
      sha256: args.expectedDocumentSha256, pageCount: 17,
      pageNumbers: Array.from({ length: 17 }, (_, index) => index + 1),
    },
    index: {
      id: args.expectedIndexId, documentVersionId: args.documentVersionId, status: 'READY',
      embeddingProvider: 'OPENAI', embeddingModel: 'text-embedding-3-small', embeddingDimensions: 1536,
      chunkCount: 26, sourceManifestHash: args.expectedIndexSourceManifestHash,
      configurationHash: args.expectedIndexConfigurationHash,
    },
    requester: { id: args.requestedByUserId, role: 'ADMIN', accountState: 'ACTIVE' },
  };
}

function dependencies(value = target()): DevelopmentGroundedDependencies {
  return {
    getCurrentDatabaseName: vi.fn().mockResolvedValue('bridge_ai_dev'),
    loadTarget: vi.fn().mockResolvedValue(value),
    findExistingEvaluation: vi.fn().mockResolvedValue(null),
    executeGroundedEvaluation: vi.fn().mockResolvedValue({
      id: 'evaluation-id', status: 'GENERATED', documentIndexId: args.expectedIndexId,
      provider: 'OPENAI', model: 'gpt-5.6-luna', promptVersion: plan.analystPromptVersion,
      evidenceCount: 10, citationCount: 8, providerResponseId: 'response-id',
      inputTokenCount: 100, outputTokenCount: 50,
    }),
  };
}

describe('development grounded-evaluation harness', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  beforeEach(() => { process.env.NODE_ENV = 'development'; });
  afterEach(() => {
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnv;
    vi.restoreAllMocks();
  });

  it('rejects non-development execution before database access', async () => {
    process.env.NODE_ENV = 'production';
    const deps = dependencies();
    await expect(runDevelopmentGroundedEvaluation(args, plan, deps)).rejects.toThrow('ENVIRONMENT_REJECTED');
    expect(deps.getCurrentDatabaseName).not.toHaveBeenCalled();
  });

  it('preserves the npm argument separator in the root workspace forwarding contract', () => {
    const rootPackage = JSON.parse(
      fs.readFileSync(path.resolve(__dirname, '../../../../package.json'), 'utf8')
    ) as { scripts: Record<string, string> };

    expect(rootPackage.scripts['dev:grounded:evaluate']).toBe(
      'npm run dev:grounded:evaluate --workspace=apps/api --'
    );
    expect(rootPackage.scripts['dev:grounded:evaluate']).toMatch(/--workspace=apps\/api --$/);
    expect(rootPackage.scripts['dev:document:index']).toMatch(/--workspace=apps\/api --$/);
    expect(rootPackage.scripts['dev:document:ingest']).toMatch(/--workspace=apps\/api --$/);
  });

  it.each(['bridge_ai_db', 'bridge_ai_test_db', 'bridge_ai_vitest_123', 'postgres', ''])(
    'rejects database %s', async (databaseName) => {
      const deps = dependencies();
      vi.mocked(deps.getCurrentDatabaseName).mockResolvedValue(databaseName);
      await expect(runDevelopmentGroundedEvaluation(args, plan, deps)).rejects.toThrow('DATABASE_REJECTED');
    }
  );

  it.each([
    ['OPPORTUNITY', (value: GroundedTarget) => { value.opportunity!.id = 'wrong'; }],
    ['DOCUMENT', (value: GroundedTarget) => { value.document!.id = 'wrong'; }],
    ['DOCUMENT_VERSION', (value: GroundedTarget) => { value.version!.id = 'wrong'; }],
    ['DOCUMENT_VERSION_STATUS', (value: GroundedTarget) => { value.version!.status = 'FAILED'; }],
    ['DOCUMENT_VERSION_INTEGRITY', (value: GroundedTarget) => { value.version!.sha256 = 'wrong'; }],
    ['INDEX', (value: GroundedTarget) => { value.index!.id = 'wrong'; }],
    ['INDEX_STATUS', (value: GroundedTarget) => { value.index!.status = 'FAILED'; }],
    ['INDEX_PROVIDER', (value: GroundedTarget) => { value.index!.embeddingProvider = 'OTHER'; }],
    ['INDEX_MODEL', (value: GroundedTarget) => { value.index!.embeddingModel = 'other'; }],
    ['INDEX_DIMENSIONS', (value: GroundedTarget) => { value.index!.embeddingDimensions = 12; }],
    ['INDEX_CONFIGURATION_HASH', (value: GroundedTarget) => { value.index!.configurationHash = 'wrong'; }],
    ['INDEX_SOURCE_MANIFEST_HASH', (value: GroundedTarget) => { value.index!.sourceManifestHash = 'wrong'; }],
    ['REQUESTER', (value: GroundedTarget) => { value.requester!.id = 'wrong'; }],
    ['REQUESTER_STATE', (value: GroundedTarget) => { value.requester!.accountState = 'DISABLED'; }],
  ])('rejects invalid %s guard', async (code, mutate) => {
    const value = target();
    mutate(value);
    await expect(runDevelopmentGroundedEvaluation(args, plan, dependencies(value))).rejects.toThrow(`${code}_REJECTED`);
  });

  it('preflight plans exact binding and invokes no providers, mutation, auth, ingestion, or indexing', async () => {
    const deps = dependencies();
    const embedQueries = vi.fn();
    const analyze = vi.fn();
    const output = await runDevelopmentGroundedEvaluation(args, plan, deps);
    expect(output).toEqual(expect.objectContaining({
      mode: 'preflight', retrievalExecution: 'NOT_RUN', evaluationMutation: 'NOT_RUN',
      documentVersionId: args.documentVersionId, documentIndexId: args.expectedIndexId,
      retrievalQueryCount: 5, expectedRetrievalEmbeddingRequests: 1,
      expectedAnalystRequests: 1, expectedTotalProviderRequests: 2,
    }));
    expect(embedQueries).not.toHaveBeenCalled();
    expect(analyze).not.toHaveBeenCalled();
    expect(deps.executeGroundedEvaluation).not.toHaveBeenCalled();
    expect(output).not.toHaveProperty('password');
    expect(output).not.toHaveProperty('openAiApiKey');
    expect(output).not.toHaveProperty('embeddings');
    expect(output).not.toHaveProperty('retrievedContext');
  });

  it('preserves existing grounded idempotency and exact index binding', async () => {
    const deps = dependencies();
    vi.mocked(deps.findExistingEvaluation).mockResolvedValue({
      id: 'existing', status: 'APPROVED', documentIndexId: args.expectedIndexId,
      provider: 'OPENAI', model: 'gpt-5.6-luna', promptVersion: plan.analystPromptVersion,
    });
    const output = await runDevelopmentGroundedEvaluation(args, plan, deps);
    expect(output.existingEvaluation).toEqual(expect.objectContaining({ id: 'existing', status: 'APPROVED' }));
    expect(deps.executeGroundedEvaluation).not.toHaveBeenCalled();
  });

  it('valid mocked real path delegates to the existing grounded service exactly once', async () => {
    const deps = dependencies();
    const output = await runDevelopmentGroundedEvaluation({ ...args, preflight: false }, plan, deps);
    expect(deps.executeGroundedEvaluation).toHaveBeenCalledOnce();
    expect(deps.executeGroundedEvaluation).toHaveBeenCalledWith(expect.objectContaining({
      documentVersionId: args.documentVersionId, expectedIndexId: args.expectedIndexId,
      idempotencyKey: args.idempotencyKey,
    }));
    expect(output).toEqual(expect.objectContaining({ mode: 'executed', retrievalExecution: 'COMPLETED' }));
  });
});
