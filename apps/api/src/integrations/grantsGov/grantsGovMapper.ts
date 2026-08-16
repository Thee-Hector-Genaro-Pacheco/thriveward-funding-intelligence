import { GrantsGovDetailResponse, GrantsGovSearchHit } from './grantsGovTypes';
import { sanitizeHtmlToText } from '@thriveward/shared';

export interface MappedOpportunity {
  sourceSystem: string;
  externalOpportunityId: string;
  fundingOpportunityNumber: string;
  title: string;
  fundingAgency: string;
  isDemo: boolean;
  program: string | null;
  description: string;
  sourceUrl: string;
  status: 'PENDING_HUMAN_REVIEW';
  verificationStatus: 'PENDING_HUMAN_REVIEW';
  openingDate: string;
  deadline: string;
  awardMin: string;
  awardMax: string;
  totalAvailableFunding: string;
  geography: string;
  eligibleApplicantTypes: string[];
  eligiblePopulations: string[];
  matchRequirement: string;
  periodOfPerformance: string;
  allowableCosts: string[];
  prohibitedCosts: string[];
  sourceLastUpdatedTimestamp: Date | null;
}

export class GrantsGovMapper {
  private static formatCurrency(val?: string | number): string {
    if (val === undefined || val === null || val === '') return 'UNKNOWN';
    const num = Number(val);
    if (isNaN(num)) return String(val);
    return `$${num.toLocaleString('en-US')}`;
  }

  private static normalizeDate(dateStr?: string): string {
    if (!dateStr || dateStr.trim() === '') return 'UNKNOWN';
    try {
      const parsed = new Date(dateStr);
      if (isNaN(parsed.getTime())) return dateStr;
      return parsed.toISOString().split('T')[0];
    } catch {
      return dateStr;
    }
  }

  /**
   * Sanitizes and parses agency name/code without grantor contact names or titles.
   */
  private static parseAgency(detail: GrantsGovDetailResponse | GrantsGovSearchHit): string {
    const rawAgency = (detail as any).agencyName || (detail as any).agency || (detail as any).synopsis?.agencyName || '';
    const agencyCode = (detail as any).agencyCode || (detail as any).owningAgencyCode || (detail as any).synopsis?.agencyCode;

    if (rawAgency) {
      const cleanAgency = sanitizeHtmlToText(rawAgency);
      // Reject contact person names, emails, phone numbers, or "Grants.gov Contact" / "Grantor"
      const isContactName =
        /@/.test(cleanAgency) ||
        /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/.test(cleanAgency) ||
        /grants\.gov contact/i.test(cleanAgency) ||
        /grant officer/i.test(cleanAgency) ||
        /program manager/i.test(cleanAgency) ||
        /grantor/i.test(cleanAgency) ||
        /contact/i.test(cleanAgency) ||
        /officer/i.test(cleanAgency) ||
        /specialist/i.test(cleanAgency);

      if (!isContactName && cleanAgency.trim().length > 0) {
        return cleanAgency.trim();
      }
    }

    if (agencyCode && String(agencyCode).trim().length > 0) {
      return `Agency (${String(agencyCode).trim()})`;
    }

    return 'UNKNOWN';
  }

  /**
   * Parses official geography / place-of-performance from detail response text.
   */
  private static parseGeography(detail: GrantsGovDetailResponse | GrantsGovSearchHit, title: string, description: string): string {
    const fullText = `${title} ${description} ${JSON.stringify(detail)}`.toLowerCase();

    if (fullText.includes('kazakhstan') || fullText.includes('astana') || fullText.includes('almaty')) {
      return 'Kazakhstan (Foreign Non-US)';
    }
    if (fullText.includes('tunisia') || fullText.includes('tunis')) {
      return 'Tunisia (Foreign Non-US)';
    }
    if (fullText.includes('solomon islands')) {
      return 'Solomon Islands (Foreign Non-US)';
    }
    if (fullText.includes('africa') || fullText.includes('great lakes region of africa')) {
      return 'Africa (Foreign Non-US)';
    }
    if (fullText.includes('foreign-only') || fullText.includes('abroad only') || fullText.includes('overseas direct')) {
      return 'Foreign Location (Non-US)';
    }

    if (fullText.includes('california') || fullText.includes('orange county') || fullText.includes('los angeles')) {
      return 'United States (California)';
    }

    if (fullText.includes('united states') || fullText.includes('u.s.') || fullText.includes('national')) {
      return 'United States';
    }

    return 'UNKNOWN';
  }

  /**
   * Pure mapping from Grants.gov detail payload.
   */
  static mapDetailToOpportunity(detail: GrantsGovDetailResponse): MappedOpportunity {
    const oppId = String(detail.id ?? detail.oppId ?? detail.opportunityId ?? detail.synopsis?.opportunityId ?? '');
    if (!oppId) {
      throw new Error('Grants.gov detail payload missing required opportunityId');
    }

    const officialUrl = `https://www.grants.gov/search-results-detail/${oppId}`;
    const rawNumber = detail.opportunityNumber || detail.synopsis?.opportunityNumber || oppId;
    const rawTitle = detail.opportunityTitle || detail.synopsis?.opportunityTitle || `Grants.gov Notice #${rawNumber}`;
    const cleanTitle = sanitizeHtmlToText(rawTitle);

    const agency = this.parseAgency(detail);
    const rawDescription = detail.synopsisDescription || detail.synopsis?.synopsisDesc || detail.synopsis?.synopsisDescription || detail.description || 'Official Grants.gov opportunity notice.';
    const cleanDescription = sanitizeHtmlToText(rawDescription);

    const geography = this.parseGeography(detail, cleanTitle, cleanDescription);

    let lastUpdated: Date | null = null;
    const dateToParse = detail.lastUpdatedDate || detail.synopsis?.lastUpdatedDate;
    if (dateToParse) {
      const parsed = new Date(dateToParse);
      if (!isNaN(parsed.getTime())) {
        lastUpdated = parsed;
      }
    }

    const postDate = detail.postDate || detail.synopsis?.postingDate || detail.synopsis?.postDate;
    const closeDate = detail.closeDate || detail.synopsis?.responseDate || detail.synopsis?.closeDate;
    const awardFloor = detail.awardFloor ?? detail.synopsis?.awardFloor;
    const awardCeiling = detail.awardCeiling ?? detail.synopsis?.awardCeiling;
    const estimatedTotalProgramFunding = detail.estimatedTotalProgramFunding ?? detail.synopsis?.estimatedTotalProgramFunding;

    let eligibleApplicantTypes: string[] = [];
    if (Array.isArray(detail.eligibleApplicants)) {
      eligibleApplicantTypes = detail.eligibleApplicants;
    } else if (Array.isArray(detail.synopsis?.applicantTypes)) {
      eligibleApplicantTypes = detail.synopsis.applicantTypes
        .map((item: any) => (typeof item === 'string' ? item : item?.description || String(item)))
        .filter(Boolean);
    }

    const additionalInfo = detail.additionalInformationOnEligibility || detail.synopsis?.applicantEligibilityDesc;
    const cleanInfo = additionalInfo ? sanitizeHtmlToText(additionalInfo) : null;

    return {
      sourceSystem: 'GRANTS_GOV',
      externalOpportunityId: oppId,
      fundingOpportunityNumber: String(rawNumber).trim(),
      title: cleanTitle,
      fundingAgency: agency,
      isDemo: false,
      program: detail.alnNumbers?.length ? `ALN/CFDA #${detail.alnNumbers.join(', ')}` : null,
      description: cleanDescription,
      sourceUrl: officialUrl,
      status: 'PENDING_HUMAN_REVIEW',
      verificationStatus: 'PENDING_HUMAN_REVIEW',
      openingDate: this.normalizeDate(postDate),
      deadline: this.normalizeDate(closeDate),
      awardMin: this.formatCurrency(awardFloor),
      awardMax: this.formatCurrency(awardCeiling),
      totalAvailableFunding: this.formatCurrency(estimatedTotalProgramFunding),
      geography,
      eligibleApplicantTypes,
      eligiblePopulations: cleanInfo ? [cleanInfo] : [],
      matchRequirement: 'UNKNOWN',
      periodOfPerformance: 'UNKNOWN',
      allowableCosts: detail.fundingInstruments || [],
      prohibitedCosts: [],
      sourceLastUpdatedTimestamp: lastUpdated,
    };
  }

  /**
   * Fallback mapping from Grants.gov search hit when detail endpoint is unavailable.
   */
  static mapSearchHitToOpportunity(hit: GrantsGovSearchHit): MappedOpportunity {
    const oppId = String(hit.id);
    const officialUrl = `https://www.grants.gov/search-results-detail/${oppId}`;
    const cleanTitle = sanitizeHtmlToText(hit.title || `Grants.gov Notice #${oppId}`);
    const agency = this.parseAgency(hit);

    return {
      sourceSystem: 'GRANTS_GOV',
      externalOpportunityId: oppId,
      fundingOpportunityNumber: oppId,
      title: cleanTitle,
      fundingAgency: agency,
      isDemo: false,
      program: null,
      description: sanitizeHtmlToText(`Official Grants.gov opportunity hit #${oppId}.`),
      sourceUrl: officialUrl,
      status: 'PENDING_HUMAN_REVIEW',
      verificationStatus: 'PENDING_HUMAN_REVIEW',
      openingDate: this.normalizeDate(hit.openDate),
      deadline: this.normalizeDate(hit.closeDate),
      awardMin: 'UNKNOWN',
      awardMax: 'UNKNOWN',
      totalAvailableFunding: 'UNKNOWN',
      geography: this.parseGeography(hit, cleanTitle, ''),
      eligibleApplicantTypes: [],
      eligiblePopulations: [],
      matchRequirement: 'UNKNOWN',
      periodOfPerformance: 'UNKNOWN',
      allowableCosts: [],
      prohibitedCosts: [],
      sourceLastUpdatedTimestamp: null,
    };
  }
}
