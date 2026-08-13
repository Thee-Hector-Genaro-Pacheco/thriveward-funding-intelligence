import { FiscalSponsorService } from '../services/fiscalSponsorService';
import { prisma } from '../lib/prisma';

async function main() {
  console.log('🔧 Repairing existing database provenance and identity flags...');
  const { repairedCount } = await FiscalSponsorService.repairExistingDatabaseProvenance();
  console.log(`✅ Repair complete. Total records updated: ${repairedCount}`);

  const rows: any = await prisma.$queryRaw`
    SELECT
      "id",
      "name",
      "canonicalDomain",
      "isFixture",
      "hasLiveVerification",
      "isMerged",
      "mergedIntoId"
    FROM "FiscalSponsorCandidate"
    WHERE "canonicalDomain" IN (
      'communitypartners.org',
      'communityinitiatives.org',
      'saveourplanet.org'
    )
    ORDER BY "canonicalDomain", "isMerged", "id";
  `;

  console.log('Updated 6-Row Identity State:');
  console.log(JSON.stringify(rows, null, 2));
}

main()
  .catch((err) => {
    console.error('❌ Error repairing provenance:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
