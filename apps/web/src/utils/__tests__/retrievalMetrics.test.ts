import { describe, it, expect } from 'vitest';
import { calculateRetrievalMetrics } from '../retrievalMetrics';

describe('retrievalMetrics helper suite', () => {
  it('correctly calculates 25 retrieval hits and 5 unique document chunks', () => {
    // 25 items across 5 distinct chunk IDs
    const items = Array.from({ length: 25 }, (_, i) => ({
      documentChunkId: `chunk-${(i % 5) + 1}`,
    }));

    const result = calculateRetrievalMetrics(items);
    expect(result.totalHits).toBe(25);
    expect(result.uniqueChunks).toBe(5);
    expect(result.displayText).toBe('25 retrieval hits • 5 unique document chunks');
  });

  it('correctly deduplicates chunk IDs (chunk-a, chunk-a, chunk-b -> 5 hits, 2 unique chunks)', () => {
    const items = [
      { documentChunkId: 'chunk-a' },
      { documentChunkId: 'chunk-a' },
      { documentChunkId: 'chunk-b' },
      { documentChunkId: 'chunk-b' },
      { documentChunkId: 'chunk-b' },
    ];

    const result = calculateRetrievalMetrics(items);
    expect(result.totalHits).toBe(5);
    expect(result.uniqueChunks).toBe(2);
    expect(result.displayText).toBe('5 retrieval hits • 2 unique document chunks');
  });

  it('handles missing, null, undefined, and empty string documentChunkId values safely without increasing unique count', () => {
    const items = [
      { documentChunkId: 'chunk-1' },
      { documentChunkId: undefined },
      { documentChunkId: null as any },
      { documentChunkId: '' },
      { documentChunkId: '   ' },
    ];

    const result = calculateRetrievalMetrics(items);
    expect(result.totalHits).toBe(5);
    expect(result.uniqueChunks).toBe(1);
    expect(result.displayText).toBe('5 retrieval hits • 1 unique document chunks');
  });

  it('handles empty or null evidence item arrays safely', () => {
    const resultNull = calculateRetrievalMetrics(null);
    expect(resultNull.totalHits).toBe(0);
    expect(resultNull.uniqueChunks).toBe(0);

    const resultEmpty = calculateRetrievalMetrics([]);
    expect(resultEmpty.totalHits).toBe(0);
    expect(resultEmpty.uniqueChunks).toBe(0);
  });
});
