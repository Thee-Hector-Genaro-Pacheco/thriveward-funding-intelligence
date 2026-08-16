import { PrismaClient } from '@prisma/client';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { AuthService } from '../services/authService';

const prisma = new PrismaClient();

export interface RepairOptions {
  execute?: boolean;
  confirmPhrase?: string;
  allowedDatabases?: string[];
  manifestPath?: string;
}

export async function runOperationalContaminationRepair(options: RepairOptions = {}) {
  const isExecute = !!options.execute;
  const confirmPhrase = options.confirmPhrase || '';
  const allowedDbs = options.allowedDatabases || ['bridge_ai_db', 'bridge_ai_repair_clone_db'];
  const manifestFile = options.manifestPath || path.join(__dirname, '../data-repair/manifests/20260816-operational-test-contamination.json');

  console.log(`[RepairEngine] Mode: ${isExecute ? 'EXECUTE' : 'DRY_RUN'}`);

  // 1. Validate Target Database Name
  const dbResult: any[] = await prisma.$queryRawUnsafe('SELECT current_database()');
  const currentDb = dbResult[0]?.current_database;
  console.log(`[RepairEngine] Current Database: ${currentDb}`);

  if (!allowedDbs.includes(currentDb)) {
    throw new Error(`[RepairEngine] Safety Abort: Target database '${currentDb}' is not in allowed list [${allowedDbs.join(', ')}]`);
  }

  // 2. Validate Execution Guards
  if (isExecute) {
    if (confirmPhrase !== 'RECONCILE_OPERATIONAL_CONTAMINATION_2026') {
      throw new Error('[RepairEngine] Safety Abort: Invalid confirmation phrase for --execute execution!');
    }
  }

  // 3. Load & Verify Manifest
  if (!fs.existsSync(manifestFile)) {
    throw new Error(`[RepairEngine] Manifest file not found at: ${manifestFile}`);
  }
  const manifestRaw = fs.readFileSync(manifestFile, 'utf8');
  const manifest = JSON.parse(manifestRaw);

  const sortedEventIds = manifest.classifiedAuditEvents.slice().sort();
  const computedDigest = crypto.createHash('sha256').update(sortedEventIds.join(':')).digest('hex');

  if (computedDigest !== manifest.manifestDigest) {
    throw new Error(`[RepairEngine] Manifest Digest Mismatch! Expected: ${manifest.manifestDigest}, Computed: ${computedDigest}`);
  }
  console.log('[RepairEngine] Manifest Digest Verified Successfully.');

  // 4. Check Idempotency (Already Applied Check)
  let existingBatch = null;
  try {
    existingBatch = await prisma.securityAuditClassificationBatch.findFirst({
      where: { batchName: manifest.batchName }
    });
  } catch (err: any) {
    if (err.code === 'P2021' || err.message?.includes('does not exist')) {
      console.log('[RepairEngine] Classification batch table not present yet in database.');
    } else {
      throw err;
    }
  }

  if (existingBatch) {
    console.log(`[RepairEngine] Repair batch '${manifest.batchName}' is ALREADY APPLIED. Returning idempotent result (0 writes).`);
    return {
      status: 'ALREADY_APPLIED',
      executed: false,
      message: 'Repair batch already applied to database.',
      batchId: existingBatch.id
    };
  }

  // 5. Verify Protected Invariants
  const liveEval = await prisma.aiEvaluation.findUnique({
    where: { id: '536c89cb-4b0c-4cd7-b61a-0f8b762ebec9' }
  });

  if (!liveEval || liveEval.opportunityId !== 'e9943e0c-120c-4035-b445-25ff5dfd888a') {
    throw new Error('[RepairEngine] Safety Abort: Protected live AI evaluation 536c89cb-4b0c-4cd7-b61a-0f8b762ebec9 not found or unlinked!');
  }

  // Verify inputHash against manifest
  const expectedHash = manifest.recoveryRecords.aiEvaluations[0].inputHash;
  if (liveEval.inputHash !== expectedHash) {
    throw new Error(`[RepairEngine] Safety Abort: Live AI evaluation inputHash mismatch! Expected: ${expectedHash}, Found: ${liveEval.inputHash}`);
  }

  // Verify Protected Opportunities
  const cocOpp = await prisma.fundingOpportunity.findUnique({
    where: { id: '1f975fa8-75c6-4c43-bab8-952dc2367be8' }
  });
  if (!cocOpp || cocOpp.fundingOpportunityNumber !== 'CPD-2600-DC-0025') {
    throw new Error('[RepairEngine] Safety Abort: Protected CoC replacement opportunity 1f975fa8-75c6-4c43-bab8-952dc2367be8 not found!');
  }

  // 6. Verify Target Synthetic Opportunities
  const targetOppIds = manifest.targetOpportunities.map((o: any) => o.id);
  const foundOpps = await prisma.fundingOpportunity.findMany({
    where: { id: { in: targetOppIds } },
    include: {
      _count: {
        select: {
          aiEvaluations: true,
          opportunityAnalyses: true,
          partnerMatches: true,
          engagements: true
        }
      }
    }
  });

  if (foundOpps.length !== manifest.targetOpportunities.length) {
    throw new Error(`[RepairEngine] Target Opportunities Mismatch! Found ${foundOpps.length} of ${manifest.targetOpportunities.length}`);
  }

  // Check for any unauthorized non-synthetic dependent records
  for (const opp of foundOpps) {
    if (opp._count.aiEvaluations > 0) {
      throw new Error(`[RepairEngine] Safety Abort: Target opportunity ${opp.id} has ${opp._count.aiEvaluations} AI evaluations!`);
    }
    if (opp._count.engagements > 0) {
      throw new Error(`[RepairEngine] Safety Abort: Target opportunity ${opp.id} has ${opp._count.engagements} outreach engagements!`);
    }
  }

  // 7. Verify Target Classified Audit Events
  const foundEvents = await prisma.securityAuditEvent.findMany({
    where: { id: { in: manifest.classifiedAuditEvents } },
    select: { id: true }
  });

  if (foundEvents.length !== manifest.classifiedAuditEvents.length) {
    throw new Error(`[RepairEngine] Classified Audit Events Mismatch! Found ${foundEvents.length} of ${manifest.classifiedAuditEvents.length}`);
  }

  console.log(`[RepairEngine] Dry Run Verification Summary:`);
  console.log(` - Target Synthetic Opportunities to Delete: ${foundOpps.length}`);
  console.log(` - Audit Events to Classify: ${foundEvents.length}`);
  console.log(` - Opportunity Recovery Records to Create: ${manifest.recoveryRecords.opportunities.length}`);
  console.log(` - AI Evaluation Recovery Records to Create: ${manifest.recoveryRecords.aiEvaluations.length}`);
  console.log(` - Reconciliation Audit Event to Append: 1`);

  if (!isExecute) {
    console.log('[RepairEngine] Dry Run Complete. Pass --execute and --confirm-phrase="RECONCILE_OPERATIONAL_CONTAMINATION_2026" to perform repair.');
    return {
      status: 'DRY_RUN_SUCCESS',
      executed: false,
      targetOpportunitiesCount: foundOpps.length,
      classifiedAuditEventsCount: foundEvents.length
    };
  }

  // 8. Execute Repair in a Single Database Transaction
  console.log('[RepairEngine] Executing Repair Transaction...');

  await prisma.$transaction(async (tx) => {
    // A. Create Classification Batch
    const batch = await tx.securityAuditClassificationBatch.create({
      data: {
        batchName: manifest.batchName,
        reason: manifest.reason,
        eventCount: manifest.classifiedAuditEvents.length,
        manifestDigest: manifest.manifestDigest,
        evidence: JSON.stringify({ manifestId: manifest.manifestId, targetOpportunitiesCount: foundOpps.length }),
        actorType: 'SYSTEM_DATA_REPAIR'
      }
    });

    // B. Create Audit Event Classifications (Bulk)
    const classificationData = manifest.classifiedAuditEvents.map((eventId: string) => ({
      securityAuditEventId: eventId,
      classificationBatchId: batch.id,
      classification: 'SYNTHETIC_TEST_EVENT',
      reason: 'Automated test suite execution prior to test database isolation guard.'
    }));

    await tx.securityAuditEventClassification.createMany({
      data: classificationData
    });

    // C. Create Opportunity Recovery Records
    for (const rec of manifest.recoveryRecords.opportunities) {
      await tx.fundingOpportunityRecoveryRecord.create({
        data: {
          originalOpportunityId: rec.originalOpportunityId,
          currentOpportunityId: rec.currentOpportunityId,
          fundingOpportunityNumber: rec.fundingOpportunityNumber,
          recoveryReason: rec.recoveryReason,
          recoveryMechanism: rec.recoveryMechanism,
          sourceEvidence: rec.sourceEvidence,
          actorType: 'SYSTEM_DATA_REPAIR'
        }
      });
    }

    // D. Create AI Evaluation Recovery Records
    for (const rec of manifest.recoveryRecords.aiEvaluations) {
      await tx.aiEvaluationRecoveryRecord.create({
        data: {
          aiEvaluationId: rec.aiEvaluationId,
          originalOpportunityId: rec.originalOpportunityId,
          currentOpportunityId: rec.currentOpportunityId,
          originalAuditEventId: rec.originalAuditEventId,
          inputHash: rec.inputHash,
          providerResponseId: rec.providerResponseId,
          recoveryReason: rec.recoveryReason,
          recoveryMechanism: rec.recoveryMechanism,
          fieldEquivalenceResult: rec.fieldEquivalenceResult,
          actorType: 'SYSTEM_DATA_REPAIR'
        }
      });
    }

    // E. Delete synthetic dependent records in exact reverse-dependency order
    await tx.opportunityAnalysis.deleteMany({ where: { fundingOpportunityId: { in: targetOppIds } } });
    await tx.sourceCitation.deleteMany({ where: { fundingOpportunityId: { in: targetOppIds } } });
    await tx.eligibilityRequirement.deleteMany({ where: { fundingOpportunityId: { in: targetOppIds } } });
    await tx.allowableCost.deleteMany({ where: { fundingOpportunityId: { in: targetOppIds } } });
    await tx.requiredDocument.deleteMany({ where: { fundingOpportunityId: { in: targetOppIds } } });
    await tx.scoringCriterion.deleteMany({ where: { fundingOpportunityId: { in: targetOppIds } } });
    await tx.sourceSnapshot.deleteMany({ where: { fundingOpportunityId: { in: targetOppIds } } });
    await tx.opportunityRelevance.deleteMany({ where: { fundingOpportunityId: { in: targetOppIds } } });
    await tx.pursuitHistory.deleteMany({ where: { fundingOpportunityId: { in: targetOppIds } } });

    await tx.fundingOpportunity.deleteMany({
      where: { id: { in: targetOppIds } }
    });
  });

  // F. Append Reconciliation Security Audit Event via AuthService (preserving audit logging)
  await AuthService.logSecurityEvent({
    eventType: 'DATA_RECONCILIATION',
    details: JSON.stringify({
      manifestId: manifest.manifestId,
      batchName: manifest.batchName,
      deletedOpportunitiesCount: targetOppIds.length,
      classifiedAuditEventsCount: manifest.classifiedAuditEvents.length,
      opportunityRecoveryRecordsCount: manifest.recoveryRecords.opportunities.length,
      aiEvaluationRecoveryRecordsCount: manifest.recoveryRecords.aiEvaluations.length,
      action: 'OPERATIONAL_CONTAMINATION_RECONCILIATION_COMPLETE'
    })
  });

  // 9. Post-Execution Validation
  const postOppCount = await prisma.fundingOpportunity.count();
  const postEvalCount = await prisma.aiEvaluation.count();
  const postAuditCount = await prisma.securityAuditEvent.count();
  const postClassCount = await prisma.securityAuditEventClassification.count();
  const postBatchCount = await prisma.securityAuditClassificationBatch.count();
  const postOppRecCount = await prisma.fundingOpportunityRecoveryRecord.count();
  const postEvalRecCount = await prisma.aiEvaluationRecoveryRecord.count();

  console.log('[RepairEngine] Repair Execution Complete. Post-Repair Fingerprint:');
  console.log(` - FundingOpportunities: ${postOppCount} (Expected: 14)`);
  console.log(` - AiEvaluations: ${postEvalCount} (Expected: 1)`);
  console.log(` - SecurityAuditEvents: ${postAuditCount} (Expected: 509)`);
  console.log(` - SecurityAuditEventClassifications: ${postClassCount} (Expected: 500)`);
  console.log(` - SecurityAuditClassificationBatches: ${postBatchCount} (Expected: 1)`);
  console.log(` - FundingOpportunityRecoveryRecords: ${postOppRecCount} (Expected: 2)`);
  console.log(` - AiEvaluationRecoveryRecords: ${postEvalRecCount} (Expected: 1)`);

  if (postOppCount !== 14 || postEvalCount !== 1 || postClassCount !== 500) {
    throw new Error('[RepairEngine] Safety Abort: Post-repair counts do not match expected invariant values!');
  }

  return {
    status: 'EXECUTE_SUCCESS',
    executed: true,
    postRepairCounts: {
      fundingOpportunities: postOppCount,
      aiEvaluations: postEvalCount,
      securityAuditEvents: postAuditCount,
      securityAuditEventClassifications: postClassCount,
      securityAuditClassificationBatches: postBatchCount,
      fundingOpportunityRecoveryRecords: postOppRecCount,
      aiEvaluationRecoveryRecords: postEvalRecCount
    }
  };
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const isExecute = args.includes('--execute');
  const confirmPhraseArg = args.find(a => a.startsWith('--confirm-phrase='))?.split('=')[1];

  runOperationalContaminationRepair({
    execute: isExecute,
    confirmPhrase: confirmPhraseArg
  }).then(result => {
    console.log('[RepairScript] Output:', JSON.stringify(result, null, 2));
    process.exit(0);
  }).catch(err => {
    console.error('[RepairScript] ERROR:', err.message || err);
    process.exit(1);
  });
}
