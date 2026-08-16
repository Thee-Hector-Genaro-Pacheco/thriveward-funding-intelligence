import crypto from 'crypto';
import { prisma } from '../../lib/prisma';
import { DocumentType, DocumentVersionStatus } from '@prisma/client';
import { FundingDocumentStorage, LocalDockerDocumentStorage } from './fundingDocumentStorage';
import { PdfExtractionService } from './pdfExtractionService';
import { AuthService } from '../authService';

export interface IngestDocumentParams {
  opportunityId: string;
  documentType?: DocumentType;
  title: string;
  officialSourceUrl?: string;
  originalFileName: string;
  mimeType: string;
  bytes: Buffer;
  userId: string;
  idempotencyKey?: string;
}

export class DocumentIngestionService {
  private static storageProvider: FundingDocumentStorage = new LocalDockerDocumentStorage();

  public static setStorageProvider(provider: FundingDocumentStorage): void {
    DocumentIngestionService.storageProvider = provider;
  }

  public static resetStorageProvider(): void {
    DocumentIngestionService.storageProvider = new LocalDockerDocumentStorage();
  }

  public static isIngestionEnabled(): boolean {
    const val = process.env.DOCUMENT_INGESTION_ENABLED;
    return val === 'true' || val === '1';
  }

  public static sanitizeFileName(fileName: string): string {
    const basename = fileName.replace(/^.*[\\\/]/, '');
    return basename.replace(/[^a-zA-Z0-9_\-\.\s]/g, '_').trim().substring(0, 255) || 'document.pdf';
  }

  public static async ingestDocument(params: IngestDocumentParams) {
    if (!DocumentIngestionService.isIngestionEnabled()) {
      throw new Error('FEATURE_DISABLED: Document ingestion is disabled on this server');
    }

    const { opportunityId, title, officialSourceUrl, originalFileName, mimeType, bytes, userId } = params;
    const documentType = params.documentType || DocumentType.OFFICIAL_NOTICE;

    const maxBytes = Number(process.env.DOCUMENT_MAX_FILE_BYTES) || 26214400; // 25MB
    if (!bytes || bytes.length > maxBytes) {
      throw new Error(`FILE_SIZE_EXCEEDED: Document size (${bytes?.length || 0} bytes) exceeds maximum limit of ${maxBytes} bytes`);
    }

    // Sanitize filename
    const cleanFileName = DocumentIngestionService.sanitizeFileName(originalFileName);

    // Validate opportunity existence
    const opportunity = await prisma.fundingOpportunity.findUnique({
      where: { id: opportunityId },
    });
    if (!opportunity) {
      throw new Error(`NOT_FOUND: Funding opportunity '${opportunityId}' does not exist`);
    }

    // Compute document SHA-256
    const fileHash = crypto.createHash('sha256').update(bytes).digest('hex');

    // Find or create FundingDocument row
    let document = await prisma.fundingDocument.findFirst({
      where: {
        fundingOpportunityId: opportunityId,
        documentType,
        title: title.trim(),
      },
    });

    if (!document) {
      document = await prisma.fundingDocument.create({
        data: {
          fundingOpportunityId: opportunityId,
          documentType,
          title: title.trim(),
          officialSourceUrl: officialSourceUrl?.trim() || null,
        },
      });
    }

    // Check if an identical content version already exists for this document
    const existingVersion = await prisma.fundingDocumentVersion.findFirst({
      where: {
        fundingDocumentId: document.id,
        sha256: fileHash,
      },
      include: { pages: true },
    });

    if (existingVersion && existingVersion.status === DocumentVersionStatus.READY) {
      return {
        document,
        version: existingVersion,
        isDuplicate: true,
      };
    }

    // Determine next version number
    const maxVersionRow = await prisma.fundingDocumentVersion.aggregate({
      where: { fundingDocumentId: document.id },
      _max: { version: true },
    });
    const nextVersionNum = (maxVersionRow._max.version || 0) + 1;

    // Generate storage key
    const storageKey = `funding-documents/${opportunityId}/${document.id}/v${nextVersionNum}-${fileHash.substring(0, 12)}.pdf`;

    // Create database version record in UPLOADED status
    const versionRecord = await prisma.fundingDocumentVersion.create({
      data: {
        fundingDocumentId: document.id,
        version: nextVersionNum,
        status: DocumentVersionStatus.PROCESSING,
        originalFileName: cleanFileName,
        mimeType: mimeType || 'application/pdf',
        sizeBytes: bytes.length,
        sha256: fileHash,
        storageKey,
        pageCount: 0,
        extractionVersion: PdfExtractionService.EXTRACTION_VERSION,
        uploadedByUserId: userId,
      },
    });

    // Log upload security audit event
    await AuthService.logSecurityEvent({
      userId,
      eventType: 'FUNDING_DOCUMENT_UPLOADED',
      details: JSON.stringify({
        opportunityId,
        documentId: document.id,
        versionId: versionRecord.id,
        version: nextVersionNum,
        sha256: fileHash,
        sizeBytes: bytes.length,
        originalFileName: cleanFileName,
      }),
    });

    // Save PDF bytes to storage
    await DocumentIngestionService.storageProvider.save({
      storageKey,
      bytes,
    });

    // Extract PDF text
    try {
      const extractionResult = await PdfExtractionService.extractPageText({
        documentVersionId: versionRecord.id,
        buffer: bytes,
      });

      const finalStatus = extractionResult.status === 'OCR_REQUIRED'
        ? DocumentVersionStatus.OCR_REQUIRED
        : DocumentVersionStatus.READY;

      // Save extracted pages atomically
      await prisma.$transaction(async (tx) => {
        if (extractionResult.pages.length > 0) {
          await tx.fundingDocumentPage.createMany({
            data: extractionResult.pages.map((p) => ({
              documentVersionId: versionRecord.id,
              pageNumber: p.pageNumber,
              text: p.text,
              textHash: p.textHash,
              characterCount: p.characterCount,
              citationRef: p.citationRef,
            })),
          });
        }

        await tx.fundingDocumentVersion.update({
          where: { id: versionRecord.id },
          data: {
            status: finalStatus,
            pageCount: extractionResult.pageCount,
            processedAt: new Date(),
          },
        });
      });

      // Audit event based on extraction outcome
      const auditEventType = finalStatus === DocumentVersionStatus.OCR_REQUIRED
        ? 'FUNDING_DOCUMENT_OCR_REQUIRED'
        : 'FUNDING_DOCUMENT_EXTRACTION_COMPLETED';

      await AuthService.logSecurityEvent({
        userId,
        eventType: auditEventType,
        details: JSON.stringify({
          opportunityId,
          documentId: document.id,
          versionId: versionRecord.id,
          status: finalStatus,
          pageCount: extractionResult.pageCount,
          extractionVersion: extractionResult.extractionVersion,
        }),
      });

      const updatedVersion = await prisma.fundingDocumentVersion.findUnique({
        where: { id: versionRecord.id },
        include: { pages: true },
      });

      return {
        document,
        version: updatedVersion!,
        isDuplicate: false,
      };
    } catch (extractError: any) {
      // Failed extraction path
      await prisma.fundingDocumentVersion.update({
        where: { id: versionRecord.id },
        data: {
          status: DocumentVersionStatus.FAILED,
          failureCode: extractError.message?.split(':')[0] || 'EXTRACTION_FAILED',
          failureMessage: extractError.message || 'Failed to extract text from PDF',
          processedAt: new Date(),
        },
      });

      await AuthService.logSecurityEvent({
        userId,
        eventType: 'FUNDING_DOCUMENT_EXTRACTION_FAILED',
        details: JSON.stringify({
          opportunityId,
          documentId: document.id,
          versionId: versionRecord.id,
          error: extractError.message,
        }),
      });

      throw extractError;
    }
  }

  public static async getDocumentWithVersions(documentId: string) {
    return prisma.fundingDocument.findUnique({
      where: { id: documentId },
      include: {
        versions: {
          orderBy: { version: 'desc' },
          include: {
            uploadedByUser: {
              select: { id: true, displayName: true, email: true, role: true },
            },
          },
        },
      },
    });
  }

  public static async getOpportunityDocuments(opportunityId: string) {
    return prisma.fundingDocument.findMany({
      where: { fundingOpportunityId: opportunityId },
      orderBy: { createdAt: 'desc' },
      include: {
        versions: {
          orderBy: { version: 'desc' },
          include: {
            uploadedByUser: {
              select: { id: true, displayName: true, email: true, role: true },
            },
          },
        },
      },
    });
  }

  public static async getVersionWithPages(versionId: string) {
    return prisma.fundingDocumentVersion.findUnique({
      where: { id: versionId },
      include: {
        fundingDocument: true,
        uploadedByUser: {
          select: { id: true, displayName: true, email: true, role: true },
        },
        pages: {
          orderBy: { pageNumber: 'asc' },
        },
      },
    });
  }

  public static async getSinglePage(versionId: string, pageNumber: number) {
    return prisma.fundingDocumentPage.findUnique({
      where: {
        documentVersionId_pageNumber: {
          documentVersionId: versionId,
          pageNumber,
        },
      },
      include: {
        documentVersion: {
          include: { fundingDocument: true },
        },
      },
    });
  }

  public static async readDocumentBytes(versionId: string): Promise<{ buffer: Buffer; fileName: string; mimeType: string }> {
    const version = await prisma.fundingDocumentVersion.findUnique({
      where: { id: versionId },
    });
    if (!version) {
      throw new Error(`NOT_FOUND: Document version '${versionId}' not found`);
    }

    const buffer = await DocumentIngestionService.storageProvider.read(version.storageKey);
    return {
      buffer,
      fileName: version.originalFileName,
      mimeType: version.mimeType,
    };
  }
}
