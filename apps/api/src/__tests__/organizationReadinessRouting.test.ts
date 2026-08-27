import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { ExclusionGateEngine } from '../services/exclusionGateEngine';
import { OrganizationProfileService, OrganizationReadinessSnapshot } from '../services/organizationProfileService';
import { prisma } from '../lib/prisma';
import { MappedOpportunity } from '../integrations/grantsGov/grantsGovMapper';

describe('Organization Readiness & Authoritative Routing Suite', () => {
  let initialOrgState: {
    status: string;
    taxStatus: string;
    limitations: string[];
  } | null = null;

  let initialEnvVars: {
    AI_FUNDING_ANALYST_ENABLED?: string;
    AI_DOCUMENT_GROUNDING_ENABLED?: string;
    DOCUMENT_INGESTION_ENABLED?: string;
  } = {};

  let baselineAuditIds = new Set<string>();

  beforeAll(async () => {
    initialEnvVars = {
      AI_FUNDING_ANALYST_ENABLED: process.env.AI_FUNDING_ANALYST_ENABLED,
      AI_DOCUMENT_GROUNDING_ENABLED: process.env.AI_DOCUMENT_GROUNDING_ENABLED,
      DOCUMENT_INGESTION_ENABLED: process.env.DOCUMENT_INGESTION_ENABLED,
    };

    const org = await prisma.organizationProfile.findFirst({
      where: { name: 'Project Thriveward' },
    });

    if (org) {
      initialOrgState = {
        status: org.status,
        taxStatus: org.taxStatus,
        limitations: [...org.limitations],
      };
    }

    const baselineAudits = await prisma.securityAuditEvent.findMany({
      where: { eventType: 'ORGANIZATION_FORMATION_RECONCILED' },
      select: { id: true },
    });
    baselineAuditIds = new Set(baselineAudits.map((e) => e.id));
  });

  afterAll(async () => {
    const currentAudits = await prisma.securityAuditEvent.findMany({
      where: { eventType: 'ORGANIZATION_FORMATION_RECONCILED' },
      select: { id: true },
    });

    const suiteCreatedIds = currentAudits
      .map((e) => e.id)
      .filter((id) => !baselineAuditIds.has(id));

    if (suiteCreatedIds.length > 0) {
      await prisma.securityAuditEvent.deleteMany({
        where: { id: { in: suiteCreatedIds } },
      });
    }

    if (initialOrgState) {
      await prisma.organizationProfile.updateMany({
        where: { name: 'Project Thriveward' },
        data: {
          status: initialOrgState.status,
          taxStatus: initialOrgState.taxStatus,
          limitations: initialOrgState.limitations,
        },
      });
    }

    if (initialEnvVars.AI_FUNDING_ANALYST_ENABLED !== undefined) {
      process.env.AI_FUNDING_ANALYST_ENABLED = initialEnvVars.AI_FUNDING_ANALYST_ENABLED;
    } else {
      delete process.env.AI_FUNDING_ANALYST_ENABLED;
    }
    if (initialEnvVars.AI_DOCUMENT_GROUNDING_ENABLED !== undefined) {
      process.env.AI_DOCUMENT_GROUNDING_ENABLED = initialEnvVars.AI_DOCUMENT_GROUNDING_ENABLED;
    } else {
      delete process.env.AI_DOCUMENT_GROUNDING_ENABLED;
    }
    if (initialEnvVars.DOCUMENT_INGESTION_ENABLED !== undefined) {
      process.env.DOCUMENT_INGESTION_ENABLED = initialEnvVars.DOCUMENT_INGESTION_ENABLED;
    } else {
      delete process.env.DOCUMENT_INGESTION_ENABLED;
    }
  });

  const preIncorpSnapshot: OrganizationReadinessSnapshot = {
    organizationName: 'Project Thriveward',
    formationStatus: 'PRE_INCORPORATION',
    taxStatus: 'NOT_OBTAINED',
    irs501c3Status: 'NOT_VERIFIED',
    samGovUeiStatus: 'NOT_REGISTERED',
    grantsGovStatus: 'NOT_REGISTERED',
  };

  const incorporatedSnapshot: OrganizationReadinessSnapshot = {
    organizationName: 'Project Thriveward',
    formationStatus: 'INCORPORATED',
    taxStatus: 'NOT_OBTAINED',
    irs501c3Status: 'NOT_VERIFIED',
    samGovUeiStatus: 'NOT_REGISTERED',
    grantsGovStatus: 'NOT_REGISTERED',
    californiaEntityNumber: 'B20260372748',
  };

  const sampleStreetOutreachOpp = {
    externalOpportunityId: 'test-opp-001',
    fundingOpportunityNumber: 'HHS-2026-ACF-ACYF-YO-0044',
    title: 'Street Outreach Program for Runaway and Homeless Youth',
    fundingAgency: 'HHS-ACF',
    description: 'Grant program providing street outreach and basic needs stabilization for runaway and homeless youth.',
    status: 'PENDING_HUMAN_REVIEW',
  } as unknown as MappedOpportunity;

  const sample501c3MappedOpp = {
    externalOpportunityId: 'test-opp-501c3',
    fundingOpportunityNumber: 'DOL-VETS-2026-001',
    title: 'Reentry Employment Program requiring 501(c)(3) incorporated non-profit status',
    fundingAgency: 'DOL',
    description: 'Reentry job training requiring 501(c)(3) incorporated non-profit status and SAM.gov registration.',
    status: 'PENDING_HUMAN_REVIEW',
  } as unknown as MappedOpportunity;

  beforeEach(async () => {
    process.env.AI_FUNDING_ANALYST_ENABLED = 'false';
    process.env.AI_DOCUMENT_GROUNDING_ENABLED = 'false';
    process.env.DOCUMENT_INGESTION_ENABLED = 'false';

    await prisma.organizationProfile.updateMany({
      where: { name: 'Project Thriveward' },
      data: {
        status: 'PRE_INCORPORATION',
        taxStatus: 'NOT_OBTAINED',
        limitations: [],
      },
    });
  });

  describe('A. Dynamic Snapshot Derivation vs Hardcoding', () => {
    it('getReadinessSnapshot derives facts dynamically from persisted evidence without hardcoded constants', async () => {
      const adminUser = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
      if (adminUser) {
        await OrganizationProfileService.reconcileFormationEvidence({
          userId: adminUser.id,
          entityNumber: 'B20260372748',
        });
      }

      const snapshot = await OrganizationProfileService.getReadinessSnapshot();
      expect(snapshot.formationStatus).toBe('INCORPORATED');
      expect(snapshot.californiaEntityNumber).toBe('B20260372748');
      expect(snapshot.samGovUeiStatus).toBe('NOT_REGISTERED');
      expect(snapshot.grantsGovStatus).toBe('NOT_REGISTERED');
    });

    it('returns null californiaEntityNumber when profile is not incorporated', async () => {
      const snapshot = await OrganizationProfileService.getReadinessSnapshot();
      expect(snapshot.formationStatus).toBe('PRE_INCORPORATION');
      expect(snapshot.californiaEntityNumber).toBeNull();
    });
  });

  describe('B. INCORPORATED + SAM NOT_REGISTERED Routing & Blocker Wording', () => {
    it('produces FUTURE_OPPORTUNITY (not FISCAL_SPONSOR_REQUIRED) for generic incorporated reentry opportunity with missing registrations', () => {
      const result = ExclusionGateEngine.evaluateAll(sample501c3MappedOpp, {}, 'project-thriveward', incorporatedSnapshot);

      expect(result.routingStatus).toBe('FUTURE_OPPORTUNITY');
      expect(result.applicantReadiness).toBe('NEEDS_REGISTRATIONS');
      expect(result.recommendedPathway).toBe('registration');
      expect(result.explanation).toContain('California incorporation is verified (B20260372748)');
      expect(result.explanation).toContain('SAM.gov/UEI registration is NOT_REGISTERED');
    });

    it('preserves FISCAL_SPONSOR_REQUIRED for explicit Street Outreach Program rule', () => {
      const result = ExclusionGateEngine.evaluateAll(sampleStreetOutreachOpp, {}, 'project-thriveward', incorporatedSnapshot);

      expect(result.routingStatus).toBe('FISCAL_SPONSOR_REQUIRED');
      expect(result.applicantReadiness).toBe('NEEDS_REGISTRATIONS');
      expect(result.explanation).toContain('California incorporation is verified (B20260372748)');
    });
  });

  describe('C. Dynamic SAM REGISTERED Snapshot Handling', () => {
    it('does NOT produce text saying SAM is NOT_REGISTERED when snapshot says REGISTERED', () => {
      const samRegisteredSnapshot: OrganizationReadinessSnapshot = {
        ...incorporatedSnapshot,
        samGovUeiStatus: 'REGISTERED',
      };

      const result = ExclusionGateEngine.evaluateAll(sample501c3MappedOpp, {}, 'project-thriveward', samRegisteredSnapshot);

      expect(result.explanation).not.toContain('SAM.gov/UEI registration is NOT_REGISTERED');
      expect(result.explanation).toContain('SAM.gov/UEI registration is REGISTERED');
    });
  });

  describe('D. Dynamic Grants.gov REGISTERED Snapshot Handling', () => {
    it('does NOT produce text saying Grants.gov is NOT_REGISTERED when snapshot says REGISTERED', () => {
      const grantsRegisteredSnapshot: OrganizationReadinessSnapshot = {
        ...incorporatedSnapshot,
        grantsGovStatus: 'REGISTERED',
      };

      const result = ExclusionGateEngine.evaluateAll(sample501c3MappedOpp, {}, 'project-thriveward', grantsRegisteredSnapshot);

      expect(result.explanation).not.toContain('Grants.gov organization registration is NOT_REGISTERED');
      expect(result.explanation).toContain('Grants.gov organization registration is REGISTERED');
    });
  });

  describe('E. UNKNOWN Readiness Facts Handling', () => {
    it('fails closed and describes UNKNOWN readiness facts honestly without inventing fiscal sponsorship', () => {
      const unknownSnapshot: OrganizationReadinessSnapshot = {
        organizationName: 'Project Thriveward',
        formationStatus: 'INCORPORATED',
        taxStatus: 'UNKNOWN',
        irs501c3Status: 'UNKNOWN',
        samGovUeiStatus: 'UNKNOWN',
        grantsGovStatus: 'UNKNOWN',
        californiaEntityNumber: null,
      };

      const result = ExclusionGateEngine.evaluateAll(sample501c3MappedOpp, {}, 'project-thriveward', unknownSnapshot);

      expect(result.routingStatus).toBe('FUTURE_OPPORTUNITY');
      expect(result.applicantReadiness).toBe('NEEDS_REGISTRATIONS');
      expect(result.explanation).toContain('SAM.gov/UEI registration is UNKNOWN');
      expect(result.explanation).toContain('501(c)(3) status is UNKNOWN');
    });
  });

  describe('F. PRE_INCORPORATION Semantics Integrity', () => {
    it('produces PRE_INCORPORATION readiness and blocking explanation when snapshot is PRE_INCORPORATION', () => {
      const result = ExclusionGateEngine.evaluateAll(sample501c3MappedOpp, {}, 'project-thriveward', preIncorpSnapshot);

      expect(result.applicantReadiness).toBe('NOT_READY_PRE_INCORPORATION');
      expect(result.explanation).toContain('PRE_INCORPORATION');
      expect(result.explanation).not.toContain('California incorporation is verified');
    });
  });

  describe('G. No Hardcoded BJA / Opportunity Specific Hacks', () => {
    it('generically routes unmanaged BJA opportunity as FUTURE_OPPORTUNITY for INCORPORATED entity', () => {
      const genericBjaOpp = {
        externalOpportunityId: 'generic-opp-999',
        fundingOpportunityNumber: 'O-BJA-2026-172698',
        title: 'BJA FY 2026 Second Chance Act Improving Reentry Education and Employment Outcomes',
        fundingAgency: 'Bureau of Justice Assistance',
        description: 'Reentry education and workforce development career pathways.',
        status: 'PENDING_HUMAN_REVIEW',
      } as unknown as MappedOpportunity;

      const result = ExclusionGateEngine.evaluateAll(genericBjaOpp, {}, 'project-thriveward', incorporatedSnapshot);

      expect(result.routingStatus).toBe('FUTURE_OPPORTUNITY');
      expect(result.applicantReadiness).toBe('NEEDS_REGISTRATIONS');
      expect(result.explanation).toContain('California incorporation is verified');
      expect(result.explanation).not.toContain('FISCAL_SPONSOR_REQUIRED');
    });
  });

  describe('H. Provider Isolation Safeguard', () => {
    it('executes routing logic with zero AI or paid provider calls', () => {
      expect(process.env.AI_FUNDING_ANALYST_ENABLED).toBe('false');
      expect(process.env.AI_DOCUMENT_GROUNDING_ENABLED).toBe('false');
    });
  });

  describe('I. UNKNOWN Fallback Evidence Semantics & Ingestion Human Review Governance', () => {
    it('1. Profile with no SAM evidence produces samGovUeiStatus === UNKNOWN', async () => {
      await prisma.organizationProfile.updateMany({
        where: { name: 'Project Thriveward' },
        data: { limitations: [] },
      });

      const snapshot = await OrganizationProfileService.getReadinessSnapshot();
      expect(snapshot.samGovUeiStatus).toBe('UNKNOWN');
    });

    it('2. Profile with no Grants.gov evidence produces grantsGovStatus === UNKNOWN', async () => {
      await prisma.organizationProfile.updateMany({
        where: { name: 'Project Thriveward' },
        data: { limitations: [] },
      });

      const snapshot = await OrganizationProfileService.getReadinessSnapshot();
      expect(snapshot.grantsGovStatus).toBe('UNKNOWN');
    });

    it('3. Profile with no 501(c)(3) evidence produces irs501c3Status === UNKNOWN', async () => {
      await prisma.organizationProfile.updateMany({
        where: { name: 'Project Thriveward' },
        data: { limitations: [], taxStatus: 'UNKNOWN' },
      });

      const snapshot = await OrganizationProfileService.getReadinessSnapshot();
      expect(snapshot.irs501c3Status).toBe('UNKNOWN');
    });

    it('4. Explicit persisted NOT_REGISTERED remains NOT_REGISTERED', async () => {
      await prisma.organizationProfile.updateMany({
        where: { name: 'Project Thriveward' },
        data: { limitations: ['SAM.gov/UEI registration NOT_REGISTERED.'] },
      });

      const snapshot = await OrganizationProfileService.getReadinessSnapshot();
      expect(snapshot.samGovUeiStatus).toBe('NOT_REGISTERED');
    });

    it('5. Explicit persisted REGISTERED remains REGISTERED', async () => {
      await prisma.organizationProfile.updateMany({
        where: { name: 'Project Thriveward' },
        data: { limitations: ['SAM.gov/UEI registration REGISTERED.'] },
      });

      const snapshot = await OrganizationProfileService.getReadinessSnapshot();
      expect(snapshot.samGovUeiStatus).toBe('REGISTERED');
    });

    it('6. Explicit persisted 501(c)(3) not obtained remains NOT_OBTAINED', async () => {
      await prisma.organizationProfile.updateMany({
        where: { name: 'Project Thriveward' },
        data: { limitations: ['501(c)(3) status has not yet been obtained.'] },
      });

      const snapshot = await OrganizationProfileService.getReadinessSnapshot();
      expect(snapshot.irs501c3Status).toBe('NOT_OBTAINED');
    });

    it('7. UNKNOWN routing fails closed but does not invent fiscal sponsorship', () => {
      const unknownSnapshot: OrganizationReadinessSnapshot = {
        organizationName: 'Project Thriveward',
        formationStatus: 'INCORPORATED',
        taxStatus: 'UNKNOWN',
        irs501c3Status: 'UNKNOWN',
        samGovUeiStatus: 'UNKNOWN',
        grantsGovStatus: 'UNKNOWN',
        californiaEntityNumber: null,
      };

      const result = ExclusionGateEngine.evaluateAll(sample501c3MappedOpp, {}, 'project-thriveward', unknownSnapshot);
      expect(result.routingStatus).toBe('FUTURE_OPPORTUNITY');
      expect(result.applicantReadiness).toBe('NEEDS_REGISTRATIONS');
    });
  });
});
