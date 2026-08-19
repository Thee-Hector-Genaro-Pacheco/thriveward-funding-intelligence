export interface RetrievedChunkLike {
  documentChunkId?: string | null;
}

export function calculateRetrievalMetrics(evidenceItems?: RetrievedChunkLike[] | null) {
  const totalHits = Array.isArray(evidenceItems) ? evidenceItems.length : 0;
  const uniqueChunks = new Set(
    (evidenceItems || [])
      .map((item) => item?.documentChunkId)
      .filter((id): id is string => typeof id === 'string' && id.trim().length > 0)
  ).size;

  return {
    totalHits,
    uniqueChunks,
    displayText: `${totalHits} retrieval hits • ${uniqueChunks} unique document chunks`,
  };
}
