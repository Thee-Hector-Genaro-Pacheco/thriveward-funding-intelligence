import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export interface FundingDocumentStorage {
  save(storageKey: string, buffer: Buffer): Promise<string>;
  read(storageKey: string): Promise<Buffer>;
  exists(storageKey: string): Promise<boolean>;
  delete(storageKey: string): Promise<void>;
  getStorageRoot(): string;
}

export class LocalDockerDocumentStorage implements FundingDocumentStorage {
  private rootDir: string;
  private canonicalRootDir: string;

  constructor(rootDir?: string) {
    let target = rootDir || process.env.DOCUMENT_STORAGE_ROOT;
    if (!target) {
      target = (process.env.NODE_ENV === 'test' || process.env.VITEST === 'true')
        ? path.resolve(__dirname, '../../../tmp_test_documents')
        : '/data/funding-documents';
    }

    try {
      if (!fs.existsSync(target)) {
        fs.mkdirSync(target, { recursive: true, mode: 0o755 });
      }
      this.rootDir = target;
      this.canonicalRootDir = fs.realpathSync(target);
    } catch (_) {
      const fallback = path.resolve(__dirname, '../../../tmp_test_documents');
      if (!fs.existsSync(fallback)) {
        fs.mkdirSync(fallback, { recursive: true, mode: 0o755 });
      }
      this.rootDir = fallback;
      this.canonicalRootDir = fs.realpathSync(fallback);
    }
  }


  public getStorageRoot(): string {
    return this.canonicalRootDir;
  }

  private resolveAndValidateKeyPath(storageKey: string): string {
    if (!storageKey || storageKey.includes('\0')) {
      throw new Error(`[DOCUMENT_STORAGE_ERROR] Invalid storage key containing null bytes or empty string`);
    }

    const normalizedKey = path.normalize(storageKey);
    const fullPath = path.resolve(this.canonicalRootDir, normalizedKey);

    const relative = path.relative(this.canonicalRootDir, fullPath);
    if (relative.startsWith('..') || path.isAbsolute(relative) || relative === '') {
      throw new Error(`[DOCUMENT_STORAGE_ERROR] Path containment violation: Key "${storageKey}" escapes storage root`);
    }

    // Verify parent components up to canonical root are not symlinks
    let current = path.dirname(fullPath);
    while (current.length >= this.canonicalRootDir.length) {
      if (fs.existsSync(current)) {
        const lstat = fs.lstatSync(current);
        if (lstat.isSymbolicLink()) {
          throw new Error(`[DOCUMENT_STORAGE_ERROR] Symlink detected in storage path directory component: ${current}`);
        }
      }
      if (current === this.canonicalRootDir) break;
      const parent = path.dirname(current);
      if (parent === current) break;
      current = parent;
    }

    return fullPath;
  }

  public async save(storageKey: string, buffer: Buffer): Promise<string> {
    const fullPath = this.resolveAndValidateKeyPath(storageKey);

    // If final target already exists, verify immutability & checksum
    if (fs.existsSync(fullPath)) {
      const lstat = fs.lstatSync(fullPath);
      if (lstat.isSymbolicLink()) {
        throw new Error(`[DOCUMENT_STORAGE_ERROR] Symlink attack detected at target file: ${fullPath}`);
      }
      const existingBuffer = fs.readFileSync(fullPath);
      const existingHash = crypto.createHash('sha256').update(existingBuffer).digest('hex');
      const newHash = crypto.createHash('sha256').update(buffer).digest('hex');

      if (existingHash === newHash) {
        return fullPath;
      } else {
        throw new Error(`[DOCUMENT_STORAGE_ERROR] Immutable storage collision: Target file exists with different content hash`);
      }
    }

    const parentDir = path.dirname(fullPath);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true, mode: 0o755 });
    }

    const tempPath = `${fullPath}.tmp.${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    try {

      // Exclusive temporary file creation (O_CREAT | O_EXCL | O_WRONLY | O_NOFOLLOW)
      const flags = fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_WRONLY | (fs.constants.O_NOFOLLOW || 0);
      const fd = fs.openSync(tempPath, flags, 0o600);
      fs.writeFileSync(fd, buffer);
      fs.closeSync(fd);

      // Verify temp file write integrity
      const writtenBuffer = fs.readFileSync(tempPath);
      const writtenHash = crypto.createHash('sha256').update(writtenBuffer).digest('hex');
      const expectedHash = crypto.createHash('sha256').update(buffer).digest('hex');

      if (writtenHash !== expectedHash) {
        throw new Error(`[DOCUMENT_STORAGE_ERROR] Post-write SHA-256 verification failed`);
      }

      // Rename temp file to final target
      fs.renameSync(tempPath, fullPath);
      return fullPath;
    } catch (err: any) {
      if (fs.existsSync(tempPath)) {
        try { fs.unlinkSync(tempPath); } catch (_) {}
      }
      throw new Error(`[DOCUMENT_STORAGE_ERROR] Failed to save document to storage: ${err.message}`);
    }
  }

  public async read(storageKey: string): Promise<Buffer> {
    const fullPath = this.resolveAndValidateKeyPath(storageKey);
    if (!fs.existsSync(fullPath)) {
      throw new Error(`[DOCUMENT_STORAGE_ERROR] Document not found at storage key: ${storageKey}`);
    }
    const lstat = fs.lstatSync(fullPath);
    if (lstat.isSymbolicLink()) {
      throw new Error(`[DOCUMENT_STORAGE_ERROR] Symlink detected when reading file: ${fullPath}`);
    }
    if (!lstat.isFile()) {
      throw new Error(`[DOCUMENT_STORAGE_ERROR] Target path is not a regular file: ${fullPath}`);
    }
    return fs.readFileSync(fullPath);
  }

  public async exists(storageKey: string): Promise<boolean> {
    try {
      const fullPath = this.resolveAndValidateKeyPath(storageKey);
      if (!fs.existsSync(fullPath)) return false;
      const lstat = fs.lstatSync(fullPath);
      return !lstat.isSymbolicLink() && lstat.isFile();
    } catch (_) {
      return false;
    }
  }

  public async delete(storageKey: string): Promise<void> {
    const fullPath = this.resolveAndValidateKeyPath(storageKey);
    if (fs.existsSync(fullPath)) {
      const lstat = fs.lstatSync(fullPath);
      if (lstat.isSymbolicLink()) {
        throw new Error(`[DOCUMENT_STORAGE_ERROR] Refusing to delete symbolic link: ${fullPath}`);
      }
      fs.unlinkSync(fullPath);
    }
  }
}
