import { Worker } from 'worker_threads';

export interface ExtractedPage {
  pageNumber: number;
  text: string;
  textHash: string;
  characterCount: number;
  citationRef: string;
}

export interface PdfExtractionResult {
  status: 'READY' | 'OCR_REQUIRED';
  pageCount: number;
  pages: ExtractedPage[];
  extractionVersion: string;
}

const WORKER_SCRIPT = `
const { parentPort, workerData } = require('worker_threads');
const crypto = require('crypto');
const { PDFParse } = require('pdf-parse');

async function executePdfExtraction() {
  if (!parentPort || !workerData) return;
  try {
    const { buffer, documentVersionId, maxPages } = workerData;
    const pdfBuf = Buffer.from(buffer);

    if (!pdfBuf || pdfBuf.length < 5) {
      throw new Error('MALFORMED_PDF: File buffer is empty or corrupted');
    }

    const header = pdfBuf.subarray(0, 5).toString('ascii');
    if (header !== '%PDF-') {
      throw new Error('MALFORMED_PDF: Missing %PDF- magic header bytes');
    }

    const rawContent = pdfBuf.toString('binary');
    if (rawContent.includes('/Encrypt') || rawContent.includes('/Encrypt ') || rawContent.includes('/Filter/Standard')) {
      throw new Error('ENCRYPTED_PDF: Password-protected or encrypted PDFs are not supported');
    }

    const parser = new PDFParse({ data: pdfBuf });
    let textResult;
    try {
      textResult = await parser.getText();
    } catch (parseErr) {
      const errMsg = parseErr?.message || '';
      if (errMsg.includes('Password') || errMsg.includes('Encrypted') || parseErr?.name === 'PasswordException') {
        throw new Error('ENCRYPTED_PDF: Password-protected or encrypted PDFs are not supported');
      }
      throw new Error('MALFORMED_PDF: Parser failed to parse PDF document: ' + errMsg);
    }

    const totalPages = textResult.total || textResult.pages?.length || 0;
    if (totalPages > maxPages) {
      throw new Error('PAGE_LIMIT_EXCEEDED: Document has ' + totalPages + ' pages, exceeding limit of ' + maxPages);
    }

    const pages = [];
    let totalChars = 0;

    for (const p of textResult.pages || []) {
      const pageNum = p.num;
      const rawText = p.text || '';
      const normalizedText = rawText.replace(/\\r\\n/g, '\\n').replace(/\\r/g, '\\n');
      const textHash = crypto.createHash('sha256').update(normalizedText).digest('hex');
      const charCount = normalizedText.length;
      totalChars += charCount;

      pages.push({
        pageNumber: pageNum,
        text: normalizedText,
        textHash,
        characterCount: charCount,
        citationRef: 'DOC.' + documentVersionId + '.PAGE.' + pageNum,
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
  } catch (err) {
    parentPort.postMessage({
      success: false,
      error: err.message || 'EXTRACTION_FAILED: Internal worker extraction error',
    });
  }
}

executePdfExtraction();
`;

export class PdfExtractionService {
  public static validatePdfHeader(buffer: Buffer): void {
    if (!buffer || buffer.length < 5) {
      throw new Error('MALFORMED_PDF: File buffer is empty or corrupted');
    }
    const header = buffer.subarray(0, 5).toString('ascii');
    if (header !== '%PDF-') {
      throw new Error('MALFORMED_PDF: Missing %PDF- magic header bytes');
    }
  }

  public static async extractPageText(
    buffer: Buffer,
    documentVersionId: string
  ): Promise<PdfExtractionResult> {
    this.validatePdfHeader(buffer);

    const maxPages = Number(process.env.DOCUMENT_MAX_PAGES) || 300;
    const maxBytes = Number(process.env.DOCUMENT_MAX_FILE_BYTES) || 26214400;
    const timeoutMs = Number(process.env.DOCUMENT_EXTRACTION_TIMEOUT_MS) || 30000;

    if (buffer.length > maxBytes) {
      throw new Error(`FILE_SIZE_EXCEEDED: Document size (${buffer.length} bytes) exceeds limit of ${maxBytes} bytes`);
    }

    return new Promise<PdfExtractionResult>((resolve, reject) => {
      let worker: Worker | null = null;
      let timer: NodeJS.Timeout | null = null;
      let isSettled = false;

      const cleanup = () => {
        if (timer) {
          clearTimeout(timer);
          timer = null;
        }
        if (worker) {
          worker.removeAllListeners();
          worker.terminate().catch(() => {});
          worker = null;
        }
      };

      try {
        worker = new Worker(WORKER_SCRIPT, {
          eval: true,
          workerData: {
            buffer,
            documentVersionId,
            maxPages,
          },
        });
      } catch (err: any) {
        return reject(new Error(`EXTRACTION_FAILED: Failed to spawn extraction worker thread: ${err.message}`));
      }

      timer = setTimeout(() => {
        if (isSettled) return;
        isSettled = true;
        cleanup();
        reject(new Error(`EXTRACTION_TIMEOUT: PDF page text extraction timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      worker.on('message', (msg: any) => {
        if (isSettled) return;
        isSettled = true;
        cleanup();

        if (msg.success) {
          resolve(msg.data as PdfExtractionResult);
        } else {
          reject(new Error(msg.error || 'EXTRACTION_FAILED: Worker reported extraction error'));
        }
      });

      worker.on('error', (err: Error) => {
        if (isSettled) return;
        isSettled = true;
        cleanup();
        reject(new Error(`EXTRACTION_FAILED: PDF extraction worker thread crashed: ${err.message}`));
      });

      worker.on('exit', (code: number) => {
        if (isSettled) return;
        isSettled = true;
        cleanup();
        if (code !== 0) {
          reject(new Error(`EXTRACTION_FAILED: PDF extraction worker thread exited with code ${code}`));
        }
      });
    });
  }
}
