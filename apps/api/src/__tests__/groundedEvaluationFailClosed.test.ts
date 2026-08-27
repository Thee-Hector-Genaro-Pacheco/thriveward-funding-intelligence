import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  retrieve: vi.fn(),
  transaction: vi.fn(),
  evaluationCreate: vi.fn(),
}));

vi.mock('../lib/prisma', () => ({
  prisma: {
    aiEvaluation: {
      count: vi.fn().mockResolvedValue(0),
      findFirst: vi.fn().mockResolvedValue(null),
      create: mocks.evaluationCreate,
    },
    fundingOpportunity: { findUnique: vi.fn().mockResolvedValue({ id: 'opportunity' }) },
    organizationProfile: { findFirst: vi.fn().mockResolvedValue(null) },
    $transaction: mocks.transaction,
  },
}));

vi.mock('../services/documentIndexingService', () => ({
  DocumentIndexingService: { isGroundingEnabled: vi.fn().mockReturnValue(true) },
}));

vi.mock('../services/documentRetrievalService', () => ({
  DocumentRetrievalService: { executeRetrieval: mocks.retrieve },
}));

import { AiFundingAnalystService } from '../services/aiFundingAnalystService';

describe('grounded evaluation fail-closed evidence boundary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.retrieve.mockResolvedValue({
      retrievalVersion: 'document-retrieval-v1',
      documentIndexId: 'index',
      documentVersionId: 'version',
      querySnapshot: [],
      retrievalConfiguration: {},
      retrievalHash: 'hash',
      totalRetrievedChunks: 0,
      totalRetrievedTokens: 0,
      retrievedEvidence: [],
    });
  });

  it('rejects empty retrieval before analyst invocation or persistence', async () => {
    const analyze = vi.fn();
    const provider = {
      isConfigured: () => true,
      getProviderName: () => 'MOCK',
      getModelName: () => 'mock-model',
      analyze,
    } as any;

    await expect(AiFundingAnalystService.generateGroundedEvaluation({
      opportunityId: 'opportunity',
      documentVersionId: 'version',
      documentIndexId: 'index',
      userId: 'user',
      provider,
    })).rejects.toThrow('GROUNDED_RETRIEVAL_EVIDENCE_REQUIRED');

    expect(mocks.retrieve).toHaveBeenCalledOnce();
    expect(analyze).not.toHaveBeenCalled();
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.evaluationCreate).not.toHaveBeenCalled();
  });
});
