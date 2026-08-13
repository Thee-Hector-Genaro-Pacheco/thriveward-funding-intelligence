import { prisma } from '../lib/prisma';
import { PursuitStage } from '@prisma/client';

export interface TransitionPursuitParams {
  fundingOpportunityId: string;
  targetStage: PursuitStage;
  reviewerId: string;
  notes?: string;
  reason?: string;
  authHeader?: string;
}

export interface PursuitHistoryRecord {
  id: string;
  fundingOpportunityId: string;
  fromStage: PursuitStage;
  toStage: PursuitStage;
  actorId: string;
  notes: string | null;
  reason: string | null;
  createdAt: Date;
}

export class PursuitService {
  /**
   * Validates authorization bearer token.
   */
  private static validateAuthorization(authHeader?: string): void {
    const configuredToken = process.env.BRIDGE_REVIEW_TOKEN;
    if (!configuredToken || configuredToken.trim() === '') {
      throw new Error('UNAUTHORIZED: Review token not configured on server');
    }

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new Error('UNAUTHORIZED: Missing or malformed Authorization header');
    }

    const token = authHeader.replace(/^Bearer\s+/, '').trim();
    if (token !== configuredToken.trim()) {
      throw new Error('UNAUTHORIZED: Invalid review token credential');
    }
  }

  /**
   * Atomically transitions pursuit stage and appends an immutable PursuitHistory record.
   */
  static async transitionStage(params: TransitionPursuitParams) {
    this.validateAuthorization(params.authHeader);

    if (!params.reviewerId || params.reviewerId.trim() === '') {
      throw new Error('Reviewer ID is required for pursuit stage transition');
    }

    const opp = await prisma.fundingOpportunity.findUnique({
      where: { id: params.fundingOpportunityId },
      include: {
        relevanceAnalyses: { where: { isCurrent: true } },
        opportunityAnalyses: { where: { isCurrent: true } },
      },
    });

    if (!opp) {
      throw new Error(`Funding opportunity '${params.fundingOpportunityId}' not found`);
    }

    const currentStage = opp.pursuitStage;
    const targetStage = params.targetStage;

    const currentRelevance = opp.relevanceAnalyses[0];
    const currentAnalysis = opp.opportunityAnalyses[0];

    const isIrrelevant = currentRelevance?.relevanceStatus === 'IRRELEVANT';
    const isNotEligible =
      currentAnalysis?.eligibilityDecision === 'NOT_ELIGIBLE' ||
      currentAnalysis?.eligibilityStatus === 'NOT_ELIGIBLE';

    const isDismissedOrRouted = Boolean(
      (opp.candidateRoutingStatus && opp.candidateRoutingStatus !== 'DIRECT_FEDERAL_ELIGIBLE') ||
        (opp.dismissedReason &&
          (opp.dismissedReason.startsWith('EXCLUDED') ||
            opp.dismissedReason.startsWith('FUTURE_OPPORTUNITY') ||
            opp.dismissedReason.startsWith('PARTNERSHIP_REQUIRED') ||
            opp.dismissedReason.startsWith('FISCAL_SPONSOR_REQUIRED')))
    );

    // Action Gate 1: Mark Qualified
    if (targetStage === 'QUALIFIED') {
      if (isIrrelevant || isNotEligible || isDismissedOrRouted) {
        throw new Error('Opportunity is not currently eligible to apply directly (PRE_INCORPORATION / non-actionable routing) and cannot be marked QUALIFIED');
      }
    }

    // Action Gate 2: Lock Match
    if (targetStage === 'LOCKED') {
      if (isIrrelevant || isNotEligible || isDismissedOrRouted) {
        throw new Error('Opportunity is not currently eligible to apply directly (PRE_INCORPORATION / non-actionable routing) and cannot be marked LOCKED');
      }
      if (currentStage !== 'QUALIFIED' && currentStage !== 'LOCKED') {
        throw new Error('Opportunity must be in QUALIFIED pursuit stage before locking match');
      }
    }

    // Validate Dismissed reason rule
    if (targetStage === 'DISMISSED') {
      if (!params.reason || params.reason.trim() === '') {
        throw new Error('Dismissal requires a non-empty explanatory reason');
      }
    }

    // Execute atomic transaction
    return await prisma.$transaction(async (tx) => {
      const updatedOpp = await tx.fundingOpportunity.update({
        where: { id: params.fundingOpportunityId },
        data: {
          pursuitStage: targetStage,
          dismissedReason: targetStage === 'DISMISSED' ? params.reason?.trim() : targetStage === 'QUALIFIED' || targetStage === 'LOCKED' ? null : opp.dismissedReason,
        },
      });

      const historyRecord = await tx.pursuitHistory.create({
        data: {
          fundingOpportunityId: params.fundingOpportunityId,
          fromStage: currentStage,
          toStage: targetStage,
          actorId: params.reviewerId.trim(),
          notes: params.notes?.trim() || null,
          reason: params.reason?.trim() || null,
        },
      });

      return {
        opportunity: updatedOpp,
        transition: historyRecord,
      };
    });
  }

  /**
   * Retrieves complete, append-only pursuit history for an opportunity.
   */
  static async getHistory(fundingOpportunityId: string): Promise<PursuitHistoryRecord[]> {
    const opp = await prisma.fundingOpportunity.findUnique({
      where: { id: fundingOpportunityId },
    });

    if (!opp) {
      throw new Error(`Funding opportunity '${fundingOpportunityId}' not found`);
    }

    return await prisma.pursuitHistory.findMany({
      where: { fundingOpportunityId },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * Retrieves locked matches with refresh warning indicator if profile or source hash has changed.
   */
  static async getLockedMatches() {
    const lockedOpps = await prisma.fundingOpportunity.findMany({
      where: { pursuitStage: 'LOCKED' },
      include: {
        opportunityAnalyses: {
          where: { isCurrent: true },
        },
        relevanceAnalyses: {
          where: { isCurrent: true },
        },
        snapshots: {
          orderBy: { retrievalTimestamp: 'desc' },
          take: 1,
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return lockedOpps.map((opp) => {
      const currentAnalysis = opp.opportunityAnalyses[0];
      const currentRelevance = opp.relevanceAnalyses[0];

      // Check stale status
      let isStale = false;
      let staleReason: string | null = null;

      if (currentAnalysis) {
        if (currentAnalysis.profileVersion !== '1.1.1-phase1d') {
          isStale = true;
          staleReason = 'Organization profile version changed since lock';
        }
      }

      return {
        ...opp,
        isStale,
        staleReason,
        currentAnalysis: currentAnalysis || null,
        currentRelevance: currentRelevance || null,
      };
    });
  }
}
