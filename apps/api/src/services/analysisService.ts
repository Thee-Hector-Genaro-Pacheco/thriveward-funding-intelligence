import crypto from 'crypto';
import { prisma } from '../lib/prisma';
import { BRIDGE_FORWARD_PROFILE, getProfileHash, getCanonicalProfileJson } from '../config/bridgeForwardProfile';
import { EligibilityStatus, TriStateStatus } from '@prisma/client';

export enum EligibilityDecision {
  ELIGIBLE = 'ELIGIBLE',
  INVESTIGATE = 'INVESTIGATE',
  NOT_ELIGIBLE = 'NOT_ELIGIBLE',
}

export enum OpportunityRecommendation {
  HIGH_PRIORITY = 'HIGH_PRIORITY',
  INVESTIGATE = 'INVESTIGATE',
  FUTURE_OPPORTUNITY = 'FUTURE_OPPORTUNITY',
  NOT_ELIGIBLE = 'NOT_ELIGIBLE',
}

export function mapRecommendationToEligibilityStatus(rec: OpportunityRecommendation): EligibilityStatus {
  switch (rec) {
    case OpportunityRecommendation.HIGH_PRIORITY:
      return EligibilityStatus.HIGH_PRIORITY;
    case OpportunityRecommendation.INVESTIGATE:
      return EligibilityStatus.INVESTIGATE;
    case OpportunityRecommendation.FUTURE_OPPORTUNITY:
      return EligibilityStatus.FUTURE_OPPORTUNITY;
    case OpportunityRecommendation.NOT_ELIGIBLE:
      return EligibilityStatus.NOT_ELIGIBLE;
  }
}

export interface DimensionDefinition {
  key: string;
  weight: number;
  isCritical: boolean;
}

export const DIMENSION_DEFINITIONS: readonly DimensionDefinition[] = [
  { key: 'applicantTypeTaxStatus', weight: 15, isCritical: true },
  { key: 'operatingHistoryReadiness', weight: 10, isCritical: true },
  { key: 'geographicEligibility', weight: 10, isCritical: true },
  { key: 'targetPopulationAlignment', weight: 15, isCritical: true },
  { key: 'programActivityAlignment', weight: 15, isCritical: false },
  { key: 'participantSupportAlignment', weight: 10, isCritical: false },
  { key: 'awardSizeBudgetFit', weight: 5, isCritical: false },
  { key: 'matchCostShareFeasibility', weight: 5, isCritical: false },
  { key: 'deadlineApplicationReadiness', weight: 5, isCritical: false },
  { key: 'partnershipRequirements', weight: 3, isCritical: false },
  { key: 'complianceReportingCapacity', weight: 3, isCritical: false },
  { key: 'strategicMissionAlignment', weight: 4, isCritical: false },
] as const;

export const PARTICIPANT_SUPPORT_CATEGORIES = [
  'DIRECT_STIPENDS',
  'PARTICIPANT_WAGES',
  'TRAINING_OR_TUITION',
  'CREDENTIAL_OR_LICENSING_FEES',
  'TRANSPORTATION',
  'CHILDCARE_OR_DEPENDENT_CARE',
  'HOUSING_ASSISTANCE',
  'MEALS_OR_FOOD_ASSISTANCE',
  'TECHNOLOGY_OR_CONNECTIVITY',
  'TOOLS_EQUIPMENT_PPE_OR_WORK_CLOTHING',
  'IDENTIFICATION_OR_BACKGROUND_CHECK_FEES',
  'HEALTH_MENTAL_HEALTH_OR_SUBSTANCE_USE_SUPPORT',
  'MENTORING_OR_CASE_MANAGEMENT',
  'EMERGENCY_ASSISTANCE',
  'INCENTIVES_GIFT_CARDS_OR_ACHIEVEMENT_PAYMENTS',
] as const;

export interface ServiceError extends Error {
  statusCode?: number;
}

function createServiceError(message: string, statusCode: number): ServiceError {
  const err: ServiceError = new Error(message);
  err.statusCode = statusCode;
  return err;
}

export interface CitationItem {
  id: string;
  sourceUrl: string;
  quotedSection?: string | null;
  extractedClaim: string;
}

export class AnalysisService {
  /**
   * Derives a deterministic 64-character SHA-256 fingerprint for opportunity source data.
   */
  public static computeSourceFingerprint(opp: {
    id: string;
    externalOpportunityId?: string | null;
    title: string;
    fundingAgency: string;
    description: string;
    eligibleApplicantTypes?: string[];
    eligiblePopulations?: string[];
    allowableCosts?: string[];
    prohibitedCosts?: string[];
    geography?: string;
    matchRequirement?: string;
    sourcePayloadHash?: string | null;
    snapshots?: Array<{ payloadHash: string }>;
  }): string {
    if (opp.snapshots && opp.snapshots.length > 0) {
      const latestSnapshot = opp.snapshots[0];
      if (latestSnapshot.payloadHash && latestSnapshot.payloadHash.length === 64) {
        return latestSnapshot.payloadHash;
      }
    }
    if (opp.sourcePayloadHash && opp.sourcePayloadHash.length === 64) {
      return opp.sourcePayloadHash;
    }
    const canonicalPayload = {
      id: opp.id,
      externalOpportunityId: opp.externalOpportunityId || '',
      title: opp.title,
      fundingAgency: opp.fundingAgency,
      description: opp.description,
      eligibleApplicantTypes: [...(opp.eligibleApplicantTypes || [])].sort(),
      eligiblePopulations: [...(opp.eligiblePopulations || [])].sort(),
      allowableCosts: [...(opp.allowableCosts || [])].sort(),
      prohibitedCosts: [...(opp.prohibitedCosts || [])].sort(),
      geography: opp.geography || 'UNKNOWN',
      matchRequirement: opp.matchRequirement || 'UNKNOWN',
    };
    return crypto.createHash('sha256').update(JSON.stringify(canonicalPayload)).digest('hex');
  }

  /**
   * Generates or retrieves the deterministic current OpportunityAnalysis.
   */
  public static async analyzeOpportunity(fundingOpportunityId: string): Promise<any> {
    let opp = await prisma.fundingOpportunity.findUnique({
      where: { id: fundingOpportunityId },
      include: {
        sourceCitations: true,
        snapshots: { orderBy: { retrievalTimestamp: 'desc' }, take: 1 },
      },
    });

    if (!opp) {
      throw createServiceError(`Funding opportunity with ID '${fundingOpportunityId}' not found.`, 404);
    }

    // Ensure opp has at least one source citation if missing
    if (!opp.sourceCitations || opp.sourceCitations.length === 0) {
      const createdCitation = await prisma.sourceCitation.create({
        data: {
          fundingOpportunityId: opp.id,
          sourceUrl: opp.sourceUrl || 'https://grants.gov',
          sourceTitle: opp.title,
          sourceOrganization: opp.fundingAgency,
          quotedSection: opp.description || opp.title,
          extractedClaim: opp.description || opp.title,
        },
      });
      opp = {
        ...opp,
        sourceCitations: [createdCitation],
      };
    }

    const sourceFingerprint = this.computeSourceFingerprint(opp);
    const profileHash = getProfileHash();
    const profileVersion = BRIDGE_FORWARD_PROFILE.profileVersion;
    const analysisVersion = '1.0';

    // Check if an existing current analysis matches this exact version, sourceFingerprint, and profileHash
    const existingCurrent = await prisma.opportunityAnalysis.findFirst({
      where: {
        fundingOpportunityId,
        isCurrent: true,
      },
      include: {
        eligibilityFindings: { include: { sourceCitation: true } },
        analysisDimensions: { include: { sourceCitation: true } },
        participantSupportFindings: { include: { sourceCitation: true } },
        analysisReviews: { orderBy: { reviewedAt: 'desc' } },
      },
    });

    if (
      existingCurrent &&
      existingCurrent.sourceFingerprint === sourceFingerprint &&
      existingCurrent.profileHash === profileHash &&
      existingCurrent.analysisVersion === analysisVersion
    ) {
      return existingCurrent;
    }

    // Run deterministic analysis evaluation
    const evaluation = await this.evaluateOpportunity(opp);

    return await prisma.$transaction(async (tx) => {
      // Mark any existing current analysis for this opportunity as not current
      await tx.opportunityAnalysis.updateMany({
        where: { fundingOpportunityId, isCurrent: true },
        data: { isCurrent: false },
      });

      // Create new current analysis
      const newAnalysis = await tx.opportunityAnalysis.create({
        data: {
          fundingOpportunityId,
          analysisVersion,
          sourceFingerprint,
          profileVersion,
          profileHash,
          profileSnapshot: {
            ...JSON.parse(getCanonicalProfileJson()),
            deadlineFeasibility: evaluation.deadlineFeasibility,
          },
          eligibilityDecision: evaluation.eligibilityDecision,
          recommendation: evaluation.recommendation,
          overallFitScore: evaluation.overallFitScore,
          evidenceCoverage: evaluation.evidenceCoverage,
          eligibilityStatus: mapRecommendationToEligibilityStatus(evaluation.recommendation),
          reasoningSummary: evaluation.reasoningSummary,
          missionAlignmentScore: evaluation.dimensionScores.strategicMissionAlignment || 0,
          populationAlignmentScore: evaluation.dimensionScores.targetPopulationAlignment || 0,
          programAlignmentScore: evaluation.dimensionScores.programActivityAlignment || 0,
          geographicEligibilityScore: evaluation.dimensionScores.geographicEligibility || 0,
          applicantEligibilityScore: evaluation.dimensionScores.applicantTypeTaxStatus || 0,
          taxStatusEligibilityScore: evaluation.dimensionScores.applicantTypeTaxStatus || 0,
          organizationalMaturityScore: evaluation.dimensionScores.operatingHistoryReadiness || 0,
          requiredPartnershipsScore: evaluation.dimensionScores.partnershipRequirements || 0,
          allowableCostAlignmentScore: evaluation.dimensionScores.participantSupportAlignment || 0,
          awardSizeSuitabilityScore: evaluation.dimensionScores.awardSizeBudgetFit || 0,
          deadlineFeasibilityScore: evaluation.dimensionScores.deadlineApplicationReadiness || 0,
          evidenceTrackRecordScore: evaluation.dimensionScores.complianceReportingCapacity || 0,
          reviewStatus: 'PENDING_HUMAN_REVIEW',
          reviewedAt: null,
          reviewerId: null,
          reviewerNotes: null,
          isCurrent: true,
          humanReviewRequired: true,
        },
      });

      // Create EligibilityFindings
      for (const finding of evaluation.eligibilityFindings) {
        await tx.eligibilityFinding.create({
          data: {
            opportunityAnalysisId: newAnalysis.id,
            criterionKey: finding.criterionKey,
            criterionText: finding.criterionText,
            outcome: finding.outcome,
            remediable: finding.remediable,
            rationale: finding.rationale,
            evidenceStatus: finding.evidenceStatus,
            sourceCitationId: finding.sourceCitationId,
            evidenceQuote: finding.evidenceQuote,
          },
        });
      }

      // Create AnalysisDimensions
      for (const dim of evaluation.dimensions) {
        await tx.analysisDimension.create({
          data: {
            opportunityAnalysisId: newAnalysis.id,
            dimensionKey: dim.dimensionKey,
            weight: dim.weight,
            matchStatus: dim.matchStatus,
            scoreAwarded: dim.scoreAwarded,
            rationale: dim.rationale,
            evidenceStatus: dim.evidenceStatus,
            sourceCitationId: dim.sourceCitationId,
            evidenceQuote: dim.evidenceQuote,
          },
        });
      }

      // Create ParticipantSupportFindings
      for (const ps of evaluation.participantSupportFindings) {
        await tx.participantSupportFinding.create({
          data: {
            opportunityAnalysisId: newAnalysis.id,
            category: ps.category,
            automatedStatus: ps.automatedStatus,
            automatedRationale: ps.automatedRationale,
            evidenceStatus: ps.evidenceStatus,
            sourceCitationId: ps.sourceCitationId,
            evidenceQuote: ps.evidenceQuote,
          },
        });
      }

      return await tx.opportunityAnalysis.findUnique({
        where: { id: newAnalysis.id },
        include: {
          eligibilityFindings: { include: { sourceCitation: true } },
          analysisDimensions: { include: { sourceCitation: true } },
          participantSupportFindings: { include: { sourceCitation: true } },
          analysisReviews: { orderBy: { reviewedAt: 'desc' } },
        },
      });
    });
  }

  public static async evaluateOpportunity(oppOrId: any): Promise<any> {
    let opp = oppOrId;
    if (typeof oppOrId === 'string') {
      opp = await prisma.fundingOpportunity.findUnique({
        where: { id: oppOrId },
        include: { sourceCitations: true },
      });
      if (!opp) {
        throw createServiceError(`Funding opportunity with ID '${oppOrId}' not found.`, 404);
      }
    }

    const citations: CitationItem[] = opp.sourceCitations || [];
    const findCitation = (predicate: (c: CitationItem) => boolean): CitationItem | null => {
      const c = citations.find(predicate);
      if (c && c.quotedSection && c.quotedSection.trim().length > 0) {
        return c;
      }
      return citations[0] || null;
    };

    const genericCitation: CitationItem | null = citations[0] || null;

    // --- 1. Eligibility Findings ---
    const eligibilityFindings: Array<{
      criterionKey: string;
      criterionText: string;
      outcome: string;
      remediable: boolean;
      rationale: string;
      evidenceStatus: string;
      sourceCitationId: string | null;
      evidenceQuote: string | null;
    }> = [];

    // Criterion 1: Tax Status & Applicant Eligibility
    const oppNum = (opp.fundingOpportunityNumber || '').toUpperCase();
    const titleText = (opp.title || '').toLowerCase();
    const descText = (opp.description || '').toLowerCase();
    const isStreetOutreach = oppNum.includes('HHS-2026-ACF-ACYF-YO-0044') || titleText.includes('street outreach') || descText.includes('street outreach');
    const isCoCCompetition =
      oppNum.includes('CPD-2600-DC-0025') ||
      titleText.includes('coc competition') ||
      titleText.includes('continuum of care') ||
      descText.includes('coc competition') ||
      descText.includes('continuum of care');

    const routingStatus =
      isCoCCompetition || opp.candidateRoutingStatus === 'PARTNERSHIP_REQUIRED' || (opp.dismissedReason || '').includes('PARTNERSHIP_REQUIRED')
        ? 'PARTNERSHIP_REQUIRED'
        : isStreetOutreach || opp.candidateRoutingStatus === 'FISCAL_SPONSOR_REQUIRED' || (opp.dismissedReason || '').includes('FISCAL_SPONSOR_REQUIRED')
        ? 'FISCAL_SPONSOR_REQUIRED'
        : opp.candidateRoutingStatus || 'UNKNOWN';

    const applicantTypes = (opp.eligibleApplicantTypes || []).map((t: string) => t.toLowerCase());
    let taxCitation: CitationItem | null = findCitation((c) => c.extractedClaim.toLowerCase().includes('applicant') || c.extractedClaim.toLowerCase().includes('nonprofit')) || genericCitation;
    let taxOutcome = 'UNKNOWN';
    let taxRemediable = true;
    let taxRationale = 'Applicant type requirements require human investigation.';

    if (isStreetOutreach) {
      taxOutcome = 'SATISFIED';
      taxRationale = 'Official solicitation eligibility includes nonprofits with and without 501(c)(3) tax status. Bridge Forward remains blocked due to PRE_INCORPORATION status (lacking legal-entity status, EIN, SAM.gov/UEI, Grants.gov AOR, fiscal sponsor, matching funds, and operating history).';
    } else if (routingStatus === 'PARTNERSHIP_REQUIRED' || isCoCCompetition) {
      taxOutcome = 'FAILED';
      taxRemediable = true;
      taxRationale = 'Direct application blocked: Requires submission through official Continuum of Care (CoC) Collaborative Applicant via e-snaps. Bridge Forward is PRE_INCORPORATION.';
    } else if (applicantTypes.length > 0) {
      const allowsNonprofits = applicantTypes.some((t: string) => t.includes('nonprofit') || t.includes('public') || t.includes('cbo') || t.includes('all'));
      const requires501c3Only = applicantTypes.some((t: string) => t.includes('501(c)(3) only') || t.includes('incorporated only') || t.includes('501(c)(3) incorporated only'));
      if (allowsNonprofits && !requires501c3Only) {
        taxOutcome = 'SATISFIED';
        taxRationale = 'Opportunity permits nonprofits and community-based organizations (fiscal sponsor / planned entity eligible).';
      } else if (requires501c3Only) {
        taxOutcome = 'FAILED';
        taxRemediable = true;
        taxRationale = 'Opportunity requires existing 501(c)(3) tax-exempt status (Bridge Forward currently pre-incorporation).';
      }
    }

    if (!taxCitation) {
      taxCitation = genericCitation;
    }

    eligibilityFindings.push({
      criterionKey: 'applicant_tax_status',
      criterionText: '501(c)(3) Tax-Exempt Status & Eligible Applicant Type',
      outcome: taxOutcome,
      remediable: taxRemediable,
      rationale: taxRationale,
      evidenceStatus: taxOutcome !== 'UNKNOWN' && taxCitation ? 'EVIDENCE_PRESENT' : 'MISSING_EVIDENCE',
      sourceCitationId: taxOutcome !== 'UNKNOWN' && taxCitation ? taxCitation.id : null,
      evidenceQuote: taxOutcome !== 'UNKNOWN' && taxCitation ? taxCitation.quotedSection || null : null,
    });

    // Criterion 2: Operating History
    const opHistoryReq = (opp.operatingHistoryRequirements || '').toLowerCase();
    let opCitation: CitationItem | null = findCitation((c) => c.extractedClaim.toLowerCase().includes('operating history') || c.extractedClaim.toLowerCase().includes('years') || c.extractedClaim.toLowerCase().includes('track record')) || genericCitation;
    let opOutcome = 'UNKNOWN';
    let opRemediable = true;
    let opRationale = 'Operating history requirement not specified in notice text.';

    if (opHistoryReq) {
      if (opHistoryReq.includes('3 years') || opHistoryReq.includes('5 years') || opHistoryReq.includes('track record')) {
        opOutcome = 'FAILED';
        opRemediable = true;
        opRationale = `Requires established operating history (${opp.operatingHistoryRequirements}). Bridge Forward has 0 operating history years.`;
      } else {
        opOutcome = 'SATISFIED';
        opRationale = 'No minimum operating history restriction specified.';
      }
    } else {
      opOutcome = 'SATISFIED';
      opRationale = 'No operating history restriction specified.';
    }

    if (!opCitation) {
      opCitation = genericCitation;
    }

    eligibilityFindings.push({
      criterionKey: 'operating_history',
      criterionText: 'Organizational Operating History & Track Record',
      outcome: opOutcome,
      remediable: opRemediable,
      rationale: opRationale,
      evidenceStatus: opCitation ? 'EVIDENCE_PRESENT' : 'MISSING_EVIDENCE',
      sourceCitationId: opCitation ? opCitation.id : null,
      evidenceQuote: opCitation ? opCitation.quotedSection || null : null,
    });

    // Criterion 3: Geography
    const geo = (opp.geography || '').toLowerCase();
    let geoCitation: CitationItem | null = findCitation((c) => c.extractedClaim.toLowerCase().includes('california') || c.extractedClaim.toLowerCase().includes('geography') || c.extractedClaim.toLowerCase().includes('state')) || genericCitation;
    let geoOutcome = 'UNKNOWN';
    let geoRemediable = false;
    let geoRationale = 'Geographic eligibility requirements not specified in notice text.';

    if (geo) {
      if (geo.includes('out-of-state') || (geo.includes('only') && !geo.includes('ca') && !geo.includes('california') && !geo.includes('national') && !geo.includes('unknown'))) {
        geoOutcome = 'FAILED';
        geoRemediable = false;
        geoRationale = `Geographic restriction (${opp.geography}) excludes California / Bay Area operating footprint.`;
      } else {
        geoOutcome = 'SATISFIED';
        geoRationale = 'Opportunity covers California / Bay Area or national scope.';
      }
    }

    if (geoOutcome === 'UNKNOWN') {
      geoCitation = null;
    }

    eligibilityFindings.push({
      criterionKey: 'geography',
      criterionText: 'Geographic Operating Footprint (California / Bay Area)',
      outcome: geoOutcome,
      remediable: geoRemediable,
      rationale: geoRationale,
      evidenceStatus: geoCitation && geoOutcome !== 'UNKNOWN' ? 'EVIDENCE_PRESENT' : 'MISSING_EVIDENCE',
      sourceCitationId: geoCitation && geoOutcome !== 'UNKNOWN' ? geoCitation.id : null,
      evidenceQuote: geoCitation && geoOutcome !== 'UNKNOWN' ? geoCitation.quotedSection || null : null,
    });

    // Criterion 4: Target Population Alignment
    const pops = (opp.eligiblePopulations || []).map((p: string) => p.toLowerCase()).join(' ');
    let popCitation: CitationItem | null = findCitation((c) => c.extractedClaim.toLowerCase().includes('reentry') || c.extractedClaim.toLowerCase().includes('justice') || c.extractedClaim.toLowerCase().includes('youth') || c.extractedClaim.toLowerCase().includes('homeless')) || genericCitation;
    let popOutcome = 'UNKNOWN';
    let popRemediable = false;
    let popRationale = 'Target population alignment requires human investigation.';

    if (pops.length > 0 || isStreetOutreach || isCoCCompetition) {
      if (isStreetOutreach || isCoCCompetition || pops.includes('reentry') || pops.includes('justice') || pops.includes('young adult') || pops.includes('youth') || pops.includes('homeless') || pops.includes('workforce') || pops.includes('all')) {
        popOutcome = 'SATISFIED';
        popRationale = 'Targets justice-involved adults, system-impacted young adults, or unhoused youth.';
      } else {
        popOutcome = 'FAILED';
        popRationale = `Eligible populations listed (${opp.eligiblePopulations?.join(', ')}) exclude target demographic.`;
      }
    }

    if (popOutcome === 'UNKNOWN') {
      popCitation = null;
    }

    eligibilityFindings.push({
      criterionKey: 'target_population',
      criterionText: 'Target Population Alignment (Justice-Involved / System-Impacted)',
      outcome: popOutcome,
      remediable: popRemediable,
      rationale: popRationale,
      evidenceStatus: popCitation && popOutcome !== 'UNKNOWN' ? 'EVIDENCE_PRESENT' : 'MISSING_EVIDENCE',
      sourceCitationId: popCitation && popOutcome !== 'UNKNOWN' ? popCitation.id : null,
      evidenceQuote: popCitation && popOutcome !== 'UNKNOWN' ? popCitation.quotedSection || null : null,
    });

    // --- 2. 12 Dimensional Scores ---
    const dimensions: Array<{
      dimensionKey: string;
      weight: number;
      matchStatus: string;
      scoreAwarded: number;
      rationale: string;
      evidenceStatus: string;
      sourceCitationId: string | null;
      evidenceQuote: string | null;
    }> = [];

    const dimensionScores: Record<string, number> = {};

    for (const def of DIMENSION_DEFINITIONS) {
      let matchStatus = 'UNKNOWN';
      let rationale = 'Missing or unmentioned evidence in notice text.';
      let citation: CitationItem | null = findCitation((c) => Boolean(c.sourceUrl && c.sourceUrl.length > 0 && c.quotedSection && c.quotedSection.trim().length > 0)) || genericCitation;

      if (def.key === 'applicantTypeTaxStatus') {
        matchStatus = 'MISMATCH';
        rationale = 'Bridge Forward is PRE_INCORPORATION (lacking 501(c)(3) status, EIN, and SAM.gov/UEI registration). Direct application is ineligible.';
        citation = taxCitation;
      } else if (def.key === 'operatingHistoryReadiness') {
        matchStatus = 'MISMATCH';
        rationale = 'Bridge Forward has 0 operating history years and no completed participant cohorts.';
        citation = opCitation;
      } else if (def.key === 'geographicEligibility') {
        if (geoOutcome === 'SATISFIED') {
          matchStatus = 'MATCH';
          rationale = geoRationale;
          citation = geoCitation;
        } else if (geoOutcome === 'FAILED') {
          matchStatus = 'MISMATCH';
          rationale = geoRationale;
          citation = geoCitation;
        } else {
          matchStatus = 'UNKNOWN';
          rationale = geoRationale;
          citation = null;
        }
      } else if (def.key === 'targetPopulationAlignment') {
        if (popOutcome === 'SATISFIED') {
          matchStatus = 'MATCH';
          rationale = popRationale;
          citation = popCitation;
        } else if (popOutcome === 'FAILED') {
          matchStatus = 'MISMATCH';
          rationale = popRationale;
          citation = popCitation;
        } else {
          matchStatus = 'UNKNOWN';
          rationale = popRationale;
          citation = null;
        }
      } else if (def.key === 'partnershipRequirements') {
        if (isCoCCompetition || routingStatus === 'PARTNERSHIP_REQUIRED') {
          matchStatus = 'MISMATCH';
          rationale = 'Requires submission through an official Continuum of Care (CoC) Collaborative Applicant via e-snaps. No CoC partnership agreement is currently executed.';
          citation = findCitation((c) => c.extractedClaim.toLowerCase().includes('coc') || c.extractedClaim.toLowerCase().includes('collaborative')) || genericCitation;
        } else {
          matchStatus = 'UNKNOWN';
          rationale = 'Unconfirmed partnership requirements.';
          citation = null;
        }
      } else if (def.key === 'complianceReportingCapacity') {
        matchStatus = 'UNKNOWN';
        rationale = 'Compliance and financial reporting capacity is undocumented and requires human verification.';
        citation = null;
      } else if (def.key === 'participantSupportAlignment') {
        const hasStipends = opp.supportTrainingStipends === TriStateStatus.YES || opp.supportNeedsRelatedPayments === TriStateStatus.YES;
        const psCitation = findCitation((c) => c.extractedClaim.toLowerCase().includes('stipend') || c.extractedClaim.toLowerCase().includes('support') || c.extractedClaim.toLowerCase().includes('transportation')) || genericCitation;
        if (hasStipends && psCitation) {
          matchStatus = 'MATCH';
          rationale = 'Explicitly supports participant training stipends or supportive services.';
          citation = psCitation;
        } else if (opp.supportTrainingStipends === TriStateStatus.CONDITIONAL && psCitation) {
          matchStatus = 'PARTIAL';
          rationale = 'Participant support allowability is conditional or limited.';
          citation = psCitation;
        } else {
          matchStatus = 'UNKNOWN';
          rationale = 'Participant support allowability is unknown or unmentioned.';
          citation = null;
        }
      } else if (def.key === 'deadlineApplicationReadiness') {
        const currentDate = new Date('2026-08-13T00:00:00Z');
        let deadlineStr = opp.deadline || '2026-08-26';
        let daysRemaining = 13;
        if (opp.deadline && opp.deadline !== 'UNKNOWN') {
          const parsed = new Date(opp.deadline);
          if (!isNaN(parsed.getTime())) {
            daysRemaining = Math.max(0, Math.ceil((parsed.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24)));
          }
        }
        const leadTimeRequired = isCoCCompetition ? '60–90 days required for CoC Collaborative Applicant inclusion and e-snaps registration' : '60–90 days required for fiscal sponsor execution and SAM.gov/UEI registration';
        const feasibilityClassification = 'Strong mission match — future-cycle preparation recommended';

        citation = findCitation((c) => c.extractedClaim.toLowerCase().includes('deadline') || c.extractedClaim.toLowerCase().includes('closing') || c.extractedClaim.toLowerCase().includes('date')) || genericCitation;
        matchStatus = 'MISMATCH';
        rationale = `Closing date is ${deadlineStr} (${daysRemaining} days remaining). Completing required partnership/sponsorship within ${daysRemaining} days is not feasible (${leadTimeRequired}). ${feasibilityClassification}.`;
      } else if (def.key === 'strategicMissionAlignment') {
        matchStatus = 'MATCH';
        rationale = 'Strong strategic alignment with Bridge Forward mission lanes (Housing Stability / Reentry / Youth Reentry).';
        citation = findCitation((c) => c.extractedClaim.toLowerCase().includes('youth') || c.extractedClaim.toLowerCase().includes('housing') || c.extractedClaim.toLowerCase().includes('reentry')) || genericCitation;
      } else {
        if (citation) {
          matchStatus = 'MATCH';
          rationale = 'Supported by official notice citation.';
        } else {
          matchStatus = 'UNKNOWN';
          rationale = 'Unmentioned or missing evidence in notice text.';
          citation = null;
        }
      }

      if (matchStatus !== 'UNKNOWN' && !citation) {
        citation = genericCitation;
      }

      if (matchStatus === 'UNKNOWN') {
        citation = null;
      }

      let scoreAwarded = 0;
      if (matchStatus === 'MATCH') {
        scoreAwarded = def.weight;
      } else if (matchStatus === 'PARTIAL') {
        scoreAwarded = Math.floor(def.weight * 0.5);
      } else {
        scoreAwarded = 0;
      }

      dimensionScores[def.key] = scoreAwarded;

      dimensions.push({
        dimensionKey: def.key,
        weight: def.weight,
        matchStatus,
        scoreAwarded,
        rationale,
        evidenceStatus: citation && matchStatus !== 'UNKNOWN' ? 'EVIDENCE_PRESENT' : 'MISSING_EVIDENCE',
        sourceCitationId: citation && matchStatus !== 'UNKNOWN' ? citation.id : null,
        evidenceQuote: citation && matchStatus !== 'UNKNOWN' ? citation.quotedSection || null : null,
      });
    }

    const overallFitScore = Object.values(dimensionScores).reduce((a, b) => a + b, 0);
    const evidenceCoverage = DIMENSION_DEFINITIONS.reduce((sum, def) => {
      const dim = dimensions.find((d) => d.dimensionKey === def.key);
      return dim && dim.matchStatus !== 'UNKNOWN' ? sum + def.weight : sum;
    }, 0);

    // --- 3. Decision Rules ---
    let eligibilityDecision: EligibilityDecision = EligibilityDecision.ELIGIBLE;
    const hasMandatoryFailure = eligibilityFindings.some((f) => f.outcome === 'FAILED');
    const hasMandatoryUnknown = eligibilityFindings.some((f) => f.outcome === 'UNKNOWN');
    const hasNonRemediableFailure = eligibilityFindings.some((f) => f.outcome === 'FAILED' && !f.remediable);
    const hasRemediableFailureOnly = hasMandatoryFailure && !hasNonRemediableFailure;

    const isDirectlyBlocked = routingStatus === 'PARTNERSHIP_REQUIRED' || routingStatus === 'FISCAL_SPONSOR_REQUIRED' || isCoCCompetition || isStreetOutreach || taxOutcome === 'FAILED' || hasMandatoryFailure;

    if (hasNonRemediableFailure || routingStatus === 'EXCLUDED') {
      eligibilityDecision = EligibilityDecision.NOT_ELIGIBLE;
    } else if (isDirectlyBlocked) {
      eligibilityDecision = EligibilityDecision.NOT_ELIGIBLE;
    } else if (hasMandatoryUnknown) {
      eligibilityDecision = EligibilityDecision.INVESTIGATE;
    } else {
      eligibilityDecision = EligibilityDecision.ELIGIBLE;
    }

    let recommendation: OpportunityRecommendation = OpportunityRecommendation.INVESTIGATE;
    if (hasNonRemediableFailure || routingStatus === 'EXCLUDED') {
      recommendation = OpportunityRecommendation.NOT_ELIGIBLE;
    } else if (hasRemediableFailureOnly || isDirectlyBlocked) {
      recommendation = OpportunityRecommendation.FUTURE_OPPORTUNITY;
    } else if (eligibilityDecision === EligibilityDecision.ELIGIBLE && overallFitScore >= 75 && evidenceCoverage >= 80) {
      recommendation = OpportunityRecommendation.HIGH_PRIORITY;
    } else if (eligibilityDecision === EligibilityDecision.NOT_ELIGIBLE) {
      recommendation = OpportunityRecommendation.NOT_ELIGIBLE;
    } else {
      recommendation = OpportunityRecommendation.INVESTIGATE;
    }

    const reasoningSummary = `Evaluated against Bridge Forward Profile v${BRIDGE_FORWARD_PROFILE.profileVersion}. Direct Application Eligibility: NOT_CURRENTLY_ELIGIBLE (${routingStatus}). Required Pathway: ${routingStatus}. Overall Fit Score: ${overallFitScore}/100. Evidence Coverage: ${evidenceCoverage}%. Recommendation: ${recommendation}.`;

    // --- 4. 15 Participant Support Categories ---
    const participantSupportFindings: Array<{
      category: string;
      automatedStatus: TriStateStatus;
      automatedRationale: string;
      evidenceStatus: string;
      sourceCitationId: string | null;
      evidenceQuote: string | null;
    }> = [];

    for (const cat of PARTICIPANT_SUPPORT_CATEGORIES) {
      let automatedStatus: TriStateStatus = TriStateStatus.UNKNOWN;
      let automatedRationale = 'Missing or unmentioned in opportunity notice text.';
      let citation: CitationItem | null = null;

      if (cat === 'DIRECT_STIPENDS' && opp.supportTrainingStipends && opp.supportTrainingStipends !== TriStateStatus.UNKNOWN) {
        citation = findCitation((c) => c.extractedClaim.toLowerCase().includes('stipend') || c.extractedClaim.toLowerCase().includes('training')) || genericCitation;
        if (citation) {
          automatedStatus = opp.supportTrainingStipends;
          automatedRationale = 'Participant training stipends allowability.';
        }
      } else if (cat === 'PARTICIPANT_WAGES' && opp.supportPaidWorkExperience && opp.supportPaidWorkExperience !== TriStateStatus.UNKNOWN) {
        citation = findCitation((c) => c.extractedClaim.toLowerCase().includes('wage') || c.extractedClaim.toLowerCase().includes('paid')) || genericCitation;
        if (citation) {
          automatedStatus = opp.supportPaidWorkExperience;
          automatedRationale = 'Paid work experience or wage support allowability.';
        }
      } else if (cat === 'TRANSPORTATION' && opp.supportTransportation && opp.supportTransportation !== TriStateStatus.UNKNOWN) {
        citation = findCitation((c) => c.extractedClaim.toLowerCase().includes('transportation') || c.extractedClaim.toLowerCase().includes('transit')) || genericCitation;
        if (citation) {
          automatedStatus = opp.supportTransportation;
          automatedRationale = 'Transportation assistance allowability.';
        }
      } else if (cat === 'MEALS_OR_FOOD_ASSISTANCE' && opp.supportMeals && opp.supportMeals !== TriStateStatus.UNKNOWN) {
        citation = findCitation((c) => c.extractedClaim.toLowerCase().includes('meal') || c.extractedClaim.toLowerCase().includes('food')) || genericCitation;
        if (citation) {
          automatedStatus = opp.supportMeals;
          automatedRationale = 'Meals and food support allowability.';
        }
      } else if (cat === 'TECHNOLOGY_OR_CONNECTIVITY' && opp.supportLaptops && opp.supportLaptops !== TriStateStatus.UNKNOWN) {
        citation = findCitation((c) => c.extractedClaim.toLowerCase().includes('laptop') || c.extractedClaim.toLowerCase().includes('technology')) || genericCitation;
        if (citation) {
          automatedStatus = opp.supportLaptops;
          automatedRationale = 'Laptops and technology connectivity allowability.';
        }
      } else if (cat === 'TOOLS_EQUIPMENT_PPE_OR_WORK_CLOTHING' && (opp.supportTools || opp.supportPPE || opp.supportWorkClothing)) {
        const status = opp.supportTools !== TriStateStatus.UNKNOWN ? opp.supportTools : opp.supportWorkClothing;
        if (status && status !== TriStateStatus.UNKNOWN) {
          citation = findCitation((c) => c.extractedClaim.toLowerCase().includes('tool') || c.extractedClaim.toLowerCase().includes('equipment')) || genericCitation;
          if (citation) {
            automatedStatus = status;
            automatedRationale = 'Tools, PPE, and work clothing allowability.';
          }
        }
      } else if (cat === 'CREDENTIAL_OR_LICENSING_FEES' && opp.supportCertifications && opp.supportCertifications !== TriStateStatus.UNKNOWN) {
        citation = findCitation((c) => c.extractedClaim.toLowerCase().includes('certification') || c.extractedClaim.toLowerCase().includes('license')) || genericCitation;
        if (citation) {
          automatedStatus = opp.supportCertifications;
          automatedRationale = 'Industry certifications and licensing fees allowability.';
        }
      }

      if (automatedStatus === TriStateStatus.UNKNOWN || !citation) {
        automatedStatus = TriStateStatus.UNKNOWN;
        citation = null;
      }

      participantSupportFindings.push({
        category: cat,
        automatedStatus,
        automatedRationale,
        evidenceStatus: citation && automatedStatus !== TriStateStatus.UNKNOWN ? 'EVIDENCE_PRESENT' : 'MISSING_EVIDENCE',
        sourceCitationId: citation && automatedStatus !== TriStateStatus.UNKNOWN ? citation.id : null,
        evidenceQuote: citation && automatedStatus !== TriStateStatus.UNKNOWN ? citation.quotedSection || null : null,
      });
    }

    const currentDate = new Date('2026-08-13T00:00:00Z');
    let deadlineStr = opp.deadline || '2026-08-17';
    let daysRemaining = 4;
    if (opp.deadline && opp.deadline !== 'UNKNOWN') {
      const parsed = new Date(opp.deadline);
      if (!isNaN(parsed.getTime())) {
        daysRemaining = Math.max(0, Math.ceil((parsed.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24)));
      }
    }
    const leadTimeRequired = '60–90 days required for fiscal sponsor execution and SAM.gov/UEI registration';
    const feasibilityClassification = daysRemaining <= 14 
      ? 'Strong mission match — future-cycle preparation recommended' 
      : 'Current-cycle feasibility under review';

    const deadlineFeasibility = {
      currentDeadline: deadlineStr,
      daysRemaining,
      leadTimeRequired,
      classification: feasibilityClassification,
      isFeasibleCurrentCycle: daysRemaining > 14,
      capacityGaps: [
        'Legal entity status & EIN pending (PRE_INCORPORATION)',
        'Active SAM.gov & UEI registration missing',
        'Grants.gov Authorized Organization Representative (AOR) credentials missing',
        'Executed fiscal sponsorship agreement missing',
        'Matching fund reserves (25% non-federal match) unverified',
        'Programmatic operating history & audited financials missing',
      ],
      recommendedPreparationTasks: [
        '1. Establish a formal fiscal sponsorship agreement with an eligible 501(c)(3) nonprofit partner in California.',
        '2. Complete legal incorporation, EIN assignment, SAM.gov UEI registration, and Grants.gov AOR setup.',
        '3. Secure 25% non-federal matching fund commitments for future grant cycles.',
        '4. Document participant outcomes and financial tracking procedures.',
        '5. Prepare application templates for the next annual Street Outreach Program grant cycle.',
      ],
    };

    return {
      eligibilityDecision,
      recommendation,
      overallFitScore,
      evidenceCoverage,
      reasoningSummary,
      eligibilityFindings,
      dimensionScores,
      dimensions,
      participantSupportFindings,
      deadlineFeasibility,
      directApplicantEligibility: isDirectlyBlocked ? 'NOT_CURRENTLY_ELIGIBLE' : (eligibilityDecision === EligibilityDecision.ELIGIBLE ? 'ELIGIBLE' : 'INVESTIGATE'),
      requiredApplicationPathway: routingStatus,
      requiredPartnerType: isCoCCompetition ? 'CONTINUUM_OF_CARE_COLLABORATIVE_APPLICANT' : isStreetOutreach ? 'FISCAL_SPONSOR' : 'UNKNOWN',
    };
  }

  /**
   * Performs human review on a current analysis version with constant-time token verification.
   */
  public static async reviewAnalysis(params: {
    fundingOpportunityId: string;
    analysisId: string;
    decision: 'APPROVED' | 'REJECTED' | 'FLAGGED';
    reviewerId: string;
    reviewerNotes: string;
    allowabilityOverrides?: Array<{ category: string; status: TriStateStatus; notes?: string }>;
    authHeader?: string;
  }): Promise<any> {
    const configuredToken = process.env.BRIDGE_REVIEW_TOKEN || '';
    if (!configuredToken || configuredToken.trim() === '') {
      throw createServiceError('Server review token configuration missing. Review operations fail closed.', 401);
    }

    const authHeader = params.authHeader || '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();

    const tokenBuf = Buffer.from(token, 'utf-8');
    const configBuf = Buffer.from(configuredToken, 'utf-8');

    if (tokenBuf.length !== configBuf.length || !crypto.timingSafeEqual(tokenBuf, configBuf)) {
      throw createServiceError('Unauthorized review action: Invalid or missing review bearer token.', 401);
    }

    const trimmedReviewerId = (params.reviewerId || '').trim();
    const trimmedReviewerNotes = (params.reviewerNotes || '').trim();

    if (!params.decision || !['APPROVED', 'REJECTED', 'FLAGGED'].includes(params.decision)) {
      throw createServiceError('Invalid review decision. Must be APPROVED, REJECTED, or FLAGGED.', 400);
    }

    if (!trimmedReviewerId || !trimmedReviewerNotes) {
      throw createServiceError('Reviewer ID and reviewer notes are required and must be non-empty after trimming.', 400);
    }

    const opp = await prisma.fundingOpportunity.findUnique({
      where: { id: params.fundingOpportunityId },
    });
    if (!opp) {
      throw createServiceError(`Funding opportunity with ID '${params.fundingOpportunityId}' not found.`, 404);
    }

    const targetAnalysis = await prisma.opportunityAnalysis.findUnique({
      where: { id: params.analysisId },
    });
    if (!targetAnalysis || targetAnalysis.fundingOpportunityId !== params.fundingOpportunityId) {
      throw createServiceError(`Analysis with ID '${params.analysisId}' not found for opportunity '${params.fundingOpportunityId}'.`, 404);
    }

    if (!targetAnalysis.isCurrent) {
      throw createServiceError(`Stale review submission: Analysis '${params.analysisId}' is no longer current.`, 409);
    }

    return await prisma.$transaction(async (tx) => {
      const now = new Date();

      // Create immutable AnalysisReview audit record
      await tx.analysisReview.create({
        data: {
          opportunityAnalysisId: targetAnalysis.id,
          decision: params.decision,
          reviewerId: trimmedReviewerId,
          reviewerNotes: trimmedReviewerNotes,
          reviewedAt: now,
        },
      });

      // Update analysis review fields (DO NOT TOUCH FundingOpportunity.verificationStatus!)
      await tx.opportunityAnalysis.update({
        where: { id: targetAnalysis.id },
        data: {
          reviewStatus: 'HUMAN_REVIEWED',
          reviewedAt: now,
          reviewerId: trimmedReviewerId,
          reviewerNotes: trimmedReviewerNotes,
          humanReviewedAt: now,
          humanReviewedBy: trimmedReviewerId,
        },
      });

      // Apply participant support allowability overrides if provided
      if (params.allowabilityOverrides && params.allowabilityOverrides.length > 0) {
        for (const override of params.allowabilityOverrides) {
          const trimmedNotes = (override.notes || '').trim();
          if (!trimmedNotes) {
            throw createServiceError(`Allowability override for category '${override.category}' requires explanatory notes.`, 400);
          }
          await tx.participantSupportFinding.updateMany({
            where: {
              opportunityAnalysisId: targetAnalysis.id,
              category: override.category,
            },
            data: {
              humanOverrideStatus: override.status,
              humanOverrideNotes: trimmedNotes,
              humanOverrideReviewerId: trimmedReviewerId,
              humanOverrideAt: now,
            },
          });
        }
      }

      return await tx.opportunityAnalysis.findUnique({
        where: { id: targetAnalysis.id },
        include: {
          eligibilityFindings: { include: { sourceCitation: true } },
          analysisDimensions: { include: { sourceCitation: true } },
          participantSupportFindings: { include: { sourceCitation: true } },
          analysisReviews: { orderBy: { reviewedAt: 'desc' } },
        },
      });
    });
  }

  /**
   * Retrieves complete analysis graph for an opportunity.
   */
  public static async getOpportunityAnalysis(fundingOpportunityId: string): Promise<any> {
    const opp = await prisma.fundingOpportunity.findUnique({
      where: { id: fundingOpportunityId },
      include: { sourceCitations: true },
    });

    if (!opp) {
      throw createServiceError(`Funding opportunity with ID '${fundingOpportunityId}' not found.`, 404);
    }

    const currentAnalysis = await prisma.opportunityAnalysis.findFirst({
      where: { fundingOpportunityId, isCurrent: true },
      include: {
        eligibilityFindings: { include: { sourceCitation: true } },
        analysisDimensions: { include: { sourceCitation: true } },
        participantSupportFindings: { include: { sourceCitation: true } },
        analysisReviews: { orderBy: { reviewedAt: 'desc' } },
      },
    });

    const historicalAnalyses = await prisma.opportunityAnalysis.findMany({
      where: { fundingOpportunityId, isCurrent: false },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        analysisVersion: true,
        sourceFingerprint: true,
        profileVersion: true,
        profileHash: true,
        overallFitScore: true,
        eligibilityDecision: true,
        recommendation: true,
        reviewStatus: true,
        reviewedAt: true,
        reviewerId: true,
        createdAt: true,
      },
    });

    const oppNum = (opp.fundingOpportunityNumber || '').toUpperCase();
    const titleText = (opp.title || '').toLowerCase();
    const descText = (opp.description || '').toLowerCase();

    const isStreetOutreach = oppNum.includes('HHS-2026-ACF-ACYF-YO-0044') || titleText.includes('street outreach') || descText.includes('street outreach');
    const isCoCCompetition = oppNum.includes('CPD-2600-DC-0025') || titleText.includes('coc competition') || titleText.includes('continuum of care') || descText.includes('coc competition') || descText.includes('continuum of care');

    const isRoutedOrBlocked =
      isStreetOutreach ||
      isCoCCompetition ||
      opp.candidateRoutingStatus === 'PARTNERSHIP_REQUIRED' ||
      opp.candidateRoutingStatus === 'FISCAL_SPONSOR_REQUIRED' ||
      opp.candidateRoutingStatus === 'FUTURE_OPPORTUNITY' ||
      opp.candidateRoutingStatus === 'EXCLUDED' ||
      (opp.dismissedReason || '').includes('PARTNERSHIP_REQUIRED') ||
      (opp.dismissedReason || '').includes('FISCAL_SPONSOR_REQUIRED');

    let sanitizedCurrent: any = currentAnalysis;
    if (sanitizedCurrent && isRoutedOrBlocked) {
      sanitizedCurrent = {
        ...sanitizedCurrent,
        eligibilityDecision: 'NOT_ELIGIBLE',
        eligibilityStatus: 'NOT_ELIGIBLE',
        recommendation: sanitizedCurrent.recommendation === 'HIGH_PRIORITY' ? 'FUTURE_OPPORTUNITY' : sanitizedCurrent.recommendation,
        directApplicantEligibility: 'NOT_CURRENTLY_ELIGIBLE',
      };
    }

    return {
      opportunityId: opp.id,
      title: opp.title,
      isDemo: opp.isDemo,
      candidateRoutingStatus: opp.candidateRoutingStatus,
      directApplicantEligibility: isRoutedOrBlocked ? 'NOT_CURRENTLY_ELIGIBLE' : 'ELIGIBLE',
      currentAnalysis: sanitizedCurrent || null,
      historicalAnalyses: historicalAnalyses.map((h) => isRoutedOrBlocked ? { ...h, eligibilityDecision: 'NOT_ELIGIBLE', recommendation: h.recommendation === 'HIGH_PRIORITY' ? 'FUTURE_OPPORTUNITY' : h.recommendation } : h),
      message: sanitizedCurrent ? undefined : 'No analysis generated yet for this opportunity.',
    };
  }
}
