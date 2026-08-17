import { Router, Request, Response } from 'express';
import { requireAuth, requireRole } from '../middleware/authMiddleware';
import { AiFundingAnalystService } from '../services/aiFundingAnalystService';

export const aiEvaluationRouter = Router();

/**
 * POST /api/opportunities/:opportunityId/ai-evaluations
 * Generates a versioned AI Evaluation for a funding opportunity.
 * Restricted to ADMIN and OPERATOR roles.
 */
aiEvaluationRouter.post(
  '/opportunities/:opportunityId/ai-evaluations',
  requireAuth,
  requireRole(['ADMIN', 'OPERATOR']),
  async (req: Request, res: Response) => {
    try {
      const opportunityId = req.params.opportunityId;
      const userId = req.user!.id;
      const idempotencyKey = (req.headers['x-idempotency-key'] as string) || req.body?.idempotencyKey;

      if (!AiFundingAnalystService.isConfigured()) {
        return res.status(503).json({
          success: false,
          error: 'AI_ANALYST_NOT_CONFIGURED: AI Funding Analyst service is disabled or OPENAI_API_KEY is not configured.',
        });
      }

      const evaluation = await AiFundingAnalystService.generateEvaluation({
        opportunityId,
        userId,
        idempotencyKey,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      });

      return res.status(201).json({
        success: true,
        data: evaluation,
      });
    } catch (err: any) {
      const msg = err.message || 'Failed to generate AI evaluation';

      if (msg.includes('AI_ANALYST_NOT_CONFIGURED')) {
        return res.status(503).json({ success: false, error: msg });
      }

      if (msg.includes('RATE_LIMIT_EXCEEDED')) {
        return res.status(429).json({ success: false, error: msg });
      }

      if (msg.includes('Funding opportunity not found')) {
        return res.status(404).json({ success: false, error: msg });
      }

      if (msg.includes('OpenAI Provider Refusal') || msg.includes('cited invalid evidence reference')) {
        return res.status(400).json({ success: false, error: msg });
      }

      return res.status(500).json({
        success: false,
        error: 'An internal error occurred while generating the AI evaluation.',
      });
    }
  }
);

/**
 * GET /api/opportunities/:opportunityId/ai-evaluations
 * Retrieves evaluation history for a funding opportunity (mutation-free).
 * Available to VIEWER, OPERATOR, ADMIN.
 */
aiEvaluationRouter.get(
  '/opportunities/:opportunityId/ai-evaluations',
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const opportunityId = req.params.opportunityId;
      const evaluations = await AiFundingAnalystService.getEvaluationsForOpportunity(opportunityId);

      return res.json({
        success: true,
        data: evaluations,
      });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        error: err.message || 'Failed to fetch AI evaluations',
      });
    }
  }
);

/**
 * POST /api/ai-evaluations/:evaluationId/review
 * Submits an atomic human review (APPROVED or REJECTED) with a required reason.
 * Restricted to ADMIN and OPERATOR roles.
 */
aiEvaluationRouter.post(
  '/ai-evaluations/:evaluationId/review',
  requireAuth,
  requireRole(['ADMIN', 'OPERATOR']),
  async (req: Request, res: Response) => {
    try {
      const evaluationId = req.params.evaluationId;
      const userId = req.user!.id;
      const { decision, reason } = req.body || {};

      if (!decision || !['APPROVED', 'REJECTED'].includes(decision)) {
        return res.status(400).json({
          success: false,
          error: "Decision must be either 'APPROVED' or 'REJECTED'.",
        });
      }

      const updated = await AiFundingAnalystService.reviewEvaluation({
        evaluationId,
        userId,
        decision,
        reason,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      });

      return res.json({
        success: true,
        data: updated,
      });
    } catch (err: any) {
      const msg = err.message || 'Failed to submit AI evaluation review';

      if (msg.includes('AI Evaluation not found')) {
        return res.status(404).json({ success: false, error: msg });
      }

      if (msg.includes('already been reviewed') || msg.includes('minimum 5 characters')) {
        return res.status(400).json({ success: false, error: msg });
      }

      return res.status(500).json({
        success: false,
        error: 'An internal error occurred while submitting the review.',
      });
    }
  }
);

/**
 * POST /api/opportunities/:opportunityId/document-grounded-ai-evaluations
 * Generates a document-grounded AI evaluation based on top-K semantic retrieval evidence.
 * Restricted to ADMIN and OPERATOR roles.
 */
aiEvaluationRouter.post(
  '/opportunities/:opportunityId/document-grounded-ai-evaluations',
  requireAuth,
  requireRole(['ADMIN', 'OPERATOR']),
  async (req: Request, res: Response) => {
    try {
      const opportunityId = req.params.opportunityId;
      const userId = req.user!.id;
      const idempotencyKey = (req.headers['x-idempotency-key'] as string) || req.body?.idempotencyKey;

      const evaluation = await AiFundingAnalystService.generateGroundedEvaluation({
        opportunityId,
        userId,
        idempotencyKey,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
      });

      return res.status(201).json({
        success: true,
        data: evaluation,
      });
    } catch (err: any) {
      const msg = err.message || 'Failed to generate grounded AI evaluation';

      if (msg.includes('AI_DOCUMENT_GROUNDING_NOT_CONFIGURED')) {
        return res.status(503).json({ success: false, error: msg });
      }

      if (msg.includes('DOCUMENT_INDEX_NOT_READY')) {
        return res.status(400).json({ success: false, error: msg });
      }

      if (msg.includes('RATE_LIMIT_EXCEEDED')) {
        return res.status(429).json({ success: false, error: msg });
      }

      if (msg.includes('Funding opportunity not found')) {
        return res.status(404).json({ success: false, error: msg });
      }

      if (
        msg.includes('OpenAI Provider Refusal') ||
        msg.includes('cited invalid evidence reference') ||
        msg.includes('GROUNDED_CITATION_CONSTRAINT_VIOLATION')
      ) {
        return res.status(400).json({ success: false, error: msg });
      }

      return res.status(500).json({
        success: false,
        error: msg,
      });
    }
  }
);

/**
 * GET /api/ai-evaluations/:evaluationId/retrieved-evidence
 * Retrieves exact retrieved evidence snapshot for a document-grounded evaluation.
 * Available to VIEWER, OPERATOR, ADMIN.
 */
aiEvaluationRouter.get(
  '/ai-evaluations/:evaluationId/retrieved-evidence',
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const evaluationId = req.params.evaluationId;
      const evidenceData = await AiFundingAnalystService.getRetrievedEvidenceForEvaluation(evaluationId);

      if (!evidenceData) {
        return res.status(404).json({
          success: false,
          error: `RETRIEVED_EVIDENCE_NOT_FOUND: No retrieved evidence run exists for evaluation '${evaluationId}'.`,
        });
      }

      return res.json({
        success: true,
        data: evidenceData,
      });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        error: err.message || 'Failed to fetch retrieved evidence',
      });
    }
  }
);

