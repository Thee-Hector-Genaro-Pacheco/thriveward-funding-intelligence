import crypto from 'crypto';

export interface RawChunkInput {
  pageId: string;
  pageNumber: number;
  text: string;
}

export interface PreparedChunk {
  documentPageId: string;
  pageNumber: number;
  chunkIndex: number;
  startOffset: number;
  endOffset: number;
  text: string;
  textHash: string;
  tokenCount: number;
  citationRef: string;
}

export interface ManifestResult {
  chunks: PreparedChunk[];
  sourceManifestHash: string;
  configurationHash: string;
  chunkingVersion: string;
  totalTokenCount: number;
}

export class DocumentChunkerService {
  public static readonly CHUNKING_VERSION = 'document-chunker-v1';
  public static readonly DEFAULT_TARGET_TOKENS = 500;
  public static readonly DEFAULT_OVERLAP_TOKENS = 75;

  /**
   * Generates deterministic page-bounded chunks for a list of document pages.
   */
  public static generateChunks(
    documentVersionId: string,
    pages: RawChunkInput[],
    targetTokens = DocumentChunkerService.DEFAULT_TARGET_TOKENS,
    overlapTokens = DocumentChunkerService.DEFAULT_OVERLAP_TOKENS
  ): ManifestResult {
    // Sort pages strictly by pageNumber ascending
    const sortedPages = [...pages].sort((a, b) => a.pageNumber - b.pageNumber);
    const preparedChunks: PreparedChunk[] = [];
    let totalTokenCount = 0;

    const manifestHasher = crypto.createHash('sha256');
    manifestHasher.update(`VERSION:${DocumentChunkerService.CHUNKING_VERSION};DOC_VER:${documentVersionId}\n`);

    for (const page of sortedPages) {
      const normalizedText = page.text.replace(/\r\n/g, '\n').trim();
      if (!normalizedText) {
        continue; // Skip empty pages without inventing content
      }

      manifestHasher.update(`PAGE:${page.pageNumber};HASH:${crypto.createHash('sha256').update(normalizedText).digest('hex')}\n`);

      const pageChunks = DocumentChunkerService.chunkPageText(
        documentVersionId,
        page.pageId,
        page.pageNumber,
        normalizedText,
        targetTokens,
        overlapTokens
      );

      for (const chunk of pageChunks) {
        preparedChunks.push(chunk);
        totalTokenCount += chunk.tokenCount;
      }
    }

    const sourceManifestHash = manifestHasher.digest('hex');

    const configHasher = crypto.createHash('sha256');
    configHasher.update(`MANIFEST:${sourceManifestHash};TARGET:${targetTokens};OVERLAP:${overlapTokens};VERSION:${DocumentChunkerService.CHUNKING_VERSION}`);
    const configurationHash = configHasher.digest('hex');

    return {
      chunks: preparedChunks,
      sourceManifestHash,
      configurationHash,
      chunkingVersion: DocumentChunkerService.CHUNKING_VERSION,
      totalTokenCount,
    };
  }

  /**
   * Helper to estimate token count based on standard ~4 characters per token heuristic.
   */
  public static estimateTokenCount(text: string): number {
    if (!text || text.length === 0) return 0;
    return Math.max(1, Math.ceil(text.length / 4));
  }

  /**
   * Deterministically splits a single page text into page-bounded chunks.
   * Guarantees 0% cross-page contamination.
   */
  private static chunkPageText(
    documentVersionId: string,
    documentPageId: string,
    pageNumber: number,
    pageText: string,
    targetTokens: number,
    overlapTokens: number
  ): PreparedChunk[] {
    const chunks: PreparedChunk[] = [];

    // Standard character-window equivalents (approx 4 chars/token)
    const targetChars = targetTokens * 4;
    const overlapChars = overlapTokens * 4;
    const stepChars = Math.max(100, targetChars - overlapChars);

    let startOffset = 0;
    let chunkIndex = 0;
    const textLength = pageText.length;

    if (textLength <= targetChars) {
      // Single chunk for entire page
      const chunkText = pageText;
      const textHash = crypto.createHash('sha256').update(chunkText, 'utf8').digest('hex');
      const tokenCount = DocumentChunkerService.estimateTokenCount(chunkText);
      const citationRef = `DOC.${documentVersionId}.PAGE.${pageNumber}`;

      chunks.push({
        documentPageId,
        pageNumber,
        chunkIndex: 0,
        startOffset: 0,
        endOffset: textLength,
        text: chunkText,
        textHash,
        tokenCount,
        citationRef,
      });

      return chunks;
    }

    while (startOffset < textLength) {
      let endOffset = Math.min(textLength, startOffset + targetChars);

      // Try to break at natural paragraph or sentence boundaries if within reasonable window
      if (endOffset < textLength) {
        const breakIndex = pageText.lastIndexOf('\n', endOffset);
        if (breakIndex > startOffset + Math.floor(targetChars * 0.5)) {
          endOffset = breakIndex + 1;
        } else {
          const periodIndex = pageText.lastIndexOf('. ', endOffset);
          if (periodIndex > startOffset + Math.floor(targetChars * 0.5)) {
            endOffset = periodIndex + 1;
          }
        }
      }

      const chunkText = pageText.slice(startOffset, endOffset);
      const textHash = crypto.createHash('sha256').update(chunkText, 'utf8').digest('hex');
      const tokenCount = DocumentChunkerService.estimateTokenCount(chunkText);
      const citationRef = `DOC.${documentVersionId}.PAGE.${pageNumber}`;

      chunks.push({
        documentPageId,
        pageNumber,
        chunkIndex,
        startOffset,
        endOffset,
        text: chunkText,
        textHash,
        tokenCount,
        citationRef,
      });

      if (endOffset >= textLength) {
        break;
      }

      startOffset = Math.max(startOffset + 1, endOffset - overlapChars);
      chunkIndex++;
    }

    return chunks;
  }
}
