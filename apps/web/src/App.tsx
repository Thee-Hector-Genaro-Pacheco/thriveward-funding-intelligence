import { useEffect, useState } from 'react';
import { BRIDGE_FORWARD_PROFILE, sanitizeHtmlToText, PursuitStage, RelevanceStatus } from '@bridge-ai/shared';

interface SystemHealth {
  apiStatus: string;
  pythonAgentStatus: string;
  dbStatus: string;
  lastChecked: string;
}

interface RelevanceInfo {
  relevanceStatus: RelevanceStatus;
  relevanceScore: number;
  explanation: string;
  positiveReasons: string[];
  exclusionReasons: string[];
}

interface OpportunityItem {
  id: string;
  title: string;
  fundingAgency: string;
  fundingOpportunityNumber?: string;
  sourceSystem?: string;
  externalOpportunityId?: string;
  isDemo: boolean;
  verificationStatus?: string;
  pursuitStage: PursuitStage;
  dismissedReason?: string;
  discoverySearchTerms?: string[];
  program?: string;
  description: string;
  sourceUrl: string;
  status: string;
  openingDate: string;
  deadline: string;
  awardMin: string;
  awardMax: string;
  totalAvailableFunding: string;
  geography: string;
  supportTrainingStipends: string;
  supportTransportation: string;
  supportTools: string;
  supportPPE: string;
  supportLaptops: string;
  supportTrainingEquipment: string;
  supportCertifications: string;
  supportPaidWorkExperience: string;
  lastVerifiedTimestamp?: string;
  fundingSource?: {
    name: string;
    agencyType: string;
  };
  eligibilityRequirements?: Array<{
    criteriaCategory: string;
    description: string;
    isMandatory: boolean;
    verifiedStatus: string;
    notes?: string;
  }>;
  opportunityAnalyses?: Array<{
    overallFitScore: number;
    evidenceCoverage: number;
    eligibilityStatus: string;
    eligibilityDecision: string;
    recommendation: string;
    reasoningSummary: string;
    profileVersion: string;
  }>;
  relevanceAnalyses?: RelevanceInfo[];
  isStale?: boolean;
  staleReason?: string;
}

const REVIEW_TOKEN = 'bridge_secret_review_token_change_in_production_2026';

export default function App() {
  const [health, setHealth] = useState<SystemHealth>({
    apiStatus: 'CHECKING',
    pythonAgentStatus: 'CHECKING',
    dbStatus: 'CONFIGURED',
    lastChecked: new Date().toLocaleTimeString(),
  });

  const [opportunities, setOpportunities] = useState<OpportunityItem[]>([]);
  const [activeFilter, setActiveFilter] = useState<
    'all' | 'new' | 'needs_analysis' | 'qualified' | 'locked' | 'dismissed' | 'official' | 'demo'
  >('all');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedOpp, setSelectedOpp] = useState<OpportunityItem | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  async function fetchOpportunities() {
    setLoading(true);
    setError(null);
    try {
      let url = 'http://localhost:4000/api/opportunities';
      if (activeFilter === 'demo') {
        url += '?dataKind=demo';
      } else if (activeFilter === 'official') {
        url += '?dataKind=official';
      } else if (activeFilter === 'locked') {
        url = 'http://localhost:4000/api/opportunities/locked';
      } else if (activeFilter === 'new') {
        url += '?pursuitStage=NEW';
      } else if (activeFilter === 'needs_analysis') {
        url += '?pursuitStage=NEEDS_ANALYSIS';
      } else if (activeFilter === 'qualified') {
        url += '?pursuitStage=QUALIFIED';
      } else if (activeFilter === 'dismissed') {
        url += '?pursuitStage=DISMISSED';
      }

      const res = await fetch(url);
      if (res.ok) {
        const json = await res.json();
        setOpportunities(json.data || []);
      } else {
        setError(`HTTP Error ${res.status}: Failed to fetch opportunities`);
      }
    } catch (err: any) {
      setError(err.message || 'Network error fetching opportunities');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    async function checkHealth() {
      try {
        const res = await fetch('http://localhost:4000/health');
        if (res.ok) {
          const data = (await res.json()) as any;
          setHealth({
            apiStatus: data.status || 'UP',
            pythonAgentStatus: data.integrations?.fundingAgent?.status || 'UNKNOWN',
            dbStatus: data.integrations?.database?.status || 'CONFIGURED',
            lastChecked: new Date().toLocaleTimeString(),
          });
        } else {
          setHealth((prev) => ({ ...prev, apiStatus: 'OFFLINE' }));
        }
      } catch {
        setHealth((prev) => ({ ...prev, apiStatus: 'STANDBY (API Offline)' }));
      }
    }

    checkHealth();
    fetchOpportunities();
    const interval = setInterval(checkHealth, 15000);
    return () => clearInterval(interval);
  }, [activeFilter]);

  async function handleAnalyze(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    try {
      setActionMessage('Running analysis & contextual relevance assessment...');
      await fetch(`http://localhost:4000/api/opportunities/${id}/relevance`, { method: 'POST' });
      await fetch(`http://localhost:4000/api/opportunities/${id}/analyze`, { method: 'POST' });
      setActionMessage('Analysis and relevance completed successfully.');
      fetchOpportunities();
    } catch (err: any) {
      setError(`Failed to analyze opportunity: ${err.message}`);
    }
  }

  async function handleTransitionPursuit(id: string, targetStage: PursuitStage, e: React.MouseEvent) {
    e.stopPropagation();
    let reason: string | undefined;

    if (targetStage === 'DISMISSED') {
      const inputReason = prompt('Please enter a reason for dismissing this opportunity:');
      if (!inputReason || inputReason.trim() === '') {
        alert('Dismissal requires an explanatory reason.');
        return;
      }
      reason = inputReason.trim();
    }

    if (targetStage === 'LOCKED') {
      const confirmLock = confirm('Are you sure you want to Lock Match for this opportunity? This represents an intentional human pursuit decision.');
      if (!confirmLock) return;
    }

    try {
      setActionMessage(`Transitioning pursuit stage to ${targetStage}...`);
      const res = await fetch(`http://localhost:4000/api/opportunities/${id}/pursuit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${REVIEW_TOKEN}`,
        },
        body: JSON.stringify({
          stage: targetStage,
          reviewerId: 'human-reviewer-gui',
          notes: `Stage updated to ${targetStage} via Bridge AI web interface`,
          reason,
        }),
      });

      if (res.ok) {
        setActionMessage(`Pursuit stage successfully updated to ${targetStage}.`);
        fetchOpportunities();
      } else {
        const json = await res.json();
        alert(`Error (${res.status}): ${json.message || 'Transition failed'}`);
      }
    } catch (err: any) {
      alert(`Failed to update pursuit stage: ${err.message}`);
    }
  }

  return (
    <div className="container">
      {/* Header */}
      <header>
        <div className="header-badge">Phase 1D • Real Discovery, Triage & Locked Matches Active</div>
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
          AI assists authorized humans with research, extraction, relevance scoring, and analysis. Provenance verification confirms official source origin—it does <strong>never</strong> constitute organizational eligibility or qualification. Every qualification and lock match decision requires explicit human authorization.
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
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Grants.gov Ingestion Engine Active</p>
          <div style={{ marginTop: '0.75rem' }}>
            <span className="badge badge-amber">{health.dbStatus}</span>
          </div>
        </div>
      </div>

      {/* Funding Opportunities Triage Feed */}
      <div className="card" style={{ marginBottom: '2.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem' }}>
          <div>
            <h2 className="section-title" style={{ marginBottom: '0.25rem' }}>
              🎯 Grant Discovery & Triage Feed
            </h2>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
              Separated Contextual Relevance, Organizational Eligibility, Fit Scores, and Human Pursuit Pipeline.
            </p>
          </div>

          {/* Filter Tabs */}
          <div style={{ display: 'flex', gap: '0.35rem', background: 'rgba(0,0,0,0.3)', padding: '0.3rem', borderRadius: '0.6rem', flexWrap: 'wrap' }}>
            <button className={`filter-btn ${activeFilter === 'all' ? 'active' : ''}`} onClick={() => setActiveFilter('all')}>
              All
            </button>
            <button className={`filter-btn ${activeFilter === 'new' ? 'active' : ''}`} onClick={() => setActiveFilter('new')}>
              New
            </button>
            <button className={`filter-btn ${activeFilter === 'needs_analysis' ? 'active' : ''}`} onClick={() => setActiveFilter('needs_analysis')}>
              Needs Analysis
            </button>
            <button className={`filter-btn ${activeFilter === 'qualified' ? 'active' : ''}`} onClick={() => setActiveFilter('qualified')}>
              Qualified
            </button>
            <button className={`filter-btn ${activeFilter === 'locked' ? 'active' : ''}`} onClick={() => setActiveFilter('locked')}>
              🔒 Locked Matches
            </button>
            <button className={`filter-btn ${activeFilter === 'dismissed' ? 'active' : ''}`} onClick={() => setActiveFilter('dismissed')}>
              Dismissed
            </button>
            <button className={`filter-btn ${activeFilter === 'official' ? 'active' : ''}`} onClick={() => setActiveFilter('official')}>
              Official Grants.gov
            </button>
            <button className={`filter-btn ${activeFilter === 'demo' ? 'active' : ''}`} onClick={() => setActiveFilter('demo')}>
              Demo Fixtures
            </button>
          </div>
        </div>

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
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
            <p style={{ fontSize: '1.1rem', fontWeight: 600 }}>No opportunities matching current filter ('{activeFilter}').</p>
            <p style={{ fontSize: '0.9rem', marginTop: '0.35rem' }}>
              Run <code>npm run ingest:grants-gov --workspace=apps/api -- --profile bridge-forward --limit 5 --persist</code> to discover and import official records.
            </p>
          </div>
        )}

        {/* Opportunity Cards List */}
        {!loading && !error && opportunities.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', marginTop: '1.25rem' }}>
            {opportunities.map((opp) => {
              const analysis = opp.opportunityAnalyses?.[0];
              const relevance = opp.relevanceAnalyses?.[0];
              const fitScore = analysis?.overallFitScore ?? 0;
              const cleanDescription = sanitizeHtmlToText(opp.description);

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
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem', flexWrap: 'wrap' }}>
                        {opp.isDemo ? (
                          <span className="badge badge-amber">DEMO FIXTURE</span>
                        ) : (
                          <span className="badge badge-purple">OFFICIAL SOURCE</span>
                        )}

                        <span className="badge badge-blue">Stage: {opp.pursuitStage}</span>

                        {relevance && (
                          <span className={`badge ${relevance.relevanceStatus === 'RELEVANT' ? 'badge-blue' : relevance.relevanceStatus === 'POSSIBLY_RELEVANT' ? 'badge-amber' : 'badge-rose'}`}>
                            Relevance: {relevance.relevanceStatus} ({relevance.relevanceScore}/100)
                          </span>
                        )}

                        {analysis && (
                          <span className={`badge ${analysis.eligibilityDecision === 'ELIGIBLE' ? 'badge-blue' : analysis.eligibilityDecision === 'INVESTIGATE' ? 'badge-amber' : 'badge-rose'}`}>
                            Eligibility: {analysis.eligibilityDecision}
                          </span>
                        )}

                        {opp.isStale && (
                          <span className="badge badge-rose" style={{ background: '#991b1b' }}>
                            ⚠️ STALE MATCH REFRESH NEEDED
                          </span>
                        )}
                      </div>

                      <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#f8fafc' }}>{opp.title}</h3>
                      <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                        <strong>Agency:</strong> {opp.fundingAgency} • <strong>Geography:</strong> {opp.geography}
                      </p>
                    </div>

                    {/* Scores Breakdown */}
                    <div style={{ textAlign: 'right', minWidth: '140px' }}>
                      <div style={{ fontSize: '1.6rem', fontWeight: 800, color: fitScore >= 80 ? '#60a5fa' : fitScore >= 50 ? '#fbbf24' : '#f87171' }}>
                        {fitScore}<span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>/100</span>
                      </div>
                      <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase' }}>
                        Bridge Fit Score
                      </div>
                      {analysis && (
                        <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.2rem' }}>
                          Evidence Coverage: {analysis.evidenceCoverage}%
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Sanitized Plain Text Description */}
                  <p style={{ fontSize: '0.9rem', color: '#cbd5e1', marginTop: '0.75rem', lineClamp: 2, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {cleanDescription}
                  </p>

                  {opp.dismissedReason && (
                    <div style={{ marginTop: '0.5rem', fontSize: '0.8rem', background: 'rgba(239, 68, 68, 0.1)', color: '#fca5a5', padding: '0.4rem 0.6rem', borderRadius: '0.4rem' }}>
                      🚫 <strong>Dismissed Reason:</strong> {opp.dismissedReason}
                    </div>
                  )}

                  {!opp.isDemo && (
                    <div className="provenance-warning" style={{ marginTop: '0.75rem', fontSize: '0.8rem', background: 'rgba(139, 92, 246, 0.1)', border: '1px solid rgba(139, 92, 246, 0.25)', color: '#d8b4fe', padding: '0.5rem 0.75rem', borderRadius: '0.4rem' }}>
                      ℹ️ Official Grants.gov provenance confirmed. Opportunity relevance does not constitute Bridge Forward eligibility until reviewed by authorized personnel.
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

                      {opp.pursuitStage !== 'QUALIFIED' && opp.pursuitStage !== 'LOCKED' && (
                        <button
                          onClick={(e) => handleTransitionPursuit(opp.id, 'QUALIFIED', e)}
                          style={{ background: 'rgba(16, 185, 129, 0.2)', border: '1px solid #10b981', color: '#6ee7b7', padding: '0.35rem 0.75rem', borderRadius: '0.4rem', fontSize: '0.8rem', cursor: 'pointer', fontWeight: 600 }}
                        >
                          ✓ Mark Qualified
                        </button>
                      )}

                      {opp.pursuitStage !== 'LOCKED' && (
                        <button
                          onClick={(e) => handleTransitionPursuit(opp.id, 'LOCKED', e)}
                          style={{ background: 'rgba(139, 92, 246, 0.2)', border: '1px solid #8b5cf6', color: '#c084fc', padding: '0.35rem 0.75rem', borderRadius: '0.4rem', fontSize: '0.8rem', cursor: 'pointer', fontWeight: 600 }}
                        >
                          🔒 Lock Match
                        </button>
                      )}

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
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.35rem' }}>
                {selectedOpp.isDemo ? (
                  <span className="badge badge-amber">DEMO FIXTURE</span>
                ) : (
                  <span className="badge badge-purple">OFFICIAL GRANTS.GOV RECORD</span>
                )}
                <span className="badge badge-blue">Pursuit: {selectedOpp.pursuitStage}</span>
              </div>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#ffffff' }}>{selectedOpp.title}</h2>
              <p style={{ fontSize: '0.85rem', color: '#94a3b8', marginTop: '0.25rem' }}>
                Official Source Link:{' '}
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
                🔍 Contextual Relevance Assessment (Relevance vs Eligibility vs Fit)
              </h3>
              <p style={{ fontSize: '0.9rem', color: '#e2e8f0', marginBottom: '0.5rem' }}>
                <strong>Status:</strong> {selectedOpp.relevanceAnalyses[0].relevanceStatus} ({selectedOpp.relevanceAnalyses[0].relevanceScore}/100)
              </p>
              <p style={{ fontSize: '0.85rem', color: '#cbd5e1' }}>
                {selectedOpp.relevanceAnalyses[0].explanation}
              </p>
            </div>
          )}

          <div className="grid-2" style={{ marginBottom: '1.5rem' }}>
            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#f1f5f9', marginBottom: '0.75rem' }}>
                📄 Official Notice Details (Sanitized Text Rendering)
              </h3>
              <p style={{ fontSize: '0.9rem', color: '#cbd5e1', marginBottom: '0.75rem', whiteSpace: 'pre-line' }}>
                {sanitizeHtmlToText(selectedOpp.description)}
              </p>
              <ul style={{ paddingLeft: '1.2rem', fontSize: '0.85rem', color: '#94a3b8' }}>
                <li><strong>Agency:</strong> {selectedOpp.fundingAgency}</li>
                <li><strong>Opportunity #:</strong> {selectedOpp.fundingOpportunityNumber || 'N/A'}</li>
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
                <span className="pill">Stipends: <strong>{selectedOpp.supportTrainingStipends}</strong></span>
                <span className="pill">Transportation: <strong>{selectedOpp.supportTransportation}</strong></span>
                <span className="pill">Tools: <strong>{selectedOpp.supportTools}</strong></span>
                <span className="pill">PPE: <strong>{selectedOpp.supportPPE}</strong></span>
                <span className="pill">Laptops: <strong>{selectedOpp.supportLaptops}</strong></span>
                <span className="pill">Training Equipment: <strong>{selectedOpp.supportTrainingEquipment}</strong></span>
                <span className="pill">Certifications: <strong>{selectedOpp.supportCertifications}</strong></span>
                <span className="pill">Paid Work Experience: <strong>{selectedOpp.supportPaidWorkExperience}</strong></span>
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
        <p>Bridge AI Platform • Phase 1D Real Discovery, Triage & Locked Matches • Bridge Forward Foundation</p>
      </footer>
    </div>
  );
}
