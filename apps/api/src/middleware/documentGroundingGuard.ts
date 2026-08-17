import { Request, Response, NextFunction } from 'express';
import { DocumentIndexingService } from '../services/documentIndexingService';

export function requireDocumentGroundingEnabled(
  req: Request,
  res: Response,
  next: NextFunction
) {
  if (!DocumentIndexingService.isGroundingEnabled()) {
    return res.status(503).json({
      success: false,
      error:
        'AI_DOCUMENT_GROUNDING_NOT_CONFIGURED: Document-grounded retrieval and AI analysis service is currently disabled or unconfigured.',
    });
  }
  next();
}
