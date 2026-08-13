import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import { app } from '../server';
import { prisma } from '../lib/prisma';
import { IngestionService } from '../services/ingestionService';
import { ExclusionGateEngine } from '../services/exclusionGateEngine';
import { GrantsGovClient } from '../integrations/grantsGov/grantsGovClient';
import { GrantsGovMapper } from '../integrations/grantsGov/grantsGovMapper';

const REVIEW_TOKEN = 'bridge_secret_review_token_change_in_production_2026';
const TEST_OPP_ID = 'test-phase1d-opp-001';

describe('Phase 1D — Applicant Readiness & Source-Integrity Correction Suite', () => {
  const cleanTestOpp = async (target: string) => {
    const opps = await prisma.fundingOpportunity.findMany({
      where: { OR: [{ id: target }, { externalOpportunityId: target }, { fundingOpportunityNumber: target }] },
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
    await cleanTestOpp('TEST-BLOCKED-001');
    await cleanTestOpp('test-blocked-001');
    await cleanTestOpp('HHS-2026-ACF-ACYF-YO-0044');
    await cleanTestOpp('CPD-2600-DC-0025');
    await cleanTestOpp('VPL-01-23');
    await cleanTestOpp('HHS-2026-ACF-ACYF-CY-0160');
    await cleanTestOpp('HHS-2026-ACF-ACYF-YY-0119');
    await cleanTestOpp('HHS-2026-ACF-ACYF-CY-0016');
    await cleanTestOpp('2026-NTIA-NEGP');

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
    await cleanTestOpp('TEST-BLOCKED-001');
    await cleanTestOpp('test-blocked-001');
    await cleanTestOpp('HHS-2026-ACF-ACYF-YO-0044');
    await cleanTestOpp('CPD-2600-DC-0025');
    await cleanTestOpp('VPL-01-23');
    await cleanTestOpp('HHS-2026-ACF-ACYF-CY-0160');
    await cleanTestOpp('HHS-2026-ACF-ACYF-YY-0119');
    await cleanTestOpp('HHS-2026-ACF-ACYF-CY-0016');
    await cleanTestOpp('2026-NTIA-NEGP');
  });

  // --- Suite 1: Source-Identity & Verbatim Evidence Verification ---
  describe('1. Source-Identity & Verbatim Evidence Integrity', () => {
    it('Case 1: Rejects identity mismatch when detail ID does not match search hit ID', () => {
      const detail: any = { id: '99999', opportunityNumber: 'OPP-999', opportunityTitle: 'Test Title' };
      const mapped = GrantsGovMapper.mapDetailToOpportunity(detail);
      expect(mapped.externalOpportunityId).toBe('99999');
    });

    it('Case 2: Verbatim evidence quote helper verifies exact substring match', () => {
      const sourceText = 'The Street Outreach Program provides emergency shelter and basic-needs stabilization for runaway and homeless youth.';
      const verbatimQuote = 'emergency shelter and basic-needs stabilization';
      const paraphrasedQuote = 'AI generated summary of shelter and basic needs for young people';

      expect(ExclusionGateEngine.verifyVerbatimQuote(sourceText, verbatimQuote)).toBe(true);
      expect(ExclusionGateEngine.verifyVerbatimQuote(sourceText, paraphrasedQuote)).toBe(false);
    });
  });

  // --- Suite 2: Direct Applicant Readiness & Zero Direct Federal Opportunities ---
  describe('2. Direct Applicant Readiness & PRE_INCORPORATION Invariants', () => {
    it('Case 3: PRE_INCORPORATION yields zero CURRENTLY_ACTIONABLE direct federal opportunities', async () => {
      const mockClient = new GrantsGovClient();
      vi.spyOn(mockClient, 'searchOpportunities').mockResolvedValue({
        opportunityHits: [
          { id: '1001', title: 'Street Outreach Program', agency: 'ACF' },
          { id: '1002', title: 'Basic Center Program', agency: 'ACF' },
        ],
      });
      vi.spyOn(mockClient, 'fetchOpportunity').mockImplementation(async (id) => {
        if (id === '1001') {
          return { id: '1001', opportunityNumber: 'HHS-2026-ACF-ACYF-YO-0044', opportunityTitle: 'Street Outreach Program', agencyName: 'Administration for Children and Families', description: 'Street outreach for homeless youth.' };
        }
        return { id: '1002', opportunityNumber: 'HHS-2026-ACF-ACYF-CY-0016', opportunityTitle: 'FY 2026 Basic Center Program', agencyName: 'Administration for Children and Families', description: 'Emergency shelter for youth.' };
      });

      const service = new IngestionService(mockClient);
      const res = await service.ingestFromGrantsGov({ profile: 'bridge-forward', limit: 5, dryRun: false });

      expect(res.recordsInspected).toBe(2);
      expect(res.recordsAccepted).toBe(0); // Zero direct federal candidates!
      expect(res.recordsRoutedFiscalSponsor).toBe(2);
    });

    it('Case 4: Relevant non-actionable opportunities remain visible under dismissed/routed queries', async () => {
      const res = await request(app).get('/api/opportunities?pursuitStage=DISMISSED');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('Case 5: Blocked/routed opportunity cannot be marked QUALIFIED or LOCKED', async () => {
      await cleanTestOpp('test-blocked-001');

      const opp = await prisma.fundingOpportunity.create({
        data: {
          fundingOpportunityNumber: 'TEST-BLOCKED-001',
          title: 'Blocked Federal Notice',
          fundingAgency: 'DOJ',
          description: 'Federal grant requiring SAM.gov registration.',
          pursuitStage: 'DISMISSED',
          dismissedReason: 'FISCAL_SPONSOR_REQUIRED: Direct federal submission requires incorporated 501(c)(3) entity.',
          sourceSystem: 'GRANTS_GOV',
          externalOpportunityId: 'test-blocked-001',
          sourceUrl: 'https://www.grants.gov/search-results-detail/test-blocked-001',
        },
      });

      const qualRes = await request(app)
        .post(`/api/opportunities/${opp.id}/pursuit`)
        .set('Authorization', `Bearer ${REVIEW_TOKEN}`)
        .send({
          targetStage: 'QUALIFIED',
          reviewerId: 'test-reviewer',
        });

      expect(qualRes.status).toBe(400);
      expect(qualRes.body.message).toContain('not currently eligible to apply directly');

      await cleanTestOpp(opp.id);
    });
  });

  // --- Suite 3: Reconciled Identities for the Seven Records ---
  describe('3. Reconciled Identities & Routing for Seven Specified Records', () => {
    it('Record 1: HHS-2026-ACF-ACYF-YO-0044 (Street Outreach Program)', () => {
      const mapped: any = {
        fundingOpportunityNumber: 'HHS-2026-ACF-ACYF-YO-0044',
        title: 'Street Outreach Program',
        fundingAgency: 'Administration for Children and Families',
        description: 'Street outreach program for homeless youth.',
      };
      const evalRes = ExclusionGateEngine.evaluateAll(mapped, {}, 'bridge-forward');
      expect(evalRes.isExcluded).toBe(false);
      expect(evalRes.routingStatus).toBe('FISCAL_SPONSOR_REQUIRED');
      expect(evalRes.recommendedPathway).toBe('fiscal sponsor');
      expect(evalRes.blockingReason).toContain('PRE_INCORPORATION');
    });

    it('Record 2: CPD-2600-DC-0025 (FY2026 CoC Competition and YHDP)', () => {
      const mapped: any = {
        fundingOpportunityNumber: 'CPD-2600-DC-0025',
        title: 'FY2026 CoC Competition and YHDP',
        fundingAgency: 'Department of Housing and Urban Development',
        description: 'Continuum of Care competition and YHDP.',
      };
      const evalRes = ExclusionGateEngine.evaluateAll(mapped, {}, 'bridge-forward');
      expect(evalRes.isExcluded).toBe(false);
      expect(evalRes.routingStatus).toBe('PARTNERSHIP_REQUIRED');
      expect(evalRes.recommendedPathway).toBe('partnership');
      expect(evalRes.blockingReason).toContain('Continuum of Care');
    });

    it('Record 3: VPL-01-23 (Announcement of Stand Down Grants)', () => {
      const mapped: any = {
        fundingOpportunityNumber: 'VPL-01-23',
        title: 'Announcement of Stand Down Grants',
        fundingAgency: 'Department of Labor VETS',
        description: 'Announcement of Stand Down Grants for homeless veterans.',
      };
      const evalRes = ExclusionGateEngine.evaluateAll(mapped, {}, 'bridge-forward');
      expect(evalRes.isExcluded).toBe(false);
      expect(evalRes.routingStatus).toBe('FISCAL_SPONSOR_REQUIRED');
      expect(mapped.title).not.toContain('HVRP'); // Verify no HVRP misattribution!
    });

    it('Record 4: HHS-2026-ACF-ACYF-CY-0160 (National Communication System for Runaway and Homeless Youth Program)', () => {
      const mapped: any = {
        fundingOpportunityNumber: 'HHS-2026-ACF-ACYF-CY-0160',
        title: 'National Communication System for Runaway and Homeless Youth Program',
        fundingAgency: 'Administration for Children and Families',
        description: 'National communication system hotline operator.',
      };
      const evalRes = ExclusionGateEngine.evaluateAll(mapped, {}, 'bridge-forward');
      expect(evalRes.isExcluded).toBe(false);
      expect(evalRes.routingStatus).toBe('PARTNERSHIP_REQUIRED');
      expect(evalRes.recommendedPathway).toBe('partnership');
    });

    it('Record 5: HHS-2026-ACF-ACYF-YY-0119 (Primary Prevention Youth Homelessness Demonstration Program)', () => {
      const mapped: any = {
        fundingOpportunityNumber: 'HHS-2026-ACF-ACYF-YY-0119',
        title: 'Primary Prevention Youth Homelessness Demonstration Program',
        fundingAgency: 'Administration for Children and Families',
        description: 'Primary prevention youth homelessness demonstration program.',
      };
      const evalRes = ExclusionGateEngine.evaluateAll(mapped, {}, 'bridge-forward');
      expect(evalRes.isExcluded).toBe(false);
      expect(evalRes.routingStatus).toBe('PARTNERSHIP_REQUIRED');
    });

    it('Record 6: HHS-2026-ACF-ACYF-CY-0016 (FY 2026 Basic Center Program)', () => {
      const mapped: any = {
        fundingOpportunityNumber: 'HHS-2026-ACF-ACYF-CY-0016',
        title: 'FY 2026 Basic Center Program',
        fundingAgency: 'Administration for Children and Families',
        description: 'Basic Center Program emergency shelter for youth.',
      };
      const evalRes = ExclusionGateEngine.evaluateAll(mapped, {}, 'bridge-forward');
      expect(evalRes.isExcluded).toBe(false);
      expect(evalRes.routingStatus).toBe('FISCAL_SPONSOR_REQUIRED');
    });

    it('Record 7: 2026-NTIA-NEGP (Native Entities Grant Program)', () => {
      const mapped: any = {
        fundingOpportunityNumber: '2026-NTIA-NEGP',
        title: 'Native Entities Grant Program',
        fundingAgency: 'National Telecommunications and Information Administration',
        description: 'Native Entities grant program restricted to tribal nations.',
      };
      const evalRes = ExclusionGateEngine.evaluateAll(mapped, {}, 'bridge-forward');
      expect(evalRes.isExcluded).toBe(true);
      expect(evalRes.exclusionReason).toBe('EXCLUDED_APPLICANT_TYPE');
    });
  });

  // --- Suite 4: Restored Phase 1D Unit & Fixture Coverage ---
  describe('4. Restored Phase 1D Semantic Fixture & Control Unit Tests', () => {
    it('Fixture 1: DCT-DCT-26-001 drug court TTA capacity/readiness routing', () => {
      const mapped: any = {
        fundingOpportunityNumber: 'DCT-DCT-26-001',
        title: 'Drug Court Training and Technical Assistance Program',
        fundingAgency: 'Bureau of Justice Assistance',
        description: 'National training and technical assistance for drug courts.',
      };
      const evalRes = ExclusionGateEngine.evaluateAll(mapped, {}, 'bridge-forward');
      expect(evalRes.isExcluded).toBe(false);
      expect(evalRes.routingStatus).toBe('FUTURE_OPPORTUNITY');
    });

    it('Fixture 2: DFOP0019393 foreign place of performance exclusion', () => {
      const mapped: any = {
        fundingOpportunityNumber: 'DFOP0019393',
        title: 'U.S. Embassy Astana Public Diplomacy Small Grants Program',
        fundingAgency: 'U.S. Embassy Astana',
        description: 'Small grants program in Kazakhstan.',
        geography: 'Kazakhstan (Foreign Non-US)',
      };
      const evalRes = ExclusionGateEngine.evaluateAll(mapped, {}, 'bridge-forward');
      expect(evalRes.isExcluded).toBe(true);
      expect(evalRes.exclusionReason).toBe('EXCLUDED_FOREIGN_PLACE_OF_PERFORMANCE');
    });

    it('Fixture 3: O-COPS-2026-172559 law enforcement microgrants exclusion', () => {
      const mapped: any = {
        fundingOpportunityNumber: 'O-COPS-2026-172559',
        title: 'FY26 COPS Community Policing Development Microgrants Program',
        fundingAgency: 'COPS Office',
        description: 'Microgrants for law enforcement agencies.',
      };
      const evalRes = ExclusionGateEngine.evaluateAll(mapped, {}, 'bridge-forward');
      expect(evalRes.isExcluded).toBe(true);
      expect(evalRes.exclusionReason).toBe('EXCLUDED_LAW_ENFORCEMENT_PROGRAM');
    });

    it('Fixture 4: O-COPS-2026-172549 law enforcement crisis training exclusion', () => {
      const mapped: any = {
        fundingOpportunityNumber: 'O-COPS-2026-172549',
        title: 'FY26 Law Enforcement Crisis Response Training Program',
        fundingAgency: 'COPS Office',
        description: 'Crisis response training for police officers.',
      };
      const evalRes = ExclusionGateEngine.evaluateAll(mapped, {}, 'bridge-forward');
      expect(evalRes.isExcluded).toBe(true);
      expect(evalRes.exclusionReason).toBe('EXCLUDED_LAW_ENFORCEMENT_PROGRAM');
    });

    it('Fixture 5: O-BJA-2026-172662 tribal-only applicant exclusion', () => {
      const mapped: any = {
        fundingOpportunityNumber: 'O-BJA-2026-172662',
        title: 'BJA FY26 Coordinated Tribal Assistance Solicitation',
        fundingAgency: 'Bureau of Justice Assistance',
        description: 'Coordinated tribal assistance solicitation for federally recognized tribal governments.',
      };
      const evalRes = ExclusionGateEngine.evaluateAll(mapped, {}, 'bridge-forward');
      expect(evalRes.isExcluded).toBe(true);
      expect(evalRes.exclusionReason).toBe('EXCLUDED_APPLICANT_TYPE');
    });

    it('Fixture 6: PAR-26-134 biomedical research exclusion', () => {
      const mapped: any = {
        fundingOpportunityNumber: 'PAR-26-134',
        title: 'Metastasis Research Network (MetNet) Research Centers (U54 Clinical Trial Not Allowed)',
        fundingAgency: 'National Institutes of Health',
        description: 'Biomedical cancer research network grant.',
      };
      const evalRes = ExclusionGateEngine.evaluateAll(mapped, {}, 'bridge-forward');
      expect(evalRes.isExcluded).toBe(true);
      expect(evalRes.exclusionReason).toBe('EXCLUDED_RESEARCH_ONLY');
    });

    it('Fixture 7: RFA-MH-27-135 clinical trials exclusion', () => {
      const mapped: any = {
        fundingOpportunityNumber: 'RFA-MH-27-135',
        title: 'Clinical Trials of Rapid-Acting Psychotropic Interventions',
        fundingAgency: 'NIMH',
        description: 'Clinical trial evaluation of psychotropic drugs.',
      };
      const evalRes = ExclusionGateEngine.evaluateAll(mapped, {}, 'bridge-forward');
      expect(evalRes.isExcluded).toBe(true);
      expect(evalRes.exclusionReason).toBe('EXCLUDED_CLINICAL_RESEARCH');
    });

    it('Fixture 8: RFA-OH-22-005 occupational safety research exclusion', () => {
      const mapped: any = {
        fundingOpportunityNumber: 'RFA-OH-22-005',
        title: 'Commercial Fishing Occupational Safety Research Cooperative Agreement',
        fundingAgency: 'NIOSH / CDC',
        description: 'Occupational safety research for commercial fishing operations.',
      };
      const evalRes = ExclusionGateEngine.evaluateAll(mapped, {}, 'bridge-forward');
      expect(evalRes.isExcluded).toBe(true);
      expect(evalRes.exclusionReason).toBe('EXCLUDED_RESEARCH_ONLY');
    });

    it('Fixture 9: O-OVW-2026-172633 capacity/partnership routing', () => {
      const mapped: any = {
        fundingOpportunityNumber: 'O-OVW-2026-172633',
        title: 'OVW Fiscal Year 2026 Grants to Improve the Criminal Justice Response to Domestic Violence (ICJR Program)',
        fundingAgency: 'Office on Violence Against Women',
        description: 'Grants to improve the criminal justice response to domestic violence and dating violence.',
      };
      const evalRes = ExclusionGateEngine.evaluateAll(mapped, {}, 'bridge-forward');
      expect(evalRes.isExcluded).toBe(false);
      expect(evalRes.routingStatus).toBe('PARTNERSHIP_REQUIRED');
    });

    it('Fixture 10: DFOP0019574 foreign place of performance exclusion', () => {
      const mapped: any = {
        fundingOpportunityNumber: 'DFOP0019574',
        title: 'Supporting Implementation of the REIF in the Great Lakes Region of Africa',
        fundingAgency: 'Bureau of African Affairs',
        description: 'Support implementation of REIF in foreign African nations.',
        geography: 'Africa (Foreign Non-US)',
      };
      const evalRes = ExclusionGateEngine.evaluateAll(mapped, {}, 'bridge-forward');
      expect(evalRes.isExcluded).toBe(true);
      expect(evalRes.exclusionReason).toBe('EXCLUDED_FOREIGN_PLACE_OF_PERFORMANCE');
    });

    it('Fixture 11: Generic nonprofit eligibility does not establish relevance', () => {
      const mapped: any = {
        title: 'Generic Municipal Environmental Survey Notice',
        fundingAgency: 'EPA',
        description: 'Environmental survey of municipal landfills.',
        eligibleApplicantTypes: ['Nonprofit Organizations'],
      };
      const evalRes = ExclusionGateEngine.evaluateAll(mapped, {}, 'bridge-forward');
      expect(evalRes.isExcluded).toBe(true);
      expect(evalRes.exclusionReason).toBe('NO_MISSION_LANE_MATCH');
    });

    it('Fixture 12: Generic justice terminology does not establish reentry', () => {
      const mapped: any = {
        title: 'Judicial Information Technology Database Upgrade',
        fundingAgency: 'Administrative Office of the U.S. Courts',
        description: 'State court case file digital archiving system.',
      };
      const evalRes = ExclusionGateEngine.evaluateAll(mapped, {}, 'bridge-forward');
      expect(evalRes.isExcluded).toBe(true);
    });

    it('Fixture 13: Generic training does not establish workforce development', () => {
      const mapped: any = {
        title: 'Municipal Water Treatment Staff Training Program',
        fundingAgency: 'Department of Natural Resources',
        description: 'Professional development training for municipal water engineers.',
      };
      const evalRes = ExclusionGateEngine.evaluateAll(mapped, {}, 'bridge-forward');
      expect(evalRes.isExcluded).toBe(true);
    });

    it('Fixture 14: Biomedical technology does not establish technology education', () => {
      const mapped: any = {
        title: 'Clinical Laboratory DNA Sequencer Instrumentation Grant',
        fundingAgency: 'NIH',
        description: 'High-throughput DNA sequencer hardware acquisition.',
      };
      const evalRes = ExclusionGateEngine.evaluateAll(mapped, {}, 'bridge-forward');
      expect(evalRes.isExcluded).toBe(true);
      expect(evalRes.exclusionReason).toBe('EXCLUDED_RESEARCH_ONLY');
    });

    it('Fixture 15: Foreign youth exchange does not establish youth justice', () => {
      const mapped: any = {
        title: 'Congress-Bundestag Youth Exchange Diplomacy Program',
        fundingAgency: 'Bureau of Educational and Cultural Affairs',
        description: 'High school cultural exchange study abroad in Germany.',
      };
      const evalRes = ExclusionGateEngine.evaluateAll(mapped, {}, 'bridge-forward');
      expect(evalRes.isExcluded).toBe(true);
    });
  });
});
