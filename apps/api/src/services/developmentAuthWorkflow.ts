export const DEVELOPMENT_DATABASE_NAME = 'bridge_ai_dev';
export const DEVELOPMENT_ADMIN_EMAIL = 'dev-admin@projectthriveward.local';

interface DevelopmentUser {
  id: string;
  email: string;
  role: string;
  accountState: string;
}

export interface DevelopmentAuthStore {
  getCurrentDatabaseName(): Promise<string>;
  findUserByEmail(email: string): Promise<DevelopmentUser | null>;
  createAdminUser(input: {
    email: string;
    displayName: string;
    passwordHash: string;
  }): Promise<DevelopmentUser>;
}

export interface DevelopmentAuthResult {
  email: string;
  role: string;
  accountState: string;
  status: 'created' | 'existing' | 'not-found';
}

export function validateDevelopmentDatabaseName(databaseName: string): void {
  if (databaseName !== DEVELOPMENT_DATABASE_NAME) {
    throw new Error(
      `DEVELOPMENT_AUTH_DATABASE_REJECTED: connected database must be exactly ${DEVELOPMENT_DATABASE_NAME}.`
    );
  }
}

export function readDevelopmentAdminEmail(env: NodeJS.ProcessEnv): string {
  const email = (env.THRIVEWARD_DEV_ADMIN_EMAIL || '').toLowerCase().trim();

  if (!email) {
    throw new Error('THRIVEWARD_DEV_ADMIN_EMAIL is required.');
  }
  if (email !== DEVELOPMENT_ADMIN_EMAIL) {
    throw new Error(`Development admin email must be ${DEVELOPMENT_ADMIN_EMAIL}.`);
  }
  return email;
}

export function readDevelopmentAdminPassword(env: NodeJS.ProcessEnv): string {
  const password = env.THRIVEWARD_DEV_ADMIN_PASSWORD || '';
  if (!password) {
    throw new Error('THRIVEWARD_DEV_ADMIN_PASSWORD is required for initial account creation.');
  }
  if (password.length < 12) {
    throw new Error('THRIVEWARD_DEV_ADMIN_PASSWORD must be at least 12 characters long.');
  }

  return password;
}

async function validateEnvironmentAndDatabase(store: DevelopmentAuthStore): Promise<void> {
  if (process.env.NODE_ENV !== 'development') {
    throw new Error('DEVELOPMENT_AUTH_ENVIRONMENT_REJECTED: NODE_ENV must be development.');
  }
  validateDevelopmentDatabaseName(await store.getCurrentDatabaseName());
}

function enforceDevelopmentAdmin(user: DevelopmentUser): void {
  if (user.role !== 'ADMIN') {
    throw new Error('DEVELOPMENT_AUTH_ROLE_MISMATCH: configured account must already have ADMIN role.');
  }
  if (user.accountState !== 'ACTIVE') {
    throw new Error('DEVELOPMENT_AUTH_ACCOUNT_INACTIVE: configured account must be ACTIVE.');
  }
}

export async function bootstrapDevelopmentAdmin(
  store: DevelopmentAuthStore,
  email: string,
  getPassword: () => string,
  hashPassword: (password: string) => Promise<string>
): Promise<DevelopmentAuthResult> {
  await validateEnvironmentAndDatabase(store);
  const existing = await store.findUserByEmail(email);

  if (existing) {
    enforceDevelopmentAdmin(existing);
    return { email: existing.email, role: existing.role, accountState: existing.accountState, status: 'existing' };
  }

  const passwordHash = await hashPassword(getPassword());
  const created = await store.createAdminUser({
    email,
    displayName: 'Development Administrator',
    passwordHash,
  });
  enforceDevelopmentAdmin(created);
  return { email: created.email, role: created.role, accountState: created.accountState, status: 'created' };
}

export async function inspectDevelopmentAdmin(
  store: DevelopmentAuthStore,
  email: string
): Promise<DevelopmentAuthResult> {
  await validateEnvironmentAndDatabase(store);
  const existing = await store.findUserByEmail(email);
  if (!existing) {
    return { email, role: 'not-found', accountState: 'not-found', status: 'not-found' };
  }
  return { email: existing.email, role: existing.role, accountState: existing.accountState, status: 'existing' };
}
