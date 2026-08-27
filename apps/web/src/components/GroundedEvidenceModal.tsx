import React from 'react';
import { calculateRetrievalMetrics } from '../utils/retrievalMetrics';

export interface RetrievedEvidenceItem {
  id: string;
  retrievalRunId: string;
  documentChunkId: string;
  queryLabel: string;
  rank: number;
  cosineSimilarity: number;
  citationRef: string;
  pageNumber: number;
  excerptSnapshot: string;
  textHash: string;
  createdAt: string;
}

export interface RetrievedEvidenceData {
  retrievalRunId: string;
  evaluationId: string;
  documentIndexId: string;
  retrievalVersion: string;
  documentTitle: string;
  documentType?: string;
  documentVersionId: string;
  documentVersionNumber?: number;
  querySnapshot: Array<{ label: string; queryText: string }>;
  retrievalConfiguration: { topK: number; maxContextTokens: number; embeddingModel: string };
  retrievalHash: string;
  createdAt: string;
  evidenceItems: RetrievedEvidenceItem[];
}

interface GroundedEvidenceModalProps {
  isOpen: boolean;
  onClose: () => void;
  evidenceData: RetrievedEvidenceData | null;
  loading: boolean;
  error: string | null;
  onSelectPage?: (pageNumber: number) => void;
}

export const GroundedEvidenceModal: React.FC<GroundedEvidenceModalProps> = ({
  isOpen,
  onClose,
  evidenceData,
  loading,
  error,
  onSelectPage,
}) => {
  if (!isOpen) return null;

  const formatQueryLabel = (label: string) => {
    return label.replace(/_/g, ' ');
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0,0,0,0.85)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1000,
        padding: '1rem',
      }}
    >
      <div
        style={{
          background: '#0f172a',
          border: '1px solid #38bdf8',
          borderRadius: '0.75rem',
          width: '100%',
          maxWidth: '900px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 25px -5px rgba(0,0,0,0.5), 0 8px 10px -6px rgba(0,0,0,0.5)',
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid rgba(255,255,255,0.1)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: 'rgba(30, 41, 59, 0.5)',
          }}
        >
          <div>
            <span
              style={{
                background: '#0284c7',
                color: '#e0f2fe',
                fontWeight: 800,
                fontSize: '0.75rem',
                padding: '0.2rem 0.5rem',
                borderRadius: '0.25rem',
                letterSpacing: '0.05em',
              }}
            >
              RETRIEVED SEMANTIC EVIDENCE
            </span>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f8fafc', marginTop: '0.35rem' }}>
              📜 Document Grounding Excerpts ({evidenceData?.documentTitle || 'Official Notice'})
            </h3>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              fontSize: '1.5rem',
              cursor: 'pointer',
              padding: '0.2rem 0.5rem',
            }}
          >
            ✕
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '1.25rem', overflowY: 'auto', flex: 1 }}>
          {loading && (
            <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>
              ⏳ Loading retrieved semantic evidence snapshot...
            </div>
          )}

          {error && (
            <div
              style={{
                padding: '1rem',
                background: 'rgba(239,68,68,0.15)',
                border: '1px solid rgba(239,68,68,0.3)',
                borderRadius: '0.5rem',
                color: '#fca5a5',
                fontSize: '0.9rem',
              }}
            >
              ❌ <strong>Error loading evidence:</strong> {error}
            </div>
          )}

          {evidenceData && !loading && (
            <div>
              {/* Metadata Banner */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                  gap: '0.75rem',
                  marginBottom: '1.25rem',
                  background: 'rgba(30, 41, 59, 0.6)',
                  padding: '0.85rem',
                  borderRadius: '0.5rem',
                  border: '1px solid rgba(255,255,255,0.08)',
                }}
              >
                <div>
                  <span style={{ fontSize: '0.7rem', color: '#94a3b8', display: 'block' }}>GROUNDING SOURCE</span>
                  <strong style={{ fontSize: '0.85rem', color: '#38bdf8' }}>
                    {evidenceData.documentTitle} {evidenceData.documentVersionNumber ? `(v${evidenceData.documentVersionNumber})` : ''}
                  </strong>
                  <span style={{ fontSize: '0.68rem', color: '#64748b', display: 'block' }}>
                    Version ID: {evidenceData.documentVersionId ? `${evidenceData.documentVersionId.substring(0, 8)}...` : 'N/A'}
                  </span>
                </div>
                <div>
                  <span style={{ fontSize: '0.7rem', color: '#94a3b8', display: 'block' }}>RETRIEVAL VERSION</span>
                  <strong style={{ fontSize: '0.85rem', color: '#cbd5e1' }}>{evidenceData.retrievalVersion}</strong>
                </div>
                <div>
                  <span style={{ fontSize: '0.7rem', color: '#94a3b8', display: 'block' }}>EMBEDDING MODEL</span>
                  <strong style={{ fontSize: '0.85rem', color: '#cbd5e1' }}>
                    {evidenceData.retrievalConfiguration.embeddingModel}
                  </strong>
                </div>
                <div>
                  <span style={{ fontSize: '0.7rem', color: '#94a3b8', display: 'block' }}>TOP-K PER QUERY</span>
                  <strong style={{ fontSize: '0.85rem', color: '#cbd5e1' }}>
                    {evidenceData.retrievalConfiguration.topK}
                  </strong>
                </div>
                <div>
                  <span style={{ fontSize: '0.7rem', color: '#94a3b8', display: 'block' }}>RETRIEVAL METRICS</span>
                  <strong style={{ fontSize: '0.85rem', color: '#34d399' }}>
                    {calculateRetrievalMetrics(evidenceData.evidenceItems).displayText}
                  </strong>
                </div>
              </div>

              {/* Disclaimer */}
              <div
                style={{
                  padding: '0.75rem',
                  background: 'rgba(234, 179, 8, 0.1)',
                  border: '1px solid rgba(234, 179, 8, 0.25)',
                  borderRadius: '0.5rem',
                  color: '#fef08a',
                  fontSize: '0.75rem',
                  marginBottom: '1.25rem',
                  lineHeight: 1.4,
                }}
              >
                <strong>📌 GROUNDING DISCLAIMER:</strong> Document-grounded AI decision support. Semantic retrieval identifies potentially relevant evidence but does not prove legal eligibility. Verify every citation against the official notice before acting. Human review does not authorize submission.
              </div>

              {/* Evidence Items */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {evidenceData.evidenceItems.map((item, idx) => (
                  <div
                    key={item.id || idx}
                    style={{
                      background: 'rgba(15, 23, 42, 0.9)',
                      border: '1px solid rgba(56, 189, 248, 0.3)',
                      borderRadius: '0.5rem',
                      padding: '1rem',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: '0.5rem',
                        marginBottom: '0.6rem',
                        borderBottom: '1px solid rgba(255,255,255,0.06)',
                        paddingBottom: '0.5rem',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span
                          style={{
                            background: '#0369a1',
                            color: '#e0f2fe',
                            fontWeight: 700,
                            fontSize: '0.7rem',
                            padding: '0.15rem 0.4rem',
                            borderRadius: '0.2rem',
                          }}
                        >
                          {formatQueryLabel(item.queryLabel)}
                        </span>
                        <span
                          style={{
                            background: 'rgba(56, 189, 248, 0.15)',
                            color: '#38bdf8',
                            fontWeight: 700,
                            fontSize: '0.75rem',
                            padding: '0.15rem 0.4rem',
                            borderRadius: '0.2rem',
                          }}
                        >
                          Rank #{item.rank}
                        </span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <span style={{ fontSize: '0.75rem', color: '#a7f3d0' }}>
                          Similarity: <strong>{(item.cosineSimilarity * 100).toFixed(1)}%</strong>
                        </span>

                        <span
                          style={{
                            fontSize: '0.75rem',
                            color: '#e2e8f0',
                            fontFamily: 'monospace',
                            background: 'rgba(255,255,255,0.05)',
                            padding: '0.15rem 0.4rem',
                            borderRadius: '0.2rem',
                          }}
                        >
                          {item.citationRef}
                        </span>

                        {onSelectPage && (
                          <button
                            onClick={() => {
                              onSelectPage(item.pageNumber);
                              onClose();
                            }}
                            style={{
                              background: '#2563eb',
                              color: '#ffffff',
                              border: 'none',
                              padding: '0.25rem 0.6rem',
                              borderRadius: '0.25rem',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              cursor: 'pointer',
                            }}
                          >
                            View Page {item.pageNumber} 📖
                          </button>
                        )}
                      </div>
                    </div>

                    <p
                      style={{
                        fontSize: '0.85rem',
                        color: '#f1f5f9',
                        lineHeight: 1.5,
                        whiteSpace: 'pre-wrap',
                        fontFamily: 'sans-serif',
                        background: 'rgba(0, 0, 0, 0.3)',
                        padding: '0.75rem',
                        borderRadius: '0.375rem',
                        borderLeft: '3px solid #38bdf8',
                      }}
                    >
                      "{item.excerptSnapshot}"
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div
          style={{
            padding: '1rem 1.5rem',
            borderTop: '1px solid rgba(255,255,255,0.1)',
            display: 'flex',
            justifyContent: 'flex-end',
            background: 'rgba(30, 41, 59, 0.5)',
          }}
        >
          <button
            onClick={onClose}
            style={{
              background: '#334155',
              color: '#f8fafc',
              border: '1px solid rgba(255,255,255,0.1)',
              padding: '0.4rem 1rem',
              borderRadius: '0.375rem',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
