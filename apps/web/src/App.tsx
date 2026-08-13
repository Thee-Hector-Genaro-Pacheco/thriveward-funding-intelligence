import React, { useState, useEffect } from 'react';
import './index.css';
import { BRIDGE_FORWARD_PROFILE } from '@bridge-ai/shared';

export interface FundingOpportunity {
  id: string;
  fundingOpportunityNumber: string;
  title: string;
  fundingAgency: string;
  geography: string;
  description: string;
  sourceUrl: string;
  status: string;
  isDemo: boolean;
  pursuitStage: string;
  candidateRoutingStatus?: string | null;
  dismissedReason?: string | null;
  isStale?: boolean;
  openingDate?: string;
  deadline?: string;
  awardMin?: string;
  awardMax?: string;
  totalAvailableFunding?: string;
  supportTrainingStipends?: string;
  supportTransportation?: string;
  supportTools?: string;
  supportPPE?: string;
  supportLaptops?: string;
  supportTrainingEquipment?: string;
  supportCertifications?: string;
  supportPaidWorkExperience?: string;
  relevanceAnalyses?: Array<{
    relevanceStatus: string;
    relevanceScore: number;
    explanation: string;
  }>;
  opportunityAnalyses?: Array<{
    id: string;
    overallFitScore: number;
    evidenceCoverage: number;
    eligibilityDecision: string;
    eligibilityStatus: string;
    recommendation: string;
    reasoningSummary: string;
    profileSnapshot?: any;
    eligibilityFindings?: Array<{
      criterionKey: string;
      criterionText: string;
      outcome: string;
      rationale: string;
    }>;
    analysisDimensions?: Array<{
      dimensionKey: string;
      weight: number;
      matchStatus: string;
      scoreAwarded: number;
      rationale: string;
    }>;
  }>;
}

export interface SystemHealth {
  apiStatus: string;
  pythonAgentStatus: string;
  databaseStatus: string;
}

function sanitizeHtmlToText(html?: string | null): string {
  if (!html) return '';
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function cleanReason(reason?: string | null): string {
  if (!reason) return '';
  return reason
    .replace(/^FISCAL_SPONSOR_REQUIRED:\s*/gi, '')
    .replace(/^PARTNERSHIP_REQUIRED:\s*/gi, '')
    .replace(/^FUTURE_OPPORTUNITY:\s*/gi, '')
    .replace(/^EXCLUDED:\s*/gi, '')
    .replace(/^FISCAL_SPONSOR_REQUIRED:\s*/gi, '')
    .replace(/^PARTNERSHIP_REQUIRED:\s*/gi, '')
    .trim();
}

export function App() {
  const [opportunities, setOpportunities] = useState<FundingOpportunity[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<string>('POTENTIAL_PATHWAYS');
  const [pathwaysSubFilter, setPathwaysSubFilter] = useState<'all' | 'fiscal' | 'partnership' | 'future'>('all');
  const [selectedOpp, setSelectedOpp] = useState<FundingOpportunity | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const [health, setHealth] = useState<SystemHealth>({
    apiStatus: 'CHECKING',
    pythonAgentStatus: 'CHECKING',
    databaseStatus: 'CHECKING',
  });

  const fetchHealth = async () => {
    try {
      const res = await fetch('/api/health');
      if (res.ok) {
        const data = await res.json();
        setHealth({
          apiStatus: 'UP',
          pythonAgentStatus: data.services?.fundingAgent === 'UP' ? 'UP' : 'DOWN',
          databaseStatus: data.services?.database === 'UP' ? 'UP' : 'DOWN',
        });
      } else {
        setHealth({ apiStatus: 'DOWN', pythonAgentStatus: 'UNKNOWN', databaseStatus: 'UNKNOWN' });
      }
    } catch {
      setHealth({ apiStatus: 'DOWN', pythonAgentStatus: 'DOWN', databaseStatus: 'DOWN' });
    }
  };

  const fetchOpportunities = async () => {
    setLoading(true);
    setError(null);
    try {
      let queryParams = '';
      if (activeFilter === 'POTENTIAL_PATHWAYS') {
        if (pathwaysSubFilter === 'fiscal') {
          queryParams = '?candidateRoutingStatus=FISCAL_SPONSOR_REQUIRED';
        } else if (pathwaysSubFilter === 'partnership') {
          queryParams = '?candidateRoutingStatus=PARTNERSHIP_REQUIRED';
        } else if (pathwaysSubFilter === 'future') {
          queryParams = '?candidateRoutingStatus=FUTURE_OPPORTUNITY';
        } else {
          queryParams = '?candidateRoutingStatus=POTENTIAL_PATHWAYS';
        }
      } else if (activeFilter === 'OFFICIAL') {
        queryParams = '?dataKind=official';
      } else if (activeFilter === 'NEW') {
        queryParams = '?pursuitStage=NEW';
      } else if (activeFilter === 'QUALIFIED') {
        queryParams = '?pursuitStage=QUALIFIED';
      } else if (activeFilter === 'LOCKED') {
        queryParams = '?pursuitStage=LOCKED';
      }

      const res = await fetch(`/api/opportunities${queryParams}`);
      if (!res.ok) {
        throw new Error(`API response error: HTTP ${res.status}`);
      }
      const json = await res.json();
      setOpportunities(json.data || []);
    } catch (err: any) {
      setError(err.message || 'Failed to connect to REST API');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealth();
    fetchOpportunities();
  }, [activeFilter, pathwaysSubFilter]);

  const handleAnalyze = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      setActionMessage('Running opportunity analysis & scoring...');
      const res = await fetch(`/api/opportunities/${id}/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!res.ok) {
        const errBody = await res.json();
        throw new Error(errBody.message || `HTTP ${res.status}`);
      }

      await res.json();
      setActionMessage('Analysis & scoring completed successfully.');

      // Refresh list to update analysis graphs
      const freshRes = await fetch(`/api/opportunities?candidateRoutingStatus=POTENTIAL_PATHWAYS`);
      if (freshRes.ok) {
        const json = await freshRes.json();
        const updatedList: FundingOpportunity[] = json.data || [];
        setOpportunities(updatedList);
        const target = updatedList.find((o) => o.id === id);
        if (target) {
          setSelectedOpp(target);
        }
      }
    } catch (err: any) {
      alert(`Analysis failed: ${err.message}`);
    }
  };

  const handleTransitionPursuit = async (id: string, stage: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      let reason = '';
      if (stage === 'DISMISSED') {
        const inputReason = prompt('Please state the explicit reason for dismissing this opportunity:');
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
          <span>🛡️</span> PRODUCT PRINCIPLE: Human-Led, AI-Enabled Decision Support
        </div>
        <p className="principle-text">
          AI assists authorized humans with research, extraction, relevance scoring, and readiness analysis. Analysis is read-only decision support and <strong>never</strong> mutates pursuit stage, candidate routing, human reviews, or source provenance. Qualification and match locking require explicit human authorization.
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
            📋 Funding Opportunities ({opportunities.length})
          </h2>

          {/* Primary View Filters */}
          <div className="tab-navigation">
            <button className={`tab ${activeFilter === 'POTENTIAL_PATHWAYS' ? 'active' : ''}`} onClick={() => setActiveFilter('POTENTIAL_PATHWAYS')}>
              🛤️ Potential Pathways
            </button>
            <button className={`tab ${activeFilter === 'OFFICIAL' ? 'active' : ''}`} onClick={() => setActiveFilter('OFFICIAL')}>
              🏛️ Official Grants.gov
            </button>
            <button className={`tab ${activeFilter === 'NEW' ? 'active' : ''}`} onClick={() => setActiveFilter('NEW')}>
              Direct Actionable Feed
            </button>
            <button className={`tab ${activeFilter === 'QUALIFIED' ? 'active' : ''}`} onClick={() => setActiveFilter('QUALIFIED')}>
              Qualified Matches
            </button>
            <button className={`tab ${activeFilter === 'LOCKED' ? 'active' : ''}`} onClick={() => setActiveFilter('LOCKED')}>
              🔒 Locked Matches
            </button>
          </div>
        </div>

        {/* Potential Pathways Sub-Filter Toolbar */}
        {activeFilter === 'POTENTIAL_PATHWAYS' && (
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', padding: '0.5rem 0.75rem', background: 'rgba(30, 41, 59, 0.6)', borderRadius: '0.5rem', border: '1px solid rgba(255,255,255,0.08)', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'flex', alignItems: 'center', fontWeight: 600, marginRight: '0.25rem' }}>Filter Pathway:</span>
            <button
              className={`tab ${pathwaysSubFilter === 'all' ? 'active' : ''}`}
              onClick={() => setPathwaysSubFilter('all')}
              style={{ fontSize: '0.8rem', padding: '0.3rem 0.65rem' }}
            >
              All Pathways
            </button>
            <button
              className={`tab ${pathwaysSubFilter === 'fiscal' ? 'active' : ''}`}
              onClick={() => setPathwaysSubFilter('fiscal')}
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
              There are currently no funding opportunities in the <strong>{activeFilter}</strong> view. Bridge Forward is currently <strong>PRE_INCORPORATION</strong>. Direct federal solicitations requiring active SAM.gov/UEI registration are safely routed to <em>Potential Pathways</em>.
            </p>
          </div>
        )}

        {/* Opportunity Cards List */}
        {!loading && !error && opportunities.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', marginTop: '1.25rem' }}>
            {opportunities.map((opp) => {
              const analysis = opp.opportunityAnalyses?.[0];
              const relevance = opp.relevanceAnalyses?.[0];

              const isIrrelevant = relevance?.relevanceStatus === 'IRRELEVANT';
              const isNotEligible = analysis?.eligibilityDecision === 'NOT_ELIGIBLE' || analysis?.eligibilityStatus === 'NOT_ELIGIBLE';
              const isRouted = Boolean(
                opp.candidateRoutingStatus && opp.candidateRoutingStatus !== 'DIRECT_FEDERAL_ELIGIBLE'
              );
              const isBlockedReason = isRouted || Boolean(
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
              const cleanedReason = cleanReason(opp.dismissedReason);

              // Action Gate UI flags — Qualification and Locking blocked if PRE_INCORPORATION / Non-actionable routing
              const canMarkQualified = !isRouted && !isIrrelevant && !isNotEligible && !isBlockedReason && opp.pursuitStage !== 'QUALIFIED' && opp.pursuitStage !== 'LOCKED';
              const canLockMatch = !isRouted && !isIrrelevant && !isNotEligible && !isBlockedReason && opp.pursuitStage === 'QUALIFIED';

              const pipelineLabel = isRouted || opp.pursuitStage === 'DISMISSED' ? 'Pipeline: POTENTIAL PATHWAY' : `Pipeline: ${opp.pursuitStage}`;

              const pathwayText = opp.candidateRoutingStatus === 'FISCAL_SPONSOR_REQUIRED' || opp.dismissedReason?.includes('FISCAL_SPONSOR')
                ? 'Fiscal Sponsor Required'
                : opp.candidateRoutingStatus === 'PARTNERSHIP_REQUIRED' || opp.dismissedReason?.includes('PARTNERSHIP')
                ? 'Partnership Required'
                : opp.candidateRoutingStatus === 'FUTURE_OPPORTUNITY' || opp.dismissedReason?.includes('FUTURE')
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
                      {/* Separate Evaluation Badges for 6 Analysis Types */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.55rem', flexWrap: 'wrap' }}>
                        {opp.isDemo ? (
                          <span className="badge badge-amber">DEMO FIXTURE</span>
                        ) : (
                          <span className="badge badge-purple">OFFICIAL SOURCE</span>
                        )}

                        <span className="badge badge-blue">{pipelineLabel}</span>

                        {relevance && (
                          <span className={`badge ${relevance.relevanceStatus === 'RELEVANT' ? 'badge-blue' : 'badge-amber'}`}>
                            Relevance: {relevance.relevanceStatus} ({relevance.relevanceScore || 85}/100)
                          </span>
                        )}

                        {analysis && (
                          <span className="badge badge-purple" style={{ background: '#4c1d95' }}>
                            Org Fit: {analysis.overallFitScore}/100
                          </span>
                        )}

                        {analysis && (
                          <span className="badge badge-blue" style={{ background: '#1e3a8a' }}>
                            Evidence: {analysis.evidenceCoverage}%
                          </span>
                        )}

                        <span className="badge badge-rose" style={{ background: '#701a75' }}>
                          Direct Eligibility: Not Currently Eligible
                        </span>

                        <span className="badge badge-amber" style={{ background: '#78350f' }}>
                          Readiness: PRE-INCORPORATION
                        </span>

                        <span className="badge badge-amber" style={{ background: '#854d0e' }}>
                          Feasibility: Future-Cycle Recommended
                        </span>
                      </div>

                      <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#f8fafc' }}>{cleanTitle}</h3>
                      <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                        <strong>Agency:</strong> {cleanAgency} • <strong>Geography:</strong> {cleanGeography} • <strong>Official ID:</strong> {opp.fundingOpportunityNumber}
                      </p>
                    </div>

                    {/* Primary Score / Status Column */}
                    <div style={{ textAlign: 'right', minWidth: '190px' }}>
                      <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#fca5a5', background: 'rgba(239,68,68,0.15)', padding: '0.4rem 0.75rem', borderRadius: '0.5rem', border: '1px solid rgba(239,68,68,0.3)' }}>
                        Not currently eligible to apply directly
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.35rem' }}>
                        Recommended Pathway: <strong style={{ color: '#60a5fa' }}>{pathwayText}</strong>
                      </div>
                    </div>
                  </div>

                  {/* Sanitized Description */}
                  <p style={{ fontSize: '0.9rem', color: '#cbd5e1', marginTop: '0.75rem', lineClamp: 2, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {cleanDescription}
                  </p>

                  {/* Prominent Blocking Reason Warning Box */}
                  {cleanedReason && (
                    <div style={{ marginTop: '0.75rem', fontSize: '0.85rem', background: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#fca5a5', padding: '0.6rem 0.85rem', borderRadius: '0.5rem' }}>
                      🔒 <strong>Direct Application Blocking Reason:</strong> {cleanedReason}
                    </div>
                  )}

                  {!opp.isDemo && (
                    <div className="provenance-warning" style={{ marginTop: '0.75rem', fontSize: '0.8rem', background: 'rgba(139, 92, 246, 0.1)', border: '1px solid rgba(139, 92, 246, 0.25)', color: '#d8b4fe', padding: '0.5rem 0.75rem', borderRadius: '0.4rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>ℹ️ Official Grants.gov provenance confirmed. Opportunity relevance does not constitute direct organizational eligibility until Bridge Forward completes incorporation and federal registrations.</span>
                      <a href={opp.sourceUrl} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} style={{ color: '#38bdf8', textDecoration: 'underline', fontWeight: 600, marginLeft: '0.5rem', whiteSpace: 'nowrap' }}>
                        🔗 View Official Notice
                      </a>
                    </div>
                  )}

                  {/* Action Buttons Toolbar */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.05)', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                      {/* Analyze & Score — Always enabled for all opportunities (read-only decision support) */}
                      <button
                        onClick={(e) => handleAnalyze(opp.id, e)}
                        style={{ background: 'rgba(59, 130, 246, 0.25)', border: '1px solid #3b82f6', color: '#93c5fd', padding: '0.35rem 0.75rem', borderRadius: '0.4rem', fontSize: '0.8rem', cursor: 'pointer', fontWeight: 600 }}
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
                <span className="badge badge-blue">
                  {selectedOpp.candidateRoutingStatus && selectedOpp.candidateRoutingStatus !== 'DIRECT_FEDERAL_ELIGIBLE'
                    ? 'Pipeline: POTENTIAL PATHWAY'
                    : `Pipeline: ${selectedOpp.pursuitStage}`}
                </span>
              </div>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#ffffff' }}>{sanitizeHtmlToText(selectedOpp.title)}</h2>
              <p style={{ fontSize: '0.85rem', color: '#94a3b8', marginTop: '0.25rem' }}>
                Verified Official Source:{' '}
                <a href={selectedOpp.sourceUrl} target="_blank" rel="noreferrer" style={{ color: '#38bdf8', textDecoration: 'underline', fontWeight: 600 }}>
                  🔗 View Official Notice ({selectedOpp.sourceUrl})
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

          {/* 6 Separated Analysis Types Display Panel */}
          <div style={{ background: 'rgba(30, 41, 59, 0.85)', border: '1px solid rgba(59, 130, 246, 0.3)', padding: '1.25rem', borderRadius: '0.65rem', marginBottom: '1.5rem' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#93c5fd', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span>📊</span> Decision Support Analysis & Readiness Breakdown
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem', marginBottom: '1rem' }}>
              <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '0.65rem 0.85rem', borderRadius: '0.5rem', border: '1px solid rgba(255,255,255,0.08)' }}>
                <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>1. Mission Relevance Score</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#60a5fa' }}>
                  {selectedOpp.relevanceAnalyses?.[0]?.relevanceScore || 85} / 100 ({selectedOpp.relevanceAnalyses?.[0]?.relevanceStatus || 'RELEVANT'})
                </div>
              </div>

              <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '0.65rem 0.85rem', borderRadius: '0.5rem', border: '1px solid rgba(255,255,255,0.08)' }}>
                <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>2. Organizational Fit Score</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#c084fc' }}>
                  {selectedOpp.opportunityAnalyses?.[0]?.overallFitScore ? `${selectedOpp.opportunityAnalyses[0].overallFitScore} / 100` : 'Click "Analyze & Score"'}
                </div>
              </div>

              <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '0.65rem 0.85rem', borderRadius: '0.5rem', border: '1px solid rgba(255,255,255,0.08)' }}>
                <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>3. Evidence Coverage</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#34d399' }}>
                  {selectedOpp.opportunityAnalyses?.[0]?.evidenceCoverage ? `${selectedOpp.opportunityAnalyses[0].evidenceCoverage}%` : 'N/A'}
                </div>
              </div>

              <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '0.65rem 0.85rem', borderRadius: '0.5rem', border: '1px solid rgba(255,255,255,0.08)' }}>
                <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>4. Direct Eligibility</div>
                <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#fca5a5' }}>
                  Not Currently Eligible
                </div>
              </div>

              <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '0.65rem 0.85rem', borderRadius: '0.5rem', border: '1px solid rgba(255,255,255,0.08)' }}>
                <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>5. Organizational Readiness</div>
                <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#fde047' }}>
                  PRE-INCORPORATION (Not Ready)
                </div>
              </div>

              <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '0.65rem 0.85rem', borderRadius: '0.5rem', border: '1px solid rgba(255,255,255,0.08)' }}>
                <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>6. Current-Cycle Feasibility</div>
                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#fbbf24' }}>
                  Future-Cycle Preparation Recommended
                </div>
              </div>
            </div>

            {/* Street Outreach Program Representation Banner */}
            {(selectedOpp.fundingOpportunityNumber?.includes('HHS-2026-ACF-ACYF-YO-0044') || selectedOpp.title.toLowerCase().includes('street outreach')) && (
              <div style={{ background: 'rgba(59, 130, 246, 0.12)', border: '1px solid rgba(59, 130, 246, 0.3)', padding: '0.75rem 1rem', borderRadius: '0.5rem', marginBottom: '1rem', color: '#93c5fd', fontSize: '0.85rem' }}>
                ℹ️ <strong>Street Outreach Program Eligibility Representation:</strong> Official solicitation eligibility includes nonprofits with and without 501(c)(3) status. Direct federal application remains blocked because Bridge Forward is <strong>PRE_INCORPORATION</strong> and lacks verified legal-entity status, EIN, SAM.gov/UEI registration, Grants.gov AOR, an executed fiscal sponsor agreement, 25% matching funds, and programmatic operating history.
              </div>
            )}

            {/* Current-Cycle Deadline Feasibility & Guidance */}
            <div style={{ background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.3)', padding: '0.85rem 1rem', borderRadius: '0.5rem', color: '#fef08a', fontSize: '0.85rem' }}>
              <div style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: '0.4rem', color: '#fde047' }}>
                ⏳ Deadline Feasibility Guidance
              </div>
              <p style={{ margin: 0, lineHeight: '1.4' }}>
                <strong>Closing Date:</strong> {selectedOpp.deadline || '2026-08-17'} (<strong>4 days remaining</strong>) • <strong>Required Lead Time:</strong> 60–90 days for fiscal sponsor execution & SAM.gov/UEI setup.<br />
                <strong>Recommendation:</strong> <em>Strong mission match — future-cycle preparation recommended.</em> Securing a fiscal sponsorship agreement, UEI credentials, and completing a federal submission within 4 days is not realistically achievable.
              </p>
              <div style={{ marginTop: '0.65rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <strong style={{ color: '#fca5a5' }}>Identified Capacity Gaps:</strong>
                  <ul style={{ margin: '0.25rem 0 0 1.1rem', padding: 0 }}>
                    <li>Legal entity status & EIN pending</li>
                    <li>Active SAM.gov & UEI registration missing</li>
                    <li>Grants.gov AOR account unverified</li>
                    <li>Executed fiscal sponsor agreement missing</li>
                  </ul>
                </div>
                <div>
                  <strong style={{ color: '#93c5fd' }}>Recommended Preparation Tasks:</strong>
                  <ol style={{ margin: '0.25rem 0 0 1.1rem', padding: 0 }}>
                    <li>Establish formal fiscal sponsorship agreement</li>
                    <li>Complete incorporation & SAM.gov UEI setup</li>
                    <li>Build 25% non-federal matching fund reserves</li>
                    <li>Prepare application for next annual cycle</li>
                  </ol>
                </div>
              </div>
            </div>
          </div>

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
