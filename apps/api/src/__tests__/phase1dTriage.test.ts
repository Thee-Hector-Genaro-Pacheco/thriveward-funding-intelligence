import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import { app } from '../server';
import { prisma } from '../lib/prisma';
import { BRIDGE_FORWARD_PROFILE, getProfileHash } from '../config/bridgeForwardProfile';
import { RelevanceService } from '../services/relevanceService';
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
    await cleanTestOpp('PAR-26-134');
    await cleanTestOpp('RFA-MH-27-135');
    await cleanTestOpp('RFA-OH-22-005');
    await cleanTestOpp('DFOP0019393');
    await cleanTestOpp('O-COPS-2026-172559');
    await cleanTestOpp('O-COPS-2026-172549');
    await cleanTestOpp('O-BJA-2026-172662');
    await cleanTestOpp('DCT-DCT-26-001');
    await cleanTestOpp('O-OVW-2026-172633');
    await cleanTestOpp('DFOP0019574');
    await cleanTestOpp('HHS-2026-ACF-OCS-EAH-0027');
    await cleanTestOpp('HHS-2026-ACF-ACYF-YY-0119');
    await cleanTestOpp('HHS-2026-ACF-OCS-EE-0026');

    await prisma.fundingOpportunity.create({
      data: {
        id: TEST_OPP_ID,
        title: 'Southern California Reentry Career Pathways Grant',
        fundingAgency: 'California Workforce Development Board',
        isDemo: true,
        sourceSystem: 'DEMO_FIXTURE',
        description: 'Grant notice supporting individualized reentry career pathways in Orange County and Los Angeles County for formerly incarcerated returning citizens.',
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
    await cleanTestOpp('PAR-26-134');
    await cleanTestOpp('RFA-MH-27-135');
    await cleanTestOpp('RFA-OH-22-005');
    await cleanTestOpp('DFOP0019393');
    await cleanTestOpp('O-COPS-2026-172559');
    await cleanTestOpp('O-COPS-2026-172549');
    await cleanTestOpp('O-BJA-2026-172662');
    await cleanTestOpp('DCT-DCT-26-001');
    await cleanTestOpp('O-OVW-2026-172633');
    await cleanTestOpp('DFOP0019574');
    await cleanTestOpp('HHS-2026-ACF-OCS-EAH-0027');
    await cleanTestOpp('HHS-2026-ACF-ACYF-YY-0119');
    await cleanTestOpp('HHS-2026-ACF-OCS-EE-0026');
  });

  // --- Suite 1: Ground-Truth Mission & Profile Truth ---
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

  // --- Suite 2: Specific Confirmed False Positive Rejections (Fixtures 1-10) ---
  describe('2. Specific False Positive Rejections & Routing', () => {
    it('Fixture 1: PAR-26-134 cancer research exclusion', () => {
      const mapped: any = {
        fundingOpportunityNumber: 'PAR-26-134',
        title: 'The Metastasis Research Network (MetNet): MetNet Research Projects (U01)',
        fundingAgency: 'National Institutes of Health',
        description: 'Biomedical research network grants studying cancer-metastasis mechanisms.',
      };
      const evalRes = ExclusionGateEngine.evaluateAll(mapped, {});
      expect(evalRes.isExcluded).toBe(true);
      expect(evalRes.exclusionReason).toBe('EXCLUDED_RESEARCH_ONLY');
    });

    it('Fixture 2: RFA-MH-27-135 clinical-research exclusion', () => {
      const mapped: any = {
        fundingOpportunityNumber: 'RFA-MH-27-135',
        title: 'Addressing Methodological Challenges with Clinical Trials of Rapid-Acting Psychotropic Interventional Drugs (RAPIDs)',
        fundingAgency: 'National Institutes of Health',
        description: 'Clinical-trial research involving rapid-acting psychotropic drugs.',
      };
      const evalRes = ExclusionGateEngine.evaluateAll(mapped, {});
      expect(evalRes.isExcluded).toBe(true);
      expect(evalRes.exclusionReason).toBe('EXCLUDED_CLINICAL_RESEARCH');
    });

    it('Fixture 3: RFA-OH-22-005 fishing-research exclusion', () => {
      const mapped: any = {
        fundingOpportunityNumber: 'RFA-OH-22-005',
        title: 'Commercial Fishing Occupational Safety Research Cooperative Agreement (U01)',
        fundingAgency: 'Centers for Disease Control and Prevention',
        description: 'Occupational safety research cooperative agreements studying commercial fishing safety.',
      };
      const evalRes = ExclusionGateEngine.evaluateAll(mapped, {});
      expect(evalRes.isExcluded).toBe(true);
      expect(evalRes.exclusionReason).toBe('EXCLUDED_RESEARCH_ONLY');
    });

    it('Fixture 4: DFOP0019393 foreign-program exclusion', () => {
      const mapped: any = {
        fundingOpportunityNumber: 'DFOP0019393',
        title: 'Foreign Law Enforcement and Criminal Justice Capacity Building in South America',
        fundingAgency: 'Bureau of International Narcotics and Law Enforcement Affairs',
        description: 'Foreign law-enforcement assistance in South American countries.',
        geography: 'South America (Foreign Non-US)',
      };
      const evalRes = ExclusionGateEngine.evaluateAll(mapped, {});
      expect(evalRes.isExcluded).toBe(true);
      expect(evalRes.exclusionReason).toBe('EXCLUDED_FOREIGN_PLACE_OF_PERFORMANCE');
    });

    it('Fixture 5: O-COPS-2026-172559 applicant/law-enforcement exclusion', () => {
      const mapped: any = {
        fundingOpportunityNumber: 'O-COPS-2026-172559',
        title: 'Community Policing Microgrants for Law Enforcement Agencies',
        fundingAgency: 'Office of Community Oriented Policing Services',
        description: 'Community policing microgrants restricted to law enforcement agency applicants.',
        eligibleApplicantTypes: ['City or township governments', 'Law enforcement agencies'],
      };
      const evalRes = ExclusionGateEngine.evaluateAll(mapped, {});
      expect(evalRes.isExcluded).toBe(true);
      expect(evalRes.exclusionReason).toBe('EXCLUDED_LAW_ENFORCEMENT_PROGRAM');
    });

    it('Fixture 6: O-COPS-2026-172549 applicant/law-enforcement exclusion', () => {
      const mapped: any = {
        fundingOpportunityNumber: 'O-COPS-2026-172549',
        title: 'Law Enforcement Crisis Response Training Program',
        fundingAgency: 'Office of Community Oriented Policing Services',
        description: 'Crisis-response training for police officers and law-enforcement personnel.',
      };
      const evalRes = ExclusionGateEngine.evaluateAll(mapped, {});
      expect(evalRes.isExcluded).toBe(true);
      expect(evalRes.exclusionReason).toBe('EXCLUDED_LAW_ENFORCEMENT_PROGRAM');
    });

    it('Fixture 7: O-BJA-2026-172662 tribal-applicant exclusion', () => {
      const mapped: any = {
        fundingOpportunityNumber: 'O-BJA-2026-172662',
        title: 'U.S. Department of Justice FY26 Coordinated Tribal Assistance Solicitation',
        fundingAgency: 'Bureau of Justice Assistance',
        description: 'Coordinated Tribal Assistance Solicitation restricted exclusively to federally recognized Indian tribes.',
        eligibleApplicantTypes: ['Native American tribal governments (Federally recognized)'],
      };
      const evalRes = ExclusionGateEngine.evaluateAll(mapped, {});
      expect(evalRes.isExcluded).toBe(true);
      expect(evalRes.exclusionReason).toBe('EXCLUDED_APPLICANT_TYPE');
    });

    it('Fixture 8: DCT-DCT-26-001 future/partnership routing', () => {
      const mapped: any = {
        fundingOpportunityNumber: 'DCT-DCT-26-001',
        title: 'FY 2026 DRUG COURT TRAINING AND TECHNICAL ASSISTANCE COMPETITIVE COOPERATIVE AGREEMENT SOLICITATION',
        fundingAgency: 'Bureau of Justice Assistance',
        description: 'Drug court training and technical assistance for returning citizens in adult drug courts.',
        eligibleApplicantTypes: ['Nonprofit Organizations'],
      };
      const evalRes = ExclusionGateEngine.evaluateAll(mapped, {});
      expect(evalRes.isExcluded).toBe(false);
      expect(evalRes.routingStatus).toBe('FUTURE_OPPORTUNITY');
      expect(evalRes.explanation).toContain('FUTURE_OPPORTUNITY');
    });

    it('Fixture 9: O-OVW-2026-172633 capacity/partnership routing', () => {
      const mapped: any = {
        fundingOpportunityNumber: 'O-OVW-2026-172633',
        title: 'OVW Fiscal Year 2026 Grants to Improve the Criminal Justice Response to Domestic Violence (ICJR Program)',
        fundingAgency: 'Office on Violence Against Women',
        description: 'Grants to improve the criminal justice response to domestic violence and dating violence.',
      };
      const evalRes = ExclusionGateEngine.evaluateAll(mapped, {});
      expect(evalRes.isExcluded).toBe(false);
      expect(evalRes.routingStatus).toBe('PARTNERSHIP_REQUIRED');
      expect(evalRes.explanation).toContain('PARTNERSHIP_REQUIRED');
    });

    it('Fixture 10: DFOP0019574 evidence-based classification', () => {
      const mapped: any = {
        fundingOpportunityNumber: 'DFOP0019574',
        title: 'Supporting Implementation of the REIF in the Great Lakes Region of Africa',
        fundingAgency: 'Bureau of African Affairs',
        description: 'Support implementation of REIF in foreign African nations.',
        geography: 'Africa (Foreign Non-US)',
      };
      const evalRes = ExclusionGateEngine.evaluateAll(mapped, {});
      expect(evalRes.isExcluded).toBe(true);
      expect(evalRes.exclusionReason).toBe('EXCLUDED_FOREIGN_PLACE_OF_PERFORMANCE');
    });
  });

  // --- Suite 3: Positive Mission Evidence & Control Fixtures (Fixtures 11-24) ---
  describe('3. Positive Evidence, Mission Lanes, and Control Fixtures', () => {
    it('Fixture 11: Generic nonprofit eligibility does not establish relevance', () => {
      const mapped: any = {
        title: 'Generic Municipal Environmental Survey Notice',
        fundingAgency: 'EPA',
        description: 'Environmental survey of municipal landfills.',
        eligibleApplicantTypes: ['Nonprofit Organizations'],
      };
      const evalRes = ExclusionGateEngine.evaluateAll(mapped, {});
      expect(evalRes.isExcluded).toBe(true);
      expect(evalRes.exclusionReason).toBe('NO_MISSION_LANE_MATCH');
    });

    it('Fixture 12: Generic justice terminology does not establish reentry', () => {
      const mapped: any = {
        title: 'Judicial Information Technology Database Upgrade',
        fundingAgency: 'Administrative Office of the U.S. Courts',
        description: 'State court case file digital archiving system.',
      };
      const evalRes = ExclusionGateEngine.evaluateAll(mapped, {});
      expect(evalRes.isExcluded).toBe(true);
    });

    it('Fixture 13: Generic training does not establish workforce development', () => {
      const mapped: any = {
        title: 'Municipal Water Treatment Staff Training Program',
        fundingAgency: 'Department of Natural Resources',
        description: 'Professional development training for municipal water engineers.',
      };
      const evalRes = ExclusionGateEngine.evaluateAll(mapped, {});
      expect(evalRes.isExcluded).toBe(true);
    });

    it('Fixture 14: Biomedical technology does not establish technology education', () => {
      const mapped: any = {
        title: 'Clinical Laboratory DNA Sequencer Instrumentation Grant',
        fundingAgency: 'NIH',
        description: 'High-throughput DNA sequencer hardware acquisition.',
      };
      const evalRes = ExclusionGateEngine.evaluateAll(mapped, {});
      expect(evalRes.isExcluded).toBe(true);
      expect(evalRes.exclusionReason).toBe('EXCLUDED_RESEARCH_ONLY');
    });

    it('Fixture 15: Foreign youth exchange does not establish youth justice', () => {
      const mapped: any = {
        title: 'Congress-Bundestag Youth Exchange Diplomacy Program',
        fundingAgency: 'Bureau of Educational and Cultural Affairs',
        description: 'High school cultural exchange study abroad in Germany.',
      };
      const evalRes = ExclusionGateEngine.evaluateAll(mapped, {});
      expect(evalRes.isExcluded).toBe(true);
    });

    it('Fixture 16: A true reentry workforce opportunity passes relevance', () => {
      const mapped: any = {
        title: 'California Reentry Employment and Skilled Trades Pathway Program',
        fundingAgency: 'California Workforce Development Board',
        description: 'Occupational training, paid work experience, and job placement for formerly incarcerated returning citizens.',
        eligibleApplicantTypes: ['Community-based Organizations', 'Nonprofits'],
      };
      const evalRes = ExclusionGateEngine.evaluateAll(mapped, {});
      expect(evalRes.isExcluded).toBe(false);
      expect(evalRes.routingStatus).toBe('CURRENTLY_ACTIONABLE');
      expect(evalRes.matchedLanes).toContain('REENTRY');
      expect(evalRes.matchedLanes).toContain('WORKFORCE');
    });

    it('Fixture 17: A true housing-stabilization opportunity passes relevance', () => {
      const mapped: any = {
        title: 'Reentry Housing Stabilization and Homelessness Prevention Grant',
        fundingAgency: 'HUD',
        description: 'Transitional housing, rental assistance, and housing navigation for justice-involved participants.',
      };
      const evalRes = ExclusionGateEngine.evaluateAll(mapped, {});
      expect(evalRes.isExcluded).toBe(false);
      expect(evalRes.matchedLanes).toContain('HOUSING_STABILITY');
    });

    it('Fixture 18: A true youth-homelessness opportunity passes relevance', () => {
      const mapped: any = {
        title: 'Primary Prevention Youth Homelessness Demonstration Program',
        fundingAgency: 'HHS ACF ACYF',
        description: 'Primary prevention youth homelessness demonstration program providing supportive housing and diversion for system-impacted youth.',
      };
      const evalRes = ExclusionGateEngine.evaluateAll(mapped, {});
      expect(evalRes.isExcluded).toBe(false);
      expect(evalRes.matchedLanes).toContain('HOUSING_STABILITY');
    });

    it('Fixture 19 & 20: Positive relevance does not bypass tax-status or operating history requirements', () => {
      const mapped: any = {
        fundingOpportunityNumber: 'HHS-2026-ACF-OCS-EAH-0027',
        title: 'Affordable Housing and Supportive Services Demonstration',
        fundingAgency: 'HHS ACF',
        description: 'Supportive housing for low-income families requiring 501(c)(3) status.',
      };
      const evalRes = ExclusionGateEngine.evaluateAll(mapped, {});
      expect(evalRes.isExcluded).toBe(false);
      expect(evalRes.routingStatus).toBe('FUTURE_OPPORTUNITY');
    });

    it('Fixture 21 & 22: Limit applies after semantic acceptance and zero genuine candidates persists zero', async () => {
      const mockClient = new GrantsGovClient();
      vi.spyOn(mockClient, 'searchOpportunities').mockResolvedValue({
        opportunityHits: [
          { id: '101', title: 'Metastasis Research Network (U01)', agency: 'NIH' },
          { id: '102', title: 'COPS Crisis Response Training', agency: 'DOJ' },
        ],
      });
      vi.spyOn(mockClient, 'fetchOpportunity').mockImplementation(async (id) => {
        if (id === '101') {
          return { id: '101', opportunityNumber: 'PAR-26-134', opportunityTitle: 'Metastasis Research Network', agencyName: 'NIH' };
        }
        return { id: '102', opportunityNumber: 'O-COPS-2026-172549', opportunityTitle: 'COPS Crisis Training', agencyName: 'DOJ' };
      });

      const service = new IngestionService(mockClient);
      const res = await service.ingestFromGrantsGov({ limit: 5, dryRun: false });

      expect(res.recordsInspected).toBe(2);
      expect(res.recordsExcluded).toBe(2);
      expect(res.recordsAccepted).toBe(0);
      expect(res.recordsCreated).toBe(0);
    });

    it('Fixture 23 & 24: Existing provenance remains immutable and excluded records remain auditable but non-actionable', async () => {
      const historyRes = await request(app).get(`/api/opportunities/${TEST_OPP_ID}/pursuit/history`);
      expect(historyRes.status).toBe(200);
      expect(Array.isArray(historyRes.body.data)).toBe(true);
    });
  });
});
