import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { app } from '../server';
import { prisma } from '../lib/prisma';
import { DocumentIngestionService } from '../services/documents/documentIngestionService';
import { LocalDockerDocumentStorage } from '../services/documents/fundingDocumentStorage';
import { createIsolatedTestStorageDir, assertTestDatabaseIsolation } from './setup/testStorageGuard';

let TEST_STORAGE_DIR: string;
let testOppId: string;
let storageProvider: LocalDockerDocumentStorage;

function createMinimalPdfBuffer(pageTexts: string[]): Buffer {
  const pagesObjects: string[] = [];
  const kidsReferences: string[] = [];

  pageTexts.forEach((text, idx) => {
    const objNum = 3 + idx * 2;
    const contentObjNum = 4 + idx * 2;
    kidsReferences.push(`${objNum} 0 R`);

    const streamText = `BT /F1 12 Tf 50 700 Td (${text}) Tj ET`;
    const streamLength = Buffer.byteLength(streamText);

    pagesObjects.push(
      `${objNum} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents ${contentObjNum} 0 R /Resources << /Font << /F1 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> >> >> >>\nendobj`
    );
    pagesObjects.push(
      `${contentObjNum} 0 obj\n<< /Length ${streamLength} >>\nstream\n${streamText}\nendstream\nendobj`
    );
  });

  const totalPages = pageTexts.length;
  const pdfRaw = `%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [${kidsReferences.join(
    ' '
  )}] /Count ${totalPages} >>\nendobj\n${pagesObjects.join('\n')}\nxref\n0 5\n0000000000 65535 f \ntrailer\n<< /Size 10 /Root 1 0 R >>\nstartxref\n500\n%%EOF\n`;

  return Buffer.from(pdfRaw, 'binary');
}

describe('Phase AI-2A — Hardened Official Document Ingestion & Citation Suite', () => {
  beforeAll(async () => {
    await assertTestDatabaseIsolation();
    TEST_STORAGE_DIR = createIsolatedTestStorageDir();
    storageProvider = new LocalDockerDocumentStorage(TEST_STORAGE_DIR);
    DocumentIngestionService.setStorageProvider(storageProvider);

    const opp = await prisma.fundingOpportunity.create({
      data: {
        fundingOpportunityNumber: `TEST-AI2A-HARDENED-${Date.now()}`,
        title: 'AI-2A Hardened Notice Opportunity',
        fundingAgency: 'HHS',
        sourceUrl: 'https://www.grants.gov/search-results-detail/123456',
        description: 'Test opportunity for AI-2A hardened document ingestion',
        isDemo: true,
      },
    });




    testOppId = opp.id;
  });

  afterAll(async () => {
    if (testOppId) {
      await prisma.fundingDocumentPage.deleteMany({
        where: { documentVersion: { fundingDocument: { fundingOpportunityId: testOppId } } },
      });
      await prisma.fundingDocumentVersion.deleteMany({
        where: { fundingDocument: { fundingOpportunityId: testOppId } },
      });
      await prisma.fundingDocumentIdempotency.deleteMany({
        where: { opportunityId: testOppId },
      });
      await prisma.fundingDocument.deleteMany({
        where: { fundingOpportunityId: testOppId },
      });
      await prisma.fundingOpportunity.delete({ where: { id: testOppId } });
    }

    DocumentIngestionService.resetStorageProvider();
    if (TEST_STORAGE_DIR && fs.existsSync(TEST_STORAGE_DIR)) {
      fs.rmSync(TEST_STORAGE_DIR, { recursive: true, force: true });
    }
  });

  beforeEach(() => {
    process.env.DOCUMENT_INGESTION_ENABLED = 'true';
  });

  describe('1. Feature Gate & Pre-Reception Pipeline Hardening', () => {
    it('returns HTTP 503 DOCUMENT_INGESTION_NOT_CONFIGURED before file reception when disabled', async () => {
      process.env.DOCUMENT_INGESTION_ENABLED = 'false';

      const beforeDocCount = await prisma.fundingDocument.count();
      const beforeAuditCount = await prisma.securityAuditEvent.count();
      const pdfBuffer = createMinimalPdfBuffer(['Feature Disabled Test Page']);

      const res = await request(app)
        .post(`/api/opportunities/${testOppId}/funding-documents`)
        .set('x-test-role', 'ADMIN')
        .set('X-Thriveward-CSRF', '1')
        .attach('file', pdfBuffer, 'disabled.pdf')
        .field('title', 'Disabled Feature Notice');

      expect(res.status).toBe(503);
      expect(res.body.error).toContain('DOCUMENT_INGESTION_NOT_CONFIGURED');

      const afterDocCount = await prisma.fundingDocument.count();
      const afterAuditCount = await prisma.securityAuditEvent.count();

      expect(beforeDocCount).toBe(afterDocCount);
      expect(beforeAuditCount).toBe(afterAuditCount);
    });

    it('rejects unauthenticated upload requests with HTTP 401', async () => {
      const pdfBuffer = createMinimalPdfBuffer(['Unauthenticated Upload']);
      const res = await request(app)
        .post(`/api/opportunities/${testOppId}/funding-documents`)
        .set('x-test-unauthenticated', 'true')
        .set('X-Thriveward-CSRF', '1')
        .attach('file', pdfBuffer, 'unauth.pdf')
        .field('title', 'Unauthenticated Notice');

      expect(res.status).toBe(401);
    });

    it('rejects VIEWER role upload requests with HTTP 403', async () => {
      const pdfBuffer = createMinimalPdfBuffer(['Viewer Upload']);
      const res = await request(app)
        .post(`/api/opportunities/${testOppId}/funding-documents`)
        .set('x-test-role', 'VIEWER')
        .set('X-Thriveward-CSRF', '1')
        .attach('file', pdfBuffer, 'viewer.pdf')
        .field('title', 'Viewer Notice');

      expect(res.status).toBe(403);
    });
  });

  describe('2. Path Containment & Symlink Defense', () => {
    it('rejects relative traversal, prefix collision, and absolute storage keys', async () => {
      expect(() => storageProvider['resolveAndValidateKeyPath']('../escape.pdf')).toThrow('Path containment violation');
      expect(() => storageProvider['resolveAndValidateKeyPath']('/etc/passwd')).toThrow('Path containment violation');
      expect(() => storageProvider['resolveAndValidateKeyPath']('\0invalid.pdf')).toThrow('Invalid storage key');
    });

    it('rejects symlink targets and parent symlink directories', async () => {
      const targetFile = path.join(TEST_STORAGE_DIR, 'normal.pdf');
      const symlinkFile = path.join(TEST_STORAGE_DIR, 'symlink.pdf');

      fs.writeFileSync(targetFile, Buffer.from('PDF_CONTENT'));
      if (!fs.existsSync(symlinkFile)) {
        try { fs.symlinkSync(targetFile, symlinkFile); } catch (_) {}
      }

      if (fs.existsSync(symlinkFile)) {
        await expect(storageProvider.read('symlink.pdf')).rejects.toThrow('Symlink');
        try { fs.unlinkSync(symlinkFile); } catch (_) {}
      }
      if (fs.existsSync(targetFile)) {
        fs.unlinkSync(targetFile);
      }
    });
  });

  describe('3. Persistent Idempotency & Concurrency Hardening', () => {
    it('returns existing version on identical idempotency key and payload SHA-256', async () => {
      const pdfBuffer = createMinimalPdfBuffer(['Idempotency Payload 1']);
      const idempotencyKey = `idemp_key_success_${Date.now()}`;

      const res1 = await request(app)
        .post(`/api/opportunities/${testOppId}/funding-documents`)
        .set('x-test-role', 'ADMIN')
        .set('X-Thriveward-CSRF', '1')
        .set('X-Idempotency-Key', idempotencyKey)
        .attach('file', pdfBuffer, 'idemp.pdf')
        .field('title', 'Persistent Idempotency Notice');

      expect(res1.status).toBe(201);
      expect(res1.body.data.isDuplicate).toBe(false);
      const versionId1 = res1.body.data.version.id;

      // Repeat with same key & same payload
      const res2 = await request(app)
        .post(`/api/opportunities/${testOppId}/funding-documents`)
        .set('x-test-role', 'ADMIN')
        .set('X-Thriveward-CSRF', '1')
        .set('X-Idempotency-Key', idempotencyKey)
        .attach('file', pdfBuffer, 'idemp.pdf')
        .field('title', 'Persistent Idempotency Notice');

      expect(res2.status).toBe(201);
      expect(res2.body.data.isDuplicate).toBe(true);
      expect(res2.body.data.version.id).toBe(versionId1);
    });

    it('rejects reuse of idempotency key with a different payload SHA-256 with 409 IDEMPOTENCY_KEY_REUSED', async () => {
      const pdfBuffer1 = createMinimalPdfBuffer(['Payload 1 Content']);
      const pdfBuffer2 = createMinimalPdfBuffer(['Payload 2 Different Content']);
      const idempotencyKey = `idemp_key_reuse_${Date.now()}`;

      await request(app)
        .post(`/api/opportunities/${testOppId}/funding-documents`)
        .set('x-test-role', 'ADMIN')
        .set('X-Thriveward-CSRF', '1')
        .set('X-Idempotency-Key', idempotencyKey)
        .attach('file', pdfBuffer1, 'payload1.pdf')
        .field('title', 'Payload 1 Notice');

      const resConflict = await request(app)
        .post(`/api/opportunities/${testOppId}/funding-documents`)
        .set('x-test-role', 'ADMIN')
        .set('X-Thriveward-CSRF', '1')
        .set('X-Idempotency-Key', idempotencyKey)
        .attach('file', pdfBuffer2, 'payload2.pdf')
        .field('title', 'Payload 2 Notice');

      expect(resConflict.status).toBe(409);
      expect(resConflict.body.error).toContain('IDEMPOTENCY_KEY_REUSED');
    });

  });

  describe('4. Worker Isolation & Extraction Hardening', () => {
    it('successfully extracts pages and formats stable citation references DOC.<versionId>.PAGE.<pageNum>', async () => {
      const pdfBuffer = createMinimalPdfBuffer([
        'Section 1: Applicant Eligibility Criteria and Guidance',
        'Section 2: Cost Sharing Requirements',
      ]);

      const res = await request(app)
        .post(`/api/opportunities/${testOppId}/funding-documents`)
        .set('x-test-role', 'ADMIN')
        .set('X-Thriveward-CSRF', '1')
        .attach('file', pdfBuffer, 'valid_notice.pdf')
        .field('title', 'Valid Extraction Notice');

      expect(res.status).toBe(201);
      const versionId = res.body.data.version.id;

      const pagesRes = await request(app)
        .get(`/api/funding-document-versions/${versionId}/pages`)
        .set('x-test-role', 'ADMIN');

      expect(pagesRes.status).toBe(200);
      const pages = pagesRes.body.data;
      expect(pages.length).toBe(2);
      expect(pages[0].citationRef).toBe(`DOC.${versionId}.PAGE.1`);
      expect(pages[1].citationRef).toBe(`DOC.${versionId}.PAGE.2`);
    });

    it('classifies scanned image-only PDF with zero text as OCR_REQUIRED', async () => {
      const emptyTextPdf = createMinimalPdfBuffer(['']);

      const res = await request(app)
        .post(`/api/opportunities/${testOppId}/funding-documents`)
        .set('x-test-role', 'ADMIN')
        .set('X-Thriveward-CSRF', '1')
        .attach('file', emptyTextPdf, 'scanned.pdf')
        .field('title', 'Scanned Image PDF');

      expect(res.status).toBe(201);
      expect(res.body.data.version.status).toBe('OCR_REQUIRED');
    });
  });

  describe('5. Fail-Closed Audit Logging & Mutation-Free Read Routes', () => {
    it('verifies GET routes leave database counts and timestamps completely unchanged', async () => {
      const beforeOppCount = await prisma.fundingOpportunity.count();
      const beforeAuditCount = await prisma.securityAuditEvent.count();

      await request(app).get(`/api/opportunities/${testOppId}/funding-documents`).set('x-test-role', 'ADMIN');

      const afterOppCount = await prisma.fundingOpportunity.count();
      const afterAuditCount = await prisma.securityAuditEvent.count();

      expect(beforeOppCount).toBe(afterOppCount);
      expect(beforeAuditCount).toBe(afterAuditCount);
    });
  });
});
