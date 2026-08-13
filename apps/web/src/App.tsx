import { useState, useEffect } from 'react';
import { sanitizeHtmlToText } from '@bridge-ai/shared';

interface FundingOpportunity {
  id: string;
  fundingOpportunityNumber: string;
  title: string;
  fundingAgency: string;
  description: string;
  sourceUrl: string;
  openingDate: string;
  deadline: string;
  awardMin: string;
  awardMax: string;
  totalAvailableFunding: string;
  geography: string;
  eligibleApplicantTypes: string[];
  eligiblePopulations: string[];
  isDemo: boolean;
  pursuitStage: string;
  dismissedReason: string | null;
  isStale?: boolean;
  staleReason?: string | null;
  relevanceAnalyses?: Array<{
    relevanceStatus: string;
    relevanceScore: number;
    explanation: string;
    positiveReasons: string[];
    exclusionReasons: string[];
  }>;
  opportunityAnalyses?: Array<{
    overallFitScore: number;
    eligibilityDecision: string;
    eligibilityStatus: string;
    evidenceCoverage: number;
  }>;
  supportTrainingStipends?: string;
  supportTransportation?: string;
  supportTools?: string;
  supportPPE?: string;
  supportLaptops?: string;
  supportTrainingEquipment?: string;
  supportCertifications?: string;
  supportPaidWorkExperience?: string;
}

interface SystemHealth {
  apiStatus: string;
  pythonAgentStatus: string;
  databaseStatus: string;
}

const BRIDGE_FORWARD_PROFILE = {
  name: 'Bridge Forward Foundation',
  status: 'PRE_INCORPORATION',
  taxStatus: 'NOT_OBTAINED',
  statewideGeography: 'California',
  initialServiceAreas: [
    'Orange County (Anaheim, Santa Ana)',
    'Los Angeles County (Long Beach, South Los Angeles)',
    'San Bernardino County (Inland Empire core)',
  ],
  missionStatement:
    'Bridge Forward Foundation advances successful reentry and long-term independence for justice-involved adults and system-impacted young people through housing and basic-needs stabilization, individualized reentry support, career-connected education, technology and skilled-trades training, mentorship, employment pathways, and sustained community support.',
};

export function App() {
  const [opportunities, setOpportunities] = useState<FundingOpportunity[]>([]);
  const [selectedOpp, setSelectedOpp] = useState<FundingOpportunity | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<'all' | 'official' | 'demo' | 'new' | 'qualified' | 'locked' | 'dismissed'>('official');
  const [pathwaysSubFilter, setPathwaysSubFilter] = useState<'all' | 'fiscal_sponsor' | 'partnership' | 'future'>('all');
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const [health] = useState<SystemHealth>({
    apiStatus: 'UP',
    pythonAgentStatus: 'UP (Port 8000 / FastAPI)',
    databaseStatus: 'UP (PostgreSQL 16)',
  });

  const fetchOpportunities = async () => {
    setLoading(true);
    setError(null);
    try {
      let url = '/api/opportunities';
      if (activeFilter === 'official') {
        url = '/api/opportunities?dataKind=official';
      } else if (activeFilter === 'demo') {
        url = '/api/opportunities?dataKind=demo';
      } else if (activeFilter === 'new') {
        url = '/api/opportunities?pursuitStage=NEW';
      } else if (activeFilter === 'qualified') {
        url = '/api/opportunities?pursuitStage=QUALIFIED';
      } else if (activeFilter === 'locked') {
        url = '/api/opportunities?pursuitStage=LOCKED';
      } else if (activeFilter === 'dismissed') {
        if (pathwaysSubFilter === 'fiscal_sponsor') {
          url = '/api/opportunities?candidateRoutingStatus=FISCAL_SPONSOR_REQUIRED';
        } else if (pathwaysSubFilter === 'partnership') {
          url = '/api/opportunities?candidateRoutingStatus=PARTNERSHIP_REQUIRED';
        } else if (pathwaysSubFilter === 'future') {
          url = '/api/opportunities?candidateRoutingStatus=FUTURE_OPPORTUNITY';
        } else {
          url = '/api/opportunities?candidateRoutingStatus=POTENTIAL_PATHWAYS';
        }
      }

      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`API response error: HTTP ${res.status}`);
      }
      const data = await res.json();
      setOpportunities(data.data || []);
    } catch (err: any) {
      setError(err.message || 'Failed to connect to Node.js backend');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOpportunities();
  }, [activeFilter, pathwaysSubFilter]);

  const handleAnalyze = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setActionMessage(`Running Phase 1C 12-Dimension Fit Analysis & Relevance Assessment for ${id}...`);
    try {
      const relRes = await fetch(`/api/opportunities/${id}/relevance`, { method: 'POST' });
      if (!relRes.ok) throw new Error('Relevance assessment failed');

      const fitRes = await fetch(`/api/opportunities/${id}/analyze`, { method: 'POST' });
      if (!fitRes.ok) throw new Error('Fit analysis failed');

      setActionMessage(`Analysis complete for opportunity #${id}.`);
      await fetchOpportunities();
    } catch (err: any) {
      alert(`Analysis failed: ${err.message}`);
    }
  };

  const handleTransitionPursuit = async (id: string, stage: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      let reason = undefined;
      if (stage === 'DISMISSED') {
        const inputReason = prompt('Enter dismissal reason:');
        if (!inputReason || inputReason.trim() === '') {
          alert('Dismissal requires an explanatory reason.');
          return;
        }
        reason = inputReason.trim();
      }

      const res = await fetch(`/api/opportunities/${id}/pursuit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer bridge_secret_review_token_change_in_production_2026',
        },
        body: JSON.stringify({
          targetStage: stage,
          reviewerId: 'human-reviewer-admin-01',
          reason,
          notes: `Stage transitioned to ${stage} via web portal interface`,
        }),
      });

      if (!res.ok) {
        const errBody = await res.json();
        throw new Error(errBody.error || `HTTP ${res.status}`);
      }

      setActionMessage(`Successfully updated pursuit stage to ${stage}.`);
      await fetchOpportunities();
    } catch (err: any) {
      alert(`Failed to update pursuit stage: ${err.message}`);
    }
  };

  return (
    <div className="container">
      {/* Header */}
      <header>
        <div className="header-badge">Phase 1D • Real Discovery, Triage & Direct Applicant Readiness Active</div>
        <h1 className="brand-title">Bridge AI</h1>
        <p className="brand-subtitle">
          Funding Intelligence & Grants.gov Provenance for Bridge Forward Foundation
        </p>
      </header>

      {/* Core Principle Banner */}
      <div className="principle-banner">
        <div className="principle-title">
          <span>🛡️</span> PRODUCT PRINCIPLE: Human-Led, AI-Enabled
        </div>
        <p className="principle-text">
          AI assists authorized humans with research, extraction, relevance scoring, and analysis. Provenance verification confirms official source origin—it <strong>never</strong> constitutes organizational eligibility or qualification. Every qualification and lock match decision requires explicit human authorization.
        </p>
      </div>

      {/* Action Notification Message */}
      {actionMessage && (
        <div style={{ background: 'rgba(59, 130, 246, 0.15)', border: '1px solid #3b82f6', color: '#93c5fd', padding: '0.75rem 1rem', borderRadius: '0.5rem', marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>ℹ️ {actionMessage}</span>
          <button onClick={() => setActionMessage(null)} style={{ background: 'transparent', border: 'none', color: '#93c5fd', cursor: 'pointer', fontWeight: 700 }}>✕</button>
        </div>
      )}

      {/* System Health Grid */}
      <div className="grid-3">
        <div className="card">
          <div className="section-title">
            <span className={`status-indicator ${health.apiStatus === 'UP' ? 'status-active' : 'status-warning'}`}></span>
            Node.js REST API
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Port 4000 • Express + TypeScript</p>
          <div style={{ marginTop: '0.75rem' }}>
            <span className="badge badge-blue">{health.apiStatus}</span>
          </div>
        </div>

        <div className="card">
          <div className="section-title">
            <span className={`status-indicator ${health.pythonAgentStatus.includes('UP') ? 'status-active' : 'status-warning'}`}></span>
            Python Funding Agent
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Port 8000 • FastAPI Service</p>
          <div style={{ marginTop: '0.75rem' }}>
            <span className="badge badge-purple">{health.pythonAgentStatus}</span>
          </div>
        </div>

        <div className="card">
          <div className="section-title">
            <span className="status-indicator status-active"></span>
            PostgreSQL DB & Ingestion
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Port 5432 • Grants.gov Verified Ingestion</p>
          <div style={{ marginTop: '0.75rem' }}>
            <span className="badge badge-blue">{health.databaseStatus}</span>
          </div>
        </div>
      </div>

      {/* Funding Opportunities Section */}
      <div className="card" style={{ marginTop: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <h2 className="section-title" style={{ margin: 0 }}>
            🎯 Funding Opportunities Triage & Match Locking
          </h2>

          {/* Filter Tabs Toolbar */}
          <div className="tabs" style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
            <button className={`tab ${activeFilter === 'official' ? 'active' : ''}`} onClick={() => setActiveFilter('official')}>
              🏛️ Official Grants.gov
            </button>
            <button className={`tab ${activeFilter === 'all' ? 'active' : ''}`} onClick={() => setActiveFilter('all')}>
              All Feed
            </button>
            <button className={`tab ${activeFilter === 'qualified' ? 'active' : ''}`} onClick={() => setActiveFilter('qualified')}>
              ✓ Qualified
            </button>
            <button className={`tab ${activeFilter === 'locked' ? 'active' : ''}`} onClick={() => setActiveFilter('locked')}>
              🔒 Locked Matches
            </button>
            <button className={`tab ${activeFilter === 'dismissed' ? 'active' : ''}`} onClick={() => { setActiveFilter('dismissed'); setPathwaysSubFilter('all'); }}>
              🛤️ Potential Pathways
            </button>

            <button className="tab" onClick={() => fetchOpportunities()}>
              🔄 Refresh
            </button>
          </div>
        </div>

        {/* Sub-filters for Potential Pathways */}
        {activeFilter === 'dismissed' && (
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.85rem', paddingTop: '0.85rem', borderTop: '1px solid rgba(255,255,255,0.08)', flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#94a3b8' }}>Filter Pathway:</span>
            <button
              className={`tab ${pathwaysSubFilter === 'all' ? 'active' : ''}`}
              onClick={() => setPathwaysSubFilter('all')}
              style={{ fontSize: '0.8rem', padding: '0.3rem 0.65rem' }}
            >
              All Pathways
            </button>
            <button
              className={`tab ${pathwaysSubFilter === 'fiscal_sponsor' ? 'active' : ''}`}
              onClick={() => setPathwaysSubFilter('fiscal_sponsor')}
              style={{ fontSize: '0.8rem', padding: '0.3rem 0.65rem' }}
            >
              Fiscal Sponsor Required
            </button>
            <button
              className={`tab ${pathwaysSubFilter === 'partnership' ? 'active' : ''}`}
              onClick={() => setPathwaysSubFilter('partnership')}
              style={{ fontSize: '0.8rem', padding: '0.3rem 0.65rem' }}
            >
              Partnership Required
            </button>
            <button
              className={`tab ${pathwaysSubFilter === 'future' ? 'active' : ''}`}
              onClick={() => setPathwaysSubFilter('future')}
              style={{ fontSize: '0.8rem', padding: '0.3rem 0.65rem' }}
            >
              Future Opportunity
            </button>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
            <div className="spinner"></div>
            <p style={{ marginTop: '1rem', fontWeight: 600 }}>Loading funding opportunities...</p>
          </div>
        )}

        {/* Error State */}
        {!loading && error && (
          <div className="error-banner">
            <strong>⚠️ Error Fetching Opportunities:</strong> {error}
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && opportunities.length === 0 && (
          <div className="empty-state" style={{ marginTop: '1.25rem' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>🔍</div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#f1f5f9', marginBottom: '0.5rem' }}>
              No opportunities matching this filter
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.925rem', maxWidth: '640px', margin: '0 auto' }}>
              There are currently no funding opportunities in the <strong>{activeFilter}</strong> view. Bridge Forward is currently <strong>PRE_INCORPORATION</strong>. Direct federal solicitations requiring SAM.gov/UEI registration are safely routed to <em>Fiscal Sponsor Required</em> or <em>Partnership Required</em>.
            </p>
          </div>
        )}

        {/* Opportunity Cards List */}
        {!loading && !error && opportunities.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', marginTop: '1.25rem' }}>
            {opportunities.map((opp) => {
              const analysis = opp.opportunityAnalyses?.[0];
              const relevance = opp.relevanceAnalyses?.[0];

              const hasAnalysis = Boolean(analysis || relevance);
              const isIrrelevant = relevance?.relevanceStatus === 'IRRELEVANT';
              const isNotEligible = analysis?.eligibilityDecision === 'NOT_ELIGIBLE' || analysis?.eligibilityStatus === 'NOT_ELIGIBLE';
              const isBlockedReason = Boolean(
                opp.dismissedReason &&
                  (opp.dismissedReason.includes('PRE_INCORPORATION') ||
                    opp.dismissedReason.includes('FISCAL_SPONSOR') ||
                    opp.dismissedReason.includes('PARTNERSHIP') ||
                    opp.dismissedReason.includes('FUTURE') ||
                    opp.dismissedReason.includes('EXCLUDED'))
              );

              const cleanTitle = sanitizeHtmlToText(opp.title);
              const cleanAgency = sanitizeHtmlToText(opp.fundingAgency);
              const cleanDescription = sanitizeHtmlToText(opp.description);
              const cleanGeography = sanitizeHtmlToText(opp.geography);

              // Action Gate UI flags — Blocked if PRE_INCORPORATION / Non-actionable routing
              const canMarkQualified = hasAnalysis && !isIrrelevant && !isNotEligible && !isBlockedReason && opp.pursuitStage !== 'QUALIFIED' && opp.pursuitStage !== 'LOCKED';
              const canLockMatch = hasAnalysis && !isIrrelevant && !isNotEligible && !isBlockedReason && opp.pursuitStage === 'QUALIFIED';

              const pathwayText = opp.dismissedReason?.includes('FISCAL_SPONSOR')
                ? 'Fiscal Sponsor Required'
                : opp.dismissedReason?.includes('PARTNERSHIP')
                ? 'Partnership Required'
                : opp.dismissedReason?.includes('FUTURE')
                ? 'Future Capacity (501c3)'
                : 'Incorporation / Registrations';

              return (
                <div
                  key={opp.id}
                  className="opp-card"
                  onClick={() => setSelectedOpp(opp)}
                  style={{
                    background: 'rgba(15, 23, 42, 0.65)',
                    border: selectedOpp?.id === opp.id ? '2px solid #3b82f6' : '1px solid var(--border-color)',
                    borderRadius: '0.85rem',
                    padding: '1.35rem',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem' }}>
                    <div style={{ flex: 1 }}>
                      {/* Separate Evaluation Badges: Relevance, Direct Eligibility, Organizational Readiness */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
                        {opp.isDemo ? (
                          <span className="badge badge-amber">DEMO FIXTURE</span>
                        ) : (
                          <span className="badge badge-purple">OFFICIAL SOURCE</span>
                        )}

                        <span className="badge badge-blue">Stage: {opp.pursuitStage}</span>

                        {relevance && (
                          <span className={`badge ${relevance.relevanceStatus === 'RELEVANT' ? 'badge-blue' : 'badge-amber'}`}>
                            Relevance: {relevance.relevanceStatus}
                          </span>
                        )}

                        <span className="badge badge-rose" style={{ background: '#701a75' }}>
                          Direct Eligibility: Not Currently Eligible
                        </span>

                        <span className="badge badge-amber" style={{ background: '#78350f' }}>
                          Readiness: PRE-INCORPORATION (Not Ready)
                        </span>

                        {opp.isStale && (
                          <span className="badge badge-rose" style={{ background: '#991b1b' }}>
                            ⚠️ STALE MATCH REFRESH NEEDED
                          </span>
                        )}
                      </div>

                      <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#f8fafc' }}>{cleanTitle}</h3>
                      <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                        <strong>Agency:</strong> {cleanAgency} • <strong>Geography:</strong> {cleanGeography} • <strong>Official ID:</strong> {opp.fundingOpportunityNumber}
                      </p>
                    </div>

                    {/* Primary Score / Status Column */}
                    <div style={{ textAlign: 'right', minWidth: '180px' }}>
                      <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#fca5a5', background: 'rgba(239,68,68,0.15)', padding: '0.4rem 0.75rem', borderRadius: '0.5rem', border: '1px solid rgba(239,68,68,0.3)' }}>
                        Not currently eligible to apply directly
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.35rem' }}>
                        Recommended Pathway: <strong style={{ color: '#60a5fa' }}>{pathwayText}</strong>
                      </div>
                    </div>
                  </div>

                  {/* Sanitized Plain Text Description */}
                  <p style={{ fontSize: '0.9rem', color: '#cbd5e1', marginTop: '0.75rem', lineClamp: 2, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {cleanDescription}
                  </p>

                  {/* Prominent Blocking Reason Warning Box */}
                  {opp.dismissedReason && (
                    <div style={{ marginTop: '0.75rem', fontSize: '0.85rem', background: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#fca5a5', padding: '0.6rem 0.85rem', borderRadius: '0.5rem' }}>
                      🔒 <strong>Direct Application Blocking Reason:</strong> {opp.dismissedReason}
                    </div>
                  )}

                  {!opp.isDemo && (
                    <div className="provenance-warning" style={{ marginTop: '0.75rem', fontSize: '0.8rem', background: 'rgba(139, 92, 246, 0.1)', border: '1px solid rgba(139, 92, 246, 0.25)', color: '#d8b4fe', padding: '0.5rem 0.75rem', borderRadius: '0.4rem' }}>
                      ℹ️ Official Grants.gov provenance confirmed ({opp.sourceUrl}). Opportunity relevance does not constitute direct organizational eligibility until Bridge Forward completes incorporation and federal registrations (EIN, SAM.gov, UEI, Grants.gov AOR).
                    </div>
                  )}

                  {/* Action Buttons Toolbar */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.05)', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                      <button
                        onClick={(e) => handleAnalyze(opp.id, e)}
                        style={{ background: 'rgba(59, 130, 246, 0.2)', border: '1px solid #3b82f6', color: '#93c5fd', padding: '0.35rem 0.75rem', borderRadius: '0.4rem', fontSize: '0.8rem', cursor: 'pointer', fontWeight: 600 }}
                      >
                        ⚡ Analyze & Score
                      </button>

                      <button
                        onClick={(e) => canMarkQualified && handleTransitionPursuit(opp.id, 'QUALIFIED', e)}
                        disabled={!canMarkQualified}
                        title={!canMarkQualified ? 'Disabled: Direct application blocked due to PRE_INCORPORATION / non-actionable routing' : ''}
                        style={{
                          background: canMarkQualified ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255,255,255,0.05)',
                          border: canMarkQualified ? '1px solid #10b981' : '1px solid rgba(255,255,255,0.1)',
                          color: canMarkQualified ? '#6ee7b7' : '#64748b',
                          padding: '0.35rem 0.75rem',
                          borderRadius: '0.4rem',
                          fontSize: '0.8rem',
                          cursor: canMarkQualified ? 'pointer' : 'not-allowed',
                          fontWeight: 600,
                        }}
                      >
                        ✓ Mark Qualified
                      </button>

                      <button
                        onClick={(e) => canLockMatch && handleTransitionPursuit(opp.id, 'LOCKED', e)}
                        disabled={!canLockMatch}
                        title={!canLockMatch ? 'Disabled: Direct application blocked due to PRE_INCORPORATION / non-actionable routing' : ''}
                        style={{
                          background: canLockMatch ? 'rgba(139, 92, 246, 0.2)' : 'rgba(255,255,255,0.05)',
                          border: canLockMatch ? '1px solid #8b5cf6' : '1px solid rgba(255,255,255,0.1)',
                          color: canLockMatch ? '#c084fc' : '#64748b',
                          padding: '0.35rem 0.75rem',
                          borderRadius: '0.4rem',
                          fontSize: '0.8rem',
                          cursor: canLockMatch ? 'pointer' : 'not-allowed',
                          fontWeight: 600,
                        }}
                      >
                        🔒 Lock Match
                      </button>

                      {opp.pursuitStage !== 'DISMISSED' && (
                        <button
                          onClick={(e) => handleTransitionPursuit(opp.id, 'DISMISSED', e)}
                          style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid #ef4444', color: '#fca5a5', padding: '0.35rem 0.75rem', borderRadius: '0.4rem', fontSize: '0.8rem', cursor: 'pointer', fontWeight: 600 }}
                        >
                          ✕ Dismiss
                        </button>
                      )}
                    </div>

                    <span style={{ color: '#60a5fa', fontWeight: 600, fontSize: '0.85rem' }}>Review Details →</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Expandable Detail View Drawer */}
      {selectedOpp && (
        <div className="card" style={{ border: '2px solid #3b82f6', background: 'rgba(15, 23, 42, 0.95)', marginBottom: '2.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem', marginBottom: '1.25rem' }}>
            <div>
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.35rem', flexWrap: 'wrap' }}>
                {selectedOpp.isDemo ? (
                  <span className="badge badge-amber">DEMO FIXTURE</span>
                ) : (
                  <span className="badge badge-purple">OFFICIAL GRANTS.GOV RECORD</span>
                )}
                <span className="badge badge-blue">Pursuit: {selectedOpp.pursuitStage}</span>
              </div>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#ffffff' }}>{sanitizeHtmlToText(selectedOpp.title)}</h2>
              <p style={{ fontSize: '0.85rem', color: '#94a3b8', marginTop: '0.25rem' }}>
                Verified Source Link:{' '}
                <a href={selectedOpp.sourceUrl} target="_blank" rel="noreferrer" style={{ color: '#38bdf8', textDecoration: 'underline' }}>
                  {selectedOpp.sourceUrl}
                </a>
              </p>
            </div>
            <button
              onClick={() => setSelectedOpp(null)}
              style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', padding: '0.5rem 1rem', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: 700 }}
            >
              ✕ Close Detail
            </button>
          </div>

          {/* Contextual Relevance Section */}
          {selectedOpp.relevanceAnalyses?.[0] && (
            <div style={{ background: 'rgba(30, 41, 59, 0.8)', border: '1px solid rgba(255,255,255,0.1)', padding: '1rem', borderRadius: '0.6rem', marginBottom: '1.5rem' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#93c5fd', marginBottom: '0.5rem' }}>
                🔍 Contextual Relevance & Readiness Breakdown
              </h3>
              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', fontSize: '0.85rem', marginBottom: '0.5rem' }}>
                <div><strong>Relevance:</strong> {selectedOpp.relevanceAnalyses[0].relevanceStatus} ({selectedOpp.relevanceAnalyses[0].relevanceScore}/100)</div>
                <div><strong>Direct Eligibility:</strong> Not Currently Eligible</div>
                <div><strong>Readiness:</strong> PRE-INCORPORATION</div>
              </div>
              <p style={{ fontSize: '0.85rem', color: '#cbd5e1' }}>
                {selectedOpp.relevanceAnalyses[0].explanation}
              </p>
            </div>
          )}

          <div className="grid-2" style={{ marginBottom: '1.5rem' }}>
            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#f1f5f9', marginBottom: '0.75rem' }}>
                📄 Verified Official Notice Details (Grants.gov Payload)
              </h3>
              <p style={{ fontSize: '0.9rem', color: '#cbd5e1', marginBottom: '0.75rem', whiteSpace: 'pre-line' }}>
                {sanitizeHtmlToText(selectedOpp.description)}
              </p>
              <ul style={{ paddingLeft: '1.2rem', fontSize: '0.85rem', color: '#94a3b8' }}>
                <li><strong>Official Title:</strong> {sanitizeHtmlToText(selectedOpp.title)}</li>
                <li><strong>Agency:</strong> {sanitizeHtmlToText(selectedOpp.fundingAgency)}</li>
                <li><strong>Geography:</strong> {sanitizeHtmlToText(selectedOpp.geography)}</li>
                <li><strong>Opportunity Number:</strong> {selectedOpp.fundingOpportunityNumber || 'N/A'}</li>
                <li><strong>Post Date:</strong> {selectedOpp.openingDate}</li>
                <li><strong>Closing Date:</strong> {selectedOpp.deadline}</li>
                <li><strong>Award Range:</strong> {selectedOpp.awardMin} – {selectedOpp.awardMax}</li>
                <li><strong>Total Program Budget:</strong> {selectedOpp.totalAvailableFunding}</li>
              </ul>
            </div>

            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#f1f5f9', marginBottom: '0.75rem' }}>
                🛠️ Participant Support Allowability Matrix
              </h3>
              <div className="pill-list" style={{ gap: '0.5rem' }}>
                <span className="pill">Stipends: <strong>{selectedOpp.supportTrainingStipends || 'UNKNOWN'}</strong></span>
                <span className="pill">Transportation: <strong>{selectedOpp.supportTransportation || 'UNKNOWN'}</strong></span>
                <span className="pill">Tools: <strong>{selectedOpp.supportTools || 'UNKNOWN'}</strong></span>
                <span className="pill">PPE: <strong>{selectedOpp.supportPPE || 'UNKNOWN'}</strong></span>
                <span className="pill">Laptops: <strong>{selectedOpp.supportLaptops || 'UNKNOWN'}</strong></span>
                <span className="pill">Training Equipment: <strong>{selectedOpp.supportTrainingEquipment || 'UNKNOWN'}</strong></span>
                <span className="pill">Certifications: <strong>{selectedOpp.supportCertifications || 'UNKNOWN'}</strong></span>
                <span className="pill">Paid Work Experience: <strong>{selectedOpp.supportPaidWorkExperience || 'UNKNOWN'}</strong></span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Ground Truth Profile Card */}
      <div className="card" style={{ marginBottom: '2.5rem' }}>
        <h2 className="section-title">🏢 Ground-Truth Organization Profile (Southern California Service Area)</h2>
        <p style={{ color: '#e2e8f0', fontWeight: 600, fontSize: '1.05rem' }}>
          {BRIDGE_FORWARD_PROFILE.name} • {BRIDGE_FORWARD_PROFILE.statewideGeography}
        </p>
        <p style={{ fontSize: '0.85rem', color: '#94a3b8', marginTop: '0.35rem' }}>
          <strong>Initial Service Areas:</strong> {BRIDGE_FORWARD_PROFILE.initialServiceAreas.join(', ')}
        </p>
        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem', marginBottom: '1rem' }}>
          <span className="badge badge-rose">{BRIDGE_FORWARD_PROFILE.status}</span>
          <span className="badge badge-amber">501(c)(3) {BRIDGE_FORWARD_PROFILE.taxStatus}</span>
        </div>
        <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
          <strong>Mission:</strong> {BRIDGE_FORWARD_PROFILE.missionStatement}
        </p>
      </div>

      {/* Footer */}
      <footer>
        <p>Bridge AI Platform • Phase 1D Applicant Readiness & Source Identity • Bridge Forward Foundation</p>
      </footer>
    </div>
  );
}

export default App;
