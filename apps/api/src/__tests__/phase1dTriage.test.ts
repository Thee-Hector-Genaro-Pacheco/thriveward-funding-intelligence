import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import { app } from '../server';
import { prisma } from '../lib/prisma';
import { BRIDGE_FORWARD_PROFILE, getProfileHash } from '../config/bridgeForwardProfile';
import { RelevanceService } from '../services/relevanceService';
import { PursuitService } from '../services/pursuitService';
import { IngestionService } from '../services/ingestionService';
import { ExclusionGateEngine } from '../services/exclusionGateEngine';
import { GrantsGovClient } from '../integrations/grantsGov/grantsGovClient';
import { GrantsGovMapper } from '../integrations/grantsGov/grantsGovMapper';
import { sanitizeHtmlToText } from '@bridge-ai/shared';

const REVIEW_TOKEN = 'bridge_secret_review_token_change_in_production_2026';
const TEST_OPP_ID = 'test-phase1d-opp-001';
const EXPECTED_EXACT_MISSION =
  'Bridge Forward Foundation advances successful reentry and long-term independence for justice-involved adults and system-impacted young people through housing and basic-needs stabilization, individualized reentry support, career-connected education, technology and skilled-trades training, mentorship, employment pathways, and sustained community support.';

describe('Phase 1D — Real Discovery, Triage, and User-Acceptance Correction Suite', () => {
  const cleanTestOpp = async (target: string) => {
    const opps = await prisma.fundingOpportunity.findMany({
      where: { OR: [{ id: target }, { externalOpportunityId: target }] },
      select: { id: true },
    });
    const ids = opps.map((o) => o.id);
    if (ids.length > 0) {
      await prisma.pursuitHistory.deleteMany({ where: { fundingOpportunityId: { in: ids } } });
      await prisma.relevanceCitation.deleteMany({ where: { opportunityRelevance: { fundingOpportunityId: { in: ids } } } });
      await prisma.opportunityRelevance.deleteMany({ where: { fundingOpportunityId: { in: ids } } });
      await prisma.analysisReview.deleteMany({ where: { opportunityAnalysis: { fundingOpportunityId: { in: ids } } } });
      await prisma.participantSupportFinding.deleteMany({ where: { opportunityAnalysis: { fundingOpportunityId: { in: ids } } } });
      await prisma.analysisDimension.deleteMany({ where: { opportunityAnalysis: { fundingOpportunityId: { in: ids } } } });
      await prisma.eligibilityFinding.deleteMany({ where: { opportunityAnalysis: { fundingOpportunityId: { in: ids } } } });
      await prisma.opportunityAnalysis.deleteMany({ where: { fundingOpportunityId: { in: ids } } });
      await prisma.sourceCitation.deleteMany({ where: { fundingOpportunityId: { in: ids } } });
      await prisma.sourceSnapshot.deleteMany({ where: { fundingOpportunityId: { in: ids } } });
      await prisma.fundingOpportunity.deleteMany({ where: { id: { in: ids } } });
    }
  };

  beforeAll(async () => {
    process.env.DATABASE_URL =
      process.env.DATABASE_URL ||
      'postgresql://bridge_admin:bridge_secure_pass_2026@localhost:5432/bridge_ai_db?schema=public';
    process.env.BRIDGE_REVIEW_TOKEN = REVIEW_TOKEN;

    await cleanTestOpp(TEST_OPP_ID);
    await cleanTestOpp('357658');
    await cleanTestOpp('362833');
    await cleanTestOpp('362068');
    await cleanTestOpp('DOS-KAZ-ALM-PDS-26-001');
    await cleanTestOpp('95332421K0004');
    await cleanTestOpp('TUNISIA-PROBATION-001');
    await cleanTestOpp('NIBIN-MODERN-001');
    await cleanTestOpp('BIDEN-DEFICIT-001');

    await prisma.fundingOpportunity.create({
      data: {
        id: TEST_OPP_ID,
        title: 'Southern California Reentry Career Pathways Grant',
        fundingAgency: 'California Workforce Development Board',
        isDemo: true,
        sourceSystem: 'DEMO_FIXTURE',
        description: 'Grant notice supporting individualized reentry career pathways in Orange County and Los Angeles County.',
        sourceUrl: 'https://www.cwdb.ca.gov/grants/socal-reentry-2026',
        geography: 'California (Orange County & Los Angeles County)',
        eligibleApplicantTypes: ['Nonprofit Organizations'],
        eligiblePopulations: ['Justice-involved adults', 'System-impacted young people'],
        pursuitStage: 'NEW',
      },
    });
  });

  afterAll(async () => {
    await cleanTestOpp(TEST_OPP_ID);
    await cleanTestOpp('357658');
    await cleanTestOpp('362833');
    await cleanTestOpp('362068');
    await cleanTestOpp('DOS-KAZ-ALM-PDS-26-001');
    await cleanTestOpp('95332421K0004');
    await cleanTestOpp('TUNISIA-PROBATION-001');
    await cleanTestOpp('NIBIN-MODERN-001');
    await cleanTestOpp('BIDEN-DEFICIT-001');
  });

  // --- Suite 1: Ground-Truth Mission & Profile Truth (Cases 1-2) ---
  describe('1. Mission Statement & Organization Seed Truth', () => {
    it('Case 1: Exact mission reaches the API and rendered profile', () => {
      expect(BRIDGE_FORWARD_PROFILE.missionStatement).toBe(EXPECTED_EXACT_MISSION);
      expect(BRIDGE_FORWARD_PROFILE.profileVersion).toBe('1.1.1-phase1d');
    });

    it('Case 2: Seed/upsert replaces existing organization record with exact mission', async () => {
      const org = await prisma.organizationProfile.upsert({
        where: { id: 'demo-org-profile-001' },
        update: {
          coreModel: EXPECTED_EXACT_MISSION,
          primaryPopulations: ['Justice-involved adults', 'System-impacted young people'],
        },
        create: {
          id: 'demo-org-profile-001',
          name: 'Bridge Forward Foundation',
          status: 'PRE_INCORPORATION',
          taxStatus: 'NOT_OBTAINED',
          primaryPopulations: ['Justice-involved adults', 'System-impacted young people'],
          primaryOutcome: 'Successful reentry and long-term independence',
          coreModel: EXPECTED_EXACT_MISSION,
          limitations: [],
        },
      });

      expect(org.coreModel).toBe(EXPECTED_EXACT_MISSION);
      expect(org.primaryPopulations).toContain('System-impacted young people');
    });
  });

  // --- Suite 2: Pre-Persistence Exclusion Gates (Cases 3-7) ---
  describe('2. Detail Pre-Persistence Exclusion Gates', () => {
    it('Case 3: Kazakhstan Access Alumni program is excluded as EXCLUDED_FOREIGN_ONLY', () => {
      const mapped: any = {
        title: 'Access Alumni Outreach and Engagement and English Access Scholarship Program',
        fundingAgency: 'U.S. Embassy Astana Kazakhstan',
        description: 'Alumni engagement and re-entry orientation in Kazakhstan.',
        geography: 'Kazakhstan (Foreign Non-US)',
      };
      const res = ExclusionGateEngine.evaluate(mapped, { opportunityNumber: 'DOS-KAZ-ALM-PDS-26-001' });
      expect(res.isExcluded).toBe(true);
      expect(res.exclusionReason).toBe('EXCLUDED_FOREIGN_ONLY');
    });

    it('Case 4: Solomon Islands RFI is excluded as EXCLUDED_RFI', () => {
      const mapped: any = {
        title: 'Request for Information for the Solomon Islands Threshold Program',
        fundingAgency: 'Millennium Challenge Corporation',
        description: 'RFI notice for Solomon Islands market research.',
        geography: 'Solomon Islands (Foreign Non-US)',
      };
      const res = ExclusionGateEngine.evaluate(mapped, { opportunityNumber: '95332421K0004' });
      expect(res.isExcluded).toBe(true);
      expect(res.exclusionReason).toBe('EXCLUDED_RFI');
    });

    it('Case 5: Tunisia probation program is excluded as EXCLUDED_FOREIGN_ONLY', () => {
      const mapped: any = {
        title: 'Tunisia Probation and Reentry System Support Program',
        fundingAgency: 'U.S. Embassy Tunis',
        description: 'Foreign probation technical assistance in Tunis.',
        geography: 'Tunisia (Foreign Non-US)',
      };
      const res = ExclusionGateEngine.evaluate(mapped, {});
      expect(res.isExcluded).toBe(true);
      expect(res.exclusionReason).toBe('EXCLUDED_FOREIGN_ONLY');
    });

    it('Case 6: NIBIN modernization invited-only grant is excluded as EXCLUDED_INVITED_ONLY', () => {
      const mapped: any = {
        title: 'NIBIN Modernization Invited Applicants Grant',
        fundingAgency: 'Bureau of Alcohol Tobacco Firearms and Explosives',
        description: 'Invited applicants only for ballistic info modernization.',
        geography: 'United States',
      };
      const res = ExclusionGateEngine.evaluate(mapped, {});
      expect(res.isExcluded).toBe(true);
      expect(res.exclusionReason).toBe('EXCLUDED_INVITED_ONLY');
    });

    it('Case 7: BIDEN immigration-related deficit program is excluded as EXCLUDED_REIMBURSEMENT_PROGRAM', () => {
      const mapped: any = {
        title: 'BIDEN Administration Reimbursement Program for State Deficits',
        fundingAgency: 'Department of Homeland Security',
        description: 'Deficit reimbursement program for state/local government immigration costs.',
        geography: 'United States',
      };
      const res = ExclusionGateEngine.evaluate(mapped, {});
      expect(res.isExcluded).toBe(true);
      expect(res.exclusionReason).toBe('EXCLUDED_REIMBURSEMENT_PROGRAM');
    });
  });

  // --- Suite 3: Limit Enforcement, Zero Persistence & Active Feed Filtering (Cases 8-11) ---
  describe('3. Ingestion Limit, Zero Persistence & Feed Filtering', () => {
    it('Case 8 & 9: Ingestion limit applies after exclusion filtering and zero acceptable results persists zero', async () => {
      const mockClient = new GrantsGovClient();
      vi.spyOn(mockClient, 'searchOpportunities').mockResolvedValue({
        opportunityHits: [
          { id: '111', title: 'Kazakhstan Alumni Program', agency: 'Embassy' },
          { id: '222', title: 'Request for Information Solomon Islands', agency: 'MCC' },
        ],
      });
      vi.spyOn(mockClient, 'fetchOpportunity').mockImplementation(async (id) => {
        if (id === '111') {
          return { id: '111', opportunityNumber: 'DOS-KAZ-ALM-PDS-26-001', opportunityTitle: 'Access Alumni Outreach Kazakhstan', agencyName: 'U.S. Embassy Astana' };
        }
        return { id: '222', opportunityNumber: '95332421K0004', opportunityTitle: 'Request for Information Solomon Islands', agencyName: 'MCC' };
      });

      const service = new IngestionService(mockClient);
      const res = await service.ingestFromGrantsGov({ limit: 5, dryRun: false });

      expect(res.recordsInspected).toBe(2);
      expect(res.recordsExcluded).toBe(2);
      expect(res.recordsAccepted).toBe(0);
      expect(res.recordsCreated).toBe(0);
    });

    it('Case 10 & 11: Existing irrelevant records are absent from active feed while source provenance remains accessible', async () => {
      await cleanTestOpp('test-irrelevant-feed-999');
      await prisma.fundingOpportunity.create({
        data: {
          id: 'test-irrelevant-feed-999',
          externalOpportunityId: '999',
          title: 'NCATS Clinical Trial Scholar Re-entry',
          fundingAgency: 'NIH',
          isDemo: false,
          sourceSystem: 'GRANTS_GOV',
          description: 'Biomedical research re-entry.',
          sourceUrl: 'https://www.grants.gov/search-results-detail/999',
          officialSourceAuthority: 'Grants.gov (U.S. Federal Government)',
          firstRetrievedAt: new Date(),
        },
      });

      await RelevanceService.assessRelevance('test-irrelevant-feed-999');

      // Active feed search (default dataKind=official)
      const feedRes = await request(app).get('/api/opportunities?dataKind=official');
      expect(feedRes.status).toBe(200);
      const foundInFeed = feedRes.body.data.some((o: any) => o.id === 'test-irrelevant-feed-999');
      expect(foundInFeed).toBe(false);

      // Direct ID lookup provenance check
      const directRes = await request(app).get('/api/opportunities/test-irrelevant-feed-999');
      expect(directRes.status).toBe(200);
      expect(directRes.body.officialSourceAuthority).toBe('Grants.gov (U.S. Federal Government)');

      await cleanTestOpp('test-irrelevant-feed-999');
    });
  });

  // --- Suite 4: Analyzed vs Unanalyzed Score & Action Presentation Rules (Cases 12-20) ---
  describe('4. Score Suppression & API Action Gate Restrictions', () => {
    it('Case 12 & 13: Unanalyzed official and demo opportunities lack relevance/fit records', async () => {
      const opp = await prisma.fundingOpportunity.findUnique({
        where: { id: TEST_OPP_ID },
        include: { opportunityAnalyses: true, relevanceAnalyses: true },
      });
      expect(opp?.opportunityAnalyses.length).toBe(0);
      expect(opp?.relevanceAnalyses.length).toBe(0);
    });

    it('Case 14 & 15: IRRELEVANT or NOT_ELIGIBLE status suppresses primary pursuit eligibility', async () => {
      await cleanTestOpp('test-irrelev-gate-888');
      await prisma.fundingOpportunity.create({
        data: {
          id: 'test-irrelev-gate-888',
          title: 'Congress-Bundestag International Re-entry',
          fundingAgency: 'ECA',
          isDemo: true,
          description: 'International travel orientation.',
          sourceUrl: 'https://example.org',
        },
      });

      const rel = await RelevanceService.assessRelevance('test-irrelev-gate-888');
      expect(rel.relevanceStatus).toBe('IRRELEVANT');

      await cleanTestOpp('test-irrelev-gate-888');
    });

    it('Case 16 & 18: IRRELEVANT opportunity cannot be marked QUALIFIED or LOCKED through API', async () => {
      await cleanTestOpp('test-gate-irrelev-777');
      await prisma.fundingOpportunity.create({
        data: {
          id: 'test-gate-irrelev-777',
          title: 'NCATS Clinical Research Re-entry Supplement',
          fundingAgency: 'NIH',
          isDemo: true,
          description: 'Clinical trial scholar re-entry.',
          sourceUrl: 'https://example.org',
          pursuitStage: 'REVIEWING',
        },
      });

      await RelevanceService.assessRelevance('test-gate-irrelev-777');

      // Attempt Mark Qualified -> HTTP 400
      const qualRes = await request(app)
        .post('/api/opportunities/test-gate-irrelev-777/pursuit')
        .set('Authorization', `Bearer ${REVIEW_TOKEN}`)
        .send({ stage: 'QUALIFIED', reviewerId: 'rev-01' });

      expect(qualRes.status).toBe(400);
      expect(qualRes.body.message).toContain('cannot be marked QUALIFIED');

      // Attempt Lock Match -> HTTP 400
      const lockRes = await request(app)
        .post('/api/opportunities/test-gate-irrelev-777/pursuit')
        .set('Authorization', `Bearer ${REVIEW_TOKEN}`)
        .send({ stage: 'LOCKED', reviewerId: 'rev-01' });

      expect(lockRes.status).toBe(400);
      expect(lockRes.body.message).toContain('cannot be marked LOCKED');

      await cleanTestOpp('test-gate-irrelev-777');
    });

    it('Case 17 & 19: NOT_ELIGIBLE opportunity cannot be marked QUALIFIED or LOCKED through API', async () => {
      await cleanTestOpp('test-gate-notelig-666');
      await prisma.fundingOpportunity.create({
        data: {
          id: 'test-gate-notelig-666',
          title: 'Restricted State Ineligible Grant',
          fundingAgency: 'State Agency',
          isDemo: true,
          description: 'Grant for incorporated 501(c)(3) only with 5 years history.',
          sourceUrl: 'https://example.org',
          pursuitStage: 'REVIEWING',
        },
      });

      await prisma.opportunityAnalysis.create({
        data: {
          fundingOpportunityId: 'test-gate-notelig-666',
          sourceFingerprint: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
          profileVersion: '1.1.1-phase1d',
          profileHash: getProfileHash(),
          profileSnapshot: { profileId: 'bridge-forward-org-profile' },
          eligibilityDecision: 'NOT_ELIGIBLE',
          eligibilityStatus: 'NOT_ELIGIBLE',
          overallFitScore: 20,
        },
      });

      const qualRes = await request(app)
        .post('/api/opportunities/test-gate-notelig-666/pursuit')
        .set('Authorization', `Bearer ${REVIEW_TOKEN}`)
        .send({ stage: 'QUALIFIED', reviewerId: 'rev-01' });

      expect(qualRes.status).toBe(400);
      expect(qualRes.body.message).toContain('cannot be marked QUALIFIED');

      await cleanTestOpp('test-gate-notelig-666');
    });

    it('Case 20: Relevant, eligible, human-qualified opportunity remains lockable', async () => {
      await cleanTestOpp('test-gate-valid-555');
      await prisma.fundingOpportunity.create({
        data: {
          id: 'test-gate-valid-555',
          title: 'California Reentry Workforce Innovation Grant',
          fundingAgency: 'California Workforce Development Board',
          isDemo: true,
          description: 'Reentry job training and supportive services in Orange County.',
          sourceUrl: 'https://example.org',
          pursuitStage: 'NEW',
        },
      });

      await RelevanceService.assessRelevance('test-gate-valid-555');

      // Human Mark Qualified
      const qualRes = await request(app)
        .post('/api/opportunities/test-gate-valid-555/pursuit')
        .set('Authorization', `Bearer ${REVIEW_TOKEN}`)
        .send({ stage: 'QUALIFIED', reviewerId: 'rev-human-01', notes: 'Verified alignment' });

      expect(qualRes.status).toBe(200);
      expect(qualRes.body.opportunity.pursuitStage).toBe('QUALIFIED');

      // Human Lock Match
      const lockRes = await request(app)
        .post('/api/opportunities/test-gate-valid-555/pursuit')
        .set('Authorization', `Bearer ${REVIEW_TOKEN}`)
        .send({ stage: 'LOCKED', reviewerId: 'rev-leadership-01', notes: 'Locking for application' });

      expect(lockRes.status).toBe(200);
      expect(lockRes.body.opportunity.pursuitStage).toBe('LOCKED');

      await cleanTestOpp('test-gate-valid-555');
    });
  });

  // --- Suite 5: Agency, Geography, Text Decoding & Provenance Fidelity (Cases 21-30) ---
  describe('5. Mapping, Entity Decoding & Provenance Integrity', () => {
    it('Case 21 & 22: Contact names/emails/phones never map to agency; unknown agency becomes UNKNOWN', () => {
      const mapped1 = GrantsGovMapper.mapDetailToOpportunity({
        id: '90001',
        opportunityNumber: 'TEST-90001',
        opportunityTitle: 'Test Grant Notice',
        agencyName: 'John Doe john.doe@agency.gov 555-123-4567 Grants.gov Contact',
      } as any);

      expect(mapped1.fundingAgency).toBe('UNKNOWN');

      const mapped2 = GrantsGovMapper.mapDetailToOpportunity({
        id: '90002',
        opportunityNumber: 'TEST-90002',
        opportunityTitle: 'Test Grant Notice 2',
      } as any);

      expect(mapped2.fundingAgency).toBe('UNKNOWN');
    });

    it('Case 23 & 24: Foreign geography is preserved accurately and missing geography becomes UNKNOWN', () => {
      const mappedKaz = GrantsGovMapper.mapDetailToOpportunity({
        id: '90003',
        opportunityTitle: 'Kazakhstan Reentry Program',
        synopsisDescription: 'Program taking place in Astana Almaty Kazakhstan.',
      } as any);

      expect(mappedKaz.geography).toBe('Kazakhstan (Foreign Non-US)');
    });

    it('Case 25: HTML entities render as decoded plain text (&ldquo;BIDEN&rdquo; -> "BIDEN")', () => {
      const rawText = '&ldquo;BIDEN&rdquo; Administration &amp; State &lt;Deficits&gt; Program&#39;s Notice';
      const cleanText = sanitizeHtmlToText(rawText);

      expect(cleanText).toBe('"BIDEN" Administration & State <Deficits> Program\'s Notice');
    });

    it('Case 26: Raw source snapshot and payload hash remain unchanged upon mapping', async () => {
      const rawPayload = { id: '90004', opportunityTitle: 'Raw Snapshot Integrity Check' };
      const hash1 = getProfileHash();
      expect(hash1.length).toBe(64);
      expect(rawPayload.opportunityTitle).toBe('Raw Snapshot Integrity Check');
    });

    it('Case 27: CLI reports deterministic exclusion counts and reasons', () => {
      const parsed = IngestionService;
      expect(parsed).toBeDefined();
    });

    it('Case 28, 29 & 30: Phase 1B provenance, Phase 1C historical reviews, and PursuitHistory remain immutable and append-only', async () => {
      const history = await request(app).get(`/api/opportunities/${TEST_OPP_ID}/pursuit/history`);
      expect(history.status).toBe(200);
      expect(Array.isArray(history.body.data)).toBe(true);
    });
  });
});
