import { PrismaClient, DocumentVersionStatus } from '@prisma/client';
import crypto from 'crypto';
import { LocalDockerDocumentStorage } from '../services/documents/fundingDocumentStorage';

const CONFIRMATION_PHRASE = 'RECONCILE_STALE_DOCUMENT_INGESTION_2026';

export async function reconcileStaleIngestion(options: {
  execute?: boolean;
  confirmation?: string;
  allowedDatabaseName?: string;
  storageProvider?: LocalDockerDocumentStorage;
}) {
  const prisma = new PrismaClient();
  const storage = options.storageProvider || new LocalDockerDocumentStorage();

  try {
    const dbRes = await prisma.$queryRawUnsafe<{ current_database: string }[]>('SELECT current_database()');
    const currentDb = dbRes[0]?.current_database;
    const expectedDb = options.allowedDatabaseName || process.env.ALLOWED_RECONCILE_DB || 'bridge_ai_db';

    console.log(`[ReconcileEngine] Current Database: ${currentDb}`);

    if (currentDb !== expectedDb && currentDb !== 'bridge_ai_test_db') {
      throw new Error(`[RECONCILE_ABORT] Refusing execution against unapproved database '${currentDb}'. Allowed: '${expectedDb}'`);
    }

    const isExecuteMode = options.execute === true;
    if (isExecuteMode && options.confirmation !== CONFIRMATION_PHRASE) {
      throw new Error(`[RECONCILE_ABORT] Execute mode requires valid confirmation phrase '${CONFIRMATION_PHRASE}'`);
    }

    console.log(`[ReconcileEngine] Mode: ${isExecuteMode ? 'EXECUTE' : 'DRY_RUN'}`);

    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
    const staleVersions = await prisma.fundingDocumentVersion.findMany({
      where: {
        status: DocumentVersionStatus.PROCESSING,
        createdAt: { lt: fifteenMinutesAgo },
      },
      include: { pages: true },
    });

    console.log(`[ReconcileEngine] Found ${staleVersions.length} stale PROCESSING document versions older than 15 minutes.`);

    let reconciledCount = 0;

    for (const ver of staleVersions) {
      console.log(`[ReconcileEngine] Inspecting Version ID: ${ver.id}, StorageKey: ${ver.storageKey}`);
      const fileExists = await storage.exists(ver.storageKey);

      let targetStatus: DocumentVersionStatus = DocumentVersionStatus.FAILED;

      let failureReason = 'EXTRACTION_STALE_TIMEOUT: Ingestion timed out in PROCESSING state';

      if (fileExists && ver.pages.length > 0) {
        targetStatus = DocumentVersionStatus.READY;
      }

      console.log(`[ReconcileEngine] Plan for ${ver.id}: Update status to ${targetStatus}`);

      if (isExecuteMode) {
        await prisma.fundingDocumentVersion.update({
          where: { id: ver.id },
          data: {
            status: targetStatus,
            failureCode: targetStatus === DocumentVersionStatus.FAILED ? 'EXTRACTION_STALE_TIMEOUT' : null,
            failureMessage: targetStatus === DocumentVersionStatus.FAILED ? failureReason : null,
            processedAt: new Date(),
          },
        });

        await prisma.securityAuditEvent.create({
          data: {
            userId: ver.uploadedByUserId,
            eventType: 'FUNDING_DOCUMENT_RECONCILED',
            details: JSON.stringify({
              versionId: ver.id,
              previousStatus: 'PROCESSING',
              reconciledStatus: targetStatus,
              reason: failureReason,
            }),
          },
        });

        reconciledCount++;
      }
    }

    console.log(`[ReconcileEngine] Reconciliation complete. Reconciled ${reconciledCount} items.`);
    return { staleCount: staleVersions.length, reconciledCount };
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const execute = args.includes('--execute');
  const confirmArg = args.find((a) => a.startsWith('--confirm='))?.split('=')[1];

  reconcileStaleIngestion({
    execute,
    confirmation: confirmArg,
  }).catch((err) => {
    console.error('[ReconcileEngine] Error:', err.message);
    process.exit(1);
  });
}
