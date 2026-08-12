#!/usr/bin/env tsx
import dotenv from 'dotenv';
import { IngestionService } from '../services/ingestionService';

dotenv.config();

export function parseArgs(args: string[]) {
  let keyword = 'reentry';
  let statuses = 'forecasted|posted';
  let limit = 3;
  let persist = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--keyword') {
      const val = args[++i];
      if (!val || val.startsWith('--')) {
        throw new Error('Option --keyword requires a non-empty string value');
      }
      keyword = val;
    } else if (arg === '--statuses') {
      const val = args[++i];
      if (!val || val.startsWith('--')) {
        throw new Error('Option --statuses requires a value (e.g. "forecasted|posted")');
      }
      statuses = val;
    } else if (arg === '--limit') {
      const val = Number(args[++i]);
      if (isNaN(val) || val < 1) {
        throw new Error('Option --limit must be a positive integer');
      }
      limit = Math.min(val, 10);
    } else if (arg === '--persist') {
      persist = true;
    } else if (arg === '--dry-run') {
      persist = false;
    } else {
      throw new Error(`Unsupported option: '${arg}'. Supported options: --keyword, --statuses, --limit, --dry-run, --persist`);
    }
  }

  return { keyword, statuses, limit, dryRun: !persist };
}

async function main() {
  const args = process.argv.slice(2);
  console.log('🏛️  Bridge AI — Official Grants.gov Ingestion CLI');

  try {
    const options = parseArgs(args);
    console.log(`📋 Configuration: Keyword="${options.keyword}", Statuses="${options.statuses}", Limit=${options.limit}, Mode=${options.dryRun ? 'DRY RUN (No DB changes)' : 'PERSIST (Save to DB)'}`);

    const service = new IngestionService();
    const summary = await service.ingestFromGrantsGov(options);

    console.log('\n📊 Ingestion Run Execution Summary:');
    console.log(`-----------------------------------`);
    console.log(`  • Run ID:           ${summary.ingestionRunId}`);
    console.log(`  • Mode:             ${summary.dryRun ? 'DRY RUN' : 'PERSISTED TO DB'}`);
    console.log(`  • Status:           ${summary.status}`);
    console.log(`  • Records Discovered: ${summary.recordsDiscovered}`);
    console.log(`  • Records Created:    ${summary.recordsCreated}`);
    console.log(`  • Records Updated:    ${summary.recordsUpdated}`);
    console.log(`  • Records Unchanged:  ${summary.recordsUnchanged}`);
    console.log(`  • Records Failed:     ${summary.recordsFailed}`);

    if (summary.errorSummary) {
      console.warn(`\n⚠️ Error Summary: ${summary.errorSummary}`);
    }

    console.log('\n✅ Grants.gov ingestion CLI execution completed.');
    process.exit(summary.recordsFailed > 0 ? 1 : 0);
  } catch (err: any) {
    console.error(`\n❌ Ingestion CLI Error: ${err.message || err}`);
    process.exit(1);
  }
}

if (process.env.NODE_ENV !== 'test' && !process.env.VITEST) {
  main();
}
