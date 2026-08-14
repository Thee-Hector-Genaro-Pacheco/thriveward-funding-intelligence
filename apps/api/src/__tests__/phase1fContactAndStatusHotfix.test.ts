import { describe, it, expect, beforeAll } from 'vitest';
import { StrategicPartnerService } from '../services/strategicPartnerService';
import { OutreachBriefingService } from '../services/outreachBriefingService';
import { OpportunityService } from '../services/opportunityService';
import { prisma } from '../lib/prisma';

describe('Phase 1F — Contact-Integrity and Current-Cycle Status Hotfix Test Suite', () => {
  let oppCoC: any;
  let lahsaCandidate: any;
  let orangeCandidate: any;

  beforeAll(async () => {
    // 1. Run live discovery to populate database with verified candidates
    await StrategicPartnerService.runDiscovery();

    // 2. Fetch or create CoC opportunity CPD-2600-DC-0025
    oppCoC = await prisma.fundingOpportunity.findFirst({
      where: {
        OR: [
          { fundingOpportunityNumber: 'CPD-2600-DC-0025' },
          { title: { contains: 'Continuum of Care', mode: 'insensitive' } },
        ],
      },
    });

    if (!oppCoC) {
      oppCoC = await prisma.fundingOpportunity.create({
        data: {
          title: 'FY2026 Continuum of Care Competition and Youth Homelessness Demonstration Program',
          fundingOpportunityNumber: 'CPD-2600-DC-0025',
          fundingAgency: 'Department of Housing and Urban Development',
          description: 'CoC Competition grant supporting housing and supportive services.',
          deadline: '2026-08-26',
          awardMin: '100000',
          awardMax: '5000000',
          candidateRoutingStatus: 'PARTNERSHIP_REQUIRED',
          dismissedReason: 'PARTNERSHIP_REQUIRED: Direct federal application blocked. Requires submission through official Continuum of Care (CoC) Collaborative Applicant via e-snaps.',
          pursuitStage: 'NEW',
          sourceUrl: 'https://www.grants.gov/search-results-detail/350000',
        },
      });
    }

    lahsaCandidate = await prisma.strategicPartnerCandidate.findFirst({
      where: { cocNumber: 'CA-600' },
      include: { contactChannels: true, citations: true },
    });

    orangeCandidate = await prisma.strategicPartnerCandidate.findFirst({
      where: { cocNumber: 'CA-602' },
      include: { contactChannels: true, citations: true },
    });
  });

  it('Requirement 1 & 4: cocinfo@lahsa.org and cocinfo@ochca.com appear nowhere in database or discovery', async () => {
    // DB check on StrategicPartnerCandidate contactChannel
    const lahsaOld = await prisma.strategicPartnerCandidate.findFirst({
      where: { contactChannel: { contains: 'cocinfo@lahsa.org', mode: 'insensitive' } },
    });
    expect(lahsaOld).toBeNull();

    const ochcaOld = await prisma.strategicPartnerCandidate.findFirst({
      where: { contactChannel: { contains: 'cocinfo@ochca.com', mode: 'insensitive' } },
    });
    expect(ochcaOld).toBeNull();

    // Discovery output check
    const discovery = await StrategicPartnerService.runDiscovery();
    const lahsa = discovery.partners.find((p) => p.cocNumber === 'CA-600');
    expect(lahsa?.contactChannel).toBe('NOFA@lahsa.org');

    const orange = discovery.partners.find((p) => p.cocNumber === 'CA-602');
    expect(orange?.contactChannel).toBe('CareCoordination@ceo.oc.gov');
  });

  it('Requirement 5: Orange County routes general inquiries to CareCoordination@ceo.oc.gov and CES to CoordinatedEntry@ceo.oc.gov', async () => {
    expect(orangeCandidate).toBeDefined();

    // Test general grant inquiry
    const grantBriefing = await OutreachBriefingService.generatePartnerBriefingPacket(
      orangeCandidate.id,
      oppCoC.id,
      'GRANT_COMPETITION'
    );
    expect(grantBriefing.draftInquiryEmail.to).toBe('CareCoordination@ceo.oc.gov');
    expect(grantBriefing.draftInquiryEmail.subject).toContain('CoC NOFO Question — Bridge Forward Foundation');

    // Test CES integration inquiry
    const cesBriefing = await OutreachBriefingService.generatePartnerBriefingPacket(
      orangeCandidate.id,
      oppCoC.id,
      'CES_INTEGRATION'
    );
    expect(cesBriefing.draftInquiryEmail.to).toBe('CoordinatedEntry@ceo.oc.gov');

    // Assert canonical source URLs and verbatim evidence quotes
    const channels = await prisma.partnerContactChannel.findMany({
      where: { strategicPartnerCandidateId: orangeCandidate.id },
    });
    expect(channels.length).toBeGreaterThanOrEqual(3);

    const nofaChan = channels.find((c) => c.purposeCategory === 'GRANT_COMPETITION');
    expect(nofaChan).toBeDefined();
    expect(nofaChan?.contactValue).toBe('CareCoordination@ceo.oc.gov');
    expect(nofaChan?.sourceUrl).toBe('https://ceo.oc.gov/fy2026cocnofo');
    expect(nofaChan?.quotedCitation).toBe('For questions related to the CoC NOFO, please email the Office of Care Coordination at CareCoordination@ceo.oc.gov with the email subject line "CoC NOFO Question".');

    const generalChan = channels.find((c) => c.purposeCategory === 'GENERAL');
    expect(generalChan).toBeDefined();
    expect(generalChan?.contactValue).toBe('CareCoordination@ceo.oc.gov');
    expect(generalChan?.sourceUrl).toBe('https://ceo.oc.gov/office-care-coordination');
    expect(generalChan?.quotedCitation).toBe('For further information, contact CareCoordination@ceo.oc.gov');

    const cesChan = channels.find((c) => c.purposeCategory === 'CES_INTEGRATION');
    expect(cesChan).toBeDefined();
    expect(cesChan?.contactValue).toBe('CoordinatedEntry@ceo.oc.gov');
    expect(cesChan?.sourceUrl).toBe('https://ceo.ocgov.com/care-coordination/homeless-services/coordinated-entry-system');
    expect(cesChan?.quotedCitation).toBe('For additional information about the Coordinated Entry System, email CoordinatedEntry@ceo.oc.gov.');
  });

  it('Requirement 2 & 3: LAHSA routes NOFA@lahsa.org for grant inquiries and LACoCBoard@lahsa.org for board inquiries', async () => {
    expect(lahsaCandidate).toBeDefined();

    const grantBriefing = await OutreachBriefingService.generatePartnerBriefingPacket(
      lahsaCandidate.id,
      oppCoC.id,
      'GRANT_COMPETITION'
    );
    expect(grantBriefing.draftInquiryEmail.to).toBe('NOFA@lahsa.org');

    const boardBriefing = await OutreachBriefingService.generatePartnerBriefingPacket(
      lahsaCandidate.id,
      oppCoC.id,
      'GOVERNANCE_MEMBERSHIP'
    );
    expect(boardBriefing.draftInquiryEmail.to).toBe('LACoCBoard@lahsa.org');
  });

  it('Requirement 8: Unverified candidates fail closed to [VERIFY CURRENT NOFO CONTACT — DO NOT SEND]', async () => {
    const unverifiedPartner = await StrategicPartnerService.createPartner({
      name: 'Unverified Community Organization',
      organizationType: 'NONPROFIT',
      websiteUrl: 'https://www.unverified.org',
      geography: 'Los Angeles County',
      mission: 'Unverified mission',
      servicesOffered: [],
      collaborationFocus: 'Unknown',
      contactChannel: 'UNKNOWN',
    });

    const unverifiedBriefing = await OutreachBriefingService.generatePartnerBriefingPacket(
      unverifiedPartner.id,
      oppCoC.id,
      'GRANT_COMPETITION'
    );

    // Must fail closed to [VERIFY CURRENT NOFO CONTACT — DO NOT SEND]
    expect(unverifiedBriefing.draftInquiryEmail.to).toBe('[VERIFY CURRENT NOFO CONTACT — DO NOT SEND]');

    await prisma.strategicPartnerCandidate.delete({ where: { id: unverifiedPartner.id } });
  });

  it('Requirement 6 & 9: CPD-2600-DC-0025 reports INVESTIGATE — CONFLICTING OFFICIAL SOURCES and updated wording', async () => {
    const sanitized = await OpportunityService.getOpportunityById(oppCoC.id);

    expect(sanitized.hasSourceConflict).toBe(true);
    expect(sanitized.currentCycleStatus).toBe('INVESTIGATE — CONFLICTING OFFICIAL SOURCES');

    const briefing = await OutreachBriefingService.generatePartnerBriefingPacket(
      lahsaCandidate.id,
      oppCoC.id,
      'GRANT_COMPETITION'
    );

    expect(briefing.draftInquiryEmail.bodyText).toContain(
      'We are evaluating this opportunity and seeking guidance regarding its current status, local process, and future participation requirements'
    );
    expect(briefing.draftInquiryEmail.bodyText).not.toContain('We are preparing for the upcoming federal solicitation');
  });
});
