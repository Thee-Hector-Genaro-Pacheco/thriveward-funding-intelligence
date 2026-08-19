import React, { useState } from 'react';
import { GroundedEvidenceModal, RetrievedEvidenceData } from './GroundedEvidenceModal';
import { formatProviderModelAttribution } from '../utils/aiAttribution';
import { calculateRetrievalMetrics } from '../utils/retrievalMetrics';

export interface AiEvaluationData {
  id: string;
  opportunityId: string;
  version: number;
  status: 'GENERATED' | 'APPROVED' | 'REJECTED';
  alignmentScore: number;
  eligibility: 'LIKELY_ELIGIBLE' | 'POSSIBLY_ELIGIBLE' | 'UNLIKELY_ELIGIBLE' | 'INSUFFICIENT_INFORMATION';
  summary: string;
  strengths: Array<{ text: string; evidenceRefs: string[] }>;
  risks: Array<{ text: string; evidenceRefs: string[] }>;
  requirements: Array<{ requirement: string; status: 'MET' | 'NOT_MET' | 'UNKNOWN'; evidenceRefs: string[] }>;
  recommendedNextAction: string;
  confidence: number;
  limitations: string[];
  evidenceSnapshot: Array<{ id: string; category: string; label: string; value: string }>;
  inputSnapshot: any;
  provider?: string;
  model?: string;
  promptVersion: string;
  createdAt: string;
  reviewedByUserId?: string | null;
  reviewedByUser?: { displayName: string; email: string; role: string } | null;
  reviewedAt?: string | null;
  reviewReason?: string | null;
}

interface AiEvaluationPanelProps {
  evaluations: AiEvaluationData[];
  currentUser: any;
  isAiConfigured: boolean;
  isGroundingEnabled?: boolean;
  onGenerateAiAnalysis: () => Promise<void>;
  onGenerateGroundedAiAnalysis?: () => Promise<void>;
  onReviewAiAnalysis: (evaluationId: string, decision: 'APPROVED' | 'REJECTED', reason: string) => Promise<void>;
  onFetchRetrievedEvidence?: (evaluationId: string) => Promise<RetrievedEvidenceData>;
  generating: boolean;
  error: string | null;
  onSelectPage?: (pageNumber: number) => void;
}

export const AiEvaluationPanel: React.FC<AiEvaluationPanelProps> = ({
  evaluations,
  currentUser,
  isAiConfigured,
  isGroundingEnabled = false,
  onGenerateAiAnalysis,
  onGenerateGroundedAiAnalysis,
  onReviewAiAnalysis,
  onFetchRetrievedEvidence,
  generating,
  error,
  onSelectPage,
}) => {
  const [selectedVersionIndex, setSelectedVersionIndex] = useState<number>(0);
  const [reviewReason, setReviewReason] = useState<string>('');
  const [reviewSubmitting, setReviewSubmitting] = useState<boolean>(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [showEvidenceMap, setShowEvidenceMap] = useState<boolean>(false);

  // Evidence Modal State
  const [isEvidenceModalOpen, setIsEvidenceModalOpen] = useState<boolean>(false);
  const [retrievedEvidenceData, setRetrievedEvidenceData] = useState<RetrievedEvidenceData | null>(null);
  const [loadingEvidence, setLoadingEvidence] = useState<boolean>(false);
  const [evidenceError, setEvidenceError] = useState<string | null>(null);

  const currentEval = evaluations[selectedVersionIndex] || null;
  const isViewer = currentUser?.role === 'VIEWER';

  const attribution = formatProviderModelAttribution(currentEval?.provider, currentEval?.model);
  const metrics = calculateRetrievalMetrics(retrievedEvidenceData?.evidenceItems);

  const handleReviewSubmit = async (decision: 'APPROVED' | 'REJECTED') => {
    if (!currentEval) return;
    if (!reviewReason || reviewReason.trim().length < 5) {
      setReviewError('Please enter a detailed review reason (minimum 5 characters).');
      return;
    }

    setReviewSubmitting(true);
    setReviewError(null);
    try {
      await onReviewAiAnalysis(currentEval.id, decision, reviewReason.trim());
      setReviewReason('');
    } catch (err: any) {
      setReviewError(err.message || 'Failed to submit AI evaluation review');
    } finally {
      setReviewSubmitting(false);
    }
  };

  const getEligibilityBadgeStyle = (rating: string) => {
    switch (rating) {
      case 'LIKELY_ELIGIBLE':
        return { background: '#15803d', color: '#bbf7d0', border: '1px solid #22c55e' };
      case 'POSSIBLY_ELIGIBLE':
        return { background: '#854d0e', color: '#fef08a', border: '1px solid #eab308' };
      case 'UNLIKELY_ELIGIBLE':
        return { background: '#9f1239', color: '#fecdd3', border: '1px solid #f43f5e' };
      default:
        return { background: '#334155', color: '#cbd5e1', border: '1px solid #64748b' };
    }
  };

  const handleViewRetrievedEvidence = async () => {
    if (!currentEval || !onFetchRetrievedEvidence) return;
    setIsEvidenceModalOpen(true);
    setLoadingEvidence(true);
    setEvidenceError(null);
    try {
      const data = await onFetchRetrievedEvidence(currentEval.id);
      setRetrievedEvidenceData(data);
    } catch (err: any) {
      setEvidenceError(err.message || 'Failed to load retrieved evidence');
    } finally {
      setLoadingEvidence(false);
    }
  };

  const isGroundedEval = currentEval?.promptVersion === 'funding-analyst-document-grounded-v1';

  return (
    <div className="card" style={{ marginTop: '1.5rem', background: 'rgba(15, 23, 42, 0.75)', border: '1px solid var(--border-color)', borderRadius: '0.75rem', padding: '1.25rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <span style={{ background: isGroundedEval ? '#0284c7' : '#4338ca', color: '#e0e7ff', fontWeight: 800, fontSize: '0.75rem', padding: '0.2rem 0.5rem', borderRadius: '0.25rem', letterSpacing: '0.05em' }}>
              {isGroundedEval ? 'AI-2B DOCUMENT-GROUNDED ANALYST' : 'AI-1 STRUCTURED ANALYST'}
            </span>
            <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
              Provider: <strong style={{ color: '#e2e8f0' }}>{attribution.provider}</strong> | Model: <strong style={{ color: '#e2e8f0' }}>{attribution.model}</strong> (Prompt: {currentEval?.promptVersion || 'funding-analyst-v1'})
            </span>
          </div>
          <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#f8fafc', marginTop: '0.35rem' }}>
            {isGroundedEval ? '📜 Document-Grounded Opportunity Evaluation' : '🤖 AI Opportunity Evaluation'}
          </h3>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          {evaluations.length > 1 && (
            <select
              value={selectedVersionIndex}
              onChange={(e) => setSelectedVersionIndex(Number(e.target.value))}
              style={{ background: '#1e293b', color: '#f8fafc', border: '1px solid var(--border-color)', padding: '0.4rem 0.6rem', borderRadius: '0.375rem', fontSize: '0.8rem' }}
            >
              {evaluations.map((ev, idx) => (
                <option key={ev.id} value={idx}>
                  v{ev.version} ({ev.promptVersion.includes('grounded') ? 'Grounded' : 'Standard'}) — {new Date(ev.createdAt).toLocaleDateString()}
                </option>
              ))}
            </select>
          )}

          {/* Standard AI-1 Profile Analysis Action */}
          <button
            onClick={onGenerateAiAnalysis}
            disabled={generating || isViewer || !isAiConfigured}
            title={!isAiConfigured ? 'AI Funding Analyst is disabled or not configured on server' : isViewer ? 'VIEWER role cannot generate AI evaluations' : 'Generate standard AI profile evaluation'}
            style={{
              background: generating ? '#475569' : !isAiConfigured || isViewer ? 'rgba(255,255,255,0.05)' : 'linear-gradient(135deg, #4f46e5 0%, #4338ca 100%)',
              color: !isAiConfigured || isViewer ? '#64748b' : '#ffffff',
              border: '1px solid rgba(255,255,255,0.1)',
              padding: '0.5rem 1rem',
              borderRadius: '0.375rem',
              fontWeight: 700,
              fontSize: '0.85rem',
              cursor: generating || isViewer || !isAiConfigured ? 'not-allowed' : 'pointer',
              boxShadow: isAiConfigured && !isViewer ? '0 4px 12px rgba(79, 70, 229, 0.3)' : 'none',
            }}
          >
            {generating ? '⏳ Analyzing...' : '✨ Analyze with AI'}
          </button>

          {/* AI-2B Document Grounded Analysis Action */}
          {onGenerateGroundedAiAnalysis && (
            <button
              onClick={onGenerateGroundedAiAnalysis}
              disabled={generating || isViewer || !isGroundingEnabled}
              title={!isGroundingEnabled ? 'AI Document Grounding is disabled (AI_DOCUMENT_GROUNDING_ENABLED=false)' : isViewer ? 'VIEWER role cannot generate AI evaluations' : 'Generate document-grounded AI evaluation using semantic retrieval'}
              style={{
                background: generating ? '#475569' : !isGroundingEnabled || isViewer ? 'rgba(255,255,255,0.05)' : 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                color: !isGroundingEnabled || isViewer ? '#64748b' : '#ffffff',
                border: '1px solid rgba(255,255,255,0.1)',
                padding: '0.5rem 1rem',
                borderRadius: '0.375rem',
                fontWeight: 700,
                fontSize: '0.85rem',
                cursor: generating || isViewer || !isGroundingEnabled ? 'not-allowed' : 'pointer',
                boxShadow: isGroundingEnabled && !isViewer ? '0 4px 12px rgba(2, 132, 199, 0.3)' : 'none',
              }}
            >
              {generating ? '⏳ Grounding Evidence...' : '📜 Analyze with Official Notice'}
            </button>
          )}
        </div>
      </div>

      {error && (
        <div style={{ padding: '0.75rem', marginBottom: '1rem', background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '0.375rem', color: '#fca5a5', fontSize: '0.85rem' }}>
          ❌ <strong>AI Analysis Error:</strong> {error}
        </div>
      )}

      {!currentEval && !generating && (
        <div style={{ textAlign: 'center', padding: '2rem', background: 'rgba(30, 41, 59, 0.4)', borderRadius: '0.5rem', border: '1px border-dashed rgba(255,255,255,0.1)' }}>
          <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>
            No AI Evaluation generated for this opportunity yet. Click <strong>Analyze with AI</strong> or <strong>Analyze with Official Notice</strong> above.
          </p>
          {!isAiConfigured && (
            <p style={{ color: '#f87171', fontSize: '0.8rem', marginTop: '0.5rem' }}>
              ⚠️ AI Funding Analyst service is disabled or server OPENAI_API_KEY is unconfigured.
            </p>
          )}
          {!isGroundingEnabled && (
            <p style={{ color: '#fbbf24', fontSize: '0.8rem', marginTop: '0.35rem' }}>
              ℹ️ Document-grounded semantic retrieval is currently disabled (AI_DOCUMENT_GROUNDING_ENABLED=false).
            </p>
          )}
        </div>
      )}

      {currentEval && (
        <div>
          {/* Header Banner & Disclaimer */}
          <div style={{ padding: '0.6rem 0.85rem', background: isGroundedEval ? 'rgba(2, 132, 199, 0.15)' : 'rgba(234, 179, 8, 0.12)', border: isGroundedEval ? '1px solid #0284c7' : '1px solid rgba(234, 179, 8, 0.3)', borderRadius: '0.375rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
            <span style={{ fontWeight: 800, fontSize: '0.75rem', color: isGroundedEval ? '#7dd3fc' : '#fef08a', letterSpacing: '0.04em' }}>
              {isGroundedEval ? `DOCUMENT-GROUNDED AI — HUMAN REVIEW REQUIRED (v${currentEval.version})` : `AI-GENERATED — HUMAN REVIEW REQUIRED (v${currentEval.version})`}
            </span>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              {isGroundedEval && onFetchRetrievedEvidence && (
                <button
                  onClick={handleViewRetrievedEvidence}
                  style={{
                    background: '#0284c7',
                    color: '#ffffff',
                    border: 'none',
                    padding: '0.25rem 0.6rem',
                    borderRadius: '0.25rem',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  📜 View Retrieved Evidence {retrievedEvidenceData?.evidenceItems ? `(${metrics.displayText})` : '(Ready)'}
                </button>
              )}

              <span style={{ fontSize: '0.75rem', color: '#cbd5e1' }}>
                Model confidence: <strong>{Math.round(currentEval.confidence * 100)}%</strong>
              </span>
            </div>
          </div>

          <p style={{ fontSize: '0.75rem', color: '#94a3b8', fontStyle: 'italic', marginBottom: '1rem', lineHeight: 1.4 }}>
            {isGroundedEval
              ? 'Document-grounded AI decision support. Semantic retrieval identifies potentially relevant evidence but does not prove legal eligibility. Verify every citation against the official notice before acting. Human review does not authorize submission.'
              : 'AI-generated decision support. Verify all eligibility requirements against the official funding notice before acting. Approval confirms human review of this analysis; it does not establish legal eligibility or authorize submission.'}
          </p>

          {/* Scores and Ratings */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem', marginBottom: '1.25rem' }}>
            <div style={{ background: '#1e293b', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid var(--border-color)' }}>
              <span style={{ fontSize: '0.7rem', color: '#94a3b8', display: 'block', fontWeight: 600 }}>ALIGNMENT SCORE</span>
              <span style={{ fontSize: '1.5rem', fontWeight: 800, color: '#38bdf8' }}>{currentEval.alignmentScore} / 100</span>
            </div>

            <div style={{ background: '#1e293b', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid var(--border-color)' }}>
              <span style={{ fontSize: '0.7rem', color: '#94a3b8', display: 'block', fontWeight: 600, marginBottom: '0.25rem' }}>ELIGIBILITY RATING</span>
              <span style={{ fontSize: '0.8rem', fontWeight: 700, padding: '0.2rem 0.5rem', borderRadius: '0.25rem', ...getEligibilityBadgeStyle(currentEval.eligibility) }}>
                {currentEval.eligibility}
              </span>
            </div>

            <div style={{ background: '#1e293b', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid var(--border-color)' }}>
              <span style={{ fontSize: '0.7rem', color: '#94a3b8', display: 'block', fontWeight: 600, marginBottom: '0.25rem' }}>HUMAN REVIEW STATUS</span>
              <span style={{ fontSize: '0.8rem', fontWeight: 700, padding: '0.2rem 0.5rem', borderRadius: '0.25rem', background: currentEval.status === 'APPROVED' ? '#166534' : currentEval.status === 'REJECTED' ? '#991b1b' : '#854d0e', color: '#fff' }}>
                {currentEval.status === 'GENERATED' ? 'PENDING HUMAN REVIEW' : currentEval.status}
              </span>
            </div>
          </div>

          {/* Executive Summary */}
          <div style={{ marginBottom: '1.25rem' }}>
            <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#f8fafc', marginBottom: '0.35rem' }}>Summary & Key Finding</h4>
            <p style={{ fontSize: '0.875rem', color: '#cbd5e1', lineHeight: 1.5, background: 'rgba(30, 41, 59, 0.5)', padding: '0.75rem', borderRadius: '0.375rem', border: '1px solid rgba(255,255,255,0.05)' }}>
              {currentEval.summary}
            </p>
          </div>

          {/* Strengths and Risks */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
            <div>
              <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: '#86efac', marginBottom: '0.5rem' }}>✅ Key Strengths</h4>
              <ul style={{ paddingLeft: '1.2rem', margin: 0, fontSize: '0.825rem', color: '#cbd5e1' }}>
                {currentEval.strengths?.map((st, i) => (
                  <li key={i} style={{ marginBottom: '0.4rem' }}>
                    {st.text}
                    {st.evidenceRefs?.length > 0 && (
                      <span style={{ display: 'block', fontSize: '0.7rem', color: '#64748b', marginTop: '0.1rem' }}>
                        Citations: {st.evidenceRefs.join(', ')}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: '#fca5a5', marginBottom: '0.5rem' }}>⚠️ Key Risks & Constraints</h4>
              <ul style={{ paddingLeft: '1.2rem', margin: 0, fontSize: '0.825rem', color: '#cbd5e1' }}>
                {currentEval.risks?.map((rk, i) => (
                  <li key={i} style={{ marginBottom: '0.4rem' }}>
                    {rk.text}
                    {rk.evidenceRefs?.length > 0 && (
                      <span style={{ display: 'block', fontSize: '0.7rem', color: '#64748b', marginTop: '0.1rem' }}>
                        Citations: {rk.evidenceRefs.join(', ')}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Requirement-by-Requirement Table */}
          <div style={{ marginBottom: '1.25rem' }}>
            <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: '#f8fafc', marginBottom: '0.5rem' }}>📋 Requirement Verification</h4>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', color: '#cbd5e1' }}>
                <thead>
                  <tr style={{ background: '#1e293b', textAlign: 'left', color: '#94a3b8' }}>
                    <th style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid var(--border-color)' }}>Requirement</th>
                    <th style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid var(--border-color)' }}>Status</th>
                    <th style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid var(--border-color)' }}>Evidence Refs</th>
                  </tr>
                </thead>
                <tbody>
                  {currentEval.requirements?.map((req, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <td style={{ padding: '0.5rem 0.75rem' }}>{req.requirement}</td>
                      <td style={{ padding: '0.5rem 0.75rem' }}>
                        <span style={{
                          fontWeight: 700,
                          fontSize: '0.75rem',
                          padding: '0.15rem 0.4rem',
                          borderRadius: '0.2rem',
                          background: req.status === 'MET' ? '#14532d' : req.status === 'NOT_MET' ? '#7f1d1d' : '#334155',
                          color: req.status === 'MET' ? '#86efac' : req.status === 'NOT_MET' ? '#fca5a5' : '#cbd5e1',
                        }}>
                          {req.status}
                        </span>
                      </td>
                      <td style={{ padding: '0.5rem 0.75rem', color: '#64748b', fontSize: '0.75rem' }}>
                        {req.evidenceRefs?.join(', ') || 'N/A'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Recommended Next Action */}
          <div style={{ marginBottom: '1.25rem', background: '#1e293b', padding: '0.75rem', borderRadius: '0.375rem', borderLeft: '4px solid #38bdf8' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#38bdf8', display: 'block', marginBottom: '0.2rem' }}>RECOMMENDED NEXT ACTION</span>
            <p style={{ fontSize: '0.85rem', color: '#f8fafc', margin: 0 }}>{currentEval.recommendedNextAction}</p>
          </div>

          {/* Limitations */}
          {currentEval.limitations?.length > 0 && (
            <div style={{ marginBottom: '1.25rem' }}>
              <h4 style={{ fontSize: '0.8rem', fontWeight: 700, color: '#94a3b8', marginBottom: '0.35rem' }}>Evaluation Limitations & Assumptions</h4>
              <ul style={{ paddingLeft: '1.2rem', margin: 0, fontSize: '0.75rem', color: '#94a3b8' }}>
                {currentEval.limitations.map((lim, i) => (
                  <li key={i}>{lim}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Resolved Evidence Reference Panel */}
          <div style={{ marginBottom: '1.25rem' }}>
            <button
              onClick={() => setShowEvidenceMap(!showEvidenceMap)}
              style={{ background: 'transparent', border: 'none', color: '#38bdf8', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', textDecoration: 'underline', padding: 0 }}
            >
              {showEvidenceMap ? 'Hide Evidence Source Values ▲' : '🔍 View Evidence Source Values (Citations Map) ▼'}
            </button>

            {showEvidenceMap && (
              <div style={{ marginTop: '0.5rem', background: '#0f172a', padding: '0.75rem', borderRadius: '0.375rem', border: '1px solid var(--border-color)', fontSize: '0.75rem' }}>
                <h5 style={{ color: '#e2e8f0', fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.5rem' }}>Saved Source Evidence Values</h5>
                {Array.isArray(currentEval.evidenceSnapshot) ? (
                  <div style={{ display: 'grid', gap: '0.5rem' }}>
                    {currentEval.evidenceSnapshot.map((item) => (
                      <div key={item.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.3rem' }}>
                        <strong style={{ color: '#93c5fd' }}>{item.id}</strong> <span style={{ color: '#64748b' }}>({item.label})</span>:
                        <div style={{ color: '#cbd5e1', marginTop: '0.1rem', fontFamily: 'monospace', fontSize: '0.7rem', wordBreak: 'break-word' }}>{item.value}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p style={{ color: '#94a3b8' }}>No evidence snapshot available for this version.</p>
                )}
              </div>
            )}
          </div>

          {/* Human Review Section */}
          <div style={{ marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
            <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#f8fafc', marginBottom: '0.5rem' }}>
              👤 Human Review & Decision Attestation
            </h4>

            {currentEval.status !== 'GENERATED' ? (
              <div style={{ background: '#1e293b', padding: '0.75rem', borderRadius: '0.375rem', border: '1px solid var(--border-color)', fontSize: '0.8rem' }}>
                <p style={{ color: '#e2e8f0', margin: 0, fontWeight: 600 }}>
                  Decision: <strong style={{ color: currentEval.status === 'APPROVED' ? '#86efac' : '#fca5a5' }}>{currentEval.status}</strong>
                </p>
                <p style={{ color: '#94a3b8', margin: '0.2rem 0' }}>
                  Reviewed by: <strong>{currentEval.reviewedByUser?.displayName || currentEval.reviewedByUserId || 'Authorized Human'}</strong> on {currentEval.reviewedAt ? new Date(currentEval.reviewedAt).toLocaleString() : 'N/A'}
                </p>
                <p style={{ color: '#cbd5e1', fontStyle: 'italic', margin: '0.4rem 0 0 0' }}>
                  Reason: "{currentEval.reviewReason || 'No reason specified'}"
                </p>
              </div>
            ) : isViewer ? (
              <div style={{ color: '#94a3b8', fontSize: '0.8rem', fontStyle: 'italic' }}>
                VIEWER role is read-only. Reviewing AI evaluations requires OPERATOR or ADMIN privileges.
              </div>
            ) : (
              <div>
                <textarea
                  value={reviewReason}
                  onChange={(e) => setReviewReason(e.target.value)}
                  placeholder="Enter human review reason for approval or rejection (minimum 5 characters)..."
                  rows={3}
                  style={{ width: '100%', background: '#1e293b', border: '1px solid var(--border-color)', color: '#f8fafc', padding: '0.6rem', borderRadius: '0.375rem', fontSize: '0.825rem', marginBottom: '0.5rem' }}
                />

                {reviewError && (
                  <div style={{ color: '#fca5a5', fontSize: '0.75rem', marginBottom: '0.5rem' }}>
                    {reviewError}
                  </div>
                )}

                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <button
                    onClick={() => handleReviewSubmit('APPROVED')}
                    disabled={reviewSubmitting}
                    style={{
                      background: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)',
                      color: '#fff',
                      border: 'none',
                      padding: '0.45rem 1rem',
                      borderRadius: '0.35rem',
                      fontWeight: 700,
                      fontSize: '0.8rem',
                      cursor: reviewSubmitting ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {reviewSubmitting ? 'Submitting...' : '✓ Approve AI Evaluation'}
                  </button>

                  <button
                    onClick={() => handleReviewSubmit('REJECTED')}
                    disabled={reviewSubmitting}
                    style={{
                      background: 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)',
                      color: '#fff',
                      border: 'none',
                      padding: '0.45rem 1rem',
                      borderRadius: '0.35rem',
                      fontWeight: 700,
                      fontSize: '0.8rem',
                      cursor: reviewSubmitting ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {reviewSubmitting ? 'Submitting...' : '✕ Reject AI Evaluation'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Retrieved Semantic Evidence Drawer / Modal */}
      <GroundedEvidenceModal
        isOpen={isEvidenceModalOpen}
        onClose={() => setIsEvidenceModalOpen(false)}
        evidenceData={retrievedEvidenceData}
        loading={loadingEvidence}
        error={evidenceError}
        onSelectPage={onSelectPage}
      />
    </div>
  );
};
