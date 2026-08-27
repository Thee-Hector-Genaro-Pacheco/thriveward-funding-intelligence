import {
  computeFullIndexConfigurationHash,
  DEFAULT_DOCUMENT_EMBEDDING_BATCH_SIZE,
  DOCUMENT_INDEX_OVERLAP_TOKENS,
  DOCUMENT_INDEX_TARGET_TOKENS,
  DOCUMENT_INDEX_VECTOR_DIMENSIONS,
  DocumentIndexProviderIdentity,
} from './ai/documentIndexingConfiguration';
import { DocumentChunkerService, RawChunkInput } from './ai/documentChunkerService';

export const DEVELOPMENT_INDEX_DATABASE_NAME = 'bridge_ai_dev';

export interface DevelopmentIndexArguments {
  documentVersionId: string;
  requestedByUserId: string;
  expectedOpportunityId: string;
  expectedDocumentId: string;
  expectedSha256: string;
  expectedPageCount: number;
  expectedProvider?: string;
  expectedModel?: string;
  preflight: boolean;
}

interface DevelopmentDocumentVersion {
  id: string;
  status: string;
  sha256: string;
  pageCount: number;
  fundingDocumentId: string;
  fundingDocument: {
    id: string;
    fundingOpportunityId: string;
    documentType: string;
  };
  pages: RawChunkInput[];
}

interface DevelopmentRequester {
  id: string;
  role: string;
  accountState: string;
}

interface CompatibleIndex {
  id: string;
  status: string;
  sourceManifestHash: string;
  configurationHash: string;
  chunkCount: number;
  embeddingProvider: string;
  embeddingModel: string;
  embeddingDimensions: number;
}

interface IndexResult extends CompatibleIndex {}

export interface DevelopmentIndexDependencies {
  getCurrentDatabaseName(): Promise<string>;
  findDocumentVersion(id: string): Promise<DevelopmentDocumentVersion | null>;
  findRequester(id: string): Promise<DevelopmentRequester | null>;
  findCompatibleIndex(documentVersionId: string, configurationHash: string): Promise<CompatibleIndex | null>;
  indexDocument(input: {
    documentVersionId: string;
    userId: string;
    idempotencyKey: string;
  }): Promise<IndexResult>;
}

export interface DevelopmentIndexOutput {
  mode: 'preflight' | 'existing' | 'indexed';
  databaseName: string;
  documentVersionId: string;
  fundingDocumentId: string;
  opportunityId: string;
  sourceDocumentSha256: string;
  provider: string;
  embeddingModel: string;
  dimensions: number;
  targetTokens: number;
  overlapTokens: number;
  chunkCount: number;
  expectedProviderRequests: number;
  sourceManifestHash: string;
  configurationHash: string;
  documentIndexId: string | null;
  indexStatus: string;
  disposition: 'would-create' | 'reused' | 'created';
}

function required(values: Map<string, string>, flag: string): string {
  const value = values.get(flag)?.trim();
  if (!value) throw new Error(`DEVELOPMENT_INDEX_ARGUMENT_REQUIRED: ${flag}`);
  return value;
}

export function parseDevelopmentIndexArguments(argv: string[]): DevelopmentIndexArguments {
  const preflight = argv.includes('--preflight');
  const pairs = argv.filter((value) => value !== '--preflight');
  const values = new Map<string, string>();
  for (let index = 0; index < pairs.length; index += 2) {
    const flag = pairs[index];
    const value = pairs[index + 1];
    if (!flag?.startsWith('--') || value === undefined || value.startsWith('--')) {
      throw new Error(`DEVELOPMENT_INDEX_ARGUMENT_INVALID: ${flag || 'unknown'}`);
    }
    if (values.has(flag)) throw new Error(`DEVELOPMENT_INDEX_ARGUMENT_DUPLICATE: ${flag}`);
    values.set(flag, value);
  }
  const allowed = new Set([
    '--document-version-id', '--requested-by-user-id', '--expected-opportunity-id',
    '--expected-document-id', '--expected-sha256', '--expected-page-count',
    '--expected-provider', '--expected-model',
  ]);
  for (const flag of values.keys()) {
    if (!allowed.has(flag)) throw new Error(`DEVELOPMENT_INDEX_ARGUMENT_UNKNOWN: ${flag}`);
  }
  const expectedSha256 = required(values, '--expected-sha256').toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(expectedSha256)) {
    throw new Error('DEVELOPMENT_INDEX_SHA256_INVALID: --expected-sha256');
  }
  const expectedPageCount = Number(required(values, '--expected-page-count'));
  if (!Number.isInteger(expectedPageCount) || expectedPageCount < 1) {
    throw new Error('DEVELOPMENT_INDEX_PAGE_COUNT_INVALID: --expected-page-count');
  }
  return {
    documentVersionId: required(values, '--document-version-id'),
    requestedByUserId: required(values, '--requested-by-user-id'),
    expectedOpportunityId: required(values, '--expected-opportunity-id'),
    expectedDocumentId: required(values, '--expected-document-id'),
    expectedSha256,
    expectedPageCount,
    expectedProvider: values.get('--expected-provider')?.trim(),
    expectedModel: values.get('--expected-model')?.trim(),
    preflight,
  };
}

export function validateDevelopmentIndexDatabaseName(databaseName: string): void {
  if (databaseName !== DEVELOPMENT_INDEX_DATABASE_NAME) {
    throw new Error(`DEVELOPMENT_INDEX_DATABASE_REJECTED: connected database must be exactly ${DEVELOPMENT_INDEX_DATABASE_NAME}.`);
  }
}

function validateProvider(identity: DocumentIndexProviderIdentity, args: DevelopmentIndexArguments): void {
  if (identity.dimensions !== DOCUMENT_INDEX_VECTOR_DIMENSIONS) {
    throw new Error(`DEVELOPMENT_INDEX_DIMENSIONS_REJECTED: persistence requires exactly ${DOCUMENT_INDEX_VECTOR_DIMENSIONS} dimensions.`);
  }
  if (args.expectedProvider && identity.provider !== args.expectedProvider) {
    throw new Error('DEVELOPMENT_INDEX_PROVIDER_REJECTED: configured provider differs from expected provider.');
  }
  if (args.expectedModel && identity.model !== args.expectedModel) {
    throw new Error('DEVELOPMENT_INDEX_MODEL_REJECTED: configured model differs from expected model.');
  }
}

function validatePageIntegrity(version: DevelopmentDocumentVersion, expectedPageCount: number): void {
  if (version.pageCount !== expectedPageCount || version.pages.length !== expectedPageCount) {
    throw new Error('DEVELOPMENT_INDEX_PAGE_INTEGRITY_REJECTED: stored and extracted page counts must match expected count.');
  }
  const pageNumbers = version.pages.map((page) => page.pageNumber).sort((a, b) => a - b);
  if (new Set(pageNumbers).size !== expectedPageCount || pageNumbers.some((page, index) => page !== index + 1)) {
    throw new Error('DEVELOPMENT_INDEX_PAGE_INTEGRITY_REJECTED: page numbers must be complete and non-duplicated.');
  }
}

export async function runDevelopmentDocumentIndexing(
  args: DevelopmentIndexArguments,
  identity: DocumentIndexProviderIdentity,
  batchSize: number,
  dependencies: DevelopmentIndexDependencies
): Promise<DevelopmentIndexOutput> {
  if (process.env.NODE_ENV !== 'development') {
    throw new Error('DEVELOPMENT_INDEX_ENVIRONMENT_REJECTED: NODE_ENV must be development.');
  }
  validateProvider(identity, args);
  if (!Number.isInteger(batchSize) || batchSize < 1) {
    throw new Error('DEVELOPMENT_INDEX_BATCH_SIZE_REJECTED: batch size must be a positive integer.');
  }
  const databaseName = await dependencies.getCurrentDatabaseName();
  validateDevelopmentIndexDatabaseName(databaseName);
  const version = await dependencies.findDocumentVersion(args.documentVersionId);
  if (!version || version.id !== args.documentVersionId) {
    throw new Error('DEVELOPMENT_INDEX_DOCUMENT_VERSION_REJECTED: exact version was not found.');
  }
  if (version.status !== 'READY') throw new Error('DEVELOPMENT_INDEX_DOCUMENT_VERSION_REJECTED: status must be READY.');
  if (version.sha256 !== args.expectedSha256) throw new Error('DEVELOPMENT_INDEX_DOCUMENT_VERSION_REJECTED: SHA-256 differs.');
  if (version.fundingDocumentId !== args.expectedDocumentId || version.fundingDocument.id !== args.expectedDocumentId) {
    throw new Error('DEVELOPMENT_INDEX_DOCUMENT_VERSION_REJECTED: funding document ID differs.');
  }
  if (version.fundingDocument.fundingOpportunityId !== args.expectedOpportunityId) {
    throw new Error('DEVELOPMENT_INDEX_DOCUMENT_VERSION_REJECTED: opportunity ID differs.');
  }
  if (version.fundingDocument.documentType !== 'OFFICIAL_NOTICE') {
    throw new Error('DEVELOPMENT_INDEX_DOCUMENT_VERSION_REJECTED: document type must be OFFICIAL_NOTICE.');
  }
  validatePageIntegrity(version, args.expectedPageCount);
  const requester = await dependencies.findRequester(args.requestedByUserId);
  if (!requester || requester.id !== args.requestedByUserId || requester.role !== 'ADMIN' || requester.accountState !== 'ACTIVE') {
    throw new Error('DEVELOPMENT_INDEX_REQUESTER_REJECTED: requester must be the exact ACTIVE ADMIN user.');
  }

  const manifest = DocumentChunkerService.generateChunks(
    version.id,
    version.pages,
    DOCUMENT_INDEX_TARGET_TOKENS,
    DOCUMENT_INDEX_OVERLAP_TOKENS
  );
  const configurationHash = computeFullIndexConfigurationHash(manifest.configurationHash, identity);
  const existing = await dependencies.findCompatibleIndex(version.id, configurationHash);
  const base = {
    databaseName,
    documentVersionId: version.id,
    fundingDocumentId: version.fundingDocumentId,
    opportunityId: version.fundingDocument.fundingOpportunityId,
    sourceDocumentSha256: version.sha256,
    provider: identity.provider,
    embeddingModel: identity.model,
    dimensions: identity.dimensions,
    targetTokens: DOCUMENT_INDEX_TARGET_TOKENS,
    overlapTokens: DOCUMENT_INDEX_OVERLAP_TOKENS,
    chunkCount: manifest.chunks.length,
    expectedProviderRequests: Math.ceil(manifest.chunks.length / batchSize),
    sourceManifestHash: manifest.sourceManifestHash,
    configurationHash,
  };
  if (existing) {
    if (existing.status !== 'READY') {
      throw new Error(`DEVELOPMENT_INDEX_EXISTING_INDEX_REJECTED: compatible index status is ${existing.status}.`);
    }
    return { ...base, mode: 'existing', documentIndexId: existing.id, indexStatus: existing.status, disposition: 'reused' };
  }
  if (args.preflight) {
    return { ...base, mode: 'preflight', documentIndexId: null, indexStatus: 'NOT_INDEXED', disposition: 'would-create' };
  }
  const idempotencyKey = `dev-index:${version.id}:${configurationHash}:${manifest.sourceManifestHash}`;
  const indexed = await dependencies.indexDocument({
    documentVersionId: version.id,
    userId: requester.id,
    idempotencyKey,
  });
  return { ...base, mode: 'indexed', documentIndexId: indexed.id, indexStatus: indexed.status, disposition: 'created' };
}

export function readDevelopmentIndexProviderIdentity(env: NodeJS.ProcessEnv): DocumentIndexProviderIdentity {
  return {
    provider: 'OPENAI',
    model: env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small',
    dimensions: Number(env.OPENAI_EMBEDDING_DIMENSIONS) || DOCUMENT_INDEX_VECTOR_DIMENSIONS,
  };
}

export function readDevelopmentIndexBatchSize(env: NodeJS.ProcessEnv): number {
  return Number(env.DOCUMENT_EMBEDDING_BATCH_SIZE) || DEFAULT_DOCUMENT_EMBEDDING_BATCH_SIZE;
}
