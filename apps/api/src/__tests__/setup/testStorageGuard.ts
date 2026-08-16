import os from 'os';
import path from 'path';
import fs from 'fs';
import { prisma } from '../../lib/prisma';

export function createIsolatedTestStorageDir(): string {
  const tmpRoot = os.tmpdir();
  const testDir = fs.mkdtempSync(path.join(tmpRoot, 'tfi-test-documents-'));
  const canonicalTestDir = fs.realpathSync(testDir);
  const prodStorageRoot = process.env.DOCUMENT_STORAGE_ROOT || '/data/funding-documents';

  if (canonicalTestDir === prodStorageRoot || canonicalTestDir.startsWith(prodStorageRoot)) {
    throw new Error(`[FAIL_CLOSED_TEST_STORAGE_GUARD] Test storage directory '${canonicalTestDir}' conflicts with production storage root '${prodStorageRoot}'!`);
  }

  return canonicalTestDir;
}

export async function assertTestDatabaseIsolation(): Promise<void> {
  const dbRes = await prisma.$queryRawUnsafe<{ current_database: string }[]>('SELECT current_database()');
  const currentDb = dbRes[0]?.current_database;
  if (currentDb !== 'bridge_ai_test_db') {
    throw new Error(`[FAIL_CLOSED_TEST_ISOLATION_GUARD] Test suite refused execution against non-test database '${currentDb}'. Required: 'bridge_ai_test_db'`);
  }
}
