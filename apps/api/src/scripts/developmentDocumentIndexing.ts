import dotenv from 'dotenv';
import path from 'path';

dotenv.config({
  path: path.resolve(process.cwd(), '../../.env.development.local'),
});

async function main(): Promise<void> {
  const workflow = await import('../services/developmentDocumentIndexingWorkflow');
  const args = workflow.parseDevelopmentIndexArguments(process.argv.slice(2));
  const identity = workflow.readDevelopmentIndexProviderIdentity(process.env);
  const batchSize = workflow.readDevelopmentIndexBatchSize(process.env);
  const { prisma } = await import('../lib/prisma');

  try {
    const output = await workflow.runDevelopmentDocumentIndexing(args, identity, batchSize, {
      async getCurrentDatabaseName() {
        const rows = await prisma.$queryRaw<Array<{ database_name: string }>>`
          SELECT current_database() AS database_name
        `;
        const databaseName = rows[0]?.database_name;
        if (!databaseName) throw new Error('Unable to determine the connected PostgreSQL database.');
        return databaseName;
      },
      findDocumentVersion(id) {
        return prisma.fundingDocumentVersion.findUnique({
          where: { id },
          select: {
            id: true,
            status: true,
            sha256: true,
            pageCount: true,
            fundingDocumentId: true,
            fundingDocument: {
              select: { id: true, fundingOpportunityId: true, documentType: true },
            },
            pages: {
              orderBy: { pageNumber: 'asc' },
              select: { id: true, pageNumber: true, text: true },
            },
          },
        }).then((version) => version ? {
          ...version,
          pages: version.pages.map((page) => ({
            pageId: page.id,
            pageNumber: page.pageNumber,
            text: page.text,
          })),
        } : null);
      },
      findRequester(id) {
        return prisma.user.findUnique({
          where: { id },
          select: { id: true, role: true, accountState: true },
        });
      },
      findCompatibleIndex(documentVersionId, configurationHash) {
        return prisma.fundingDocumentIndex.findUnique({
          where: {
            documentVersionId_configurationHash: { documentVersionId, configurationHash },
          },
          select: {
            id: true,
            status: true,
            sourceManifestHash: true,
            configurationHash: true,
            chunkCount: true,
            embeddingProvider: true,
            embeddingModel: true,
            embeddingDimensions: true,
          },
        });
      },
      async indexDocument(input) {
        const { DocumentIndexingService } = await import('../services/documentIndexingService');
        return DocumentIndexingService.indexDocumentVersion(input);
      },
    });
    console.log(JSON.stringify(output));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Development document indexing failed.';
  console.error(`[Development Document Indexing] ${message}`);
  process.exitCode = 1;
});
