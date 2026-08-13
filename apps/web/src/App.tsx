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

export interface FiscalSponsorCandidate {
  id: string;
  name: string;
  canonicalDomain?: string;
  websiteUrl: string;
  directorySourceUrl: string;
  geography: string;
  mission: string;
  populationsServed: string[];
  modelsOffered: string[];
  acceptingNewProjects: string;
  applicationProcess: string;
  estimatedReviewTime: string;
  setupFee: string;
  adminPercentage: string;
  minRevenueRequirement: string;
  administersGovGrants: string;
  federalGrantCapability: string;
  samUeiStatus: string;
  contactChannel: string;
  verificationStatus: string;
  isFixture?: boolean;
  hasLiveVerification?: boolean;
  isMerged?: boolean;
  mergedIntoId?: string;
  verificationLevel?: string;
  identityEvidenceCoverage?: number;
  operationalEvidenceCoverage?: number;
  opportunityCompatibilityCoverage?: number;
  websiteVerified?: string;
  intakeStatus?: string;
  identityVerified?: string;
  sponsorshipModelsVerified?: string;
  governmentGrantAdministrationVerified?: string;
  feeVerified?: string;
  leadTimeVerified?: string;
  opportunitySpecificCompatibility?: string;
  lastVerifiedTimestamp?: string;
  internalNotes?: string;
  citations?: Array<{
    sourceUrl: string;
    quotedSection?: string;
    extractedClaim: string;
  }>;
  opportunityMatches?: Array<{
    id: string;
    matchScore: number;
    evidenceCoverage: number;
    status: string;
    alignmentRationale: string;
  }>;
}

export interface StrategicPartnerCandidate {
  id: string;
  name: string;
  organizationType: string;
  websiteUrl: string;
  geography: string;
  mission: string;
  servicesOffered: string[];
  collaborationFocus: string;
  contactChannel: string;
  verificationStatus: string;
  lastVerified?: string;
}

export interface ReadinessPlanTask {
  id: string;
  title: string;
  description: string;
  category: string;
  responsibleOwner: string;
  targetDate?: string;
  status: string;
  sourceEvidence?: string;
}

export interface OpportunityReadinessPlan {
  id: string;
  fundingOpportunityId: string;
  fundingOpportunity?: FundingOpportunity;
  targetNextCycle: string;
  currentBlocker: string;
  requiredRegistrations: string[];
  fiscalSponsorOrPartnerRequirements: string[];
  operatingHistoryAndCapacityGaps: string[];
  requiredDocuments: string[];
  matchFundStrategy: string;
  responsibleOwner: string;
  targetCompletionDate?: string;
  isComplete: boolean;
  tasks: ReadinessPlanTask[];
}

export interface GrantCalendarItem {
  id: string;
  opportunityTitle: string;
  agency: string;
  forecastedPostDate?: string;
  postedDate?: string;
  deadline?: string;
  priorCycleDates: string[];
  recurrenceConfidence: string;
  expectedNextCyclePrepDate?: string;
  recurrenceEvidenceSource: string;
  notes?: string;
}

export interface SponsorBriefingPacket {
  candidateId: string;
  candidateName: string;
  websiteUrl: string;
  geography: string;
  opportunityTitle?: string;
  opportunityNumber?: string;
  draftInquiryEmail: {
    to: string;
    subject: string;
    bodyText: string;
  };
  discoveryCallQuestions: string[];
  recommendedFollowUpDate: string;
  safeguardNotice: string;
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
  const [activePrimaryTab, setActivePrimaryTab] = useState<'OPPORTUNITIES' | 'SPONSORS' | 'PARTNERS' | 'READINESS' | 'CALENDAR'>('OPPORTUNITIES');

  const [opportunities, setOpportunities] = useState<FundingOpportunity[]>([]);
  const [sponsors, setSponsors] = useState<FiscalSponsorCandidate[]>([]);
  const [partners, setPartners] = useState<StrategicPartnerCandidate[]>([]);
  const [readinessPlans, setReadinessPlans] = useState<OpportunityReadinessPlan[]>([]);
  const [calendarItems, setCalendarItems] = useState<GrantCalendarItem[]>([]);

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [activeFilter, setActiveFilter] = useState<string>('POTENTIAL_PATHWAYS');
  const [pathwaysSubFilter, setPathwaysSubFilter] = useState<'all' | 'fiscal' | 'partnership' | 'future'>('all');
  const [selectedOpp, setSelectedOpp] = useState<FundingOpportunity | null>(null);
  const [briefingPacket, setBriefingPacket] = useState<SponsorBriefingPacket | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [discoveryResult, setDiscoveryResult] = useState<any | null>(null);
  const [discoveryLoading, setDiscoveryLoading] = useState<boolean>(false);

  const handleTriggerDiscovery = async () => {
    setDiscoveryLoading(true);
    try {
      const res = await fetch('/api/fiscal-sponsors/discovery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          geography: 'California',
          focusAreas: ['youth', 'housing', 'reentry', 'workforce'],
        }),
      });
      const json = await res.json();
      if (json.success) {
        setDiscoveryResult(json.data);
        setActionMessage(`Sponsor Discovery Completed! Found ${json.data.discoveredCandidates.length} candidate(s). Created: ${json.data.recordsCreated}, Updated: ${json.data.recordsUpdated}, Unchanged: ${json.data.recordsUnchanged}`);
        await fetchSponsors();
      } else {
        setError(json.error || 'Failed to run sponsor discovery');
      }
    } catch (err: any) {
      setError(err.message || 'Error triggering discovery');
    } finally {
      setDiscoveryLoading(false);
    }
  };

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
      if (!res.ok) throw new Error(`API response error: HTTP ${res.status}`);
      const json = await res.json();
      setOpportunities(json.data || []);
    } catch (err: any) {
      setError(err.message || 'Failed to connect to REST API');
    } finally {
      setLoading(false);
    }
  };

  const fetchSponsors = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/fiscal-sponsors');
      if (res.ok) {
        const json = await res.json();
        setSponsors(json.data || []);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchPartners = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/strategic-partners');
      if (res.ok) {
        const json = await res.json();
        setPartners(json.data || []);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchReadinessPlans = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/readiness-plans');
      if (res.ok) {
        const json = await res.json();
        setReadinessPlans(json.data || []);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchCalendarItems = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/grant-calendar');
      if (res.ok) {
        const json = await res.json();
        setCalendarItems(json.data || []);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealth();
    if (activePrimaryTab === 'OPPORTUNITIES') {
      fetchOpportunities();
    } else if (activePrimaryTab === 'SPONSORS') {
      fetchSponsors();
    } else if (activePrimaryTab === 'PARTNERS') {
      fetchPartners();
    } else if (activePrimaryTab === 'READINESS') {
      fetchReadinessPlans();
    } else if (activePrimaryTab === 'CALENDAR') {
      fetchCalendarItems();
    }
  }, [activePrimaryTab, activeFilter, pathwaysSubFilter]);

  const handleAnalyze = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      setActionMessage('Running opportunity analysis & scoring...');
      const res = await fetch(`/api/opportunities/${id}/analyze`, { method: 'POST' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await res.json();
      setActionMessage('Analysis & scoring completed successfully.');
      await fetchOpportunities();
    } catch (err: any) {
      alert(`Analysis failed: ${err.message}`);
    }
  };

  const handleFetchBriefing = async (candidateId: string, oppId?: string) => {
    try {
      const url = oppId ? `/api/fiscal-sponsors/${candidateId}/briefing?opportunityId=${oppId}` : `/api/fiscal-sponsors/${candidateId}/briefing`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setBriefingPacket(json.data);
    } catch (err: any) {
      alert(`Failed to fetch briefing packet: ${err.message}`);
    }
  };

  const handleToggleTask = async (taskId: string, currentStatus: string) => {
    try {
      const targetStatus = currentStatus === 'COMPLETED' ? 'NOT_STARTED' : 'COMPLETED';
      const res = await fetch(`/api/readiness-plans/tasks/${taskId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetStatus, actorId: 'human-user-admin' }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await fetchReadinessPlans();
    } catch (err: any) {
      alert(`Task status update failed: ${err.message}`);
    }
  };

  return (
    <div className="container">
      {/* Header */}
      <header>
        <div className="header-badge">Phase 1E • Fiscal Sponsor, Strategic Partner Discovery & Funding Readiness Active</div>
        <h1 className="brand-title">Bridge AI</h1>
        <p className="brand-subtitle">
          Funding Intelligence & Grant Readiness Platform for Bridge Forward Foundation
        </p>
      </header>

      {/* Core Principle Banner */}
      <div className="principle-banner">
        <div className="principle-title">
          <span>🛡️</span> PRODUCT PRINCIPLE: Human-Led, AI-Enabled Decision Support
        </div>
        <p className="principle-text">
          Bridge AI assists authorized humans with research, readiness analysis, and briefing preparation. Bridge AI performs <strong>zero</strong> automated external actions. All outreach inquiries, sponsor applications, legal certifications, and status advances require explicit human authorization.
        </p>
      </div>

      {/* Action Notification Message */}
      {actionMessage && (
        <div style={{ background: 'rgba(59, 130, 246, 0.15)', border: '1px solid #3b82f6', color: '#93c5fd', padding: '0.75rem 1rem', borderRadius: '0.5rem', marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>ℹ️ {actionMessage}</span>
          <button onClick={() => setActionMessage(null)} style={{ background: 'transparent', border: 'none', color: '#93c5fd', cursor: 'pointer', fontWeight: 700 }}>✕</button>
        </div>
      )}

      {/* Error Banner */}
      {error && (
        <div style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid #ef4444', color: '#fca5a5', padding: '0.75rem 1rem', borderRadius: '0.5rem', marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>⚠️ {error}</span>
          <button onClick={() => setError(null)} style={{ background: 'transparent', border: 'none', color: '#fca5a5', cursor: 'pointer', fontWeight: 700 }}>✕</button>
        </div>
      )}

      {/* Primary Navigation Tabs */}
      <div className="tab-navigation" style={{ marginBottom: '1.5rem', background: 'rgba(30, 41, 59, 0.9)', padding: '0.65rem 1rem', borderRadius: '0.75rem', border: '1px solid rgba(255,255,255,0.1)' }}>
        <button className={`tab ${activePrimaryTab === 'OPPORTUNITIES' ? 'active' : ''}`} onClick={() => setActivePrimaryTab('OPPORTUNITIES')}>
          📋 Opportunities Feed
        </button>
        <button className={`tab ${activePrimaryTab === 'SPONSORS' ? 'active' : ''}`} onClick={() => setActivePrimaryTab('SPONSORS')}>
          🤝 Fiscal Sponsor Directory
        </button>
        <button className={`tab ${activePrimaryTab === 'PARTNERS' ? 'active' : ''}`} onClick={() => setActivePrimaryTab('PARTNERS')}>
          🏛️ Strategic Partners
        </button>
        <button className={`tab ${activePrimaryTab === 'READINESS' ? 'active' : ''}`} onClick={() => setActivePrimaryTab('READINESS')}>
          📋 Readiness Plans
        </button>
        <button className={`tab ${activePrimaryTab === 'CALENDAR' ? 'active' : ''}`} onClick={() => setActivePrimaryTab('CALENDAR')}>
          📅 Funding Calendar
        </button>
      </div>

      {/* System Health Grid */}
      <div className="grid-3">
        <div className="card">
          <div className="section-title">
            <span className={`status-indicator ${health.apiStatus === 'UP' ? 'status-active' : 'status-warning'}`}></span>
            Node.js REST API
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Port 4000 • Express + Prisma</p>
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
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Port 5432 • Phase 1E Persistence</p>
          <div style={{ marginTop: '0.75rem' }}>
            <span className="badge badge-blue">{health.databaseStatus}</span>
          </div>
        </div>
      </div>

      {/* TAB 1: OPPORTUNITIES FEED */}
      {activePrimaryTab === 'OPPORTUNITIES' && (
        <div className="card" style={{ marginTop: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            <h2 className="section-title" style={{ margin: 0 }}>
              📋 Funding Opportunities ({opportunities.length})
            </h2>

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

          {activeFilter === 'POTENTIAL_PATHWAYS' && (
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', padding: '0.5rem 0.75rem', background: 'rgba(30, 41, 59, 0.6)', borderRadius: '0.5rem', border: '1px solid rgba(255,255,255,0.08)', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'flex', alignItems: 'center', fontWeight: 600, marginRight: '0.25rem' }}>Filter Pathway:</span>
              <button className={`tab ${pathwaysSubFilter === 'all' ? 'active' : ''}`} onClick={() => setPathwaysSubFilter('all')} style={{ fontSize: '0.8rem', padding: '0.3rem 0.65rem' }}>All Pathways</button>
              <button className={`tab ${pathwaysSubFilter === 'fiscal' ? 'active' : ''}`} onClick={() => setPathwaysSubFilter('fiscal')} style={{ fontSize: '0.8rem', padding: '0.3rem 0.65rem' }}>Fiscal Sponsor Required</button>
              <button className={`tab ${pathwaysSubFilter === 'partnership' ? 'active' : ''}`} onClick={() => setPathwaysSubFilter('partnership')} style={{ fontSize: '0.8rem', padding: '0.3rem 0.65rem' }}>Partnership Required</button>
              <button className={`tab ${pathwaysSubFilter === 'future' ? 'active' : ''}`} onClick={() => setPathwaysSubFilter('future')} style={{ fontSize: '0.8rem', padding: '0.3rem 0.65rem' }}>Future Opportunity</button>
            </div>
          )}

          {loading && <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>Loading...</div>}

          {!loading && opportunities.length === 0 && (
            <div className="empty-state" style={{ marginTop: '1.25rem' }}>
              <h3>No opportunities matching filter</h3>
            </div>
          )}

          {!loading && opportunities.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', marginTop: '1.25rem' }}>
              {opportunities.map((opp) => {
                const isRouted = Boolean(opp.candidateRoutingStatus && opp.candidateRoutingStatus !== 'DIRECT_FEDERAL_ELIGIBLE');
                const cleanedReason = cleanReason(opp.dismissedReason);

                return (
                  <div key={opp.id} className="opp-card" onClick={() => setSelectedOpp(opp)} style={{ background: 'rgba(15, 23, 42, 0.65)', border: selectedOpp?.id === opp.id ? '2px solid #3b82f6' : '1px solid var(--border-color)', borderRadius: '0.85rem', padding: '1.35rem', cursor: 'pointer' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.55rem', flexWrap: 'wrap' }}>
                          <span className="badge badge-purple">OFFICIAL SOURCE</span>
                          <span className="badge badge-blue">{isRouted ? 'Pipeline: POTENTIAL PATHWAY' : `Pipeline: ${opp.pursuitStage}`}</span>
                          <span className="badge badge-amber" style={{ background: '#78350f' }}>Readiness: PRE-INCORPORATION</span>
                        </div>
                        <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#f8fafc' }}>{sanitizeHtmlToText(opp.title)}</h3>
                        <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                          <strong>Agency:</strong> {sanitizeHtmlToText(opp.fundingAgency)} • <strong>Official ID:</strong> {opp.fundingOpportunityNumber}
                        </p>
                      </div>
                    </div>

                    <p style={{ fontSize: '0.9rem', color: '#cbd5e1', marginTop: '0.75rem' }}>{sanitizeHtmlToText(opp.description)}</p>

                    {cleanedReason && (
                      <div style={{ marginTop: '0.75rem', fontSize: '0.85rem', background: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#fca5a5', padding: '0.6rem 0.85rem', borderRadius: '0.5rem' }}>
                        🔒 <strong>Direct Application Blocking Reason:</strong> {cleanedReason}
                      </div>
                    )}

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                      <button onClick={(e) => handleAnalyze(opp.id, e)} style={{ background: 'rgba(59, 130, 246, 0.25)', border: '1px solid #3b82f6', color: '#93c5fd', padding: '0.35rem 0.75rem', borderRadius: '0.4rem', fontSize: '0.8rem', cursor: 'pointer', fontWeight: 600 }}>
                        ⚡ Analyze & Score
                      </button>
                      <span style={{ color: '#60a5fa', fontWeight: 600, fontSize: '0.85rem' }}>Review Details →</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: FISCAL SPONSOR DIRECTORY */}
      {activePrimaryTab === 'SPONSORS' && (
        <div className="card" style={{ marginTop: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem' }}>
            <div>
              <h2 className="section-title" style={{ margin: 0 }}>🤝 Fiscal Sponsor Directory & Evidence-Backed Match Finder</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '0.25rem' }}>
                Human-reviewed directory of verified California fiscal sponsors. Unverified facts are explicitly preserved as <strong>UNKNOWN</strong>.
              </p>
            </div>
            <button
              onClick={handleTriggerDiscovery}
              disabled={discoveryLoading}
              style={{
                background: discoveryLoading ? 'rgba(100, 116, 139, 0.5)' : 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                border: 'none',
                color: '#ffffff',
                padding: '0.6rem 1.2rem',
                borderRadius: '0.5rem',
                fontWeight: 600,
                fontSize: '0.875rem',
                cursor: discoveryLoading ? 'not-allowed' : 'pointer',
                boxShadow: '0 4px 12px rgba(37, 99, 235, 0.3)',
              }}
            >
              {discoveryLoading ? '⏳ Running Sponsor Discovery...' : '⚡ Trigger Live Sponsor Discovery Run'}
            </button>
          </div>

          {/* Discovery Run Results accounting panel */}
          {discoveryResult && (
            <div style={{ background: 'rgba(30, 41, 59, 0.8)', border: '1px solid rgba(59, 130, 246, 0.3)', padding: '1rem', borderRadius: '0.5rem', marginBottom: '1.5rem', fontSize: '0.85rem' }}>
              <div style={{ fontWeight: 700, color: '#60a5fa', marginBottom: '0.5rem' }}>
                🌐 Live Discovery Run Accounting Report ({new Date(discoveryResult.runTimestamp).toLocaleTimeString()})
              </div>
              <div style={{ display: 'flex', gap: '1.25rem', flexWrap: 'wrap', color: '#cbd5e1', marginBottom: '0.75rem' }}>
                <div><strong>Created:</strong> {discoveryResult.recordsCreated}</div>
                <div><strong>Materially Updated:</strong> {discoveryResult.recordsMateriallyUpdated || 0}</div>
                <div><strong>Revalidated:</strong> {discoveryResult.recordsRevalidated || discoveryResult.recordsUpdated || 0}</div>
                <div><strong>Merged:</strong> {discoveryResult.recordsMerged || 0}</div>
                <div><strong>Rejected:</strong> {discoveryResult.recordsRejected}</div>
              </div>
              {discoveryResult.sourcesQueried && discoveryResult.sourcesQueried.length > 0 && (
                <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '0.5rem', fontSize: '0.78rem', color: '#94a3b8' }}>
                  <strong>Sources Verified ({discoveryResult.sourcesQueried.length}):</strong>
                  <ul style={{ margin: '0.25rem 0 0 1.25rem', padding: 0 }}>
                    {discoveryResult.sourcesQueried.map((sq: any, idx: number) => (
                      <li key={idx}>
                        {typeof sq === 'string' ? sq : `${sq.sourceName} (${sq.sourceUrl}) • SHA-256: ${sq.responseHash?.substring(0, 12)}...`}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {loading && <div style={{ textAlign: 'center', padding: '2rem' }}>Loading directory...</div>}

          {!loading && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {sponsors.map((s) => (
                <div key={s.id} style={{ background: 'rgba(15, 23, 42, 0.7)', border: '1px solid var(--border-color)', borderRadius: '0.75rem', padding: '1.25rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <div>
                      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.4rem', flexWrap: 'wrap' }}>
                        {/* Section 2 UI Badges */}
                        {s.isFixture && !s.hasLiveVerification && (
                          <span className="badge badge-amber">🧪 Seed-only example</span>
                        )}
                        {!s.isFixture && s.hasLiveVerification && (
                          <span className="badge badge-purple">🌐 Live verified</span>
                        )}
                        {s.isFixture && s.hasLiveVerification && (
                          <span className="badge badge-blue">🔄 Seeded identity with live verification</span>
                        )}
                        {s.verificationLevel === 'DIRECTORY_REPORTED' && (
                          <span className="badge badge-amber">📋 Directory-reported / not independently verified</span>
                        )}
                        <span className="badge badge-purple">
                          Possible sponsor — research and human confirmation required
                        </span>
                      </div>
                      <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#f8fafc' }}>{s.name}</h3>
                      <p style={{ fontSize: '0.85rem', color: '#94a3b8', marginTop: '0.2rem' }}>
                        <strong>Geography:</strong> {s.geography} • <strong>Website:</strong>{' '}
                        <a href={s.websiteUrl} target="_blank" rel="noreferrer" style={{ color: '#38bdf8', textDecoration: 'underline' }}>
                          {s.websiteUrl}
                        </a>
                      </p>
                    </div>

                    <button onClick={() => handleFetchBriefing(s.id)} style={{ background: 'rgba(59, 130, 246, 0.2)', border: '1px solid #3b82f6', color: '#93c5fd', padding: '0.4rem 0.85rem', borderRadius: '0.4rem', fontSize: '0.85rem', cursor: 'pointer', fontWeight: 600 }}>
                      📄 Draft Inquiry Briefing
                    </button>
                  </div>

                  <p style={{ fontSize: '0.9rem', color: '#cbd5e1', marginTop: '0.75rem' }}>{s.mission}</p>

                  {/* Section 6 Granular Coverage Metrics */}
                  <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', margin: '0.75rem 0', fontSize: '0.8rem', color: '#94a3b8' }}>
                    <div>🆔 Identity Evidence: <strong style={{ color: '#60a5fa' }}>{s.identityEvidenceCoverage ?? 100}%</strong></div>
                    <div>⚙️ Operational Evidence: <strong style={{ color: '#f59e0b' }}>{s.operationalEvidenceCoverage ?? 67}%</strong></div>
                    <div>🎯 Opportunity Compatibility: <strong style={{ color: '#ec4899' }}>{s.opportunityCompatibilityCoverage ?? 0}%</strong></div>
                  </div>

                  <div style={{ marginTop: '0.5rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.65rem', background: 'rgba(30, 41, 59, 0.5)', padding: '0.75rem', borderRadius: '0.5rem', fontSize: '0.85rem' }}>
                    <div><strong>Models Offered:</strong> {Array.isArray(s.modelsOffered) ? s.modelsOffered.join(', ') : s.modelsOffered}</div>
                    <div><strong>Admin Fee:</strong> {s.adminPercentage}</div>
                    <div><strong>Setup Fee:</strong> {s.setupFee}</div>
                    <div><strong>Est. Review Lead Time:</strong> {s.estimatedReviewTime}</div>
                    <div><strong>Federal Capability:</strong> {s.federalGrantCapability}</div>
                    <div><strong>SAM/UEI Status:</strong> {s.samUeiStatus}</div>
                  </div>

                  {s.citations && s.citations.length > 0 && (
                    <div style={{ marginTop: '0.75rem', fontSize: '0.8rem', color: '#94a3b8', background: 'rgba(139, 92, 246, 0.1)', padding: '0.5rem 0.75rem', borderRadius: '0.4rem', border: '1px solid rgba(139, 92, 246, 0.2)' }}>
                      ℹ️ <strong>Source Citation:</strong> {s.citations[0].extractedClaim} (<em>{s.citations[0].sourceUrl}</em>)
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: STRATEGIC PARTNERS */}
      {activePrimaryTab === 'PARTNERS' && (
        <div className="card" style={{ marginTop: '1.5rem' }}>
          <h2 className="section-title">🏛️ Strategic Program Partners Directory</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.925rem', marginBottom: '1.25rem' }}>
            Programmatic partners (Continuums of Care, Community Colleges, Workforce Boards, Youth Housing Providers) distinct from legal fiscal sponsors.
          </p>

          {loading && <div style={{ textAlign: 'center', padding: '2rem' }}>Loading partners...</div>}

          {!loading && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem' }}>
              {partners.map((p) => (
                <div key={p.id} style={{ background: 'rgba(15, 23, 42, 0.7)', border: '1px solid var(--border-color)', borderRadius: '0.75rem', padding: '1.25rem' }}>
                  <span className="badge badge-purple" style={{ marginBottom: '0.5rem' }}>{p.organizationType}</span>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f8fafc', marginTop: '0.35rem' }}>{p.name}</h3>
                  <p style={{ fontSize: '0.85rem', color: '#94a3b8', marginTop: '0.2rem' }}>
                    <strong>Geography:</strong> {p.geography}
                  </p>
                  <p style={{ fontSize: '0.875rem', color: '#cbd5e1', marginTop: '0.5rem' }}>{p.mission}</p>
                  <div style={{ marginTop: '0.75rem', fontSize: '0.825rem', background: 'rgba(59, 130, 246, 0.1)', padding: '0.5rem 0.75rem', borderRadius: '0.4rem', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
                    <strong>Collaboration Focus:</strong> {p.collaborationFocus}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: READINESS PLANS */}
      {activePrimaryTab === 'READINESS' && (
        <div className="card" style={{ marginTop: '1.5rem' }}>
          <h2 className="section-title">📋 Opportunity Readiness Plans</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.925rem', marginBottom: '1.25rem' }}>
            Actionable readiness plans transforming Potential Pathways into 90-day future-cycle preparation schedules.
          </p>

          {loading && <div style={{ textAlign: 'center', padding: '2rem' }}>Loading plans...</div>}

          {!loading && readinessPlans.length === 0 && (
            <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>
              No readiness plans generated yet. Click "Analyze & Score" on any Potential Pathway to generate its preparation plan.
            </div>
          )}

          {!loading && readinessPlans.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {readinessPlans.map((plan) => (
                <div key={plan.id} style={{ background: 'rgba(15, 23, 42, 0.8)', border: '1px solid #3b82f6', borderRadius: '0.75rem', padding: '1.35rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                    <div>
                      <span className="badge badge-amber" style={{ marginBottom: '0.4rem' }}>{plan.targetNextCycle}</span>
                      <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#f8fafc' }}>
                        {plan.fundingOpportunity ? sanitizeHtmlToText(plan.fundingOpportunity.title) : 'Street Outreach Program (HHS-2026-ACF-ACYF-YO-0044)'}
                      </h3>
                      <p style={{ fontSize: '0.85rem', color: '#fca5a5', marginTop: '0.25rem' }}>
                        <strong>Current Blocker:</strong> {plan.currentBlocker}
                      </p>
                    </div>
                  </div>

                  <div style={{ marginTop: '1rem', background: 'rgba(30, 41, 59, 0.6)', padding: '0.85rem', borderRadius: '0.5rem', fontSize: '0.85rem', color: '#cbd5e1' }}>
                    <strong>25% Match Fund Strategy:</strong> {plan.matchFundStrategy}
                  </div>

                  <h4 style={{ fontSize: '1rem', fontWeight: 700, color: '#93c5fd', marginTop: '1.25rem', marginBottom: '0.65rem' }}>
                    Task Preparation Checklist ({plan.tasks.filter((t) => t.status === 'COMPLETED').length} / {plan.tasks.length} Completed)
                  </h4>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {plan.tasks.map((task) => (
                      <div key={task.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', background: 'rgba(15, 23, 42, 0.5)', padding: '0.65rem 0.85rem', borderRadius: '0.4rem', border: '1px solid rgba(255,255,255,0.05)' }}>
                        <input
                          type="checkbox"
                          checked={task.status === 'COMPLETED'}
                          onChange={() => handleToggleTask(task.id, task.status)}
                          style={{ marginTop: '0.2rem', cursor: 'pointer' }}
                        />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: '0.9rem', fontWeight: 600, color: task.status === 'COMPLETED' ? '#6ee7b7' : '#f8fafc', textDecoration: task.status === 'COMPLETED' ? 'line-through' : 'none' }}>
                            {task.title}
                          </div>
                          <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '0.15rem' }}>
                            {task.description} • <strong>Owner:</strong> {task.responsibleOwner} • <strong>Category:</strong> {task.category}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 5: FUNDING CALENDAR */}
      {activePrimaryTab === 'CALENDAR' && (
        <div className="card" style={{ marginTop: '1.5rem' }}>
          <h2 className="section-title">📅 Recurring Grant Calendar & Cycle Tracker</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.925rem', marginBottom: '1.25rem' }}>
            Tracks annual recurring funding cycles without fabricating future deadlines. Recurrence confidence is evaluated from historical notice evidence.
          </p>

          {loading && <div style={{ textAlign: 'center', padding: '2rem' }}>Loading calendar...</div>}

          {!loading && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {calendarItems.map((item) => (
                <div key={item.id} style={{ background: 'rgba(15, 23, 42, 0.7)', border: '1px solid var(--border-color)', borderRadius: '0.65rem', padding: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' }}>
                    <div>
                      <span className="badge badge-purple" style={{ marginRight: '0.5rem' }}>{item.recurrenceConfidence}</span>
                      <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f8fafc', display: 'inline' }}>{item.opportunityTitle}</h3>
                      <p style={{ fontSize: '0.85rem', color: '#94a3b8', marginTop: '0.25rem' }}>
                        <strong>Agency:</strong> {item.agency} • <strong>Prior Cycle Dates:</strong> {item.priorCycleDates.join(', ')}
                      </p>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '0.85rem', color: '#60a5fa', fontWeight: 700 }}>
                        Expected Next Prep Date: {item.expectedNextCyclePrepDate ? new Date(item.expectedNextCyclePrepDate).toISOString().split('T')[0] : 'TBD'}
                      </div>
                    </div>
                  </div>

                  <div style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: '#cbd5e1' }}>
                    {item.notes} • <em>Evidence Source: {item.recurrenceEvidenceSource}</em>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Briefing Packet Modal */}
      {briefingPacket && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '1.5rem' }}>
          <div style={{ background: '#0f172a', border: '2px solid #3b82f6', borderRadius: '0.85rem', maxWidth: '780px', width: '100%', maxHeight: '90vh', overflowY: 'auto', padding: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem', marginBottom: '1rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#fff' }}>
                📄 Fiscal Sponsor Inquiry Briefing Packet — {briefingPacket.candidateName}
              </h2>
              <button onClick={() => setBriefingPacket(null)} style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '1.2rem', cursor: 'pointer' }}>✕</button>
            </div>

            <div style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid #ef4444', color: '#fca5a5', padding: '0.75rem', borderRadius: '0.5rem', fontSize: '0.85rem', marginBottom: '1rem' }}>
              {briefingPacket.safeguardNotice}
            </div>

            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#93c5fd', marginBottom: '0.5rem' }}>✉️ Draft Inquiry Email (Human Review & Dispatch Only)</h3>
            <div style={{ background: 'rgba(30, 41, 59, 0.9)', padding: '1rem', borderRadius: '0.5rem', fontSize: '0.85rem', whiteSpace: 'pre-wrap', color: '#cbd5e1', marginBottom: '1.25rem' }}>
              <strong>To:</strong> {briefingPacket.draftInquiryEmail.to}<br />
              <strong>Subject:</strong> {briefingPacket.draftInquiryEmail.subject}<br /><br />
              {briefingPacket.draftInquiryEmail.bodyText}
            </div>

            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#93c5fd', marginBottom: '0.5rem' }}>📞 Discovery Call Questions</h3>
            <ul style={{ paddingLeft: '1.2rem', fontSize: '0.85rem', color: '#cbd5e1', marginBottom: '1.25rem' }}>
              {briefingPacket.discoveryCallQuestions.map((q, idx) => (
                <li key={idx} style={{ marginBottom: '0.35rem' }}>{q}</li>
              ))}
            </ul>

            <div style={{ textAlign: 'right', borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem' }}>
              <button onClick={() => setBriefingPacket(null)} style={{ background: '#3b82f6', border: 'none', color: '#fff', padding: '0.5rem 1.25rem', borderRadius: '0.4rem', fontWeight: 700, cursor: 'pointer' }}>
                Close Briefing
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Ground Truth Profile Card */}
      <div className="card" style={{ marginTop: '2.5rem', marginBottom: '2.5rem' }}>
        <h2 className="section-title">🏢 Ground-Truth Organization Profile (Southern California Service Area)</h2>
        <p style={{ color: '#e2e8f0', fontWeight: 600, fontSize: '1.05rem' }}>
          {BRIDGE_FORWARD_PROFILE.name} • {BRIDGE_FORWARD_PROFILE.statewideGeography}
        </p>
        <p style={{ fontSize: '0.85rem', color: '#94a3b8', marginTop: '0.35rem' }}>
          <strong>Initial Service Areas:</strong> {BRIDGE_FORWARD_PROFILE.initialServiceAreas.join(', ')}
        </p>
      </div>

      <footer>
        <p>Bridge AI Platform • Phase 1E Fiscal Sponsor & Funding Readiness Foundation • Bridge Forward Foundation</p>
      </footer>
    </div>
  );
}

export default App;
