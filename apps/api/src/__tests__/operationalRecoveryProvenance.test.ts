import { describe, it, expect, beforeAll } from 'vitest';
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

    // Seed dummy protected live evaluation records for script dry-run validation in test DB
    const adminUser = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
    if (!adminUser) return;

    await prisma.fundingOpportunity.upsert({
      where: { id: 'e9943e0c-120c-4035-b445-25ff5dfd888a' },
      update: {},
      create: {
        id: 'e9943e0c-120c-4035-b445-25ff5dfd888a',
        title: 'Street Outreach Program',
        description: 'Street outreach program for homeless youth.',
        fundingAgency: 'ACF',
        fundingOpportunityNumber: 'HHS-2026-ACF-ACYF-YO-0044',
        sourceSystem: 'GRANTS_GOV',
        sourceUrl: 'https://www.grants.gov/search-results-detail/362088'
      }
    });

    await prisma.fundingOpportunity.upsert({
      where: { id: '1f975fa8-75c6-4c43-bab8-952dc2367be8' },
      update: {},
      create: {
        id: '1f975fa8-75c6-4c43-bab8-952dc2367be8',
        title: 'FY2026 Continuum of Care Competition and Youth Homelessness Demonstration Program',
        description: 'Continuum of care competition.',
        fundingAgency: 'HUD',
        fundingOpportunityNumber: 'CPD-2600-DC-0025',
        sourceSystem: 'GRANTS_GOV',
        sourceUrl: 'https://www.grants.gov/search-results-detail/350000'
      }
    });

    await prisma.aiEvaluation.upsert({
      where: { id: '536c89cb-4b0c-4cd7-b61a-0f8b762ebec9' },
      update: {},
      create: {
        id: '536c89cb-4b0c-4cd7-b61a-0f8b762ebec9',
        opportunityId: 'e9943e0c-120c-4035-b445-25ff5dfd888a',
        alignmentScore: 85,
        eligibility: AiEligibilityRating.LIKELY_ELIGIBLE,
        summary: 'Test summary',
        strengths: [],
        risks: [],
        requirements: [],
        recommendedNextAction: 'Review',
        confidence: 0.9,
        limitations: [],
        evidenceSnapshot: {},
        inputSnapshot: { opportunityId: '16ad49b0-e869-4420-bbbe-c9cb43563950' },
        inputHash: '012f021af2498bb1df13cf0a9efb096f90a59da8f445e58d9a2a3ea591803b44',
        generatedByUserId: adminUser.id
      }
    });
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

    const user = await prisma.user.findFirst();
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
        generatedByUserId: user!.id
      }
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
