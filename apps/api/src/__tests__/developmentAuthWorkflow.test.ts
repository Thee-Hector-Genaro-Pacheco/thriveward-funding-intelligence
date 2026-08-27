import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  bootstrapDevelopmentAdmin,
  DevelopmentAuthStore,
  inspectDevelopmentAdmin,
  readDevelopmentAdminPassword,
  validateDevelopmentDatabaseName,
} from '../services/developmentAuthWorkflow';

const email = 'dev-admin@projectthriveward.local';
const password = 'human-chosen-development-password';

function makeStore(overrides: Partial<DevelopmentAuthStore> = {}): DevelopmentAuthStore {
  return {
    getCurrentDatabaseName: vi.fn().mockResolvedValue('bridge_ai_dev'),
    findUserByEmail: vi.fn().mockResolvedValue(null),
    createAdminUser: vi.fn().mockImplementation(async (input) => ({
      id: 'dev-user', email: input.email, role: 'ADMIN', accountState: 'ACTIVE',
    })),
    ...overrides,
  };
}

describe('development-only authentication workflow', () => {
  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    process.env.NODE_ENV = 'development';
  });

  afterEach(() => {
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnv;
    vi.restoreAllMocks();
  });

  it.each(['bridge_ai_db', 'bridge_ai_test_db', 'bridge_ai_vitest_123_random'])(
    'rejects protected or disposable database %s',
    (databaseName) => {
      expect(() => validateDevelopmentDatabaseName(databaseName)).toThrow('DATABASE_REJECTED');
    }
  );

  it('accepts bridge_ai_dev and rejects unknown databases', () => {
    expect(() => validateDevelopmentDatabaseName('bridge_ai_dev')).not.toThrow();
    expect(() => validateDevelopmentDatabaseName('another_local_db')).toThrow('DATABASE_REJECTED');
  });

  it('hashes the supplied password only for creation without exposing it', async () => {
    const hashPassword = vi.fn().mockResolvedValue('opaque-password-hash');
    const createAdminUser = vi.fn().mockImplementation(async (input) => ({
      id: 'dev-user', email: input.email, role: 'ADMIN', accountState: 'ACTIVE',
    }));
    const result = await bootstrapDevelopmentAdmin(
      makeStore({ createAdminUser }), email, () => password, hashPassword
    );

    expect(hashPassword).toHaveBeenCalledOnce();
    expect(hashPassword).toHaveBeenCalledWith(password);
    expect(createAdminUser).toHaveBeenCalledWith(expect.objectContaining({
      email,
      passwordHash: 'opaque-password-hash',
    }));
    expect(JSON.stringify(result)).not.toContain(password);
    expect(JSON.stringify(result)).not.toContain('passwordHash');
  });

  it('handles an existing account without requesting, hashing, verifying, or changing a password', async () => {
    const getPassword = vi.fn();
    const hashPassword = vi.fn();
    const createAdminUser = vi.fn();
    const store = makeStore({
      findUserByEmail: vi.fn().mockResolvedValue({
        id: 'dev-user', email, role: 'ADMIN', accountState: 'ACTIVE',
      }),
      createAdminUser,
    });

    const result = await bootstrapDevelopmentAdmin(store, email, getPassword, hashPassword);
    expect(result).toEqual({ email, role: 'ADMIN', accountState: 'ACTIVE', status: 'existing' });
    expect(getPassword).not.toHaveBeenCalled();
    expect(hashPassword).not.toHaveBeenCalled();
    expect(createAdminUser).not.toHaveBeenCalled();
  });

  it('inspect requires no password and returns only safe metadata', async () => {
    const store = makeStore({
      findUserByEmail: vi.fn().mockResolvedValue({
        id: 'dev-user', email, role: 'ADMIN', accountState: 'ACTIVE',
      }),
    });
    const result = await inspectDevelopmentAdmin(store, email);
    expect(result).toEqual({ email, role: 'ADMIN', accountState: 'ACTIVE', status: 'existing' });
    expect(JSON.stringify(result)).not.toMatch(/password|hash|token|session/i);
  });

  it('inspect reports a missing account without creating anything', async () => {
    const createAdminUser = vi.fn();
    const result = await inspectDevelopmentAdmin(makeStore({ createAdminUser }), email);
    expect(result).toEqual({
      email, role: 'not-found', accountState: 'not-found', status: 'not-found',
    });
    expect(createAdminUser).not.toHaveBeenCalled();
  });

  it('password validation errors never include the supplied value', () => {
    const shortSecret = 'short-secret';
    expect(() => readDevelopmentAdminPassword({})).toThrow('required for initial account creation');
    try {
      readDevelopmentAdminPassword({ THRIVEWARD_DEV_ADMIN_PASSWORD: shortSecret });
    } catch (error) {
      expect((error as Error).message).not.toContain(shortSecret);
    }
  });
});
