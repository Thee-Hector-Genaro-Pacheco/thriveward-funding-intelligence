import crypto from 'crypto';
import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll } from 'vitest';
import { prisma } from '../lib/prisma';
import { OpenAiDocumentEmbeddingProvider } from '../services/ai/openAiDocumentEmbeddingProvider';
import { DeterministicDocumentEmbeddingProvider } from '../services/ai/deterministicDocumentEmbeddingProvider';
import { DocumentIndexingService } from '../services/documentIndexingService';
import { DocumentRetrievalService } from '../services/documentRetrievalService';
import { AuthService } from '../services/authService';

describe('RAG Embedding Provenance & Index Integrity Suite', () => {
  const TEST_OPP_ID = 'test-rag-integrity-opp-0001';
  const TEST_DOC_ID = 'test-rag-integrity-doc-0001';
  const TEST_DOC_VER_ID = 'test-rag-integrity-ver-0001';
  let adminUser: any;

  beforeAll(async () => {
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

    await prisma.fundingOpportunity.create({
      data: {
        id: TEST_OPP_ID,
        title: 'RAG Integrity Test Opportunity',
        fundingOpportunityNumber: 'RAG-INTEGRITY-001',
        fundingAgency: 'HUD',
        description: 'RAG Integrity Test Opportunity Description',
        sourceUrl: 'https://example.gov/rag-test-opportunity',
        status: 'VERIFIED',
      },
    });

    await prisma.fundingDocument.create({
      data: {
        id: TEST_DOC_ID,
        fundingOpportunityId: TEST_OPP_ID,
        title: 'RAG Integrity Document',
        documentType: 'OFFICIAL_NOTICE',
      },
    });

    await prisma.fundingDocumentVersion.create({
      data: {
        id: TEST_DOC_VER_ID,
        fundingDocumentId: TEST_DOC_ID,
        version: 1,
        status: 'READY',
        sha256: 'sha-rag-integrity-test-v1',
        storageKey: 'key-rag-integrity-test-v1',
        originalFileName: 'rag_integrity_notice.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 1024,
        pageCount: 1,
        extractionVersion: 'v1.0',
        uploadedByUserId: adminUser.id,
      },
    });

    await prisma.fundingDocumentPage.create({
      data: {
        documentVersionId: TEST_DOC_VER_ID,
        pageNumber: 1,
        text: 'Eligibility Requirements: All 501(c)(3) nonprofits providing reentry housing services.',
        characterCount: 83,
        citationRef: 'DOC.test-rag-integrity-ver-0001.PAGE.1',
        textHash: crypto.createHash('sha256').update('Eligibility Requirements').digest('hex'),
      },
    });
  });

  beforeEach(() => {
    process.env.AI_DOCUMENT_GROUNDING_ENABLED = 'true';
    DocumentIndexingService.setProvider(new DeterministicDocumentEmbeddingProvider());
  });

  afterEach(() => {
    DocumentIndexingService.resetProvider();
  });

  afterAll(async () => {
    process.env.AI_DOCUMENT_GROUNDING_ENABLED = 'true';
    await prisma.aiEvaluationRetrievalEvidence.deleteMany({
      where: { retrievalRun: { evaluation: { opportunityId: TEST_OPP_ID } } },
    });
    await prisma.aiEvaluationRetrievalRun.deleteMany({
      where: { evaluation: { opportunityId: TEST_OPP_ID } },
    });
    await prisma.aiEvaluation.deleteMany({
      where: { opportunityId: TEST_OPP_ID },
    });
    await prisma.fundingDocumentChunk.deleteMany({
      where: { documentIndex: { documentVersionId: TEST_DOC_VER_ID } },
    });
    await prisma.fundingDocumentIndex.deleteMany({
      where: { documentVersionId: TEST_DOC_VER_ID },
    });
    await prisma.fundingDocumentPage.deleteMany({
      where: { documentVersionId: TEST_DOC_VER_ID },
    });
    await prisma.fundingDocumentVersion.deleteMany({
      where: { id: TEST_DOC_VER_ID },
    });
    await prisma.fundingDocument.deleteMany({
      where: { id: TEST_DOC_ID },
    });
    await prisma.fundingOpportunity.deleteMany({
      where: { id: TEST_OPP_ID },
    });
  });

  describe('1. Embedding Provider Identity Contract', () => {
    it('OpenAI provider exposes provider name, model, and dimensions', () => {
      const openAiProvider = new OpenAiDocumentEmbeddingProvider();
      expect(openAiProvider.getProviderName()).toBe('OPENAI');
      expect(openAiProvider.getModelName()).toBe(process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small');
      expect(openAiProvider.getDimensions()).toBe(Number(process.env.OPENAI_EMBEDDING_DIMENSIONS) || 1536);
    });

    it('Deterministic provider exposes DETERMINISTIC_MOCK provider name and deterministic-mock-v1 model', () => {
      const detProvider = new DeterministicDocumentEmbeddingProvider(1536);
      expect(detProvider.getProviderName()).toBe('DETERMINISTIC_MOCK');
      expect(detProvider.getModelName()).toBe('deterministic-mock-v1');
      expect(detProvider.getDimensions()).toBe(1536);
    });
  });

  describe('2. Vector Index Full Configuration Identity', () => {
    it('produces identical configuration hash for identical chunking and provider parameters', () => {
      const providerA = new DeterministicDocumentEmbeddingProvider(1536);
      const providerB = new DeterministicDocumentEmbeddingProvider(1536);
      const chunkHash = 'chunk-config-hash-12345';

      const hashA = DocumentIndexingService.computeFullIndexConfigurationHash(chunkHash, providerA);
      const hashB = DocumentIndexingService.computeFullIndexConfigurationHash(chunkHash, providerB);

      expect(hashA).toBe(hashB);
    });

    it('produces different configuration hash when embedding provider differs', () => {
      const detProvider = new DeterministicDocumentEmbeddingProvider(1536);
      const openAiProvider = new OpenAiDocumentEmbeddingProvider();
      const chunkHash = 'chunk-config-hash-12345';

      const hashDet = DocumentIndexingService.computeFullIndexConfigurationHash(chunkHash, detProvider);
      const hashOpenAi = DocumentIndexingService.computeFullIndexConfigurationHash(chunkHash, openAiProvider);

      expect(hashDet).not.toBe(hashOpenAi);
    });

    it('produces different configuration hash when dimensions differ', () => {
      const det1536 = new DeterministicDocumentEmbeddingProvider(1536);
      const det512 = new DeterministicDocumentEmbeddingProvider(512);
      const chunkHash = 'chunk-config-hash-12345';

      const hash1536 = DocumentIndexingService.computeFullIndexConfigurationHash(chunkHash, det1536);
      const hash512 = DocumentIndexingService.computeFullIndexConfigurationHash(chunkHash, det512);

      expect(hash1536).not.toBe(hash512);
    });
  });

  describe('3. Persisted Provenance & Index Isolation', () => {
    it('indexing with deterministic provider persists honest DETERMINISTIC_MOCK provider and deterministic-mock-v1 model', async () => {
      const detProvider = new DeterministicDocumentEmbeddingProvider(1536);

      const index = await DocumentIndexingService.indexDocumentVersion({
        documentVersionId: TEST_DOC_VER_ID,
        userId: adminUser.id,
        provider: detProvider,
      });

      expect(index.status).toBe('READY');
      expect(index.embeddingProvider).toBe('DETERMINISTIC_MOCK');
      expect(index.embeddingModel).toBe('deterministic-mock-v1');
      expect(index.embeddingDimensions).toBe(1536);

      // Verify DB record matches
      const dbIndex = await prisma.fundingDocumentIndex.findUnique({
        where: { id: index.id },
      });
      expect(dbIndex?.embeddingProvider).toBe('DETERMINISTIC_MOCK');
      expect(dbIndex?.embeddingModel).toBe('deterministic-mock-v1');
    });

    it('reuses compatible index for identical provider configuration', async () => {
      const detProvider = new DeterministicDocumentEmbeddingProvider(1536);

      const index1 = await DocumentIndexingService.indexDocumentVersion({
        documentVersionId: TEST_DOC_VER_ID,
        userId: adminUser.id,
        provider: detProvider,
      });

      const index2 = await DocumentIndexingService.indexDocumentVersion({
        documentVersionId: TEST_DOC_VER_ID,
        userId: adminUser.id,
        provider: detProvider,
      });

      expect(index1.id).toBe(index2.id);
    });
  });

  describe('4. Provider-Compatible Retrieval Selection', () => {
    it('fails closed when document version only has an index created by an incompatible provider', async () => {
      // Create a dedicated document version with ONLY an OpenAI index
      const incompatVerId = 'test-rag-incompat-ver-0001';
      const incompatVer = await prisma.fundingDocumentVersion.create({
        data: {
          id: incompatVerId,
          fundingDocumentId: TEST_DOC_ID,
          version: 99,
          status: 'READY',
          sha256: 'sha-rag-incompat-v99',
          storageKey: 'key-rag-incompat-v99',
          originalFileName: 'rag_incompat.pdf',
          mimeType: 'application/pdf',
          sizeBytes: 1024,
          pageCount: 1,
          extractionVersion: 'v1.0',
          uploadedByUserId: adminUser.id,
        },
      });

      const openAiIndex = await prisma.fundingDocumentIndex.create({
        data: {
          documentVersionId: incompatVer.id,
          version: 1,
          status: 'READY',
          sourceManifestHash: 'manifest-openai-incompat',
          configurationHash: 'config-openai-incompat-only',
          embeddingProvider: 'OPENAI',
          embeddingModel: 'text-embedding-3-small',
          embeddingDimensions: 1536,
          pageCount: 1,
          chunkCount: 1,
          indexedByUserId: adminUser.id,
        },
      });

      // Active provider is DETERMINISTIC_MOCK. Try retrieving with active deterministic provider.
      // Retrieval should fail closed because openAiIndex is incompatible with DETERMINISTIC_MOCK
      const detProvider = new DeterministicDocumentEmbeddingProvider(1536);

      await expect(
        DocumentRetrievalService.executeRetrieval({
          opportunityId: TEST_OPP_ID,
          documentVersionId: incompatVer.id,
          provider: detProvider,
        })
      ).rejects.toThrow(/DOCUMENT_INDEX_NOT_READY/);

      // Clean test records
      await prisma.fundingDocumentIndex.delete({ where: { id: openAiIndex.id } });
      await prisma.fundingDocumentVersion.delete({ where: { id: incompatVer.id } });
    });

    it('selects the compatible index when both OpenAI and Deterministic indices exist for the same version', async () => {
      const detProvider = new DeterministicDocumentEmbeddingProvider(1536);

      // Index with deterministic provider
      const detIndex = await DocumentIndexingService.indexDocumentVersion({
        documentVersionId: TEST_DOC_VER_ID,
        userId: adminUser.id,
        provider: detProvider,
      });

      // Manually insert an OpenAI index with higher version number (newer)
      const openAiIndex = await prisma.fundingDocumentIndex.create({
        data: {
          documentVersionId: TEST_DOC_VER_ID,
          version: detIndex.version + 10,
          status: 'READY',
          sourceManifestHash: 'manifest-openai-newer',
          configurationHash: 'config-openai-newer',
          embeddingProvider: 'OPENAI',
          embeddingModel: 'text-embedding-3-small',
          embeddingDimensions: 1536,
          pageCount: 1,
          chunkCount: 1,
          indexedByUserId: adminUser.id,
        },
      });

      // Execute retrieval with active deterministic provider
      const retrievalResult = await DocumentRetrievalService.executeRetrieval({
        opportunityId: TEST_OPP_ID,
        documentVersionId: TEST_DOC_VER_ID,
        provider: detProvider,
      });

      // Must select detIndex, NOT openAiIndex despite openAiIndex having higher version number
      expect(retrievalResult.documentIndexId).toBe(detIndex.id);
      expect(retrievalResult.documentIndexId).not.toBe(openAiIndex.id);

      // Clean test record
      await prisma.fundingDocumentIndex.delete({ where: { id: openAiIndex.id } });
    });
  });
});
