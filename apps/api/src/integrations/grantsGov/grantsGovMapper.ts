import { GrantsGovDetailResponse, GrantsGovSearchHit } from './grantsGovTypes';

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
   * Pure mapping from Grants.gov detail payload.
   */
  static mapDetailToOpportunity(detail: GrantsGovDetailResponse): MappedOpportunity {
    const oppId = String(detail.oppId || detail.opportunityId || '');
    if (!oppId) {
      throw new Error('Grants.gov detail payload missing required opportunityId');
    }

    const officialUrl = `https://www.grants.gov/search-results-detail/${oppId}`;
    const title = detail.opportunityTitle || `Grants.gov Notice #${detail.opportunityNumber || oppId}`;
    const agency = detail.agencyName || (detail.agencyCode ? `Agency (${detail.agencyCode})` : 'Federal Agency');
    const description = detail.synopsisDescription || detail.description || 'Official Grants.gov opportunity notice.';

    let lastUpdated: Date | null = null;
    if (detail.lastUpdatedDate) {
      const parsed = new Date(detail.lastUpdatedDate);
      if (!isNaN(parsed.getTime())) {
        lastUpdated = parsed;
      }
    }

    return {
      sourceSystem: 'GRANTS_GOV',
      externalOpportunityId: oppId,
      fundingOpportunityNumber: detail.opportunityNumber || oppId,
      title: title.trim(),
      fundingAgency: agency.trim(),
      isDemo: false,
      program: detail.alnNumbers?.length ? `ALN/CFDA #${detail.alnNumbers.join(', ')}` : null,
      description: description.trim(),
      sourceUrl: officialUrl,
      status: 'PENDING_HUMAN_REVIEW',
      verificationStatus: 'PENDING_HUMAN_REVIEW',
      openingDate: this.normalizeDate(detail.postDate),
      deadline: this.normalizeDate(detail.closeDate),
      awardMin: this.formatCurrency(detail.awardFloor),
      awardMax: this.formatCurrency(detail.awardCeiling),
      totalAvailableFunding: this.formatCurrency(detail.estimatedTotalProgramFunding),
      geography: 'United States',
      eligibleApplicantTypes: detail.eligibleApplicants || [],
      eligiblePopulations: detail.additionalInformationOnEligibility ? [detail.additionalInformationOnEligibility] : [],
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

    return {
      sourceSystem: 'GRANTS_GOV',
      externalOpportunityId: oppId,
      fundingOpportunityNumber: hit.number || oppId,
      title: (hit.title || `Grants.gov Notice #${oppId}`).trim(),
      fundingAgency: (hit.agency || hit.agencyCode || 'Federal Agency').trim(),
      isDemo: false,
      program: hit.alnNumber ? `ALN/CFDA #${hit.alnNumber}` : null,
      description: `Official Grants.gov notice #${hit.number || oppId} (${hit.agency || 'Federal Agency'}). Status: ${hit.oppStatus || 'posted'}.`,
      sourceUrl: officialUrl,
      status: 'PENDING_HUMAN_REVIEW',
      verificationStatus: 'PENDING_HUMAN_REVIEW',
      openingDate: this.normalizeDate(hit.openDate),
      deadline: this.normalizeDate(hit.closeDate),
      awardMin: 'UNKNOWN',
      awardMax: 'UNKNOWN',
      totalAvailableFunding: 'UNKNOWN',
      geography: 'United States',
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
