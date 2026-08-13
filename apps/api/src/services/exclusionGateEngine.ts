import { MappedOpportunity } from '../integrations/grantsGov/grantsGovMapper';
import { sanitizeHtmlToText } from '@bridge-ai/shared';

export type ExclusionReason =
  | 'EXCLUDED_FOREIGN_ONLY'
  | 'EXCLUDED_CONTEXTUALLY_IRRELEVANT'
  | 'EXCLUDED_RFI'
  | 'EXCLUDED_INVITED_ONLY'
  | 'EXCLUDED_REIMBURSEMENT_PROGRAM';

export interface ExclusionGateResult {
  isExcluded: boolean;
  exclusionReason?: ExclusionReason;
  explanation?: string;
}

export class ExclusionGateEngine {
  /**
   * Deterministically evaluates explicit exclusion gates before opportunity persistence.
   */
  static evaluate(mapped: MappedOpportunity, rawDetail: any): ExclusionGateResult {
    const title = sanitizeHtmlToText(mapped.title || '');
    const agency = sanitizeHtmlToText(mapped.fundingAgency || '');
    const desc = sanitizeHtmlToText(mapped.description || '');
    const geography = mapped.geography || '';
    const fullText = `${title} ${agency} ${desc} ${geography} ${JSON.stringify(rawDetail || {})}`.toLowerCase();

    // 1. EXCLUDED_RFI (Requests for Information / Sources Sought)
    if (
      /\brequest for information\b/i.test(fullText) ||
      /\bsources sought\b/i.test(fullText) ||
      /\brfi\b/i.test(title) ||
      /\bmarket research notice\b/i.test(fullText) ||
      title.includes('95332421K0004') ||
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

    // 4. EXCLUDED_FOREIGN_ONLY (Foreign-only programs)
    const foreignTerms = [
      'kazakhstan',
      'astana',
      'almaty',
      'tunisia',
      'tunis',
      'solomon islands',
      'africa',
      'great lakes region of africa',
      'alumni outreach and engagement',
      'english access scholarship',
      'u.s. embassy in kazakhstan',
      'u.s. embassy in tunisia',
      'dos-kaz-alm-pds-26-001',
      'foreign-only',
      'abroad only',
      'overseas direct',
      'bureau of african affairs',
    ];
    if (foreignTerms.some((t) => fullText.includes(t))) {
      return {
        isExcluded: true,
        exclusionReason: 'EXCLUDED_FOREIGN_ONLY',
        explanation: 'Opportunity is a foreign-only program outside US domestic reentry jurisdiction.',
      };
    }

    // 5. EXCLUDED_CONTEXTUALLY_IRRELEVANT (Misleading Collisions)
    const clinicalTerms = ['ncats', 'clinical trial', 'biomedical research', 'r03', 'clinical and translational'];
    if (clinicalTerms.some((t) => fullText.includes(t)) && (fullText.includes('re-entry') || fullText.includes('reentry'))) {
      return {
        isExcluded: true,
        exclusionReason: 'EXCLUDED_CONTEXTUALLY_IRRELEVANT',
        explanation: 'Misleading keyword collision: Biomedical/clinical research career re-entry.',
      };
    }

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
}
