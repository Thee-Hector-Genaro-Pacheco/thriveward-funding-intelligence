import { describe, expect, it } from 'vitest';
import { EvidenceCatalogBuilder } from '../services/ai/evidenceCatalogBuilder';

const incorporatedOrganization = {
  name: 'Project Thriveward',
  status: 'INCORPORATED',
  taxStatus: 'NOT_OBTAINED',
  mission: 'Support successful reentry and long-term independence.',
  primaryPopulations: ['Justice-involved adults', 'System-impacted young people'],
  primaryOutcome: 'Successful reentry and long-term independence',
  coreModel: 'Career-connected education and reentry support',
  limitations: [
    'California incorporation verified (Entity #B20260372748).',
    '501(c)(3) status has not yet been obtained.',
    'No grant awards have been received.',
    'No cohort has yet been completed.',
    'No employment outcomes should be claimed.',
    'Employer partnerships are currently being developed.',
    'Government contracts have not been obtained.',
    'Housing and rental assistance planned (not currently operational).',
    'SAM.gov/UEI registration NOT_REGISTERED.',
    'Grants.gov organization registration NOT_REGISTERED.',
  ],
  programs: [],
};

const bjaOpportunity = {
  id: '384fe777-5794-4562-bf97-f1beac40b7fc',
  title: 'BJA FY 2026 Second Chance Act Improving Reentry Education and Employment Outcomes',
  fundingAgency: 'Bureau of Justice Assistance',
  fundingOpportunityNumber: 'O-BJA-2026-172698',
  sourceSystem: 'GRANTS_GOV',
  officialSourceUrl: null,
  description: 'Reentry education and employment funding opportunity.',
  candidateRoutingStatus: 'FUTURE_OPPORTUNITY',
  pursuitStage: 'NEW',
  currentCycleStatus: 'ACTIVE',
  createdAt: new Date('2026-08-01T00:00:00.000Z'),
};

function evidenceValue(snapshot: ReturnType<typeof EvidenceCatalogBuilder.buildSnapshot>, id: string): string {
  const item = snapshot.evidenceCatalog.find((entry) => entry.id === id);
  if (!item) throw new Error(`Missing evidence item ${id}`);
  return item.value;
}

describe('organization evidence catalog consistency', () => {
  it('uses neutral evidence when the organization profile is missing', () => {
    const snapshot = EvidenceCatalogBuilder.buildSnapshot(bjaOpportunity, null);
    const serialized = JSON.stringify(snapshot);

    expect(snapshot.organization).toMatchObject({
      name: 'UNKNOWN',
      status: 'UNKNOWN',
      taxStatus: 'UNKNOWN',
      samGovUeiStatus: 'UNKNOWN',
      grantsGovStatus: 'UNKNOWN',
      mission: 'NOT_ESTABLISHED',
      primaryPopulations: [],
      primaryOutcome: 'NOT_ESTABLISHED',
      coreModel: 'NOT_ESTABLISHED',
      limitations: [],
      programs: [],
    });
    expect(evidenceValue(snapshot, 'ORG.formationStatus')).toBe('UNKNOWN');
    expect(evidenceValue(snapshot, 'ORG.taxExemptionStatus')).toBe('UNKNOWN');
    expect(evidenceValue(snapshot, 'ORG.mission')).toBe('NOT_ESTABLISHED');
    expect(evidenceValue(snapshot, 'ORG.operatingHistory')).toBe('UNKNOWN');
    expect(serialized).not.toMatch(/Bridge Forward Foundation|pre[-_ ]?incorporation|No 501\(c\)\(3\)|SAM\.gov registration/i);
  });

  it('does not infer missing readiness fields from a sparse organization profile', () => {
    const snapshot = EvidenceCatalogBuilder.buildSnapshot(bjaOpportunity, {
      name: 'Current Organization',
      primaryPopulations: ['Adults'],
    });

    expect(snapshot.organization.name).toBe('Current Organization');
    expect(snapshot.organization.status).toBe('UNKNOWN');
    expect(snapshot.organization.taxStatus).toBe('UNKNOWN');
    expect(snapshot.organization.mission).toBe('NOT_ESTABLISHED');
    expect(snapshot.organization.limitations).toEqual([]);
    expect(evidenceValue(snapshot, 'ORG.operatingHistory')).toBe('UNKNOWN');
    expect(evidenceValue(snapshot, 'ORG.formationStatus')).toBe('UNKNOWN');
    expect(evidenceValue(snapshot, 'ORG.taxExemptionStatus')).toBe('UNKNOWN');
  });

  it('keeps formation, tax exemption, and operating history in separate evidence fields', () => {
    const snapshot = EvidenceCatalogBuilder.buildSnapshot(bjaOpportunity, incorporatedOrganization);

    expect(evidenceValue(snapshot, 'ORG.formationStatus')).toBe('INCORPORATED');
    expect(evidenceValue(snapshot, 'ORG.taxExemptionStatus')).toBe('NOT_OBTAINED');
    expect(evidenceValue(snapshot, 'ORG.samGovUeiStatus')).toBe('NOT_REGISTERED');
    expect(evidenceValue(snapshot, 'ORG.grantsGovStatus')).toBe('NOT_REGISTERED');
    expect(snapshot.organization).toMatchObject({
      status: 'INCORPORATED',
      taxStatus: 'NOT_OBTAINED',
      samGovUeiStatus: 'NOT_REGISTERED',
      grantsGovStatus: 'NOT_REGISTERED',
    });

    expect(snapshot.organization.limitations).toEqual([
      'No grant awards have been received.',
      'No cohort has yet been completed.',
      'No employment outcomes should be claimed.',
      'Employer partnerships are currently being developed.',
      'Government contracts have not been obtained.',
      'Housing and rental assistance planned (not currently operational).',
    ]);
    expect(snapshot.organization.limitations.join(' ')).not.toMatch(
      /incorporat|501\s*\(c\)\s*\(3\)|tax[- ]exempt|sam\.gov|\buei\b|grants\.gov/i
    );

    const operatingHistory = evidenceValue(snapshot, 'ORG.operatingHistory');
    expect(operatingHistory).toContain('No cohort has yet been completed');
    expect(operatingHistory).toContain('No grant awards');
    expect(operatingHistory).toContain('No employment outcomes should be claimed');
    expect(operatingHistory).toContain('Employer partnerships are currently being developed');
    expect(operatingHistory).not.toMatch(/pre[-_ ]?incorporation|incorporated|formation status/i);
    expect(operatingHistory).not.toMatch(/501\s*\(c\)\s*\(3\)|tax exemption/i);
    expect(operatingHistory).not.toMatch(/sam\.gov|\buei\b|grants\.gov/i);
  });

  it('builds a BJA-style grounded snapshot without contradictory organization evidence', () => {
    const snapshot = EvidenceCatalogBuilder.buildGroundedSnapshot(
      bjaOpportunity,
      incorporatedOrganization,
      [{
        citationRef: 'DOC.1.0.abcdef123456',
        queryLabel: 'eligibility',
        pageNumber: 1,
        rank: 1,
        cosineSimilarity: 0.91,
        excerptSnapshot: 'Eligible applicants and program requirements.',
      }]
    );

    expect(snapshot.promptVersion).toBe('funding-analyst-document-grounded-v1');
    expect(snapshot.organization.status).toBe('INCORPORATED');
    expect(evidenceValue(snapshot, 'ORG.formationStatus')).toBe('INCORPORATED');
    expect(evidenceValue(snapshot, 'ORG.taxExemptionStatus')).toBe('NOT_OBTAINED');
    expect(evidenceValue(snapshot, 'ORG.operatingHistory')).not.toMatch(/pre[-_ ]?incorporation/i);
    expect(snapshot.evidenceCatalog).toContainEqual(expect.objectContaining({
      id: 'DOC.1.0.abcdef123456',
      category: 'DOCUMENT_RETRIEVED',
    }));
  });
});
