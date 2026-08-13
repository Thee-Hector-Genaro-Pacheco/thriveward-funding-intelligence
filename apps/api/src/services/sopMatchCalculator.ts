import crypto from 'crypto';

export interface SopMatchCalculationResult {
  matchPercentage: number;
  appliesTo: 'TOTAL_APPROVED_PROJECT_COST';
  federalAwardAmount: number;
  totalProjectCost: number;
  nonFederalMatchRequired: number;
  cashOrInKindAllowed: boolean;
  waiverProvisions: string;
  sourcePageRange: string;
  officialDetailUrl: string;
  officialNofoPdfUrl: string;
  statutoryAuthority: string;
  detailId: string;
  opportunityNumber: string;
  documentByteCount: number;
  documentHash: string;
  formattedSummary: string;
}

export const CANONICAL_SOP_IDENTITY = {
  opportunityNumber: 'HHS-2026-ACF-ACYF-YO-0044',
  detailId: '362088',
  officialDetailUrl: 'https://www.grants.gov/search-results-detail/362088',
  officialNofoPdfUrl: 'https://files.simpler.grants.gov/competitions/8155b3c1-c6bd-4819-b8f9-b3cc61fce846/instructions/5b5a48f0-f1f3-4d19-893a-fae11a7db007/PKG00293742.pdf',
  awardFloor: 100000,
  awardCeiling: 200000,
  expectedTotalFunding: 4000000,
  expectedAwards: 20,
  statutoryAuthority: 'Section 383 of the RHY Act, 34 U.S.C. §11274',
  nofoLocation: 'Pages 6–8',
  documentByteCount: 393080,
  documentHash: '23d74f59f218b286e1af584cb9f43ca759f67cf33bae30c753322a10089378f3',
};

/**
 * Calculates non-federal match requirement for HHS Street Outreach Program (HHS-2026-ACF-ACYF-YO-0044, Detail ID 362088)
 * based on official FY2026 NOFO Pages 6–8 (Section 383 of RHY Act, 34 U.S.C. §11274).
 * Formula: nonFederalMatchRequired = Math.round(federalAwardAmount / 9)
 */
export function calculateSopMatchRequirement(federalAwardAmount: number = 200000): SopMatchCalculationResult {
  const matchPercentage = 10; // 10% of total approved project cost per NOFO Pages 6–8

  // Federal-share method: federal award / 9
  // $100,000 federal share -> $11,111 match ($111,111 total project cost)
  // $200,000 federal share -> $22,222 match ($222,222 total project cost)
  const nonFederalMatchRequired = Math.round(federalAwardAmount / 9);
  const totalProjectCost = federalAwardAmount + nonFederalMatchRequired;

  const cashOrInKindAllowed = true;
  const waiverProvisions = 'UNKNOWN'; // No hardship-waiver authorization exists for FY2026

  const formattedSummary = `Official Match Rule (RHY Act §383, 34 U.S.C. §11274, NOFO Pages 6–8): 10% non-federal match of total approved project cost ($${nonFederalMatchRequired.toLocaleString()} required for $${federalAwardAmount.toLocaleString()} federal award, yielding $${totalProjectCost.toLocaleString()} total project budget). Cash and in-kind contributions are permitted.`;

  return {
    matchPercentage,
    appliesTo: 'TOTAL_APPROVED_PROJECT_COST',
    federalAwardAmount,
    totalProjectCost,
    nonFederalMatchRequired,
    cashOrInKindAllowed,
    waiverProvisions,
    sourcePageRange: CANONICAL_SOP_IDENTITY.nofoLocation,
    officialDetailUrl: CANONICAL_SOP_IDENTITY.officialDetailUrl,
    officialNofoPdfUrl: CANONICAL_SOP_IDENTITY.officialNofoPdfUrl,
    statutoryAuthority: CANONICAL_SOP_IDENTITY.statutoryAuthority,
    detailId: CANONICAL_SOP_IDENTITY.detailId,
    opportunityNumber: CANONICAL_SOP_IDENTITY.opportunityNumber,
    documentByteCount: CANONICAL_SOP_IDENTITY.documentByteCount,
    documentHash: CANONICAL_SOP_IDENTITY.documentHash,
    formattedSummary,
  };
}

/**
 * Independently computes and verifies the SHA-256 digest from downloaded NOFO PDF bytes.
 */
export function verifyNofoPdfDigest(pdfBuffer: Buffer): {
  byteCount: number;
  computedHash: string;
  matchesCanonical: boolean;
  opportunityIdentityMatch: boolean;
} {
  const byteCount = pdfBuffer.length;
  const computedHash = crypto.createHash('sha256').update(pdfBuffer).digest('hex');
  const matchesCanonical = computedHash === CANONICAL_SOP_IDENTITY.documentHash && byteCount === CANONICAL_SOP_IDENTITY.documentByteCount;

  return {
    byteCount,
    computedHash,
    matchesCanonical,
    opportunityIdentityMatch: matchesCanonical,
  };
}
