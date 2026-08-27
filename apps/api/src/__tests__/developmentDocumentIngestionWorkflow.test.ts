import fs from 'fs/promises';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DevelopmentDocumentArguments,
  DevelopmentDocumentDependencies,
  ingestDevelopmentDocument,
  validateDevelopmentDocumentDatabaseName,
} from '../services/documents/developmentDocumentIngestionWorkflow';

const pdfBytes = Buffer.from('%PDF-1.7\nfocused unit test');
const args: DevelopmentDocumentArguments = {
  opportunityId: '384fe777-5794-4562-bf97-f1beac40b7fc',
  filePath: '/tmp/official-notice.pdf',
  title: 'Official notice',
  documentType: 'OFFICIAL_NOTICE',
  uploadedByUserId: 'development-user-id',
  expectedExternalId: '363637',
  expectedOpportunityNumber: 'O-BJA-2026-172698',
};

function makeDependencies(
  overrides: Partial<DevelopmentDocumentDependencies> = {}
): DevelopmentDocumentDependencies {
  return {
    getCurrentDatabaseName: vi.fn().mockResolvedValue('bridge_ai_dev'),
    findOpportunity: vi.fn().mockResolvedValue({
      id: args.opportunityId,
      sourceSystem: 'GRANTS_GOV',
      externalOpportunityId: '363637',
      fundingOpportunityNumber: 'O-BJA-2026-172698',
      title: 'BJA official notice',
    }),
    inspectFile: vi.fn().mockResolvedValue({ isFile: true }),
    readFile: vi.fn().mockResolvedValue(pdfBytes),
    ingestDocument: vi.fn().mockResolvedValue({
      document: { id: 'document-id', documentType: 'OFFICIAL_NOTICE' },
      version: {
        id: 'version-id',
        sha256: '342717dcdd5decbc04417f24910aaf99f664f4b343c1a2f26cf340e2d16d9e58',
        status: 'READY',
        pageCount: 1,
        pages: [{ characterCount: 17 }],
      },
      isDuplicate: false,
    }),
    ...overrides,
  };
}

describe('development document ingestion harness', () => {
  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    process.env.NODE_ENV = 'development';
  });

  afterEach(() => {
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnv;
    vi.restoreAllMocks();
  });

  it('rejects non-development execution before file, database, or service calls', async () => {
    process.env.NODE_ENV = 'test';
    const dependencies = makeDependencies();
    await expect(ingestDevelopmentDocument(args, dependencies)).rejects.toThrow('ENVIRONMENT_REJECTED');
    expect(dependencies.inspectFile).not.toHaveBeenCalled();
    expect(dependencies.getCurrentDatabaseName).not.toHaveBeenCalled();
    expect(dependencies.ingestDocument).not.toHaveBeenCalled();
  });

  it.each(['bridge_ai_db', 'bridge_ai_test_db', 'bridge_ai_vitest_random', 'unknown'])('rejects database %s', (name) => {
    expect(() => validateDevelopmentDocumentDatabaseName(name)).toThrow('DATABASE_REJECTED');
  });

  it('accepts only bridge_ai_dev', () => {
    expect(() => validateDevelopmentDocumentDatabaseName('bridge_ai_dev')).not.toThrow();
  });

  it('rejects a missing file before database and ingestion calls', async () => {
    const dependencies = makeDependencies({
      inspectFile: vi.fn().mockRejectedValue(new Error('ENOENT')),
    });
    await expect(ingestDevelopmentDocument(args, dependencies)).rejects.toThrow('FILE_NOT_FOUND');
    expect(dependencies.getCurrentDatabaseName).not.toHaveBeenCalled();
    expect(dependencies.ingestDocument).not.toHaveBeenCalled();
  });

  it('rejects a non-PDF extension or invalid PDF header', async () => {
    const dependencies = makeDependencies();
    await expect(ingestDevelopmentDocument({ ...args, filePath: '/tmp/file.txt' }, dependencies))
      .rejects.toThrow('.pdf extension');
    await expect(ingestDevelopmentDocument(args, makeDependencies({
      readFile: vi.fn().mockResolvedValue(Buffer.from('not a PDF')),
    }))).rejects.toThrow('PDF header');
  });

  it('stops on SHA mismatch before database, opportunity, or service calls', async () => {
    const dependencies = makeDependencies();
    await expect(ingestDevelopmentDocument({
      ...args,
      expectedSha256: 'a'.repeat(64),
    }, dependencies)).rejects.toThrow('SHA256_MISMATCH');
    expect(dependencies.getCurrentDatabaseName).not.toHaveBeenCalled();
    expect(dependencies.findOpportunity).not.toHaveBeenCalled();
    expect(dependencies.ingestDocument).not.toHaveBeenCalled();
  });

  it('rejects missing or mismatched opportunity identity before ingestion', async () => {
    const missingDependencies = makeDependencies({ findOpportunity: vi.fn().mockResolvedValue(null) });
    await expect(ingestDevelopmentDocument(args, missingDependencies)).rejects.toThrow('OPPORTUNITY_REJECTED');
    expect(missingDependencies.ingestDocument).not.toHaveBeenCalled();

    const mismatchDependencies = makeDependencies({
      findOpportunity: vi.fn().mockResolvedValue({
        id: args.opportunityId,
        sourceSystem: 'GRANTS_GOV',
        externalOpportunityId: 'wrong',
        fundingOpportunityNumber: 'wrong',
        title: 'Wrong record',
      }),
    });
    await expect(ingestDevelopmentDocument(args, mismatchDependencies)).rejects.toThrow('externalOpportunityId differs');
    expect(mismatchDependencies.ingestDocument).not.toHaveBeenCalled();
  });

  it('calls the existing ingestion boundary exactly once and returns safe metadata', async () => {
    const dependencies = makeDependencies();
    const output = await ingestDevelopmentDocument(args, dependencies);

    expect(dependencies.ingestDocument).toHaveBeenCalledOnce();
    expect(dependencies.ingestDocument).toHaveBeenCalledWith(expect.objectContaining({
      opportunityId: args.opportunityId,
      documentType: 'OFFICIAL_NOTICE',
      mimeType: 'application/pdf',
      userId: 'development-user-id',
      idempotencyKey: expect.stringMatching(/^dev-document:[^:]+:[a-f0-9]{64}$/),
    }));
    expect(output).toEqual(expect.objectContaining({
      databaseName: 'bridge_ai_dev',
      fundingDocumentId: 'document-id',
      fundingDocumentVersionId: 'version-id',
      finalDocumentVersionStatus: 'READY',
      extractedCharacterCount: 17,
    }));
    expect(JSON.stringify(output)).not.toMatch(/password|databaseUrl|token|bytes|uploadedByUserId/i);
  });

  it('derives the same durable idempotency key for the same opportunity and bytes', async () => {
    const firstDependencies = makeDependencies();
    const secondDependencies = makeDependencies({
      ingestDocument: vi.fn().mockResolvedValue({
        document: { id: 'document-id', documentType: 'OFFICIAL_NOTICE' },
        version: {
          id: 'version-id',
          sha256: '342717dcdd5decbc04417f24910aaf99f664f4b343c1a2f26cf340e2d16d9e58',
          status: 'READY',
          pageCount: 1,
          pages: [{ characterCount: 17 }],
        },
        isDuplicate: true,
      }),
    });
    const first = await ingestDevelopmentDocument(args, firstDependencies);
    const second = await ingestDevelopmentDocument(args, secondDependencies);
    expect(second.idempotencyKey).toBe(first.idempotencyKey);
    expect(second.isDuplicate).toBe(true);
  });

  it('does not import authentication, provider, OpenAI, or indexing services', async () => {
    const workflowSource = await fs.readFile(
      path.resolve(__dirname, '../services/documents/developmentDocumentIngestionWorkflow.ts'),
      'utf8'
    );
    const scriptSource = await fs.readFile(
      path.resolve(__dirname, '../scripts/developmentDocumentIngestion.ts'),
      'utf8'
    );
    const sources = `${workflowSource}\n${scriptSource}`;
    expect(sources).not.toMatch(/authService|openAi|Provider|documentIndexingService/);
    expect(scriptSource).toContain("import('../services/documents/documentIngestionService')");
  });
});
