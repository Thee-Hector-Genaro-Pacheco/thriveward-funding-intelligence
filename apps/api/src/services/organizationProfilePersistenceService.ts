import { Prisma } from '@prisma/client';

export interface AuthoritativeOrganizationProfileCreateInput {
  id?: string;
  name: string;
  status: string;
  taxStatus: string;
  primaryPopulations: string[];
  primaryOutcome: string;
  coreModel: string;
  limitations: string[];
  programs?: Prisma.ProgramCreateNestedManyWithoutOrganizationProfileInput;
}

export interface OrganizationProfileCreationStore<T = any> {
  create(args: { data: AuthoritativeOrganizationProfileCreateInput }): Promise<T>;
}

export interface OrganizationProfileSeedStore<T = any> extends OrganizationProfileCreationStore<T> {
  findFirst(args: { orderBy: { createdAt: 'asc' } }): Promise<T | null>;
}

function requireAuthoritativeState(value: unknown, field: string): asserts value is string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(
      `ORGANIZATION_PROFILE_AUTHORITATIVE_STATE_REQUIRED: ${field} must be explicitly provided.`
    );
  }
}

export async function createOrganizationProfile<T>(
  store: OrganizationProfileCreationStore<T>,
  input: AuthoritativeOrganizationProfileCreateInput
): Promise<T> {
  requireAuthoritativeState(input?.name, 'name');
  requireAuthoritativeState(input?.status, 'status');
  requireAuthoritativeState(input?.taxStatus, 'taxStatus');
  return store.create({ data: input });
}

export async function ensureSeedOrganizationProfile<T>(
  store: OrganizationProfileSeedStore<T>,
  input: AuthoritativeOrganizationProfileCreateInput
): Promise<T> {
  const existing = await store.findFirst({ orderBy: { createdAt: 'asc' } });
  if (existing) return existing;
  return createOrganizationProfile(store, input);
}
