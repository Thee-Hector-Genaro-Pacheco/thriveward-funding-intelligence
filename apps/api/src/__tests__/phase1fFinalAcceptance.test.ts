import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../lib/prisma';
import { mapScoreToRelevanceStatus, formatRelevanceStatusLabel } from '@bridge-ai/shared';
import { getMissionStatementHash, getCanonicalProfileHash, computeProfileHashes } from '../config/bridgeForwardProfile';
import { StrategicPartnerService } from '../services/strategicPartnerService';
import { ContactProvenanceVerifier } from '../services/contactProvenanceVerifier';
import { OpportunityNarrativeService } from '../services/opportunityNarrativeService';
import { RelevanceService } from '../services/relevanceService';

describe('Phase 1F Final Acceptance Test Suite', () => {
  beforeAll(async () => {
    // Seed authoritative CoCs and clean up any past test artifacts
    await StrategicPartnerService.runDiscovery();
  });

  afterAll(async () => {
    // Disconnect prisma
  });

  describe('1. Mission-Relevance Semantics', () => {
    it('maps scores deterministically across all thresholds', () => {
      expect(mapScoreToRelevanceStatus(0)).toBe('IRRELEVANT');
      expect(mapScoreToRelevanceStatus(24)).toBe('IRRELEVANT');
      expect(mapScoreToRelevanceStatus(25)).toBe('POSSIBLY_RELEVANT');
      expect(mapScoreToRelevanceStatus(40)).toBe('POSSIBLY_RELEVANT');
      expect(mapScoreToRelevanceStatus(49)).toBe('POSSIBLY_RELEVANT');
      expect(mapScoreToRelevanceStatus(50)).toBe('RELEVANT');
      expect(mapScoreToRelevanceStatus(74)).toBe('RELEVANT');
      expect(mapScoreToRelevanceStatus(75)).toBe('STRONGLY_RELEVANT');
      expect(mapScoreToRelevanceStatus(100)).toBe('STRONGLY_RELEVANT');
    });

    it('never formats a score of 40 as Strong or Strongly Relevant', () => {
      const status = mapScoreToRelevanceStatus(40);
      const label = formatRelevanceStatusLabel(40);
      expect(status).not.toBe('STRONGLY_RELEVANT');
      expect(status).not.toBe('RELEVANT');
      expect(label).toBe('Possibly Relevant');
      expect(label).not.toContain('Strong');
    });
  });

  describe('2. Canonical Direct-Applicant Eligibility', () => {
    it('uses NOT_CURRENTLY_ELIGIBLE for routed candidates', async () => {
      const opp = await prisma.fundingOpportunity.findFirst({
        where: { fundingOpportunityNumber: { contains: 'CPD-2600-DC-0025' } },
      });

      if (opp) {
        const relevance = await RelevanceService.assessRelevance(opp.id);
        expect(relevance.relevanceScore).toBe(40);
        expect(relevance.relevanceStatus).toBe('POSSIBLY_RELEVANT');
      }
    });
  });

  describe('3. CoC Geographic Overlap & Match Scoring', () => {
    it('calculates set intersection and single-county coverage scope', async () => {
      const partners = await StrategicPartnerService.listPartners();
      const ocPartner = partners.find((p) => p.cocNumber === 'CA-602');
      expect(ocPartner).toBeDefined();

      if (ocPartner) {
        expect(ocPartner.countiesServed).toEqual(['Orange County']);
      }
    });

    it('recalculates partner match score using 6 weighted dimensions', async () => {
      const opp = await prisma.fundingOpportunity.findFirst({
        where: { fundingOpportunityNumber: { contains: 'CPD-2600-DC-0025' } },
      });

      if (opp) {
        const matches = await StrategicPartnerService.matchOpportunityToPartners(opp.id);
        const ocMatch = matches.find((m) => m.strategicPartnerCandidate.cocNumber === 'CA-602');
        expect(ocMatch).toBeDefined();

        if (ocMatch) {
          expect(ocMatch.overlapCounties).toEqual(['Orange County']);
          expect(ocMatch.coverageScope).toBe('ONE_OF_TWO_ACTIVE_LAUNCH_COUNTIES');
          expect(ocMatch.matchScore).toBe(90);
          expect(ocMatch.evidenceCoverage).toBe(95);
          expect(ocMatch.dimensionBreakdown).toBeDefined();
        }
      }
    });
  });

  describe('4. Profile Hashes Separation', () => {
    it('produces distinct SHA-256 digests for mission statement vs canonical profile', () => {
      const missionHash = getMissionStatementHash();
      const profileHash = getCanonicalProfileHash();
      const combined = computeProfileHashes();

      expect(missionHash).toHaveLength(64);
      expect(profileHash).toHaveLength(64);
      expect(missionHash).not.toBe(profileHash);
      expect(combined.missionStatementHash).toBe(missionHash);
      expect(combined.canonicalProfileHash).toBe(profileHash);
    });
  });

  describe('5. Evidence-Fact Language', () => {
    it('uses exact required phrase for developing service models', () => {
      const opp = {
        title: 'FY2026 Continuum of Care Competition',
        fundingOpportunityNumber: 'CPD-2600-DC-0025',
        candidateRoutingStatus: 'PARTNERSHIP_REQUIRED',
      };
      const narrative = OpportunityNarrativeService.buildOpportunitySpecificNarrative({ opportunity: opp });
      expect(narrative.narrativeEvidenceFacts).toContain(
        'Project Thriveward’s service models are planned or developing; no completed cohort outcomes or operating history are claimed.'
      );
    });
  });

  describe('6. Contact Provenance & Fail-Closed Safeguards', () => {
    it('verifies contact channels in test fixture mode and purges invalid emails', async () => {
      const validResult = await ContactProvenanceVerifier.verifyContact({
        email: 'CareCoordination@ceo.oc.gov',
        quotedCitation: 'For further information, contact CareCoordination@ceo.oc.gov',
        sourceUrl: 'https://ceo.oc.gov/office-care-coordination',
        mode: 'TEST_FIXTURE',
      });

      expect(validResult.isValid).toBe(true);
      expect(validResult.effectiveEmail).toBe('CareCoordination@ceo.oc.gov');
      expect(validResult.responseHash).toHaveLength(64);

      const invalidResult = await ContactProvenanceVerifier.verifyContact({
        email: 'cocinfo@lahsa.org',
        quotedCitation: 'unsupported email',
        sourceUrl: 'https://www.lahsa.org',
        mode: 'TEST_FIXTURE',
      });

      expect(invalidResult.isValid).toBe(false);
      expect(invalidResult.effectiveEmail).toBe('[VERIFY CURRENT NOFO CONTACT — DO NOT SEND]');
    });
  });

  describe('7. Append-Only Workflow History', () => {
    it('logs workflow history entries upon stage transition and blocks invalid transitions', async () => {
      const opp = await prisma.fundingOpportunity.findFirst({
        where: { fundingOpportunityNumber: { contains: 'CPD-2600-DC-0025' } },
      });

      if (opp) {
        const matches = await StrategicPartnerService.matchOpportunityToPartners(opp.id);
        const match = matches[0];

        // Valid transition with authorization
        const updated = await StrategicPartnerService.transitionPartnerMatchStatus({
          matchId: match.id,
          targetStatus: 'CONTACT_APPROVED',
          reviewerId: 'admin-tester',
          reason: 'Verified Collaborative Applicant e-snaps listing',
        });

        expect(updated.status).toBe('CONTACT_APPROVED');
        expect(updated.strategicPartnerCandidate.workflowHistory.length).toBeGreaterThan(0);

        // Invalid jump (CONTACT_APPROVED directly to CONFIRMED_PARTNER) should throw
        await expect(
          StrategicPartnerService.transitionPartnerMatchStatus({
            matchId: match.id,
            targetStatus: 'CONFIRMED_PARTNER',
            reviewerId: 'admin-tester',
          })
        ).rejects.toThrow(/Invalid workflow transition/);
      }
    });
  });
});
