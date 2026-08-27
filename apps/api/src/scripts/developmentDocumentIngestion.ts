import dotenv from 'dotenv';
import fs from 'fs/promises';
import path from 'path';

dotenv.config({
  path: path.resolve(process.cwd(), '../../.env.development.local'),
});

async function main(): Promise<void> {
  const workflow = await import('../services/documents/developmentDocumentIngestionWorkflow');
  const args = workflow.parseDevelopmentDocumentArguments(process.argv.slice(2));

  const { prisma } = await import('../lib/prisma');
  try {
    const output = await workflow.ingestDevelopmentDocument(args, {
      async getCurrentDatabaseName() {
        const rows = await prisma.$queryRaw<Array<{ database_name: string }>>`
          SELECT current_database() AS database_name
        `;
        const databaseName = rows[0]?.database_name;
        if (!databaseName) throw new Error('Unable to determine the connected PostgreSQL database.');
        return databaseName;
      },
      findOpportunity(id) {
        return prisma.fundingOpportunity.findUnique({
          where: { id },
          select: {
            id: true,
            sourceSystem: true,
            externalOpportunityId: true,
            fundingOpportunityNumber: true,
            title: true,
          },
        });
      },
      readFile(filePath) {
        return fs.readFile(filePath);
      },
      async inspectFile(filePath) {
        const stats = await fs.lstat(filePath);
        return { isFile: stats.isFile() && !stats.isSymbolicLink() };
      },
      async ingestDocument(input) {
        const [{ DocumentType }, { DocumentIngestionService }] = await Promise.all([
          import('@prisma/client'),
          import('../services/documents/documentIngestionService'),
        ]);
        return DocumentIngestionService.ingestDocument({
          ...input,
          documentType: DocumentType[input.documentType],
        });
      },
    });
    console.log(JSON.stringify(output));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Development document ingestion failed.';
  console.error(`[Development Document Ingestion] ${message}`);
  process.exitCode = 1;
});
