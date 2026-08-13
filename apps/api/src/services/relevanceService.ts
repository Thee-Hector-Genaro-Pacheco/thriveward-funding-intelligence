import { prisma } from '../lib/prisma';
import { RelevanceStatus } from '@prisma/client';
import { BRIDGE_FORWARD_PROFILE, getProfileHash } from '../config/bridgeForwardProfile';
import { sanitizeHtmlToText } from '@bridge-ai/shared';
import { ExclusionGateEngine } from './exclusionGateEngine';
import { GrantsGovMapper } from '../integrations/grantsGov/grantsGovMapper';

export interface RelevanceResult {
  id: string;
  fundingOpportunityId: string;
  relevanceStatus: RelevanceStatus;
  relevanceScore: number;
  positiveReasons: string[];
  exclusionReasons: string[];
  explanation: string;
  evidenceFields: string[];
  analysisVersion: string;
  profileVersion: string;
  profileHash: string;
  isCurrent: boolean;
  citations: Array<{
    field: string;
    matchedTerm: string;
    contextSnippet: string;
  }>;
}

export class RelevanceService {
  /**
   * Deterministically assesses contextual relevance for a funding opportunity using ExclusionGateEngine.
   */
  static async assessRelevance(fundingOpportunityId: string): Promise<RelevanceResult> {
    const opp = await prisma.fundingOpportunity.findUnique({
      where: { id: fundingOpportunityId },
      include: { snapshots: true },
    });

    if (!opp) {
      throw new Error(`Funding opportunity '${fundingOpportunityId}' not found`);
    }

    const titleText = sanitizeHtmlToText(opp.title);
    const agencyText = sanitizeHtmlToText(opp.fundingAgency);
    const descText = sanitizeHtmlToText(opp.description);
    const programText = sanitizeHtmlToText(opp.program || '');
    const geographyText = sanitizeHtmlToText(opp.geography || '');

    const mapped = GrantsGovMapper.mapDetailToOpportunity({
      id: opp.externalOpportunityId || opp.id,
      opportunityNumber: opp.fundingOpportunityNumber || opp.id,
      opportunityTitle: titleText,
      agencyName: agencyText,
      synopsisDescription: descText,
      description: descText,
      geography: geographyText,
      eligibleApplicants: opp.eligibleApplicantTypes,
    } as any);

    const evalRes = ExclusionGateEngine.evaluateAll(mapped, {
      opportunityNumber: opp.fundingOpportunityNumber,
      opportunityTitle: titleText,
      fundingAgency: agencyText,
      description: descText,
    });

    const positiveReasons: string[] = [];
    const exclusionReasons: string[] = [];
    const citations: Array<{ field: string; matchedTerm: string; contextSnippet: string }> = [];
    const evidenceFieldsSet = new Set<string>(['title', 'description']);

    let score = 0;
    let status: RelevanceStatus = RelevanceStatus.UNKNOWN;
    let explanation = '';

    if (evalRes.isExcluded) {
      status = RelevanceStatus.IRRELEVANT;
      score = 0;
      const reasonKey = evalRes.exclusionReason || 'EXCLUDED_CONTEXTUALLY_IRRELEVANT';
      exclusionReasons.push(reasonKey);
      explanation = evalRes.explanation;
      citations.push({
        field: 'title/description',
        matchedTerm: reasonKey,
        contextSnippet: titleText.slice(0, 150),
      });
    } else if (evalRes.routingStatus === 'FUTURE_OPPORTUNITY' || evalRes.routingStatus === 'PARTNERSHIP_REQUIRED') {
      status = RelevanceStatus.POSSIBLY_RELEVANT;
      score = 40;
      positiveReasons.push(...evalRes.matchedLanes);
      explanation = evalRes.explanation;
      citations.push({
        field: 'title/description',
        matchedTerm: evalRes.matchedLanes.join(', '),
        contextSnippet: descText.slice(0, 150),
      });
    } else {
      status = RelevanceStatus.RELEVANT;
      score = 85;
      positiveReasons.push(...evalRes.matchedLanes);
      explanation = evalRes.explanation;
      citations.push({
        field: 'title/description',
        matchedTerm: evalRes.matchedLanes.join(', '),
        contextSnippet: descText.slice(0, 150),
      });
    }

    const currentProfileHash = getProfileHash();

    // Mark previous relevance as non-current
    await prisma.opportunityRelevance.updateMany({
      where: { fundingOpportunityId, isCurrent: true },
      data: { isCurrent: false },
    });

    // Create new OpportunityRelevance record
    const record = await prisma.opportunityRelevance.create({
      data: {
        fundingOpportunityId,
        relevanceStatus: status,
        relevanceScore: score,
        positiveReasons,
        exclusionReasons,
        explanation,
        evidenceFields: Array.from(evidenceFieldsSet),
        analysisVersion: '1.0',
        profileVersion: BRIDGE_FORWARD_PROFILE.profileVersion,
        profileHash: currentProfileHash,
        isCurrent: true,
        citations: {
          create: citations.map((c) => ({
            field: c.field,
            matchedTerm: c.matchedTerm,
            contextSnippet: c.contextSnippet,
          })),
        },
      },
      include: {
        citations: true,
      },
    });

    // Update pursuit stage from NEW to REVIEWING if currently NEW and not dismissed
    if (opp.pursuitStage === 'NEW' && status !== RelevanceStatus.IRRELEVANT) {
      await prisma.fundingOpportunity.update({
        where: { id: fundingOpportunityId },
        data: { pursuitStage: 'REVIEWING' },
      });
      await prisma.pursuitHistory.create({
        data: {
          fundingOpportunityId,
          fromStage: 'NEW',
          toStage: 'REVIEWING',
          actorId: 'system-relevance-engine',
          notes: 'Automatic transition to REVIEWING upon contextual relevance calculation.',
        },
      });
    }

    return {
      id: record.id,
      fundingOpportunityId: record.fundingOpportunityId,
      relevanceStatus: record.relevanceStatus,
      relevanceScore: record.relevanceScore,
      positiveReasons: record.positiveReasons,
      exclusionReasons: record.exclusionReasons,
      explanation: record.explanation,
      evidenceFields: record.evidenceFields,
      analysisVersion: record.analysisVersion,
      profileVersion: record.profileVersion,
      profileHash: record.profileHash,
      isCurrent: record.isCurrent,
      citations: record.citations,
    };
  }

  /**
   * Retrieves the current relevance record for a funding opportunity.
   */
  static async getRelevance(fundingOpportunityId: string): Promise<RelevanceResult | null> {
    const record = await prisma.opportunityRelevance.findFirst({
      where: { fundingOpportunityId, isCurrent: true },
      include: { citations: true },
    });

    if (!record) return null;

    return {
      id: record.id,
      fundingOpportunityId: record.fundingOpportunityId,
      relevanceStatus: record.relevanceStatus,
      relevanceScore: record.relevanceScore,
      positiveReasons: record.positiveReasons,
      exclusionReasons: record.exclusionReasons,
      explanation: record.explanation,
      evidenceFields: record.evidenceFields,
      analysisVersion: record.analysisVersion,
      profileVersion: record.profileVersion,
      profileHash: record.profileHash,
      isCurrent: record.isCurrent,
      citations: record.citations,
    };
  }
}
