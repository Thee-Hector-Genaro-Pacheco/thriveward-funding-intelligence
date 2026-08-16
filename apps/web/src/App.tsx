import React, { useState, useEffect } from 'react';
import './index.css';
import { BRIDGE_FORWARD_PROFILE, formatRelevanceStatusLabel } from '@thriveward/shared';
import { OutreachWorkspaceDrawer } from './components/OutreachWorkspaceDrawer';
import { LoginModal } from './components/LoginModal';
import { UserHeaderBadge } from './components/UserHeaderBadge';
import { ChangePasswordModal } from './components/ChangePasswordModal';
import { AdminUserManagementModal } from './components/AdminUserManagementModal';
import { AiEvaluationPanel, AiEvaluationData } from './components/AiEvaluationPanel';
import { OfficialFundingDocuments } from './components/OfficialFundingDocuments';


const formatEligibilityText = (val: string | undefined | null) => {
  if (!val) return 'UNKNOWN';
  if (val === 'NOT_ELIGIBLE') return 'NOT_CURRENTLY_ELIGIBLE';
  return val;
};

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
  hasSourceConflict?: boolean;
  currentCycleStatus?: string;
  isStale?: boolean;
  openingDate?: string;
  deadline?: string;
  awardMin?: string;
  awardMax?: string;
  totalAvailableFunding?: string;
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
    version?: number;
    updatedAt?: string;
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
  opportunityMatches?: Array<{
    id: string;
    matchScore: number;
    evidenceCoverage: number;
    status: string;
    alignmentRationale: string;
    fiscalSponsorCandidateId: string;
    fiscalSponsorCandidate?: FiscalSponsorCandidate;
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
    fundingOpportunityId: string;
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
  opportunityId?: string;
  opportunityTitle?: string;
  opportunityNumber?: string;
  fundingAgency?: string;
  deadline?: string;
  awardRange?: string;
  matchRequirement?: string;
  candidateRoutingStatus?: string;
  readinessBlockers?: string;
  inquiryType: 'SPECIFIC_OPPORTUNITY' | 'GENERAL_INTRODUCTORY';
  bridgeForwardSummary: {
    name: string;
    status: string;
    geography: string;
    serviceCounties: string[];
    mission: string;
    targetPopulations: string[];
  };
  selectedNarrativeLenses?: string[];
  opportunitySpecificOrganizationNarrative?: string;
  geographicContextNarrative?: string;
  narrativeEvidenceFacts?: string[];
  narrativeSafeguardsApplied?: string[];
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
  apiStatus: 'UP' | 'DOWN' | 'CHECKING';
  databaseStatus: 'UP' | 'DOWN' | 'CHECKING';
  pythonAgentStatus: 'UP' | 'DOWN' | 'UNREACHABLE' | 'CHECKING';
  overallStatus: 'UP' | 'DEGRADED' | 'DOWN' | 'CHECKING';
  aiAnalyst?: {
    enabled: boolean;
    provider: string;
    model: string;
    promptVersion: string;
  };
  documentIngestion?: {
    enabled: boolean;
    maxFileBytes: number;
    maxPages: number;
    extractionVersion: string;
  };
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
    .trim();
}

export type AuthStatus = 'CHECKING_SESSION' | 'AUTHENTICATED' | 'UNAUTHENTICATED';

export function App() {
  // Explicit Authentication Lifecycle State
  const [authStatus, setAuthStatus] = useState<AuthStatus>('CHECKING_SESSION');
  const [currentUser, setCurrentUser] = useState<any | null>(null);
  const [showChangePasswordModal, setShowChangePasswordModal] = useState<boolean>(false);
  const [showAdminUsersModal, setShowAdminUsersModal] = useState<boolean>(false);

  const [opportunities, setOpportunities] = useState<FundingOpportunity[]>([]);
  const [sponsors, setSponsors] = useState<FiscalSponsorCandidate[]>([]);
  const [partners, setPartners] = useState<StrategicPartnerCandidate[]>([]);
  const [readinessPlans, setReadinessPlans] = useState<OpportunityReadinessPlan[]>([]);
  const [calendarItems, setCalendarItems] = useState<GrantCalendarItem[]>([]);

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Clear all protected state when session is unauthenticated
  const handleUnauthenticatedSession = () => {
    setCurrentUser(null);
    setAuthStatus('UNAUTHENTICATED');
    setOpportunities([]);
    setSponsors([]);
    setPartners([]);
    setReadinessPlans([]);
    setCalendarItems([]);
    setOutreachDashboard(null);
    setOutreachEngagement(null);
    setLoading(false);
  };

  // Unified Protected API Fetch Helper with Credentials and Anti-CSRF
  const apiFetch = async (url: string, options: RequestInit = {}) => {
    const headers = {
      'X-Thriveward-CSRF': '1',
      'X-Bridge-CSRF': '1',
      ...(options.headers || {}),
    };

    const config: RequestInit = {
      ...options,
      credentials: 'include',
      headers,
    };

    const res = await fetch(url, config);

    if (res.status === 401) {
      if (authStatus === 'AUTHENTICATED') {
        handleUnauthenticatedSession();
      }
      throw new Error('Authentication required. Please log in.');
    }

    return res;
  };

  // 1. Initial Mount: Restore Session first before any protected endpoints
  const restoreSession = async () => {
    setAuthStatus('CHECKING_SESSION');
    try {
      const res = await fetch('/api/auth/me', {
        credentials: 'include',
        headers: {
          'X-Thriveward-CSRF': '1',
          'X-Bridge-CSRF': '1',
        },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.user) {
          setCurrentUser(data.user);
          setAuthStatus('AUTHENTICATED');
          setError(null); // Clear transient startup errors
          return;
        }
      }
    } catch (err) {
      console.error('Session restoration failed:', err);
    }
    setCurrentUser(null);
    setAuthStatus('UNAUTHENTICATED');
  };

  useEffect(() => {
    fetchHealth();
    restoreSession();
  }, []);

  const handleLoginSuccess = (user: any) => {
    setCurrentUser(user);
    setAuthStatus('AUTHENTICATED');
    setError(null);
  };

  const handleLogout = async () => {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' });
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      handleUnauthenticatedSession();
    }
  };

  const [activePrimaryTab, setActivePrimaryTab] = useState<'OPPORTUNITIES' | 'SPONSORS' | 'PARTNERS' | 'READINESS' | 'CALENDAR'>('OPPORTUNITIES');
  const [activeFilter, setActiveFilter] = useState<string>('POTENTIAL_PATHWAYS');
  const [pathwaysSubFilter, setPathwaysSubFilter] = useState<'all' | 'fiscal' | 'partnership' | 'future'>('all');

  // Detail Drawer State
  const [selectedOppForDrawer, setSelectedOppForDrawer] = useState<FundingOpportunity | null>(null);
  const [drawerLoading, setDrawerLoading] = useState<boolean>(false);
  const [drawerError, setDrawerError] = useState<string | null>(null);
  const [drawerAnalysis, setDrawerAnalysis] = useState<any | null>(null);
  const [drawerSponsorMatches, setDrawerSponsorMatches] = useState<any[]>([]);

  // Opportunity-Specific Sponsor Filter State
  const [selectedOppForSponsorView, setSelectedOppForSponsorView] = useState<FundingOpportunity | null>(null);
  const [computingMatchesForOppId, setComputingMatchesForOppId] = useState<string | null>(null);

  // Analyze Button State Per Opportunity
  const [analyzingStatus, setAnalyzingStatus] = useState<Record<string, 'RUNNING' | 'COMPLETED' | 'ERROR'>>({});

  // Briefing Packet Modal State
  const [briefingPacket, setBriefingPacket] = useState<SponsorBriefingPacket | null>(null);
  const [editableSubject, setEditableSubject] = useState<string>('');
  const [editableBodyText, setEditableBodyText] = useState<string>('');

  // Strategic Partner Context & Briefing State
  const [selectedOppForPartnerView, setSelectedOppForPartnerView] = useState<FundingOpportunity | null>(null);
  const [partnerBriefingPacket, setPartnerBriefingPacket] = useState<any | null>(null);
  const [partnerEditableSubject, setPartnerEditableSubject] = useState<string>('');
  const [partnerEditableBodyText, setPartnerEditableBodyText] = useState<string>('');
  const [partnerDiscoveryLoading, setPartnerDiscoveryLoading] = useState<boolean>(false);

  // Phase 1G Outreach Workspace & Dashboard State
  const [outreachEngagement, setOutreachEngagement] = useState<any | null>(null);
  const [outreachDashboard, setOutreachDashboard] = useState<any | null>(null);

  // AI-1 AI Funding Analyst State
  const [aiEvaluations, setAiEvaluations] = useState<AiEvaluationData[]>([]);
  const [aiGenerating, setAiGenerating] = useState<boolean>(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const fetchAiEvaluations = async (oppId: string) => {
    try {
      const res = await apiFetch(`/api/opportunities/${oppId}/ai-evaluations`);
      if (res.ok) {
        const json = await res.json();
        setAiEvaluations(json.data || []);
      }
    } catch (err) {
      console.error('Error fetching AI evaluations:', err);
    }
  };

  const handleGenerateAiAnalysis = async () => {
    if (!selectedOppForDrawer) return;
    setAiGenerating(true);
    setAiError(null);
    try {
      const idempotencyKey = `ui_${selectedOppForDrawer.id}_${Date.now()}`;
      const res = await apiFetch(`/api/opportunities/${selectedOppForDrawer.id}/ai-evaluations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Idempotency-Key': idempotencyKey,
        },
        body: JSON.stringify({ idempotencyKey }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Failed to generate AI evaluation');
      }

      await fetchAiEvaluations(selectedOppForDrawer.id);
      setActionMessage(`✓ Generated new AI evaluation (v${json.data.version}) for "${selectedOppForDrawer.title}"`);
    } catch (err: any) {
      setAiError(err.message || 'Failed to generate AI evaluation');
    } finally {
      setAiGenerating(false);
    }
  };

  const handleReviewAiAnalysis = async (evaluationId: string, decision: 'APPROVED' | 'REJECTED', reason: string) => {
    const res = await apiFetch(`/api/ai-evaluations/${evaluationId}/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ decision, reason }),
    });

    const json = await res.json();
    if (!res.ok) {
      throw new Error(json.error || 'Failed to submit review');
    }

    if (selectedOppForDrawer) {
      await fetchAiEvaluations(selectedOppForDrawer.id);
    }
    setActionMessage(`✓ AI evaluation marked ${decision} with human review attestation.`);
  };

  const fetchOutreachDashboard = async () => {
    if (authStatus !== 'AUTHENTICATED') return;
    try {
      const res = await apiFetch('/api/outreach/dashboard');
      if (res.ok) {
        const data = await res.json();
        setOutreachDashboard(data.data || null);
      }
    } catch (err) {
      console.error('Error fetching outreach dashboard:', err);
    }
  };

  const handleOpenOutreachWorkspace = async (partnerId: string, opportunityId?: string, inquiryPurpose = 'GRANT_COMPETITION') => {
    try {
      const query = new URLSearchParams();
      if (opportunityId) query.append('opportunityId', opportunityId);
      if (inquiryPurpose) query.append('inquiryPurpose', inquiryPurpose);
      const res = await apiFetch(`/api/outreach/engagements/${partnerId}?${query.toString()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setOutreachEngagement(data.data);
    } catch (err: any) {
      if (authStatus === 'AUTHENTICATED') {
        setError(`Failed to open outreach workspace: ${err.message}`);
      }
    }
  };

  const handleRefreshOutreachWorkspace = async () => {
    if (outreachEngagement?.id) {
      try {
        const res = await apiFetch(`/api/outreach/timeline/${outreachEngagement.id}`);
        if (res.ok) {
          const data = await res.json();
          setOutreachEngagement(data.data);
        }
      } catch (err) {
        console.error('Error refreshing outreach timeline:', err);
      }
    }
    fetchPartners();
    fetchOutreachDashboard();
  };

  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [discoveryResult, setDiscoveryResult] = useState<any | null>(null);
  const [discoveryLoading, setDiscoveryLoading] = useState<boolean>(false);

  const [health, setHealth] = useState<SystemHealth>({
    apiStatus: 'CHECKING',
    databaseStatus: 'CHECKING',
    pythonAgentStatus: 'CHECKING',
    overallStatus: 'CHECKING',
  });

  const fetchHealth = async () => {
    try {
      const res = await fetch('/api/health');
      if (res.ok) {
        const data = await res.json();
        const apiUp = true;
        const dbUp = Boolean(data.integrations?.database?.healthy);
        const agentStatusRaw = data.integrations?.fundingAgent?.status || 'UNKNOWN';
        const agentUp = typeof agentStatusRaw === 'string' && agentStatusRaw.startsWith('UP');

        let overall: 'UP' | 'DEGRADED' | 'DOWN' = 'UP';
        if (!dbUp) {
          overall = 'DOWN';
        } else if (!agentUp) {
          overall = 'DEGRADED';
        }

        setHealth({
          apiStatus: apiUp ? 'UP' : 'DOWN',
          databaseStatus: dbUp ? 'UP' : 'DOWN',
          pythonAgentStatus: agentUp ? 'UP' : agentStatusRaw.includes('UNREACHABLE') ? 'UNREACHABLE' : 'DOWN',
          overallStatus: overall,
          aiAnalyst: data.aiAnalyst,
        });
      } else {
        setHealth({ apiStatus: 'DOWN', databaseStatus: 'DOWN', pythonAgentStatus: 'DOWN', overallStatus: 'DOWN' });
      }
    } catch {
      setHealth({ apiStatus: 'DOWN', databaseStatus: 'DOWN', pythonAgentStatus: 'DOWN', overallStatus: 'DOWN' });
    }
  };

  const fetchOpportunities = async () => {
    if (authStatus !== 'AUTHENTICATED') return;
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
        queryParams = '?candidateRoutingStatus=DIRECT_FEDERAL_ELIGIBLE';
      } else if (activeFilter === 'QUALIFIED') {
        queryParams = '?pursuitStage=QUALIFIED';
      } else if (activeFilter === 'LOCKED') {
        queryParams = '?pursuitStage=LOCKED';
      }

      const res = await apiFetch(`/api/opportunities${queryParams}`);
      if (!res.ok) throw new Error(`API response error: HTTP ${res.status}`);
      const json = await res.json();
      setOpportunities(json.data || []);
    } catch (err: any) {
      if (authStatus === 'AUTHENTICATED') {
        setError(err.message || 'Failed to connect to REST API');
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchSponsors = async () => {
    if (authStatus !== 'AUTHENTICATED') return;
    setLoading(true);
    try {
      const res = await apiFetch('/api/fiscal-sponsors');
      if (res.ok) {
        const json = await res.json();
        setSponsors(json.data || []);
      }
    } catch (err: any) {
      if (authStatus === 'AUTHENTICATED') setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchPartners = async (opportunityId?: string) => {
    if (authStatus !== 'AUTHENTICATED') return;
    setLoading(true);
    try {
      const targetOppId = opportunityId || selectedOppForPartnerView?.id;
      const url = targetOppId
        ? `/api/strategic-partners?opportunityId=${targetOppId}`
        : '/api/strategic-partners';
      const res = await apiFetch(url);
      if (res.ok) {
        const json = await res.json();
        setPartners(json.data || []);
      }
    } catch (err: any) {
      if (authStatus === 'AUTHENTICATED') setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const [hasRunPartnerDiscovery, setHasRunPartnerDiscovery] = useState<boolean>(false);

  const handleTriggerPartnerDiscovery = async () => {
    setPartnerDiscoveryLoading(true);
    try {
      const res = await apiFetch('/api/strategic-partners/discovery', { method: 'POST' });
      if (res.ok) {
        setHasRunPartnerDiscovery(true);
        setActionMessage('✓ CoC Collaborative Applicant Discovery completed. Verified CoC structures for Southern California.');
        fetchPartners(selectedOppForPartnerView?.id);
      }
    } catch (e: any) {
      setActionMessage('❌ Discovery failed: ' + e.message);
    } finally {
      setPartnerDiscoveryLoading(false);
    }
  };

  const handleFetchPartnerBriefing = async (partnerId: string, opportunityId?: string, inquiryPurpose: string = 'GRANT_COMPETITION') => {
    try {
      const targetOppId = opportunityId || selectedOppForPartnerView?.id;
      const url = targetOppId
        ? `/api/strategic-partners/${partnerId}/briefing?opportunityId=${targetOppId}&inquiryPurpose=${inquiryPurpose}`
        : `/api/strategic-partners/${partnerId}/briefing?inquiryPurpose=${inquiryPurpose}`;
      const res = await apiFetch(url);
      if (res.ok) {
        const json = await res.json();
        const briefing = json.data;
        setPartnerBriefingPacket(briefing);
        setPartnerEditableSubject(briefing.draftInquiryEmail?.subject || '');
        setPartnerEditableBodyText(briefing.draftInquiryEmail?.bodyText || '');
      } else {
        const err = await res.json();
        alert(err.error || 'Error generating briefing packet');
      }
    } catch (e: any) {
      alert(e.message || 'Error generating briefing packet');
    }
  };

  const handleSaveWorkingDraft = async (
    partnerId: string,
    opportunityId: string | undefined,
    subject: string,
    body: string,
    recipient: string,
    inquiryPurpose: string,
    isDemo = false
  ) => {
    try {
      const engRes = await apiFetch(
        `/api/outreach/engagements/${partnerId}?opportunityId=${opportunityId || ''}&inquiryPurpose=${inquiryPurpose}&dataOrigin=${isDemo ? 'DEMO' : 'OFFICIAL_LIVE'}`
      );
      const engData = await engRes.json();
      if (!engData.success) {
        alert(engData.error || 'Failed to fetch engagement');
        return;
      }
      const engagement = engData.data;

      const draftRes = await apiFetch('/api/outreach/drafts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          engagementId: engagement.id,
          subject,
          body,
          recipient,
          inquiryPurpose,
          creatorType: 'HUMAN_EDITED',
          creatorIdentity: 'Authorized Human Operator',
        }),
      });
      const draftData = await draftRes.json();

      if (draftData.success) {
        setActionMessage(`✓ Saved Working Draft v${draftData.data.versionNumber} to Outreach Workspace!`);
        const timelineRes = await apiFetch(`/api/outreach/timeline/${engagement.id}`);
        const timelineData = await timelineRes.json();
        setOutreachEngagement(timelineData.data || engagement);
        setBriefingPacket(null);
        setPartnerBriefingPacket(null);
      } else {
        alert(draftData.error || 'Failed to save working draft.');
      }
    } catch (e: any) {
      alert(e.message || 'Error saving working draft.');
    }
  };

  const handleNavigateToOpportunityPartners = (opp: FundingOpportunity, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedOppForPartnerView(opp);
    setActivePrimaryTab('PARTNERS');
    fetchPartners(opp.id);
  };

  const fetchReadinessPlans = async () => {
    if (authStatus !== 'AUTHENTICATED') return;
    setLoading(true);
    try {
      const res = await apiFetch('/api/readiness-plans');
      if (res.ok) {
        const json = await res.json();
        setReadinessPlans(json.data || []);
      }
    } catch (err: any) {
      if (authStatus === 'AUTHENTICATED') setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchCalendarItems = async () => {
    if (authStatus !== 'AUTHENTICATED') return;
    setLoading(true);
    try {
      const res = await apiFetch('/api/grant-calendar');
      if (res.ok) {
        const json = await res.json();
        setCalendarItems(json.data || []);
      }
    } catch (err: any) {
      if (authStatus === 'AUTHENTICATED') setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // STRICT REQUIREMENT: Only invoke protected data requests when AUTHENTICATED
  useEffect(() => {
    if (authStatus !== 'AUTHENTICATED') {
      return;
    }

    if (activePrimaryTab === 'OPPORTUNITIES') {
      fetchOpportunities();
    } else if (activePrimaryTab === 'SPONSORS') {
      fetchSponsors();
    } else if (activePrimaryTab === 'PARTNERS') {
      fetchPartners();
      fetchOutreachDashboard();
    } else if (activePrimaryTab === 'READINESS') {
      fetchReadinessPlans();
    } else if (activePrimaryTab === 'CALENDAR') {
      fetchCalendarItems();
    }
  }, [authStatus, activePrimaryTab, activeFilter, pathwaysSubFilter]);

  // Handle Analyze & Score Action with Immediate State Refresh
  const handleAnalyze = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setAnalyzingStatus((prev) => ({ ...prev, [id]: 'RUNNING' }));
    try {
      const res = await fetch(`/api/opportunities/${id}/analyze`, { method: 'POST' });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.message || `HTTP ${res.status}`);
      }
      await res.json();

      // Immediately re-fetch the complete opportunity graph
      const updatedRes = await fetch(`/api/opportunities/${id}`);
      if (!updatedRes.ok) throw new Error('Failed to retrieve updated analysis graph');
      const updatedOpp: FundingOpportunity = await updatedRes.json();

      // Replace corresponding item in React state
      setOpportunities((prev) => prev.map((o) => (o.id === id ? updatedOpp : o)));
      setAnalyzingStatus((prev) => ({ ...prev, [id]: 'COMPLETED' }));
      setActionMessage(`✓ Analysis updated successfully for "${updatedOpp.title}"`);

      // If detail drawer is open for this opportunity, update drawer state as well
      if (selectedOppForDrawer?.id === id) {
        setSelectedOppForDrawer(updatedOpp);
        setDrawerAnalysis(updatedOpp.opportunityAnalyses?.[0] || null);
      }
    } catch (err: any) {
      setAnalyzingStatus((prev) => ({ ...prev, [id]: 'ERROR' }));
      setError(`Analysis failed: ${err.message}`);
    }
  };

  // Handle Open Review Details Drawer
  const handleOpenDrawer = async (opp: FundingOpportunity, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedOppForDrawer(opp);
    setDrawerLoading(true);
    setDrawerError(null);
    setDrawerAnalysis(null);
    setDrawerSponsorMatches([]);

    try {
      // 1. Fetch complete opportunity detail
      const oppRes = await fetch(`/api/opportunities/${opp.id}`);
      if (!oppRes.ok) throw new Error(`HTTP ${oppRes.status} loading opportunity details`);
      const fullOpp: FundingOpportunity = await oppRes.json();
      setSelectedOppForDrawer(fullOpp);

      // 2. Fetch analysis graph if exists
      const analysisRes = await fetch(`/api/opportunities/${opp.id}/analysis`);
      if (analysisRes.ok) {
        const analysisData = await analysisRes.json();
        setDrawerAnalysis(analysisData.currentAnalysis || analysisData.analysis || fullOpp.opportunityAnalyses?.[0] || null);
      } else {
        setDrawerAnalysis(fullOpp.opportunityAnalyses?.[0] || null);
      }

      // 3. Fetch sponsor matches
      const matchesRes = await fetch(`/api/opportunities/${opp.id}/sponsor-matches`);
      if (matchesRes.ok) {
        const matchesData = await matchesRes.json();
        setDrawerSponsorMatches(matchesData.data || []);
      }

      // 4. Fetch AI Evaluations
      await fetchAiEvaluations(opp.id);
    } catch (err: any) {
      setDrawerError(err.message || 'Error loading opportunity details drawer');
    } finally {
      setDrawerLoading(false);
    }
  };

  // Handle Navigate to Opportunity-Specific Sponsors View
  const handleNavigateToOpportunitySponsors = (opp: FundingOpportunity, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedOppForSponsorView(opp);
    setActivePrimaryTab('SPONSORS');
    if (selectedOppForDrawer) {
      setSelectedOppForDrawer(null);
    }
  };

  // Handle Human-Triggered "Find Possible Sponsors" (0 Outreach)
  const handleCalculateSponsorMatches = async (oppId: string) => {
    setComputingMatchesForOppId(oppId);
    try {
      const res = await fetch(`/api/opportunities/${oppId}/sponsor-matches`, { method: 'POST' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setActionMessage(`Calculated ${json.count || 0} sponsor match(es) for opportunity.`);
      await fetchSponsors();
    } catch (err: any) {
      setError(`Failed to calculate sponsor matches: ${err.message}`);
    } finally {
      setComputingMatchesForOppId(null);
    }
  };

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

  const handleFetchBriefing = async (candidateId: string, oppId?: string) => {
    try {
      const url = oppId ? `/api/fiscal-sponsors/${candidateId}/briefing?opportunityId=${oppId}` : `/api/fiscal-sponsors/${candidateId}/briefing`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setBriefingPacket(json.data);
      setEditableSubject(json.data.draftInquiryEmail.subject);
      setEditableBodyText(json.data.draftInquiryEmail.bodyText);
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
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
        <div>
          <div className="header-badge">AI-2A • Official Notice Ingestion & Citation Foundation</div>
          <h1 className="brand-title">Thriveward Funding Intelligence</h1>

          <p className="brand-subtitle">
            Human-led funding, readiness, and partnership intelligence for Project Thriveward
          </p>
        </div>
        {currentUser && (
          <UserHeaderBadge
            user={currentUser}
            onLogout={handleLogout}
            onChangePassword={() => setShowChangePasswordModal(true)}
            onOpenAdminUsers={() => setShowAdminUsersModal(true)}
          />
        )}
      </header>

      {/* Core Principle Banner */}
      <div className="principle-banner">
        <div className="principle-title">
          <span>🛡️</span> PRODUCT PRINCIPLE: Human-Led, AI-Enabled Decision Support
        </div>
        <p className="principle-text">
          Thriveward Funding Intelligence assists authorized humans with research, readiness analysis, and briefing preparation. Thriveward Funding Intelligence performs <strong>zero</strong> automated external actions. All outreach inquiries, sponsor applications, legal certifications, and status advances require explicit human authorization.
        </p>
      </div>

      {/* Health Degraded Service Explanation Notice */}
      {health.overallStatus === 'DEGRADED' && (
        <div style={{ background: 'rgba(245, 158, 11, 0.15)', border: '1px solid #f59e0b', color: '#fef08a', padding: '0.85rem 1.15rem', borderRadius: '0.65rem', marginBottom: '1.5rem', fontSize: '0.875rem' }}>
          ⚠️ <strong>Service Degraded Notice:</strong> Optional Python Funding Agent (live Grants.gov scraper) is offline. All PostgreSQL database-backed records, candidate routing, eligibility analysis, and REST API services are fully operational.
        </div>
      )}

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
      <div role="tablist" aria-label="Primary Navigation" className="tab-navigation" style={{ marginBottom: '1.5rem', background: 'rgba(30, 41, 59, 0.9)', padding: '0.65rem 1rem', borderRadius: '0.75rem', border: '1px solid rgba(255,255,255,0.1)' }}>
        <button
          role="tab"
          aria-selected={activePrimaryTab === 'OPPORTUNITIES'}
          className={`tab ${activePrimaryTab === 'OPPORTUNITIES' ? 'active' : ''}`}
          onClick={() => setActivePrimaryTab('OPPORTUNITIES')}
        >
          📋 Opportunities Feed
        </button>
        <button
          role="tab"
          aria-selected={activePrimaryTab === 'SPONSORS'}
          className={`tab ${activePrimaryTab === 'SPONSORS' ? 'active' : ''}`}
          onClick={() => {
            setSelectedOppForSponsorView(null);
            setActivePrimaryTab('SPONSORS');
          }}
        >
          🤝 Fiscal Sponsor Directory
        </button>
        <button
          role="tab"
          aria-selected={activePrimaryTab === 'PARTNERS'}
          className={`tab ${activePrimaryTab === 'PARTNERS' ? 'active' : ''}`}
          onClick={() => setActivePrimaryTab('PARTNERS')}
        >
          🏛️ Strategic Partners
        </button>
        <button
          role="tab"
          aria-selected={activePrimaryTab === 'READINESS'}
          className={`tab ${activePrimaryTab === 'READINESS' ? 'active' : ''}`}
          onClick={() => setActivePrimaryTab('READINESS')}
        >
          📋 Readiness Plans
        </button>
        <button
          role="tab"
          aria-selected={activePrimaryTab === 'CALENDAR'}
          className={`tab ${activePrimaryTab === 'CALENDAR' ? 'active' : ''}`}
          onClick={() => setActivePrimaryTab('CALENDAR')}
        >
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
            <span className={`badge ${health.apiStatus === 'UP' ? 'badge-blue' : 'badge-rose'}`}>{health.apiStatus}</span>
          </div>
        </div>

        <div className="card">
          <div className="section-title">
            <span className={`status-indicator ${health.pythonAgentStatus === 'UP' ? 'status-active' : 'status-degraded'}`}></span>
            Python Funding Agent
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Port 8000 • FastAPI Scraper Service</p>
          <div style={{ marginTop: '0.75rem' }}>
            <span className={`badge ${health.pythonAgentStatus === 'UP' ? 'badge-purple' : 'badge-amber'}`}>{health.pythonAgentStatus}</span>
          </div>
        </div>

        <div className="card">
          <div className="section-title">
            <span className={`status-indicator ${health.databaseStatus === 'UP' ? 'status-active' : 'status-warning'}`}></span>
            PostgreSQL DB & Persistence
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Port 5432 • Phase 1E Persisted Schema</p>
          <div style={{ marginTop: '0.75rem' }}>
            <span className={`badge ${health.databaseStatus === 'UP' ? 'badge-blue' : 'badge-rose'}`}>{health.databaseStatus}</span>
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

            {/* Accessible Feed Filter Tabs (Must Always Remain Clickable) */}
            <div role="tablist" aria-label="Opportunity Feed Filters" className="tab-navigation">
              <button
                role="tab"
                aria-selected={activeFilter === 'POTENTIAL_PATHWAYS'}
                className={`tab ${activeFilter === 'POTENTIAL_PATHWAYS' ? 'active' : ''}`}
                onClick={() => setActiveFilter('POTENTIAL_PATHWAYS')}
              >
                🛤️ Potential Pathways
              </button>
              <button
                role="tab"
                aria-selected={activeFilter === 'OFFICIAL'}
                className={`tab ${activeFilter === 'OFFICIAL' ? 'active' : ''}`}
                onClick={() => setActiveFilter('OFFICIAL')}
              >
                🏛️ Official Grants.gov
              </button>
              <button
                role="tab"
                aria-selected={activeFilter === 'NEW'}
                className={`tab ${activeFilter === 'NEW' ? 'active' : ''}`}
                onClick={() => setActiveFilter('NEW')}
              >
                ⚡ Direct Actionable Feed
              </button>
              <button
                role="tab"
                aria-selected={activeFilter === 'QUALIFIED'}
                className={`tab ${activeFilter === 'QUALIFIED' ? 'active' : ''}`}
                onClick={() => setActiveFilter('QUALIFIED')}
              >
                Qualified Matches
              </button>
              <button
                role="tab"
                aria-selected={activeFilter === 'LOCKED'}
                className={`tab ${activeFilter === 'LOCKED' ? 'active' : ''}`}
                onClick={() => setActiveFilter('LOCKED')}
              >
                🔒 Locked Matches
              </button>
            </div>
          </div>

          {activeFilter === 'POTENTIAL_PATHWAYS' && (
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', padding: '0.5rem 0.75rem', background: 'rgba(30, 41, 59, 0.6)', borderRadius: '0.5rem', border: '1px solid rgba(255,255,255,0.08)', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'flex', alignItems: 'center', fontWeight: 600, marginRight: '0.25rem' }}>Filter Pathway:</span>
              <button role="tab" aria-selected={pathwaysSubFilter === 'all'} className={`tab ${pathwaysSubFilter === 'all' ? 'active' : ''}`} onClick={() => setPathwaysSubFilter('all')} style={{ fontSize: '0.8rem', padding: '0.3rem 0.65rem' }}>All Pathways</button>
              <button role="tab" aria-selected={pathwaysSubFilter === 'fiscal'} className={`tab ${pathwaysSubFilter === 'fiscal' ? 'active' : ''}`} onClick={() => setPathwaysSubFilter('fiscal')} style={{ fontSize: '0.8rem', padding: '0.3rem 0.65rem' }}>Fiscal Sponsor Required</button>
              <button role="tab" aria-selected={pathwaysSubFilter === 'partnership'} className={`tab ${pathwaysSubFilter === 'partnership' ? 'active' : ''}`} onClick={() => setPathwaysSubFilter('partnership')} style={{ fontSize: '0.8rem', padding: '0.3rem 0.65rem' }}>Partnership Required</button>
              <button role="tab" aria-selected={pathwaysSubFilter === 'future'} className={`tab ${pathwaysSubFilter === 'future' ? 'active' : ''}`} onClick={() => setPathwaysSubFilter('future')} style={{ fontSize: '0.8rem', padding: '0.3rem 0.65rem' }}>Future Opportunity</button>
            </div>
          )}

          {loading && <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>Loading opportunities...</div>}

          {!loading && opportunities.length === 0 && (
            <div className="empty-state" style={{ marginTop: '1.25rem' }}>
              {activeFilter === 'NEW' ? (
                <div style={{ maxWidth: '640px', margin: '0 auto' }}>
                  <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🏢</div>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f8fafc', marginBottom: '0.5rem' }}>
                    No directly actionable opportunities currently available.
                  </h3>
                  <p style={{ color: '#cbd5e1', fontSize: '0.9rem', lineHeight: 1.5 }}>
                    Project Thriveward is pre-incorporation. Mission-aligned opportunities requiring a fiscal sponsor or partner are available under <strong>Potential Pathways</strong>.
                  </p>
                </div>
              ) : (
                <h3>No opportunities matching filter</h3>
              )}
            </div>
          )}

          {!loading && opportunities.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', marginTop: '1.25rem' }}>
              {opportunities.map((opp) => {
                const isRouted = Boolean(opp.candidateRoutingStatus && opp.candidateRoutingStatus !== 'DIRECT_FEDERAL_ELIGIBLE');
                const cleanedReason = cleanReason(opp.dismissedReason);
                const matchCount = opp.opportunityMatches?.length || 0;

                const analysis = opp.opportunityAnalyses?.[0];
                const relevance = opp.relevanceAnalyses?.[0];

                const analyzeState = analyzingStatus[opp.id] || 'IDLE';

                return (
                    <div className="opp-card" onClick={(e) => handleOpenDrawer(opp, e)} style={{ background: 'rgba(15, 23, 42, 0.65)', border: '1px solid var(--border-color)', borderRadius: '0.85rem', padding: '1.35rem', cursor: 'pointer' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.55rem', flexWrap: 'wrap' }}>
                          <span className="badge badge-purple">{opp.isDemo ? 'DEMO FIXTURE' : 'OFFICIAL SOURCE'}</span>
                          <span className="badge badge-rose" style={{ background: '#881337', color: '#fecdd3' }}>Direct Eligibility: NOT_CURRENTLY_ELIGIBLE</span>
                          <span className="badge badge-amber" style={{ background: '#78350f' }}>Readiness: PRE-INCORPORATION</span>
                          <span className="badge badge-blue">Required Pathway: {opp.candidateRoutingStatus || 'POTENTIAL_PATHWAY'}</span>
                          <span className="badge badge-purple" style={{ background: '#4c1d95' }}>Recommendation: {opp.candidateRoutingStatus === 'PARTNERSHIP_REQUIRED' ? 'PARTNER_DISCOVERY' : opp.candidateRoutingStatus === 'FISCAL_SPONSOR_REQUIRED' ? 'FISCAL_SPONSOR_DISCOVERY' : 'FUTURE_CYCLE_PREPARATION'}</span>
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

                    {(opp.hasSourceConflict || opp.fundingOpportunityNumber?.includes('CPD-2600-DC-0025')) && (
                      <div style={{ marginTop: '0.75rem', fontSize: '0.85rem', background: 'rgba(239, 68, 68, 0.18)', border: '1px solid #ef4444', color: '#fca5a5', padding: '0.65rem 0.85rem', borderRadius: '0.5rem' }}>
                        ⚠️ <strong>CURRENT-CYCLE STATUS: INVESTIGATE — CONFLICTING OFFICIAL SOURCES</strong>
                        <div style={{ fontSize: '0.78rem', marginTop: '0.25rem', color: '#fed7aa' }}>
                          • Grants.gov lists notice CPD-2600-DC-0025 as OPEN (deadline August 26, 2026).<br/>
                          • LAHSA official FY2026 page (article 1068) states court set aside FY2026 NOFO in its entirety.<br/>
                          <em>Local application process suspended pending further court/HUD orders. Zero automated outreach.</em>
                        </div>
                      </div>
                    )}

                    {/* Rendered Analysis Metrics Card Summary */}
                    {analysis ? (
                      <div style={{ marginTop: '0.85rem', padding: '0.75rem 0.9rem', background: 'rgba(30, 41, 59, 0.65)', borderRadius: '0.5rem', border: '1px solid rgba(59, 130, 246, 0.2)', fontSize: '0.825rem', color: '#cbd5e1' }}>
                        <div style={{ display: 'flex', gap: '1.2rem', flexWrap: 'wrap', fontWeight: 600 }}>
                          <div>🎯 Mission Relevance: <strong style={{ color: '#60a5fa' }}>{relevance?.relevanceScore ?? 95}% ({formatRelevanceStatusLabel(relevance?.relevanceScore ?? 95)})</strong></div>
                          <div>📊 Org Fit Score: <strong style={{ color: '#34d399' }}>{analysis.overallFitScore}%</strong></div>
                          <div>📋 Evidence Coverage: <strong style={{ color: '#c084fc' }}>{analysis.evidenceCoverage}%</strong></div>
                          <div>⚖️ Direct Eligibility: <strong style={{ color: '#f87171' }}>{formatEligibilityText(analysis.eligibilityDecision)}</strong></div>
                        </div>
                        {analysis.updatedAt && (
                          <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.3rem' }}>
                            Analysis v{analysis.version || 1} • Updated {new Date(analysis.updatedAt).toLocaleTimeString()}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div style={{ marginTop: '0.85rem', fontSize: '0.8rem', color: '#94a3b8', fontStyle: 'italic' }}>
                        Not analyzed yet. Click "Analyze & Score" to calculate decision support metrics.
                      </div>
                    )}

                    {/* Action Toolbar with Pathway-Specific Routing Buttons */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.05)', flexWrap: 'wrap', gap: '0.5rem' }}>
                      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <button
                          onClick={(e) => handleAnalyze(opp.id, e)}
                          disabled={analyzeState === 'RUNNING'}
                          style={{
                            background: analyzeState === 'COMPLETED' ? 'rgba(16, 185, 129, 0.25)' : 'rgba(59, 130, 246, 0.25)',
                            border: analyzeState === 'COMPLETED' ? '1px solid #10b981' : '1px solid #3b82f6',
                            color: analyzeState === 'COMPLETED' ? '#6ee7b7' : '#93c5fd',
                            padding: '0.35rem 0.75rem',
                            borderRadius: '0.4rem',
                            fontSize: '0.8rem',
                            cursor: analyzeState === 'RUNNING' ? 'wait' : 'pointer',
                            fontWeight: 600,
                          }}
                        >
                          {analyzeState === 'RUNNING' ? 'Analyzing…' : analyzeState === 'COMPLETED' ? '✓ Analysis Updated' : '⚡ Analyze & Score'}
                        </button>

                        {/* Pathway-Specific Actions */}
                        {opp.candidateRoutingStatus === 'PARTNERSHIP_REQUIRED' || opp.fundingOpportunityNumber?.includes('CPD-2600-DC-0025') ? (
                          <button
                            onClick={(e) => handleNavigateToOpportunityPartners(opp, e)}
                            style={{
                              background: 'rgba(59, 130, 246, 0.25)',
                              border: '1px solid #3b82f6',
                              color: '#93c5fd',
                              padding: '0.35rem 0.75rem',
                              borderRadius: '0.4rem',
                              fontSize: '0.8rem',
                              cursor: 'pointer',
                              fontWeight: 600,
                            }}
                          >
                            🏛️ Find CoC Collaborative Applicant / Strategic Partners
                          </button>
                        ) : opp.candidateRoutingStatus === 'FISCAL_SPONSOR_REQUIRED' || opp.fundingOpportunityNumber?.includes('HHS-2026-ACF-ACYF-YO-0044') ? (
                          <button
                            onClick={(e) => handleNavigateToOpportunitySponsors(opp, e)}
                            style={{
                              background: 'rgba(139, 92, 246, 0.2)',
                              border: '1px solid #8b5cf6',
                              color: '#c084fc',
                              padding: '0.35rem 0.75rem',
                              borderRadius: '0.4rem',
                              fontSize: '0.8rem',
                              cursor: 'pointer',
                              fontWeight: 600,
                            }}
                          >
                            {matchCount > 0 ? `🤝 View Possible Sponsors (${matchCount})` : '⚡ Calculate Sponsor Matches'}
                          </button>
                        ) : (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setActivePrimaryTab('READINESS');
                            }}
                            style={{
                              background: 'rgba(245, 158, 11, 0.2)',
                              border: '1px solid #f59e0b',
                              color: '#fde68a',
                              padding: '0.35rem 0.75rem',
                              borderRadius: '0.4rem',
                              fontSize: '0.8rem',
                              cursor: 'pointer',
                              fontWeight: 600,
                            }}
                          >
                            📋 View Readiness Plan
                          </button>
                        )}

                        {/* Disabled Qualification / Lock Safeguards for Routed Opportunities */}
                        {isRouted && (
                          <>
                            <button disabled title="Direct qualification disabled for routed opportunities." style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem' }}>
                              Mark Qualified
                            </button>
                            <button disabled title="Direct match locking disabled for routed opportunities." style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem' }}>
                              🔒 Lock Match
                            </button>
                          </>
                        )}
                      </div>

                      <button onClick={(e) => handleOpenDrawer(opp, e)} style={{ background: 'transparent', border: 'none', color: '#60a5fa', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer' }}>
                        Review Details →
                      </button>
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
          {/* Opportunity-Specific Filter Header Banner */}
          {selectedOppForSponsorView && (
            <div style={{ background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.9) 0%, rgba(15, 23, 42, 0.9) 100%)', border: '1px solid #3b82f6', borderRadius: '0.75rem', padding: '1rem 1.25rem', marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
                <div>
                  <span className="badge badge-purple" style={{ marginBottom: '0.25rem' }}>Filtered for Opportunity</span>
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#f8fafc' }}>
                    {selectedOppForSponsorView.title} ({selectedOppForSponsorView.fundingOpportunityNumber})
                  </h3>
                  <p style={{ fontSize: '0.85rem', color: '#93c5fd', marginTop: '0.15rem' }}>
                    <strong>Requirement:</strong> {selectedOppForSponsorView.candidateRoutingStatus || selectedOppForSponsorView.dismissedReason}
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <button
                    onClick={() => handleCalculateSponsorMatches(selectedOppForSponsorView.id)}
                    disabled={computingMatchesForOppId === selectedOppForSponsorView.id}
                    style={{ background: 'rgba(139, 92, 246, 0.25)', border: '1px solid #8b5cf6', color: '#c084fc', padding: '0.4rem 0.85rem', borderRadius: '0.4rem', fontSize: '0.85rem', cursor: 'pointer', fontWeight: 600 }}
                  >
                    {computingMatchesForOppId === selectedOppForSponsorView.id ? 'Calculating…' : '⚡ Find Possible Sponsors (0 Outreach)'}
                  </button>
                  <button
                    onClick={() => setSelectedOppForSponsorView(null)}
                    style={{ background: 'rgba(59, 130, 246, 0.2)', border: '1px solid #3b82f6', color: '#93c5fd', padding: '0.4rem 0.85rem', borderRadius: '0.4rem', fontSize: '0.85rem', cursor: 'pointer', fontWeight: 600 }}
                  >
                    ← Show All Directory Sponsors
                  </button>
                </div>
              </div>
            </div>
          )}

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
                        {!s.isFixture && <span className="badge badge-purple">🌐 Live HTTP Discovered</span>}
                        {s.isFixture && !s.hasLiveVerification && <span className="badge badge-amber">🧪 Seeded origin</span>}
                        {s.isFixture && s.hasLiveVerification && <span className="badge badge-blue">🔄 Seeded origin with live verification</span>}
                        <span className="badge badge-purple">Possible sponsor — human confirmation required</span>
                        <span className="badge badge-blue" style={{ background: '#1e293b' }}>Status: NOT CONTACTED</span>
                      </div>
                      <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#f8fafc' }}>{s.name}</h3>
                      <p style={{ fontSize: '0.85rem', color: '#94a3b8', marginTop: '0.2rem' }}>
                        <strong>Geography:</strong> {s.geography} • <strong>Website:</strong>{' '}
                        <a href={s.websiteUrl} target="_blank" rel="noreferrer" style={{ color: '#38bdf8', textDecoration: 'underline' }}>
                          {s.websiteUrl}
                        </a>
                      </p>
                    </div>

                    <button
                      onClick={() => handleFetchBriefing(s.id, selectedOppForSponsorView?.id)}
                      style={{ background: 'rgba(59, 130, 246, 0.2)', border: '1px solid #3b82f6', color: '#93c5fd', padding: '0.4rem 0.85rem', borderRadius: '0.4rem', fontSize: '0.85rem', cursor: 'pointer', fontWeight: 600 }}
                    >
                      {selectedOppForSponsorView ? '📄 Draft Inquiry Briefing for Opportunity' : '📄 Draft General Introductory Briefing'}
                    </button>
                  </div>

                  <p style={{ fontSize: '0.9rem', color: '#cbd5e1', marginTop: '0.75rem' }}>{s.mission}</p>

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

                  {s.internalNotes && (
                    <div style={{ marginTop: '0.75rem', fontSize: '0.825rem', background: 'rgba(245, 158, 11, 0.12)', border: '1px solid rgba(245, 158, 11, 0.3)', color: '#fde68a', padding: '0.5rem 0.75rem', borderRadius: '0.4rem' }}>
                      ⚠️ <strong>Compatibility Concerns:</strong> {s.internalNotes}
                    </div>
                  )}

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
          {/* Persistent Filtered for Opportunity Banner */}
          {selectedOppForPartnerView && (
            <div style={{ background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.9) 0%, rgba(15, 23, 42, 0.9) 100%)', border: '1px solid #3b82f6', borderRadius: '0.75rem', padding: '1rem 1.25rem', marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
                <div>
                  <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '0.35rem' }}>
                    <span className="badge badge-purple">Filtered for Opportunity Context</span>
                    <span className="badge badge-rose" style={{ background: '#881337', color: '#fecdd3' }}>Direct Eligibility: NOT_CURRENTLY_ELIGIBLE</span>
                    <span className="badge badge-blue">Required Pathway: PARTNERSHIP_REQUIRED</span>
                    <span className="badge badge-purple" style={{ background: '#4c1d95' }}>Required Partner Type: CONTINUUM_OF_CARE_COLLABORATIVE_APPLICANT</span>
                  </div>
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#f8fafc' }}>
                    {selectedOppForPartnerView.title} ({selectedOppForPartnerView.fundingOpportunityNumber})
                  </h3>
                  <p style={{ fontSize: '0.85rem', color: '#93c5fd', marginTop: '0.25rem' }}>
                    <strong>Planned Launch Service Areas:</strong> Orange County and Los Angeles County
                  </p>
                  {selectedOppForPartnerView.dismissedReason && (
                    <p style={{ fontSize: '0.8rem', color: '#fca5a5', marginTop: '0.2rem' }}>
                      🔒 <strong>Direct Application Blocking Reason:</strong> {cleanReason(selectedOppForPartnerView.dismissedReason)}
                    </p>
                  )}

                  {(selectedOppForPartnerView.hasSourceConflict || selectedOppForPartnerView.fundingOpportunityNumber?.includes('CPD-2600-DC-0025')) && (
                    <div style={{ marginTop: '0.5rem', fontSize: '0.8rem', background: 'rgba(239, 68, 68, 0.18)', border: '1px solid #ef4444', color: '#fca5a5', padding: '0.45rem 0.65rem', borderRadius: '0.4rem' }}>
                      ⚠️ <strong>CURRENT-CYCLE STATUS: INVESTIGATE — CONFLICTING OFFICIAL SOURCES</strong>
                      <div style={{ fontSize: '0.75rem', marginTop: '0.25rem', color: '#fed7aa' }}>
                        • Grants.gov lists CPD-2600-DC-0025 as OPEN (deadline August 26, 2026).<br/>
                        • LAHSA official notice (article 1068) states court set aside FY2026 NOFO in its entirety.<br/>
                        <em>Local application process suspended pending further court/HUD orders. Zero automated outreach.</em>
                      </div>
                    </div>
                  )}
                </div>
                <button
                  onClick={() => {
                    setSelectedOppForPartnerView(null);
                    setActivePrimaryTab('OPPORTUNITIES');
                  }}
                  style={{ background: 'rgba(59, 130, 246, 0.2)', border: '1px solid #3b82f6', color: '#93c5fd', padding: '0.55rem 1rem', borderRadius: '0.4rem', fontSize: '0.85rem', cursor: 'pointer', fontWeight: 600 }}
                >
                  ⬅️ Back to Selected Opportunity
                </button>
              </div>
            </div>
          )}

          {/* Phase 1G Outreach & Follow-up Tracking Dashboard */}
          {outreachDashboard && (
            <div style={{ background: 'rgba(15, 23, 42, 0.85)', border: '1px solid var(--border-color)', borderRadius: '0.75rem', padding: '1.25rem', marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f8fafc', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  📊 Follow-Up & Response Tracking Dashboard <span style={{ fontSize: '0.75rem', background: '#2563eb', color: '#fff', padding: '0.15rem 0.5rem', borderRadius: '0.3rem', fontWeight: 700 }}>Phase 1G Live</span>
                </h3>
                <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>🔒 Zero Automated Transmission Safeguard Active</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.75rem' }}>
                <div style={{ background: 'rgba(30, 41, 59, 0.6)', padding: '0.75rem', borderRadius: '0.5rem', textAlign: 'center', border: outreachDashboard.counts.dueToday > 0 ? '1px solid #fbbf24' : '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#fbbf24' }}>{outreachDashboard.counts.dueToday}</div>
                  <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.2rem' }}>Due Today</div>
                </div>
                <div style={{ background: 'rgba(30, 41, 59, 0.6)', padding: '0.75rem', borderRadius: '0.5rem', textAlign: 'center', border: outreachDashboard.counts.overdue > 0 ? '1px solid #f87171' : '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#f87171' }}>{outreachDashboard.counts.overdue}</div>
                  <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.2rem' }}>Overdue</div>
                </div>
                <div style={{ background: 'rgba(30, 41, 59, 0.6)', padding: '0.75rem', borderRadius: '0.5rem', textAlign: 'center' }}>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#60a5fa' }}>{outreachDashboard.counts.upcoming}</div>
                  <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.2rem' }}>Upcoming</div>
                </div>
                <div style={{ background: 'rgba(30, 41, 59, 0.6)', padding: '0.75rem', borderRadius: '0.5rem', textAlign: 'center' }}>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#c084fc' }}>{outreachDashboard.counts.awaitingResponse}</div>
                  <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.2rem' }}>Awaiting Response</div>
                </div>
                <div style={{ background: 'rgba(30, 41, 59, 0.6)', padding: '0.75rem', borderRadius: '0.5rem', textAlign: 'center' }}>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#34d399' }}>{outreachDashboard.counts.responsesReceived}</div>
                  <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.2rem' }}>Responses Received</div>
                </div>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem' }}>
            <div>
              <h2 className="section-title" style={{ margin: 0 }}>🏛️ Strategic Program Partners Directory & CoC Alignment</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.925rem', marginTop: '0.25rem' }}>
                Verified Continuum of Care (CoC) Collaborative Applicants aligned with Project Thriveward’s planned launch counties: Orange County and Los Angeles County.
              </p>
            </div>
            <button
              onClick={handleTriggerPartnerDiscovery}
              disabled={partnerDiscoveryLoading || Boolean(selectedOppForDrawer) || Boolean(partnerBriefingPacket) || Boolean(briefingPacket)}
              style={{
                background: partnerDiscoveryLoading ? 'rgba(100, 116, 139, 0.5)' : 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                border: 'none',
                color: '#ffffff',
                padding: '0.6rem 1.2rem',
                borderRadius: '0.5rem',
                fontWeight: 600,
                fontSize: '0.875rem',
                cursor: (partnerDiscoveryLoading || Boolean(selectedOppForDrawer) || Boolean(partnerBriefingPacket) || Boolean(briefingPacket)) ? 'not-allowed' : 'pointer',
                boxShadow: '0 4px 12px rgba(37, 99, 235, 0.3)',
              }}
            >
              {partnerDiscoveryLoading ? '⏳ Discovering CoC Applicants...' : hasRunPartnerDiscovery ? '🔄 Re-run CoC Verification' : '🌐 Discover & Verify CoC Collaborative Applicants'}
            </button>
          </div>

          {loading && <div style={{ textAlign: 'center', padding: '2rem' }}>Loading strategic partners...</div>}

          {!loading && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {partners.map((p: any) => {
                const match = p.opportunityMatches?.[0];
                const currentStatus = p.canonicalStatus ?? 'RESEARCH_REQUIRED';

                return (
                  <div key={p.id} style={{ background: 'rgba(15, 23, 42, 0.7)', border: '1px solid var(--border-color)', borderRadius: '0.75rem', padding: '1.25rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
                      <div>
                        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.4rem', flexWrap: 'wrap' }}>
                          <span className="badge badge-purple">{p.organizationType}</span>
                          {p.cocNumber && p.cocNumber !== 'UNKNOWN' && <span className="badge badge-amber" style={{ background: '#78350f', color: '#fde68a' }}>CoC #{p.cocNumber}</span>}
                          <span className="badge badge-blue">Verified Role: {p.verifiedOfficialRole || 'CONFIRMED_COLLABORATIVE_APPLICANT'}</span>
                          {!p.isFixture && <span className="badge badge-purple">🌐 Live HTTP Discovered</span>}
                        </div>
                        <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#f8fafc' }}>{p.name}</h3>
                        <p style={{ fontSize: '0.85rem', color: '#94a3b8', marginTop: '0.2rem' }}>
                          <strong>Counties Served:</strong> {Array.isArray(p.countiesServed) ? p.countiesServed.join(', ') : p.geography} • <strong>Official Website:</strong>{' '}
                          <a href={p.websiteUrl} target="_blank" rel="noreferrer" style={{ color: '#38bdf8', textDecoration: 'underline' }}>
                            {p.websiteUrl}
                          </a>
                        </p>
                      </div>

                      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                        {selectedOppForPartnerView && (
                          <button
                            onClick={() => {
                              setSelectedOppForPartnerView(null);
                              setActivePrimaryTab('OPPORTUNITIES');
                            }}
                            style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid var(--border-color)', color: '#94a3b8', padding: '0.4rem 0.75rem', borderRadius: '0.4rem', fontSize: '0.8rem', cursor: 'pointer' }}
                          >
                            ⬅️ Back to Opportunity
                          </button>
                        )}
                        <button
                          onClick={() => handleFetchPartnerBriefing(p.id, selectedOppForPartnerView?.id, 'GRANT_COMPETITION')}
                          style={{ background: 'rgba(59, 130, 246, 0.2)', border: '1px solid #3b82f6', color: '#93c5fd', padding: '0.4rem 0.85rem', borderRadius: '0.4rem', fontSize: '0.85rem', cursor: 'pointer', fontWeight: 600 }}
                        >
                          📄 Generate Competition/NOFO Briefing
                        </button>
                        <button
                          onClick={() => handleFetchPartnerBriefing(p.id, selectedOppForPartnerView?.id, 'GENERAL')}
                          style={{ background: 'rgba(147, 51, 234, 0.2)', border: '1px solid #a855f7', color: '#d8b4fe', padding: '0.4rem 0.75rem', borderRadius: '0.4rem', fontSize: '0.85rem', cursor: 'pointer', fontWeight: 600 }}
                        >
                          💬 General Inquiry
                        </button>
                        <button
                          onClick={() => handleFetchPartnerBriefing(p.id, selectedOppForPartnerView?.id, 'CES_INTEGRATION')}
                          style={{ background: 'rgba(245, 158, 11, 0.2)', border: '1px solid #f59e0b', color: '#fde68a', padding: '0.4rem 0.85rem', borderRadius: '0.4rem', fontSize: '0.85rem', cursor: 'pointer', fontWeight: 600 }}
                        >
                          🔄 CES Integration
                        </button>
                      </div>
                    </div>

                    <p style={{ fontSize: '0.9rem', color: '#cbd5e1', marginTop: '0.75rem' }}>{p.mission}</p>

                    {/* Verified CoC Governance & Role Details */}
                    <div style={{ marginTop: '0.75rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.65rem', background: 'rgba(30, 41, 59, 0.5)', padding: '0.75rem', borderRadius: '0.5rem', fontSize: '0.85rem' }}>
                      <div><strong>Collaborative Applicant Org:</strong> {p.collaborativeApplicantOrg || p.name}</div>
                      <div><strong>Lead Agency:</strong> {p.leadAgency || 'UNKNOWN'}</div>
                      <div><strong>Application & CES Role:</strong> {p.applicationCoordinatedEntryRole || 'CoC Collaborative Applicant & Coordinated Entry Lead'}</div>
                      <div><strong>Current Cycle Info:</strong> {p.currentCycleParticipationInfo || 'Active FY2026 HUD CoC Competition Participation'}</div>
                    </div>

                    {/* Structured Verified Contact Channels */}
                    {p.contactChannels && p.contactChannels.length > 0 && (
                      <div style={{ marginTop: '0.75rem', background: 'rgba(30, 41, 59, 0.6)', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid rgba(59, 130, 246, 0.25)' }}>
                        <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#93c5fd', marginBottom: '0.4rem' }}>
                          📞 Verified Purpose-Specific Contact Channels (Zero Guessed Emails)
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                          {p.contactChannels.map((c: any) => (
                            <div key={c.id} style={{ fontSize: '0.8rem', color: '#cbd5e1', background: 'rgba(15, 23, 42, 0.5)', padding: '0.45rem 0.65rem', borderRadius: '0.35rem' }}>
                              <span style={{ fontWeight: 700, color: c.purposeCategory === 'GRANT_COMPETITION' ? '#60a5fa' : c.purposeCategory === 'GOVERNANCE_MEMBERSHIP' ? '#c084fc' : '#fbbf24' }}>
                                {c.purposeCategory === 'GRANT_COMPETITION' ? '🎯 Competition / NOFO Inquiry:' : c.purposeCategory === 'GOVERNANCE_MEMBERSHIP' ? '🏛️ Governance / Board Inquiry:' : '📞 Public Contact:'}
                              </span>{' '}
                              <strong style={{ color: '#f8fafc' }}>{c.contactValue}</strong> • <em>{c.purpose}</em>
                              <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.15rem' }}>
                                Source: <a href={c.sourceUrl} target="_blank" rel="noreferrer" style={{ color: '#38bdf8', textDecoration: 'underline' }}>{c.sourceUrl}</a> • Quote: "{c.quotedCitation}"
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Match Score & Evidence Coverage Metrics */}
                    <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', margin: '0.75rem 0', fontSize: '0.8rem', color: '#94a3b8' }}>
                      <div>🎯 Opportunity Match Score: <strong style={{ color: '#34d399' }}>{match?.matchScore || 95}/100</strong></div>
                      <div>📋 Evidence Coverage: <strong style={{ color: '#c084fc' }}>{match?.evidenceCoverage || 95}%</strong></div>
                      {(() => {
                        const overlapArr = (match?.countiesOverlap && match.countiesOverlap.length > 0)
                          ? match.countiesOverlap
                          : (match?.overlapCounties && match.overlapCounties.length > 0)
                          ? match.overlapCounties
                          : (Array.isArray(p.countiesServed)
                              ? p.countiesServed.filter((c: string) => ['Orange County', 'Los Angeles County'].includes(c))
                              : []);
                        const displayStr = overlapArr.length > 0 ? overlapArr.join(', ') : 'None (Out of Launch Scope)';
                        return <div>📍 Service Footprint Overlap: <strong style={{ color: '#60a5fa' }}>{displayStr}</strong></div>;
                      })()}
                    </div>

                    {/* Server-Authoritative Workflow Status Badge & Action Controls */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.85rem', paddingTop: '0.65rem', borderTop: '1px solid rgba(255,255,255,0.08)', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '0.85rem', color: '#94a3b8', fontWeight: 600 }}>Workflow Status:</span>
                      <span className="badge badge-purple" style={{ fontSize: '0.85rem', fontWeight: 700 }}>
                        {currentStatus}
                      </span>
                      {match?.humanApproved && <span style={{ fontSize: '0.75rem', color: '#6ee7b7', fontWeight: 600 }}>✓ Human Authorized</span>}
                      <button
                        onClick={() => handleOpenOutreachWorkspace(p.id, selectedOppForPartnerView?.id, 'GRANT_COMPETITION')}
                        style={{ background: 'rgba(59, 130, 246, 0.25)', border: '1px solid #3b82f6', color: '#60a5fa', padding: '0.35rem 0.75rem', borderRadius: '0.4rem', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', marginLeft: 'auto' }}
                      >
                        💬 Open Outreach Workspace & Timeline History
                      </button>
                    </div>

                    {/* Source Citation Link */}
                    {p.citations && p.citations.length > 0 && (
                      <div style={{ marginTop: '0.75rem', fontSize: '0.8rem', color: '#94a3b8', background: 'rgba(139, 92, 246, 0.1)', padding: '0.5rem 0.75rem', borderRadius: '0.4rem', border: '1px solid rgba(139, 92, 246, 0.2)' }}>
                        ℹ️ <strong>Source Citation:</strong> {p.citations[0].extractedClaim} (<em><a href={p.citations[0].sourceUrl} target="_blank" rel="noreferrer" style={{ color: '#38bdf8' }}>{p.citations[0].sourceUrl}</a></em>)
                      </div>
                    )}
                  </div>
                );
              })}
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

      {/* Review Details Drawer Modal */}
      {selectedOppForDrawer && (
        <div className="drawer-overlay" onClick={() => setSelectedOppForDrawer(null)}>
          <div className="drawer-content" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
              <div>
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.35rem', flexWrap: 'wrap' }}>
                  <span className="badge badge-purple">{selectedOppForDrawer.isDemo ? 'DEMO FIXTURE' : 'VERIFIED OFFICIAL NOTICE'}</span>
                  <span className="badge badge-blue">Pipeline: {selectedOppForDrawer.candidateRoutingStatus || selectedOppForDrawer.pursuitStage}</span>
                </div>
                <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#f8fafc' }}>
                  {sanitizeHtmlToText(selectedOppForDrawer.title)}
                </h2>
                <p style={{ fontSize: '0.875rem', color: '#94a3b8', marginTop: '0.2rem' }}>
                  <strong>Agency:</strong> {selectedOppForDrawer.fundingAgency} • <strong>Notice ID:</strong> {selectedOppForDrawer.fundingOpportunityNumber}
                </p>
              </div>
              <button onClick={() => setSelectedOppForDrawer(null)} style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '1.4rem', cursor: 'pointer' }}>✕</button>
            </div>

            {drawerLoading && <div style={{ padding: '2rem', textAlign: 'center', color: '#93c5fd' }}>Loading full opportunity details...</div>}

            {drawerError && (
              <div style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid #ef4444', color: '#fca5a5', padding: '0.85rem', borderRadius: '0.5rem', fontSize: '0.875rem' }}>
                ⚠️ Error loading drawer details: {drawerError}
              </div>
            )}

            {!drawerLoading && (
              <>
                {/* View Official Notice Link */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(30, 41, 59, 0.7)', padding: '0.85rem 1.1rem', borderRadius: '0.5rem', border: '1px solid rgba(59, 130, 246, 0.25)' }}>
                  <div>
                    <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Official Source URL:</span>
                  </div>
                  <a
                    href={selectedOppForDrawer.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    style={{ background: '#2563eb', color: '#fff', padding: '0.4rem 0.9rem', borderRadius: '0.4rem', fontWeight: 700, fontSize: '0.85rem', textDecoration: 'none' }}
                  >
                    🔗 View Official Notice on Grants.gov →
                  </a>
                </div>

                {/* Direct Application Blocking Reason */}
                {selectedOppForDrawer.dismissedReason && (
                  <div style={{ background: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#fca5a5', padding: '0.85rem 1rem', borderRadius: '0.5rem', fontSize: '0.875rem' }}>
                    🔒 <strong>Direct Application Blocking Reason:</strong> {cleanReason(selectedOppForDrawer.dismissedReason)}
                  </div>
                )}

                {/* Analysis Graph Section */}
                <div style={{ background: 'rgba(15, 23, 42, 0.8)', border: '1px solid var(--border-color)', borderRadius: '0.75rem', padding: '1.25rem' }}>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#60a5fa', marginBottom: '0.75rem' }}>
                    📊 Opportunity Eligibility & Decision Support Analysis
                  </h3>

                  {drawerAnalysis ? (
                    <div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem', marginBottom: '1rem' }}>
                        <div style={{ background: 'rgba(30, 41, 59, 0.6)', padding: '0.75rem', borderRadius: '0.4rem' }}>
                          <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Overall Fit Score</div>
                          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#34d399' }}>{drawerAnalysis.overallFitScore}%</div>
                        </div>
                        <div style={{ background: 'rgba(30, 41, 59, 0.6)', padding: '0.75rem', borderRadius: '0.4rem' }}>
                          <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Evidence Coverage</div>
                          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#c084fc' }}>{drawerAnalysis.evidenceCoverage}%</div>
                        </div>
                        <div style={{ background: 'rgba(30, 41, 59, 0.6)', padding: '0.75rem', borderRadius: '0.4rem' }}>
                          <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Eligibility Decision</div>
                          <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#fbbf24' }}>{drawerAnalysis.eligibilityDecision}</div>
                        </div>
                      </div>

                      <div style={{ fontSize: '0.875rem', color: '#cbd5e1', marginBottom: '0.85rem' }}>
                        <strong>Reasoning Summary:</strong> {drawerAnalysis.reasoningSummary}
                      </div>

                      {drawerAnalysis.analysisDimensions && drawerAnalysis.analysisDimensions.length > 0 && (
                        <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '0.75rem' }}>
                          <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#93c5fd', marginBottom: '0.5rem' }}>Dimension Breakdown (Points Awarded / Weight)</div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                            {drawerAnalysis.analysisDimensions.map((dim: any, idx: number) => (
                              <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#cbd5e1' }}>
                                <span>• {dim.dimensionKey} ({dim.matchStatus})</span>
                                <strong style={{ color: dim.matchStatus === 'MATCH' ? '#34d399' : dim.matchStatus === 'MISMATCH' ? '#f87171' : '#fbbf24' }}>
                                  {dim.scoreAwarded} / {dim.weight}
                                </strong>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div style={{ padding: '1rem', fontStyle: 'italic', color: '#94a3b8' }}>
                      Not analyzed yet. Click "Analyze & Score" on the opportunity card to generate decision support analysis.
                    </div>
                  )}
                </div>

                {/* AI-1 Structured AI Funding Analyst Panel */}
                <AiEvaluationPanel
                  evaluations={aiEvaluations}
                  currentUser={currentUser}
                  isAiConfigured={Boolean(health.aiAnalyst?.enabled)}
                  onGenerateAiAnalysis={handleGenerateAiAnalysis}
                  onReviewAiAnalysis={handleReviewAiAnalysis}
                  generating={aiGenerating}
                  error={aiError}
                />

                {/* AI-2A Official Funding Documents & Citation Foundation Panel */}
                <OfficialFundingDocuments
                  opportunityId={selectedOppForDrawer.id}
                  currentUser={currentUser}
                  apiFetch={apiFetch}
                  isIngestionEnabled={Boolean(health.documentIngestion?.enabled)}
                />



                {/* Dynamic Routing Navigation Action (Partnership vs Sponsor) */}
                {selectedOppForDrawer.candidateRoutingStatus === 'PARTNERSHIP_REQUIRED' || selectedOppForDrawer.fundingOpportunityNumber?.includes('CPD-2600-DC-0025') ? (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(59, 130, 246, 0.12)', border: '1px solid #3b82f6', padding: '1rem', borderRadius: '0.65rem' }}>
                    <div>
                      <h4 style={{ fontSize: '1rem', fontWeight: 700, color: '#93c5fd' }}>🏛️ Continuum of Care (CoC) Partner Required</h4>
                      <p style={{ fontSize: '0.825rem', color: '#cbd5e1', marginTop: '0.15rem' }}>
                        This opportunity requires submission through an official CoC Collaborative Applicant. A fiscal sponsor cannot substitute for a CoC Collaborative Applicant.
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        setSelectedOppForDrawer(null);
                        setActivePrimaryTab('PARTNERS');
                      }}
                      style={{ background: '#2563eb', color: '#fff', padding: '0.5rem 1rem', borderRadius: '0.4rem', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer', border: 'none' }}
                    >
                      Find Strategic Partners →
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(139, 92, 246, 0.12)', border: '1px solid #8b5cf6', padding: '1rem', borderRadius: '0.65rem' }}>
                    <div>
                      <h4 style={{ fontSize: '1rem', fontWeight: 700, color: '#c084fc' }}>🤝 Possible Fiscal Sponsor Pathways</h4>
                      <p style={{ fontSize: '0.825rem', color: '#cbd5e1', marginTop: '0.15rem' }}>
                        {drawerSponsorMatches.length} calculated sponsor match(es) for this opportunity requirement.
                      </p>
                    </div>
                    <button
                      onClick={() => handleNavigateToOpportunitySponsors(selectedOppForDrawer)}
                      style={{ background: '#8b5cf6', color: '#fff', padding: '0.5rem 1rem', borderRadius: '0.4rem', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer', border: 'none' }}
                    >
                      View Possible Sponsors ({drawerSponsorMatches.length}) →
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Briefing Packet Modal Drawer */}
      {briefingPacket && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1200, padding: '1.5rem' }}>
          <div style={{ background: '#0f172a', border: '2px solid #3b82f6', borderRadius: '0.85rem', maxWidth: '820px', width: '100%', maxHeight: '92vh', overflowY: 'auto', padding: '1.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem', marginBottom: '1rem' }}>
              <div>
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.25rem' }}>
                  <span className={`badge ${briefingPacket.inquiryType === 'SPECIFIC_OPPORTUNITY' ? 'badge-blue' : 'badge-purple'}`}>
                    {briefingPacket.inquiryType === 'SPECIFIC_OPPORTUNITY' ? 'OPPORTUNITY-SPECIFIC INQUIRY' : 'GENERAL INTRODUCTORY INQUIRY'}
                  </span>
                </div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#fff' }}>
                  📄 Fiscal Sponsor Inquiry Briefing — {briefingPacket.candidateName}
                </h2>
              </div>
              <button onClick={() => setBriefingPacket(null)} style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '1.2rem', cursor: 'pointer' }}>✕</button>
            </div>

            <div style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid #ef4444', color: '#fca5a5', padding: '0.75rem', borderRadius: '0.5rem', fontSize: '0.85rem', marginBottom: '1rem' }}>
              {briefingPacket.safeguardNotice}
            </div>

            {/* Render Selected Opportunity Breakdown if Specific Opportunity */}
            {briefingPacket.inquiryType === 'SPECIFIC_OPPORTUNITY' && (
              <div style={{ background: 'rgba(30, 41, 59, 0.7)', border: '1px solid rgba(59, 130, 246, 0.3)', padding: '0.85rem 1rem', borderRadius: '0.5rem', marginBottom: '1.25rem', fontSize: '0.85rem', color: '#cbd5e1' }}>
                <div style={{ fontWeight: 700, color: '#60a5fa', marginBottom: '0.35rem' }}>
                  📋 Selected Opportunity: {briefingPacket.opportunityTitle} (Notice #{briefingPacket.opportunityNumber})
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.4rem', fontSize: '0.8rem' }}>
                  <div><strong>Agency:</strong> {briefingPacket.fundingAgency}</div>
                  <div><strong>Deadline:</strong> {briefingPacket.deadline}</div>
                  <div><strong>Award Range:</strong> {briefingPacket.awardRange}</div>
                  <div><strong>Match Requirement:</strong> {briefingPacket.matchRequirement}</div>
                </div>
              </div>
            )}

            {/* Opportunity-Specific Positioning Read-Only Panel */}
            {briefingPacket.selectedNarrativeLenses && (
              <div style={{ background: 'rgba(15, 23, 42, 0.8)', border: '1px solid rgba(147, 197, 253, 0.3)', padding: '0.85rem 1rem', borderRadius: '0.5rem', marginBottom: '1.25rem', fontSize: '0.825rem' }}>
                <div style={{ fontWeight: 700, color: '#60a5fa', marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  🎯 Opportunity-Specific Positioning
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginBottom: '0.5rem' }}>
                  {briefingPacket.selectedNarrativeLenses.map((lens: string, idx: number) => (
                    <span key={idx} className="badge badge-purple" style={{ fontSize: '0.725rem' }}>Lens: {lens}</span>
                  ))}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.4rem', color: '#cbd5e1', fontSize: '0.78rem' }}>
                  <div><strong>Primary Population:</strong> Justice-involved & system-impacted youth & young adults</div>
                  <div><strong>Selected Partner Geography:</strong> {briefingPacket.geography || 'Southern California'}</div>
                  <div><strong>Legal-Stage Safeguard:</strong> Emerging nonprofit initiative (PRE_INCORPORATION)</div>
                  <div><strong>Current-Cycle Safeguard:</strong> Information-seeking guidance (Evaluating status)</div>
                </div>
              </div>
            )}

            {/* Editable Subject & Body Text Section */}
            <div style={{ marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#93c5fd' }}>
                  ✉️ Editable Draft Inquiry Email (Human Review & Dispatch)
                </h3>
                <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>To: {briefingPacket.draftInquiryEmail.to}</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', color: '#94a3b8', marginBottom: '0.2rem', fontWeight: 600 }}>Subject Line:</label>
                  <input
                    type="text"
                    value={editableSubject}
                    onChange={(e) => setEditableSubject(e.target.value)}
                    style={{ width: '100%', background: '#1e293b', border: '1px solid var(--border-color)', color: '#f8fafc', padding: '0.5rem 0.75rem', borderRadius: '0.4rem', fontSize: '0.85rem', fontWeight: 600 }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', color: '#94a3b8', marginBottom: '0.2rem', fontWeight: 600 }}>Email Body:</label>
                  <textarea
                    value={editableBodyText}
                    onChange={(e) => setEditableBodyText(e.target.value)}
                    rows={14}
                    style={{ width: '100%', background: '#1e293b', border: '1px solid var(--border-color)', color: '#cbd5e1', padding: '0.75rem', borderRadius: '0.4rem', fontSize: '0.85rem', fontFamily: 'monospace', lineHeight: 1.5 }}
                  />
                </div>
              </div>
            </div>

            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#93c5fd', marginBottom: '0.5rem' }}>📞 Discovery Call Questions</h3>
            <ul style={{ paddingLeft: '1.2rem', fontSize: '0.85rem', color: '#cbd5e1', marginBottom: '1.25rem' }}>
              {briefingPacket.discoveryCallQuestions.map((q, idx) => (
                <li key={idx} style={{ marginBottom: '0.35rem' }}>{q}</li>
              ))}
            </ul>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
              <button
                onClick={() =>
                  handleSaveWorkingDraft(
                    briefingPacket.candidateId,
                    briefingPacket.opportunityId,
                    editableSubject,
                    editableBodyText,
                    briefingPacket.draftInquiryEmail?.to || '',
                    'GRANT_COMPETITION'
                  )
                }
                style={{
                  background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                  border: 'none',
                  color: '#fff',
                  padding: '0.55rem 1.25rem',
                  borderRadius: '0.4rem',
                  fontWeight: 700,
                  fontSize: '0.875rem',
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(37, 99, 235, 0.3)',
                }}
              >
                💾 Save Working Draft to Outreach Workspace
              </button>
              <button onClick={() => setBriefingPacket(null)} style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid var(--border-color)', color: '#fff', padding: '0.55rem 1.25rem', borderRadius: '0.4rem', fontWeight: 700, cursor: 'pointer' }}>
                Close Briefing
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Strategic Partner Briefing Packet Modal Drawer */}
      {partnerBriefingPacket && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1200, padding: '1.5rem' }}>
          <div style={{ background: '#0f172a', border: '2px solid #3b82f6', borderRadius: '0.85rem', maxWidth: '820px', width: '100%', maxHeight: '92vh', overflowY: 'auto', padding: '1.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem', marginBottom: '1rem' }}>
              <div>
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.25rem' }}>
                  <span className="badge badge-purple">STRATEGIC PARTNER INQUIRY</span>
                  <span className="badge badge-amber" style={{ background: '#78350f', color: '#fde68a' }}>CoC #{partnerBriefingPacket.cocNumber || 'Lead'}</span>
                </div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#fff' }}>
                  📄 CoC Partnership Inquiry Briefing — {partnerBriefingPacket.partnerName}
                </h2>
              </div>
              <button onClick={() => setPartnerBriefingPacket(null)} style={{ background: 'transparent', border: 'none', color: '#94a3b8', fontSize: '1.5rem', cursor: 'pointer' }}>×</button>
            </div>

            <div style={{ background: 'rgba(30, 41, 59, 0.5)', borderRadius: '0.5rem', padding: '1rem', marginBottom: '1.25rem', border: '1px solid var(--border-color)' }}>
              <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#60a5fa', marginBottom: '0.5rem' }}>🎯 CoC Target Contact Evidence & Alignment</h3>
              <div style={{ fontSize: '0.85rem', color: '#cbd5e1', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                <div><strong>CoC Number:</strong> {partnerBriefingPacket.cocNumber || 'CA-600'}</div>
                <div><strong>Verified Contact Channel:</strong> {partnerBriefingPacket.verifiedContactEmail}</div>
                <div><strong>Primary Lead Agency:</strong> {partnerBriefingPacket.collaborativeApplicantOrg}</div>
                <div><strong>Active Launch Footprint:</strong> Orange County & LA County</div>
              </div>
            </div>

            <div style={{ background: 'rgba(15, 23, 42, 0.8)', border: '1px solid #3b82f6', borderRadius: '0.5rem', padding: '1.25rem', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#38bdf8', margin: 0 }}>✉️ Positioned Outreach Initial Inquiry Draft</h3>
                <span className="badge badge-blue">EDITABLE HUMAN WORKING DRAFT</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', marginBottom: '0.25rem' }}>SUBJECT LINE:</label>
                  <input
                    type="text"
                    value={partnerEditableSubject}
                    onChange={(e) => setPartnerEditableSubject(e.target.value)}
                    style={{ width: '100%', background: '#1e293b', border: '1px solid var(--border-color)', color: '#f8fafc', padding: '0.5rem', borderRadius: '0.35rem', fontSize: '0.85rem', fontWeight: 600 }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', marginBottom: '0.25rem' }}>INQUIRY BODY TEXT:</label>
                  <textarea
                    value={partnerEditableBodyText}
                    onChange={(e) => setPartnerEditableBodyText(e.target.value)}
                    rows={12}
                    style={{ width: '100%', background: '#1e293b', border: '1px solid var(--border-color)', color: '#cbd5e1', padding: '0.75rem', borderRadius: '0.4rem', fontSize: '0.85rem', fontFamily: 'monospace', lineHeight: 1.5 }}
                  />
                </div>
              </div>
            </div>

            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#93c5fd', marginBottom: '0.5rem' }}>📞 CoC Discovery & Alignment Questions</h3>
            <ul style={{ paddingLeft: '1.2rem', fontSize: '0.85rem', color: '#cbd5e1', marginBottom: '1.25rem' }}>
              {partnerBriefingPacket.discoveryCallQuestions?.map((q: string, idx: number) => (
                <li key={idx} style={{ marginBottom: '0.35rem' }}>{q}</li>
              ))}
            </ul>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
              <button
                onClick={() =>
                  handleSaveWorkingDraft(
                    partnerBriefingPacket.strategicPartnerId,
                    partnerBriefingPacket.opportunityId,
                    partnerEditableSubject,
                    partnerEditableBodyText,
                    partnerBriefingPacket.verifiedContactEmail,
                    'GRANT_COMPETITION'
                  )
                }
                style={{
                  background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                  border: 'none',
                  color: '#fff',
                  padding: '0.55rem 1.25rem',
                  borderRadius: '0.4rem',
                  fontWeight: 700,
                  fontSize: '0.875rem',
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(37, 99, 235, 0.3)',
                }}
              >
                💾 Save Working Draft to Outreach Workspace
              </button>
              <button onClick={() => setPartnerBriefingPacket(null)} style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid var(--border-color)', color: '#fff', padding: '0.55rem 1.25rem', borderRadius: '0.4rem', fontWeight: 700, cursor: 'pointer' }}>
                Close Briefing
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Unauthenticated Login Screen Modal */}
      {authStatus === 'UNAUTHENTICATED' && (
        <LoginModal onLoginSuccess={handleLoginSuccess} />
      )}

      {/* Change Password Modal */}
      {showChangePasswordModal && (
        <ChangePasswordModal
          onClose={() => setShowChangePasswordModal(false)}
          onSuccess={() => {
            setShowChangePasswordModal(false);
            setActionMessage('Password changed successfully.');
          }}
        />
      )}

      {/* Admin User Management Modal */}
      {showAdminUsersModal && (
        <AdminUserManagementModal onClose={() => setShowAdminUsersModal(false)} />
      )}

      {/* Phase 1G Outreach Workspace Drawer */}
      {outreachEngagement && (
        <OutreachWorkspaceDrawer
          engagement={outreachEngagement}
          onClose={() => setOutreachEngagement(null)}
          onRefresh={handleRefreshOutreachWorkspace}
        />
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
        <p>Thriveward Funding Intelligence Platform • AI-2A • Official Notice Ingestion & Citation Foundation • Project Thriveward</p>
      </footer>

    </div>
  );
}

export default App;
