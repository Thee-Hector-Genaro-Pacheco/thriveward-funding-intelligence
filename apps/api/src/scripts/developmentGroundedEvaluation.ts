import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '../../.env.development.local') });

async function main(): Promise<void> {
  const workflow = await import('../services/developmentGroundedEvaluationWorkflow');
  const args = workflow.parseDevelopmentGroundedArguments(process.argv.slice(2));
  if (args.preflight) delete process.env.OPENAI_API_KEY;

  const [{ prisma }, { DocumentRetrievalService }, { EvidenceCatalogBuilder }] = await Promise.all([
    import('../lib/prisma'),
    import('../services/documentRetrievalService'),
    import('../services/ai/evidenceCatalogBuilder'),
  ]);
  const plan: import('../services/developmentGroundedEvaluationWorkflow').GroundedProviderPlan = {
    retrievalProvider: 'OPENAI',
    retrievalModel: process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small',
    retrievalDimensions: Number(process.env.OPENAI_EMBEDDING_DIMENSIONS) || 1536,
    retrievalQueryLabels: DocumentRetrievalService.CONTROLLED_QUERIES.map((query) => query.label),
    retrievalBatchSize: DocumentRetrievalService.CONTROLLED_QUERIES.length,
    topK: Number(process.env.DOCUMENT_RETRIEVAL_TOP_K) || 8,
    maxContextTokens: Number(process.env.DOCUMENT_RETRIEVAL_MAX_CONTEXT_TOKENS) || 6000,
    analystProvider: 'OPENAI',
    analystModel: process.env.OPENAI_MODEL || 'gpt-5.6-luna',
    analystPromptVersion: EvidenceCatalogBuilder.GROUNDED_PROMPT_VERSION,
  };

  const dependencies: import('../services/developmentGroundedEvaluationWorkflow').DevelopmentGroundedDependencies = {
    async getCurrentDatabaseName() {
      const rows = await prisma.$queryRaw<Array<{ database_name: string }>>`SELECT current_database() AS database_name`;
      const name = rows[0]?.database_name;
      if (!name) throw new Error('Unable to determine connected PostgreSQL database.');
      return name;
    },
    async loadTarget(input) {
      const [opportunity, document, version, index, requester] = await Promise.all([
        prisma.fundingOpportunity.findUnique({
          where: { id: input.opportunityId },
          select: { id: true, externalOpportunityId: true, fundingOpportunityNumber: true },
        }),
        prisma.fundingDocument.findUnique({
          where: { id: input.expectedDocumentId },
          select: { id: true, fundingOpportunityId: true, documentType: true },
        }),
        prisma.fundingDocumentVersion.findUnique({
          where: { id: input.documentVersionId },
          select: {
            id: true, fundingDocumentId: true, status: true, sha256: true, pageCount: true,
            pages: { orderBy: { pageNumber: 'asc' }, select: { pageNumber: true } },
          },
        }),
        prisma.fundingDocumentIndex.findUnique({
          where: { id: input.expectedIndexId },
          select: {
            id: true, documentVersionId: true, status: true, embeddingProvider: true,
            embeddingModel: true, embeddingDimensions: true, chunkCount: true,
            sourceManifestHash: true, configurationHash: true,
          },
        }),
        prisma.user.findUnique({
          where: { id: input.requestedByUserId },
          select: { id: true, role: true, accountState: true },
        }),
      ]);
      return {
        opportunity,
        document: document ? { ...document, documentType: String(document.documentType) } : null,
        version: version ? { ...version, status: String(version.status), pageNumbers: version.pages.map((page) => page.pageNumber) } : null,
        index: index ? { ...index, status: String(index.status) } : null,
        requester,
      };
    },
    async findExistingEvaluation(input) {
      const evaluation = await prisma.aiEvaluation.findFirst({
        where: {
          generatedByUserId: input.requestedByUserId,
          opportunityId: input.opportunityId,
          idempotencyKey: input.idempotencyKey,
        },
        select: {
          id: true, status: true, provider: true, model: true, promptVersion: true,
          retrievalRun: { select: { documentIndexId: true } },
        },
      });
      return evaluation ? {
        id: evaluation.id,
        status: String(evaluation.status),
        documentIndexId: evaluation.retrievalRun?.documentIndexId || null,
        provider: evaluation.provider,
        model: evaluation.model,
        promptVersion: evaluation.promptVersion,
      } : null;
    },
    async executeGroundedEvaluation(input) {
      const { AiFundingAnalystService } = await import('../services/aiFundingAnalystService');
      const created = await AiFundingAnalystService.generateGroundedEvaluation({
        opportunityId: input.opportunityId,
        documentVersionId: input.documentVersionId,
        documentIndexId: input.expectedIndexId,
        userId: input.requestedByUserId,
        idempotencyKey: input.idempotencyKey,
      });
      const evaluation = await prisma.aiEvaluation.findUnique({
        where: { id: created.id },
        select: {
          id: true, status: true, provider: true, model: true, promptVersion: true,
          providerResponseId: true, inputTokenCount: true, outputTokenCount: true,
          retrievalRun: {
            select: {
              documentIndexId: true,
              evidenceItems: { select: { citationRef: true } },
            },
          },
        },
      });
      if (!evaluation?.retrievalRun) throw new Error('DEVELOPMENT_GROUNDED_RESULT_INCOMPLETE');
      return {
        id: evaluation.id,
        status: String(evaluation.status),
        documentIndexId: evaluation.retrievalRun.documentIndexId,
        provider: evaluation.provider,
        model: evaluation.model,
        promptVersion: evaluation.promptVersion,
        evidenceCount: evaluation.retrievalRun.evidenceItems.length,
        citationCount: new Set(evaluation.retrievalRun.evidenceItems.map((item) => item.citationRef)).size,
        providerResponseId: evaluation.providerResponseId,
        inputTokenCount: evaluation.inputTokenCount,
        outputTokenCount: evaluation.outputTokenCount,
      };
    },
  };

  try {
    const output = await workflow.runDevelopmentGroundedEvaluation(args, plan, dependencies);
    console.log(JSON.stringify(output));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Development grounded evaluation failed.';
  console.error(`[Development Grounded Evaluation] ${message}`);
  process.exitCode = 1;
});
