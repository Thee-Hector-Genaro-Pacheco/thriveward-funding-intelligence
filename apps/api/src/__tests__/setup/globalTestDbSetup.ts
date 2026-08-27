import { execSync } from 'child_process';
import path from 'path';
import { URL } from 'url';
import { PrismaClient } from '@prisma/client';

let disposableDbName: string | null = null;
let baseTestDbUrl: string | null = null;

export default async function globalSetup() {
  const rawTestDbUrl = process.env.TEST_DATABASE_URL;
  if (!rawTestDbUrl) {
    throw new Error('[GLOBAL_TEST_DB_SETUP] TEST_DATABASE_URL is not set in environment.');
  }

  baseTestDbUrl = rawTestDbUrl;
  const parsed = new URL(rawTestDbUrl);

  // Unique disposable database name per Vitest execution run
  disposableDbName = `bridge_ai_vitest_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  // Connect to base Postgres database to execute CREATE DATABASE
  const adminPrisma = new PrismaClient({
    datasources: { db: { url: rawTestDbUrl } },
  });

  try {
    await adminPrisma.$executeRawUnsafe(`CREATE DATABASE "${disposableDbName}"`);
  } catch (err: any) {
    console.error(`[GLOBAL_TEST_DB_SETUP] Failed to create disposable DB '${disposableDbName}':`, err.message);
    throw err;
  } finally {
    await adminPrisma.$disconnect();
  }

  // Construct target URL for the new disposable database
  parsed.pathname = `/${disposableDbName}`;
  const disposableDbUrl = parsed.toString();

  // Enable pgvector extension using superuser connection
  const superuserPassword = process.env.POSTGRES_PASSWORD;
  if (!superuserPassword) {
    throw new Error('[GLOBAL_TEST_DB_SETUP] POSTGRES_PASSWORD is required to initialize the disposable test database.');
  }
  const superuserUrl = `postgresql://bridge_admin:${superuserPassword}@${parsed.hostname}:${parsed.port || '5432'}/${disposableDbName}`;

  const superPrisma = new PrismaClient({
    datasources: { db: { url: superuserUrl } },
  });
  try {
    await superPrisma.$executeRawUnsafe('CREATE EXTENSION IF NOT EXISTS vector;');
  } catch (extErr: any) {
    console.error(`[GLOBAL_TEST_DB_SETUP] Could not create pgvector extension:`, extErr.message);
    throw extErr;
  } finally {
    await superPrisma.$disconnect();
  }

  // Export to process environment so all test worker processes inherit the disposable DB URL
  process.env.TEST_DATABASE_URL = disposableDbUrl;
  process.env.DATABASE_URL = disposableDbUrl;

  const schemaPath = path.resolve(__dirname, '../../../prisma/schema.prisma');
  const seedPath = path.resolve(__dirname, '../../../prisma/seed.ts');

  // Deploy migrations and seed initial test data into disposable database
  try {
    execSync(`npx prisma migrate deploy --schema="${schemaPath}"`, {
      env: { ...process.env, DATABASE_URL: disposableDbUrl },
      encoding: 'utf-8',
      stdio: 'pipe',
    });

    execSync(`npx tsx "${seedPath}"`, {
      env: { ...process.env, DATABASE_URL: disposableDbUrl },
      encoding: 'utf-8',
      stdio: 'pipe',
    });
  } catch (err: any) {
    console.error(`[GLOBAL_TEST_DB_SETUP] Failed to deploy migrations or seed disposable DB '${disposableDbName}':`, err.message);
    // Cleanup disposable database if setup fails
    try {
      const cleanupPrisma = new PrismaClient({ datasources: { db: { url: rawTestDbUrl } } });
      await cleanupPrisma.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${disposableDbName}" WITH (FORCE)`);
      await cleanupPrisma.$disconnect();
    } catch {}
    throw err;
  }

  // Return teardown function executed by Vitest after all tests complete
  return async () => {
    if (disposableDbName && baseTestDbUrl) {
      const teardownPrisma = new PrismaClient({
        datasources: { db: { url: baseTestDbUrl } },
      });

      try {
        await teardownPrisma.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${disposableDbName}" WITH (FORCE)`);
      } catch (err: any) {
        console.error(`[GLOBAL_TEST_DB_TEARDOWN] Failed to drop disposable DB '${disposableDbName}':`, err.message);
      } finally {
        await teardownPrisma.$disconnect();
      }
    }
  };
}
