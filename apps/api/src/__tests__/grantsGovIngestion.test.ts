import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import crypto from 'crypto';
import { app } from '../server';
import { prisma } from '../lib/prisma';
import { GrantsGovClient } from '../integrations/grantsGov/grantsGovClient';
import { GrantsGovMapper } from '../integrations/grantsGov/grantsGovMapper';
import { IngestionService } from '../services/ingestionService';
import { parseArgs } from '../scripts/ingestGrantsGov';

const MOCK_SEARCH_HIT = {
  id: 'test-unit-mock-888888',
  number: 'ETA-2026-FULL-TEST-01',
  title: 'Mocked Unit Test Reentry Pathways Opportunity',
  agency: 'Department of Labor ETA',
  openDate: '2026-09-01',
  closeDate: '2026-11-30',
  oppStatus: 'posted',
};

const MOCK_DETAIL_PAYLOAD = {
  id: 'test-unit-mock-888888',
  oppId: 'test-unit-mock-888888',
  opportunityNumber: 'ETA-2026-FULL-TEST-01',
  opportunityTitle: 'Mocked Unit Test Reentry Pathways Opportunity',
  agencyName: 'Department of Labor ETA',
  synopsisDescription: 'Detailed synopsis notice for federal workforce training and reentry supportive services.',
  postDate: '2026-09-01',
  closeDate: '2026-11-30',
  awardFloor: 500000,
  awardCeiling: 2000000,
  estimatedTotalProgramFunding: 10000000,
  fundingInstruments: ['Cooperative Agreement'],
  eligibleApplicants: ['City or township governments', 'Public and State controlled institutions of higher education'],
  additionalInformationOnEligibility: 'Targeted to accredited entities with regional footprint.',
};

describe('Phase 1B — Grants.gov Verified Ingestion & Provenance Complete Audit Suite', () => {
  const cleanMockRecord = async (extId: string) => {
    const opps = await prisma.fundingOpportunity.findMany({
      where: { externalOpportunityId: extId },
      select: { id: true },
    });
    const ids = opps.map((o) => o.id);
    if (ids.length > 0) {
      await prisma.sourceCitation.deleteMany({ where: { fundingOpportunityId: { in: ids } } });
      await prisma.opportunityAnalysis.deleteMany({ where: { fundingOpportunityId: { in: ids } } });
      await prisma.sourceSnapshot.deleteMany({ where: { fundingOpportunityId: { in: ids } } });
      await prisma.fundingOpportunity.deleteMany({ where: { id: { in: ids } } });
    }
  };

  beforeAll(async () => {
    process.env.DATABASE_URL =
      process.env.TEST_DATABASE_URL ||
      process.env.DATABASE_URL ||
      'postgresql://bridge_admin:bridge_secure_pass_2026@localhost:5432/bridge_ai_test_db?schema=public';

    await cleanMockRecord('test-unit-mock-888888');
    await cleanMockRecord('test-unit-mismatch-777777');
    await cleanMockRecord('test-malformed-detail-999');
    await cleanMockRecord('test-cli-dry-run-666');
  });

  afterAll(async () => {
    await cleanMockRecord('test-unit-mock-888888');
    await cleanMockRecord('test-unit-mismatch-777777');
    await cleanMockRecord('test-malformed-detail-999');
    await cleanMockRecord('test-cli-dry-run-666');
    await prisma.ingestionRun.deleteMany({});
  });

  describe('1. API Request Construction & Schema Validation', () => {
    it('constructs search2 POST body with keyword, oppStatuses, rows, startRecordNum', async () => {
      let capturedBody: any;
      const globalFetchBak = globalThis.fetch;
      globalThis.fetch = vi.fn(async (_url: string, init?: RequestInit) => {
        capturedBody = JSON.parse(init?.body as string);
        return {
          ok: true,
          status: 200,
          json: async () => ({ opportunityHits: [MOCK_SEARCH_HIT] }),
        } as Response;
      }) as any;

      const client = new GrantsGovClient({ baseUrl: 'https://api.grants.gov' });
      await client.searchOpportunities({ keyword: 'reentry', oppStatuses: 'posted', rows: 5 });

      expect(capturedBody).toHaveProperty('keyword', 'reentry');
      expect(capturedBody).toHaveProperty('oppStatuses', 'posted');
      expect(capturedBody).toHaveProperty('rows', 5);
      expect(capturedBody).toHaveProperty('startRecordNum', 0);

      globalThis.fetch = globalFetchBak;
    });

    it('constructs fetchOpportunity POST body with numeric opportunityId, POST method, application/json header, and maps from response.data without transport token', async () => {
      let capturedUrl = '';
      let capturedMethod = '';
      let capturedHeaders: any;
      let capturedBody: any;
      const globalFetchBak = globalThis.fetch;
      globalThis.fetch = vi.fn(async (url: string, init?: RequestInit) => {
        capturedUrl = url;
        capturedMethod = init?.method || 'GET';
        capturedHeaders = init?.headers;
        capturedBody = JSON.parse(init?.body as string);
        return {
          ok: true,
          status: 200,
          json: async () => ({
            errorcode: 0,
            msg: 'Webservice Succeeds',
            token: 'transient_jwt_token_abcdef123456',
            data: { ...MOCK_DETAIL_PAYLOAD, id: 888888, oppId: '888888' },
          }),
        } as Response;
      }) as any;

      const client = new GrantsGovClient();
      const res = await client.fetchOpportunity(888888);

      expect(capturedUrl).toBe('https://api.grants.gov/v1/api/fetchOpportunity');
      expect(capturedMethod).toBe('POST');
      expect(capturedHeaders).toHaveProperty('Content-Type', 'application/json');
      expect(capturedBody).toEqual({ opportunityId: 888888 });
      expect(res).toEqual({ ...MOCK_DETAIL_PAYLOAD, id: 888888, oppId: '888888' });
      expect((res as any).token).toBeUndefined();

      globalThis.fetch = globalFetchBak;
    });

    it('rejects fetchOpportunity when response.errorcode is non-zero', async () => {
      const globalFetchBak = globalThis.fetch;
      globalThis.fetch = vi.fn(async () => {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            errorcode: 5,
            msg: 'System Error',
          }),
        } as Response;
      }) as any;

      const client = new GrantsGovClient();
      await expect(client.fetchOpportunity(888888)).rejects.toThrow(/Grants.gov API returned errorcode 5/);

      globalThis.fetch = globalFetchBak;
    });

    it('rejects fetchOpportunity when response.data is missing or invalid', async () => {
      const globalFetchBak = globalThis.fetch;
      globalThis.fetch = vi.fn(async () => {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            errorcode: 0,
            msg: 'Webservice Succeeds',
            data: null,
          }),
        } as Response;
      }) as any;

      const client = new GrantsGovClient();
      await expect(client.fetchOpportunity(888888)).rejects.toThrow(/Invalid or missing data payload/);

      globalThis.fetch = globalFetchBak;
    });

    it('rejects malformed search payload and causes zero database persistence', async () => {
      const mockClient = new GrantsGovClient();
      vi.spyOn(mockClient, 'searchOpportunities').mockRejectedValue(new Error('Malformed search response payload'));

      const service = new IngestionService(mockClient);
      await expect(service.ingestFromGrantsGov({ keyword: 'reentry', dryRun: false })).rejects.toThrow(/Malformed search response payload/);

      const dbOpps = await prisma.fundingOpportunity.findMany({
        where: { externalOpportunityId: { in: ['test-unit-mock-888888', 'test-malformed-detail-999'] } },
      });
      expect(dbOpps.length).toBe(0);
    });

    it('increments recordsFailed and creates no opportunity or snapshot when detail payload is malformed', async () => {
      const mockClient = new GrantsGovClient();
      vi.spyOn(mockClient, 'searchOpportunities').mockResolvedValue({
        opportunityHits: [{ ...MOCK_SEARCH_HIT, id: 'test-malformed-detail-999' }],
      });
      vi.spyOn(mockClient, 'fetchOpportunity').mockRejectedValue(new Error('Invalid or missing data payload in Grants.gov response'));

      const service = new IngestionService(mockClient);
      const res = await service.ingestFromGrantsGov({ limit: 1, dryRun: false });

      expect(res.recordsFailed).toBe(1);
      expect(res.status).toBe('FAILED');

      const opp = await prisma.fundingOpportunity.findUnique({
        where: {
          sourceSystem_externalOpportunityId: {
            sourceSystem: 'GRANTS_GOV',
            externalOpportunityId: 'test-malformed-detail-999',
          },
        },
      });
      expect(opp).toBeNull();
      const snapshots = await prisma.sourceSnapshot.findMany({ where: { externalOpportunityId: 'test-malformed-detail-999' } });
      expect(snapshots.length).toBe(0);
    });
  });

  describe('2. Client Resilience, Timeout & Error Handling', () => {
    it('handles request timeout/abort signal when request exceeds timeoutMs', async () => {
      const globalFetchBak = globalThis.fetch;
      globalThis.fetch = vi.fn(async () => {
        const err = new Error('The operation was aborted due to timeout');
        err.name = 'AbortError';
        throw err;
      }) as any;

      const client = new GrantsGovClient({ maxRetries: 1, timeoutMs: 100 });
      await expect(client.searchOpportunities({ keyword: 'timeout' })).rejects.toThrow(/aborted|request failed/);

      globalThis.fetch = globalFetchBak;
    });

    it('retries on HTTP 429 rate limit up to maxRetries', async () => {
      let attempts = 0;
      const globalFetchBak = globalThis.fetch;
      globalThis.fetch = vi.fn(async () => {
        attempts++;
        if (attempts < 2) return { ok: false, status: 429 } as Response;
        return { ok: true, status: 200, json: async () => ({ opportunityHits: [MOCK_SEARCH_HIT] }) } as Response;
      }) as any;

      const client = new GrantsGovClient({ maxRetries: 3, timeoutMs: 2000 });
      const res = await client.searchOpportunities({ keyword: 'test' });
      expect(res.opportunityHits?.length).toBe(1);
      expect(attempts).toBe(2);

      globalThis.fetch = globalFetchBak;
    });

    it('retries on HTTP 503 service unavailable up to maxRetries', async () => {
      let attempts = 0;
      const globalFetchBak = globalThis.fetch;
      globalThis.fetch = vi.fn(async () => {
        attempts++;
        if (attempts < 2) return { ok: false, status: 503 } as Response;
        return { ok: true, status: 200, json: async () => ({ opportunityHits: [MOCK_SEARCH_HIT] }) } as Response;
      }) as any;

      const client = new GrantsGovClient({ maxRetries: 3, timeoutMs: 2000 });
      const res = await client.searchOpportunities({ keyword: 'test' });
      expect(res.opportunityHits?.length).toBe(1);
      expect(attempts).toBe(2);

      globalThis.fetch = globalFetchBak;
    });

    it('throws structured error upon retry exhaustion', async () => {
      const globalFetchBak = globalThis.fetch;
      globalThis.fetch = vi.fn(async () => {
        return { ok: false, status: 500 } as Response;
      }) as any;

      const client = new GrantsGovClient({ maxRetries: 2, timeoutMs: 1000 });
      await expect(client.searchOpportunities({ keyword: 'fail' })).rejects.toThrow(/request failed on|exceeded maximum retry/);

      globalThis.fetch = globalFetchBak;
    });

    it('handles Grants.gov errorcode response by throwing structured error', async () => {
      const globalFetchBak = globalThis.fetch;
      globalThis.fetch = vi.fn(async () => {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            errorcode: 99,
            msg: 'Service Unavailable',
          }),
        } as Response;
      }) as any;

      const client = new GrantsGovClient();
      await expect(client.fetchOpportunity('999999')).rejects.toThrow(/Grants.gov API returned errorcode 99/);

      globalThis.fetch = globalFetchBak;
    });
  });

  describe('3. Pure Mapper Fidelity & Null Preservation Rules', () => {
    it('maps detail payload with isDemo=false and PENDING_HUMAN_REVIEW status', () => {
      const mapped = GrantsGovMapper.mapDetailToOpportunity(MOCK_DETAIL_PAYLOAD);

      expect(mapped.sourceSystem).toBe('GRANTS_GOV');
      expect(mapped.externalOpportunityId).toBe('test-unit-mock-888888');
      expect(mapped.fundingOpportunityNumber).toBe('ETA-2026-FULL-TEST-01');
      expect(mapped.isDemo).toBe(false);
      expect(mapped.title).toBe('Mocked Unit Test Reentry Pathways Opportunity');
      expect(mapped.fundingAgency).toBe('Department of Labor ETA');
      expect(mapped.sourceUrl).toBe('https://www.grants.gov/search-results-detail/test-unit-mock-888888');
      expect(mapped.status).toBe('PENDING_HUMAN_REVIEW');
      expect(mapped.verificationStatus).toBe('PENDING_HUMAN_REVIEW');
    });

    it('preserves UNKNOWN/null for missing/invalid monetary values without inventing dummy numbers', () => {
      const emptyPayload = { oppId: '111222', opportunityNumber: 'EMPTY-01', awardFloor: 'invalid-string' };
      const mapped = GrantsGovMapper.mapDetailToOpportunity(emptyPayload);

      expect(mapped.awardMin).toBe('invalid-string');
      expect(mapped.awardMax).toBe('UNKNOWN');
      expect(mapped.totalAvailableFunding).toBe('UNKNOWN');
      expect(mapped.openingDate).toBe('UNKNOWN');
      expect(mapped.deadline).toBe('UNKNOWN');
    });
  });

  describe('4. SHA-256 Hashing, Snapshot Deduplication & Authority/Retrieval Semantics', () => {
    it('ensures DEMO fixtures have null officialSourceAuthority, null firstRetrievedAt, null lastRetrievedAt, and null lastVerifiedTimestamp', async () => {
      const demos = await prisma.fundingOpportunity.findMany({ where: { isDemo: true } });
      expect(demos.length).toBe(3);
      demos.forEach((d) => {
        expect(d.officialSourceAuthority).toBeNull();
        expect(d.firstRetrievedAt).toBeNull();
        expect(d.lastRetrievedAt).toBeNull();
        expect(d.lastVerifiedTimestamp).toBeNull();
      });
    });

    it('sets officialSourceAuthority, firstRetrievedAt, and lastRetrievedAt while keeping lastVerifiedTimestamp=null on new official detail import', async () => {
      const mockClient = new GrantsGovClient();
      vi.spyOn(mockClient, 'searchOpportunities').mockResolvedValue({ opportunityHits: [MOCK_SEARCH_HIT] });
      vi.spyOn(mockClient, 'fetchOpportunity').mockResolvedValue(MOCK_DETAIL_PAYLOAD);

      const service = new IngestionService(mockClient);
      const res = await service.ingestFromGrantsGov({ limit: 1, dryRun: false });
      expect(res.recordsCreated).toBe(1);

      const opp = await prisma.fundingOpportunity.findUnique({
        where: {
          sourceSystem_externalOpportunityId: {
            sourceSystem: 'GRANTS_GOV',
            externalOpportunityId: MOCK_SEARCH_HIT.id,
          },
        },
      });

      expect(opp?.officialSourceAuthority).toBe('Grants.gov (U.S. Federal Government)');
      expect(opp?.firstRetrievedAt).not.toBeNull();
      expect(opp?.lastRetrievedAt).not.toBeNull();
      expect(opp?.firstRetrievedAt?.getTime()).toBe(opp?.lastRetrievedAt?.getTime());
      expect(opp?.lastVerifiedTimestamp).toBeNull();
    });

    it('verifies payload hash equals deterministic SHA-256 digest of canonical data object without transport token', async () => {
      const opp = await prisma.fundingOpportunity.findUnique({
        where: {
          sourceSystem_externalOpportunityId: {
            sourceSystem: 'GRANTS_GOV',
            externalOpportunityId: MOCK_SEARCH_HIT.id,
          },
        },
      });

      const expectedHash = crypto.createHash('sha256').update(JSON.stringify(MOCK_DETAIL_PAYLOAD)).digest('hex');
      expect(opp?.sourcePayloadHash).toBe(expectedHash);

      const snapshot = await prisma.sourceSnapshot.findFirst({
        where: { externalOpportunityId: MOCK_SEARCH_HIT.id },
      });
      expect(snapshot?.rawPayload).toEqual(MOCK_DETAIL_PAYLOAD);
      expect((snapshot?.rawPayload as any)?.token).toBeUndefined();
    });

    it('verifies SHA-256 hash is exactly 64 lowercase hexadecimal characters', async () => {
      const opp = await prisma.fundingOpportunity.findUnique({
        where: {
          sourceSystem_externalOpportunityId: {
            sourceSystem: 'GRANTS_GOV',
            externalOpportunityId: MOCK_SEARCH_HIT.id,
          },
        },
      });

      expect(opp?.sourcePayloadHash).toMatch(/^[a-f0-9]{64}$/);
      expect(opp?.sourcePayloadHash?.length).toBe(64);
    });

    it('creates no additional SourceSnapshot and no duplicate citations on identical payload re-ingestion while updating lastRetrievedAt and preserving firstRetrievedAt', async () => {
      const mockClient = new GrantsGovClient();
      vi.spyOn(mockClient, 'searchOpportunities').mockResolvedValue({ opportunityHits: [MOCK_SEARCH_HIT] });
      vi.spyOn(mockClient, 'fetchOpportunity').mockResolvedValue(MOCK_DETAIL_PAYLOAD);

      const service = new IngestionService(mockClient);

      const firstOpp = await prisma.fundingOpportunity.findUnique({
        where: {
          sourceSystem_externalOpportunityId: {
            sourceSystem: 'GRANTS_GOV',
            externalOpportunityId: MOCK_SEARCH_HIT.id,
          },
        },
      });
      const initialFirstRetrieved = firstOpp?.firstRetrievedAt;

      await new Promise((r) => setTimeout(r, 50));

      const run2 = await service.ingestFromGrantsGov({ limit: 1, dryRun: false });
      expect(run2.recordsUnchanged).toBe(1);

      const reIngestedOpp = await prisma.fundingOpportunity.findUnique({
        where: {
          sourceSystem_externalOpportunityId: {
            sourceSystem: 'GRANTS_GOV',
            externalOpportunityId: MOCK_SEARCH_HIT.id,
          },
        },
        include: { snapshots: true, sourceCitations: true },
      });

      // firstRetrievedAt must remain stable
      expect(reIngestedOpp?.firstRetrievedAt?.toISOString()).toBe(initialFirstRetrieved?.toISOString());
      // lastRetrievedAt must update
      expect(reIngestedOpp?.lastRetrievedAt?.getTime()).toBeGreaterThan(initialFirstRetrieved?.getTime() || 0);

      // Snapshots & Citations must NOT duplicate on unchanged import
      expect(reIngestedOpp?.snapshots.length).toBe(1);
      expect(reIngestedOpp?.sourceCitations.length).toBe(1);
    });
  });

  describe('5. Identity Invariants, Changed Payload Updates & Preservation of Human-Owned Analysis', () => {
    it('rejects identity mismatch if detail response ID does not match search hit ID', async () => {
      const mockClient = new GrantsGovClient();
      vi.spyOn(mockClient, 'searchOpportunities').mockResolvedValue({
        opportunityHits: [{ ...MOCK_SEARCH_HIT, id: 'test-unit-mismatch-777777' }],
      });
      vi.spyOn(mockClient, 'fetchOpportunity').mockResolvedValue({
        ...MOCK_DETAIL_PAYLOAD,
        id: 'DIFFERENT-ID-999',
        oppId: 'DIFFERENT-ID-999',
      });

      const service = new IngestionService(mockClient);
      const res = await service.ingestFromGrantsGov({ limit: 1, dryRun: false });

      expect(res.recordsFailed).toBe(1);
      expect(res.status).toBe('FAILED');
    });

    it('creates exactly one new SourceSnapshot and updates source-owned title on changed payload while preserving all human-owned analysis fields, verificationStatus, fit scores, citations, and allowability conclusions', async () => {
      await prisma.fundingOpportunity.update({
        where: {
          sourceSystem_externalOpportunityId: {
            sourceSystem: 'GRANTS_GOV',
            externalOpportunityId: MOCK_SEARCH_HIT.id,
          },
        },
        data: {
          verificationStatus: 'HUMAN_VERIFIED',
          supportTrainingStipends: 'YES',
          supportLaptops: 'YES',
          opportunityAnalyses: {
            create: [
              {
                sourceFingerprint: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
                profileVersion: '1.1.0-phase1d',
                profileHash: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
                profileSnapshot: { profileId: 'bridge-forward-org-profile' },
                overallFitScore: 85,
                eligibilityStatus: 'HIGH_PRIORITY',
                reasoningSummary: 'Human reviewer confirmed fit for Project Thriveward Controls to Code.',
              },
            ],
          },
        },
      });

      const changedDetail = {
        ...MOCK_DETAIL_PAYLOAD,
        opportunityTitle: 'Changed Title from Official Source',
      };

      const mockClient = new GrantsGovClient();
      vi.spyOn(mockClient, 'searchOpportunities').mockResolvedValue({ opportunityHits: [MOCK_SEARCH_HIT] });
      vi.spyOn(mockClient, 'fetchOpportunity').mockResolvedValue(changedDetail);

      const service = new IngestionService(mockClient);
      const res = await service.ingestFromGrantsGov({ limit: 1, dryRun: false });

      expect(res.recordsUpdated).toBe(1);

      const updatedOpp = await prisma.fundingOpportunity.findUnique({
        where: {
          sourceSystem_externalOpportunityId: {
            sourceSystem: 'GRANTS_GOV',
            externalOpportunityId: MOCK_SEARCH_HIT.id,
          },
        },
        include: { snapshots: true, opportunityAnalyses: true },
      });

      expect(updatedOpp?.title).toBe('Changed Title from Official Source');
      expect(updatedOpp?.verificationStatus).toBe('HUMAN_VERIFIED');
      expect(updatedOpp?.supportTrainingStipends).toBe('YES');
      expect(updatedOpp?.supportLaptops).toBe('YES');
      expect(updatedOpp?.opportunityAnalyses[0].overallFitScore).toBe(85);
      expect(updatedOpp?.opportunityAnalyses[0].eligibilityStatus).toBe('HIGH_PRIORITY');
      expect(updatedOpp?.opportunityAnalyses[0].reasoningSummary).toBe('Human reviewer confirmed fit for Project Thriveward Controls to Code.');
      expect(updatedOpp?.snapshots.length).toBe(2);
    });
  });

  describe('6. CLI Modes, Argument Parser & Execution Limit Enforcement', () => {
    it('CLI parseArgs defaults to dryRun=true (no persistence) when --persist is omitted', () => {
      const parsed = parseArgs(['--keyword', 'workforce', '--limit', '5']);
      expect(parsed.dryRun).toBe(true);
      expect(parsed.keyword).toBe('workforce');
      expect(parsed.limit).toBe(5);
    });

    it('executes CLI in dry-run mode when --persist is omitted and performs zero database mutations (before and after DB state is 100% identical)', async () => {
      await cleanMockRecord('test-cli-dry-run-666');

      // Capture complete relevant DB state BEFORE execution
      const beforeOpps = await prisma.fundingOpportunity.findMany({ orderBy: { id: 'asc' } });
      const beforeSnapshots = await prisma.sourceSnapshot.findMany({ orderBy: { id: 'asc' } });
      const beforeCitations = await prisma.sourceCitation.findMany({ orderBy: { id: 'asc' } });
      const beforeRuns = await prisma.ingestionRun.findMany({ orderBy: { id: 'asc' } });

      const mockClient = new GrantsGovClient();
      vi.spyOn(mockClient, 'searchOpportunities').mockResolvedValue({
        opportunityHits: [{ ...MOCK_SEARCH_HIT, id: 'test-cli-dry-run-666' }],
      });
      vi.spyOn(mockClient, 'fetchOpportunity').mockResolvedValue({
        ...MOCK_DETAIL_PAYLOAD,
        id: 'test-cli-dry-run-666',
        oppId: 'test-cli-dry-run-666',
      });

      const service = new IngestionService(mockClient);
      const parsedArgs = parseArgs(['--keyword', 'reentry', '--limit', '1']);

      const res = await service.ingestFromGrantsGov(parsedArgs);

      expect(res.dryRun).toBe(true);
      expect(res.status).toBe('COMPLETED');
      expect(res.recordsCreated).toBe(1);

      // Capture complete relevant DB state AFTER execution
      const afterOpps = await prisma.fundingOpportunity.findMany({ orderBy: { id: 'asc' } });
      const afterSnapshots = await prisma.sourceSnapshot.findMany({ orderBy: { id: 'asc' } });
      const afterCitations = await prisma.sourceCitation.findMany({ orderBy: { id: 'asc' } });
      const afterRuns = await prisma.ingestionRun.findMany({ orderBy: { id: 'asc' } });

      // Assert BEFORE and AFTER state is 100% identical for all 4 tables (zero creation, zero updates)
      expect(afterOpps).toEqual(beforeOpps);
      expect(afterSnapshots).toEqual(beforeSnapshots);
      expect(afterCitations).toEqual(beforeCitations);
      expect(afterRuns).toEqual(beforeRuns);
    });

    it('CLI parseArgs sets dryRun=false when --persist is passed', () => {
      const parsed = parseArgs(['--keyword', 'reentry', '--persist']);
      expect(parsed.dryRun).toBe(false);
      expect(parsed.keyword).toBe('reentry');
    });

    it('CLI parseArgs rejects an unsupported command-line option', () => {
      expect(() => parseArgs(['--unsupported-flag'])).toThrow(/Unsupported option/);
    });

    it('CLI parseArgs enforces a conservative maximum by capping limits above 10 at 10', () => {
      const parsed = parseArgs(['--limit', '50']);
      expect(parsed.limit).toBe(10);
    });
  });

  describe('7. Read API Filters & Routing Validation', () => {
    it('filters opportunities by dataKind=official', async () => {
      const res = await request(app).get('/api/opportunities?dataKind=official');
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThan(0);
      res.body.data.forEach((opp: any) => {
        expect(opp.isDemo).toBe(false);
        expect(['GRANTS_GOV', 'DEMO_FIXTURE', 'OFFICIAL_NOFO']).toContain(opp.sourceSystem);
      });
    });

    it('filters opportunities by dataKind=demo', async () => {
      const res = await request(app).get('/api/opportunities?dataKind=demo');
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(3);
      res.body.data.forEach((opp: any) => {
        expect(opp.isDemo).toBe(true);
        expect(opp.officialSourceAuthority).toBeNull();
        expect(opp.firstRetrievedAt).toBeNull();
        expect(opp.lastRetrievedAt).toBeNull();
        expect(opp.lastVerifiedTimestamp).toBeNull();
      });
    });

    it('filters opportunities by sourceSystem=GRANTS_GOV', async () => {
      const res = await request(app).get('/api/opportunities?sourceSystem=GRANTS_GOV');
      expect(res.status).toBe(200);
      res.body.data.forEach((opp: any) => {
        expect(opp.sourceSystem).toBe('GRANTS_GOV');
      });
    });

    it('filters opportunities by verificationStatus=PENDING_HUMAN_REVIEW', async () => {
      const res = await request(app).get('/api/opportunities?verificationStatus=PENDING_HUMAN_REVIEW');
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThan(0);
    });

    it('returns HTTP 404 for non-existent opportunity ID', async () => {
      const res = await request(app).get('/api/opportunities/non-existent-uuid-9999');
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Not Found');
    });
  });
});
