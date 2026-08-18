import crypto from 'crypto';
import { prisma } from '../lib/prisma';
import { DocumentChunkerService } from './ai/documentChunkerService';
import { DocumentEmbeddingProvider } from './ai/documentEmbeddingProvider';
import { OpenAiDocumentEmbeddingProvider } from './ai/openAiDocumentEmbeddingProvider';

export interface IndexingRequestOptions {
  documentVersionId: string;
  userId: string;
  idempotencyKey?: string;
  provider?: DocumentEmbeddingProvider;
}

export class DocumentIndexingService {
  private static providerOverride: DocumentEmbeddingProvider | null = null;
  private static defaultProvider: OpenAiDocumentEmbeddingProvider = new OpenAiDocumentEmbeddingProvider();

  public static setProvider(provider: DocumentEmbeddingProvider): void {
    DocumentIndexingService.providerOverride = provider;
  }

  public static resetProvider(): void {
    DocumentIndexingService.providerOverride = null;
  }

  public static getActiveProvider(): DocumentEmbeddingProvider {
    return DocumentIndexingService.providerOverride || DocumentIndexingService.defaultProvider;
  }

  public static isGroundingEnabled(): boolean {
    const isEnabled = process.env.AI_DOCUMENT_GROUNDING_ENABLED === 'true';
    if (!isEnabled) return false;
    if (DocumentIndexingService.providerOverride) return true;
    return DocumentIndexingService.defaultProvider.isConfigured();
  }

  /**
   * Main server-authoritative document indexing workflow.
   */
  public static async indexDocumentVersion(options: IndexingRequestOptions) {
    const { documentVersionId, userId, idempotencyKey } = options;

    if (!DocumentIndexingService.isGroundingEnabled()) {
      throw new Error(
        'AI_DOCUMENT_GROUNDING_NOT_CONFIGURED: Document grounding service is disabled or OPENAI_API_KEY is not configured.'
      );
    }

    const provider = options.provider || DocumentIndexingService.getActiveProvider();

    // 1. Verify FundingDocumentVersion exists and status is READY
    const docVer = await prisma.fundingDocumentVersion.findUnique({
      where: { id: documentVersionId },
      include: {
        fundingDocument: {
          include: {
            fundingOpportunity: true,
          },
        },
        pages: {
          orderBy: { pageNumber: 'asc' },
        },
      },
    });

    if (!docVer) {
      throw new Error(`DOCUMENT_VERSION_NOT_FOUND: Document version '${documentVersionId}' was not found.`);
    }

    if (docVer.status !== 'READY') {
      throw new Error(
        `DOCUMENT_VERSION_NOT_READY: Cannot index document version '${documentVersionId}' with status '${docVer.status}'. Must be READY.`
      );
    }

    if (!docVer.pages || docVer.pages.length === 0) {
      throw new Error(`DOCUMENT_PAGES_EMPTY: Document version '${documentVersionId}' contains 0 extracted page records.`);
    }

    // 2. Compute payload hash for idempotency checking
    const payloadHashInput = `DOC_VER:${documentVersionId};PAGES:${docVer.pages.length};SHA:${docVer.sha256}`;
    const payloadHash = crypto.createHash('sha256').update(payloadHashInput).digest('hex');

    // Check durable idempotency if key supplied
    if (idempotencyKey) {
      const existingIdempotency = await prisma.fundingDocumentIndexIdempotency.findUnique({
        where: {
          documentVersionId_idempotencyKey: {
            documentVersionId,
            idempotencyKey,
          },
        },
        include: {
          index: true,
        },
      });

      if (existingIdempotency) {
        if (existingIdempotency.payloadHash !== payloadHash) {
          throw new Error(
            `IDEMPOTENCY_KEY_REUSED: Idempotency key '${idempotencyKey}' was previously used with a different indexing payload.`
          );
        }

        if (existingIdempotency.index && existingIdempotency.index.status === 'READY') {
          return existingIdempotency.index;
        }

        if (existingIdempotency.status === 'PROCESSING') {
          throw new Error(
            `INDEXING_IN_PROGRESS: Indexing operation for document version '${documentVersionId}' with idempotency key '${idempotencyKey}' is currently processing.`
          );
        }
      }
    }

    // 3. Generate deterministic page-bounded chunks
    const chunkInputs = docVer.pages.map((p) => ({
      pageId: p.id,
      pageNumber: p.pageNumber,
      text: p.text,
    }));

    const manifestResult = DocumentChunkerService.generateChunks(
      documentVersionId,
      chunkInputs,
      500, // target tokens
      75 // overlap tokens
    );

    // 4. Check if an identical successful index already exists
    const existingIndex = await prisma.fundingDocumentIndex.findUnique({
      where: {
        documentVersionId_configurationHash: {
          documentVersionId,
          configurationHash: manifestResult.configurationHash,
        },
      },
    });

    if (existingIndex && existingIndex.status === 'READY') {
      if (idempotencyKey) {
        await prisma.fundingDocumentIndexIdempotency.upsert({
          where: {
            documentVersionId_idempotencyKey: {
              documentVersionId,
              idempotencyKey,
            },
          },
          update: {
            indexId: existingIndex.id,
            status: 'COMPLETED',
            completedAt: new Date(),
          },
          create: {
            documentVersionId,
            idempotencyKey,
            payloadHash,
            indexId: existingIndex.id,
            status: 'COMPLETED',
            completedAt: new Date(),
          },
        });
      }
      return existingIndex;
    }

    // Determine next index version number for this documentVersion
    const maxVersionAggregate = await prisma.fundingDocumentIndex.aggregate({
      where: { documentVersionId },
      _max: { version: true },
    });
    const nextVersion = (maxVersionAggregate._max.version || 0) + 1;

    // 5. Create PENDING/PROCESSING FundingDocumentIndex record
    const indexRecord = await prisma.fundingDocumentIndex.create({
      data: {
        documentVersionId,
        version: nextVersion,
        status: 'PROCESSING',
        sourceManifestHash: manifestResult.sourceManifestHash,
        configurationHash: manifestResult.configurationHash,
        chunkingVersion: manifestResult.chunkingVersion,
        embeddingProvider: provider.getProviderName(),
        embeddingModel: process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small',
        embeddingDimensions: 1536,
        pageCount: docVer.pages.length,
        chunkCount: manifestResult.chunks.length,
        inputTokenCount: manifestResult.totalTokenCount,
        indexedByUserId: userId,
        startedAt: new Date(),
      },
    });

    if (idempotencyKey) {
      await prisma.fundingDocumentIndexIdempotency.create({
        data: {
          documentVersionId,
          idempotencyKey,
          payloadHash,
          indexId: indexRecord.id,
          status: 'PROCESSING',
        },
      });
    }

    try {
      // 6. Embed chunks in bounded batches
      const batchSize = Number(process.env.DOCUMENT_EMBEDDING_BATCH_SIZE) || 32;
      const chunks = manifestResult.chunks;
      let totalProviderRequests = 0;

      for (let i = 0; i < chunks.length; i += batchSize) {
        const batch = chunks.slice(i, i + batchSize);
        const batchTexts = batch.map((c) => c.text);

        const embedResult = await provider.embedDocuments({
          texts: batchTexts,
          model: indexRecord.embeddingModel,
          dimensions: indexRecord.embeddingDimensions,
        });

        totalProviderRequests += embedResult.providerRequestCount;

        // Verify result vector count and dimensions
        if (embedResult.vectors.length !== batch.length) {
          throw new Error(
            `EMBEDDING_BATCH_COUNT_MISMATCH: Batch expected ${batch.length} vectors, got ${embedResult.vectors.length}.`
          );
        }

        // Save chunk rows with embeddings using parameterized raw query
        for (let j = 0; j < batch.length; j++) {
          const chunk = batch[j];
          const vector = embedResult.vectors[j];
          const vectorStr = `[${vector.join(',')}]`;
          const chunkId = crypto.randomUUID();

          await prisma.$executeRaw`
            INSERT INTO "FundingDocumentChunk" (
              "id", "documentIndexId", "documentPageId", "pageNumber", "chunkIndex",
              "startOffset", "endOffset", "text", "textHash", "tokenCount", "citationRef", "embedding", "createdAt"
            ) VALUES (
              ${chunkId},
              ${indexRecord.id},
              ${chunk.documentPageId},
              ${chunk.pageNumber},
              ${chunk.chunkIndex},
              ${chunk.startOffset},
              ${chunk.endOffset},
              ${chunk.text},
              ${chunk.textHash},
              ${chunk.tokenCount},
              ${chunk.citationRef},
              ${vectorStr}::vector,
              CURRENT_TIMESTAMP
            )
          `;
        }
      }

      // 7. Transactionally mark index READY and log audit event
      const updatedIndex = await prisma.$transaction(async (tx) => {
        const readyIndex = await tx.fundingDocumentIndex.update({
          where: { id: indexRecord.id },
          data: {
            status: 'READY',
            providerRequestCount: totalProviderRequests,
            completedAt: new Date(),
          },
        });

        if (idempotencyKey) {
          await tx.fundingDocumentIndexIdempotency.update({
            where: {
              documentVersionId_idempotencyKey: {
                documentVersionId,
                idempotencyKey,
              },
            },
            data: {
              status: 'COMPLETED',
              completedAt: new Date(),
            },
          });
        }

        // Fail-closed transactional audit event
        await tx.securityAuditEvent.create({
          data: {
            userId,
            eventType: 'FUNDING_DOCUMENT_INDEXING_COMPLETED',
            details: JSON.stringify({
              documentIndexId: readyIndex.id,
              documentVersionId,
              version: readyIndex.version,
              pageCount: readyIndex.pageCount,
              chunkCount: readyIndex.chunkCount,
              inputTokenCount: readyIndex.inputTokenCount,
              providerRequestCount: totalProviderRequests,
              embeddingProvider: readyIndex.embeddingProvider,
              embeddingModel: readyIndex.embeddingModel,
              embeddingDimensions: readyIndex.embeddingDimensions,
              chunkingVersion: readyIndex.chunkingVersion,
            }),
          },
        });

        return readyIndex;
      });

      return updatedIndex;
    } catch (err: any) {
      // Mark index FAILED
      const failureCode = err.message || 'INDEXING_FAILED';
      await prisma.fundingDocumentIndex.update({
        where: { id: indexRecord.id },
        data: {
          status: 'FAILED',
          failureCode,
          completedAt: new Date(),
        },
      });

      if (idempotencyKey) {
        await prisma.fundingDocumentIndexIdempotency.update({
          where: {
            documentVersionId_idempotencyKey: {
              documentVersionId,
              idempotencyKey,
            },
          },
          data: {
            status: 'FAILED',
            completedAt: new Date(),
          },
        });
      }

      await prisma.securityAuditEvent.create({
        data: {
          userId,
          eventType: 'FUNDING_DOCUMENT_INDEXING_FAILED',
          details: JSON.stringify({
            documentIndexId: indexRecord.id,
            documentVersionId,
            failureCode,
          }),
        },
      });

      throw err;
    }
  }

  /**
   * Retrieves status for a given document version's latest index.
   */
  public static async getIndexStatus(documentVersionId: string) {
    const latestIndex = await prisma.fundingDocumentIndex.findFirst({
      where: { documentVersionId },
      orderBy: { version: 'desc' },
    });

    if (!latestIndex) {
      return {
        indexed: false,
        status: 'NOT_INDEXED',
        index: null,
      };
    }

    return {
      indexed: latestIndex.status === 'READY',
      status: latestIndex.status,
      chunkCount: latestIndex.chunkCount,
      embeddingModel: latestIndex.embeddingModel,
      embeddingDimensions: latestIndex.embeddingDimensions,
      index: {
        id: latestIndex.id,
        documentVersionId: latestIndex.documentVersionId,
        version: latestIndex.version,
        status: latestIndex.status,
        chunkingVersion: latestIndex.chunkingVersion,
        embeddingProvider: latestIndex.embeddingProvider,
        embeddingModel: latestIndex.embeddingModel,
        embeddingDimensions: latestIndex.embeddingDimensions,
        pageCount: latestIndex.pageCount,
        chunkCount: latestIndex.chunkCount,
        inputTokenCount: latestIndex.inputTokenCount,
        createdAt: latestIndex.createdAt,
        completedAt: latestIndex.completedAt,
        failureCode: latestIndex.failureCode,
      },
    };
  }

  /**
   * Gets chunks for a READY document index (without vector binaries).
   */
  public static async getIndexChunks(documentIndexId: string) {
    const index = await prisma.fundingDocumentIndex.findUnique({
      where: { id: documentIndexId },
    });

    if (!index) {
      throw new Error(`DOCUMENT_INDEX_NOT_FOUND: Index '${documentIndexId}' was not found.`);
    }

    const chunks = await prisma.fundingDocumentChunk.findMany({
      where: { documentIndexId },
      select: {
        id: true,
        documentIndexId: true,
        documentPageId: true,
        pageNumber: true,
        chunkIndex: true,
        startOffset: true,
        endOffset: true,
        text: true,
        textHash: true,
        tokenCount: true,
        citationRef: true,
        createdAt: true,
      },
      orderBy: [
        { pageNumber: 'asc' },
        { chunkIndex: 'asc' },
      ],
    });

    return {
      index,
      chunkCount: chunks.length,
      chunks,
    };
  }
}
