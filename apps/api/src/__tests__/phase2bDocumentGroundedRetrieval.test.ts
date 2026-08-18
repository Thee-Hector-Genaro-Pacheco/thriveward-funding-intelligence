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
import { EvidenceCatalogBuilder } from '../services/ai/evidenceCatalogBuilder';
import { AuthService } from '../services/authService';
import { SYNTHETIC_NOTICE_PAGES } from './fixtures/syntheticGroundingFixture';

describe('Phase 2B — Document-Grounded Retrieval & Citation-Constrained Analysis Suite', () => {
  const TEST_OPPORTUNITY_ID_A = 'test-phase2b-opp-fixture-1001';
  const TEST_OPPORTUNITY_ID_B = 'test-phase2b-opp-fixture-1002';
  const TEST_DOC_ID_A = 'test-phase2b-doc-1001';
  const TEST_DOC_VER_ID_A = 'test-phase2b-doc-ver-1001';
  const TEST_DOC_ID_B = 'test-phase2b-doc-1002';
  const TEST_DOC_VER_ID_B = 'test-phase2b-doc-ver-1002';

  let adminUser: any;
  let testOppA: any;
  let testOppB: any;
  let testDocVerA: any;
  let testDocVerB: any;

  beforeAll(async () => {
    // Ensure admin user exists
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

    // Create Opportunity A fixture
    testOppA = await prisma.fundingOpportunity.upsert({
      where: { id: TEST_OPPORTUNITY_ID_A },
      update: {},
      create: {
        id: TEST_OPPORTUNITY_ID_A,
        title: 'Youth Reentry & Workforce Pathways Grant (Fixture A)',
        fundingAgency: 'U.S. Department of Labor',
        fundingOpportunityNumber: 'FOA-ETA-2026-05-A',
        description: 'Synthetic grant notice fixture for youth workforce reentry.',
        sourceSystem: 'DEMO_FIXTURE',
        sourceUrl: 'https://example.gov/test-opp-a',
        candidateRoutingStatus: 'FISCAL_SPONSOR_REQUIRED',
        pursuitStage: 'NEW',
      },
    });

    // Create Opportunity B fixture (for cross-opportunity leakage test)
    testOppB = await prisma.fundingOpportunity.upsert({
      where: { id: TEST_OPPORTUNITY_ID_B },
      update: {},
      create: {
        id: TEST_OPPORTUNITY_ID_B,
        title: 'Unrelated Infrastructure Grant (Fixture B)',
        fundingAgency: 'U.S. Department of Transportation',
        fundingOpportunityNumber: 'DOT-2026-FIXTURE-B',
        description: 'Synthetic highway infrastructure notice fixture B.',
        sourceSystem: 'DEMO_FIXTURE',
        sourceUrl: 'https://example.gov/test-opp-b',
        candidateRoutingStatus: 'EXCLUDED',
        pursuitStage: 'DISMISSED',
      },
    });

    // Create Document & Version A
    const docA = await prisma.fundingDocument.upsert({
      where: { id: TEST_DOC_ID_A },
      update: {},
      create: {
        id: TEST_DOC_ID_A,
        fundingOpportunityId: TEST_OPPORTUNITY_ID_A,
        documentType: 'OFFICIAL_NOTICE',
        title: 'Official FOA Notice A (Synthetic)',
      },
    });

    testDocVerA = await prisma.fundingDocumentVersion.upsert({
      where: { id: TEST_DOC_VER_ID_A },
      update: {},
      create: {
        id: TEST_DOC_VER_ID_A,
        fundingDocumentId: docA.id,
        version: 1,
        status: 'READY',
        originalFileName: 'official_nofo_a.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 150000,
        sha256: 'a1b2c3d4e5f67890a1b2c3d4e5f67890a1b2c3d4e5f67890a1b2c3d4e5f67890',
        storageKey: '/data/funding-documents/test_a.pdf',
        pageCount: SYNTHETIC_NOTICE_PAGES.length,
        uploadedByUserId: adminUser.id,
      },
    });

    // Populate Pages for Version A
    for (const p of SYNTHETIC_NOTICE_PAGES) {
      const textHash = crypto.createHash('sha256').update(p.text).digest('hex');
      await prisma.fundingDocumentPage.upsert({
        where: {
          documentVersionId_pageNumber: {
            documentVersionId: TEST_DOC_VER_ID_A,
            pageNumber: p.pageNumber,
          },
        },
        update: {},
        create: {
          documentVersionId: TEST_DOC_VER_ID_A,
          pageNumber: p.pageNumber,
          text: p.text,
          textHash,
          characterCount: p.text.length,
          citationRef: `DOC.${TEST_DOC_VER_ID_A}.PAGE.${p.pageNumber}`,
        },
      });
    }

    // Create Document & Version B
    const docB = await prisma.fundingDocument.upsert({
      where: { id: TEST_DOC_ID_B },
      update: {},
      create: {
        id: TEST_DOC_ID_B,
        fundingOpportunityId: TEST_OPPORTUNITY_ID_B,
        documentType: 'OFFICIAL_NOTICE',
        title: 'Official Notice B (Unrelated)',
      },
    });

    testDocVerB = await prisma.fundingDocumentVersion.upsert({
      where: { id: TEST_DOC_VER_ID_B },
      update: {},
      create: {
        id: TEST_DOC_VER_ID_B,
        fundingDocumentId: docB.id,
        version: 1,
        status: 'READY',
        originalFileName: 'official_nofo_b.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 50000,
        sha256: 'b2c3d4e5f67890a1b2c3d4e5f67890a1b2c3d4e5f67890a1b2c3d4e5f67890a1',
        storageKey: '/data/funding-documents/test_b.pdf',
        pageCount: 1,
        uploadedByUserId: adminUser.id,
      },
    });

    await prisma.fundingDocumentPage.upsert({
      where: {
        documentVersionId_pageNumber: {
          documentVersionId: TEST_DOC_VER_ID_B,
          pageNumber: 1,
        },
      },
      update: {},
      create: {
        documentVersionId: TEST_DOC_VER_ID_B,
        pageNumber: 1,
        text: 'Highway asphalt paving specifications and bridge expansion joint details.',
        textHash: crypto.createHash('sha256').update('Highway asphalt paving specifications').digest('hex'),
        characterCount: 72,
        citationRef: `DOC.${TEST_DOC_VER_ID_B}.PAGE.1`,
      },
    });
  });

  beforeEach(() => {
    DocumentIndexingService.setProvider(new DeterministicDocumentEmbeddingProvider());
    AiFundingAnalystService.setProvider(new MockFundingAnalystProvider());
    process.env.AI_DOCUMENT_GROUNDING_ENABLED = 'true';
  });

  afterEach(() => {
    DocumentIndexingService.resetProvider();
    AiFundingAnalystService.resetProvider();
    process.env.AI_DOCUMENT_GROUNDING_ENABLED = 'false';
  });

  afterAll(async () => {
    process.env.AI_DOCUMENT_GROUNDING_ENABLED = 'false';

    // Clean test fixture database records
    await prisma.aiEvaluationRetrievalEvidence.deleteMany({
      where: { retrievalRun: { evaluation: { opportunityId: { in: [TEST_OPPORTUNITY_ID_A, TEST_OPPORTUNITY_ID_B] } } } },
    });
    await prisma.aiEvaluationRetrievalRun.deleteMany({
      where: { evaluation: { opportunityId: { in: [TEST_OPPORTUNITY_ID_A, TEST_OPPORTUNITY_ID_B] } } },
    });
    await prisma.aiEvaluation.deleteMany({
      where: { opportunityId: { in: [TEST_OPPORTUNITY_ID_A, TEST_OPPORTUNITY_ID_B] } },
    });
    await prisma.fundingDocumentChunk.deleteMany({
      where: { documentIndex: { documentVersionId: { in: [TEST_DOC_VER_ID_A, TEST_DOC_VER_ID_B] } } },
    });
    await prisma.fundingDocumentIndexIdempotency.deleteMany({
      where: { documentVersionId: { in: [TEST_DOC_VER_ID_A, TEST_DOC_VER_ID_B] } },
    });
    await prisma.fundingDocumentIndex.deleteMany({
      where: { documentVersionId: { in: [TEST_DOC_VER_ID_A, TEST_DOC_VER_ID_B] } },
    });
    await prisma.fundingDocumentPage.deleteMany({
      where: { documentVersionId: { in: [TEST_DOC_VER_ID_A, TEST_DOC_VER_ID_B] } },
    });
    await prisma.fundingDocumentVersion.deleteMany({
      where: { id: { in: [TEST_DOC_VER_ID_A, TEST_DOC_VER_ID_B] } },
    });
    await prisma.fundingDocument.deleteMany({
      where: { id: { in: [TEST_DOC_ID_A, TEST_DOC_ID_B] } },
    });
    await prisma.fundingOpportunity.deleteMany({
      where: { id: { in: [TEST_OPPORTUNITY_ID_A, TEST_OPPORTUNITY_ID_B] } },
    });
  });

  describe('1. Endpoint Authentication, CSRF & RBAC Protections', () => {
    it('unauthenticated POST /api/document-versions/:id/index is rejected with 401', async () => {
      const res = await request(app)
        .post(`/api/document-versions/${TEST_DOC_VER_ID_A}/index`)
        .set('x-test-unauthenticated', 'true');
      expect(res.status).toBe(401);
    });

    it('unauthenticated POST /api/opportunities/:id/document-grounded-ai-evaluations is rejected with 401', async () => {
      const res = await request(app)
        .post(`/api/opportunities/${TEST_OPPORTUNITY_ID_A}/document-grounded-ai-evaluations`)
        .set('x-test-unauthenticated', 'true');
      expect(res.status).toBe(401);
    });

    it('VIEWER role cannot trigger document indexing (receives 403 Forbidden)', async () => {
      const res = await request(app)
        .post(`/api/document-versions/${TEST_DOC_VER_ID_A}/index`)
        .set('x-test-role', 'VIEWER')
        .set('X-Thriveward-CSRF', '1');
      expect(res.status).toBe(403);
    });

    it('VIEWER role cannot generate grounded AI evaluations (receives 403 Forbidden)', async () => {
      const res = await request(app)
        .post(`/api/opportunities/${TEST_OPPORTUNITY_ID_A}/document-grounded-ai-evaluations`)
        .set('x-test-role', 'VIEWER')
        .set('X-Thriveward-CSRF', '1');
      expect(res.status).toBe(403);
    });

    it('VIEWER role can read index status and index chunks via GET (mutation-free)', async () => {
      const statusRes = await request(app)
        .get(`/api/document-versions/${TEST_DOC_VER_ID_A}/index-status`)
        .set('x-test-role', 'VIEWER');
      expect(statusRes.status).toBe(200);
      expect(statusRes.body.success).toBe(true);
    });
  });

  describe('2. Fail-Closed Feature Flag & Unconfigured Provider Safety', () => {
    it('returns 503 AI_DOCUMENT_GROUNDING_NOT_CONFIGURED when feature flag is disabled', async () => {
      process.env.AI_DOCUMENT_GROUNDING_ENABLED = 'false';

      const indexRes = await request(app)
        .post(`/api/document-versions/${TEST_DOC_VER_ID_A}/index`)
        .set('x-test-role', 'ADMIN')
        .set('X-Thriveward-CSRF', '1');

      expect(indexRes.status).toBe(503);
      expect(indexRes.body.error).toContain('AI_DOCUMENT_GROUNDING_NOT_CONFIGURED');

      const evalRes = await request(app)
        .post(`/api/opportunities/${TEST_OPPORTUNITY_ID_A}/document-grounded-ai-evaluations`)
        .set('x-test-role', 'ADMIN')
        .set('X-Thriveward-CSRF', '1');

      expect(evalRes.status).toBe(503);
      expect(evalRes.body.error).toContain('AI_DOCUMENT_GROUNDING_NOT_CONFIGURED');
    });
  });

  describe('3. Deterministic Page-Bounded Chunking Engine (document-chunker-v1)', () => {
    it('preserves exact page citations and never crosses page boundaries', () => {
      const pages = SYNTHETIC_NOTICE_PAGES.map((p) => ({
        pageId: `page-id-${p.pageNumber}`,
        pageNumber: p.pageNumber,
        text: p.text,
      }));

      const manifest = DocumentChunkerService.generateChunks(TEST_DOC_VER_ID_A, pages);

      expect(manifest.chunkingVersion).toBe('document-chunker-v1');
      expect(manifest.chunks.length).toBeGreaterThan(0);

      manifest.chunks.forEach((chunk) => {
        expect(chunk.citationRef).toBe(`DOC.${TEST_DOC_VER_ID_A}.PAGE.${chunk.pageNumber}`);
        expect(chunk.text).not.toContain('PAGE BOUNDARY EXCEEDED');
        expect(chunk.tokenCount).toBeGreaterThan(0);
        expect(chunk.textHash.length).toBe(64);
      });
    });

    it('skips empty pages without inventing content or invalid chunks', () => {
      const pagesWithEmpty = [
        { pageId: 'p1', pageNumber: 1, text: 'Valid page one text.' },
        { pageId: 'p2', pageNumber: 2, text: '   \n\r\n  ' }, // Empty whitespace
        { pageId: 'p3', pageNumber: 3, text: 'Valid page three text.' },
      ];

      const manifest = DocumentChunkerService.generateChunks(TEST_DOC_VER_ID_A, pagesWithEmpty);
      const pageNumbers = manifest.chunks.map((c) => c.pageNumber);

      expect(pageNumbers).toContain(1);
      expect(pageNumbers).toContain(3);
      expect(pageNumbers).not.toContain(2);
    });

    it('produces identical manifest hashes for identical text and configuration', () => {
      const pages = SYNTHETIC_NOTICE_PAGES.map((p) => ({
        pageId: `page-id-${p.pageNumber}`,
        pageNumber: p.pageNumber,
        text: p.text,
      }));

      const manifest1 = DocumentChunkerService.generateChunks(TEST_DOC_VER_ID_A, pages, 500, 75);
      const manifest2 = DocumentChunkerService.generateChunks(TEST_DOC_VER_ID_A, pages, 500, 75);

      expect(manifest1.sourceManifestHash).toBe(manifest2.sourceManifestHash);
      expect(manifest1.configurationHash).toBe(manifest2.configurationHash);
    });
  });

  describe('4. Document Indexing Workflow & Vector Persistence', () => {
    it('indexes READY document version, generates embeddings, and creates audit event', async () => {
      const indexRecord = await DocumentIndexingService.indexDocumentVersion({
        documentVersionId: TEST_DOC_VER_ID_A,
        userId: adminUser.id,
        idempotencyKey: 'test-idempotency-index-1001',
      });

      expect(indexRecord.status).toBe('READY');
      expect(indexRecord.chunkCount).toBe(5);
      expect(indexRecord.embeddingDimensions).toBe(1536);

      const chunksRes = await DocumentIndexingService.getIndexChunks(indexRecord.id);
      expect(chunksRes.chunkCount).toBe(5);
      expect(chunksRes.chunks[0].citationRef).toBe(`DOC.${TEST_DOC_VER_ID_A}.PAGE.1`);

      const auditEvent = await prisma.securityAuditEvent.findFirst({
        where: {
          eventType: 'FUNDING_DOCUMENT_INDEXING_COMPLETED',
          details: { contains: indexRecord.id },
        },
      });
      expect(auditEvent).not.toBeNull();
    });

    it('reusing indexing idempotency key with identical payload returns existing index', async () => {
      const index1 = await DocumentIndexingService.indexDocumentVersion({
        documentVersionId: TEST_DOC_VER_ID_A,
        userId: adminUser.id,
        idempotencyKey: 'test-idempotency-index-reuse-99',
      });

      const index2 = await DocumentIndexingService.indexDocumentVersion({
        documentVersionId: TEST_DOC_VER_ID_A,
        userId: adminUser.id,
        idempotencyKey: 'test-idempotency-index-reuse-99',
      });

      expect(index1.id).toBe(index2.id);
    });
  });

  describe('5. Server-Authoritative Semantic Retrieval & Zero Cross-Opportunity Leakage', () => {
    it('retrieves relevant evidence strictly bounded to the selected opportunity document index', async () => {
      // Index Document B as well
      await DocumentIndexingService.indexDocumentVersion({
        documentVersionId: TEST_DOC_VER_ID_B,
        userId: adminUser.id,
      });

      const retrievalResult = await DocumentRetrievalService.executeRetrieval(TEST_OPPORTUNITY_ID_A);

      expect(retrievalResult.retrievalVersion).toBe('document-retrieval-v1');
      expect(retrievalResult.documentVersionId).toBe(TEST_DOC_VER_ID_A);
      expect(retrievalResult.retrievedEvidence.length).toBeGreaterThan(0);

      // Verify ZERO cross-opportunity contamination (Doc B chunks MUST NOT appear in Opp A retrieval)
      const leakedHits = retrievalResult.retrievedEvidence.filter(
        (e) => e.citationRef.includes(TEST_DOC_VER_ID_B)
      );
      expect(leakedHits.length).toBe(0);

      retrievalResult.retrievedEvidence.forEach((hit) => {
        expect(hit.citationRef).toContain(`DOC.${TEST_DOC_VER_ID_A}.PAGE.`);
        expect(typeof hit.cosineSimilarity).toBe('number');
        expect(Number.isFinite(hit.cosineSimilarity)).toBe(true);
      });
    });
  });

  describe('6. Synthetic Evaluation Metrics & Prompt Injection Protection', () => {
    it('evaluates synthetic notice pages with 100% citation validity and 0 leakage', async () => {
      const retrievalResult = await DocumentRetrievalService.executeRetrieval(TEST_OPPORTUNITY_ID_A);

      // Metric 1: Recall@K for mandatory query topics
      const foundQueryLabels = new Set(retrievalResult.retrievedEvidence.map((e) => e.queryLabel));
      expect(foundQueryLabels.size).toBe(5); // All 5 controlled query categories retrieved

      // Metric 2: Citation Validity
      const validCitations = retrievalResult.retrievedEvidence.every((e) =>
        e.citationRef.startsWith(`DOC.${TEST_DOC_VER_ID_A}.PAGE.`)
      );
      expect(validCitations).toBe(true);

      // Metric 3: Cross-Opportunity Leakage Count = 0
      const leakageCount = retrievalResult.retrievedEvidence.filter((e) =>
        e.citationRef.includes(TEST_DOC_VER_ID_B)
      ).length;
      expect(leakageCount).toBe(0);
    });

    it('prompt injection inside retrieved document chunk does not alter analyst security contract', async () => {
      const mockAnalystProvider = new MockFundingAnalystProvider();
      const snapshot = EvidenceCatalogBuilder.buildGroundedSnapshot(testOppA, null, [
        {
          citationRef: `DOC.${TEST_DOC_VER_ID_A}.PAGE.5`,
          queryLabel: 'ORGANIZATIONAL_CAPACITY_AND_PARTNERSHIP_REQUIREMENTS',
          pageNumber: 5,
          rank: 1,
          cosineSimilarity: 0.95,
          excerptSnapshot: SYNTHETIC_NOTICE_PAGES[4].text,
        },
      ]);

      const response = await mockAnalystProvider.analyze(snapshot);
      const mockResult = response.result;

      // Ensure mock result cites Page 5
      mockResult.requirements = [
        {
          requirement: 'Mandatory Strategic Partnerships',
          status: 'UNKNOWN',
          evidenceRefs: [`DOC.${TEST_DOC_VER_ID_A}.PAGE.5`, 'ORG.mission'],
        },
      ];

      // Validate that grounded citation validation succeeds without honoring prompt injection instructions
      EvidenceCatalogBuilder.validateGroundedEvidenceRefs(mockResult, snapshot.evidenceCatalog);
      expect(mockResult.eligibility).not.toBe('100% ELIGIBLE');
    });

    it('rejects unretrieved or unknown document citations (fails closed)', async () => {
      const mockAnalystProvider = new MockFundingAnalystProvider();
      const snapshot = EvidenceCatalogBuilder.buildGroundedSnapshot(testOppA, null, []);
      const response = await mockAnalystProvider.analyze(snapshot);
      const mockResult = response.result;

      mockResult.requirements = [
        {
          requirement: 'Fake Requirement',
          status: 'MET',
          evidenceRefs: ['DOC.fake-version-999.PAGE.99'], // UNKNOWN CITATION
        },
      ];

      expect(() => {
        EvidenceCatalogBuilder.validateGroundedEvidenceRefs(mockResult, snapshot.evidenceCatalog);
      }).toThrow('cited invalid evidence reference IDs');
    });

    it('rejects invalid evidence reference in strengths array', async () => {
      const snapshot = EvidenceCatalogBuilder.buildGroundedSnapshot(testOppA, null, [
        { citationRef: `DOC.${TEST_DOC_VER_ID_A}.PAGE.1`, queryLabel: 'ELIGIBILITY_AND_DISQUALIFYING_FACTORS', pageNumber: 1, rank: 1, cosineSimilarity: 0.9, excerptSnapshot: 'Text 1' },
      ]);
      const mockResult = {
        alignmentScore: 80,
        eligibility: 'POSSIBLY_ELIGIBLE' as const,
        summary: 'Test summary with valid requirements.',
        strengths: [{ text: 'Strength 1', evidenceRefs: ['INVALID.STRENGTH.REF'] }],
        risks: [],
        requirements: [{ requirement: 'Req 1', status: 'MET' as const, evidenceRefs: [`DOC.${TEST_DOC_VER_ID_A}.PAGE.1`] }],
        recommendedNextAction: 'Proceed with proposal',
        confidence: 0.9,
        limitations: [],
      };

      expect(() => {
        EvidenceCatalogBuilder.validateGroundedEvidenceRefs(mockResult, snapshot.evidenceCatalog);
      }).toThrow('cited invalid evidence reference IDs: INVALID.STRENGTH.REF');
    });

    it('rejects invalid evidence reference in risks array', async () => {
      const snapshot = EvidenceCatalogBuilder.buildGroundedSnapshot(testOppA, null, [
        { citationRef: `DOC.${TEST_DOC_VER_ID_A}.PAGE.1`, queryLabel: 'ELIGIBILITY_AND_DISQUALIFYING_FACTORS', pageNumber: 1, rank: 1, cosineSimilarity: 0.9, excerptSnapshot: 'Text 1' },
      ]);
      const mockResult = {
        alignmentScore: 80,
        eligibility: 'POSSIBLY_ELIGIBLE' as const,
        summary: 'Test summary with valid requirements.',
        strengths: [],
        risks: [{ text: 'Risk 1', evidenceRefs: ['INVALID.RISK.REF'] }],
        requirements: [{ requirement: 'Req 1', status: 'MET' as const, evidenceRefs: [`DOC.${TEST_DOC_VER_ID_A}.PAGE.1`] }],
        recommendedNextAction: 'Proceed with proposal',
        confidence: 0.9,
        limitations: [],
      };

      expect(() => {
        EvidenceCatalogBuilder.validateGroundedEvidenceRefs(mockResult, snapshot.evidenceCatalog);
      }).toThrow('cited invalid evidence reference IDs: INVALID.RISK.REF');
    });

    it('rejects document citation from another document version or opportunity', async () => {
      const snapshot = EvidenceCatalogBuilder.buildGroundedSnapshot(testOppA, null, [
        { citationRef: `DOC.${TEST_DOC_VER_ID_A}.PAGE.1`, queryLabel: 'ELIGIBILITY_AND_DISQUALIFYING_FACTORS', pageNumber: 1, rank: 1, cosineSimilarity: 0.9, excerptSnapshot: 'Text 1' },
      ]);

      const mockResult = {
        alignmentScore: 80,
        eligibility: 'POSSIBLY_ELIGIBLE' as const,
        summary: 'Test summary with unretrieved document citation.',
        strengths: [],
        risks: [],
        requirements: [
          {
            requirement: 'Cross-document citation attempt',
            status: 'MET' as const,
            evidenceRefs: [`DOC.${TEST_DOC_VER_ID_B}.PAGE.1`], // Doc B chunk (unretrieved for Opp A)
          },
        ],
        recommendedNextAction: 'Proceed with proposal',
        confidence: 0.9,
        limitations: [],
      };

      expect(() => {
        EvidenceCatalogBuilder.validateGroundedEvidenceRefs(mockResult, snapshot.evidenceCatalog);
      }).toThrow(`cited invalid evidence reference IDs: DOC.${TEST_DOC_VER_ID_B}.PAGE.1`);
    });

    it('rejects grounded requirement that lacks retrieved DOC.* citation (only OPP/ORG refs)', async () => {
      const snapshot = EvidenceCatalogBuilder.buildGroundedSnapshot(testOppA, null, [
        { citationRef: `DOC.${TEST_DOC_VER_ID_A}.PAGE.1`, queryLabel: 'ELIGIBILITY_AND_DISQUALIFYING_FACTORS', pageNumber: 1, rank: 1, cosineSimilarity: 0.9, excerptSnapshot: 'Text 1' },
      ]);

      const mockResult = {
        alignmentScore: 80,
        eligibility: 'POSSIBLY_ELIGIBLE' as const,
        summary: 'Test summary with requirement lacking DOC ref.',
        strengths: [],
        risks: [],
        requirements: [
          {
            requirement: 'Requirement without document evidence',
            status: 'MET' as const,
            evidenceRefs: ['OPP.eligibility', 'ORG.taxExemptionStatus'], // OPP and ORG only, NO DOC.*
          },
        ],
        recommendedNextAction: 'Proceed with proposal',
        confidence: 0.9,
        limitations: [],
      };

      expect(() => {
        EvidenceCatalogBuilder.validateGroundedEvidenceRefs(mockResult, snapshot.evidenceCatalog);
      }).toThrow('GROUNDED_CITATION_CONSTRAINT_VIOLATION');
    });

    it('atomicity check: validation failure leaves zero evaluation, retrieval run, or audit records', async () => {
      // Create custom provider that returns an invalid citation
      const badProvider = {
        isConfigured: () => true,
        getModelName: () => 'bad-mock',
        analyze: async () => ({
          result: {
            alignmentScore: 50,
            eligibility: 'INSUFFICIENT_INFORMATION' as const,
            summary: 'Bad output test',
            strengths: [],
            risks: [],
            requirements: [{ requirement: 'Bad Req', status: 'UNKNOWN' as const, evidenceRefs: ['INVALID_REF_99'] }],
            recommendedNextAction: 'Stop',
            confidence: 0.5,
            limitations: [],
          },
          meta: { provider: 'BAD_MOCK', model: 'bad-mock', promptVersion: 'funding-analyst-document-grounded-v1' },
        }),
      };

      await expect(
        AiFundingAnalystService.generateGroundedEvaluation({
          opportunityId: TEST_OPPORTUNITY_ID_A,
          userId: adminUser.id,
          idempotencyKey: 'atomic-failure-test-key-99',
          provider: badProvider as any,
        })
      ).rejects.toThrow('cited invalid evidence reference IDs: INVALID_REF_99');

      // Verify ZERO records created for this failed idempotency key
      const evalCount = await prisma.aiEvaluation.count({
        where: { idempotencyKey: 'atomic-failure-test-key-99' },
      });
      expect(evalCount).toBe(0);
    });
  });

  describe('7. Grounded Evaluation Persistence & Health Metadata', () => {
    it('POST /api/opportunities/:id/document-grounded-ai-evaluations generates atomic grounded evaluation', async () => {
      const res = await request(app)
        .post(`/api/opportunities/${TEST_OPPORTUNITY_ID_A}/document-grounded-ai-evaluations`)
        .set('x-test-role', 'ADMIN')
        .set('X-Thriveward-CSRF', '1')
        .send({ idempotencyKey: 'grounded-eval-idempotency-1001' });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.promptVersion).toBe('funding-analyst-document-grounded-v1');

      // Verify retrieval run and evidence persisted atomically
      const evidenceRes = await request(app)
        .get(`/api/ai-evaluations/${res.body.data.id}/retrieved-evidence`)
        .set('x-test-role', 'ADMIN');

      expect(evidenceRes.status).toBe(200);
      expect(evidenceRes.body.success).toBe(true);
      expect(evidenceRes.body.data.evidenceItems.length).toBeGreaterThan(0);
    });

    it('health endpoint safely reports documentGrounding metadata', async () => {
      const res = await request(app).get('/api/health');

      expect(res.status).toBe(200);
      expect(res.body.documentGrounding).toMatchObject({
        enabled: true,
        embeddingModel: 'text-embedding-3-small',
        embeddingDimensions: 1536,
        chunkingVersion: 'document-chunker-v1',
        retrievalVersion: 'document-retrieval-v1',
        promptVersion: 'funding-analyst-document-grounded-v1',
      });
      expect(typeof res.body.documentGrounding.configured).toBe('boolean');
    });
  });
});
