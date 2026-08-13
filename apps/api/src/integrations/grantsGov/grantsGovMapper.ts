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
    const oppId = String(detail.id ?? detail.oppId ?? detail.opportunityId ?? detail.synopsis?.opportunityId ?? '');
    if (!oppId) {
      throw new Error('Grants.gov detail payload missing required opportunityId');
    }

    const officialUrl = `https://www.grants.gov/search-results-detail/${oppId}`;
    const rawNumber = detail.opportunityNumber || detail.synopsis?.opportunityNumber || oppId;
    const rawTitle = detail.opportunityTitle || detail.synopsis?.opportunityTitle || `Grants.gov Notice #${rawNumber}`;
    const agency = detail.agencyName || detail.synopsis?.agencyName || (detail.agencyCode ? `Agency (${detail.agencyCode})` : (detail.owningAgencyCode ? `Agency (${detail.owningAgencyCode})` : 'Federal Agency'));
    const description = detail.synopsisDescription || detail.synopsis?.synopsisDesc || detail.synopsis?.synopsisDescription || detail.description || 'Official Grants.gov opportunity notice.';

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

    return {
      sourceSystem: 'GRANTS_GOV',
      externalOpportunityId: oppId,
      fundingOpportunityNumber: rawNumber,
      title: rawTitle.trim(),
      fundingAgency: agency.trim(),
      isDemo: false,
      program: detail.alnNumbers?.length ? `ALN/CFDA #${detail.alnNumbers.join(', ')}` : null,
      description: description.trim(),
      sourceUrl: officialUrl,
      status: 'PENDING_HUMAN_REVIEW',
      verificationStatus: 'PENDING_HUMAN_REVIEW',
      openingDate: this.normalizeDate(postDate),
      deadline: this.normalizeDate(closeDate),
      awardMin: this.formatCurrency(awardFloor),
      awardMax: this.formatCurrency(awardCeiling),
      totalAvailableFunding: this.formatCurrency(estimatedTotalProgramFunding),
      geography: 'United States',
      eligibleApplicantTypes,
      eligiblePopulations: additionalInfo ? [additionalInfo] : [],
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
