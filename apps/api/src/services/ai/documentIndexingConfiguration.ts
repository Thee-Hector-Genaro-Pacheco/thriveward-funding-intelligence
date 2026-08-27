import crypto from 'crypto';

export const DOCUMENT_INDEX_TARGET_TOKENS = 500;
export const DOCUMENT_INDEX_OVERLAP_TOKENS = 75;
export const DOCUMENT_INDEX_VECTOR_DIMENSIONS = 1536;
export const DEFAULT_DOCUMENT_EMBEDDING_BATCH_SIZE = 32;

export interface DocumentIndexProviderIdentity {
  provider: string;
  model: string;
  dimensions: number;
}

export function computeFullIndexConfigurationHash(
  chunkConfigurationHash: string,
  identity: DocumentIndexProviderIdentity
): string {
  const canonicalInput = `CHUNK_CONFIG:${chunkConfigurationHash};EMBEDDING_PROVIDER:${identity.provider};EMBEDDING_MODEL:${identity.model};EMBEDDING_DIMENSIONS:${identity.dimensions}`;
  return crypto.createHash('sha256').update(canonicalInput).digest('hex');
}
