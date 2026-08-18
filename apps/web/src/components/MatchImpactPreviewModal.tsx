import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';

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
  // Lock background page scrolling and listen for Escape key
  useEffect(() => {
    if (!isOpen) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const officialNotices = items.filter((item) => !item.isDemo);
  const demoFixtures = items.filter((item) => item.isDemo);

  const renderCandidateCard = (item: MatchImpactItem) => {
    const isStreetOutreach =
      item.fundingOpportunityNumber.includes('HHS-2026-ACF-ACYF-YO-0044') ||
      item.title.toLowerCase().includes('street outreach');

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
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            flexWrap: 'wrap',
            gap: '0.5rem',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
              <span
                style={{
                  background: item.isDemo ? '#334155' : '#0284c7',
                  color: item.isDemo ? '#cbd5e1' : '#e0f2fe',
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  padding: '0.15rem 0.4rem',
                  borderRadius: '0.2rem',
                }}
              >
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
              Score: <strong>{item.previousScore}%</strong> →{' '}
              <strong style={{ color: '#34d399' }}>{item.previewScore}%</strong>
            </span>
            <span
              style={{
                background: '#1e293b',
                color: '#38bdf8',
                fontSize: '0.75rem',
                fontWeight: 700,
                padding: '0.2rem 0.5rem',
                borderRadius: '0.25rem',
                border: '1px solid rgba(56, 189, 248, 0.3)',
              }}
            >
              {item.recommendedPathway}
            </span>
          </div>
        </div>

        <div
          style={{
            marginTop: '0.65rem',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '0.75rem',
            fontSize: '0.78rem',
          }}
        >
          <div
            style={{
              background: 'rgba(34, 197, 94, 0.1)',
              border: '1px solid rgba(34, 197, 94, 0.25)',
              borderRadius: '0.375rem',
              padding: '0.5rem 0.75rem',
            }}
          >
            <div style={{ color: '#86efac', fontWeight: 700, marginBottom: '0.2rem' }}>
              ✓ Changed / Resolved Blockers ({item.changedBlockingReasons.length})
            </div>
            {item.changedBlockingReasons.length === 0 ? (
              <div style={{ color: '#94a3b8', fontStyle: 'italic' }}>None</div>
            ) : (
              item.changedBlockingReasons.map((r, i) => (
                <div key={i} style={{ color: '#dcfce7' }}>
                  • {r}
                </div>
              ))
            )}
          </div>

          <div
            style={{
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.25)',
              borderRadius: '0.375rem',
              padding: '0.5rem 0.75rem',
            }}
          >
            <div style={{ color: '#fca5a5', fontWeight: 700, marginBottom: '0.2rem' }}>
              🔒 Remaining Blockers ({item.remainingBlockingReasons.length})
            </div>
            {item.remainingBlockingReasons.length === 0 ? (
              <div style={{ color: '#86efac' }}>Zero remaining blockers</div>
            ) : (
              item.remainingBlockingReasons.map((r, i) => (
                <div key={i} style={{ color: '#fecdd3' }}>
                  • {r}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    );
  };

  const modalContent = (
    <div
      className="modal-backdrop"
      onClick={onClose}
      data-testid="match-impact-backdrop"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: '100vw',
        height: '100vh',
        backgroundColor: 'rgba(15, 23, 42, 0.85)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 99999,
        pointerEvents: 'auto',
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="match-impact-title"
        data-testid="match-impact-dialog"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#0f172a',
          border: '1px solid #38bdf8',
          borderRadius: '0.75rem',
          width: 'min(1100px, calc(100vw - 32px))',
          maxHeight: 'calc(100dvh - 32px)',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        {/* Sticky Header */}
        <div
          style={{
            position: 'sticky',
            top: 0,
            zIndex: 10,
            background: '#0f172a',
            borderBottom: '1px solid var(--border-color)',
            padding: '1.25rem 1.5rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: '1rem',
          }}
        >
          <div>
            <h3
              id="match-impact-title"
              style={{ fontSize: '1.15rem', fontWeight: 800, color: '#f8fafc', margin: 0 }}
            >
              📊 Match Impact Preview (14 Stored Candidates)
            </h3>
            <p style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '0.25rem', margin: 0 }}>
              Read-only preview evaluating how verified California incorporation affects candidate routing across 11 official notices and 3 demo fixtures.
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close modal"
            data-testid="match-impact-close-button"
            style={{
              background: 'transparent',
              color: '#94a3b8',
              border: 'none',
              fontSize: '1.4rem',
              fontWeight: 700,
              cursor: 'pointer',
              padding: '0.2rem 0.5rem',
              borderRadius: '0.25rem',
              lineHeight: 1,
            }}
          >
            ✕
          </button>
        </div>

        {/* Scrollable Modal Content */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '1.25rem 1.5rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.25rem',
          }}
        >
          {loading ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: '#93c5fd' }}>
              Calculating match impact preview...
            </div>
          ) : error ? (
            <div
              style={{
                padding: '1rem',
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid #ef4444',
                borderRadius: '0.5rem',
                color: '#fca5a5',
              }}
            >
              ⚠️ {error}
            </div>
          ) : (
            <>
              <div
                style={{
                  padding: '0.85rem 1.1rem',
                  background: 'rgba(30, 41, 59, 0.7)',
                  border: '1px solid rgba(56, 189, 248, 0.25)',
                  borderRadius: '0.5rem',
                  fontSize: '0.82rem',
                  color: '#cbd5e1',
                  lineHeight: 1.5,
                }}
              >
                ℹ️ <strong>Impact Assessment Summary:</strong> Comparison evaluates 11 official notice candidates and 3 demo test fixtures. Incorporating Project Thriveward resolves the general legal-entity status blocker. However, opportunities requiring 501(c)(3) status, SAM.gov/UEI registration, or multi-year operating history remain blocked or conditional. Street Outreach Program (<code>HHS-2026-ACF-ACYF-YO-0044</code>) match score updates to <strong style={{ color: '#34d399' }}>40% — FISCAL_SPONSOR_REQUIRED</strong> (legal entity status blocker resolved, fiscal sponsor requirement enforced).
              </div>

              {/* 1. Official Notice Candidates Section */}
              <div>
                <h4 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#38bdf8', marginBottom: '0.75rem' }}>
                  📜 Official Notice Candidates ({officialNotices.length})
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                  {officialNotices.map((item) => renderCandidateCard(item))}
                </div>
              </div>

              {/* 2. Demo & Test Fixtures Section */}
              {demoFixtures.length > 0 && (
                <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                    <h4 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#cbd5e1', margin: 0 }}>
                      🧪 Demo & Test Fixtures ({demoFixtures.length})
                    </h4>
                    <span style={{ background: '#334155', color: '#cbd5e1', fontSize: '0.7rem', fontWeight: 700, padding: '0.15rem 0.4rem', borderRadius: '0.2rem' }}>
                      EXCLUDED FROM LIVE OPPORTUNITY FEED
                    </span>
                  </div>
                  <p style={{ fontSize: '0.78rem', color: '#94a3b8', marginBottom: '0.75rem' }}>
                    Demo fixtures are used exclusively for system testing and baseline demonstration purposes. They are strictly excluded from the active live opportunity feed.
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                    {demoFixtures.map((item) => renderCandidateCard(item))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};
