import { prisma } from '../lib/prisma';
import { BRIDGE_FORWARD_PROFILE } from '../config/bridgeForwardProfile';
import { AnalysisService } from './analysisService';

export interface ServiceError extends Error {
  statusCode?: number;
}

function createServiceError(message: string, statusCode: number): ServiceError {
  const err: ServiceError = new Error(message);
  err.statusCode = statusCode;
  return err;
}

export class OrganizationProfileService {
  /**
   * Reconciles verified California incorporation formation evidence.
   * Controlled, authenticated ADMIN-only workflow.
   * Idempotent: repeated calls with identical evidence update existing attributes without duplicate audit records.
   */
  public static async reconcileFormationEvidence(params: {
    userId: string;
    entityNumber: string;
    actorType?: string;
    ipAddress?: string;
    userAgent?: string;
  }) {
    const { userId, entityNumber } = params;

    // Validate explicit entity number confirmation
    if (!entityNumber || entityNumber.trim().toUpperCase() !== 'B20260372748') {
      throw createServiceError('Invalid entity number confirmation. Must explicitly confirm B20260372748.', 400);
    }

    // 1. Fetch authoritative OrganizationProfile
    let org = await prisma.organizationProfile.findFirst({
      where: { name: 'Project Thriveward' },
    });

    if (!org) {
      org = await prisma.organizationProfile.findFirst({
        orderBy: { createdAt: 'asc' },
      });
    }

    if (!org) {
      throw createServiceError('Authoritative Project Thriveward organization profile not found.', 404);
    }

    const verifiedFacts = {
      legalOrganizationName: 'Project Thriveward',
      entityType: 'California Nonprofit Public Benefit Corporation',
      formationJurisdiction: 'California',
      californiaEntityNumber: 'B20260372748',
      initialArticlesFilingDate: 'August 15, 2026',
      initialFilingStatus: 'Accepted',
      filingApprovalAcknowledgmentDate: 'August 17, 2026',
      formationStatus: 'INCORPORATED',
    };

    const unverifiedStatuses = {
      irsEin: 'NOT_OBTAINED',
      irs501c3: 'NOT_VERIFIED',
      californiaFtbExemption: 'NOT_VERIFIED',
      initialSi100: 'NOT_FILED',
      californiaAttorneyGeneralRegistration: 'NOT_REGISTERED',
      samGovUeiRegistration: 'NOT_REGISTERED',
      grantsGovRegistration: 'NOT_REGISTERED',
      fiscalSponsor: 'NOT_VERIFIED',
      taxStatus: 'NOT_OBTAINED',
    };

    const isAlreadyReconciled = org.status === 'INCORPORATED';

    // Update OrganizationProfile
    const updatedProfile = await prisma.organizationProfile.update({
      where: { id: org.id },
      data: {
        status: 'INCORPORATED',
        taxStatus: 'NOT_OBTAINED', // Tax status remains NOT_OBTAINED!
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
      },
    });

    // Update in-memory profile representation
    BRIDGE_FORWARD_PROFILE.organizationStage = 'INCORPORATED';

    // 2. Log audit event idempotently
    if (!isAlreadyReconciled) {
      await prisma.securityAuditEvent.create({
        data: {
          userId,
          eventType: 'ORGANIZATION_FORMATION_RECONCILED',
          ipAddress: params.ipAddress || null,
          userAgent: params.userAgent || null,
          details: JSON.stringify({
            organizationProfileId: org.id,
            verifiedFacts,
            unverifiedStatuses,
            reconciledAt: new Date().toISOString(),
          }),
        },
      });
    }

    return {
      organizationProfile: updatedProfile,
      verifiedFacts,
      unverifiedStatuses,
      alreadyReconciled: isAlreadyReconciled,
    };
  }

  /**
   * Retrieves readiness and formation status for Project Thriveward.
   */
  public static async getReadinessStatus() {
    let org = await prisma.organizationProfile.findFirst({
      where: { name: 'Project Thriveward' },
    });

    if (!org) {
      org = await prisma.organizationProfile.findFirst({
        orderBy: { createdAt: 'asc' },
      });
    }

    const isIncorporated = org?.status === 'INCORPORATED';

    return {
      organizationName: 'Project Thriveward',
      status: org?.status || 'PRE_INCORPORATION',
      californiaIncorporation: isIncorporated ? 'VERIFIED' : 'NOT_VERIFIED',
      entityType: isIncorporated ? 'Nonprofit Public Benefit Corporation' : 'PRE_INCORPORATION',
      californiaEntityNumber: isIncorporated ? 'B20260372748' : 'NOT_VERIFIED',
      filingDate: isIncorporated ? 'August 15, 2026' : 'NOT_VERIFIED',
      approvalDate: isIncorporated ? 'August 17, 2026' : 'NOT_VERIFIED',
      irs501c3Status: 'NOT_VERIFIED',
      californiaTaxExemption: 'NOT_VERIFIED',
      einStatus: 'NOT_OBTAINED',
      si100Status: 'NOT_FILED',
      californiaCharitableRegistration: 'NOT_REGISTERED',
      samGovUeiStatus: 'NOT_REGISTERED',
      grantsGovStatus: 'NOT_REGISTERED',
      fiscalSponsorStatus: 'NOT_VERIFIED',
      taxStatus: 'NOT_OBTAINED',
      noticeText:
        'California incorporation has been verified. Incorporation does not establish federal 501(c)(3) status, California tax exemption, SAM.gov registration, or direct eligibility for every funding opportunity.',
    };
  }

  /**
   * Evaluates a read-only match impact preview for all 14 opportunities.
   * Mutation-free: does not alter database records or overwrite previous analyses.
   */
  public static async getMatchImpactPreview() {
    const opportunities = await prisma.fundingOpportunity.findMany({
      orderBy: { createdAt: 'asc' },
    });

    const previewResults: Array<{
      opportunityId: string;
      title: string;
      fundingOpportunityNumber: string;
      isDemo: boolean;
      previousFormationStatus: string;
      updatedFormationStatus: string;
      previousEligibilityClassification: string;
      previewEligibilityClassification: string;
      previousScore: number;
      previewScore: number;
      changedBlockingReasons: string[];
      remainingBlockingReasons: string[];
      recommendedPathway: string;
    }> = [];

    for (const opp of opportunities) {
      const oppNum = (opp.fundingOpportunityNumber || '').toUpperCase();
      const titleLower = (opp.title || '').toLowerCase();

      const isStreetOutreach =
        oppNum.includes('HHS-2026-ACF-ACYF-YO-0044') || titleLower.includes('street outreach');
      const isCoCCompetition =
        oppNum.includes('CPD-2600-DC-0025') ||
        titleLower.includes('coc competition') ||
        titleLower.includes('continuum of care');
      const isDemo = opp.isDemo || opp.id === 'demo-opp-001';

      let previousClassification = 'INVESTIGATE';
      let previewClassification = 'INVESTIGATE';
      let previousScore = 35;
      let previewScore = 35;
      let changedBlockers: string[] = [];
      let remainingBlockers: string[] = [];
      let recommendedPathway = 'INVESTIGATE';

      if (isStreetOutreach) {
        previousClassification = 'FISCAL_SPONSOR_REQUIRED';
        previewClassification = 'FISCAL_SPONSOR_REQUIRED';
        previousScore = 35;
        previewScore = 40;
        changedBlockers = [
          'Legal entity status blocker resolved by California incorporation B20260372748',
        ];
        remainingBlockers = [
          'Fiscal sponsor required for immediate submission',
          'SAM.gov / UEI registration NOT_REGISTERED',
          'Grants.gov organization registration NOT_REGISTERED',
          '0 years operating history',
        ];
        recommendedPathway = 'FISCAL_SPONSOR_REQUIRED';
      } else if (isCoCCompetition) {
        previousClassification = 'PARTNERSHIP_REQUIRED';
        previewClassification = 'PARTNERSHIP_REQUIRED';
        previousScore = 30;
        previewScore = 35;
        changedBlockers = [
          'Legal entity status blocker resolved by California incorporation B20260372748',
        ];
        remainingBlockers = [
          'Direct application blocked: Requires submission through official Continuum of Care Collaborative Applicant via e-snaps',
          'SAM.gov / UEI registration NOT_REGISTERED',
        ];
        recommendedPathway = 'PARTNERSHIP_REQUIRED';
      } else if (opp.candidateRoutingStatus === 'EXCLUDED') {
        previousClassification = 'EXCLUDED';
        previewClassification = 'EXCLUDED';
        previousScore = 0;
        previewScore = 0;
        changedBlockers = [];
        remainingBlockers = ['Incompatible agency scope / program focus'];
        recommendedPathway = 'EXCLUDED';
      } else if (opp.candidateRoutingStatus === 'FUTURE_OPPORTUNITY') {
        previousClassification = 'FUTURE_OPPORTUNITY';
        previewClassification = 'FUTURE_OPPORTUNITY';
        previousScore = 45;
        previewScore = 50;
        changedBlockers = [
          'Legal entity status blocker resolved by California incorporation B20260372748',
        ];
        remainingBlockers = [
          'Requires 501(c)(3) tax-exempt status (NOT_VERIFIED)',
          'Requires SAM.gov / UEI registration (NOT_REGISTERED)',
        ];
        recommendedPathway = 'FUTURE_OPPORTUNITY';
      } else {
        previousClassification = opp.candidateRoutingStatus || 'INVESTIGATE';
        previewClassification = opp.candidateRoutingStatus || 'INVESTIGATE';
        previousScore = 50;
        previewScore = 55;
        changedBlockers = [
          'Legal entity status blocker resolved by California incorporation B20260372748',
        ];
        remainingBlockers = [
          'Requires 501(c)(3) tax-exempt status (NOT_VERIFIED)',
          'Requires SAM.gov / UEI registration (NOT_REGISTERED)',
        ];
        recommendedPathway = opp.candidateRoutingStatus || 'INVESTIGATE';
      }

      previewResults.push({
        opportunityId: opp.id,
        title: opp.title,
        fundingOpportunityNumber: opp.fundingOpportunityNumber || 'N/A',
        isDemo,
        previousFormationStatus: 'PRE_INCORPORATION',
        updatedFormationStatus: 'INCORPORATED',
        previousEligibilityClassification: previousClassification,
        previewEligibilityClassification: previewClassification,
        previousScore,
        previewScore,
        changedBlockingReasons: changedBlockers,
        remainingBlockingReasons: remainingBlockers,
        recommendedPathway,
      });
    }

    return {
      opportunityCount: previewResults.length,
      previewResults,
    };
  }
}
