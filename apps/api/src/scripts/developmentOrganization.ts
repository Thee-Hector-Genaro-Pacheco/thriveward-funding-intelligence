import dotenv from 'dotenv';
import path from 'path';
import { createOrganizationProfile } from '../services/organizationProfilePersistenceService';

dotenv.config({
  path: path.resolve(process.cwd(), '../../.env.development.local'),
});

async function main(): Promise<void> {
  const command = process.argv[2];
  if (command !== 'bootstrap' && command !== 'inspect') {
    throw new Error('Usage: developmentOrganization.ts <bootstrap|inspect>');
  }

  const [{ prisma }, workflow] = await Promise.all([
    import('../lib/prisma'),
    import('../services/developmentOrganizationWorkflow'),
  ]);
  const store: import('../services/developmentOrganizationWorkflow').DevelopmentOrganizationStore = {
    async getCurrentDatabaseName() {
      const rows = await prisma.$queryRaw<Array<{ database_name: string }>>`
        SELECT current_database() AS database_name
      `;
      const name = rows[0]?.database_name;
      if (!name) throw new Error('Unable to determine the connected PostgreSQL database.');
      return name;
    },
    findProjectThriveward() {
      return prisma.organizationProfile.findFirst({
        where: { name: workflow.DEVELOPMENT_ORGANIZATION_PROFILE.name },
        select: { id: true, name: true, status: true, taxStatus: true, limitations: true },
      });
    },
    createProjectThriveward(input) {
      return createOrganizationProfile(prisma.organizationProfile, {
          name: input.name,
          status: input.status,
          taxStatus: input.taxStatus,
          primaryPopulations: [...input.primaryPopulations],
          primaryOutcome: input.primaryOutcome,
          coreModel: input.coreModel,
          limitations: [...input.limitations],
      });
    },
  };

  try {
    const result = command === 'bootstrap'
      ? await workflow.bootstrapDevelopmentOrganization(store)
      : await workflow.inspectDevelopmentOrganization(store);
    console.log(JSON.stringify(result));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Development organization operation failed.';
  console.error(`[Development Organization] ${message}`);
  process.exitCode = 1;
});
