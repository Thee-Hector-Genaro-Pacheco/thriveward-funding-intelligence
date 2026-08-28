import { describe, expect, it } from 'vitest';
import { FundingAnalysisResult } from '../services/ai/fundingAnalystProvider';
import { EvidenceCatalogBuilder } from '../services/ai/evidenceCatalogBuilder';

const documentRef = 'DOC.notice-version.PAGE.12';

function resultWithRequirement(requirement: string): FundingAnalysisResult {
  return {
    alignmentScore: 70,
    eligibility: 'POSSIBLY_ELIGIBLE',
    summary: 'Grounded evaluation based on the cited eligibility evidence.',
    strengths: [],
    risks: [],
    requirements: [{ requirement, status: 'UNKNOWN', evidenceRefs: [documentRef] }],
    recommendedNextAction: 'Confirm the remaining application requirements.',
    confidence: 0.8,
    limitations: [],
  };
}

const catalog = [{
  id: documentRef,
  category: 'DOCUMENT_RETRIEVED' as const,
  label: 'Official notice eligibility excerpt',
  value: 'Eligible applicants include nonprofits having a 501(c)(3) status with the IRS and nonprofits that do not have a 501(c)(3) status with the IRS.',
}];

describe('grounded evaluation consistency validation', () => {
  it('rejects a 501(c)(3) requirement contradicted by its cited official evidence', () => {
    const result = resultWithRequirement('501(c)(3) tax exemption is required.');

    expect(() => EvidenceCatalogBuilder.validateGroundedEvidenceRefs(result, catalog)).toThrow(
      'GROUNDED_EVIDENCE_CONTRADICTION'
    );
  });

  it('accepts a requirement that accurately reflects eligibility without 501(c)(3) status', () => {
    const result = resultWithRequirement(
      'Eligible nonprofit applicants may have or lack 501(c)(3) tax-exempt status.'
    );

    expect(() => EvidenceCatalogBuilder.validateGroundedEvidenceRefs(result, catalog)).not.toThrow();
  });
});
