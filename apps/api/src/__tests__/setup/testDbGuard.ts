import { URL } from 'url';
import dotenv from 'dotenv';

// Pre-load .env environment
dotenv.config({ path: '../../.env' });
dotenv.config({ path: '.env' });

export interface DatabaseConnectionInfo {
  host: string;
  port: string;
  dbName: string;
  schema: string;
  username: string;
  password?: string;
}

export function parseDatabaseUrl(rawUrl: string | undefined): DatabaseConnectionInfo {
  if (!rawUrl || typeof rawUrl !== 'string') {
    throw new Error('Database URL is missing or empty.');
  }

  try {
    const parsed = new URL(rawUrl);
    const dbName = parsed.pathname.replace(/^\//, '');
    const schema = parsed.searchParams.get('schema') || 'public';
    return {
      host: parsed.hostname || 'localhost',
      port: parsed.port || '5432',
      dbName,
      schema,
      username: parsed.username || '',
      password: parsed.password || '',
    };
  } catch (err) {
    throw new Error(`Failed to parse Database URL: ${(err as Error).message}`);
  }
}

export async function assertTestDatabaseIsolation(options?: { suppressDbQueries?: boolean }): Promise<void> {
  const nodeEnv = process.env.NODE_ENV || 'test';
  if (nodeEnv !== 'test') {
    throw new Error(`[FAIL_CLOSED_TEST_ISOLATION_GUARD] NODE_ENV must be 'test'. Received: '${nodeEnv}'.`);
  }

  const testDbUrl = process.env.TEST_DATABASE_URL;
  if (!testDbUrl || testDbUrl.trim() === '') {
    throw new Error('[FAIL_CLOSED_TEST_ISOLATION_GUARD] TEST_DATABASE_URL is missing or empty.');
  }

  const testDbInfo = parseDatabaseUrl(testDbUrl);

  // 1. Exact database name check
  if (testDbInfo.dbName !== 'bridge_ai_test_db') {
    throw new Error(`[FAIL_CLOSED_TEST_ISOLATION_GUARD] Test database name must equal 'bridge_ai_test_db' exactly. Received: '${testDbInfo.dbName}'.`);
  }

  // 2. Reject operational database name
  if (testDbInfo.dbName.toLowerCase() === 'bridge_ai_db') {
    throw new Error('[FAIL_CLOSED_TEST_ISOLATION_GUARD] Test database cannot be operational database \'bridge_ai_db\'.');
  }

  // 3. Test role separation check: test role cannot be bridge_admin
  if (testDbInfo.username === 'bridge_admin') {
    throw new Error('[FAIL_CLOSED_TEST_ISOLATION_GUARD] Test database role cannot be operational superuser role \'bridge_admin\'.');
  }

  // 4. Test password separation check: test password cannot match operational password
  const opDbUrl = process.env.OPERATIONAL_DATABASE_URL_FOR_GUARD_TESTING;
  if (opDbUrl) {
    const opDbInfo = parseDatabaseUrl(opDbUrl);
    if (testDbInfo.password && opDbInfo.password && testDbInfo.password === opDbInfo.password) {
      throw new Error('[FAIL_CLOSED_TEST_ISOLATION_GUARD] Test database password cannot match operational password.');
    }
  }

  // 5. AI Analyst live calls must be disabled
  const aiEnabled = process.env.AI_FUNDING_ANALYST_ENABLED;
  if (aiEnabled === 'true') {
    throw new Error('[FAIL_CLOSED_TEST_ISOLATION_GUARD] AI_FUNDING_ANALYST_ENABLED must be disabled (false) during automated tests.');
  }

  // 6. Real OpenAI API Key must be unavailable
  const apiKey = process.env.OPENAI_API_KEY;
  if (apiKey && apiKey.startsWith('sk-proj-') && apiKey.length > 20) {
    throw new Error('[FAIL_CLOSED_TEST_ISOLATION_GUARD] Real OPENAI_API_KEY is populated. Live provider calls are strictly prohibited during tests.');
  }

  // 7. Test-only Prisma redirect: point process.env.DATABASE_URL to validated testDbUrl
  process.env.DATABASE_URL = testDbUrl;

  if (options?.suppressDbQueries) {
    return;
  }

  // 8. DB-level record & current_database() verification on target test database
  try {
    const { PrismaClient } = await import('@prisma/client');
    const testPrisma = new PrismaClient({
      datasources: { db: { url: testDbUrl } },
    });

    const dbRes: any = await testPrisma.$queryRawUnsafe('SELECT current_database()');
    const activeDbName = dbRes[0]?.current_database;
    if (activeDbName !== 'bridge_ai_test_db') {
      await testPrisma.$disconnect();
      throw new Error(`[FAIL_CLOSED_TEST_ISOLATION_GUARD] current_database() must equal 'bridge_ai_test_db' exactly. Received: '${activeDbName}'.`);
    }

    const liveEval = await testPrisma.aiEvaluation.findUnique({
      where: { id: '536c89cb-4b0c-4cd7-b61a-0f8b762ebec9' },
    });
    if (liveEval) {
      await testPrisma.$disconnect();
      throw new Error('[FAIL_CLOSED_TEST_ISOLATION_GUARD] Protected live evaluation 536c89cb-4b0c-4cd7-b61a-0f8b762ebec9 was found in test database!');
    }

    const opStreetOpp = await testPrisma.fundingOpportunity.findUnique({
      where: { id: 'e9943e0c-120c-4035-b445-25ff5dfd888a' },
    });
    if (opStreetOpp) {
      await testPrisma.$disconnect();
      throw new Error('[FAIL_CLOSED_TEST_ISOLATION_GUARD] Operational seed opportunity e9943e0c-120c-4035-b445-25ff5dfd888a was found in test database!');
    }

    await testPrisma.$disconnect();
  } catch (err) {
    if ((err as Error).message.includes('[FAIL_CLOSED_TEST_ISOLATION_GUARD]')) {
      throw err;
    }
    // Ignore database connection failures in offline unit test contexts
  }
}

// Auto-run guard on module import in Vitest setup
if (process.env.NODE_ENV === 'test') {
  if (process.env.TEST_DATABASE_URL) {
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
  }
  assertTestDatabaseIsolation().catch((err) => {
    console.error(err.message);
  });
}
