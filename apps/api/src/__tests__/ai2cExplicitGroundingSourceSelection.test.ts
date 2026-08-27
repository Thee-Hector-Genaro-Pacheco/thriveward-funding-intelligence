import crypto from 'crypto';
import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../server';
import { prisma } from '../lib/prisma';
import { DocumentChunkerService } from '../services/ai/documentChunkerService';
import { DeterministicDocumentEmbeddingProvider } from '../services/ai/deterministicDocumentEmbeddingProvider';
import { DocumentIndexingService } from '../services/documentIndexingService';
import { DocumentRetrievalService } from '../services/documentRetrievalService';
import { AiFundingAnalystService } from '../services/aiFundingAnalystService';
import { MockFundingAnalystProvider } from '../services/ai/mockFundingAnalystProvider';
import { AuthService } from '../services/authService';

describe('AI-2C — Explicit Grounding Source Selection Backend Suite', () => {
  const TEST_OPP_A_ID = 'test-ai2c-opp-a-1001';
  const TEST_OPP_B_ID = 'test-ai2c-opp-b-1002';

  const TEST_DOC_A_ID = 'test-ai2c-doc-a-1001';
  const TEST_DOC_VER_A1_ID = 'test-ai2c-doc-ver-a1-1001';
  const TEST_DOC_VER_A2_ID = 'test-ai2c-doc-ver-a2-1002';
  const TEST_DOC_VER_A3_UNREADY_ID = 'test-ai2c-doc-ver-a3-unready-1003';
  const TEST_DOC_VER_A4_NOINDEX_ID = 'test-ai2c-doc-ver-a4-noindex-1004';

  const TEST_DOC_B_ID = 'test-ai2c-doc-b-1002';
  const TEST_DOC_VER_B1_ID = 'test-ai2c-doc-ver-b1-2001';

  let adminUser: any;
  let adminToken: string;

  beforeAll(async () => {
    // 1. Ensure test admin user exists and obtain auth token
    const existingAdmin = await prisma.user.findUnique({ where: { email: 'admin@projectthriveward.org' } });
    if (!existingAdmin) {
      const passwordHash = await AuthService.hashPassword('h3lloWorld!!');
      adminUser = await prisma.user.create({
        data: {
          id: 'ac0b7f55-0e42-43ae-897f-627ff7d9fb75',
          email: 'admin@projectthriveward.org',
          displayName: 'Hector Pacheco',
          passwordHash,
          role: 'ADMIN',
          accountState: 'ACTIVE',
        },
      });
    } else {
      adminUser = existingAdmin;
    }

    // 2. Create Opportunity A and Opportunity B fixtures
    await prisma.fundingOpportunity.upsert({
      where: { id: TEST_OPP_A_ID },
      update: {},
      create: {
        id: TEST_OPP_A_ID,
        title: 'Community Housing & Outreach Grant (AI-2C Opp A)',
        fundingAgency: 'U.S. Department of Housing and Urban Development',
        fundingOpportunityNumber: 'NOFO-HUD-2026-AI2C-A',
        description: 'Synthetic grant notice fixture for AI-2C testing.',
        sourceSystem: 'DEMO_FIXTURE',
        sourceUrl: 'https://example.gov/ai2c-opp-a',
        candidateRoutingStatus: 'FISCAL_SPONSOR_REQUIRED',
        pursuitStage: 'NEW',
      },
    });

    await prisma.fundingOpportunity.upsert({
      where: { id: TEST_OPP_B_ID },
      update: {},
      create: {
        id: TEST_OPP_B_ID,
        title: 'Youth Reentry Pathways Grant (AI-2C Opp B)',
        fundingAgency: 'U.S. Department of Labor',
        fundingOpportunityNumber: 'NOFO-DOL-2026-AI2C-B',
        description: 'Synthetic grant notice fixture for AI-2C testing opp B.',
        sourceSystem: 'DEMO_FIXTURE',
        sourceUrl: 'https://example.gov/ai2c-opp-b',
        candidateRoutingStatus: 'FISCAL_SPONSOR_REQUIRED',
        pursuitStage: 'NEW',
      },
    });

    // 3. Create Document A for Opportunity A with 4 versions:
    // Version A1 (v1, older, READY, indexed)
    // Version A2 (v2, newer, READY, indexed)
    // Version A3 (v3, status PROCESSING, no index)
    // Version A4 (v4, status READY, no index)
    await prisma.fundingDocument.upsert({
      where: { id: TEST_DOC_A_ID },
      update: {},
      create: {
        id: TEST_DOC_A_ID,
        fundingOpportunityId: TEST_OPP_A_ID,
        documentType: 'OFFICIAL_NOTICE',
        title: 'HUD NOFO Official Guidelines (Doc A)',
        officialSourceUrl: 'https://example.gov/doc-a.pdf',
      },
    });

    // Version A1
    const verA1 = await prisma.fundingDocumentVersion.upsert({
      where: { id: TEST_DOC_VER_A1_ID },
      update: {},
      create: {
        id: TEST_DOC_VER_A1_ID,
        fundingDocumentId: TEST_DOC_A_ID,
        version: 1,
        status: 'READY',
        originalFileName: 'hud_nofo_v1.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 102400,
        sha256: crypto.createHash('sha256').update('verA1').digest('hex'),
        storageKey: 'test/verA1.pdf',
        pageCount: 2,
        extractionVersion: 'v1.0',
        uploadedByUserId: adminUser.id,
        createdAt: new Date('2026-08-01T10:00:00Z'),
      },
    });

    // Index & Chunk for Version A1
    const idxA1 = await prisma.fundingDocumentIndex.create({
      data: {
        documentVersionId: verA1.id,
        embeddingProvider: 'DETERMINISTIC_MOCK',
        embeddingModel: 'deterministic-mock-v1',
        embeddingDimensions: 1536,
        chunkCount: 1,
        sourceManifestHash: 'hash-test-manifest',
        configurationHash: DocumentIndexingService.computeFullIndexConfigurationHash('hash-config-test', new DeterministicDocumentEmbeddingProvider(1536)),
        pageCount: 1,
        indexedByUserId: adminUser.id,
        version: 1,
        status: 'READY',
      },
    });

    const pageA1 = await prisma.fundingDocumentPage.create({
      data: {
        documentVersionId: verA1.id,
        pageNumber: 1,
        text: 'Version 1 NOFO Text: Applicant eligibility requires 501c3 status and fiscal sponsorship for housing programs.',
        textHash: crypto.createHash('sha256').update('Page A1').digest('hex'),
        characterCount: 100,
        citationRef: 'DOC.verA1.P1',
      },
    });

    await prisma.$executeRawUnsafe(
      `INSERT INTO "FundingDocumentChunk" ("id", "documentIndexId", "documentPageId", "pageNumber", "chunkIndex", "startOffset", "endOffset", "text", "textHash", "tokenCount", "citationRef", "embedding", "createdAt")
       VALUES ($1, $2, $3, 1, 0, 0, 100, $4, $5, 20, $6, $7::vector, NOW())
       ON CONFLICT ("documentIndexId", "pageNumber", "chunkIndex") DO NOTHING;`,
      'chunk-a1-0',
      idxA1.id,
      pageA1.id,
      pageA1.text,
      crypto.createHash('sha256').update(pageA1.text).digest('hex'),
      'DOC.verA1.P1.C0',
      JSON.stringify(new Array(1536).fill(0.1))
    );

    // Version A2 (Newer READY version)
    const verA2 = await prisma.fundingDocumentVersion.upsert({
      where: { id: TEST_DOC_VER_A2_ID },
      update: {},
      create: {
        id: TEST_DOC_VER_A2_ID,
        fundingDocumentId: TEST_DOC_A_ID,
        version: 2,
        status: 'READY',
        originalFileName: 'hud_nofo_v2_amended.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 105000,
        sha256: crypto.createHash('sha256').update('verA2').digest('hex'),
        storageKey: 'test/verA2.pdf',
        pageCount: 2,
        extractionVersion: 'v1.0',
        uploadedByUserId: adminUser.id,
        createdAt: new Date('2026-08-10T10:00:00Z'),
      },
    });

    const idxA2 = await prisma.fundingDocumentIndex.create({
      data: {
        documentVersionId: verA2.id,
        embeddingProvider: 'DETERMINISTIC_MOCK',
        embeddingModel: 'deterministic-mock-v1',
        embeddingDimensions: 1536,
        chunkCount: 1,
        sourceManifestHash: 'hash-test-manifest',
        configurationHash: DocumentIndexingService.computeFullIndexConfigurationHash('hash-config-test', new DeterministicDocumentEmbeddingProvider(1536)),
        pageCount: 1,
        indexedByUserId: adminUser.id,
        version: 1,
        status: 'READY',
      },
    });

    const pageA2 = await prisma.fundingDocumentPage.create({
      data: {
        documentVersionId: verA2.id,
        pageNumber: 1,
        text: 'Version 2 Amended NOFO Text: Priority funding allocated for community reentry programs.',
        textHash: crypto.createHash('sha256').update('Page A2').digest('hex'),
        characterCount: 90,
        citationRef: 'DOC.verA2.P1',
      },
    });

    await prisma.$executeRawUnsafe(
      `INSERT INTO "FundingDocumentChunk" ("id", "documentIndexId", "documentPageId", "pageNumber", "chunkIndex", "startOffset", "endOffset", "text", "textHash", "tokenCount", "citationRef", "embedding", "createdAt")
       VALUES ($1, $2, $3, 1, 0, 0, 90, $4, $5, 18, $6, $7::vector, NOW())
       ON CONFLICT ("documentIndexId", "pageNumber", "chunkIndex") DO NOTHING;`,
      'chunk-a2-0',
      idxA2.id,
      pageA2.id,
      pageA2.text,
      crypto.createHash('sha256').update(pageA2.text).digest('hex'),
      'DOC.verA2.P1.C0',
      JSON.stringify(new Array(1536).fill(0.1))
    );

    // Version A3 (Unready status: PROCESSING)
    await prisma.fundingDocumentVersion.upsert({
      where: { id: TEST_DOC_VER_A3_UNREADY_ID },
      update: {},
      create: {
        id: TEST_DOC_VER_A3_UNREADY_ID,
        fundingDocumentId: TEST_DOC_A_ID,
        version: 3,
        status: 'PROCESSING',
        originalFileName: 'hud_nofo_v3_draft.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 105000,
        sha256: crypto.createHash('sha256').update('verA3').digest('hex'),
        storageKey: 'test/verA3.pdf',
        pageCount: 1,
        extractionVersion: 'v1.0',
        uploadedByUserId: adminUser.id,
        createdAt: new Date('2026-08-15T10:00:00Z'),
      },
    });

    // Version A4 (READY status, but no READY index)
    await prisma.fundingDocumentVersion.upsert({
      where: { id: TEST_DOC_VER_A4_NOINDEX_ID },
      update: {},
      create: {
        id: TEST_DOC_VER_A4_NOINDEX_ID,
        fundingDocumentId: TEST_DOC_A_ID,
        version: 4,
        status: 'READY',
        originalFileName: 'hud_nofo_v4_noindex.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 105000,
        sha256: crypto.createHash('sha256').update('verA4').digest('hex'),
        storageKey: 'test/verA4.pdf',
        pageCount: 1,
        extractionVersion: 'v1.0',
        uploadedByUserId: adminUser.id,
        createdAt: new Date('2026-08-18T10:00:00Z'),
      },
    });

    // 4. Create Document B for Opportunity B
    await prisma.fundingDocument.upsert({
      where: { id: TEST_DOC_B_ID },
      update: {},
      create: {
        id: TEST_DOC_B_ID,
        fundingOpportunityId: TEST_OPP_B_ID,
        documentType: 'OFFICIAL_NOTICE',
        title: 'DOL Reentry Guidelines (Doc B)',
        officialSourceUrl: 'https://example.gov/doc-b.pdf',
      },
    });

    const verB1 = await prisma.fundingDocumentVersion.upsert({
      where: { id: TEST_DOC_VER_B1_ID },
      update: {},
      create: {
        id: TEST_DOC_VER_B1_ID,
        fundingDocumentId: TEST_DOC_B_ID,
        version: 1,
        status: 'READY',
        originalFileName: 'dol_reentry_v1.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 90000,
        sha256: crypto.createHash('sha256').update('verB1').digest('hex'),
        storageKey: 'test/verB1.pdf',
        pageCount: 1,
        extractionVersion: 'v1.0',
        uploadedByUserId: adminUser.id,
        createdAt: new Date('2026-08-05T10:00:00Z'),
      },
    });

    const idxB1 = await prisma.fundingDocumentIndex.create({
      data: {
        documentVersionId: verB1.id,
        embeddingProvider: 'DETERMINISTIC_MOCK',
        embeddingModel: 'deterministic-mock-v1',
        embeddingDimensions: 1536,
        chunkCount: 1,
        sourceManifestHash: 'hash-test-manifest',
        configurationHash: DocumentIndexingService.computeFullIndexConfigurationHash('hash-config-test', new DeterministicDocumentEmbeddingProvider(1536)),
        pageCount: 1,
        indexedByUserId: adminUser.id,
        version: 1,
        status: 'READY',
      },
    });

    const pageB1 = await prisma.fundingDocumentPage.create({
      data: {
        documentVersionId: verB1.id,
        pageNumber: 1,
        text: 'DOL Reentry Text for Opp B.',
        textHash: crypto.createHash('sha256').update('Page B1').digest('hex'),
        characterCount: 30,
        citationRef: 'DOC.verB1.P1',
      },
    });

    await prisma.$executeRawUnsafe(
      `INSERT INTO "FundingDocumentChunk" ("id", "documentIndexId", "documentPageId", "pageNumber", "chunkIndex", "startOffset", "endOffset", "text", "textHash", "tokenCount", "citationRef", "embedding", "createdAt")
       VALUES ($1, $2, $3, 1, 0, 0, 30, $4, $5, 6, $6, $7::vector, NOW())
       ON CONFLICT ("documentIndexId", "pageNumber", "chunkIndex") DO NOTHING;`,
      'chunk-b1-0',
      idxB1.id,
      pageB1.id,
      pageB1.text,
      crypto.createHash('sha256').update(pageB1.text).digest('hex'),
      'DOC.verB1.P1.C0',
      JSON.stringify(new Array(1536).fill(0.1))
    );
  });

  beforeEach(() => {
    DocumentIndexingService.setProvider(new DeterministicDocumentEmbeddingProvider());
    AiFundingAnalystService.setProvider(new MockFundingAnalystProvider());
    process.env.AI_DOCUMENT_GROUNDING_ENABLED = 'true';
    process.env.AI_FUNDING_ANALYST_ENABLED = 'true';
  });

  afterEach(() => {
    DocumentIndexingService.resetProvider();
    AiFundingAnalystService.resetProvider();
  });

  afterAll(async () => {
    process.env.AI_DOCUMENT_GROUNDING_ENABLED = 'true';
    const testDocVers = [TEST_DOC_VER_A1_ID, TEST_DOC_VER_A2_ID, TEST_DOC_VER_A3_UNREADY_ID, TEST_DOC_VER_A4_NOINDEX_ID, TEST_DOC_VER_B1_ID];
    const testOpps = [TEST_OPP_A_ID, TEST_OPP_B_ID];
    const testDocs = [TEST_DOC_A_ID, TEST_DOC_B_ID];

    await prisma.aiEvaluationRetrievalEvidence.deleteMany({
      where: { retrievalRun: { evaluation: { opportunityId: { in: testOpps } } } },
    });
    await prisma.aiEvaluationRetrievalRun.deleteMany({
      where: { evaluation: { opportunityId: { in: testOpps } } },
    });
    await prisma.aiEvaluation.deleteMany({
      where: { opportunityId: { in: testOpps } },
    });
    await prisma.fundingDocumentChunk.deleteMany({
      where: { documentIndex: { documentVersionId: { in: testDocVers } } },
    });
    await prisma.fundingDocumentIndex.deleteMany({
      where: { documentVersionId: { in: testDocVers } },
    });
    await prisma.fundingDocumentPage.deleteMany({
      where: { documentVersionId: { in: testDocVers } },
    });
    await prisma.fundingDocumentVersion.deleteMany({
      where: { id: { in: testDocVers } },
    });
    await prisma.fundingDocument.deleteMany({
      where: { id: { in: testDocs } },
    });
    await prisma.fundingOpportunity.deleteMany({
      where: { id: { in: testOpps } },
    });
  });

  it('1. Reject grounded evaluation request when documentVersionId is missing', async () => {
    const res = await request(app)
      .post(`/api/opportunities/${TEST_OPP_A_ID}/document-grounded-ai-evaluations`)
      .set('x-test-role', 'ADMIN').set('X-Thriveward-CSRF', '1')
      .send({ idempotencyKey: 'test_missing_doc_ver_id' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toContain('INVALID_DOCUMENT_VERSION_ID');
  });

  it('2. Exact selection: Requesting Version A1 retrieves strictly from Version A1 index even though Version A2 is newer', async () => {
    const retrievalResult = await DocumentRetrievalService.executeRetrieval({
      opportunityId: TEST_OPP_A_ID,
      documentVersionId: TEST_DOC_VER_A1_ID,
      provider: new DeterministicDocumentEmbeddingProvider(),
    });

    expect(retrievalResult.documentVersionId).toBe(TEST_DOC_VER_A1_ID);
    expect(retrievalResult.retrievedEvidence.length).toBeGreaterThan(0);
    for (const chunk of retrievalResult.retrievedEvidence) {
      expect(chunk.citationRef).toContain('DOC.verA1');
    }
  });

  it('3. Exact selection: Requesting Version A2 retrieves strictly from Version A2 index', async () => {
    const retrievalResult = await DocumentRetrievalService.executeRetrieval({
      opportunityId: TEST_OPP_A_ID,
      documentVersionId: TEST_DOC_VER_A2_ID,
      provider: new DeterministicDocumentEmbeddingProvider(),
    });

    expect(retrievalResult.documentVersionId).toBe(TEST_DOC_VER_A2_ID);
    expect(retrievalResult.retrievedEvidence.length).toBeGreaterThan(0);
    for (const chunk of retrievalResult.retrievedEvidence) {
      expect(chunk.citationRef).toContain('DOC.verA2');
    }
  });

  it('4. Opportunity isolation: Requesting Version B1 (belonging to Opp B) for Opportunity A is rejected', async () => {
    const res = await request(app)
      .post(`/api/opportunities/${TEST_OPP_A_ID}/document-grounded-ai-evaluations`)
      .set('x-test-role', 'ADMIN').set('X-Thriveward-CSRF', '1')
      .send({
        documentVersionId: TEST_DOC_VER_B1_ID,
        idempotencyKey: 'test_opp_mismatch',
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toContain('DOCUMENT_VERSION_OPPORTUNITY_MISMATCH');
  });

  it('5. Not READY version: Requesting Version A3 (status PROCESSING) is rejected', async () => {
    const res = await request(app)
      .post(`/api/opportunities/${TEST_OPP_A_ID}/document-grounded-ai-evaluations`)
      .set('x-test-role', 'ADMIN').set('X-Thriveward-CSRF', '1')
      .send({
        documentVersionId: TEST_DOC_VER_A3_UNREADY_ID,
        idempotencyKey: 'test_ver_unready',
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toContain('DOCUMENT_VERSION_NOT_READY');
  });

  it('6. Missing/unready index: Requesting Version A4 (status READY, but no READY index) is rejected', async () => {
    const res = await request(app)
      .post(`/api/opportunities/${TEST_OPP_A_ID}/document-grounded-ai-evaluations`)
      .set('x-test-role', 'ADMIN').set('X-Thriveward-CSRF', '1')
      .send({
        documentVersionId: TEST_DOC_VER_A4_NOINDEX_ID,
        idempotencyKey: 'test_ver_noindex',
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toContain('DOCUMENT_INDEX_NOT_READY');
  });

  it('7. Non-existent documentVersionId returns 404 DOCUMENT_VERSION_NOT_FOUND', async () => {
    const res = await request(app)
      .post(`/api/opportunities/${TEST_OPP_A_ID}/document-grounded-ai-evaluations`)
      .set('x-test-role', 'ADMIN').set('X-Thriveward-CSRF', '1')
      .send({
        documentVersionId: '00000000-0000-0000-0000-000000000000',
        idempotencyKey: 'test_ver_nonexistent',
      });

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toContain('DOCUMENT_VERSION_NOT_FOUND');
  });

  it('8. Retrieval provenance: End-to-end grounded evaluation creation with explicit version returns complete source provenance metadata', async () => {
    const res = await request(app)
      .post(`/api/opportunities/${TEST_OPP_A_ID}/document-grounded-ai-evaluations`)
      .set('x-test-role', 'ADMIN').set('X-Thriveward-CSRF', '1')
      .send({
        documentVersionId: TEST_DOC_VER_A1_ID,
        idempotencyKey: 'test_e2e_explicit_v1',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    const evalData = res.body.data;
    expect(evalData.id).toBeDefined();

    // Fetch retrieved evidence endpoint
    const evidenceRes = await request(app)
      .get(`/api/ai-evaluations/${evalData.id}/retrieved-evidence`)
      .set('x-test-role', 'ADMIN').set('X-Thriveward-CSRF', '1');

    expect(evidenceRes.status).toBe(200);
    expect(evidenceRes.body.success).toBe(true);
    const evidenceData = evidenceRes.body.data;
    expect(evidenceData.documentVersionId).toBe(TEST_DOC_VER_A1_ID);
    expect(evidenceData.documentVersionNumber).toBe(1);
    expect(evidenceData.documentType).toBe('OFFICIAL_NOTICE');
    expect(evidenceData.documentTitle).toBe('HUD NOFO Official Guidelines (Doc A)');
  });
});
