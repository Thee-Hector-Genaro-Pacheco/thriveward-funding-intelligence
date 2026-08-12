/**
 * Grants.gov Official API Types & Interface Options
 */

export interface GrantsGovSearchParams {
  keyword?: string;
  oppStatuses?: string; // e.g. "forecasted|posted"
  startRecordNum?: number;
  rows?: number;
}

export interface GrantsGovSearchHit {
  id: string | number;
  number?: string;
  title?: string;
  agency?: string;
  agencyCode?: string;
  openDate?: string;
  closeDate?: string;
  oppStatus?: string;
  docType?: string;
  alnNumber?: string;
}

export interface GrantsGovSearchResponse {
  opportunityHits?: GrantsGovSearchHit[];
  hitCount?: number;
  totalCount?: number;
}

export interface GrantsGovDetailResponse {
  oppId?: string | number;
  opportunityId?: string | number;
  opportunityNumber?: string;
  opportunityTitle?: string;
  agencyName?: string;
  agencyCode?: string;
  description?: string;
  synopsisDescription?: string;
  postDate?: string;
  closeDate?: string;
  archiveDate?: string;
  awardFloor?: string | number;
  awardCeiling?: string | number;
  estimatedTotalProgramFunding?: string | number;
  fundingInstruments?: string[];
  eligibleApplicants?: string[];
  additionalInformationOnEligibility?: string;
  alnNumbers?: string[];
  cfdaNumbers?: string[];
  status?: string;
  opportunityStatus?: string;
  lastUpdatedDate?: string;
}
