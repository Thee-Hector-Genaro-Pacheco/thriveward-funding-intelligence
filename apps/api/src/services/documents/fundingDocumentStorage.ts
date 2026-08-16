import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export interface SaveDocumentInput {
  storageKey: string;
  bytes: Buffer;
}

export interface FundingDocumentStorage {
  save(input: SaveDocumentInput): Promise<void>;
  read(storageKey: string): Promise<Buffer>;
  exists(storageKey: string): Promise<boolean>;
}

export class LocalDockerDocumentStorage implements FundingDocumentStorage {
  private rootDir: string;

  constructor(rootDir?: string) {
    this.rootDir = rootDir || process.env.DOCUMENT_STORAGE_ROOT || '/data/funding-documents';
  }

  private resolveKeyPath(storageKey: string): string {
    const normalizedKey = path.normalize(storageKey).replace(/^(\.\.[\/\\])+/, '');
    if (normalizedKey.includes('..') || path.isAbsolute(normalizedKey)) {
      throw new Error(`[DOCUMENT_STORAGE_ERROR] Invalid storage key path traversal attempt: ${storageKey}`);
    }
    const fullPath = path.join(this.rootDir, normalizedKey);
    if (!fullPath.startsWith(path.resolve(this.rootDir))) {
      throw new Error(`[DOCUMENT_STORAGE_ERROR] Path traversal restriction triggered: ${storageKey}`);
    }
    return fullPath;
  }

  public async save(input: SaveDocumentInput): Promise<void> {
    const fullPath = this.resolveKeyPath(input.storageKey);
    const dir = path.dirname(fullPath);

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    if (fs.existsSync(fullPath)) {
      const existingBytes = fs.readFileSync(fullPath);
      const existingHash = crypto.createHash('sha256').update(existingBytes).digest('hex');
      const newHash = crypto.createHash('sha256').update(input.bytes).digest('hex');

      if (existingHash !== newHash) {
        throw new Error(`[DOCUMENT_STORAGE_ERROR] Immutable storage collision: File already exists at key '${input.storageKey}' with different SHA-256 hash.`);
      }
      return;
    }

    const tempPath = `${fullPath}.tmp.${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    fs.writeFileSync(tempPath, input.bytes);

    const writtenBytes = fs.readFileSync(tempPath);
    const writtenHash = crypto.createHash('sha256').update(writtenBytes).digest('hex');
    const expectedHash = crypto.createHash('sha256').update(input.bytes).digest('hex');

    if (writtenHash !== expectedHash) {
      if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
      throw new Error(`[DOCUMENT_STORAGE_ERROR] Storage integrity verification failed for key '${input.storageKey}'`);
    }

    fs.renameSync(tempPath, fullPath);
  }

  public async read(storageKey: string): Promise<Buffer> {
    const fullPath = this.resolveKeyPath(storageKey);
    if (!fs.existsSync(fullPath)) {
      throw new Error(`[DOCUMENT_STORAGE_ERROR] Document key not found in storage: ${storageKey}`);
    }
    return fs.readFileSync(fullPath);
  }

  public async exists(storageKey: string): Promise<boolean> {
    const fullPath = this.resolveKeyPath(storageKey);
    return fs.existsSync(fullPath);
  }
}
