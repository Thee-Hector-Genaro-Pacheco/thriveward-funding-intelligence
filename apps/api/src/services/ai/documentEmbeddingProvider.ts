export interface EmbeddingBatchInput {
  texts: string[];
  model: string;
  dimensions: number;
}

export interface EmbeddingBatchResult {
  vectors: number[][];
  model: string;
  dimensions: number;
  totalTokens: number;
  providerRequestCount: number;
}

export interface DocumentEmbeddingProvider {
  embedDocuments(input: EmbeddingBatchInput): Promise<EmbeddingBatchResult>;
  embedQueries(input: EmbeddingBatchInput): Promise<EmbeddingBatchResult>;
  isConfigured(): boolean;
  getProviderName(): string;
}
