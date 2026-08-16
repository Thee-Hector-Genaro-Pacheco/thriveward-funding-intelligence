import crypto from 'crypto';
import { PDFParse } from 'pdf-parse';

export interface ExtractedPageData {
  pageNumber: number;
  text: string;
  textHash: string;
  characterCount: number;
  citationRef: string;
}

export interface PdfExtractionResult {
  status: 'READY' | 'OCR_REQUIRED';
  pageCount: number;
  pages: ExtractedPageData[];
  extractionVersion: string;
}

export class PdfExtractionService {
  public static readonly EXTRACTION_VERSION = process.env.DOCUMENT_EXTRACTION_VERSION || 'pdf-page-text-v1';

  public static validatePdfHeader(buffer: Buffer): void {
    if (!buffer || buffer.length < 5) {
      throw new Error('MALFORMED_PDF: File buffer is empty or corrupted');
    }
    const header = buffer.subarray(0, 5).toString('ascii');
    if (header !== '%PDF-') {
      throw new Error('MALFORMED_PDF: Missing %PDF- magic header bytes');
    }
  }

  public static checkForEncryption(buffer: Buffer): void {
    const rawContent = buffer.toString('binary');
    if (rawContent.includes('/Encrypt') || rawContent.includes('/Encrypt ') || rawContent.includes('/Filter/Standard')) {
      throw new Error('ENCRYPTED_PDF: Password-protected or encrypted PDFs are not supported');
    }
  }

  public static async extractPageText(params: {
    documentVersionId: string;
    buffer: Buffer;
    maxPages?: number;
    timeoutMs?: number;
  }): Promise<PdfExtractionResult> {
    const { documentVersionId, buffer } = params;
    const maxPages = params.maxPages || Number(process.env.DOCUMENT_MAX_PAGES) || 300;
    const timeoutMs = params.timeoutMs || Number(process.env.DOCUMENT_EXTRACTION_TIMEOUT_MS) || 30000;

    PdfExtractionService.validatePdfHeader(buffer);
    PdfExtractionService.checkForEncryption(buffer);

    const parseTask = async (): Promise<PdfExtractionResult> => {
      const parser = new PDFParse({ data: buffer });
      const textResult = await parser.getText();


      const totalPages = textResult.total || textResult.pages?.length || 0;
      if (totalPages > maxPages) {
        throw new Error(`PAGE_LIMIT_EXCEEDED: Document has ${totalPages} pages, exceeding limit of ${maxPages}`);
      }

      const pages: ExtractedPageData[] = [];
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

      // Scanned or image-only PDF detection (fewer than 20 total extractable characters across all pages)
      const isOcrRequired = totalChars < 20;

      return {
        status: isOcrRequired ? 'OCR_REQUIRED' : 'READY',
        pageCount: totalPages,
        pages,
        extractionVersion: PdfExtractionService.EXTRACTION_VERSION,
      };
    };

    let timeoutId: NodeJS.Timeout;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(new Error(`EXTRACTION_TIMEOUT: Extraction exceeded limit of ${timeoutMs}ms`));
      }, timeoutMs);
    });

    try {
      const result = await Promise.race([parseTask(), timeoutPromise]);
      clearTimeout(timeoutId!);
      return result;
    } catch (err: any) {
      clearTimeout(timeoutId!);
      if (
        err.message?.startsWith('PAGE_LIMIT_EXCEEDED') ||
        err.message?.startsWith('EXTRACTION_TIMEOUT') ||
        err.message?.startsWith('ENCRYPTED_PDF') ||
        err.message?.startsWith('MALFORMED_PDF')
      ) {
        throw err;
      }
      throw new Error(`EXTRACTION_FAILED: ${err.message || 'Failed to parse PDF document'}`);
    }
  }
}
