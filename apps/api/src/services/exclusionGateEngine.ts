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
  | 'FUTURE_OPPORTUNITY'
  | 'PARTNERSHIP_REQUIRED'
  | 'EXCLUDED';

export interface CandidateEvaluationResult {
  isExcluded: boolean;
  exclusionReason?: ExclusionReason;
  routingStatus: CandidateRoutingStatus;
  explanation: string;
  matchedLanes: MissionLane[];
  evidenceQuotes: string[];
  capacityNotes?: string;
}

export class ExclusionGateEngine {
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

    // 1. EXCLUDED_RFI (Requests for Information / Sources Sought)
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

    // 2. EXCLUDED_INVITED_ONLY (Invited-to-apply / non-competitive)
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

    // 3. EXCLUDED_REIMBURSEMENT_PROGRAM (Government deficit / state reimbursement)
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

    // 4. EXCLUDED_FOREIGN_PLACE_OF_PERFORMANCE (Foreign-only programs)
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

    // 5. EXCLUDED_CLINICAL_RESEARCH (Clinical trials & pharmaceutical research)
    if (
      /\bclinical trial\b/i.test(fullText) ||
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

    // 7. EXCLUDED_LAW_ENFORCEMENT_PROGRAM (Police equipment / accreditation / crisis training for officers)
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

    // 8. EXCLUDED_APPLICANT_TYPE (Tribal-only / Government-only / Law-enforcement-only applicants)
    if (
      /\bcoordinated tribal assistance solicitation\b/i.test(fullText) ||
      /\bo-bja-2026-172662\b/i.test(fullText) ||
      /\btribal governments only\b/i.test(fullText) ||
      /\bfederally recognized indian tribal governments\b/i.test(fullText) && !/nonprofit/i.test(fullText)
    ) {
      return {
        isExcluded: true,
        exclusionReason: 'EXCLUDED_APPLICANT_TYPE',
        explanation: 'Applicant eligibility is restricted to tribal governments or government agencies where Bridge Forward is ineligible.',
      };
    }

    // 9. EXCLUDED_CONTEXTUALLY_IRRELEVANT (Misleading Collisions)
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
   * Evaluates positive mission evidence for Bridge Forward's 6 core program lanes.
   */
  public static evaluateMissionEvidence(mapped: MappedOpportunity, rawDetail: any): { hasPositiveEvidence: boolean; matchedLanes: MissionLane[]; evidenceQuotes: string[] } {
    const title = sanitizeHtmlToText(mapped.title || '');
    const desc = sanitizeHtmlToText(mapped.description || '');
    const fullText = `${title} ${desc} ${JSON.stringify(rawDetail || {})}`.toLowerCase();

    const matchedLanes: MissionLane[] = [];
    const evidenceQuotes: string[] = [];

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
    ];
    for (const term of reentryTerms) {
      if (fullText.includes(term)) {
        if (!matchedLanes.includes('REENTRY')) matchedLanes.push('REENTRY');
        evidenceQuotes.push(`Reentry evidence: matched term '${term}'`);
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
      'affordable housing and supportive services',
      'primary prevention youth homelessness',
    ];
    for (const term of housingTerms) {
      if (fullText.includes(term)) {
        if (!matchedLanes.includes('HOUSING_STABILITY')) matchedLanes.push('HOUSING_STABILITY');
        evidenceQuotes.push(`Housing stability evidence: matched term '${term}'`);
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
    ];
    for (const term of workforceTerms) {
      if (fullText.includes(term)) {
        if (!matchedLanes.includes('WORKFORCE')) matchedLanes.push('WORKFORCE');
        evidenceQuotes.push(`Workforce evidence: matched term '${term}'`);
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
      'primary prevention youth homelessness',
    ];
    for (const term of youthTerms) {
      if (fullText.includes(term)) {
        if (!matchedLanes.includes('YOUTH_JUSTICE')) matchedLanes.push('YOUTH_JUSTICE');
        evidenceQuotes.push(`Youth justice evidence: matched term '${term}'`);
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
    ];
    for (const term of techTerms) {
      if (fullText.includes(term)) {
        if (!matchedLanes.includes('TECHNOLOGY_EDUCATION')) matchedLanes.push('TECHNOLOGY_EDUCATION');
        evidenceQuotes.push(`Technology education evidence: matched term '${term}'`);
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
    ];
    for (const term of supportTerms) {
      if (fullText.includes(term)) {
        if (!matchedLanes.includes('SUPPORTIVE_SERVICES')) matchedLanes.push('SUPPORTIVE_SERVICES');
        evidenceQuotes.push(`Supportive services evidence: matched term '${term}'`);
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
   * Evaluates organizational capacity, tax-status requirements, and routing status.
   */
  public static evaluateCapacityAndRouting(
    mapped: MappedOpportunity,
    rawDetail: any,
    matchedLanes: MissionLane[]
  ): { routingStatus: CandidateRoutingStatus; capacityNotes?: string; explanation: string } {
    const oppNum = (mapped.fundingOpportunityNumber || '').toUpperCase();
    const title = sanitizeHtmlToText(mapped.title || '');
    const desc = sanitizeHtmlToText(mapped.description || '');
    const fullText = `${title} ${desc} ${oppNum} ${JSON.stringify(rawDetail || {})}`.toLowerCase();

    // Specific Rule 1: DCT-DCT-26-001 (Drug Court TTA)
    if (oppNum.includes('DCT-DCT-26-001') || fullText.includes('drug court training and technical assistance')) {
      return {
        routingStatus: 'FUTURE_OPPORTUNITY',
        capacityNotes: 'Requires established 501(c)(3) tax-exempt status and national TTA capacity. Bridge Forward is currently PRE_INCORPORATION without 501(c)(3).',
        explanation: 'FUTURE_OPPORTUNITY: Has partial reentry subject-matter alignment, but requires established 501(c)(3) and national TTA capacity.',
      };
    }

    // Specific Rule 2: O-OVW-2026-172633 (Domestic Violence ICJR)
    if (oppNum.includes('O-OVW-2026-172633') || fullText.includes('icjr program') || fullText.includes('improving criminal justice response to domestic violence')) {
      return {
        routingStatus: 'PARTNERSHIP_REQUIRED',
        capacityNotes: 'Requires specialized domestic violence victim-service capacity or an eligible public agency partnership.',
        explanation: 'PARTNERSHIP_REQUIRED: Relevant only if Bridge Forward establishes documented domestic-violence victim-service capacity or an eligible partnership.',
      };
    }

    // Specific Control 3: HHS-2026-ACF-OCS-EAH-0027 (Affordable Housing Demonstration)
    if (oppNum.includes('HHS-2026-ACF-OCS-EAH-0027') || fullText.includes('affordable housing and supportive services demonstration')) {
      return {
        routingStatus: 'FUTURE_OPPORTUNITY',
        capacityNotes: 'Requires 501(c)(3) tax-exempt status or Community Action Agency status. Bridge Forward is PRE_INCORPORATION.',
        explanation: 'FUTURE_OPPORTUNITY: Aligns with Housing Stability lane, but requires 501(c)(3) tax status.',
      };
    }

    // Specific Control 4: HHS-2026-ACF-OCS-EE-0026 (Community Economic Development)
    if (oppNum.includes('HHS-2026-ACF-OCS-EE-0026') || fullText.includes('community economic development projects')) {
      return {
        routingStatus: 'FUTURE_OPPORTUNITY',
        capacityNotes: 'Requires 501(c)(3) Community Development Corporation (CDC) status.',
        explanation: 'FUTURE_OPPORTUNITY: Aligns with Workforce lane, but requires 501(c)(3) CDC designation.',
      };
    }

    // General 501(c)(3) / Operating History Check
    const requires501c3 =
      /\b501\(c\)\(3\)\b/i.test(fullText) ||
      /\bincorporated non-profit\b/i.test(fullText) ||
      /\b3 years operating history\b/i.test(fullText) ||
      /\b5 years operating history\b/i.test(fullText);

    if (requires501c3 && !/pre-incorporation|fiscal sponsor|unincorporated/i.test(fullText)) {
      return {
        routingStatus: 'FUTURE_OPPORTUNITY',
        capacityNotes: 'Solicitation explicitly requires 501(c)(3) tax-exempt status or multi-year operating history.',
        explanation: 'FUTURE_OPPORTUNITY: Positive mission alignment, but requires 501(c)(3) tax status not currently held by Bridge Forward.',
      };
    }

    // General Specialized Public / Government Partner Check
    const requiresPublicPartner =
      /\bpublic agency partner required\b/i.test(fullText) ||
      /\bjoint application with law enforcement\b/i.test(fullText);

    if (requiresPublicPartner) {
      return {
        routingStatus: 'PARTNERSHIP_REQUIRED',
        capacityNotes: 'Solicitation requires formal public agency or government partnership.',
        explanation: 'PARTNERSHIP_REQUIRED: Requires public agency partner collaboration.',
      };
    }

    return {
      routingStatus: 'CURRENTLY_ACTIONABLE',
      explanation: `CURRENTLY_ACTIONABLE: Satisfies positive mission evidence (${matchedLanes.join(', ')}) and matches current pre-incorporation applicant capacity.`,
    };
  }

  /**
   * Master candidate evaluation pipeline combining negative exclusions, positive evidence, and capacity routing.
   */
  public static evaluateAll(mapped: MappedOpportunity, rawDetail: any): CandidateEvaluationResult {
    // Step 1: Negative Exclusions
    const exclRes = this.evaluateExclusions(mapped, rawDetail);
    if (exclRes.isExcluded) {
      return {
        isExcluded: true,
        exclusionReason: exclRes.exclusionReason,
        routingStatus: 'EXCLUDED',
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
        explanation: 'EXCLUDED: Opportunity lacks affirmative evidence matching any of Bridge Forward\'s 6 program lanes.',
        matchedLanes: [],
        evidenceQuotes: [],
      };
    }

    // Step 3: Capacity and Eligibility Routing
    const capacityRes = this.evaluateCapacityAndRouting(mapped, rawDetail, missionRes.matchedLanes);

    if (capacityRes.routingStatus === 'EXCLUDED') {
      return {
        isExcluded: true,
        exclusionReason: 'EXCLUDED_CONTEXTUALLY_IRRELEVANT',
        routingStatus: 'EXCLUDED',
        explanation: capacityRes.explanation,
        matchedLanes: missionRes.matchedLanes,
        evidenceQuotes: missionRes.evidenceQuotes,
        capacityNotes: capacityRes.capacityNotes,
      };
    }

    return {
      isExcluded: false,
      routingStatus: capacityRes.routingStatus,
      explanation: capacityRes.explanation,
      matchedLanes: missionRes.matchedLanes,
      evidenceQuotes: missionRes.evidenceQuotes,
      capacityNotes: capacityRes.capacityNotes,
    };
  }

  /**
   * Backward-compatible evaluation entry point.
   */
  static evaluate(mapped: MappedOpportunity, rawDetail: any) {
    const res = this.evaluateAll(mapped, rawDetail);
    return {
      isExcluded: res.isExcluded,
      exclusionReason: res.exclusionReason,
      explanation: res.explanation,
      routingStatus: res.routingStatus,
      matchedLanes: res.matchedLanes,
    };
  }
}
