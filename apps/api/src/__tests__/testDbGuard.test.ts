import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { assertTestDatabaseIsolation, parseDatabaseUrl } from './setup/testDbGuard';

describe('Fail-Closed Test Database Guard Negative Unit Suite', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('1. Rejects missing TEST_DATABASE_URL', async () => {
    delete process.env.TEST_DATABASE_URL;
    process.env.DATABASE_URL = 'postgresql://bridge_admin:bridge_secure_pass_2026@localhost:5432/bridge_ai_test_db?schema=public';
    await expect(assertTestDatabaseIsolation({ suppressDbQueries: true })).rejects.toThrow(
      '[FAIL_CLOSED_TEST_ISOLATION_GUARD] TEST_DATABASE_URL is missing or empty.'
    );
  });

  it('2. Rejects operational database URL (bridge_ai_db)', async () => {
    process.env.TEST_DATABASE_URL = 'postgresql://bridge_admin:bridge_secure_pass_2026@localhost:5432/bridge_ai_db?schema=public';
    process.env.DATABASE_URL = 'postgresql://bridge_admin:bridge_secure_pass_2026@localhost:5432/bridge_ai_db?schema=public';
    await expect(assertTestDatabaseIsolation({ suppressDbQueries: true })).rejects.toThrow(
      "[FAIL_CLOSED_TEST_ISOLATION_GUARD] Test database name must contain 'test'."
    );
  });

  it('3. Rejects database without test in name', async () => {
    process.env.TEST_DATABASE_URL = 'postgresql://bridge_admin:bridge_secure_pass_2026@localhost:5432/production_db?schema=public';
    process.env.DATABASE_URL = 'postgresql://bridge_admin:bridge_secure_pass_2026@localhost:5432/production_db?schema=public';
    await expect(assertTestDatabaseIsolation({ suppressDbQueries: true })).rejects.toThrow(
      "[FAIL_CLOSED_TEST_ISOLATION_GUARD] Test database name must contain 'test'."
    );
  });

  it('4. Rejects mismatch between effective DATABASE_URL and TEST_DATABASE_URL', async () => {
    process.env.TEST_DATABASE_URL = 'postgresql://bridge_admin:bridge_secure_pass_2026@localhost:5432/bridge_ai_test_db?schema=public';
    process.env.DATABASE_URL = 'postgresql://bridge_admin:bridge_secure_pass_2026@localhost:5432/other_test_db?schema=public';
    await expect(assertTestDatabaseIsolation({ suppressDbQueries: true })).rejects.toThrow(
      "[FAIL_CLOSED_TEST_ISOLATION_GUARD] Effective DATABASE_URL ('other_test_db') does not match TEST_DATABASE_URL ('bridge_ai_test_db')."
    );
  });

  it('5. Rejects enabled live AI provider (AI_FUNDING_ANALYST_ENABLED=true)', async () => {
    process.env.TEST_DATABASE_URL = 'postgresql://bridge_admin:bridge_secure_pass_2026@localhost:5432/bridge_ai_test_db?schema=public';
    process.env.DATABASE_URL = 'postgresql://bridge_admin:bridge_secure_pass_2026@localhost:5432/bridge_ai_test_db?schema=public';
    process.env.AI_FUNDING_ANALYST_ENABLED = 'true';
    await expect(assertTestDatabaseIsolation({ suppressDbQueries: true })).rejects.toThrow(
      '[FAIL_CLOSED_TEST_ISOLATION_GUARD] AI_FUNDING_ANALYST_ENABLED must be disabled (false) during automated tests.'
    );
  });

  it('6. Rejects populated real OpenAI API Key', async () => {
    process.env.TEST_DATABASE_URL = 'postgresql://bridge_admin:bridge_secure_pass_2026@localhost:5432/bridge_ai_test_db?schema=public';
    process.env.DATABASE_URL = 'postgresql://bridge_admin:bridge_secure_pass_2026@localhost:5432/bridge_ai_test_db?schema=public';
    process.env.AI_FUNDING_ANALYST_ENABLED = 'false';
    process.env.OPENAI_API_KEY = 'sk-proj-1234567890abcdef1234567890abcdef';
    await expect(assertTestDatabaseIsolation({ suppressDbQueries: true })).rejects.toThrow(
      '[FAIL_CLOSED_TEST_ISOLATION_GUARD] Real OPENAI_API_KEY is populated.'
    );
  });

  it('7. Helper parseDatabaseUrl parses host, port, dbName, and schema without credentials', () => {
    const info = parseDatabaseUrl('postgresql://user:pass@myhost:5433/mydb_test?schema=my_schema');
    expect(info).toEqual({
      host: 'myhost',
      port: '5433',
      dbName: 'mydb_test',
      schema: 'my_schema',
    });
  });
});
