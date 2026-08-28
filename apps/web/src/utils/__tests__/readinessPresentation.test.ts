import { describe, expect, it } from 'vitest';
import {
  getAnalysisFormationStatus,
  getCurrentReadinessLabel,
  getEvaluationFormationStatus,
  hasStaleReadinessState,
  normalizeReadinessStatus,
} from '../readinessPresentation';

describe('opportunity readiness presentation', () => {
  const current = {
    status: 'INCORPORATED',
    californiaIncorporation: 'VERIFIED',
    samGovUeiStatus: 'NOT_REGISTERED',
    grantsGovStatus: 'NOT_REGISTERED',
  };

  it('represents current incorporated state without claiming registration readiness', () => {
    expect(getCurrentReadinessLabel(current)).toBe('INCORPORATED — REGISTRATIONS PENDING');
  });

  it('treats persisted pre-incorporation operating-history evidence as the historical evaluation state', () => {
    expect(getEvaluationFormationStatus(
      {
        organization: { status: 'INCORPORATED' },
        evidenceCatalog: [
          { id: 'ORG.formationStatus', value: 'INCORPORATED' },
          { id: 'ORG.operatingHistory', value: 'Pre-incorporation pilot stage.' },
        ],
      },
      []
    )).toBe('PRE_INCORPORATION');
  });

  it('reads immutable historical analysis formation state', () => {
    expect(getAnalysisFormationStatus({ status: 'PRE_INCORPORATION' })).toBe('PRE_INCORPORATION');
  });

  it('reads the organization formation state saved with an evaluation', () => {
    expect(getEvaluationFormationStatus({ organization: { status: 'PRE_INCORPORATION' } })).toBe('PRE_INCORPORATION');
    expect(getEvaluationFormationStatus({}, [
      { id: 'ORG.formationStatus', value: 'pre-incorporation' },
    ])).toBe('PRE_INCORPORATION');
    expect(normalizeReadinessStatus('incorporated')).toBe('INCORPORATED');
  });

  it('flags historical analysis or persisted routing state that predates incorporation', () => {
    expect(hasStaleReadinessState(current, 'PRE_INCORPORATION')).toBe(true);
    expect(hasStaleReadinessState(current, null, 'PRE_INCORPORATION: registration required')).toBe(true);
    expect(hasStaleReadinessState(current, 'INCORPORATED')).toBe(false);
  });
});
