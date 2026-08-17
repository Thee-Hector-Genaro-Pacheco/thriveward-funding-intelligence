import crypto from 'crypto';
import { prisma } from '../lib/prisma';
import { DocumentEmbeddingProvider } from './ai/documentEmbeddingProvider';
import { DocumentIndexingService } from './documentIndexingService';

export interface ControlledQueryDefinition {
  label: string;
  queryText: string;
}

export interface RetrievedChunkEvidence {
  chunkId: string;
  documentIndexId: string;
  documentPageId: string;
  queryLabel: string;
  rank: number;
  cosineSimilarity: number;
  citationRef: string;
  pageNumber: number;
  chunkIndex: number;
  text: string;
  textHash: string;
  tokenCount: number;
}

export interface RetrievalResult {
  retrievalVersion: string;
  documentIndexId: string;
  documentVersionId: string;
  querySnapshot: ControlledQueryDefinition[];
  retrievalConfiguration: {
    topK: number;
    maxContextTokens: number;
    embeddingModel: string;
  };
  retrievalHash: string;
  totalRetrievedChunks: number;
  totalRetrievedTokens: number;
  retrievedEvidence: RetrievedChunkEvidence[];
}

export class DocumentRetrievalService {
  public static readonly RETRIEVAL_VERSION = 'document-retrieval-v1';

  public static readonly CONTROLLED_QUERIES: ControlledQueryDefinition[] = [
    {
      label: 'ELIGIBILITY_AND_DISQUALIFYING_FACTORS',
      queryText:
        'What are the legal applicant eligibility criteria, 501(c)(3) tax status requirements, eligible entity types, fiscal sponsorship allowances, and explicit disqualifying factors or ineligible entities?',
    },
    {
      label: 'PROGRAM_PURPOSE_AND_SERVICE_POPULATION',
      queryText:
        'What is the primary funding program purpose, target service population, eligible youth or adult sub-populations, geographic scope, and core service delivery outcome expectations?',
    },
    {
      label: 'APPLICATION_REQUIREMENTS_AND_DEADLINES',
      queryText:
        'What are the mandatory application components, submission deadlines, page limits, required attachments, SAM.gov/UEI registration requirements, and submission instructions?',
    },
    {
      label: 'AWARD_AMOUNT_COST_SHARE_AND_PERIOD',
      queryText:
        'What is the award floor, award ceiling, total available program funding, period of performance duration, and mandatory cost-share or non-federal match requirements?',
    },
    {
      label: 'ORGANIZATIONAL_CAPACITY_AND_PARTNERSHIP_REQUIREMENTS',
      queryText:
        'What are the organizational operating history requirements, financial audit standards, key personnel qualifications, governance structures, and mandatory strategic partnership or MOU requirements?',
    },
  ];

  /**
   * Executes controlled semantic retrieval against a READY document index.
   */
  public static async executeRetrieval(
    opportunityId: string,
    provider?: DocumentEmbeddingProvider
  ): Promise<RetrievalResult> {
    const activeProvider = provider || DocumentIndexingService.getActiveProvider();

    if (!DocumentIndexingService.isGroundingEnabled()) {
      throw new Error(
        'AI_DOCUMENT_GROUNDING_NOT_CONFIGURED: Document grounding service is disabled or OPENAI_API_KEY is not configured.'
      );
    }

    // 1. Find official notice documents for opportunity
    const docVersion = await prisma.fundingDocumentVersion.findFirst({
      where: {
        fundingDocument: {
          fundingOpportunityId: opportunityId,
        },
        status: 'READY',
      },
      orderBy: { createdAt: 'desc' },
      include: {
        indices: {
          where: { status: 'READY' },
          orderBy: { version: 'desc' },
          take: 1,
        },
      },
    });

    if (!docVersion || docVersion.indices.length === 0) {
      throw new Error(
        `DOCUMENT_INDEX_NOT_READY: No READY official notice document index exists for opportunity '${opportunityId}'. Indexing is required before grounded analysis.`
      );
    }

    const docIndex = docVersion.indices[0];

    const topK = Number(process.env.DOCUMENT_RETRIEVAL_TOP_K) || 8;
    const maxContextTokens = Number(process.env.DOCUMENT_RETRIEVAL_MAX_CONTEXT_TOKENS) || 6000;

    // 2. Embed controlled queries
    const queryTexts = DocumentRetrievalService.CONTROLLED_QUERIES.map((q) => q.queryText);

    const queryEmbedResult = await activeProvider.embedQueries({
      texts: queryTexts,
      model: docIndex.embeddingModel,
      dimensions: docIndex.embeddingDimensions,
    });

    const retrievedEvidence: RetrievedChunkEvidence[] = [];
    const seenChunkIds = new Set<string>();
    let accumulatedTokens = 0;

    // 3. Perform pgvector cosine similarity search per query
    for (let qIdx = 0; qIdx < DocumentRetrievalService.CONTROLLED_QUERIES.length; qIdx++) {
      const qDef = DocumentRetrievalService.CONTROLLED_QUERIES[qIdx];
      const qVec = queryEmbedResult.vectors[qIdx];
      const vecStr = `[${qVec.join(',')}]`;
      const querySeenChunkIds = new Set<string>();

      const rawHits: any[] = await prisma.$queryRaw`
        SELECT 
          c.id,
          c."documentIndexId",
          c."documentPageId",
          c."pageNumber",
          c."chunkIndex",
          c."startOffset",
          c."endOffset",
          c.text,
          c."textHash",
          c."tokenCount",
          c."citationRef",
          (1 - (c.embedding <=> ${vecStr}::vector)) as similarity
        FROM "FundingDocumentChunk" c
        WHERE c."documentIndexId" = ${docIndex.id}
        ORDER BY c.embedding <=> ${vecStr}::vector ASC, c."pageNumber" ASC, c."chunkIndex" ASC
        LIMIT ${topK}
      `;

      let rank = 1;
      for (const hit of rawHits) {
        if (querySeenChunkIds.has(hit.id)) {
          continue; // Deduplicate chunks within query
        }

        if (accumulatedTokens + hit.tokenCount > maxContextTokens) {
          break; // Respect total context token budget
        }

        querySeenChunkIds.add(hit.id);
        accumulatedTokens += hit.tokenCount;

        retrievedEvidence.push({
          chunkId: hit.id,
          documentIndexId: hit.documentIndexId,
          documentPageId: hit.documentPageId,
          queryLabel: qDef.label,
          rank,
          cosineSimilarity: Number(hit.similarity) || 0.0,
          citationRef: hit.citationRef,
          pageNumber: hit.pageNumber,
          chunkIndex: hit.chunkIndex,
          text: hit.text,
          textHash: hit.textHash,
          tokenCount: hit.tokenCount,
        });

        rank++;
      }
    }

    // 4. Sort evidence deterministically by query order then rank
    retrievedEvidence.sort((a, b) => {
      const qIndexA = DocumentRetrievalService.CONTROLLED_QUERIES.findIndex((q) => q.label === a.queryLabel);
      const qIndexB = DocumentRetrievalService.CONTROLLED_QUERIES.findIndex((q) => q.label === b.queryLabel);
      if (qIndexA !== qIndexB) return qIndexA - qIndexB;
      return a.rank - b.rank;
    });

    const retrievalHashInput = `INDEX:${docIndex.id};CHUNKS:${retrievedEvidence.map((e) => e.textHash).join(',')}`;
    const retrievalHash = crypto.createHash('sha256').update(retrievalHashInput).digest('hex');

    return {
      retrievalVersion: DocumentRetrievalService.RETRIEVAL_VERSION,
      documentIndexId: docIndex.id,
      documentVersionId: docVersion.id,
      querySnapshot: DocumentRetrievalService.CONTROLLED_QUERIES,
      retrievalConfiguration: {
        topK,
        maxContextTokens,
        embeddingModel: docIndex.embeddingModel,
      },
      retrievalHash,
      totalRetrievedChunks: retrievedEvidence.length,
      totalRetrievedTokens: accumulatedTokens,
      retrievedEvidence,
    };
  }
}
