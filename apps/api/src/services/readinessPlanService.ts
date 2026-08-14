import { prisma } from '../lib/prisma';
import { PlanTaskStatus } from '@prisma/client';
import { calculateSopMatchRequirement } from './sopMatchCalculator';

export class ReadinessPlanService {
  /**
   * Get or generate a Funding Readiness Plan for an opportunity.
   */
  public static async getOrGeneratePlan(fundingOpportunityId: string) {
    const opp = await prisma.fundingOpportunity.findUnique({
      where: { id: fundingOpportunityId },
      include: {
        readinessPlans: {
          include: {
            tasks: { orderBy: { createdAt: 'asc' } },
            history: { orderBy: { createdAt: 'desc' } },
          },
        },
      },
    });

    if (!opp) {
      throw new Error(`Funding opportunity #${fundingOpportunityId} not found`);
    }

    if (opp.readinessPlans.length > 0) {
      return opp.readinessPlans[0];
    }

    const oppNum = (opp.fundingOpportunityNumber || '').toUpperCase();
    const isStreetOutreach = oppNum.includes('HHS-2026-ACF-ACYF-YO-0044') || opp.title.toLowerCase().includes('street outreach');

    let planData;

    if (isStreetOutreach) {
      const sopMatch = calculateSopMatchRequirement(150000);
      const sopMinMatch = calculateSopMatchRequirement(90000);

      planData = {
        fundingOpportunityId: opp.id,
        targetNextCycle: 'FY 2027 Annual Street Outreach Program Cycle (Anticipated Post Date: May 2027)',
        currentBlocker: 'PRE_INCORPORATION: Lacks legal entity status, EIN, SAM.gov/UEI, Grants.gov AOR, executed fiscal sponsor agreement, non-federal match reserves, and operating history.',
        requiredRegistrations: [
          'California Legal Incorporation (Articles of Incorporation)',
          'IRS Employer Identification Number (EIN)',
          'Active SAM.gov Entity Registration',
          'SAM.gov Unique Entity Identifier (UEI)',
          'Grants.gov Authorized Organization Representative (AOR) Account',
        ],
        fiscalSponsorOrPartnerRequirements: [
          'Formal Fiscal Sponsorship Agreement with an eligible California 501(c)(3) nonprofit partner',
          'Sponsor agreement verifying willingness to serve as legal applicant for federal HHS/ACYF awards',
          'Runaway & homeless youth service partner MOUs in Southern California / Inland Empire',
        ],
        operatingHistoryAndCapacityGaps: [
          '0 years independent organizational operating history (PRE_INCORPORATION)',
          'Missing audited financial statements for prior 2 years',
          `Unverified statutory non-federal match reserve ($${sopMinMatch.nonFederalMatchRequired.toLocaleString()}–$${sopMatch.nonFederalMatchRequired.toLocaleString()} required under RHY Act §383, 34 U.S.C. §11274, NOFO Pages 6–8)`,
        ],
        requiredDocuments: [
          'Executed Fiscal Sponsorship Agreement or Articles of Incorporation',
          '10% Statutory Non-Federal Match Commitment Letters',
          'Youth Safeguarding & Mandatory Reporting Policy Manual',
          'Street Outreach Service Delivery Plan & Staffing Roster',
          'Program Budget & Narrative Template',
        ],
        matchFundStrategy: sopMatch.formattedSummary,
        responsibleOwner: 'Project Thriveward Executive Lead & Project Counsel',
        targetCompletionDate: new Date('2027-04-15T00:00:00Z'),
        isComplete: false,
        tasks: {
          create: [
            {
              title: '1. Legal Incorporation in California',
              description: 'File Articles of Incorporation with California Secretary of State as a public benefit corporation.',
              category: 'LEGAL',
              responsibleOwner: 'Project Counsel',
              targetDate: new Date('2026-11-30T00:00:00Z'),
              status: PlanTaskStatus.NOT_STARTED,
              sourceEvidence: 'California Secretary of State Portal',
            },
            {
              title: '2. Federal EIN Assignment',
              description: 'Obtain Employer Identification Number from IRS online application portal.',
              category: 'REGISTRATION',
              responsibleOwner: 'Executive Lead',
              targetDate: new Date('2026-12-15T00:00:00Z'),
              status: PlanTaskStatus.NOT_STARTED,
              sourceEvidence: 'IRS Form SS-4 Assignment',
            },
            {
              title: '3. SAM.gov Registration & UEI Assignment',
              description: 'Register entity on SAM.gov, complete CAGE code validation, and receive Unique Entity Identifier.',
              category: 'REGISTRATION',
              responsibleOwner: 'Executive Lead',
              targetDate: new Date('2027-01-31T00:00:00Z'),
              status: PlanTaskStatus.NOT_STARTED,
              sourceEvidence: 'SAM.gov Active Entity Record',
            },
            {
              title: '4. Grants.gov AOR Credentials Setup',
              description: 'Create Grants.gov organization profile and assign Authorized Organization Representative roles.',
              category: 'REGISTRATION',
              responsibleOwner: 'Executive Lead',
              targetDate: new Date('2027-02-15T00:00:00Z'),
              status: PlanTaskStatus.NOT_STARTED,
              sourceEvidence: 'Grants.gov AOR Profile Approval',
            },
            {
              title: '5. Fiscal Sponsor Evaluation & Execution',
              description: 'Evaluate California fiscal sponsors (Model A / Model C) and execute formal sponsorship agreement.',
              category: 'PARTNERSHIP',
              responsibleOwner: 'Executive Lead',
              targetDate: new Date('2027-02-28T00:00:00Z'),
              status: PlanTaskStatus.NOT_STARTED,
              sourceEvidence: 'Executed Fiscal Sponsorship Contract',
            },
            {
              title: '6. 10% Non-Federal Match Strategy Execution',
              description: `Identify and secure written match commitments ($${sopMinMatch.nonFederalMatchRequired.toLocaleString()}–$${sopMatch.nonFederalMatchRequired.toLocaleString()}) from community foundations and partner in-kind space/services per RHY Act §383 (NOFO Pages 6–8).`,
              category: 'FINANCIAL',
              responsibleOwner: 'Development Director',
              targetDate: new Date('2027-03-15T00:00:00Z'),
              status: PlanTaskStatus.NOT_STARTED,
              sourceEvidence: 'Signed Match Commitment Letters',
            },
            {
              title: '7. Runaway & Homeless Youth Service Partnerships',
              description: 'Establish partnership MOUs with local emergency shelters, school district homeless liaisons, and crisis centers.',
              category: 'PARTNERSHIP',
              responsibleOwner: 'Program Director',
              targetDate: new Date('2027-03-31T00:00:00Z'),
              status: PlanTaskStatus.NOT_STARTED,
              sourceEvidence: 'Executed Partner MOUs',
            },
            {
              title: '8. Safeguarding & Mandatory Reporting Policies',
              description: 'Draft comprehensive youth protection protocols, background check requirements, and mandatory child abuse reporting procedures.',
              category: 'PROGRAMMATIC',
              responsibleOwner: 'Compliance Officer',
              targetDate: new Date('2027-04-15T00:00:00Z'),
              status: PlanTaskStatus.NOT_STARTED,
              sourceEvidence: 'Approved Policy Handbook',
            },
            {
              title: '9. Operating-History & Evidence Documentation',
              description: 'Compile track record metrics, participant feedback, and pilot program outcome data.',
              category: 'PROGRAMMATIC',
              responsibleOwner: 'Program Director',
              targetDate: new Date('2027-04-30T00:00:00Z'),
              status: PlanTaskStatus.NOT_STARTED,
              sourceEvidence: 'Program Evaluation Report',
            },
            {
              title: '10. Application Preparation (90-Day Lead Time)',
              description: 'Begin program design, logic model, staffing schedule, budget narrative, and application draft 90 days before anticipated deadline.',
              category: 'PROGRAMMATIC',
              responsibleOwner: 'Grant Writer & Executive Lead',
              targetDate: new Date('2027-05-15T00:00:00Z'),
              status: PlanTaskStatus.NOT_STARTED,
              sourceEvidence: 'Complete Proposal Narrative Package',
            },
          ],
        },
      };
    } else {
      planData = {
        fundingOpportunityId: opp.id,
        targetNextCycle: 'Future Cycle Preparation Plan',
        currentBlocker: opp.dismissedReason || 'PRE_INCORPORATION / Fiscal Sponsor Required',
        requiredRegistrations: ['California Nonprofit Incorporation', 'SAM.gov & UEI Registration', 'Grants.gov AOR Setup'],
        fiscalSponsorOrPartnerRequirements: ['Identify California fiscal sponsor', 'Secure partner collaboration agreement'],
        operatingHistoryAndCapacityGaps: ['Document operating history', 'Build financial reserve'],
        requiredDocuments: ['Fiscal Sponsor MOU / Articles of Incorporation', 'Program Budget', 'Board Roster'],
        matchFundStrategy: 'Evaluate match requirements and secure foundation commitments.',
        responsibleOwner: 'Project Thriveward Executive Team',
        targetCompletionDate: new Date('2027-06-30T00:00:00Z'),
        isComplete: false,
        tasks: {
          create: [
            {
              title: 'Evaluate Fiscal Sponsor Candidates',
              description: 'Review directory candidates and select top 3 potential sponsors.',
              category: 'PARTNERSHIP',
              targetDate: new Date('2027-01-31T00:00:00Z'),
              status: PlanTaskStatus.NOT_STARTED,
            },
            {
              title: 'Prepare Registration Package',
              description: 'Assemble organization details for SAM.gov / UEI setup.',
              category: 'REGISTRATION',
              targetDate: new Date('2027-03-31T00:00:00Z'),
              status: PlanTaskStatus.NOT_STARTED,
            },
          ],
        },
      };
    }

    const createdPlan = await prisma.opportunityReadinessPlan.create({
      data: planData,
      include: {
        tasks: { orderBy: { createdAt: 'asc' } },
        history: { orderBy: { createdAt: 'desc' } },
      },
    });

    // Record initial history
    await prisma.readinessPlanHistory.create({
      data: {
        planId: createdPlan.id,
        fromStatus: 'NONE',
        toStatus: 'CREATED',
        actorId: 'system-initialization',
        notes: 'Funding readiness plan initialized for potential pathway',
      },
    });

    return createdPlan;
  }

  /**
   * Update task status in a readiness plan.
   */
  public static async updateTaskStatus(params: {
    taskId: string;
    targetStatus: PlanTaskStatus;
    actorId: string;
    notes?: string;
  }) {
    const task = await prisma.readinessPlanTask.findUnique({
      where: { id: params.taskId },
      include: { plan: true },
    });

    if (!task) {
      throw new Error(`Readiness plan task #${params.taskId} not found`);
    }

    const updatedTask = await prisma.readinessPlanTask.update({
      where: { id: params.taskId },
      data: { status: params.targetStatus },
    });

    await prisma.readinessPlanHistory.create({
      data: {
        planId: task.planId,
        fromStatus: task.status,
        toStatus: params.targetStatus,
        actorId: params.actorId,
        notes: params.notes || `Task '${task.title}' updated to ${params.targetStatus}`,
      },
    });

    return updatedTask;
  }

  /**
   * List all readiness plans.
   */
  public static async listPlans() {
    return await prisma.opportunityReadinessPlan.findMany({
      include: {
        fundingOpportunity: true,
        tasks: { orderBy: { createdAt: 'asc' } },
        history: { orderBy: { createdAt: 'desc' } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
