import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { assertTestDatabaseIsolation, parseDatabaseUrl } from './setup/testDbGuard';
import { execSync } from 'child_process';

describe('Fail-Closed Test Database Guard & Dedicated Boundary Suite', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('1. Rejects missing TEST_DATABASE_URL', async () => {
    delete process.env.TEST_DATABASE_URL;
    await expect(assertTestDatabaseIsolation({ suppressDbQueries: true })).rejects.toThrow(
      '[FAIL_CLOSED_TEST_ISOLATION_GUARD] TEST_DATABASE_URL is missing or empty.'
    );
  });

  it('2. Rejects empty TEST_DATABASE_URL', async () => {
    process.env.TEST_DATABASE_URL = '   ';
    await expect(assertTestDatabaseIsolation({ suppressDbQueries: true })).rejects.toThrow(
      '[FAIL_CLOSED_TEST_ISOLATION_GUARD] TEST_DATABASE_URL is missing or empty.'
    );
  });

  it('3. Rejects operational database name (bridge_ai_db)', async () => {
    process.env.TEST_DATABASE_URL = 'postgresql://bridge_ai_test_runner:test_pass@localhost:5432/bridge_ai_db?schema=public';
    await expect(assertTestDatabaseIsolation({ suppressDbQueries: true })).rejects.toThrow(
      "Test database cannot be operational database 'bridge_ai_db'."
    );
  });

  it('4. Rejects operational role (bridge_admin)', async () => {
    process.env.TEST_DATABASE_URL = 'postgresql://bridge_admin:test_pass@localhost:5432/bridge_ai_test_db?schema=public';
    await expect(assertTestDatabaseIsolation({ suppressDbQueries: true })).rejects.toThrow(
      "Test database role cannot be operational superuser role 'bridge_admin'."
    );
  });

  it('5. Rejects matching operational password', async () => {
    process.env.TEST_DATABASE_URL = 'postgresql://bridge_ai_test_runner:matching_pass_123@localhost:5432/bridge_ai_test_db?schema=public';
    process.env.OPERATIONAL_DATABASE_URL_FOR_GUARD_TESTING = 'postgresql://bridge_admin:matching_pass_123@localhost:5432/bridge_ai_db?schema=public';
    await expect(assertTestDatabaseIsolation({ suppressDbQueries: true })).rejects.toThrow(
      'Test database password cannot match operational password.'
    );
  });

  it('6. Rejects malformed test URL', async () => {
    process.env.TEST_DATABASE_URL = 'invalid_url_string';
    await expect(assertTestDatabaseIsolation({ suppressDbQueries: true })).rejects.toThrow(
      'Failed to parse Database URL:'
    );
  });

  it('7. Accepts exact bridge_ai_test_db URL with dedicated test role', async () => {
    process.env.TEST_DATABASE_URL = 'postgresql://bridge_ai_test_runner:valid_dummy_pass@localhost:5432/bridge_ai_test_db?schema=public';
    delete process.env.OPERATIONAL_DATABASE_URL_FOR_GUARD_TESTING;
    process.env.AI_FUNDING_ANALYST_ENABLED = 'false';
    delete process.env.OPENAI_API_KEY;
    await expect(assertTestDatabaseIsolation({ suppressDbQueries: true })).resolves.toBeUndefined();
    expect(process.env.DATABASE_URL).toBe('postgresql://bridge_ai_test_runner:valid_dummy_pass@localhost:5432/bridge_ai_test_db?schema=public');
  });

  it('8. Test role bridge_ai_test_runner cannot connect to operational database bridge_ai_db', () => {
    const testUrl = originalEnv.TEST_DATABASE_URL;
    if (!testUrl) return;
    const info = parseDatabaseUrl(testUrl);

    let connected = false;
    try {
      execSync(`PGPASSWORD="${info.password}" psql -h localhost -U ${info.username} -d bridge_ai_db -c "SELECT current_database()" 2>&1`);
      connected = true;
    } catch {
      connected = false;
    }
    expect(connected).toBe(false);
  });

  it('9. Test role bridge_ai_test_runner can connect to disposable test database bridge_ai_test_db', () => {
    const testUrl = originalEnv.TEST_DATABASE_URL;
    if (!testUrl) return;
    const info = parseDatabaseUrl(testUrl);

    let connected = false;
    try {
      const res = execSync(`PGPASSWORD="${info.password}" psql -h localhost -U ${info.username} -d bridge_ai_test_db -c "SELECT current_database()" 2>&1`, {
        encoding: 'utf8',
      });
      connected = res.includes('bridge_ai_test_db');
    } catch {
      connected = false;
    }
    expect(connected).toBe(true);
  });

  it('10. Test role bridge_ai_test_runner possesses non-superuser attributes in PostgreSQL catalog', () => {
    const roleAttrs = execSync(
      `docker exec -i thriveward-funding-intelligence-postgres psql -U bridge_admin -d postgres -t -A -c "SELECT rolsuper, rolcreaterole, rolcreatedb, rolreplication, rolbypassrls FROM pg_roles WHERE rolname = 'bridge_ai_test_runner';"`,
      { encoding: 'utf8' }
    ).trim();

    expect(roleAttrs).toBe('f|f|t|f|f');
  });
});
