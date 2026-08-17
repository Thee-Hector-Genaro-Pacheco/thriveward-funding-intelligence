import OpenAI from 'openai';
import {
  DocumentEmbeddingProvider,
  EmbeddingBatchInput,
  EmbeddingBatchResult,
} from './documentEmbeddingProvider';

export class OpenAiDocumentEmbeddingProvider implements DocumentEmbeddingProvider {
  private client: OpenAI | null = null;
  private model: string;
  private dimensions: number;
  private timeoutMs: number;

  constructor() {
    const isGroundingEnabled = process.env.AI_DOCUMENT_GROUNDING_ENABLED === 'true';
    const apiKey = process.env.OPENAI_API_KEY || '';
    this.model = process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small';
    this.dimensions = Number(process.env.OPENAI_EMBEDDING_DIMENSIONS) || 1536;
    this.timeoutMs = Number(process.env.OPENAI_EMBEDDING_TIMEOUT_MS) || 30000;

    if (isGroundingEnabled && apiKey) {
      this.client = new OpenAI({
        apiKey,
        timeout: this.timeoutMs,
        maxRetries: 0, // Disable automatic retries to prevent unexpected cost/retries
      });
    }
  }

  public isConfigured(): boolean {
    const isGroundingEnabled = process.env.AI_DOCUMENT_GROUNDING_ENABLED === 'true';
    return Boolean(isGroundingEnabled && this.client);
  }

  public getProviderName(): string {
    return 'OPENAI';
  }

  public async embedDocuments(input: EmbeddingBatchInput): Promise<EmbeddingBatchResult> {
    return this.executeEmbedding(input);
  }

  public async embedQueries(input: EmbeddingBatchInput): Promise<EmbeddingBatchResult> {
    return this.executeEmbedding(input);
  }

  private async executeEmbedding(input: EmbeddingBatchInput): Promise<EmbeddingBatchResult> {
    if (!this.isConfigured() || !this.client) {
      throw new Error(
        'AI_DOCUMENT_GROUNDING_NOT_CONFIGURED: Document grounding service is disabled or OPENAI_API_KEY is missing.'
      );
    }

    if (!input.texts || input.texts.length === 0) {
      throw new Error('EMBEDDING_INPUT_EMPTY: Cannot generate embeddings for an empty text array.');
    }

    const targetModel = input.model || this.model;
    const targetDimensions = input.dimensions || this.dimensions;

    try {
      const response = await this.client.embeddings.create({
        model: targetModel,
        input: input.texts,
        encoding_format: 'float',
        dimensions: targetDimensions,
      });

      if (!response.data || response.data.length !== input.texts.length) {
        throw new Error(
          `EMBEDDING_PROVIDER_MISMATCH: Expected ${input.texts.length} vectors, received ${response.data?.length ?? 0}.`
        );
      }

      // Preserve strict input/output ordering
      const sortedData = [...response.data].sort((a, b) => a.index - b.index);
      const vectors: number[][] = [];

      for (let i = 0; i < sortedData.length; i++) {
        const item = sortedData[i];
        if (!item || !Array.isArray(item.embedding)) {
          throw new Error(`EMBEDDING_ITEM_INVALID: Embedding item at index ${i} is missing or invalid.`);
        }

        const vec = item.embedding;
        if (vec.length !== targetDimensions) {
          throw new Error(
            `EMBEDDING_DIMENSION_MISMATCH: Expected ${targetDimensions} dimensions, received ${vec.length} at index ${i}.`
          );
        }

        // Validate numeric finiteness (reject NaN, +Infinity, -Infinity)
        for (let d = 0; d < vec.length; d++) {
          const val = vec[d];
          if (typeof val !== 'number' || !Number.isFinite(val)) {
            throw new Error(`EMBEDDING_NUMERIC_INVALID: Non-finite value detected at index ${i}, dimension ${d}.`);
          }
        }

        vectors.push(vec);
      }

      const totalTokens = response.usage?.total_tokens ?? 0;

      return {
        vectors,
        model: targetModel,
        dimensions: targetDimensions,
        totalTokens,
        providerRequestCount: 1,
      };
    } catch (err: any) {
      if (err.message && err.message.startsWith('EMBEDDING_')) {
        throw err;
      }
      const sanitizedMsg = err.message ? err.message.replace(/sk-[a-zA-Z0-9_-]+/g, '[REDACTED_KEY]') : 'Upstream embedding error';
      throw new Error(`EMBEDDING_PROVIDER_FAILURE: ${sanitizedMsg}`);
    }
  }
}
