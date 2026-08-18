import React from 'react';

export interface MatchImpactItem {
  opportunityId: string;
  title: string;
  fundingOpportunityNumber: string;
  isDemo: boolean;
  previousFormationStatus: string;
  updatedFormationStatus: string;
  previousEligibilityClassification: string;
  previewEligibilityClassification: string;
  previousScore: number;
  previewScore: number;
  changedBlockingReasons: string[];
  remainingBlockingReasons: string[];
  recommendedPathway: string;
}

interface MatchImpactPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: MatchImpactItem[];
  loading: boolean;
  error: string | null;
}

export const MatchImpactPreviewModal: React.FC<MatchImpactPreviewModalProps> = ({
  isOpen,
  onClose,
  items,
  loading,
  error,
}) => {
  if (!isOpen) return null;

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
        zIndex: 1200,
        padding: '1rem',
      }}
    >
      <div
        style={{
          background: '#0f172a',
          border: '1px solid #38bdf8',
          borderRadius: '0.75rem',
          maxWidth: '900px',
          width: '100%',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          padding: '1.5rem',
          boxShadow: '0 20px 25px -5px rgba(0,0,0,0.5)',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '1rem',
            borderBottom: '1px solid var(--border-color)',
            paddingBottom: '0.75rem',
          }}
        >
          <div>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#f8fafc', margin: 0 }}>
              📊 14-Opportunity Match Impact Preview (Post-Incorporation)
            </h3>
            <p style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '0.25rem' }}>
              Read-only preview evaluating how verified California incorporation affects candidate routing and eligibility blockers across all 14 opportunities.
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              color: '#94a3b8',
              border: 'none',
              fontSize: '1.25rem',
              cursor: 'pointer',
            }}
          >
            ✕
          </button>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: '#93c5fd' }}>
            Calculating match impact preview...
          </div>
        ) : error ? (
          <div
            style={{
              padding: '1rem',
              background: 'rgba(239,68,68,0.15)',
              border: '1px solid #ef4444',
              borderRadius: '0.5rem',
              color: '#fca5a5',
            }}
          >
            ⚠️ {error}
          </div>
        ) : (
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            <div
              style={{
                padding: '0.75rem 1rem',
                background: 'rgba(30, 41, 59, 0.7)',
                border: '1px solid rgba(56, 189, 248, 0.25)',
                borderRadius: '0.5rem',
                fontSize: '0.82rem',
                color: '#cbd5e1',
                lineHeight: 1.4,
              }}
            >
              ℹ️ <strong>Impact Assessment Summary:</strong> Incorporating Project Thriveward resolves the general legal-entity blocker. However, opportunities requiring 501(c)(3) status, SAM.gov/UEI registration, or multi-year operating history remain blocked or conditional. Street Outreach Program legal-entity blocker is resolved, but submission remains restricted to fiscal sponsor pathways.
            </div>

            {items.map((item) => {
              const isStreetOutreach = item.fundingOpportunityNumber.includes('HHS-2026-ACF-ACYF-YO-0044') || item.title.toLowerCase().includes('street outreach');
              return (
                <div
                  key={item.opportunityId}
                  style={{
                    background: isStreetOutreach ? 'rgba(15, 23, 42, 0.9)' : 'rgba(30, 41, 59, 0.5)',
                    border: isStreetOutreach ? '1px solid #38bdf8' : '1px solid var(--border-color)',
                    borderRadius: '0.5rem',
                    padding: '0.85rem 1rem',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                        <span style={{ background: item.isDemo ? '#334155' : '#0284c7', color: item.isDemo ? '#cbd5e1' : '#e0f2fe', fontSize: '0.7rem', fontWeight: 700, padding: '0.15rem 0.4rem', borderRadius: '0.2rem' }}>
                          {item.isDemo ? 'DEMO FIXTURE' : 'OFFICIAL NOTICE'}
                        </span>
                        <h4 style={{ fontSize: '0.925rem', fontWeight: 700, color: '#f8fafc', margin: 0 }}>
                          {item.title}
                        </h4>
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.2rem' }}>
                        NOFO ID: <code>{item.fundingOpportunityNumber}</code>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                        Score: <strong>{item.previousScore}%</strong> → <strong style={{ color: '#34d399' }}>{item.previewScore}%</strong>
                      </span>
                      <span style={{ background: '#1e293b', color: '#38bdf8', fontSize: '0.75rem', fontWeight: 700, padding: '0.2rem 0.5rem', borderRadius: '0.25rem', border: '1px solid rgba(56, 189, 248, 0.3)' }}>
                        {item.recommendedPathway}
                      </span>
                    </div>
                  </div>

                  <div style={{ marginTop: '0.65rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '0.65rem', fontSize: '0.78rem' }}>
                    <div style={{ background: 'rgba(34, 197, 94, 0.1)', border: '1px solid rgba(34, 197, 94, 0.25)', borderRadius: '0.375rem', padding: '0.5rem' }}>
                      <div style={{ color: '#86efac', fontWeight: 700, marginBottom: '0.2rem' }}>✓ Changed / Resolved Blockers ({item.changedBlockingReasons.length})</div>
                      {item.changedBlockingReasons.length === 0 ? (
                        <div style={{ color: '#94a3b8', fontStyle: 'italic' }}>None</div>
                      ) : (
                        item.changedBlockingReasons.map((r, i) => (
                          <div key={i} style={{ color: '#dcfce7' }}>• {r}</div>
                        ))
                      )}
                    </div>

                    <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.25)', borderRadius: '0.375rem', padding: '0.5rem' }}>
                      <div style={{ color: '#fca5a5', fontWeight: 700, marginBottom: '0.2rem' }}>🔒 Remaining Blockers ({item.remainingBlockingReasons.length})</div>
                      {item.remainingBlockingReasons.length === 0 ? (
                        <div style={{ color: '#86efac' }}>Zero remaining blockers</div>
                      ) : (
                        item.remainingBlockingReasons.map((r, i) => (
                          <div key={i} style={{ color: '#fecdd3' }}>• {r}</div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
