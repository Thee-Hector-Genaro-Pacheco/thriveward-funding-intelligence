import crypto from 'crypto';
import path from 'path';

export const DEVELOPMENT_DOCUMENT_DATABASE_NAME = 'bridge_ai_dev';
export const DOCUMENT_TYPES = [
  'OFFICIAL_NOTICE',
  'AMENDMENT',
  'SUPPLEMENTAL',
  'OTHER_OFFICIAL_DOCUMENT',
] as const;

export type DevelopmentDocumentType = typeof DOCUMENT_TYPES[number];

export interface DevelopmentDocumentArguments {
  opportunityId: string;
  filePath: string;
  title: string;
  documentType: DevelopmentDocumentType;
  uploadedByUserId: string;
  officialSourceUrl?: string;
  expectedSha256?: string;
  expectedExternalId?: string;
  expectedOpportunityNumber?: string;
}

interface DevelopmentOpportunityIdentity {
  id: string;
  sourceSystem: string;
  externalOpportunityId: string | null;
  fundingOpportunityNumber: string | null;
  title: string;
}

interface IngestionPage {
  characterCount: number;
}

interface IngestionResult {
  document: { id: string; documentType: string };
  version: {
    id: string;
    sha256: string;
    status: string;
    pageCount: number;
    pages?: IngestionPage[];
  };
  isDuplicate: boolean;
}

export interface DevelopmentDocumentDependencies {
  getCurrentDatabaseName(): Promise<string>;
  findOpportunity(id: string): Promise<DevelopmentOpportunityIdentity | null>;
  readFile(filePath: string): Promise<Buffer>;
  inspectFile(filePath: string): Promise<{ isFile: boolean }>;
  ingestDocument(input: {
    opportunityId: string;
    documentType: DevelopmentDocumentType;
    title: string;
    officialSourceUrl?: string;
    originalFileName: string;
    mimeType: 'application/pdf';
    bytes: Buffer;
    userId: string;
    idempotencyKey: string;
  }): Promise<IngestionResult>;
}

export interface DevelopmentDocumentOutput {
  databaseName: string;
  opportunityId: string;
  externalOpportunityId: string | null;
  fundingOpportunityNumber: string | null;
  fundingDocumentId: string;
  fundingDocumentVersionId: string;
  documentType: string;
  sha256: string;
  extractionStatus: string;
  pageCount: number;
  extractedCharacterCount: number;
  finalDocumentVersionStatus: string;
  isDuplicate: boolean;
  idempotencyKey: string;
}

function required(value: string | undefined, name: string): string {
  const normalized = value?.trim();
  if (!normalized) throw new Error(`DEVELOPMENT_DOCUMENT_ARGUMENT_REQUIRED: ${name}`);
  return normalized;
}

export function parseDevelopmentDocumentArguments(argv: string[]): DevelopmentDocumentArguments {
  const values = new Map<string, string>();
  for (let index = 0; index < argv.length; index += 2) {
    const flag = argv[index];
    const value = argv[index + 1];
    if (!flag?.startsWith('--') || value === undefined || value.startsWith('--')) {
      throw new Error(`DEVELOPMENT_DOCUMENT_ARGUMENT_INVALID: ${flag || 'unknown'}`);
    }
    if (values.has(flag)) throw new Error(`DEVELOPMENT_DOCUMENT_ARGUMENT_DUPLICATE: ${flag}`);
    values.set(flag, value);
  }

  const allowedFlags = new Set([
    '--opportunity-id', '--file', '--title', '--document-type', '--uploaded-by-user-id',
    '--official-source-url', '--expected-sha256', '--expected-external-id',
    '--expected-opportunity-number',
  ]);
  for (const flag of values.keys()) {
    if (!allowedFlags.has(flag)) throw new Error(`DEVELOPMENT_DOCUMENT_ARGUMENT_UNKNOWN: ${flag}`);
  }

  const documentType = required(values.get('--document-type'), '--document-type');
  if (!DOCUMENT_TYPES.includes(documentType as DevelopmentDocumentType)) {
    throw new Error(`DEVELOPMENT_DOCUMENT_TYPE_INVALID: ${documentType}`);
  }

  return {
    opportunityId: required(values.get('--opportunity-id'), '--opportunity-id'),
    filePath: required(values.get('--file'), '--file'),
    title: required(values.get('--title'), '--title'),
    documentType: documentType as DevelopmentDocumentType,
    uploadedByUserId: required(values.get('--uploaded-by-user-id'), '--uploaded-by-user-id'),
    officialSourceUrl: values.get('--official-source-url')?.trim() || undefined,
    expectedSha256: values.get('--expected-sha256')?.trim().toLowerCase() || undefined,
    expectedExternalId: values.get('--expected-external-id')?.trim() || undefined,
    expectedOpportunityNumber: values.get('--expected-opportunity-number')?.trim() || undefined,
  };
}

export function validateDevelopmentDocumentDatabaseName(databaseName: string): void {
  if (databaseName !== DEVELOPMENT_DOCUMENT_DATABASE_NAME) {
    throw new Error(
      `DEVELOPMENT_DOCUMENT_DATABASE_REJECTED: connected database must be exactly ${DEVELOPMENT_DOCUMENT_DATABASE_NAME}.`
    );
  }
}

function validateHash(hash: string, name: string): void {
  if (!/^[a-f0-9]{64}$/.test(hash)) throw new Error(`DEVELOPMENT_DOCUMENT_SHA256_INVALID: ${name}`);
}

export async function ingestDevelopmentDocument(
  args: DevelopmentDocumentArguments,
  dependencies: DevelopmentDocumentDependencies
): Promise<DevelopmentDocumentOutput> {
  if (process.env.NODE_ENV !== 'development') {
    throw new Error('DEVELOPMENT_DOCUMENT_ENVIRONMENT_REJECTED: NODE_ENV must be development.');
  }
  if (!path.isAbsolute(args.filePath)) {
    throw new Error('DEVELOPMENT_DOCUMENT_FILE_REJECTED: --file must be an absolute path.');
  }
  if (path.extname(args.filePath).toLowerCase() !== '.pdf') {
    throw new Error('DEVELOPMENT_DOCUMENT_FILE_REJECTED: --file must have a .pdf extension.');
  }

  const file = await dependencies.inspectFile(args.filePath).catch(() => null);
  if (!file) throw new Error('DEVELOPMENT_DOCUMENT_FILE_NOT_FOUND: file does not exist.');
  if (!file.isFile) throw new Error('DEVELOPMENT_DOCUMENT_FILE_REJECTED: path is not a regular file.');

  const bytes = await dependencies.readFile(args.filePath);
  if (bytes.length < 5 || bytes.subarray(0, 5).toString('ascii') !== '%PDF-') {
    throw new Error('DEVELOPMENT_DOCUMENT_FILE_REJECTED: file does not contain a PDF header.');
  }
  const sha256 = crypto.createHash('sha256').update(bytes).digest('hex');
  if (args.expectedSha256) {
    validateHash(args.expectedSha256, '--expected-sha256');
    if (sha256 !== args.expectedSha256) {
      throw new Error('DEVELOPMENT_DOCUMENT_SHA256_MISMATCH: actual file hash does not match expected hash.');
    }
  }

  const databaseName = await dependencies.getCurrentDatabaseName();
  validateDevelopmentDocumentDatabaseName(databaseName);

  const opportunity = await dependencies.findOpportunity(args.opportunityId);
  if (!opportunity || opportunity.id !== args.opportunityId) {
    throw new Error('DEVELOPMENT_DOCUMENT_OPPORTUNITY_REJECTED: exact opportunity ID was not found.');
  }
  if (args.expectedExternalId && opportunity.externalOpportunityId !== args.expectedExternalId) {
    throw new Error('DEVELOPMENT_DOCUMENT_OPPORTUNITY_REJECTED: externalOpportunityId differs.');
  }
  if (
    args.expectedOpportunityNumber &&
    opportunity.fundingOpportunityNumber !== args.expectedOpportunityNumber
  ) {
    throw new Error('DEVELOPMENT_DOCUMENT_OPPORTUNITY_REJECTED: fundingOpportunityNumber differs.');
  }

  const idempotencyKey = `dev-document:${args.opportunityId}:${sha256}`;
  const result = await dependencies.ingestDocument({
    opportunityId: args.opportunityId,
    documentType: args.documentType,
    title: args.title.trim(),
    officialSourceUrl: args.officialSourceUrl,
    originalFileName: path.basename(args.filePath),
    mimeType: 'application/pdf',
    bytes,
    userId: args.uploadedByUserId,
    idempotencyKey,
  });

  return {
    databaseName,
    opportunityId: opportunity.id,
    externalOpportunityId: opportunity.externalOpportunityId,
    fundingOpportunityNumber: opportunity.fundingOpportunityNumber,
    fundingDocumentId: result.document.id,
    fundingDocumentVersionId: result.version.id,
    documentType: result.document.documentType,
    sha256: result.version.sha256,
    extractionStatus: result.version.status,
    pageCount: result.version.pageCount,
    extractedCharacterCount: (result.version.pages || []).reduce(
      (total, page) => total + page.characterCount,
      0
    ),
    finalDocumentVersionStatus: result.version.status,
    isDuplicate: result.isDuplicate,
    idempotencyKey,
  };
}
