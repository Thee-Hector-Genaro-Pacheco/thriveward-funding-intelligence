import { describe, expect, it, vi } from 'vitest';
import { GrantsGovClient } from '../integrations/grantsGov/grantsGovClient';
import { parseArgs } from '../scripts/ingestGrantsGov';
import { ExclusionGateEngine } from '../services/exclusionGateEngine';
import { IngestionService } from '../services/ingestionService';

const exactDetail = {
  id: '363637',
  oppId: '363637',
  opportunityNumber: 'O-BJA-2026-172698',
  opportunityTitle: 'Mock Exact Target Opportunity',
  agencyName: 'Bureau of Justice Assistance',
  synopsisDescription: 'Mock reentry workforce training opportunity detail.',
  postDate: '2026-08-01',
  closeDate: '2026-10-01',
  eligibleApplicants: ['Nonprofits having a 501(c)(3) status with the IRS'],
};

function mockEvaluation() {
  return vi.spyOn(ExclusionGateEngine, 'evaluateAll').mockReturnValue({
    isExcluded: false,
    routingStatus: 'CURRENTLY_ACTIONABLE',
    explanation: 'Mocked focused-test evaluation',
    matchedLanes: ['REENTRY'],
  } as any);
}

describe('Grants.gov exact opportunity targeting', () => {
  it('accepts a numeric external ID without applying the implicit keyword', () => {
    expect(parseArgs(['--external-opportunity-id', '363637', '--dry-run'])).toMatchObject({
      externalOpportunityId: '363637',
      keyword: undefined,
      dryRun: true,
    });
  });

  it.each(['abc', '363637x', '-1', '3.5'])('rejects invalid external ID %s', (id) => {
    expect(() => parseArgs(['--external-opportunity-id', id])).toThrow(/requires a numeric ID/);
  });

  it('rejects exact-ID targeting combined with an explicit keyword', () => {
    expect(() => parseArgs(['--external-opportunity-id', '363637', '--keyword', 'reentry']))
      .toThrow(/cannot be combined/);
  });

  it('validates exact-ID options passed directly to the ingestion service', async () => {
    const service = new IngestionService(new GrantsGovClient());

    await expect(service.ingestFromGrantsGov({ externalOpportunityId: 'not-numeric', dryRun: true }))
      .rejects.toThrow(/only numeric digits/);
    await expect(service.ingestFromGrantsGov({ externalOpportunityId: '363637', keyword: 'reentry', dryRun: true }))
      .rejects.toThrow(/cannot be combined/);
  });

  it('bypasses search, fetches the requested ID exactly once, and preserves dry-run counters', async () => {
    const client = new GrantsGovClient();
    const searchSpy = vi.spyOn(client, 'searchOpportunities');
    const fetchSpy = vi.spyOn(client, 'fetchOpportunity').mockResolvedValue(exactDetail as any);
    const evaluationSpy = mockEvaluation();

    const summary = await new IngestionService(client).ingestFromGrantsGov({
      externalOpportunityId: '363637',
      dryRun: true,
      verbose: true,
    });

    expect(searchSpy).not.toHaveBeenCalled();
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy).toHaveBeenCalledWith('363637');
    expect(evaluationSpy).toHaveBeenCalledTimes(1);
    expect(summary).toMatchObject({
      recordsCreated: 0,
      recordsUpdated: 0,
      persistedOpportunityNumbers: [],
      recordsInspected: 1,
    });
  });

  it('rejects a mismatched returned external ID before any persistence path can run', async () => {
    const client = new GrantsGovClient();
    vi.spyOn(client, 'searchOpportunities');
    vi.spyOn(client, 'fetchOpportunity').mockResolvedValue({
      ...exactDetail,
      id: '999999',
      oppId: '999999',
    } as any);
    const service = new IngestionService(client);
    const persistSpy = vi.spyOn(service as any, 'persistNonActionableRecord');

    const summary = await service.ingestFromGrantsGov({
      externalOpportunityId: '363637',
      dryRun: true,
    });

    expect(summary.recordsFailed).toBe(1);
    expect(summary.persistedOpportunityNumbers).toEqual([]);
    expect(persistSpy).not.toHaveBeenCalled();
  });

  it('preserves existing keyword search mode', async () => {
    const client = new GrantsGovClient();
    const searchSpy = vi.spyOn(client, 'searchOpportunities').mockResolvedValue({
      opportunityHits: [{ id: '363637' }],
    } as any);
    const fetchSpy = vi.spyOn(client, 'fetchOpportunity').mockResolvedValue(exactDetail as any);
    mockEvaluation();

    await new IngestionService(client).ingestFromGrantsGov({
      keyword: 'reentry',
      dryRun: true,
      limit: 1,
    });

    expect(searchSpy).toHaveBeenCalledTimes(1);
    expect(searchSpy).toHaveBeenCalledWith(expect.objectContaining({ keyword: 'reentry' }));
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});
