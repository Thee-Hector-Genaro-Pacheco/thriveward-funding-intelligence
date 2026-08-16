import { parentPort, workerData } from 'worker_threads';
import crypto from 'crypto';
import { PDFParse } from 'pdf-parse';

export interface WorkerInputData {
  buffer: Buffer;
  documentVersionId: string;
  maxPages: number;
}

async function executePdfExtraction() {
  if (!parentPort || !workerData) {
    return;
  }

  try {
    const { buffer, documentVersionId, maxPages } = workerData as WorkerInputData;

    if (!buffer || buffer.length < 5) {
      throw new Error('MALFORMED_PDF: File buffer is empty or corrupted');
    }

    const header = buffer.subarray(0, 5).toString('ascii');
    if (header !== '%PDF-') {
      throw new Error('MALFORMED_PDF: Missing %PDF- magic header bytes');
    }

    const rawContent = buffer.toString('binary');
    if (rawContent.includes('/Encrypt') || rawContent.includes('/Encrypt ') || rawContent.includes('/Filter/Standard')) {
      throw new Error('ENCRYPTED_PDF: Password-protected or encrypted PDFs are not supported');
    }

    const parser = new PDFParse({ data: buffer });
    let textResult: any;
    try {
      textResult = await parser.getText();
    } catch (parseErr: any) {
      const errMsg = parseErr?.message || '';
      if (errMsg.includes('Password') || errMsg.includes('Encrypted') || parseErr?.name === 'PasswordException') {
        throw new Error('ENCRYPTED_PDF: Password-protected or encrypted PDFs are not supported');
      }
      throw new Error(`MALFORMED_PDF: Parser failed to parse PDF document: ${errMsg}`);
    }

    const totalPages = textResult.total || textResult.pages?.length || 0;
    if (totalPages > maxPages) {
      throw new Error(`PAGE_LIMIT_EXCEEDED: Document has ${totalPages} pages, exceeding limit of ${maxPages}`);
    }

    const pages: any[] = [];
    let totalChars = 0;

    for (const p of textResult.pages || []) {
      const pageNum = p.num;
      const rawText = p.text || '';
      const normalizedText = rawText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
      const textHash = crypto.createHash('sha256').update(normalizedText).digest('hex');
      const charCount = normalizedText.length;
      totalChars += charCount;

      pages.push({
        pageNumber: pageNum,
        text: normalizedText,
        textHash,
        characterCount: charCount,
        citationRef: `DOC.${documentVersionId}.PAGE.${pageNum}`,
      });
    }

    const isOcrRequired = totalChars < 20;

    parentPort.postMessage({
      success: true,
      data: {
        status: isOcrRequired ? 'OCR_REQUIRED' : 'READY',
        pageCount: totalPages,
        pages,
        extractionVersion: process.env.DOCUMENT_EXTRACTION_VERSION || 'pdf-page-text-v1',
      },
    });
  } catch (err: any) {
    parentPort.postMessage({
      success: false,
      error: err.message || 'EXTRACTION_FAILED: Internal worker extraction error',
    });
  }
}

executePdfExtraction();
