#!/usr/bin/env tsx
import dotenv from 'dotenv';
import { IngestionService } from '../services/ingestionService';

dotenv.config();

export function parseArgs(args: string[]) {
  let keyword = 'reentry';
  let profile: string | undefined;
  let statuses = 'forecasted|posted';
  let limit = 3;
  let persist = false;
  let verbose = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--keyword') {
      const val = args[++i];
      if (!val || val.startsWith('--')) {
        throw new Error('Option --keyword requires a non-empty string value');
      }
      keyword = val;
    } else if (arg === '--profile') {
      const val = args[++i];
      if (!val || val.startsWith('--')) {
        throw new Error('Option --profile requires a string value (e.g. "bridge-forward")');
      }
      profile = val;
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
    } else if (arg === '--verbose') {
      verbose = true;
    } else {
      throw new Error(`Unsupported option: '${arg}'. Supported options: --keyword, --profile, --statuses, --limit, --dry-run, --persist, --verbose`);
    }
  }

  return { keyword, profile, statuses, limit, dryRun: !persist, verbose };
}

async function main() {
  const args = process.argv.slice(2);
  console.log('🏛️  Bridge AI — Official Grants.gov Ingestion CLI');

  try {
    const options = parseArgs(args);
    console.log(
      `📋 Configuration: ${options.profile ? `Profile="${options.profile}"` : `Keyword="${options.keyword}"`}, Statuses="${options.statuses}", Limit=${options.limit}, Mode=${options.dryRun ? 'DRY RUN (No DB changes)' : 'PERSIST (Save to DB)'}`
    );

    const service = new IngestionService();
    const summary = await service.ingestFromGrantsGov(options);

    console.log('\n📊 Ingestion Run Execution Summary:');
    console.log(`-----------------------------------`);
    console.log(`  • Run ID:                            ${summary.ingestionRunId}`);
    console.log(`  • Mode:                              ${summary.dryRun ? 'DRY RUN (No DB changes)' : 'PERSISTED TO DB'}`);
    console.log(`  • Status:                            ${summary.status}`);
    console.log(`  • Raw Search Hits Discovered:        ${summary.rawSearchHitsCount}`);
    console.log(`  • Detailed Records Inspected:        ${summary.recordsInspected}`);
    console.log(`  • Records Excluded:                  ${summary.recordsExcluded}`);
    console.log(`    - EXCLUDED_FOREIGN_PLACE_OF_PERFORMANCE: ${summary.exclusionReasonsCount.EXCLUDED_FOREIGN_PLACE_OF_PERFORMANCE || 0}`);
    console.log(`    - EXCLUDED_RESEARCH_ONLY:             ${summary.exclusionReasonsCount.EXCLUDED_RESEARCH_ONLY || 0}`);
    console.log(`    - EXCLUDED_CLINICAL_RESEARCH:         ${summary.exclusionReasonsCount.EXCLUDED_CLINICAL_RESEARCH || 0}`);
    console.log(`    - EXCLUDED_LAW_ENFORCEMENT_PROGRAM:   ${summary.exclusionReasonsCount.EXCLUDED_LAW_ENFORCEMENT_PROGRAM || 0}`);
    console.log(`    - EXCLUDED_APPLICANT_TYPE:            ${summary.exclusionReasonsCount.EXCLUDED_APPLICANT_TYPE || 0}`);
    console.log(`    - EXCLUDED_RFI:                       ${summary.exclusionReasonsCount.EXCLUDED_RFI || 0}`);
    console.log(`    - EXCLUDED_INVITED_ONLY:              ${summary.exclusionReasonsCount.EXCLUDED_INVITED_ONLY || 0}`);
    console.log(`    - EXCLUDED_REIMBURSEMENT_PROGRAM:     ${summary.exclusionReasonsCount.EXCLUDED_REIMBURSEMENT_PROGRAM || 0}`);
    console.log(`    - EXCLUDED_CONTEXTUALLY_IRRELEVANT:   ${summary.exclusionReasonsCount.EXCLUDED_CONTEXTUALLY_IRRELEVANT || 0}`);
    console.log(`    - NO_MISSION_LANE_MATCH:              ${summary.exclusionReasonsCount.NO_MISSION_LANE_MATCH || 0}`);
    console.log(`  • Records Routed to FUTURE_OPPORTUNITY: ${summary.recordsRoutedFuture}`);
    console.log(`  • Records Routed to PARTNERSHIP_REQUIRED: ${summary.recordsRoutedPartnership}`);
    console.log(`  • Records Deduplicated:              ${summary.recordsDeduplicated}`);
    console.log(`  • Records Accepted (Actionable):     ${summary.recordsAccepted}`);
    console.log(`  • Records Created:                   ${summary.recordsCreated}`);
    console.log(`  • Records Updated:                   ${summary.recordsUpdated}`);
    console.log(`  • Records Unchanged:                 ${summary.recordsUnchanged}`);
    console.log(`  • Records Failed:                    ${summary.recordsFailed}`);
    console.log(`  • Persisted Opportunity Numbers:     ${summary.persistedOpportunityNumbers.length > 0 ? summary.persistedOpportunityNumbers.join(', ') : 'None'}`);

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

if (process.argv[1]?.includes('ingestGrantsGov')) {
  main();
}
