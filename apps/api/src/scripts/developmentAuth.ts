import dotenv from 'dotenv';
import path from 'path';

dotenv.config({
  path: path.resolve(process.cwd(), '../../.env.development.local'),
});

async function main(): Promise<void> {
  const command = process.argv[2];
  if (command !== 'bootstrap' && command !== 'inspect') {
    throw new Error('Usage: developmentAuth.ts <bootstrap|inspect>');
  }

  const [{ prisma }, workflow] = await Promise.all([
    import('../lib/prisma'),
    import('../services/developmentAuthWorkflow'),
  ]);
  const email = workflow.readDevelopmentAdminEmail(process.env);
  const store: import('../services/developmentAuthWorkflow').DevelopmentAuthStore = {
    async getCurrentDatabaseName() {
      const rows = await prisma.$queryRaw<Array<{ database_name: string }>>`
        SELECT current_database() AS database_name
      `;
      const name = rows[0]?.database_name;
      if (!name) throw new Error('Unable to determine the connected PostgreSQL database.');
      return name;
    },
    findUserByEmail(email) {
      return prisma.user.findUnique({
        where: { email },
        select: { id: true, email: true, role: true, accountState: true },
      });
    },
    createAdminUser(input) {
      return prisma.user.create({
        data: {
          ...input,
          role: 'ADMIN',
          accountState: 'ACTIVE',
          mustChangePassword: false,
        },
      });
    },
  };

  try {
    const result = command === 'bootstrap'
      ? await workflow.bootstrapDevelopmentAdmin(
          store,
          email,
          () => workflow.readDevelopmentAdminPassword(process.env),
          async (password) => {
            const { AuthService } = await import('../services/authService');
            return AuthService.hashPassword(password);
          }
        )
      : await workflow.inspectDevelopmentAdmin(store, email);
    const message = result.status === 'existing' && command === 'bootstrap'
      ? 'Development account already exists; password unchanged.'
      : `Development account ${result.status}.`;
    console.log(`[Development Auth] ${message} email=${result.email} role=${result.role} state=${result.accountState}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Development authentication failed.';
  console.error(`[Development Auth] ${message}`);
  process.exitCode = 1;
});
