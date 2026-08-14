import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../server';
import { prisma } from '../lib/prisma';
import { OutreachBriefingService } from '../services/outreachBriefingService';

const REVIEW_TOKEN = 'bridge_secret_review_token_change_in_production_2026';

describe('Phase 1E — Fiscal Sponsor Inquiry Briefing Generator Regression Test Suite', () => {
  let communityInitiativesId: string;
  let communityPartnersId: string;
  let sopOppId: string;
  let expectedOppNumber: string;

  beforeAll(async () => {
    process.env.DATABASE_URL =
      process.env.DATABASE_URL ||
      'postgresql://bridge_admin:bridge_secure_pass_2026@localhost:5432/bridge_ai_db?schema=public';
    process.env.BRIDGE_REVIEW_TOKEN = REVIEW_TOKEN;

    const ci = await prisma.fiscalSponsorCandidate.findFirst({
      where: { canonicalDomain: 'communityinitiatives.org', isMerged: false },
    });
    const cp = await prisma.fiscalSponsorCandidate.findFirst({
      where: { canonicalDomain: 'communitypartners.org', isMerged: false },
    });

    let sop = await prisma.fundingOpportunity.findFirst({
      where: {
        OR: [
          { fundingOpportunityNumber: 'HHS-2026-ACF-ACYF-YO-0044' },
          { title: { contains: 'Street Outreach' } },
        ],
      },
    });

    if (!sop) {
      sop = await prisma.fundingOpportunity.findFirst();
    }

    if (ci) communityInitiativesId = ci.id;
    if (cp) communityPartnersId = cp.id;
    if (sop) {
      sopOppId = sop.id;
      expectedOppNumber = sop.fundingOpportunityNumber || '';
    }
  });

  it('1. General Briefing (No Opportunity Selected) never generates "Target Federal Grant Solicitations" or "Notice #N/A"', async () => {
    const packet = await OutreachBriefingService.generateSponsorBriefingPacket(communityInitiativesId);

    expect(packet.inquiryType).toBe('GENERAL_INTRODUCTORY');
    expect(packet.opportunityTitle).toBeUndefined();
    expect(packet.opportunityNumber).toBeUndefined();

    expect(packet.draftInquiryEmail.subject).not.toContain('Target Federal Grant Solicitations');
    expect(packet.draftInquiryEmail.bodyText).not.toContain('Target Federal Grant Solicitations');
    expect(packet.draftInquiryEmail.bodyText).not.toContain('Notice #N/A');
    expect(packet.draftInquiryEmail.bodyText).not.toContain('N/A');
    expect(packet.draftInquiryEmail.subject).toContain('General Inquiry for Future Funding Cycles');
    expect(packet.draftInquiryEmail.bodyText).toContain('We are not requesting sponsorship for a specific open solicitation at this time');
  });

  it('2. Opportunity-Specific Briefing populates official title, notice ID, agency, deadline, award range, and match requirement', async () => {
    const packet = await OutreachBriefingService.generateSponsorBriefingPacket(communityPartnersId, sopOppId);

    expect(packet.inquiryType).toBe('SPECIFIC_OPPORTUNITY');
    expect(packet.opportunityTitle).toBeDefined();
    expect(packet.opportunityNumber).toBe(expectedOppNumber);
    expect(packet.fundingAgency).toBeDefined();
    expect(packet.deadline).toBeDefined();
    expect(packet.awardRange).toBeDefined();
    expect(packet.matchRequirement).toBeDefined();

    expect(packet.draftInquiryEmail.subject).toContain(packet.opportunityTitle);
    expect(packet.draftInquiryEmail.bodyText).toContain(`Notice #${expectedOppNumber}`);
    expect(packet.draftInquiryEmail.bodyText).toContain('Official Title:');
    expect(packet.draftInquiryEmail.bodyText).toContain('Cost Sharing / Match Requirement:');
  });

  it('3. Briefing uses exact Project Thriveward service counties: Orange County and Los Angeles County', async () => {
    const packet = await OutreachBriefingService.generateSponsorBriefingPacket(communityInitiativesId);

    const verifiedCounties = 'Orange County, and Los Angeles County';
    expect(packet.draftInquiryEmail.bodyText).toContain(verifiedCounties);
    expect(packet.bridgeForwardSummary.serviceCounties).toEqual([
      'Orange County',
      'Los Angeles County',
    ]);
  });

  it('4. Sponsorship models are restricted to candidate verified models (Community Initiatives requests Model A only, NEVER Model F)', async () => {
    const packetCI = await OutreachBriefingService.generateSponsorBriefingPacket(communityInitiativesId);

    // Community Initiatives offers MODEL_A only
    expect(packetCI.draftInquiryEmail.bodyText).toContain('Model A (Comprehensive)');
    expect(packetCI.draftInquiryEmail.bodyText).not.toContain('Model F');

    for (const q of packetCI.discoveryCallQuestions) {
      expect(q).not.toContain('Model F');
    }
  });

  it('5. Contact email displays [ADD VERIFIED PROJECT THRIVEWARD EMAIL] and never fabricates unverified email addresses', async () => {
    const packet = await OutreachBriefingService.generateSponsorBriefingPacket(communityPartnersId);

    expect(packet.draftInquiryEmail.bodyText).toContain('Contact Email: [ADD VERIFIED PROJECT THRIVEWARD EMAIL]');
    expect(packet.draftInquiryEmail.bodyText).not.toContain('info@bridgeforward.org');
  });

  it('6. GET /api/fiscal-sponsors/:id/briefing endpoint returns correct inquiryType and structure', async () => {
    const resGeneral = await request(app).get(`/api/fiscal-sponsors/${communityInitiativesId}/briefing`);
    expect(resGeneral.status).toBe(200);
    expect(resGeneral.body.data.inquiryType).toBe('GENERAL_INTRODUCTORY');

    const resSpecific = await request(app).get(`/api/fiscal-sponsors/${communityInitiativesId}/briefing?opportunityId=${sopOppId}`);
    expect(resSpecific.status).toBe(200);
    expect(resSpecific.body.data.inquiryType).toBe('SPECIFIC_OPPORTUNITY');
    expect(resSpecific.body.data.opportunityNumber).toBe(expectedOppNumber);
  });
});
