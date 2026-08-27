export const DEVELOPMENT_GROUNDED_DATABASE = 'bridge_ai_dev';

export interface DevelopmentGroundedArguments {
  opportunityId: string;
  documentVersionId: string;
  requestedByUserId: string;
  expectedDocumentId: string;
  expectedIndexId: string;
  expectedDocumentSha256: string;
  expectedIndexConfigurationHash: string;
  expectedIndexSourceManifestHash: string;
  expectedRetrievalEmbeddingProvider: string;
  expectedRetrievalEmbeddingModel: string;
  expectedAnalystProvider: string;
  expectedAnalystModel: string;
  idempotencyKey: string;
  preflight: boolean;
}

export interface GroundedTarget {
  opportunity: { id: string; externalOpportunityId: string | null; fundingOpportunityNumber: string | null } | null;
  document: { id: string; fundingOpportunityId: string; documentType: string } | null;
  version: {
    id: string; fundingDocumentId: string; status: string; sha256: string; pageCount: number;
    pageNumbers: number[];
  } | null;
  index: {
    id: string; documentVersionId: string; status: string; embeddingProvider: string;
    embeddingModel: string; embeddingDimensions: number; chunkCount: number;
    sourceManifestHash: string; configurationHash: string;
  } | null;
  requester: { id: string; role: string; accountState: string } | null;
}

export interface ExistingGroundedEvaluation {
  id: string;
  status: string;
  documentIndexId: string | null;
  provider: string;
  model: string;
  promptVersion: string;
}

export interface GroundedExecutionResult extends ExistingGroundedEvaluation {
  evidenceCount: number;
  citationCount: number;
  providerResponseId: string | null;
  inputTokenCount: number | null;
  outputTokenCount: number | null;
}

export interface DevelopmentGroundedDependencies {
  getCurrentDatabaseName(): Promise<string>;
  loadTarget(args: DevelopmentGroundedArguments): Promise<GroundedTarget>;
  findExistingEvaluation(args: DevelopmentGroundedArguments): Promise<ExistingGroundedEvaluation | null>;
  executeGroundedEvaluation(args: DevelopmentGroundedArguments): Promise<GroundedExecutionResult>;
}

export interface GroundedProviderPlan {
  retrievalProvider: string;
  retrievalModel: string;
  retrievalDimensions: number;
  retrievalQueryLabels: string[];
  retrievalBatchSize: number;
  topK: number;
  maxContextTokens: number;
  analystProvider: string;
  analystModel: string;
  analystPromptVersion: string;
}

function required(values: Map<string, string>, name: string): string {
  const value = values.get(name)?.trim();
  if (!value) throw new Error(`DEVELOPMENT_GROUNDED_ARGUMENT_REQUIRED: ${name}`);
  return value;
}

export function parseDevelopmentGroundedArguments(argv: string[]): DevelopmentGroundedArguments {
  const preflight = argv.includes('--preflight');
  const pairs = argv.filter((value) => value !== '--preflight');
  const values = new Map<string, string>();
  for (let index = 0; index < pairs.length; index += 2) {
    const flag = pairs[index];
    const value = pairs[index + 1];
    if (!flag?.startsWith('--') || !value || value.startsWith('--')) {
      throw new Error(`DEVELOPMENT_GROUNDED_ARGUMENT_INVALID: ${flag || 'unknown'}`);
    }
    if (values.has(flag)) throw new Error(`DEVELOPMENT_GROUNDED_ARGUMENT_DUPLICATE: ${flag}`);
    values.set(flag, value);
  }
  const allowed = new Set([
    '--opportunity-id', '--document-version-id', '--requested-by-user-id', '--expected-document-id',
    '--expected-index-id', '--expected-document-sha256', '--expected-index-configuration-hash',
    '--expected-index-source-manifest-hash', '--expected-retrieval-embedding-provider',
    '--expected-retrieval-embedding-model', '--expected-analyst-provider', '--expected-analyst-model',
    '--idempotency-key',
  ]);
  for (const flag of values.keys()) {
    if (!allowed.has(flag)) throw new Error(`DEVELOPMENT_GROUNDED_ARGUMENT_UNKNOWN: ${flag}`);
  }
  const args = {
    opportunityId: required(values, '--opportunity-id'),
    documentVersionId: required(values, '--document-version-id'),
    requestedByUserId: required(values, '--requested-by-user-id'),
    expectedDocumentId: required(values, '--expected-document-id'),
    expectedIndexId: required(values, '--expected-index-id'),
    expectedDocumentSha256: required(values, '--expected-document-sha256').toLowerCase(),
    expectedIndexConfigurationHash: required(values, '--expected-index-configuration-hash').toLowerCase(),
    expectedIndexSourceManifestHash: required(values, '--expected-index-source-manifest-hash').toLowerCase(),
    expectedRetrievalEmbeddingProvider: required(values, '--expected-retrieval-embedding-provider'),
    expectedRetrievalEmbeddingModel: required(values, '--expected-retrieval-embedding-model'),
    expectedAnalystProvider: required(values, '--expected-analyst-provider'),
    expectedAnalystModel: required(values, '--expected-analyst-model'),
    idempotencyKey: required(values, '--idempotency-key'),
    preflight,
  };
  for (const hash of [args.expectedDocumentSha256, args.expectedIndexConfigurationHash, args.expectedIndexSourceManifestHash]) {
    if (!/^[a-f0-9]{64}$/.test(hash)) throw new Error('DEVELOPMENT_GROUNDED_HASH_INVALID');
  }
  return args;
}

function reject(condition: boolean, code: string): void {
  if (condition) throw new Error(`DEVELOPMENT_GROUNDED_${code}_REJECTED`);
}

export async function runDevelopmentGroundedEvaluation(
  args: DevelopmentGroundedArguments,
  plan: GroundedProviderPlan,
  dependencies: DevelopmentGroundedDependencies
) {
  reject(process.env.NODE_ENV !== 'development', 'ENVIRONMENT');
  const databaseName = await dependencies.getCurrentDatabaseName();
  reject(databaseName !== DEVELOPMENT_GROUNDED_DATABASE, 'DATABASE');
  reject(plan.retrievalProvider !== args.expectedRetrievalEmbeddingProvider, 'RETRIEVAL_PROVIDER');
  reject(plan.retrievalModel !== args.expectedRetrievalEmbeddingModel, 'RETRIEVAL_MODEL');
  reject(plan.retrievalDimensions !== 1536, 'RETRIEVAL_DIMENSIONS');
  reject(plan.analystProvider !== args.expectedAnalystProvider, 'ANALYST_PROVIDER');
  reject(plan.analystModel !== args.expectedAnalystModel, 'ANALYST_MODEL');

  const target = await dependencies.loadTarget(args);
  reject(!target.opportunity || target.opportunity.id !== args.opportunityId, 'OPPORTUNITY');
  reject(target.opportunity!.externalOpportunityId !== '363637', 'OPPORTUNITY_EXTERNAL_ID');
  reject(target.opportunity!.fundingOpportunityNumber !== 'O-BJA-2026-172698', 'OPPORTUNITY_NUMBER');
  reject(!target.document || target.document.id !== args.expectedDocumentId, 'DOCUMENT');
  reject(target.document!.fundingOpportunityId !== args.opportunityId || target.document!.documentType !== 'OFFICIAL_NOTICE', 'DOCUMENT_BINDING');
  reject(!target.version || target.version.id !== args.documentVersionId, 'DOCUMENT_VERSION');
  reject(target.version!.fundingDocumentId !== args.expectedDocumentId, 'DOCUMENT_VERSION_BINDING');
  reject(target.version!.status !== 'READY', 'DOCUMENT_VERSION_STATUS');
  reject(target.version!.sha256 !== args.expectedDocumentSha256 || target.version!.pageCount !== 17, 'DOCUMENT_VERSION_INTEGRITY');
  const pageNumbers = [...target.version!.pageNumbers].sort((a, b) => a - b);
  reject(pageNumbers.length !== 17 || pageNumbers.some((page, index) => page !== index + 1), 'PAGE_INTEGRITY');
  reject(!target.index || target.index.id !== args.expectedIndexId, 'INDEX');
  reject(target.index!.documentVersionId !== args.documentVersionId, 'INDEX_BINDING');
  reject(target.index!.status !== 'READY', 'INDEX_STATUS');
  reject(target.index!.embeddingProvider !== plan.retrievalProvider, 'INDEX_PROVIDER');
  reject(target.index!.embeddingModel !== plan.retrievalModel, 'INDEX_MODEL');
  reject(target.index!.embeddingDimensions !== plan.retrievalDimensions, 'INDEX_DIMENSIONS');
  reject(target.index!.chunkCount !== 26, 'INDEX_CHUNKS');
  reject(target.index!.configurationHash !== args.expectedIndexConfigurationHash, 'INDEX_CONFIGURATION_HASH');
  reject(target.index!.sourceManifestHash !== args.expectedIndexSourceManifestHash, 'INDEX_SOURCE_MANIFEST_HASH');
  reject(!target.requester || target.requester.id !== args.requestedByUserId, 'REQUESTER');
  reject(target.requester!.role !== 'ADMIN' || target.requester!.accountState !== 'ACTIVE', 'REQUESTER_STATE');

  const existing = await dependencies.findExistingEvaluation(args);
  if (existing) {
    reject(existing.documentIndexId !== args.expectedIndexId, 'IDEMPOTENCY_INDEX_BINDING');
    reject(existing.provider !== plan.analystProvider || existing.model !== plan.analystModel, 'IDEMPOTENCY_PROVIDER');
    reject(existing.promptVersion !== plan.analystPromptVersion, 'IDEMPOTENCY_PROMPT');
  }

  const base = {
    databaseName,
    opportunityId: args.opportunityId,
    documentId: args.expectedDocumentId,
    documentVersionId: args.documentVersionId,
    documentIndexId: args.expectedIndexId,
    documentSha256: target.version!.sha256,
    configurationHash: target.index!.configurationHash,
    sourceManifestHash: target.index!.sourceManifestHash,
    retrievalQueryCount: plan.retrievalQueryLabels.length,
    retrievalQueryLabels: plan.retrievalQueryLabels,
    retrievalEmbeddingProvider: plan.retrievalProvider,
    retrievalEmbeddingModel: plan.retrievalModel,
    retrievalEmbeddingDimensions: plan.retrievalDimensions,
    retrievalBatchSize: plan.retrievalBatchSize,
    expectedRetrievalEmbeddingRequests: 1,
    topK: plan.topK,
    maxContextTokens: plan.maxContextTokens,
    analystProvider: plan.analystProvider,
    analystModel: plan.analystModel,
    analystPromptVersion: plan.analystPromptVersion,
    expectedAnalystRequests: 1,
    expectedTotalProviderRequests: 2,
    idempotencyKey: args.idempotencyKey,
    existingEvaluation: existing,
  };

  if (args.preflight) {
    return { ...base, mode: 'preflight', retrievalExecution: 'NOT_RUN', evaluationMutation: 'NOT_RUN' };
  }
  const evaluation = await dependencies.executeGroundedEvaluation(args);
  return { ...base, mode: 'executed', retrievalExecution: 'COMPLETED', evaluation };
}
