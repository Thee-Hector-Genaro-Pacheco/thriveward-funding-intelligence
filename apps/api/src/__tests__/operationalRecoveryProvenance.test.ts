import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient, AiEligibilityRating } from '@prisma/client';
import path from 'path';
import { runOperationalContaminationRepair } from '../scripts/reconcileOperationalContamination';
import { AuthService } from '../services/authService';
import { AiFundingAnalystService } from '../services/aiFundingAnalystService';

const prisma = new PrismaClient();

describe('Operational Recovery Provenance & Audit Classification Suite', () => {
  beforeAll(async () => {
    // Ensure we are operating strictly on test database
    const dbRes: any[] = await prisma.$queryRawUnsafe('SELECT current_database()');
    if (dbRes[0]?.current_database !== 'bridge_ai_test_db') {
      throw new Error(`[SAFETY_ABORT] Test suite must run against bridge_ai_test_db. Received: ${dbRes[0]?.current_database}`);
    }
  });

  it('1. Repair command fails closed if wrong database name is provided', async () => {
    await expect(
      runOperationalContaminationRepair({
        execute: true,
        confirmPhrase: 'RECONCILE_OPERATIONAL_CONTAMINATION_2026',
        allowedDatabases: ['some_other_db']
      })
    ).rejects.toThrow(/Safety Abort: Target database/);
  });

  it('2. Repair command fails closed if confirmation phrase is invalid', async () => {
    await expect(
      runOperationalContaminationRepair({
        execute: true,
        confirmPhrase: 'INVALID_PHRASE',
        allowedDatabases: ['bridge_ai_test_db']
      })
    ).rejects.toThrow(/Invalid confirmation phrase/);
  });

  it('3. Repair command fails closed if manifest file is missing or invalid', async () => {
    await expect(
      runOperationalContaminationRepair({
        execute: true,
        confirmPhrase: 'RECONCILE_OPERATIONAL_CONTAMINATION_2026',
        allowedDatabases: ['bridge_ai_test_db'],
        manifestPath: path.join(__dirname, 'non_existent_manifest.json')
      })
    ).rejects.toThrow(/Manifest file not found/);
  });

  it('4. getAuditEvents filters out classified synthetic test events by default', async () => {
    const event = await prisma.securityAuditEvent.create({
      data: {
        eventType: 'LOGIN_FAILURE',
        details: JSON.stringify({ reason: 'UNIT_TEST_EVENT' })
      }
    });

    const batch = await prisma.securityAuditClassificationBatch.create({
      data: {
        batchName: `test-batch-${Date.now()}`,
        reason: 'Unit test classification',
        eventCount: 1,
        manifestDigest: 'test-digest'
      }
    });

    await prisma.securityAuditEventClassification.create({
      data: {
        securityAuditEventId: event.id,
        classificationBatchId: batch.id,
        classification: 'SYNTHETIC_TEST_EVENT',
        reason: 'Unit test synthetic classification'
      }
    });

    const defaultEvents = await AuthService.getAuditEvents({ includeSyntheticTestEvents: false });
    const foundDefault = defaultEvents.find(e => e.id === event.id);
    expect(foundDefault).toBeUndefined();

    const allEvents = await AuthService.getAuditEvents({ includeSyntheticTestEvents: true });
    const foundAll = allEvents.find(e => e.id === event.id);
    expect(foundAll).toBeDefined();
    expect(foundAll?.classifiedLabel).toContain('Synthetic automated-test event');
  });

  it('5. AiFundingAnalystService.getEvaluationWithProvenance returns recovery notice if recovery record exists', async () => {
    const opp = await prisma.fundingOpportunity.create({
      data: {
        title: 'Test Recovery Opp',
        description: 'Description',
        fundingAgency: 'Test Agency',
        sourceSystem: 'GRANTS_GOV',
        sourceUrl: 'https://example.com/test',
        externalOpportunityId: `unit-rec-${Date.now()}`
      }
    });

    let user = await prisma.user.findFirst();
    if (!user) {
      user = await prisma.user.create({
        data: {
          email: `unit-user-${Date.now()}@example.org`,
          displayName: 'Unit User',
          passwordHash: 'hash',
          role: 'ADMIN',
        },
      });
    }

    const evalRecord = await prisma.aiEvaluation.create({
      data: {
        opportunityId: opp.id,
        alignmentScore: 80,
        eligibility: AiEligibilityRating.LIKELY_ELIGIBLE,
        summary: 'Test summary',
        strengths: [],
        risks: [],
        requirements: [],
        recommendedNextAction: 'Action',
        confidence: 0.9,
        limitations: [],
        evidenceSnapshot: {},
        inputSnapshot: { opportunityId: 'original-dummy-opp-id' },
        inputHash: 'hash123',
        generatedByUserId: user.id,
      },
    });


    await prisma.aiEvaluationRecoveryRecord.create({
      data: {
        aiEvaluationId: evalRecord.id,
        originalOpportunityId: 'original-dummy-opp-id',
        currentOpportunityId: opp.id,
        inputHash: 'hash123',
        recoveryReason: 'Unit test recovery test',
        recoveryMechanism: 'TEST_RECONSTRUCTION',
        fieldEquivalenceResult: JSON.stringify({ contentIdentical: true })
      }
    });

    const res = await AiFundingAnalystService.getEvaluationWithProvenance(evalRecord.id);
    expect(res).not.toBeNull();
    expect(res?.recoveryNotice).toContain('Recovery provenance: This evaluation\'s persistence row was reconstructed');
    expect(res?.recoveryNotice).toContain('original-dummy-opp-id');
    expect(res?.inputHash).toBe('hash123');
  });
});
