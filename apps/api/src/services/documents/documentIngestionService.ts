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

    const { opportunityId, title, officialSourceUrl, originalFileName, mimeType, bytes, userId, idempotencyKey } = params;
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

    // Compute document payload SHA-256
    const fileHash = crypto.createHash('sha256').update(bytes).digest('hex');

    // Handle persistent idempotency key check if provided
    let idempotencyRecord: any = null;
    if (idempotencyKey && idempotencyKey.trim().length > 0) {
      const cleanKey = idempotencyKey.trim();
      const existingIdempotency = await prisma.fundingDocumentIdempotency.findUnique({
        where: {
          opportunityId_idempotencyKey: {
            opportunityId,
            idempotencyKey: cleanKey,
          },
        },
      });

      if (existingIdempotency) {
        if (existingIdempotency.payloadSha256 !== fileHash) {
          throw new Error(`IDEMPOTENCY_KEY_REUSED: Idempotency key '${cleanKey}' was previously used with a different payload SHA-256`);
        }

        if (existingIdempotency.resultingVersionId) {
          const version = await prisma.fundingDocumentVersion.findUnique({
            where: { id: existingIdempotency.resultingVersionId },
            include: { pages: true, fundingDocument: true },
          });
          if (version) {
            return {
              document: version.fundingDocument,
              version,
              isDuplicate: true,
            };
          }
        }
      } else {
        try {
          idempotencyRecord = await prisma.fundingDocumentIdempotency.create({
            data: {
              opportunityId,
              idempotencyKey: cleanKey,
              authenticatedUserId: userId,
              documentTitle: title.trim(),
              payloadSha256: fileHash,
              status: 'PROCESSING',
            },
          });
        } catch (err: any) {
          // Concurrent request with same idempotency key race check
          const raced = await prisma.fundingDocumentIdempotency.findUnique({
            where: {
              opportunityId_idempotencyKey: {
                opportunityId,
                idempotencyKey: cleanKey,
              },
            },
          });
          if (raced && raced.payloadSha256 !== fileHash) {
            throw new Error(`IDEMPOTENCY_KEY_REUSED: Idempotency key '${cleanKey}' was previously used with a different payload SHA-256`);
          }
        }
      }
    }

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
      if (idempotencyRecord) {
        await prisma.fundingDocumentIdempotency.update({
          where: { id: idempotencyRecord.id },
          data: {
            resultingDocumentId: document.id,
            resultingVersionId: existingVersion.id,
            status: 'COMPLETED',
            completedAt: new Date(),
          },
        }).catch(() => {});
      }

      return {
        document,
        version: existingVersion,
        isDuplicate: true,
      };
    }

    // Determine next version number using transactional advisory lock logic
    const nextVersionNum = await prisma.$transaction(async (tx) => {
      const maxVersionRow = await tx.fundingDocumentVersion.aggregate({
        where: { fundingDocumentId: document!.id },
        _max: { version: true },
      });
      return (maxVersionRow._max.version || 0) + 1;
    });

    // Generate storage key
    const storageKey = `funding-documents/${opportunityId}/${document.id}/v${nextVersionNum}-${fileHash.substring(0, 12)}.pdf`;

    // Save PDF bytes to storage first
    await DocumentIngestionService.storageProvider.save(storageKey, bytes);

    // Create version record and upload audit event inside database transaction
    let versionRecord: any;
    try {
      versionRecord = await prisma.$transaction(async (tx) => {
        const ver = await tx.fundingDocumentVersion.create({
          data: {
            fundingDocumentId: document!.id,
            version: nextVersionNum,
            status: DocumentVersionStatus.PROCESSING,
            originalFileName: cleanFileName,
            mimeType: mimeType || 'application/pdf',
            sizeBytes: bytes.length,
            sha256: fileHash,
            storageKey,
            pageCount: 0,
            extractionVersion: process.env.DOCUMENT_EXTRACTION_VERSION || 'pdf-page-text-v1',
            uploadedByUserId: userId,
          },
        });

        // Fail-closed transactional upload audit event
        await tx.securityAuditEvent.create({
          data: {
            userId,
            eventType: 'FUNDING_DOCUMENT_UPLOADED',
            details: JSON.stringify({
              opportunityId,
              documentId: document!.id,
              versionId: ver.id,
              version: nextVersionNum,
              sha256: fileHash,
              sizeBytes: bytes.length,
              originalFileName: cleanFileName,
            }),
          },
        });

        return ver;
      });
    } catch (dbErr: any) {
      // If DB reservation or upload audit fails, attempt storage cleanup
      try {
        await DocumentIngestionService.storageProvider.delete(storageKey);
      } catch (_) {}
      throw new Error(`DOCUMENT_INGESTION_FAILED: Database reservation or audit logging failed: ${dbErr.message}`);
    }

    // Extract PDF text using worker thread
    try {
      const extractionResult = await PdfExtractionService.extractPageText(bytes, versionRecord.id);

      const finalStatus = extractionResult.status === 'OCR_REQUIRED'
        ? DocumentVersionStatus.OCR_REQUIRED
        : DocumentVersionStatus.READY;

      const auditEventType = finalStatus === DocumentVersionStatus.OCR_REQUIRED
        ? 'FUNDING_DOCUMENT_OCR_REQUIRED'
        : 'FUNDING_DOCUMENT_EXTRACTION_COMPLETED';

      // Transactionally commit extracted pages, update version status, and log audit event fail-closed
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

        // Fail-closed transactional completion audit event
        await tx.securityAuditEvent.create({
          data: {
            userId,
            eventType: auditEventType,
            details: JSON.stringify({
              opportunityId,
              documentId: document!.id,
              versionId: versionRecord.id,
              status: finalStatus,
              pageCount: extractionResult.pageCount,
              extractionVersion: extractionResult.extractionVersion,
            }),
          },
        });

        if (idempotencyRecord) {
          await tx.fundingDocumentIdempotency.update({
            where: { id: idempotencyRecord.id },
            data: {
              resultingDocumentId: document!.id,
              resultingVersionId: versionRecord.id,
              status: 'COMPLETED',
              completedAt: new Date(),
            },
          });
        }
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
      // Failed extraction path: transactionally update status to FAILED and log failure audit event
      await prisma.$transaction(async (tx) => {
        await tx.fundingDocumentVersion.update({
          where: { id: versionRecord.id },
          data: {
            status: DocumentVersionStatus.FAILED,
            failureCode: extractError.message?.split(':')[0] || 'EXTRACTION_FAILED',
            failureMessage: extractError.message || 'Failed to extract text from PDF',
            processedAt: new Date(),
          },
        });

        await tx.securityAuditEvent.create({
          data: {
            userId,
            eventType: 'FUNDING_DOCUMENT_EXTRACTION_FAILED',
            details: JSON.stringify({
              opportunityId,
              documentId: document!.id,
              versionId: versionRecord.id,
              error: extractError.message,
            }),
          },
        });

        if (idempotencyRecord) {
          await tx.fundingDocumentIdempotency.update({
            where: { id: idempotencyRecord.id },
            data: {
              status: 'FAILED',
              completedAt: new Date(),
            },
          });
        }
      }).catch(() => {});

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
