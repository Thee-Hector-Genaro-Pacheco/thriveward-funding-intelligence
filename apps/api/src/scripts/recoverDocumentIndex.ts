import { PrismaClient } from '@prisma/client';

async function main() {
  const isExecute = process.argv.includes('--execute');
  const confirmIndex = process.argv.indexOf('--confirm');
  const confirmPhrase = confirmIndex !== -1 ? process.argv[confirmIndex + 1] : '';

  const prisma = new PrismaClient();

  try {
    const dbRes: any = await prisma.$queryRaw`SELECT current_database()`;
    const activeDb = dbRes[0]?.current_database;
    console.log(`[RECOVERY_CLI] Target Database: ${activeDb}`);

    if (!isExecute) {
      console.log('[RECOVERY_CLI] DRY-RUN MODE (default). Pass --execute --confirm "CONFIRM_RECOVER_DOCUMENT_INDEX" to execute updates.');
    }

    const staleIndices = await prisma.fundingDocumentIndex.findMany({
      where: { status: 'PROCESSING' },
      include: {
        documentVersion: {
          select: { originalFileName: true },
        },
      },
    });

    console.log(`[RECOVERY_CLI] Found ${staleIndices.length} stale PROCESSING index record(s).`);

    for (const idx of staleIndices) {
      console.log(`- Index ID: ${idx.id} | Document Version ID: ${idx.documentVersionId} | File: ${idx.documentVersion.originalFileName} | Started At: ${idx.startedAt?.toISOString()}`);
    }

    if (staleIndices.length === 0) {
      console.log('[RECOVERY_CLI] No stale index records found. Operation complete.');
      return;
    }

    if (isExecute) {
      if (confirmPhrase !== 'CONFIRM_RECOVER_DOCUMENT_INDEX') {
        throw new Error('[RECOVERY_CLI] Execution aborted: Exact confirmation phrase --confirm "CONFIRM_RECOVER_DOCUMENT_INDEX" is required.');
      }

      console.log('[RECOVERY_CLI] Executing recovery transition to FAILED...');

      for (const idx of staleIndices) {
        await prisma.$transaction(async (tx) => {
          await tx.fundingDocumentIndex.update({
            where: { id: idx.id },
            data: {
              status: 'FAILED',
              failureCode: 'INTERRUPTED_PROCESSING_RECONCILED',
              completedAt: new Date(),
            },
          });

          await tx.fundingDocumentIndexIdempotency.updateMany({
            where: { indexId: idx.id },
            data: {
              status: 'FAILED',
              completedAt: new Date(),
            },
          });

          await tx.securityAuditEvent.create({
            data: {
              userId: idx.indexedByUserId,
              eventType: 'FUNDING_DOCUMENT_INDEXING_RECONCILED',
              details: JSON.stringify({
                documentIndexId: idx.id,
                documentVersionId: idx.documentVersionId,
                previousStatus: 'PROCESSING',
                newStatus: 'FAILED',
                reconciliationReason: 'Stale PROCESSING index record reconciled via operator recovery CLI',
              }),
            },
          });
        });

        console.log(`[RECOVERY_CLI] Reconciled index ID ${idx.id} -> FAILED.`);
      }

      console.log('[RECOVERY_CLI] Recovery execution complete.');
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
