-- CreateExtension
CREATE EXTENSION IF NOT EXISTS vector;

-- CreateEnum
CREATE TYPE "FundingDocumentIndexStatus" AS ENUM ('PENDING', 'PROCESSING', 'READY', 'FAILED');

-- CreateTable
CREATE TABLE "FundingDocumentIndex" (
    "id" TEXT NOT NULL,
    "documentVersionId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" "FundingDocumentIndexStatus" NOT NULL DEFAULT 'PENDING',
    "sourceManifestHash" TEXT NOT NULL,
    "configurationHash" TEXT NOT NULL,
    "chunkingVersion" TEXT NOT NULL DEFAULT 'document-chunker-v1',
    "embeddingProvider" TEXT NOT NULL DEFAULT 'OPENAI',
    "embeddingModel" TEXT NOT NULL DEFAULT 'text-embedding-3-small',
    "embeddingDimensions" INTEGER NOT NULL DEFAULT 1536,
    "pageCount" INTEGER NOT NULL,
    "chunkCount" INTEGER NOT NULL DEFAULT 0,
    "inputTokenCount" INTEGER NOT NULL DEFAULT 0,
    "providerRequestCount" INTEGER NOT NULL DEFAULT 0,
    "indexedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "failureCode" TEXT,

    CONSTRAINT "FundingDocumentIndex_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FundingDocumentIndexIdempotency" (
    "id" TEXT NOT NULL,
    "documentVersionId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "payloadHash" TEXT NOT NULL,
    "indexId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PROCESSING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "FundingDocumentIndexIdempotency_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FundingDocumentChunk" (
    "id" TEXT NOT NULL,
    "documentIndexId" TEXT NOT NULL,
    "documentPageId" TEXT NOT NULL,
    "pageNumber" INTEGER NOT NULL,
    "chunkIndex" INTEGER NOT NULL,
    "startOffset" INTEGER NOT NULL,
    "endOffset" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "textHash" TEXT NOT NULL,
    "tokenCount" INTEGER NOT NULL,
    "citationRef" TEXT NOT NULL,
    "embedding" vector(1536) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FundingDocumentChunk_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiEvaluationRetrievalRun" (
    "id" TEXT NOT NULL,
    "evaluationId" TEXT NOT NULL,
    "documentIndexId" TEXT NOT NULL,
    "retrievalVersion" TEXT NOT NULL DEFAULT 'document-retrieval-v1',
    "querySnapshot" JSONB NOT NULL,
    "retrievalConfiguration" JSONB NOT NULL,
    "retrievalHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiEvaluationRetrievalRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiEvaluationRetrievalEvidence" (
    "id" TEXT NOT NULL,
    "retrievalRunId" TEXT NOT NULL,
    "documentChunkId" TEXT NOT NULL,
    "queryLabel" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "cosineSimilarity" DOUBLE PRECISION NOT NULL,
    "citationRef" TEXT NOT NULL,
    "pageNumber" INTEGER NOT NULL,
    "excerptSnapshot" TEXT NOT NULL,
    "textHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiEvaluationRetrievalEvidence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FundingDocumentIndex_documentVersionId_version_key" ON "FundingDocumentIndex"("documentVersionId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "FundingDocumentIndex_documentVersionId_configurationHash_key" ON "FundingDocumentIndex"("documentVersionId", "configurationHash");

-- CreateIndex
CREATE INDEX "FundingDocumentIndex_documentVersionId_idx" ON "FundingDocumentIndex"("documentVersionId");

-- CreateIndex
CREATE INDEX "FundingDocumentIndex_indexedByUserId_idx" ON "FundingDocumentIndex"("indexedByUserId");

-- CreateIndex
CREATE INDEX "FundingDocumentIndex_status_idx" ON "FundingDocumentIndex"("status");

-- CreateIndex
CREATE UNIQUE INDEX "FundingDocumentIndexIdempotency_documentVersionId_idempotencyKey_key" ON "FundingDocumentIndexIdempotency"("documentVersionId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "FundingDocumentIndexIdempotency_documentVersionId_payloadHash_idx" ON "FundingDocumentIndexIdempotency"("documentVersionId", "payloadHash");

-- CreateIndex
CREATE UNIQUE INDEX "FundingDocumentChunk_documentIndexId_pageNumber_chunkIndex_key" ON "FundingDocumentChunk"("documentIndexId", "pageNumber", "chunkIndex");

-- CreateIndex
CREATE INDEX "FundingDocumentChunk_documentIndexId_idx" ON "FundingDocumentChunk"("documentIndexId");

-- CreateIndex
CREATE INDEX "FundingDocumentChunk_documentPageId_idx" ON "FundingDocumentChunk"("documentPageId");

-- CreateIndex
CREATE INDEX "FundingDocumentChunk_citationRef_idx" ON "FundingDocumentChunk"("citationRef");

-- CreateIndex (HNSW Cosine Vector Index)
CREATE INDEX "FundingDocumentChunk_embedding_hnsw_idx" ON "FundingDocumentChunk" USING hnsw ("embedding" vector_cosine_ops);

-- CreateIndex
CREATE UNIQUE INDEX "AiEvaluationRetrievalRun_evaluationId_key" ON "AiEvaluationRetrievalRun"("evaluationId");

-- CreateIndex
CREATE INDEX "AiEvaluationRetrievalRun_documentIndexId_idx" ON "AiEvaluationRetrievalRun"("documentIndexId");

-- CreateIndex
CREATE INDEX "AiEvaluationRetrievalEvidence_retrievalRunId_idx" ON "AiEvaluationRetrievalEvidence"("retrievalRunId");

-- CreateIndex
CREATE INDEX "AiEvaluationRetrievalEvidence_documentChunkId_idx" ON "AiEvaluationRetrievalEvidence"("documentChunkId");

-- CreateIndex
CREATE INDEX "AiEvaluationRetrievalEvidence_citationRef_idx" ON "AiEvaluationRetrievalEvidence"("citationRef");

-- AddForeignKey
ALTER TABLE "FundingDocumentIndex" ADD CONSTRAINT "FundingDocumentIndex_documentVersionId_fkey" FOREIGN KEY ("documentVersionId") REFERENCES "FundingDocumentVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FundingDocumentIndex" ADD CONSTRAINT "FundingDocumentIndex_indexedByUserId_fkey" FOREIGN KEY ("indexedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FundingDocumentIndexIdempotency" ADD CONSTRAINT "FundingDocumentIndexIdempotency_documentVersionId_fkey" FOREIGN KEY ("documentVersionId") REFERENCES "FundingDocumentVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FundingDocumentIndexIdempotency" ADD CONSTRAINT "FundingDocumentIndexIdempotency_indexId_fkey" FOREIGN KEY ("indexId") REFERENCES "FundingDocumentIndex"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FundingDocumentChunk" ADD CONSTRAINT "FundingDocumentChunk_documentIndexId_fkey" FOREIGN KEY ("documentIndexId") REFERENCES "FundingDocumentIndex"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FundingDocumentChunk" ADD CONSTRAINT "FundingDocumentChunk_documentPageId_fkey" FOREIGN KEY ("documentPageId") REFERENCES "FundingDocumentPage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiEvaluationRetrievalRun" ADD CONSTRAINT "AiEvaluationRetrievalRun_evaluationId_fkey" FOREIGN KEY ("evaluationId") REFERENCES "AiEvaluation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiEvaluationRetrievalRun" ADD CONSTRAINT "AiEvaluationRetrievalRun_documentIndexId_fkey" FOREIGN KEY ("documentIndexId") REFERENCES "FundingDocumentIndex"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiEvaluationRetrievalEvidence" ADD CONSTRAINT "AiEvaluationRetrievalEvidence_retrievalRunId_fkey" FOREIGN KEY ("retrievalRunId") REFERENCES "AiEvaluationRetrievalRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiEvaluationRetrievalEvidence" ADD CONSTRAINT "AiEvaluationRetrievalEvidence_documentChunkId_fkey" FOREIGN KEY ("documentChunkId") REFERENCES "FundingDocumentChunk"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
