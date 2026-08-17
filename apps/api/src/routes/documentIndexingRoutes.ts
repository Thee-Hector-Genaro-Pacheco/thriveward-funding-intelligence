import { Router, Request, Response } from 'express';
import { requireAuth, requireRole } from '../middleware/authMiddleware';
import { requireDocumentGroundingEnabled } from '../middleware/documentGroundingGuard';
import { DocumentIndexingService } from '../services/documentIndexingService';

export const documentIndexingRouter = Router();

/**
 * POST /api/document-versions/:documentVersionId/index
 * Initiates page-bounded chunking and embedding indexing for a READY document version.
 * Restricted to ADMIN and OPERATOR roles.
 */
documentIndexingRouter.post(
  '/document-versions/:documentVersionId/index',
  requireAuth,
  requireRole(['ADMIN', 'OPERATOR']),
  requireDocumentGroundingEnabled,
  async (req: Request, res: Response) => {
    try {
      const documentVersionId = req.params.documentVersionId;
      const userId = req.user!.id;
      const idempotencyKey = (req.headers['x-idempotency-key'] as string) || req.body?.idempotencyKey;

      const indexRecord = await DocumentIndexingService.indexDocumentVersion({
        documentVersionId,
        userId,
        idempotencyKey,
      });

      return res.status(201).json({
        success: true,
        data: indexRecord,
      });
    } catch (err: any) {
      const msg = err.message || 'Failed to index document version';

      if (msg.includes('AI_DOCUMENT_GROUNDING_NOT_CONFIGURED')) {
        return res.status(503).json({ success: false, error: msg });
      }

      if (msg.includes('IDEMPOTENCY_KEY_REUSED')) {
        return res.status(409).json({ success: false, error: msg });
      }

      if (msg.includes('DOCUMENT_VERSION_NOT_FOUND')) {
        return res.status(404).json({ success: false, error: msg });
      }

      if (msg.includes('DOCUMENT_VERSION_NOT_READY') || msg.includes('DOCUMENT_PAGES_EMPTY')) {
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
 * GET /api/document-versions/:documentVersionId/index-status
 * Retrieves status of the latest index for a given document version.
 * Mutation-free, accessible to all authenticated roles (including VIEWER).
 */
documentIndexingRouter.get(
  '/document-versions/:documentVersionId/index-status',
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const documentVersionId = req.params.documentVersionId;
      const statusResult = await DocumentIndexingService.getIndexStatus(documentVersionId);

      return res.status(200).json({
        success: true,
        data: statusResult,
      });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        error: err.message || 'Failed to retrieve document index status',
      });
    }
  }
);

/**
 * GET /api/document-indexes/:documentIndexId/chunks
 * Retrieves chunks for a given READY document index.
 * Accessible to all authenticated roles (including VIEWER).
 */
documentIndexingRouter.get(
  '/document-indexes/:documentIndexId/chunks',
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const documentIndexId = req.params.documentIndexId;
      const result = await DocumentIndexingService.getIndexChunks(documentIndexId);

      return res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err: any) {
      const msg = err.message || 'Failed to retrieve index chunks';

      if (msg.includes('DOCUMENT_INDEX_NOT_FOUND')) {
        return res.status(404).json({ success: false, error: msg });
      }

      return res.status(500).json({
        success: false,
        error: msg,
      });
    }
  }
);
