import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { GroundedEvidenceModal, RetrievedEvidenceData } from '../GroundedEvidenceModal';

describe('GroundedEvidenceModal Component Metrics Suite', () => {
  it('renders "25 retrieval hits • 5 unique document chunks" for evidence containing duplicate chunk IDs', () => {
    // 25 evidence item hit rows pointing to 5 unique chunk IDs
    const evidenceItems = Array.from({ length: 25 }, (_, i) => ({
      id: `item-${i + 1}`,
      retrievalRunId: 'run-1',
      documentChunkId: `chunk-${(i % 5) + 1}`, // chunk-1, chunk-2, chunk-3, chunk-4, chunk-5 repeated 5 times
      queryLabel: 'ELIGIBILITY_AND_DISQUALIFYING_FACTORS',
      rank: (i % 5) + 1,
      cosineSimilarity: 0.92,
      citationRef: `DOC.ver-1.PAGE.${(i % 5) + 1}`,
      pageNumber: (i % 5) + 1,
      excerptSnapshot: `Excerpt text ${i + 1}`,
      textHash: `hash-${i + 1}`,
      createdAt: new Date().toISOString(),
    }));

    const mockData: RetrievedEvidenceData = {
      retrievalRunId: 'run-1',
      evaluationId: 'eval-1',
      documentIndexId: 'idx-1',
      retrievalVersion: 'document-retrieval-v1',
      documentTitle: 'Reentry Outreach Notice',
      documentVersionId: 'ver-1',
      querySnapshot: [{ label: 'ELIGIBILITY', queryText: 'Query text' }],
      retrievalConfiguration: { topK: 5, maxContextTokens: 6000, embeddingModel: 'text-embedding-3-small' },
      retrievalHash: 'ret-hash',
      createdAt: new Date().toISOString(),
      evidenceItems,
    };

    render(
      <GroundedEvidenceModal
        isOpen={true}
        onClose={vi.fn()}
        evidenceData={mockData}
        loading={false}
        error={null}
      />
    );

    expect(
      screen.getByText('25 retrieval hits • 5 unique document chunks')
    ).toBeInTheDocument();
  });
});
