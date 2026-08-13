import { describe, it, expect, beforeAll } from 'vitest';
import { StrategicPartnerService } from '../services/strategicPartnerService';
import { OutreachBriefingService } from '../services/outreachBriefingService';
import { OpportunityService } from '../services/opportunityService';
import { prisma } from '../lib/prisma';

describe('Phase 1F — Contact-Integrity and Current-Cycle Status Hotfix Test Suite', () => {
  let oppCoC: any;
  let lahsaCandidate: any;

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
      where: {
        OR: [{ cocNumber: 'CA-600' }, { name: { contains: 'LAHSA', mode: 'insensitive' } }],
      },
      include: { contactChannels: true, citations: true },
    });
  });

  it('Requirement 1: cocinfo@lahsa.org appears nowhere in database, discovery, or briefings', async () => {
    // DB check on StrategicPartnerCandidate contactChannel
    const candidateWithCocinfo = await prisma.strategicPartnerCandidate.findFirst({
      where: { contactChannel: { contains: 'cocinfo@lahsa.org', mode: 'insensitive' } },
    });
    expect(candidateWithCocinfo).toBeNull();

    // DB check on PartnerContactChannel
    const channelWithCocinfo = await prisma.partnerContactChannel.findFirst({
      where: { contactValue: { contains: 'cocinfo@lahsa.org', mode: 'insensitive' } },
    });
    expect(channelWithCocinfo).toBeNull();

    // Discovery output check
    const discovery = await StrategicPartnerService.runDiscovery();
    const lahsaFromDiscovery = discovery.partners.find((p) => p.cocNumber === 'CA-600');
    expect(lahsaFromDiscovery).toBeDefined();
    expect(lahsaFromDiscovery?.contactChannel).not.toContain('cocinfo@lahsa.org');
    expect(lahsaFromDiscovery?.contactChannel).toBe('NOFA@lahsa.org');
  });

  it('Requirement 2 & 3: NOFA@lahsa.org is used for grant inquiries, LACoCBoard@lahsa.org for membership inquiries', async () => {
    expect(lahsaCandidate).toBeDefined();

    // Test grant competition briefing
    const grantBriefing = await OutreachBriefingService.generatePartnerBriefingPacket(
      lahsaCandidate.id,
      oppCoC.id,
      'GRANT_COMPETITION'
    );
    expect(grantBriefing.draftInquiryEmail.to).toBe('NOFA@lahsa.org');

    // Test governance / membership briefing
    const boardBriefing = await OutreachBriefingService.generatePartnerBriefingPacket(
      lahsaCandidate.id,
      oppCoC.id,
      'GOVERNANCE_MEMBERSHIP'
    );
    expect(boardBriefing.draftInquiryEmail.to).toBe('LACoCBoard@lahsa.org');
  });

  it('Requirement 4 & 5: Structured contact metadata exists and unsupported contacts fail closed', async () => {
    // Check structured contacts on LAHSA candidate
    const channels = await prisma.partnerContactChannel.findMany({
      where: { strategicPartnerCandidateId: lahsaCandidate.id },
    });
    expect(channels.length).toBeGreaterThanOrEqual(3);

    const nofaChan = channels.find((c) => c.contactValue === 'NOFA@lahsa.org');
    expect(nofaChan).toBeDefined();
    expect(nofaChan?.purpose).toContain('FY2026 CoC competition');
    expect(nofaChan?.sourceUrl).toBe('https://www.lahsa.org/news?article=1068-fy-2026-coc-program-nofo');
    expect(nofaChan?.quotedCitation).toBeDefined();

    // Create unverified partner candidate with no contact
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

    // Must fail closed to [VERIFY OFFICIAL CONTACT CHANNEL]
    expect(unverifiedBriefing.draftInquiryEmail.to).toBe('[VERIFY OFFICIAL CONTACT CHANNEL]');

    // Clean up unverified partner
    await prisma.strategicPartnerCandidate.delete({ where: { id: unverifiedPartner.id } });
  });

  it('Requirement 6: CPD-2600-DC-0025 reports CURRENT-CYCLE STATUS: INVESTIGATE — CONFLICTING OFFICIAL SOURCES', async () => {
    const sanitized = await OpportunityService.getOpportunityById(oppCoC.id);

    expect(sanitized.hasSourceConflict).toBe(true);
    expect(sanitized.currentCycleStatus).toBe('INVESTIGATE — CONFLICTING OFFICIAL SOURCES');
    expect(sanitized.sourceConflictDetails).toBeDefined();
    expect(sanitized.sourceConflictDetails.citations.length).toBeGreaterThanOrEqual(2);

    const urls = sanitized.sourceConflictDetails.citations.map((c: any) => c.sourceUrl);
    expect(urls.some((u: string) => u.includes('grants.gov'))).toBe(true);
    expect(urls.some((u: string) => u.includes('lahsa.org'))).toBe(true);
  });

  it('Requirement 7 & 8: Updated draft email text and zero automated outreach safeguard', async () => {
    const briefing = await OutreachBriefingService.generatePartnerBriefingPacket(
      lahsaCandidate.id,
      oppCoC.id,
      'GRANT_COMPETITION'
    );

    expect(briefing.draftInquiryEmail.bodyText).toContain(
      'We are evaluating this opportunity and seeking guidance regarding its current status, local process, and future participation requirements'
    );
    expect(briefing.draftInquiryEmail.bodyText).not.toContain('We are preparing for the upcoming federal solicitation');
    expect(briefing.safeguardNotice).toContain('HUMAN-CONTROLLED OUTREACH SAFEGUARD');
  });
});
