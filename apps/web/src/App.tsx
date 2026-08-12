import { useEffect, useState } from 'react';
import { BRIDGE_FORWARD_PROFILE } from '@bridge-ai/shared';

interface SystemHealth {
  apiStatus: string;
  pythonAgentStatus: string;
  dbStatus: string;
  lastChecked: string;
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
  allowableCostItems?: Array<{
    costCategory: string;
    isAllowable: string;
    restrictions?: string;
  }>;
  scoringCriteria?: Array<{
    criterionName: string;
    maxPoints?: number;
    description?: string;
  }>;
  sourceCitations?: Array<{
    sourceTitle?: string;
    quotedSection?: string;
    extractedClaim: string;
  }>;
  opportunityAnalyses?: Array<{
    overallFitScore: number;
    eligibilityStatus: string;
    reasoningSummary: string;
  }>;
}

export default function App() {
  const [health, setHealth] = useState<SystemHealth>({
    apiStatus: 'CHECKING',
    pythonAgentStatus: 'CHECKING',
    dbStatus: 'CONFIGURED',
    lastChecked: new Date().toLocaleTimeString(),
  });

  const [opportunities, setOpportunities] = useState<OpportunityItem[]>([]);
  const [activeFilter, setActiveFilter] = useState<'all' | 'demo' | 'official'>('all');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedOpp, setSelectedOpp] = useState<OpportunityItem | null>(null);

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

    async function fetchOpportunities() {
      setLoading(true);
      setError(null);
      try {
        let url = 'http://localhost:4000/api/opportunities';
        if (activeFilter === 'demo') {
          url += '?dataKind=demo';
        } else if (activeFilter === 'official') {
          url += '?dataKind=official';
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

    checkHealth();
    fetchOpportunities();
    const interval = setInterval(checkHealth, 15000);
    return () => clearInterval(interval);
  }, [activeFilter]);

  return (
    <div className="container">
      {/* Header */}
      <header>
        <div className="header-badge">Phase 1B • Verified Grants.gov Ingestion Active</div>
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
          AI assists authorized humans with research, extraction, organization, and drafting. AI must <strong>never</strong> autonomously submit grant applications, fabricate organizational facts, fabricate citations, represent uncertain eligibility as confirmed, or make final organizational decisions. Every conclusion is subject to human review.
        </p>
      </div>

      {/* System Health Grid */}
      <div className="grid-3">
        <div className="card">
          <div className="section-title">
            <span
              className={`status-indicator ${
                health.apiStatus === 'UP' ? 'status-active' : 'status-warning'
              }`}
            ></span>
            Node.js REST API
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            Port 4000 • Express + TypeScript
          </p>
          <div style={{ marginTop: '0.75rem' }}>
            <span className="badge badge-blue">{health.apiStatus}</span>
          </div>
        </div>

        <div className="card">
          <div className="section-title">
            <span
              className={`status-indicator ${
                health.pythonAgentStatus.includes('UP') ? 'status-active' : 'status-warning'
              }`}
            ></span>
            Python Funding Agent
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            Port 8000 • FastAPI Service
          </p>
          <div style={{ marginTop: '0.75rem' }}>
            <span className="badge badge-purple">{health.pythonAgentStatus}</span>
          </div>
        </div>

        <div className="card">
          <div className="section-title">
            <span className="status-indicator status-active"></span>
            PostgreSQL DB & Ingestion
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            Grants.gov Ingestion Engine Active
          </p>
          <div style={{ marginTop: '0.75rem' }}>
            <span className="badge badge-amber">{health.dbStatus}</span>
          </div>
        </div>
      </div>

      {/* Funding Opportunities Review Section */}
      <div className="card" style={{ marginBottom: '2.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem' }}>
          <div>
            <h2 className="section-title" style={{ marginBottom: '0.25rem' }}>
              🎯 Funding Opportunities Review Feed
            </h2>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
              Official Grants.gov notices & demonstration fixtures evaluated against Bridge Forward ground truth.
            </p>
          </div>

          {/* Filter Tabs */}
          <div style={{ display: 'flex', gap: '0.5rem', background: 'rgba(0,0,0,0.3)', padding: '0.3rem', borderRadius: '0.6rem' }}>
            <button
              className={`filter-btn ${activeFilter === 'all' ? 'active' : ''}`}
              onClick={() => setActiveFilter('all')}
            >
              All Records
            </button>
            <button
              className={`filter-btn ${activeFilter === 'official' ? 'active' : ''}`}
              onClick={() => setActiveFilter('official')}
            >
              Official Grants.gov
            </button>
            <button
              className={`filter-btn ${activeFilter === 'demo' ? 'active' : ''}`}
              onClick={() => setActiveFilter('demo')}
            >
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
            <p style={{ fontSize: '0.85rem', marginTop: '0.5rem' }}>
              Make sure the API server is active on port 4000.
            </p>
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && opportunities.length === 0 && (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
            <p style={{ fontSize: '1.1rem', fontWeight: 600 }}>No opportunities matching current filter.</p>
            <p style={{ fontSize: '0.9rem', marginTop: '0.35rem' }}>
              Run <code>npm run ingest:grants-gov --workspace=apps/api -- --keyword "reentry" --limit 3 --persist</code> to import live records.
            </p>
          </div>
        )}

        {/* Opportunity Cards List */}
        {!loading && !error && opportunities.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', marginTop: '1.25rem' }}>
            {opportunities.map((opp) => {
              const analysis = opp.opportunityAnalyses?.[0];
              const fitScore = analysis?.overallFitScore ?? 0;

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
                          <span className="badge badge-purple">OFFICIAL SOURCE — PENDING HUMAN REVIEW</span>
                        )}

                        {opp.fundingOpportunityNumber && (
                          <span className="badge badge-blue">#{opp.fundingOpportunityNumber}</span>
                        )}
                      </div>

                      <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#f8fafc' }}>{opp.title}</h3>
                      <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                        <strong>Agency:</strong> {opp.fundingAgency} • <strong>Geography:</strong> {opp.geography}
                      </p>
                    </div>

                    {/* Fit Score or Verification Badge */}
                    <div style={{ textAlign: 'right', minWidth: '130px' }}>
                      {opp.isDemo ? (
                        <>
                          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: fitScore >= 80 ? '#60a5fa' : fitScore >= 50 ? '#fbbf24' : '#f87171' }}>
                            {fitScore}<span style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>/100</span>
                          </div>
                          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase' }}>
                            Bridge Fit Score
                          </div>
                        </>
                      ) : (
                        <>
                          <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#c084fc' }}>
                            UNREVIEWED
                          </div>
                          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase' }}>
                            Review Status
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  <p style={{ fontSize: '0.9rem', color: '#cbd5e1', marginTop: '0.75rem', lineClamp: 2, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {opp.description}
                  </p>

                  {!opp.isDemo && (
                    <div className="provenance-warning" style={{ marginTop: '0.75rem', fontSize: '0.8rem', background: 'rgba(139, 92, 246, 0.1)', border: '1px solid rgba(139, 92, 246, 0.25)', color: '#d8b4fe', padding: '0.5rem 0.75rem', borderRadius: '0.4rem' }}>
                      ℹ️ Official Grants.gov provenance confirmed. Opportunity relevance does not constitute Bridge Forward eligibility until reviewed by authorized personnel.
                    </div>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.05)', fontSize: '0.825rem', color: 'var(--text-muted)' }}>
                    <span>💰 Range: <strong>{opp.awardMin} – {opp.awardMax}</strong></span>
                    {opp.deadline && opp.deadline !== 'UNKNOWN' && (
                      <span>🗓️ Closing Date: <strong>{opp.deadline}</strong></span>
                    )}
                    <span style={{ color: '#60a5fa', fontWeight: 600 }}>Review Details →</span>
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
                <span className="badge badge-blue">ID: {selectedOpp.externalOpportunityId || selectedOpp.id}</span>
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

          <div className="grid-2" style={{ marginBottom: '1.5rem' }}>
            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#f1f5f9', marginBottom: '0.75rem' }}>
                📄 Official Notice Details
              </h3>
              <p style={{ fontSize: '0.9rem', color: '#cbd5e1', marginBottom: '0.75rem' }}>{selectedOpp.description}</p>
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
              <p style={{ fontSize: '0.8rem', color: 'var(--text-dim)', marginTop: '0.75rem' }}>
                *Official-source imports set participant support categories to UNKNOWN until human review.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Profile Card */}
      <div className="card" style={{ marginBottom: '2.5rem' }}>
        <h2 className="section-title">🏢 Ground-Truth Organization Profile</h2>
        <p style={{ color: '#e2e8f0', fontWeight: 600, fontSize: '1.05rem' }}>
          {BRIDGE_FORWARD_PROFILE.name}
        </p>
        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem', marginBottom: '1rem' }}>
          <span className="badge badge-rose">{BRIDGE_FORWARD_PROFILE.status}</span>
          <span className="badge badge-amber">501(c)(3) {BRIDGE_FORWARD_PROFILE.taxStatus}</span>
        </div>
        <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
          <strong>Primary Outcome:</strong> {BRIDGE_FORWARD_PROFILE.primaryOutcome}
        </p>
      </div>

      {/* Footer */}
      <footer>
        <p>Bridge AI Platform • Phase 1B Verified Grants.gov Ingestion • Bridge Forward Foundation</p>
      </footer>
    </div>
  );
}
