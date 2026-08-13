import { prisma } from '../lib/prisma';
import { BRIDGE_FORWARD_PROFILE } from '@bridge-ai/shared';

export interface SponsorBriefingPacket {
  candidateId: string;
  candidateName: string;
  websiteUrl: string;
  geography: string;
  opportunityTitle?: string;
  opportunityNumber?: string;
  bridgeForwardSummary: {
    name: string;
    status: string;
    geography: string;
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

    let opp;
    if (fundingOpportunityId) {
      opp = await prisma.fundingOpportunity.findUnique({
        where: { id: fundingOpportunityId },
      });
    }

    const oppTitle = opp ? opp.title : 'Target Federal Grant Solicitations';
    const oppNum = opp?.fundingOpportunityNumber || 'N/A';

    const draftInquiryEmail = {
      to: candidate.contactChannel !== 'UNKNOWN' ? candidate.contactChannel : `info@${candidate.websiteUrl.replace(/^https?:\/\//, '').replace(/\/.*$/, '')}`,
      subject: `Preliminary Fiscal Sponsorship Inquiry — Bridge Forward Foundation (${oppTitle})`,
      bodyText: `Dear Partnerships Team at ${candidate.name},

I am writing on behalf of Bridge Forward Foundation, an emerging Southern California organization focused on stabilizing housing, career pathways, and technology education for justice-involved adults, system-impacted youth, and unhoused community members in Riverside, San Bernardino, and surrounding Southern California areas.

We are preparing for upcoming federal grant opportunities, including ${oppTitle} (Notice #${oppNum}), which explicitly align with our service model. As Bridge Forward is currently pre-incorporation, we are seeking a qualified California fiscal sponsor (Model A or Model F) capable of serving as the legal applicant and administering federal government grant awards.

We would welcome 15–20 minutes to discuss:
1. Your project intake criteria and current capacity for new projects.
2. Experience administering federal awards (e.g. HHS, DOL, HUD, DOJ).
3. Application timeline and fee structure (setup fee: ${candidate.setupFee}, admin rate: ${candidate.adminPercentage}).

Thank you for your time and guidance.

Best regards,

Bridge Forward Foundation Team
Contact: info@bridgeforward.org
Service Footprint: Southern California / California Statewide`,
    };

    const discoveryCallQuestions = [
      `1. Does ${candidate.name} currently accept new projects for Model A or Model F fiscal sponsorship in Southern California?`,
      `2. What is your organization's active SAM.gov registration & UEI status, and do you regularly serve as legal applicant for federal government grants?`,
      `3. What is the typical lead time from initial application submission to executed sponsorship contract (estimated review time listed as ${candidate.estimatedReviewTime})?`,
      `4. What administrative percentage fee (${candidate.adminPercentage}) and setup fee (${candidate.setupFee}) apply to federal grant awards?`,
      `5. How does ${candidate.name} support matching fund administration and quarterly financial reporting?`,
    ];

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
      opportunityTitle: oppTitle,
      opportunityNumber: oppNum,
      bridgeForwardSummary: {
        name: BRIDGE_FORWARD_PROFILE.name,
        status: BRIDGE_FORWARD_PROFILE.status,
        geography: BRIDGE_FORWARD_PROFILE.statewideGeography,
        mission: BRIDGE_FORWARD_PROFILE.missionStatement,
        targetPopulations: BRIDGE_FORWARD_PROFILE.primaryPopulations,
      },
      draftInquiryEmail,
      discoveryCallQuestions,
      recommendedFollowUpDate,
      safeguardNotice,
    };
  }
}
