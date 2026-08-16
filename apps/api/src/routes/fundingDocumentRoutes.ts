import { Router, Request, Response } from 'express';
import multer from 'multer';
import { DocumentType } from '@prisma/client';
import { DocumentIngestionService } from '../services/documents/documentIngestionService';
import { requireAuth, requireRole, csrfProtection } from '../middleware/authMiddleware';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: Number(process.env.DOCUMENT_MAX_FILE_BYTES) || 26214400, // 25MB
    files: 1,
  },
});

export const fundingDocumentRouter = Router();

// In-flight upload rate limit map (user ID -> timestamp of last upload)
const uploadRateLimitMap = new Map<string, number>();

// POST /api/opportunities/:opportunityId/funding-documents (Upload PDF)
fundingDocumentRouter.post(
  '/api/opportunities/:opportunityId/funding-documents',
  requireAuth,
  csrfProtection,
  requireRole(['ADMIN', 'OPERATOR']),
  upload.single('file'),

  async (req: Request, res: Response) => {
    try {
      const { opportunityId } = req.params;
      const { title, documentType, officialSourceUrl } = req.body;
      const file = req.file;

      if (!file) {
        return res.status(400).json({ success: false, error: 'FILE_REQUIRED: No file was uploaded' });
      }

      if (!title || typeof title !== 'string' || title.trim().length === 0) {
        return res.status(400).json({ success: false, error: 'TITLE_REQUIRED: Document title is required' });
      }

      // Rate limit check (1 upload per 2 seconds per user in production)
      const isTestEnv = process.env.VITEST === 'true' || process.env.NODE_ENV === 'test';
      const userId = (req as any).user?.id || 'anonymous';
      const lastUpload = uploadRateLimitMap.get(userId) || 0;
      const now = Date.now();
      if (!isTestEnv && now - lastUpload < 2000) {
        return res.status(429).json({ success: false, error: 'RATE_LIMIT_EXCEEDED: Upload rate limit exceeded. Please wait a moment.' });
      }
      uploadRateLimitMap.set(userId, now);


      let parsedDocType: DocumentType = DocumentType.OFFICIAL_NOTICE;
      if (documentType && Object.values(DocumentType).includes(documentType as DocumentType)) {
        parsedDocType = documentType as DocumentType;
      }

      const result = await DocumentIngestionService.ingestDocument({
        opportunityId,
        documentType: parsedDocType,
        title: title.trim(),
        officialSourceUrl: officialSourceUrl ? String(officialSourceUrl).trim() : undefined,
        originalFileName: file.originalname,
        mimeType: file.mimetype,
        bytes: file.buffer,
        userId,
        idempotencyKey: (req.headers['x-idempotency-key'] as string) || undefined,
      });

      return res.status(201).json({
        success: true,
        data: result,
      });
    } catch (err: any) {
      const msg = err.message || 'Upload failed';
      if (msg.startsWith('FEATURE_DISABLED')) {
        return res.status(403).json({ success: false, error: msg });
      }
      if (msg.startsWith('FILE_SIZE_EXCEEDED') || msg.startsWith('MALFORMED_PDF') || msg.startsWith('ENCRYPTED_PDF') || msg.startsWith('PAGE_LIMIT_EXCEEDED')) {
        return res.status(400).json({ success: false, error: msg });
      }
      if (msg.startsWith('NOT_FOUND')) {
        return res.status(404).json({ success: false, error: msg });
      }
      console.error('[DocumentUploadError]', err);
      return res.status(500).json({ success: false, error: msg });
    }
  }
);

// GET /api/opportunities/:opportunityId/funding-documents (List opportunity documents)
fundingDocumentRouter.get(
  '/api/opportunities/:opportunityId/funding-documents',
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const { opportunityId } = req.params;
      const documents = await DocumentIngestionService.getOpportunityDocuments(opportunityId);
      return res.json({ success: true, data: documents });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }
);

// GET /api/funding-documents/:documentId (Get document details)
fundingDocumentRouter.get(
  '/api/funding-documents/:documentId',
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const { documentId } = req.params;
      const document = await DocumentIngestionService.getDocumentWithVersions(documentId);
      if (!document) {
        return res.status(404).json({ success: false, error: `Document '${documentId}' not found` });
      }
      return res.json({ success: true, data: document });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }
);

// GET /api/funding-document-versions/:versionId (Get version details)
fundingDocumentRouter.get(
  '/api/funding-document-versions/:versionId',
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const { versionId } = req.params;
      const version = await DocumentIngestionService.getVersionWithPages(versionId);
      if (!version) {
        return res.status(404).json({ success: false, error: `Document version '${versionId}' not found` });
      }
      return res.json({ success: true, data: version });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }
);

// GET /api/funding-document-versions/:versionId/pages (List pages)
fundingDocumentRouter.get(
  '/api/funding-document-versions/:versionId/pages',
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const { versionId } = req.params;
      const version = await DocumentIngestionService.getVersionWithPages(versionId);
      if (!version) {
        return res.status(404).json({ success: false, error: `Document version '${versionId}' not found` });
      }
      return res.json({ success: true, data: version.pages });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }
);

// GET /api/funding-document-versions/:versionId/pages/:pageNumber (Single page text)
fundingDocumentRouter.get(
  '/api/funding-document-versions/:versionId/pages/:pageNumber',
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const { versionId, pageNumber } = req.params;
      const pageNum = parseInt(pageNumber, 10);
      if (isNaN(pageNum) || pageNum < 1) {
        return res.status(400).json({ success: false, error: 'INVALID_PAGE_NUMBER: Page number must be a positive integer' });
      }

      const page = await DocumentIngestionService.getSinglePage(versionId, pageNum);
      if (!page) {
        return res.status(404).json({ success: false, error: `Page ${pageNum} not found for document version '${versionId}'` });
      }
      return res.json({ success: true, data: page });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }
);

// GET /api/funding-document-versions/:versionId/download (Download original PDF)
fundingDocumentRouter.get(
  '/api/funding-document-versions/:versionId/download',
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const { versionId } = req.params;
      const { buffer, fileName } = await DocumentIngestionService.readDocumentBytes(versionId);

      const safeFileName = fileName.replace(/"/g, '\\"');
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${safeFileName}"`);
      res.setHeader('X-Content-Type-Options', 'nosniff');
      return res.send(buffer);
    } catch (err: any) {
      if (err.message?.startsWith('NOT_FOUND')) {
        return res.status(404).json({ success: false, error: err.message });
      }
      return res.status(500).json({ success: false, error: err.message });
    }
  }
);
