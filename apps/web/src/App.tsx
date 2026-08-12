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
  program?: string;
  isDemo: boolean;
  description: string;
  sourceUrl: string;
  status: string;
  deadline: string;
  awardMin: string;
  awardMax: string;
  geography: string;
  supportTrainingStipends: string;
  supportTransportation: string;
  supportTools: string;
  supportPPE: string;
  supportLaptops: string;
  supportTrainingEquipment: string;
  supportCertifications: string;
  supportPaidWorkExperience: string;
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
    missionAlignmentScore: number;
    populationAlignmentScore: number;
    programAlignmentScore: number;
    organizationalMaturityScore: number;
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
        const res = await fetch('http://localhost:4000/api/opportunities');
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
  }, []);

  return (
    <div className="container">
      {/* Header */}
      <header>
        <div className="header-badge">Phase 1A • Database Persistence & APIs Active</div>
        <h1 className="brand-title">Bridge AI</h1>
        <p className="brand-subtitle">
          Funding Intelligence for Bridge Forward Foundation
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
            Port 8000 • FastAPI / Python Service
          </p>
          <div style={{ marginTop: '0.75rem' }}>
            <span className="badge badge-purple">{health.pythonAgentStatus}</span>
          </div>
        </div>

        <div className="card">
          <div className="section-title">
            <span className="status-indicator status-active"></span>
            PostgreSQL Database
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            Port 5432 • Prisma Migration 1A Applied
          </p>
          <div style={{ marginTop: '0.75rem' }}>
            <span className="badge badge-amber">{health.dbStatus}</span>
          </div>
        </div>
      </div>

      {/* Funding Opportunities Review Section */}
      <div className="card" style={{ marginBottom: '2.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h2 className="section-title" style={{ marginBottom: '0.25rem' }}>
              🎯 Funding Opportunities Review Feed
            </h2>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
              Structured grant opportunities evaluated against Bridge Forward Foundation ground-truth profile.
            </p>
          </div>
          <span className="badge badge-purple">DEMO FIXTURE ISOLATION ACTIVE</span>
        </div>

        {/* Loading State */}
        {loading && (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
            <div className="spinner"></div>
            <p style={{ marginTop: '1rem', fontWeight: 600 }}>Loading funding intelligence records...</p>
          </div>
        )}

        {/* Error State */}
        {!loading && error && (
          <div className="error-banner">
            <strong>⚠️ Error Fetching Opportunities:</strong> {error}
            <p style={{ fontSize: '0.85rem', marginTop: '0.5rem' }}>
              Make sure the API server is running on port 4000 (`npm run dev:api`).
            </p>
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && opportunities.length === 0 && (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
            <p style={{ fontSize: '1.1rem', fontWeight: 600 }}>No funding opportunities found.</p>
            <p style={{ fontSize: '0.9rem' }}>Run <code>npm run prisma:seed</code> in apps/api to seed demonstration records.</p>
          </div>
        )}

        {/* Opportunity Cards List */}
        {!loading && !error && opportunities.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', marginTop: '1.5rem' }}>
            {opportunities.map((opp) => {
              const analysis = opp.opportunityAnalyses?.[0];
              const fitScore = analysis?.overallFitScore ?? 0;
              const statusClass =
                analysis?.eligibilityStatus === 'HIGH_PRIORITY'
                  ? 'badge-blue'
                  : analysis?.eligibilityStatus === 'NOT_ELIGIBLE'
                  ? 'badge-rose'
                  : 'badge-amber';

              return (
                <div
                  key={opp.id}
                  className="opp-card"
                  onClick={() => setSelectedOpp(opp)}
                  style={{
                    background: 'rgba(15, 23, 42, 0.6)',
                    border: selectedOpp?.id === opp.id ? '2px solid #3b82f6' : '1px solid var(--border-color)',
                    borderRadius: '0.85rem',
                    padding: '1.35rem',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                        {opp.isDemo && <span className="badge badge-amber">DEMO FIXTURE</span>}
                        <span className={`badge ${statusClass}`}>{analysis?.eligibilityStatus || opp.status}</span>
                      </div>
                      <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#f8fafc' }}>{opp.title}</h3>
                      <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                        <strong>Agency:</strong> {opp.fundingAgency} • <strong>Geography:</strong> {opp.geography}
                      </p>
                    </div>

                    {/* Fit Score Badge */}
                    <div style={{ textAlign: 'right', minWidth: '110px' }}>
                      <div style={{ fontSize: '1.8rem', fontWeight: 800, color: fitScore >= 80 ? '#60a5fa' : fitScore >= 50 ? '#fbbf24' : '#f87171' }}>
                        {fitScore}<span style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>/100</span>
                      </div>
                      <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase' }}>
                        Bridge Fit Score
                      </div>
                    </div>
                  </div>

                  <p style={{ fontSize: '0.9rem', color: '#cbd5e1', marginTop: '0.75rem', lineClamp: 2, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {opp.description}
                  </p>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.05)', fontSize: '0.825rem', color: 'var(--text-muted)' }}>
                    <span>💰 Range: <strong>{opp.awardMin} – {opp.awardMax}</strong></span>
                    {opp.deadline && opp.deadline !== 'UNKNOWN' && (
                      <span>🗓️ Deadline: <strong>{opp.deadline}</strong></span>
                    )}
                    <span style={{ color: '#60a5fa', fontWeight: 600 }}>Click to review details →</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Expandable Detail View Drawer / Card */}
      {selectedOpp && (
        <div className="card" style={{ border: '2px solid #3b82f6', background: 'rgba(15, 23, 42, 0.95)', marginBottom: '2.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem', marginBottom: '1.25rem' }}>
            <div>
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.35rem' }}>
                {selectedOpp.isDemo && <span className="badge badge-amber">DEMO FIXTURE DATA</span>}
                <span className="badge badge-blue">ID: {selectedOpp.id}</span>
              </div>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#ffffff' }}>{selectedOpp.title}</h2>
            </div>
            <button
              onClick={() => setSelectedOpp(null)}
              style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', padding: '0.5rem 1rem', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: 700 }}
            >
              ✕ Close Detail
            </button>
          </div>

          {/* Analysis & Fit Score Detail */}
          {selectedOpp.opportunityAnalyses?.[0] && (
            <div style={{ background: 'rgba(30, 41, 59, 0.5)', padding: '1.25rem', borderRadius: '0.75rem', marginBottom: '1.5rem', borderLeft: '4px solid #3b82f6' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#60a5fa', marginBottom: '0.5rem' }}>
                🧠 Fit Score Reasoning Summary ({selectedOpp.opportunityAnalyses[0].overallFitScore}/100 • {selectedOpp.opportunityAnalyses[0].eligibilityStatus})
              </h3>
              <p style={{ fontSize: '0.95rem', color: '#e2e8f0' }}>{selectedOpp.opportunityAnalyses[0].reasoningSummary}</p>
            </div>
          )}

          <div className="grid-2" style={{ marginBottom: '1.5rem' }}>
            {/* Eligibility Requirements */}
            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#f1f5f9', marginBottom: '0.75rem' }}>
                📋 Eligibility Requirements ({selectedOpp.eligibilityRequirements?.length || 0})
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {selectedOpp.eligibilityRequirements?.map((req, idx) => (
                  <div key={idx} style={{ background: 'rgba(0,0,0,0.3)', padding: '0.75rem', borderRadius: '0.5rem', fontSize: '0.85rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                      <strong style={{ color: '#93c5fd' }}>{req.criteriaCategory}</strong>
                      <span className={`badge ${req.verifiedStatus === 'YES' ? 'badge-blue' : req.verifiedStatus === 'NO' ? 'badge-rose' : 'badge-amber'}`}>
                        {req.verifiedStatus}
                      </span>
                    </div>
                    <p style={{ color: '#cbd5e1' }}>{req.description}</p>
                    {req.notes && <p style={{ color: '#f87171', fontSize: '0.8rem', marginTop: '0.25rem' }}>Note: {req.notes}</p>}
                  </div>
                ))}
              </div>
            </div>

            {/* Participant Support Allowability Matrix */}
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

          {/* Source Provenance Citation */}
          {selectedOpp.sourceCitations?.[0] && (
            <div style={{ background: '#090d16', padding: '1rem', borderRadius: '0.5rem', border: '1px solid var(--border-color)', fontSize: '0.85rem', color: '#94a3b8' }}>
              <strong style={{ color: '#38bdf8' }}>📌 Source Provenance Citation (Fixture):</strong>
              <p style={{ fontStyle: 'italic', marginTop: '0.25rem', color: '#cbd5e1' }}>"{selectedOpp.sourceCitations[0].quotedSection}"</p>
              <p style={{ marginTop: '0.25rem', fontSize: '0.8rem' }}>Claim: {selectedOpp.sourceCitations[0].extractedClaim}</p>
            </div>
          )}
        </div>
      )}

      {/* Main Content Split */}
      <div className="grid-2">
        {/* Profile Card */}
        <div className="card">
          <h2 className="section-title">🏢 Ground-Truth Organization Profile</h2>
          <p style={{ color: '#e2e8f0', fontWeight: 600, fontSize: '1.05rem' }}>
            {BRIDGE_FORWARD_PROFILE.name}
          </p>
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem', marginBottom: '1rem' }}>
            <span className="badge badge-rose">{BRIDGE_FORWARD_PROFILE.status}</span>
            <span className="badge badge-amber">501(c)(3) {BRIDGE_FORWARD_PROFILE.taxStatus}</span>
          </div>

          <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
            <strong>Primary Outcome:</strong> {BRIDGE_FORWARD_PROFILE.primaryOutcome}
          </p>

          <h3 style={{ fontSize: '0.95rem', color: '#cbd5e1', marginTop: '1rem' }}>
            Program Pillars & Core Pathways
          </h3>
          <div className="pill-list">
            {BRIDGE_FORWARD_PROFILE.programs.map((prog, idx) => (
              <span
                key={idx}
                className="pill"
                style={{
                  borderLeft: prog.isOperational ? '3px solid #3b82f6' : '3px solid #64748b',
                }}
              >
                {prog.name} {!prog.isOperational && '(Planned)'}
              </span>
            ))}
          </div>
        </div>

        {/* Scoring System Summary */}
        <div className="card">
          <h2 className="section-title">📊 Bridge Fit Scoring Engine Taxonomy</h2>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
            Transparent 0–100 scoring across 12 dimensions. Disqualifying eligibility failures override fit scores to yield <code>NOT ELIGIBLE</code> status.
          </p>

          <h3 style={{ fontSize: '0.95rem', color: '#cbd5e1', marginBottom: '0.5rem' }}>
            Classification Status Taxonomy
          </h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1.25rem' }}>
            <span className="badge badge-blue">HIGH PRIORITY</span>
            <span className="badge badge-purple">INVESTIGATE</span>
            <span className="badge badge-amber">FUTURE OPPORTUNITY</span>
            <span className="badge badge-rose">NOT ELIGIBLE</span>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer>
        <p>Bridge AI Foundation Platform • Phase 1A Database Persistence & Read APIs • Bridge Forward Foundation</p>
      </footer>
    </div>
  );
}
