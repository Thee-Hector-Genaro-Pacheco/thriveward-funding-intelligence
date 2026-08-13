import { prisma } from '../lib/prisma';
import { BRIDGE_FORWARD_PROFILE } from '@bridge-ai/shared';
import { calculateSopMatchRequirement } from './sopMatchCalculator';

export interface SponsorBriefingPacket {
  candidateId: string;
  candidateName: string;
  websiteUrl: string;
  geography: string;
  opportunityId?: string;
  opportunityTitle?: string;
  opportunityNumber?: string;
  fundingAgency?: string;
  deadline?: string;
  awardRange?: string;
  matchRequirement?: string;
  candidateRoutingStatus?: string;
  readinessBlockers?: string;
  inquiryType: 'SPECIFIC_OPPORTUNITY' | 'GENERAL_INTRODUCTORY';
  bridgeForwardSummary: {
    name: string;
    status: string;
    geography: string;
    serviceCounties: string[];
    mission: string;
    targetPopulations: string[];
  };
  draftInquiryEmail: {
    to: string;
    subject: string;
    bodyText: string;
  };
  discoveryCallQuestions: string[];
  recommendedFollowUpDate: string;
  safeguardNotice: string;
}

function formatSponsorshipModels(modelsOffered: string[]): string {
  if (!modelsOffered || modelsOffered.length === 0) {
    return 'fiscal sponsorship';
  }
  const hasA = modelsOffered.includes('MODEL_A');
  const hasC = modelsOffered.includes('MODEL_C');
  const hasF = modelsOffered.includes('MODEL_F');

  const parts: string[] = [];
  if (hasA) parts.push('Model A (Comprehensive)');
  if (hasC) parts.push('Model C (Pre-Approved Grant Relationship)');
  if (hasF) parts.push('Model F (Technical Assistance / Capacity Building)');

  if (parts.length === 0) {
    return 'fiscal sponsorship';
  }
  if (parts.length === 1) {
    return `${parts[0]} fiscal sponsorship`;
  }
  if (parts.length === 2) {
    return `${parts[0]} or ${parts[1]} fiscal sponsorship`;
  }
  return `${parts.join(', ')} fiscal sponsorship`;
}

export class OutreachBriefingService {
  /**
   * Generates a human-reviewed fiscal sponsor briefing packet and outreach draft.
   * Performs zero automated external side-effects (no email sending, no submission).
   */
  public static async generateSponsorBriefingPacket(
    candidateId: string,
    fundingOpportunityId?: string
  ): Promise<SponsorBriefingPacket> {
    const candidate = await prisma.fiscalSponsorCandidate.findUnique({
      where: { id: candidateId },
    });

    if (!candidate) {
      throw new Error(`Fiscal sponsor candidate #${candidateId} not found`);
    }

    let opp: any = null;
    if (fundingOpportunityId) {
      opp = await prisma.fundingOpportunity.findUnique({
        where: { id: fundingOpportunityId },
      });
    }

    const initialAreas = BRIDGE_FORWARD_PROFILE.initialServiceAreas;
    const verifiedCountiesStr =
      initialAreas.length > 1
        ? `${initialAreas.slice(0, -1).join(', ')}, and ${initialAreas[initialAreas.length - 1]}`
        : initialAreas.join(', ');
    const modelText = formatSponsorshipModels(candidate.modelsOffered || []);

    const recipientEmail =
      candidate.contactChannel && candidate.contactChannel !== 'UNKNOWN'
        ? candidate.contactChannel
        : `[ADD SPONSOR RECIPIENT EMAIL]`;

    const readinessBlockers =
      'Bridge Forward Foundation is currently PRE_INCORPORATION (lacking legal-entity status, EIN, active SAM.gov/UEI registration, Grants.gov AOR credentials, matching funds, and operating history).';

    let subject = '';
    let bodyText = '';
    let discoveryCallQuestions: string[] = [];

    let opportunityTitle: string | undefined = undefined;
    let opportunityNumber: string | undefined = undefined;
    let fundingAgency: string | undefined = undefined;
    let deadline: string | undefined = undefined;
    let awardRange: string | undefined = undefined;
    let matchRequirement: string | undefined = undefined;
    let candidateRoutingStatus: string | undefined = undefined;

    if (opp) {
      opportunityTitle = opp.title;
      opportunityNumber = opp.fundingOpportunityNumber;
      fundingAgency = opp.fundingAgency;
      deadline = opp.deadline && opp.deadline !== 'UNKNOWN' ? opp.deadline : 'See official notice';

      const minNum = Number(opp.awardMin);
      const maxNum = Number(opp.awardMax);
      if (!isNaN(minNum) && !isNaN(maxNum) && minNum > 0 && maxNum > 0) {
        awardRange = `$${minNum.toLocaleString()} – $${maxNum.toLocaleString()}`;
      } else if (opp.totalAvailableFunding && opp.totalAvailableFunding !== 'UNKNOWN') {
        awardRange = opp.totalAvailableFunding;
      } else {
        awardRange = 'See official notice for award details';
      }

      if (opp.fundingOpportunityNumber?.includes('HHS-2026-ACF-ACYF-YO-0044')) {
        const sopCalc = calculateSopMatchRequirement(150000);
        matchRequirement = `${sopCalc.matchPercentage}% of total approved project cost ($${sopCalc.nonFederalMatchRequired.toLocaleString()} non-federal match required for $150,000 federal award per official NOFO ${sopCalc.sourcePageRange})`;
      } else {
        matchRequirement = 'Cost-sharing / matching funds required per official notice guidelines';
      }

      candidateRoutingStatus = opp.candidateRoutingStatus || opp.dismissedReason || 'POTENTIAL_PATHWAY';

      subject = `Preliminary Fiscal Sponsorship Inquiry — Bridge Forward Foundation (${opp.title})`;

      bodyText = `Dear Partnerships Team at ${candidate.name},

I am writing on behalf of Bridge Forward Foundation, an emerging Southern California organization focused on stabilizing housing, career pathways, and technology education for justice-involved adults and system-impacted young people in ${verifiedCountiesStr}.

We are actively preparing for the federal grant solicitation "${opp.title}" (Notice #${opp.fundingOpportunityNumber}, Agency: ${opp.fundingAgency}), which explicitly aligns with our service model.

Key Opportunity Details:
- Official Title: ${opp.title}
- Notice ID: ${opp.fundingOpportunityNumber}
- Funding Agency: ${opp.fundingAgency}
- Application Deadline: ${deadline}
- Award Range / Total Available: ${awardRange}
- Cost Sharing / Match Requirement: ${matchRequirement}
- Opportunity Pathway Routing: ${candidateRoutingStatus}

Bridge Forward Foundation Readiness Status:
${readinessBlockers} Consequently, we are seeking a verified California fiscal sponsor offering ${modelText} to serve as the legal applicant and administer federal government grant funds for this opportunity.

We would welcome 15–20 minutes to discuss:
1. ${candidate.name}'s project intake criteria and current capacity for new projects in ${verifiedCountiesStr}.
2. Your experience administering federal awards with ${opp.fundingAgency}.
3. Application timeline and fee structure (setup fee: ${candidate.setupFee}, admin rate: ${candidate.adminPercentage}, review lead time: ${candidate.estimatedReviewTime}).

Thank you for your time and guidance.

Best regards,

Bridge Forward Foundation Team
Contact Email: [ADD VERIFIED BRIDGE FORWARD EMAIL]
Service Footprint: ${verifiedCountiesStr}`;

      discoveryCallQuestions = [
        `1. Does ${candidate.name} currently accept new projects for ${modelText} in ${verifiedCountiesStr}?`,
        `2. What is ${candidate.name}'s active SAM.gov registration & UEI status, and do you regularly serve as legal applicant for ${opp.fundingAgency} federal grants?`,
        `3. What is the typical lead time from initial application submission to executed sponsorship contract (estimated review time: ${candidate.estimatedReviewTime}) for Notice #${opp.fundingOpportunityNumber}?`,
        `4. What administrative percentage fee (${candidate.adminPercentage}) and setup fee (${candidate.setupFee}) apply to federal grant awards of this size (${awardRange})?`,
        `5. How does ${candidate.name} manage the required match administration (${matchRequirement}) and quarterly financial reporting?`,
      ];
    } else {
      // General Introductory Inquiry (No opportunity selected)
      subject = `Preliminary Fiscal Sponsorship Inquiry — Bridge Forward Foundation (General Inquiry for Future Funding Cycles)`;

      bodyText = `Dear Partnerships Team at ${candidate.name},

I am writing on behalf of Bridge Forward Foundation, an emerging Southern California organization focused on stabilizing housing, career pathways, and technology education for justice-involved adults and system-impacted young people in ${verifiedCountiesStr}.

As Bridge Forward Foundation is currently pre-incorporation, we are seeking information regarding potential ${modelText} for future public and private grant opportunities aligned with our mission.

We are not requesting sponsorship for a specific open solicitation at this time. Rather, we are conducting preliminary outreach to understand your intake process, capacity, and requirements for future funding cycles.

Bridge Forward Foundation Readiness Status:
${readinessBlockers}

We would welcome 15–20 minutes to discuss:
1. ${candidate.name}'s project intake criteria and current capacity for new projects in ${verifiedCountiesStr}.
2. Experience administering government and foundation grants for reentry and workforce development programs.
3. Application timeline and fee structure (setup fee: ${candidate.setupFee}, admin rate: ${candidate.adminPercentage}, review lead time: ${candidate.estimatedReviewTime}).

Thank you for your time and guidance.

Best regards,

Bridge Forward Foundation Team
Contact Email: [ADD VERIFIED BRIDGE FORWARD EMAIL]
Service Footprint: ${verifiedCountiesStr}`;

      discoveryCallQuestions = [
        `1. Does ${candidate.name} currently accept new projects for ${modelText} in ${verifiedCountiesStr}?`,
        `2. What is ${candidate.name}'s active SAM.gov registration & UEI status, and do you regularly serve as legal applicant for government grants?`,
        `3. What is the typical lead time from initial application submission to executed sponsorship contract (estimated review time: ${candidate.estimatedReviewTime})?`,
        `4. What administrative percentage fee (${candidate.adminPercentage}) and setup fee (${candidate.setupFee}) apply to government grant awards?`,
        `5. What are the eligibility criteria and documentation requirements for emerging organizations seeking fiscal sponsorship?`,
      ];
    }

    const followUpDate = new Date();
    followUpDate.setDate(followUpDate.getDate() + 7);
    const recommendedFollowUpDate = followUpDate.toISOString().split('T')[0];

    const safeguardNotice =
      '🛡️ HUMAN-CONTROLLED OUTREACH SAFEGUARD: Bridge AI generates briefing packets and email drafts for human review ONLY. Bridge AI will NEVER send an email, submit an application, sign an agreement, make a legal certification, or commit funds without explicit human authorization.';

    return {
      candidateId: candidate.id,
      candidateName: candidate.name,
      websiteUrl: candidate.websiteUrl,
      geography: candidate.geography,
      opportunityId: opp?.id,
      opportunityTitle,
      opportunityNumber,
      fundingAgency,
      deadline,
      awardRange,
      matchRequirement,
      candidateRoutingStatus,
      readinessBlockers,
      inquiryType: opp ? 'SPECIFIC_OPPORTUNITY' : 'GENERAL_INTRODUCTORY',
      bridgeForwardSummary: {
        name: BRIDGE_FORWARD_PROFILE.name,
        status: BRIDGE_FORWARD_PROFILE.status,
        geography: BRIDGE_FORWARD_PROFILE.statewideGeography,
        serviceCounties: BRIDGE_FORWARD_PROFILE.initialServiceAreas,
        mission: BRIDGE_FORWARD_PROFILE.missionStatement,
        targetPopulations: BRIDGE_FORWARD_PROFILE.primaryPopulations,
      },
      draftInquiryEmail: {
        to: recipientEmail,
        subject,
        bodyText,
      },
      discoveryCallQuestions,
      recommendedFollowUpDate,
      safeguardNotice,
    };
  }
}
