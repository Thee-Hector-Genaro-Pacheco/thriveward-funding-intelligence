import crypto from 'crypto';
import {
  DocumentEmbeddingProvider,
  EmbeddingBatchInput,
  EmbeddingBatchResult,
} from './documentEmbeddingProvider';

export class DeterministicDocumentEmbeddingProvider implements DocumentEmbeddingProvider {
  private dimensions: number;

  constructor(dimensions = 1536) {
    this.dimensions = dimensions;
  }

  public isConfigured(): boolean {
    return true;
  }

  public getProviderName(): string {
    return 'DETERMINISTIC_MOCK';
  }

  public async embedDocuments(input: EmbeddingBatchInput): Promise<EmbeddingBatchResult> {
    return this.generateDeterministicBatch(input);
  }

  public async embedQueries(input: EmbeddingBatchInput): Promise<EmbeddingBatchResult> {
    return this.generateDeterministicBatch(input);
  }

  private generateDeterministicBatch(input: EmbeddingBatchInput): EmbeddingBatchResult {
    const dim = input.dimensions || this.dimensions;
    const vectors: number[][] = [];
    let estimatedTokens = 0;

    for (const text of input.texts) {
      estimatedTokens += Math.max(1, Math.ceil(text.length / 4));
      vectors.push(DeterministicDocumentEmbeddingProvider.generateVectorForText(text, dim));
    }

    return {
      vectors,
      model: input.model || 'deterministic-mock-v1',
      dimensions: dim,
      totalTokens: estimatedTokens,
      providerRequestCount: 1,
    };
  }

  /**
   * Generates a normalized 1536-dimensional unit vector deterministically from input text.
   * Keyword similarity boosts specific dimension buckets so controlled queries accurately rank relevant text.
   */
  public static generateVectorForText(text: string, dimensions = 1536): number[] {
    const vec: number[] = new Array(dimensions).fill(0);
    const hash = crypto.createHash('sha256').update(text, 'utf8').digest();

    // Use hash bytes to populate pseudo-random base values in [-1, 1]
    for (let i = 0; i < dimensions; i++) {
      const byteVal = hash[i % hash.length];
      const secondaryByte = hash[(i + 13) % hash.length];
      const rawVal = ((byteVal ^ secondaryByte) / 255.0) * 2 - 1;
      vec[i] = rawVal;
    }

    // Keyword topic alignment buckets for deterministic vector similarity testing
    const lower = text.toLowerCase();
    if (lower.includes('eligibility') || lower.includes('disqualif') || lower.includes('501(c)(3)')) {
      for (let i = 0; i < 100; i++) vec[i] += 5.0;
    }
    if (lower.includes('purpose') || lower.includes('population') || lower.includes('youth') || lower.includes('homeless')) {
      for (let i = 100; i < 200; i++) vec[i] += 5.0;
    }
    if (lower.includes('requirement') || lower.includes('deadline') || lower.includes('due date')) {
      for (let i = 200; i < 300; i++) vec[i] += 5.0;
    }
    if (lower.includes('award') || lower.includes('cost share') || lower.includes('matching') || lower.includes('funding')) {
      for (let i = 300; i < 400; i++) vec[i] += 5.0;
    }
    if (lower.includes('capacity') || lower.includes('partner') || lower.includes('governance')) {
      for (let i = 400; i < 500; i++) vec[i] += 5.0;
    }

    // Normalize vector to unit length (L2 norm = 1)
    let normSq = 0;
    for (let i = 0; i < dimensions; i++) {
      normSq += vec[i] * vec[i];
    }
    const norm = Math.sqrt(normSq) || 1.0;
    for (let i = 0; i < dimensions; i++) {
      vec[i] = vec[i] / norm;
    }

    return vec;
  }
}
