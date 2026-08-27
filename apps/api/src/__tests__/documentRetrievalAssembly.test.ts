import { describe, expect, it } from 'vitest';
import { assembleRetrievedEvidence, ControlledQueryDefinition } from '../services/documentRetrievalService';

const queries: ControlledQueryDefinition[] = [
  { label: 'FIRST', queryText: 'first' },
  { label: 'SECOND', queryText: 'second' },
];

function hit(id: string, tokenCount: number, pageNumber: number) {
  return {
    id,
    documentIndexId: 'index',
    documentPageId: `page-${pageNumber}`,
    pageNumber,
    chunkIndex: 0,
    text: `text-${id}`,
    textHash: `hash-${id}`,
    tokenCount,
    citationRef: `DOC.version.PAGE.${pageNumber}`,
    similarity: 0.9,
  };
}

describe('DocumentRetrievalService evidence assembly', () => {
  it('globally deduplicates repeated chunks and retains first-query provenance', () => {
    const shared = hit('shared', 100, 1);
    const result = assembleRetrievedEvidence(
      queries,
      [[shared, hit('first-only', 100, 2)], [shared, hit('second-only', 100, 3)]],
      6000
    );

    expect(result.retrievedEvidence.map((item) => item.chunkId)).toEqual([
      'shared', 'first-only', 'second-only',
    ]);
    expect(result.retrievedEvidence[0]).toEqual(expect.objectContaining({
      chunkId: 'shared', queryLabel: 'FIRST', rank: 1,
    }));
    expect(result.totalRetrievedTokens).toBe(300);
  });

  it('applies one deterministic token budget without charging duplicate chunks', () => {
    const shared = hit('shared', 100, 1);
    const result = assembleRetrievedEvidence(
      queries,
      [[shared], [shared, hit('fits-after-duplicate', 150, 2), hit('over-budget', 1, 3)]],
      250
    );

    expect(result.retrievedEvidence.map((item) => item.chunkId)).toEqual([
      'shared', 'fits-after-duplicate',
    ]);
    expect(result.totalRetrievedTokens).toBe(250);
  });
});
