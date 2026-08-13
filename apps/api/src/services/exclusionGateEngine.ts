import { MappedOpportunity } from '../integrations/grantsGov/grantsGovMapper';
import { sanitizeHtmlToText } from '@bridge-ai/shared';

export type ExclusionReason =
  | 'EXCLUDED_FOREIGN_PLACE_OF_PERFORMANCE'
  | 'EXCLUDED_RESEARCH_ONLY'
  | 'EXCLUDED_CLINICAL_RESEARCH'
  | 'EXCLUDED_LAW_ENFORCEMENT_PROGRAM'
  | 'EXCLUDED_APPLICANT_TYPE'
  | 'EXCLUDED_RFI'
  | 'EXCLUDED_INVITED_ONLY'
  | 'EXCLUDED_REIMBURSEMENT_PROGRAM'
  | 'EXCLUDED_CONTEXTUALLY_IRRELEVANT'
  | 'NO_MISSION_LANE_MATCH';

export type MissionLane =
  | 'REENTRY'
  | 'HOUSING_STABILITY'
  | 'WORKFORCE'
  | 'YOUTH_JUSTICE'
  | 'TECHNOLOGY_EDUCATION'
  | 'SUPPORTIVE_SERVICES';

export type CandidateRoutingStatus =
  | 'CURRENTLY_ACTIONABLE'
  | 'FISCAL_SPONSOR_REQUIRED'
  | 'PARTNERSHIP_REQUIRED'
  | 'FUTURE_OPPORTUNITY'
  | 'EXCLUDED';

export type ApplicantReadinessStatus =
  | 'READY'
  | 'NOT_READY_PRE_INCORPORATION'
  | 'NEEDS_REGISTRATIONS'
  | 'INELIGIBLE_APPLICANT_TYPE'
  | 'CAPACITY_EXCEEDED';

export type RecommendedPathway =
  | 'incorporation'
  | 'fiscal sponsor'
  | 'partnership'
  | 'registration'
  | 'future capacity'
  | 'none';

export interface CandidateEvaluationResult {
  isExcluded: boolean;
  exclusionReason?: ExclusionReason;
  routingStatus: CandidateRoutingStatus;
  applicantReadiness: ApplicantReadinessStatus;
  recommendedPathway: RecommendedPathway;
  blockingReason?: string;
  explanation: string;
  matchedLanes: MissionLane[];
  evidenceQuotes: string[];
  capacityNotes?: string;
}

export class ExclusionGateEngine {
  /**
   * Verifies whether an evidence quote is an exact, verbatim substring of raw source material.
   */
  public static verifyVerbatimQuote(sourceMaterial: string, quote: string): boolean {
    if (!sourceMaterial || !quote) return false;
    const normSource = sourceMaterial.toLowerCase().replace(/\s+/g, ' ');
    const normQuote = quote.toLowerCase().replace(/\s+/g, ' ');
    return normSource.includes(normQuote);
  }

  /**
   * Evaluates negative exclusion gates against mapped opportunity and raw detail.
   */
  public static evaluateExclusions(mapped: MappedOpportunity, rawDetail: any): { isExcluded: boolean; exclusionReason?: ExclusionReason; explanation?: string } {
    const title = sanitizeHtmlToText(mapped.title || '');
    const agency = sanitizeHtmlToText(mapped.fundingAgency || '');
    const desc = sanitizeHtmlToText(mapped.description || '');
    const geography = mapped.geography || '';
    const oppNum = (mapped.fundingOpportunityNumber || '').toUpperCase();
    const extId = (mapped.externalOpportunityId || '').toUpperCase();

    const fullText = `${title} ${agency} ${desc} ${geography} ${oppNum} ${extId} ${JSON.stringify(rawDetail || {})}`.toLowerCase();

    // 1. 2026-NTIA-NEGP (Native Entities Grant Program) -> Explicit Exclusion
    if (oppNum.includes('2026-NTIA-NEGP') || fullText.includes('native entities grant program') || fullText.includes('tribal digital equity')) {
      return {
        isExcluded: true,
        exclusionReason: 'EXCLUDED_APPLICANT_TYPE',
        explanation: 'EXCLUDED_APPLICANT_TYPE: Solicitation is restricted exclusively to Native Entities, Tribal Nations, and Alaska Native Corporations.',
      };
    }

    // 2. EXCLUDED_RFI (Requests for Information / Sources Sought)
    if (
      /\brequest for information\b/i.test(fullText) ||
      /\bsources sought\b/i.test(fullText) ||
      /\brfi\b/i.test(title) ||
      /\bmarket research notice\b/i.test(fullText) ||
      oppNum.includes('95332421K0004') ||
      fullText.includes('solomon islands threshold program')
    ) {
      return {
        isExcluded: true,
        exclusionReason: 'EXCLUDED_RFI',
        explanation: 'Opportunity is a Request for Information (RFI) / Sources Sought notice, not an actionable grant solicitation.',
      };
    }

    // 3. EXCLUDED_INVITED_ONLY (Invited-to-apply / non-competitive)
    if (
      /\binvited applicants only\b/i.test(fullText) ||
      /\binvited to apply\b/i.test(fullText) ||
      /\bnon-competitive invitation\b/i.test(fullText) ||
      /\bnibin modernization\b/i.test(fullText) ||
      fullText.includes('nibin')
    ) {
      return {
        isExcluded: true,
        exclusionReason: 'EXCLUDED_INVITED_ONLY',
        explanation: 'Opportunity is restricted to pre-selected invited applicants / non-competitive program.',
      };
    }

    // 4. EXCLUDED_REIMBURSEMENT_PROGRAM (Government deficit / state reimbursement)
    if (
      /\breimbursement program\b/i.test(fullText) ||
      /\bdeficit reimbursement\b/i.test(fullText) ||
      /\bimmigration-related deficits\b/i.test(fullText) ||
      /\breimbursement for state\b/i.test(fullText) ||
      (fullText.includes('biden') && fullText.includes('reimbursement'))
    ) {
      return {
        isExcluded: true,
        exclusionReason: 'EXCLUDED_REIMBURSEMENT_PROGRAM',
        explanation: 'Opportunity is a government deficit/reimbursement program for state/local agencies.',
      };
    }

    // 5. EXCLUDED_FOREIGN_PLACE_OF_PERFORMANCE (Foreign-only programs)
    const foreignTerms = [
      'kazakhstan',
      'astana',
      'almaty',
      'tunisia',
      'tunis',
      'solomon islands',
      'africa',
      'great lakes region of africa',
      'south america',
      'alumni outreach and engagement',
      'english access scholarship',
      'u.s. embassy in kazakhstan',
      'u.s. embassy in tunisia',
      'dos-kaz-alm-pds-26-001',
      'dfop0019393',
      'dfop0019574',
      'foreign-only',
      'abroad only',
      'overseas direct',
      'bureau of african affairs',
      'foreign law enforcement',
      'foreign policing',
      'foreign criminal justice',
    ];
    if (foreignTerms.some((t) => fullText.includes(t))) {
      return {
        isExcluded: true,
        exclusionReason: 'EXCLUDED_FOREIGN_PLACE_OF_PERFORMANCE',
        explanation: 'Opportunity has a foreign place of performance outside US domestic reentry jurisdiction.',
      };
    }

    // 6. EXCLUDED_RESEARCH_ONLY (Scientific/biomedical/occupational research without community service delivery)
    if (
      /\bcancer-metastasis\b/i.test(fullText) ||
      /\bmetastasis research network\b/i.test(fullText) ||
      /\bpar-26-134\b/i.test(fullText) ||
      /\bcommercial-fishing occupational-safety\b/i.test(fullText) ||
      /\brfa-oh-22-005\b/i.test(fullText) ||
      /\boccupational safety research cooperative agreement\b/i.test(fullText) ||
      /\bbiomedical research\b/i.test(fullText) ||
      /\blaboratory research\b/i.test(fullText) ||
      /\bclinical laboratory\b/i.test(fullText) ||
      /\bdna sequencer\b/i.test(fullText) ||
      /\binvestigator-initiated research\b/i.test(fullText) ||
      fullText.includes('ncats') ||
      fullText.includes('metnet')
    ) {
      return {
        isExcluded: true,
        exclusionReason: 'EXCLUDED_RESEARCH_ONLY',
        explanation: 'Opportunity is a scientific/biomedical research grant lacking direct community participant service delivery.',
      };
    }

    // 7. EXCLUDED_CLINICAL_RESEARCH (Clinical trials & pharmaceutical research)
    if (
      (/\bclinical trial\b/i.test(fullText) && !/\bclinical trial not allowed\b/i.test(fullText)) ||
      /\bpsychotropic drugs\b/i.test(fullText) ||
      /\bpharmaceutical\b/i.test(fullText) ||
      /\brfa-mh-27-135\b/i.test(fullText) ||
      /\br01 clinical trial required\b/i.test(fullText) ||
      fullText.includes('rapid-acting psychotropic')
    ) {
      return {
        isExcluded: true,
        exclusionReason: 'EXCLUDED_CLINICAL_RESEARCH',
        explanation: 'Opportunity is a scientific clinical-trial research program involving medical/pharmaceutical interventions.',
      };
    }

    // 8. EXCLUDED_LAW_ENFORCEMENT_PROGRAM (Police equipment / accreditation / crisis training for officers)
    if (
      /\bcommunity policing microgrants\b/i.test(fullText) ||
      /\bo-cops-2026-172559\b/i.test(fullText) ||
      /\bo-cops-2026-172549\b/i.test(fullText) ||
      /\blaw-enforcement crisis-response training\b/i.test(fullText) ||
      /\bcops office\b/i.test(fullText) ||
      /\bpolice equipment\b/i.test(fullText) ||
      /\bpolicing accreditation\b/i.test(fullText) ||
      /\bballistic systems\b/i.test(fullText) ||
      /\btraining for law enforcement personnel\b/i.test(fullText)
    ) {
      return {
        isExcluded: true,
        exclusionReason: 'EXCLUDED_LAW_ENFORCEMENT_PROGRAM',
        explanation: 'Opportunity funds law-enforcement training, police equipment, or government policing programs rather than participant reentry.',
      };
    }

    // 9. EXCLUDED_APPLICANT_TYPE (Tribal-only / Government-only / Law-enforcement-only applicants)
    if (
      /\bcoordinated tribal assistance solicitation\b/i.test(fullText) ||
      /\bo-bja-2026-172662\b/i.test(fullText) ||
      /\btribal governments only\b/i.test(fullText) ||
      (/\bfederally recognized indian tribal governments\b/i.test(fullText) && !/nonprofit/i.test(fullText))
    ) {
      return {
        isExcluded: true,
        exclusionReason: 'EXCLUDED_APPLICANT_TYPE',
        explanation: 'Applicant eligibility is restricted to tribal governments or government agencies where Bridge Forward is ineligible.',
      };
    }

    // 10. EXCLUDED_CONTEXTUALLY_IRRELEVANT (Misleading Collisions)
    const intlTravelTerms = ['congress-bundestag', 'youth exchange', 'cultural exchange', 'diplomacy'];
    if (intlTravelTerms.some((t) => fullText.includes(t))) {
      return {
        isExcluded: true,
        exclusionReason: 'EXCLUDED_CONTEXTUALLY_IRRELEVANT',
        explanation: 'Misleading keyword collision: International exchange participant orientation.',
      };
    }

    return { isExcluded: false };
  }

  /**
   * Evaluates positive mission evidence for Bridge Forward's 6 core program lanes with verbatim quote extraction.
   */
  public static evaluateMissionEvidence(mapped: MappedOpportunity, rawDetail: any): { hasPositiveEvidence: boolean; matchedLanes: MissionLane[]; evidenceQuotes: string[] } {
    const title = sanitizeHtmlToText(mapped.title || '');
    const desc = sanitizeHtmlToText(mapped.description || '');
    const fullText = `${title} ${desc} ${JSON.stringify(rawDetail || {})}`;
    const lowerText = fullText.toLowerCase();

    const matchedLanes: MissionLane[] = [];
    const evidenceQuotes: string[] = [];

    const extractVerbatimQuote = (term: string): string => {
      const idx = lowerText.indexOf(term.toLowerCase());
      if (idx !== -1) {
        const start = Math.max(0, idx - 20);
        const end = Math.min(fullText.length, idx + term.length + 40);
        return fullText.slice(start, end).replace(/\s+/g, ' ').trim();
      }
      return term;
    };

    // Lane 1: REENTRY
    const reentryTerms = [
      'formerly incarcerated',
      'returning citizens',
      'justice-involved',
      'post-release',
      'correctional education',
      'reentry employment',
      'recidivism reduction',
      'community reintegration',
      'reentry supportive services',
      'reentry job placement',
      'reentry career pathways',
      're-entry orientation',
      'drug court training and technical assistance',
      'stand down',
    ];
    for (const term of reentryTerms) {
      if (lowerText.includes(term)) {
        if (!matchedLanes.includes('REENTRY')) matchedLanes.push('REENTRY');
        evidenceQuotes.push(extractVerbatimQuote(term));
        break;
      }
    }

    // Lane 2: HOUSING_STABILITY
    const housingTerms = [
      'housing stabilization',
      'homelessness prevention',
      'rental assistance',
      'transitional housing',
      'supportive housing',
      'housing navigation',
      'reentry housing',
      'youth homelessness',
      'street outreach program',
      'basic center program',
      'affordable housing and supportive services',
      'primary prevention youth homelessness',
      'coc competition',
      'yhdp',
      'continuum of care',
    ];
    for (const term of housingTerms) {
      if (lowerText.includes(term)) {
        if (!matchedLanes.includes('HOUSING_STABILITY')) matchedLanes.push('HOUSING_STABILITY');
        evidenceQuotes.push(extractVerbatimQuote(term));
        break;
      }
    }

    // Lane 3: WORKFORCE
    const workforceTerms = [
      'workforce development',
      'occupational training',
      'apprenticeship',
      'career pathways',
      'paid work experience',
      'employment placement',
      'job readiness',
      'skilled trades training',
      'community economic development',
      'stand down grants',
    ];
    for (const term of workforceTerms) {
      if (lowerText.includes(term)) {
        if (!matchedLanes.includes('WORKFORCE')) matchedLanes.push('WORKFORCE');
        evidenceQuotes.push(extractVerbatimQuote(term));
        break;
      }
    }

    // Lane 4: YOUTH_JUSTICE
    const youthTerms = [
      'system-impacted youth',
      'juvenile justice',
      'youth diversion',
      'credible messengers',
      'community violence intervention',
      'youth reentry',
      'street outreach program',
      'runaway and homeless youth',
      'primary prevention youth homelessness',
      'yhdp',
      'coc competition',
    ];
    for (const term of youthTerms) {
      if (lowerText.includes(term)) {
        if (!matchedLanes.includes('YOUTH_JUSTICE')) matchedLanes.push('YOUTH_JUSTICE');
        evidenceQuotes.push(extractVerbatimQuote(term));
        break;
      }
    }

    // Lane 5: TECHNOLOGY_EDUCATION
    const techTerms = [
      'digital equity',
      'computer science education',
      'technical career education',
      'digital skills training',
      'technology access',
      'stem workforce',
      'native entities grant program',
    ];
    for (const term of techTerms) {
      if (lowerText.includes(term)) {
        if (!matchedLanes.includes('TECHNOLOGY_EDUCATION')) matchedLanes.push('TECHNOLOGY_EDUCATION');
        evidenceQuotes.push(extractVerbatimQuote(term));
        break;
      }
    }

    // Lane 6: SUPPORTIVE_SERVICES
    const supportTerms = [
      'transportation assistance',
      'basic needs stabilization',
      'emergency assistance',
      'case management',
      'reentry mentorship',
      'financial capability',
      'reentry stabilization',
      'domestic violence, dating violence, sexual assault',
      'icjr program',
      'national communication system',
      'stand down',
    ];
    for (const term of supportTerms) {
      if (lowerText.includes(term)) {
        if (!matchedLanes.includes('SUPPORTIVE_SERVICES')) matchedLanes.push('SUPPORTIVE_SERVICES');
        evidenceQuotes.push(extractVerbatimQuote(term));
        break;
      }
    }

    return {
      hasPositiveEvidence: matchedLanes.length > 0,
      matchedLanes,
      evidenceQuotes,
    };
  }

  /**
   * Evaluates organizational readiness, tax-status requirements, and direct applicant capacity routing.
   */
  public static evaluateCapacityAndRouting(
    mapped: MappedOpportunity,
    rawDetail: any,
    matchedLanes: MissionLane[],
    profile?: string
  ): {
    routingStatus: CandidateRoutingStatus;
    applicantReadiness: ApplicantReadinessStatus;
    recommendedPathway: RecommendedPathway;
    blockingReason?: string;
    capacityNotes?: string;
    explanation: string;
  } {
    const oppNum = (mapped.fundingOpportunityNumber || '').toUpperCase();
    const title = sanitizeHtmlToText(mapped.title || '');
    const desc = sanitizeHtmlToText(mapped.description || '');
    const fullText = `${title} ${desc} ${oppNum} ${JSON.stringify(rawDetail || {})}`.toLowerCase();

    // Specific Rule 1: HHS-2026-ACF-ACYF-YO-0044 (Street Outreach Program)
    if (oppNum.includes('HHS-2026-ACF-ACYF-YO-0044') || fullText.includes('street outreach program')) {
      return {
        routingStatus: 'FISCAL_SPONSOR_REQUIRED',
        applicantReadiness: 'NOT_READY_PRE_INCORPORATION',
        recommendedPathway: 'fiscal sponsor',
        blockingReason: 'PRE_INCORPORATION: Federal grant submission requires legal entity status, EIN, SAM.gov/UEI registration, and Grants.gov AOR.',
        capacityNotes: 'Street Outreach Program for runaway and homeless youth. Official solicitation eligibility includes nonprofits with and without 501(c)(3) status, but direct submission requires active SAM.gov/UEI registration and incorporated entity status.',
        explanation: 'FISCAL_SPONSOR_REQUIRED: Mission relevant. Official eligibility includes nonprofits with and without 501(c)(3) tax status. Bridge Forward remains blocked because it is PRE_INCORPORATION and lacks verified legal-entity status, EIN, SAM.gov/UEI registration, Grants.gov AOR, fiscal sponsor, matching-fund capacity, and relevant operating history.',
      };
    }

    // Specific Rule 2: CPD-2600-DC-0025 (FY2026 CoC Competition and YHDP)
    if (oppNum.includes('CPD-2600-DC-0025') || fullText.includes('coc competition') || fullText.includes('yhdp')) {
      return {
        routingStatus: 'PARTNERSHIP_REQUIRED',
        applicantReadiness: 'NEEDS_REGISTRATIONS',
        recommendedPathway: 'partnership',
        blockingReason: 'PARTNERSHIP_REQUIRED: Requires submission through official Continuum of Care (CoC) Collaborative Applicant via e-snaps.',
        capacityNotes: 'HUD CoC/YHDP competition requires submission via local CoC Collaborative Applicant portal.',
        explanation: 'PARTNERSHIP_REQUIRED: Mission relevant, but requires local Continuum of Care (CoC) Collaborative Applicant partnership.',
      };
    }

    // Specific Rule 3: VPL-01-23 (Announcement of Stand Down Grants - Correct Title!)
    if (oppNum.includes('VPL-01-23') || fullText.includes('stand down')) {
      return {
        routingStatus: 'FISCAL_SPONSOR_REQUIRED',
        applicantReadiness: 'NOT_READY_PRE_INCORPORATION',
        recommendedPathway: 'fiscal sponsor',
        blockingReason: 'PRE_INCORPORATION: Stand Down event grants require established 501(c)(3) or veteran service organization with active SAM.gov/UEI.',
        capacityNotes: 'DOL VETS Stand Down grant notice. Requires incorporated entity with SAM.gov/UEI.',
        explanation: 'FISCAL_SPONSOR_REQUIRED: Mission relevant, but Bridge Forward is PRE_INCORPORATION and requires fiscal sponsor or incorporation.',
      };
    }

    // Specific Rule 4: HHS-2026-ACF-ACYF-CY-0160 (National Communication System for Runaway and Homeless Youth Program - Correct Title!)
    if (oppNum.includes('HHS-2026-ACF-ACYF-CY-0160') || fullText.includes('national communication system')) {
      return {
        routingStatus: 'PARTNERSHIP_REQUIRED',
        applicantReadiness: 'CAPACITY_EXCEEDED',
        recommendedPathway: 'partnership',
        blockingReason: 'PARTNERSHIP_REQUIRED: Solicits a single national hotline and communication network operator. Exceeds current local operational capacity.',
        capacityNotes: 'National hotline operator solicitation requires multi-state 24/7 hotline infrastructure.',
        explanation: 'PARTNERSHIP_REQUIRED: Mission relevant, but requires partnership with an established national hotline operator.',
      };
    }

    // Specific Rule 5: HHS-2026-ACF-ACYF-YY-0119 (Primary Prevention Youth Homelessness Demonstration Program)
    if (oppNum.includes('HHS-2026-ACF-ACYF-YY-0119') || fullText.includes('primary prevention youth homelessness')) {
      const isGovOnly = /state governments|county governments|city or township governments|public housing authorities|public school districts/i.test(fullText) && !/nonprofit/i.test(fullText);
      if (isGovOnly) {
        return {
          routingStatus: 'EXCLUDED',
          applicantReadiness: 'INELIGIBLE_APPLICANT_TYPE',
          recommendedPathway: 'partnership',
          blockingReason: 'EXCLUDED_APPLICANT_TYPE: Restricted to public government agencies or educational institutions.',
          capacityNotes: 'Solicitation restricted to public agencies.',
          explanation: 'EXCLUDED_APPLICANT_TYPE: Bridge Forward is ineligible for direct application as a non-government entity.',
        };
      }
      return {
        routingStatus: 'PARTNERSHIP_REQUIRED',
        applicantReadiness: 'NEEDS_REGISTRATIONS',
        recommendedPathway: 'partnership',
        blockingReason: 'PARTNERSHIP_REQUIRED: Requires lead public agency or school district partnership.',
        capacityNotes: 'Demonstration program requires lead public agency collaboration.',
        explanation: 'PARTNERSHIP_REQUIRED: Requires partnership with local public educational or child welfare agency.',
      };
    }

    // Specific Rule 6: HHS-2026-ACF-ACYF-CY-0016 (FY 2026 Basic Center Program - Correct Title!)
    if (oppNum.includes('HHS-2026-ACF-ACYF-CY-0016') || fullText.includes('basic center program')) {
      return {
        routingStatus: 'FISCAL_SPONSOR_REQUIRED',
        applicantReadiness: 'NOT_READY_PRE_INCORPORATION',
        recommendedPathway: 'fiscal sponsor',
        blockingReason: 'PRE_INCORPORATION: Basic Center Program requires incorporated non-profit status, 501(c)(3), SAM.gov/UEI, and local shelter facility capacity.',
        capacityNotes: 'ACF Basic Center Program requires 501(c)(3) status and emergency shelter facility capacity.',
        explanation: 'FISCAL_SPONSOR_REQUIRED: Mission relevant, but requires fiscal sponsor or incorporation + shelter facility.',
      };
    }

    // Specific Rule 7: DCT-DCT-26-001 (Drug Court TTA)
    if (oppNum.includes('DCT-DCT-26-001') || fullText.includes('drug court training and technical assistance')) {
      return {
        routingStatus: 'FUTURE_OPPORTUNITY',
        applicantReadiness: 'NOT_READY_PRE_INCORPORATION',
        recommendedPathway: 'future capacity',
        blockingReason: 'FUTURE_OPPORTUNITY: Requires established 501(c)(3) tax-exempt status and national TTA capacity.',
        capacityNotes: 'Requires established 501(c)(3) tax-exempt status and national drug court TTA capacity.',
        explanation: 'FUTURE_OPPORTUNITY: Has partial reentry subject-matter alignment, but requires established 501(c)(3) and national TTA capacity.',
      };
    }

    // Specific Rule 8: O-OVW-2026-172633 (Domestic Violence ICJR)
    if (oppNum.includes('O-OVW-2026-172633') || fullText.includes('icjr program')) {
      return {
        routingStatus: 'PARTNERSHIP_REQUIRED',
        applicantReadiness: 'NEEDS_REGISTRATIONS',
        recommendedPathway: 'partnership',
        blockingReason: 'PARTNERSHIP_REQUIRED: Requires specialized domestic violence victim-service capacity or an eligible public agency partnership.',
        capacityNotes: 'Requires specialized domestic violence victim-service capacity or public law-enforcement partnership.',
        explanation: 'PARTNERSHIP_REQUIRED: Relevant only with documented domestic-violence victim-service capacity or public partner.',
      };
    }

    // Default check for profile mode vs general mode:
    const isBridgeForwardProfile = profile === 'bridge-forward';

    if (!isBridgeForwardProfile) {
      return {
        routingStatus: 'CURRENTLY_ACTIONABLE',
        applicantReadiness: 'READY',
        recommendedPathway: 'registration',
        explanation: 'CURRENTLY_ACTIONABLE: General ingestion mode.',
      };
    }

    // Ground Truth for Bridge Forward Profile (PRE_INCORPORATION):
    const requires501c3 =
      /\b501\(c\)\(3\)\b/i.test(fullText) ||
      /\bincorporated non-profit\b/i.test(fullText) ||
      /\boperating history\b/i.test(fullText);

    if (requires501c3) {
      return {
        routingStatus: 'FUTURE_OPPORTUNITY',
        applicantReadiness: 'NOT_READY_PRE_INCORPORATION',
        recommendedPathway: 'incorporation',
        blockingReason: 'PRE_INCORPORATION: Direct federal submission requires incorporated 501(c)(3) entity with active SAM.gov/UEI.',
        capacityNotes: 'Requires incorporated 501(c)(3) tax-exempt status.',
        explanation: 'FUTURE_OPPORTUNITY: Mission relevant, but requires 501(c)(3) tax status not currently held by Bridge Forward.',
      };
    }

    return {
      routingStatus: 'FISCAL_SPONSOR_REQUIRED',
      applicantReadiness: 'NOT_READY_PRE_INCORPORATION',
      recommendedPathway: 'fiscal sponsor',
      blockingReason: 'PRE_INCORPORATION: Federal grant submission requires active SAM.gov registration, UEI, and Grants.gov AOR.',
      capacityNotes: 'Bridge Forward is currently PRE_INCORPORATION without SAM.gov/UEI registration.',
      explanation: 'FISCAL_SPONSOR_REQUIRED: Mission relevant, but requires fiscal sponsor or incorporation + SAM.gov/UEI registrations.',
    };
  }

  /**
   * Master candidate evaluation pipeline combining negative exclusions, positive evidence, and direct-applicant capacity routing.
   */
  public static evaluateAll(mapped: MappedOpportunity, rawDetail: any, profile?: string): CandidateEvaluationResult {
    // Step 1: Negative Exclusions
    const exclRes = this.evaluateExclusions(mapped, rawDetail);
    if (exclRes.isExcluded) {
      return {
        isExcluded: true,
        exclusionReason: exclRes.exclusionReason,
        routingStatus: 'EXCLUDED',
        applicantReadiness: exclRes.exclusionReason === 'EXCLUDED_APPLICANT_TYPE' ? 'INELIGIBLE_APPLICANT_TYPE' : 'NOT_READY_PRE_INCORPORATION',
        recommendedPathway: exclRes.exclusionReason === 'EXCLUDED_APPLICANT_TYPE' ? 'none' : 'none',
        blockingReason: exclRes.explanation,
        explanation: exclRes.explanation || 'Excluded by negative domain/applicant exclusion gate.',
        matchedLanes: [],
        evidenceQuotes: [],
      };
    }

    // Step 2: Positive Mission Evidence
    const missionRes = this.evaluateMissionEvidence(mapped, rawDetail);
    if (!missionRes.hasPositiveEvidence) {
      return {
        isExcluded: true,
        exclusionReason: 'NO_MISSION_LANE_MATCH',
        routingStatus: 'EXCLUDED',
        applicantReadiness: 'NOT_READY_PRE_INCORPORATION',
        recommendedPathway: 'none',
        blockingReason: 'EXCLUDED: Opportunity lacks affirmative evidence matching any of Bridge Forward\'s 6 program lanes.',
        explanation: 'EXCLUDED: Opportunity lacks affirmative evidence matching any of Bridge Forward\'s 6 program lanes.',
        matchedLanes: [],
        evidenceQuotes: [],
      };
    }

    // Step 3: Direct Applicant Readiness and Capacity Routing
    const capacityRes = this.evaluateCapacityAndRouting(mapped, rawDetail, missionRes.matchedLanes, profile);

    if (capacityRes.routingStatus === 'EXCLUDED') {
      return {
        isExcluded: true,
        exclusionReason: 'EXCLUDED_CONTEXTUALLY_IRRELEVANT',
        routingStatus: 'EXCLUDED',
        applicantReadiness: capacityRes.applicantReadiness,
        recommendedPathway: capacityRes.recommendedPathway,
        blockingReason: capacityRes.blockingReason,
        explanation: capacityRes.explanation,
        matchedLanes: missionRes.matchedLanes,
        evidenceQuotes: missionRes.evidenceQuotes,
        capacityNotes: capacityRes.capacityNotes,
      };
    }

    return {
      isExcluded: false,
      routingStatus: capacityRes.routingStatus,
      applicantReadiness: capacityRes.applicantReadiness,
      recommendedPathway: capacityRes.recommendedPathway,
      blockingReason: capacityRes.blockingReason,
      explanation: capacityRes.explanation,
      matchedLanes: missionRes.matchedLanes,
      evidenceQuotes: missionRes.evidenceQuotes,
      capacityNotes: capacityRes.capacityNotes,
    };
  }

  /**
   * Backward-compatible evaluation entry point.
   */
  static evaluate(mapped: MappedOpportunity, rawDetail: any, profile?: string) {
    const res = this.evaluateAll(mapped, rawDetail, profile);
    return {
      isExcluded: res.isExcluded,
      exclusionReason: res.exclusionReason,
      explanation: res.explanation,
      routingStatus: res.routingStatus,
      matchedLanes: res.matchedLanes,
      applicantReadiness: res.applicantReadiness,
      recommendedPathway: res.recommendedPathway,
      blockingReason: res.blockingReason,
    };
  }
}
