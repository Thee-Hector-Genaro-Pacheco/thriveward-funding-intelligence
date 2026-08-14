import { prisma } from '../lib/prisma';
import { BRIDGE_FORWARD_PROFILE } from '@bridge-ai/shared';
import { calculateSopMatchRequirement } from './sopMatchCalculator';
import { StrategicPartnerService } from './strategicPartnerService';
import { OpportunityNarrativeService } from './opportunityNarrativeService';

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
  selectedNarrativeLenses: string[];
  opportunitySpecificOrganizationNarrative: string;
  geographicContextNarrative: string;
  narrativeEvidenceFacts: string[];
  narrativeSafeguardsApplied: string[];
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

      if (opp && (opp.candidateRoutingStatus === 'PARTNERSHIP_REQUIRED' || opp.fundingOpportunityNumber?.includes('CPD-2600-DC-0025'))) {
        throw new Error(`Opportunity '${opp.fundingOpportunityNumber || opp.title}' requires a Continuum of Care Collaborative Applicant (Strategic Partner), not a Fiscal Sponsor. Direct application is blocked. Please use Strategic Partner outreach briefing instead.`);
      }
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

We are actively preparing for the federal grant solicitation "${opp.title}" (Notice #${opp.fundingOpportunityNumber}, Agency: ${opp.fundingAgency}), which appears potentially aligned with our mission based on preliminary, human-review-required analysis.

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

    const narrative = OpportunityNarrativeService.buildOpportunitySpecificNarrative({
      opportunity: opp,
      organizationProfile: BRIDGE_FORWARD_PROFILE,
      selectedPartner: candidate,
    });

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
      selectedNarrativeLenses: narrative.selectedNarrativeLenses,
      opportunitySpecificOrganizationNarrative: narrative.opportunitySpecificOrganizationNarrative,
      geographicContextNarrative: narrative.geographicContextNarrative,
      narrativeEvidenceFacts: narrative.narrativeEvidenceFacts,
      narrativeSafeguardsApplied: narrative.narrativeSafeguardsApplied,
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

  /**
   * Generates a strategic partner outreach briefing packet for CoC Collaborative Applicant alignment.
   * Performs zero automated external side-effects.
   */
  public static async generatePartnerBriefingPacket(
    partnerId: string,
    fundingOpportunityId?: string,
    inquiryPurpose: 'GRANT_COMPETITION' | 'GOVERNANCE_MEMBERSHIP' | 'CES_INTEGRATION' | 'GENERAL' = 'GRANT_COMPETITION'
  ) {
    const partner = await prisma.strategicPartnerCandidate.findUnique({
      where: { id: partnerId },
      include: { citations: true, contactChannels: true },
    });

    if (!partner) {
      throw new Error(`Strategic partner candidate #${partnerId} not found`);
    }

    let opp: any = null;
    if (fundingOpportunityId) {
      opp = await prisma.fundingOpportunity.findUnique({
        where: { id: fundingOpportunityId },
      });
    }

    const counties = BRIDGE_FORWARD_PROFILE.initialServiceAreas;
    const countiesStr = `${counties.slice(0, -1).join(', ')}, and ${counties[counties.length - 1]}`;

    // Select purpose-specific recipient contact email or fail closed to [VERIFY CURRENT NOFO CONTACT — DO NOT SEND]
    const recipientEmail = StrategicPartnerService.selectContactForPurpose(
      partner,
      inquiryPurpose as any
    );

    const oppTitle = opp?.title || 'FY2026 Continuum of Care Competition and Youth Homelessness Demonstration Program';
    const oppNumber = opp?.fundingOpportunityNumber || 'CPD-2600-DC-0025';
    const agency = opp?.fundingAgency || 'Department of Housing and Urban Development';
    const deadline = opp?.deadline || '2026-08-26';

    const subjectPrefix = (partner.cocNumber === 'CA-602' || (partner.name || '').includes('Orange')) && inquiryPurpose === 'GRANT_COMPETITION'
      ? 'CoC NOFO Question — Bridge Forward Foundation'
      : 'Preliminary CoC Partnership Inquiry — Bridge Forward Foundation';

    const subject = `${subjectPrefix}: ${oppTitle} (${oppNumber})`;

    const effectiveOpp = opp || {
      title: oppTitle,
      fundingOpportunityNumber: oppNumber,
      fundingAgency: agency,
      deadline,
      candidateRoutingStatus: 'PARTNERSHIP_REQUIRED',
    };

    const narrative = OpportunityNarrativeService.buildOpportunitySpecificNarrative({
      opportunity: effectiveOpp,
      organizationProfile: BRIDGE_FORWARD_PROFILE,
      selectedPartner: partner,
    });

    const bodyText = `Dear Leadership & CoC Planning Team at ${partner.name},

${narrative.opportunitySpecificOrganizationNarrative}

${narrative.geographicContextNarrative}

We are evaluating this opportunity and seeking guidance regarding its current status, local process, and future participation requirements for "${oppTitle}" (Notice #${oppNumber}, Agency: ${agency}), which appears potentially aligned based on preliminary, human-review-required analysis.

As direct application for this competition requires submission through an official Continuum of Care (CoC) Collaborative Applicant via e-snaps, we are reaching out to discuss potential partnership and local CoC project submission alignment with ${partner.name} (${partner.cocNumber || 'CoC Lead'}).

Opportunity & Pathway Context:
- Solicitation Title: ${oppTitle}
- Notice Number: ${oppNumber}
- Funding Agency: ${agency}
- HUD Deadline: ${deadline}
- Required Pathway: PARTNERSHIP_REQUIRED (e-snaps CoC Collaborative Applicant Submission)
- Required Partner Type: CONTINUUM_OF_CARE_COLLABORATIVE_APPLICANT
- Bridge Forward Footprint: ${countiesStr}

Bridge Forward Foundation Readiness Status:
Bridge Forward Foundation is currently PRE_INCORPORATION (lacking legal-entity status, active SAM.gov/UEI, and 501(c)(3) status). We seek to participate as a project applicant/subrecipient under your CoC rating and ranking process.

Key Partnership Discussion Items:
1. Collaborative Applicant e-snaps submission process and project application intake schedule.
2. Local CoC competition review, rating/ranking criteria, and priority funding tiers.
3. Programmatic eligibility for reentry housing and unhoused youth support services.
4. Coordinated Entry System (CES) integration, referral protocols, and HMIS reporting.
5. Required MOUs, subrecipient governance, and non-federal match fund documentation.
6. Local CoC submission deadline and required lead time prior to federal closing.

Thank you for your leadership and guidance.

Best regards,

Bridge Forward Foundation Team
Contact Email: [ADD VERIFIED BRIDGE FORWARD EMAIL]
Service Counties: ${countiesStr}`;

    const discoveryCallQuestions = [
      `1. What is ${partner.name}'s process and timeline for receiving project applications for the ${oppNumber} competition in ${partner.cocNumber || 'your CoC'}?`,
      `2. Does ${partner.name} confirm its role as the official HUD-designated CoC Collaborative Applicant (verified role: ${partner.verifiedOfficialRole})?`,
      `3. What are the local CoC rating, ranking, and bonus project priorities for reentry and unhoused youth populations?`,
      `4. How are Coordinated Entry System (CES) referrals and HMIS data sharing structured for subrecipient projects?`,
      `5. What subrecipient MOUs, governance agreements, and match documentation are required for project inclusion in the CoC Consolidated Application?`,
      `6. What is the internal local submission deadline prior to the HUD closing date of ${deadline}?`,
    ];

    const followUpDate = new Date();
    followUpDate.setDate(followUpDate.getDate() + 7);

    return {
      partnerId: partner.id,
      partnerName: partner.name,
      cocNumber: partner.cocNumber,
      verifiedOfficialRole: partner.verifiedOfficialRole,
      websiteUrl: partner.websiteUrl,
      geography: partner.geography,
      countiesServed: partner.countiesServed,
      opportunityId: opp?.id,
      opportunityTitle: oppTitle,
      opportunityNumber: oppNumber,
      agency,
      deadline,
      requiredPathway: 'PARTNERSHIP_REQUIRED',
      requiredPartnerType: 'CONTINUUM_OF_CARE_COLLABORATIVE_APPLICANT',
      bridgeForwardSummary: {
        name: BRIDGE_FORWARD_PROFILE.name,
        status: BRIDGE_FORWARD_PROFILE.status,
        serviceCounties: BRIDGE_FORWARD_PROFILE.initialServiceAreas,
        mission: BRIDGE_FORWARD_PROFILE.missionStatement,
      },
      selectedNarrativeLenses: narrative.selectedNarrativeLenses,
      opportunitySpecificOrganizationNarrative: narrative.opportunitySpecificOrganizationNarrative,
      geographicContextNarrative: narrative.geographicContextNarrative,
      narrativeEvidenceFacts: narrative.narrativeEvidenceFacts,
      narrativeSafeguardsApplied: narrative.narrativeSafeguardsApplied,
      draftInquiryEmail: {
        to: recipientEmail,
        subject,
        bodyText,
      },
      discoveryCallQuestions,
      recommendedFollowUpDate: followUpDate.toISOString().split('T')[0],
      safeguardNotice:
        '🛡️ HUMAN-CONTROLLED OUTREACH SAFEGUARD: Bridge AI generates briefing packets and email drafts for human review ONLY. Bridge AI will NEVER send an email, submit an application, sign an agreement, make a legal certification, or commit funds without explicit human authorization.',
    };
  }
}
