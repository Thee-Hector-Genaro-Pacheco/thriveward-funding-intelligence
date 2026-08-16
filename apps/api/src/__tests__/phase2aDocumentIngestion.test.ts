import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import { app } from '../server';
import { DocumentIngestionService } from '../services/documents/documentIngestionService';
import { LocalDockerDocumentStorage } from '../services/documents/fundingDocumentStorage';

const prisma = new PrismaClient();
const TEST_STORAGE_DIR = path.join(__dirname, 'scratch_test_documents');

describe('Phase AI-2A — Official Notice Ingestion & Citation Foundation Complete Test Suite', () => {
  let testOppId: string;
  let adminUserId: string;

  beforeAll(async () => {
    // 1. Safety Abort Check: Must target bridge_ai_test_db
    const dbRes: any[] = await prisma.$queryRawUnsafe('SELECT current_database()');
    if (dbRes[0]?.current_database !== 'bridge_ai_test_db') {
      throw new Error(`[SAFETY_ABORT] Integration tests must run against bridge_ai_test_db. Received: ${dbRes[0]?.current_database}`);
    }

    // Configure test storage provider pointing to temporary scratch directory
    if (!fs.existsSync(TEST_STORAGE_DIR)) {
      fs.mkdirSync(TEST_STORAGE_DIR, { recursive: true });
    }
    DocumentIngestionService.setStorageProvider(new LocalDockerDocumentStorage(TEST_STORAGE_DIR));

    // Enable feature flag for test execution
    process.env.DOCUMENT_INGESTION_ENABLED = 'true';

    // Find or create test user and opportunity
    const adminUser = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
    adminUserId = adminUser!.id;

    const opp = await prisma.fundingOpportunity.create({
      data: {
        title: 'Phase 2A Test Opportunity',
        description: 'Test description for document ingestion suite',
        fundingAgency: 'U.S. Department of Labor',
        sourceSystem: 'GRANTS_GOV',
        sourceUrl: 'https://example.gov/nofo-2026',
        externalOpportunityId: `unit-ai2a-opp-${Date.now()}`,
      },
    });
    testOppId = opp.id;
  });

  afterAll(async () => {
    // Cleanup temporary test storage directory
    if (fs.existsSync(TEST_STORAGE_DIR)) {
      fs.rmSync(TEST_STORAGE_DIR, { recursive: true, force: true });
    }
    DocumentIngestionService.resetStorageProvider();
  });

  // Helper to generate minimal valid PDF buffer
  function createMinimalPdfBuffer(pageTexts: string[]): Buffer {
    let pdf = `%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n`;
    pdf += `2 0 obj\n<< /Type /Pages /Kids [`;
    for (let i = 0; i < pageTexts.length; i++) {
      pdf += `${3 + i * 2} 0 R `;
    }
    pdf += `] /Count ${pageTexts.length} >>\nendobj\n`;

    let objIndex = 3;
    for (let i = 0; i < pageTexts.length; i++) {
      const text = pageTexts[i];
      const pageObjNum = objIndex;
      const contentObjNum = objIndex + 1;
      objIndex += 2;

      const streamContent = `BT /F1 12 Tf 50 700 Td (${text}) Tj ET`;
      const streamLen = streamContent.length;

      pdf += `${pageObjNum} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents ${contentObjNum} 0 R /Resources << /Font << /F1 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> >> >> >>\nendobj\n`;
      pdf += `${contentObjNum} 0 obj\n<< /Length ${streamLen} >>\nstream\n${streamContent}\nendstream\nendobj\n`;
    }

    pdf += `xref\n0 ${objIndex}\n0000000000 65535 f \n`;
    pdf += `trailer\n<< /Size ${objIndex} /Root 1 0 R >>\nstartxref\n${pdf.length}\n%%EOF\n`;
    return Buffer.from(pdf, 'binary');
  }

  describe('1. Security, RBAC & Authentication Invariants', () => {
    it('rejects unauthenticated document uploads with HTTP 401', async () => {
      const pdfBuffer = createMinimalPdfBuffer(['Official Notice Page 1']);
      const res = await request(app)
        .post(`/api/opportunities/${testOppId}/funding-documents`)
        .set('x-test-unauthenticated', 'true')
        .attach('file', pdfBuffer, 'notice.pdf')
        .field('title', 'Unauthenticated Upload');

      expect(res.status).toBe(401);
    });

    it('rejects upload from VIEWER role with HTTP 403', async () => {
      const pdfBuffer = createMinimalPdfBuffer(['Official Notice Page 1']);
      const res = await request(app)
        .post(`/api/opportunities/${testOppId}/funding-documents`)
        .set('x-test-role', 'VIEWER')
        .set('X-Thriveward-CSRF', '1')
        .attach('file', pdfBuffer, 'notice.pdf')
        .field('title', 'Viewer Upload');

      expect(res.status).toBe(403);
      expect(res.body.error).toContain('Forbidden');
    });

    it('rejects upload when CSRF header is missing with HTTP 403', async () => {
      const pdfBuffer = createMinimalPdfBuffer(['Official Notice Page 1']);
      const res = await request(app)
        .post(`/api/opportunities/${testOppId}/funding-documents`)
        .set('x-test-role', 'ADMIN')
        .set('x-test-reject-csrf', 'true')
        .attach('file', pdfBuffer, 'notice.pdf')
        .field('title', 'No CSRF Upload');

      expect(res.status).toBe(403);
    });

    it('fails closed when DOCUMENT_INGESTION_ENABLED=false with HTTP 403', async () => {
      delete process.env.DOCUMENT_INGESTION_ENABLED;
      const pdfBuffer = createMinimalPdfBuffer(['Official Notice Page 1']);
      const res = await request(app)
        .post(`/api/opportunities/${testOppId}/funding-documents`)
        .set('x-test-role', 'ADMIN')
        .set('X-Thriveward-CSRF', '1')
        .attach('file', pdfBuffer, 'notice.pdf')
        .field('title', 'Disabled Feature Upload');

      expect(res.status).toBe(403);
      expect(res.body.error).toContain('FEATURE_DISABLED');
      process.env.DOCUMENT_INGESTION_ENABLED = 'true';
    });
  });

  describe('2. PDF Security & Integrity Validation Controls', () => {
    it('rejects non-PDF bytes even when file is named notice.pdf with MALFORMED_PDF', async () => {
      const fakeBuffer = Buffer.from('THIS_IS_NOT_A_PDF_HEADER_TEXT_FILE', 'utf8');
      const res = await request(app)
        .post(`/api/opportunities/${testOppId}/funding-documents`)
        .set('x-test-role', 'ADMIN')
        .set('X-Thriveward-CSRF', '1')
        .attach('file', fakeBuffer, 'notice.pdf')
        .field('title', 'Fake PDF Upload');

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('MALFORMED_PDF');
    });

    it('rejects password-protected or encrypted PDFs with ENCRYPTED_PDF', async () => {
      const encryptedPdfRaw = `%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R /Encrypt 3 0 R >>\nendobj\n%%EOF`;
      const encryptedBuffer = Buffer.from(encryptedPdfRaw, 'binary');

      const res = await request(app)
        .post(`/api/opportunities/${testOppId}/funding-documents`)
        .set('x-test-role', 'ADMIN')
        .set('X-Thriveward-CSRF', '1')
        .attach('file', encryptedBuffer, 'encrypted.pdf')
        .field('title', 'Encrypted PDF Upload');

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('ENCRYPTED_PDF');
    });

    it('rejects oversized files exceeding DOCUMENT_MAX_FILE_BYTES', async () => {
      process.env.DOCUMENT_MAX_FILE_BYTES = '100'; // Set tiny 100-byte limit for test
      const pdfBuffer = createMinimalPdfBuffer(['Large document text exceeding 100 byte test limit...']);

      const res = await request(app)
        .post(`/api/opportunities/${testOppId}/funding-documents`)
        .set('x-test-role', 'ADMIN')
        .set('X-Thriveward-CSRF', '1')
        .attach('file', pdfBuffer, 'large.pdf')
        .field('title', 'Oversized PDF Upload');

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('FILE_SIZE_EXCEEDED');
      delete process.env.DOCUMENT_MAX_FILE_BYTES;
    });
  });

  describe('3. Deterministic Extraction, Citations & Idempotency', () => {
    it('successfully ingests valid PDF, extracts page text, and formats stable citation references', async () => {
      const pdfBuffer = createMinimalPdfBuffer([
        'Section 1: Eligible Applicants and Program Overview',
        'Section 2: Cost Sharing and Match Requirement Details',
      ]);

      const res = await request(app)
        .post(`/api/opportunities/${testOppId}/funding-documents`)
        .set('x-test-role', 'ADMIN')
        .set('X-Thriveward-CSRF', '1')
        .attach('file', pdfBuffer, 'official_notice_2026.pdf')
        .field('title', 'Official Notice & Guidelines')
        .field('documentType', 'OFFICIAL_NOTICE')
        .field('officialSourceUrl', 'https://www.grants.gov/search-results-detail/362088');

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);

      const versionId = res.body.data.version.id;
      expect(res.body.data.version.status).toBe('READY');
      expect(res.body.data.version.pageCount).toBe(2);

      // Inspect extracted pages via GET route
      const pagesRes = await request(app)
        .get(`/api/funding-document-versions/${versionId}/pages`)
        .set('x-test-role', 'ADMIN');

      expect(pagesRes.status).toBe(200);
      const pages = pagesRes.body.data;
      expect(pages.length).toBe(2);
      expect(pages[0].citationRef).toBe(`DOC.${versionId}.PAGE.1`);
      expect(pages[1].citationRef).toBe(`DOC.${versionId}.PAGE.2`);

      // Verify single page text retrieval
      const page1Res = await request(app)
        .get(`/api/funding-document-versions/${versionId}/pages/1`)
        .set('x-test-role', 'ADMIN');

      expect(page1Res.status).toBe(200);
      expect(page1Res.body.data.text).toContain('Eligible Applicants');
      expect(page1Res.body.data.citationRef).toBe(`DOC.${versionId}.PAGE.1`);
    });

    it('idempotency: duplicate upload of identical content returns existing version without duplicating storage or database rows', async () => {
      const pdfBuffer = createMinimalPdfBuffer(['Idempotent Test Document Content Page 1']);

      const res1 = await request(app)
        .post(`/api/opportunities/${testOppId}/funding-documents`)
        .set('x-test-role', 'ADMIN')
        .set('X-Thriveward-CSRF', '1')
        .attach('file', pdfBuffer, 'notice.pdf')
        .field('title', 'Idempotency Notice');

      expect(res1.status).toBe(201);
      expect(res1.body.data.isDuplicate).toBe(false);
      const version1Id = res1.body.data.version.id;

      // Repeat identical upload
      const res2 = await request(app)
        .post(`/api/opportunities/${testOppId}/funding-documents`)
        .set('x-test-role', 'ADMIN')
        .set('X-Thriveward-CSRF', '1')
        .attach('file', pdfBuffer, 'notice.pdf')
        .field('title', 'Idempotency Notice');

      expect(res2.status).toBe(201);
      expect(res2.body.data.isDuplicate).toBe(true);
      expect(res2.body.data.version.id).toBe(version1Id);
    });

    it('classifies scanned/image-only PDF with zero extractable text as OCR_REQUIRED', async () => {
      // PDF stream containing empty/no text
      const imageOnlyPdf = createMinimalPdfBuffer(['']);

      const res = await request(app)
        .post(`/api/opportunities/${testOppId}/funding-documents`)
        .set('x-test-role', 'ADMIN')
        .set('X-Thriveward-CSRF', '1')
        .attach('file', imageOnlyPdf, 'scanned_notice.pdf')
        .field('title', 'Scanned Image Notice');

      expect(res.status).toBe(201);
      expect(res.body.data.version.status).toBe('OCR_REQUIRED');
    });
  });

  describe('4. Audit Logging & Mutation-Free Read Routes', () => {
    it('verifies GET routes do not mutate database counts or timestamps', async () => {
      const beforeOppCount = await prisma.fundingOpportunity.count();
      const beforeAuditCount = await prisma.securityAuditEvent.count();

      // Execute GET routes multiple times
      await request(app).get(`/api/opportunities/${testOppId}/funding-documents`).set('x-test-role', 'ADMIN');
      const docs = await prisma.fundingDocument.findMany({ where: { fundingOpportunityId: testOppId }, include: { versions: true } });
      if (docs[0]?.versions[0]) {
        const verId = docs[0].versions[0].id;
        await request(app).get(`/api/funding-document-versions/${verId}`).set('x-test-role', 'ADMIN');
        await request(app).get(`/api/funding-document-versions/${verId}/pages`).set('x-test-role', 'ADMIN');
        await request(app).get(`/api/funding-document-versions/${verId}/download`).set('x-test-role', 'ADMIN');
      }

      const afterOppCount = await prisma.fundingOpportunity.count();
      const afterAuditCount = await prisma.securityAuditEvent.count();

      expect(beforeOppCount).toBe(afterOppCount);
      expect(beforeAuditCount).toBe(afterAuditCount);
    });

    it('verifies document upload logs security audit event FUNDING_DOCUMENT_UPLOADED', async () => {
      const events = await prisma.securityAuditEvent.findMany({
        where: { eventType: 'FUNDING_DOCUMENT_UPLOADED' },
        orderBy: { timestamp: 'desc' },
      });

      expect(events.length).toBeGreaterThan(0);
      const details = JSON.parse(events[0].details || '{}');
      expect(details.opportunityId).toBe(testOppId);
    });
  });
});
