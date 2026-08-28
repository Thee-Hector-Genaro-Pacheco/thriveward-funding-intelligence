import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';

const prismaDirectory = path.resolve(__dirname, '../../prisma');
const schema = fs.readFileSync(path.join(prismaDirectory, 'schema.prisma'), 'utf8');
const migration = fs.readFileSync(
  path.join(
    prismaDirectory,
    'migrations/20260827213000_org2b_remove_organization_profile_defaults/migration.sql'
  ),
  'utf8'
);

describe('ORG-2B OrganizationProfile schema contract', () => {
  it('requires name, status, and taxStatus without Prisma defaults', () => {
    const model = schema.match(/model OrganizationProfile \{([\s\S]*?)\n\}/)?.[1];

    expect(model).toBeDefined();
    expect(model).toMatch(/\bname\s+String\s*(?:\n|$)/);
    expect(model).toMatch(/\bstatus\s+String\s*(?:\n|$)/);
    expect(model).toMatch(/\btaxStatus\s+String\s*(?:\n|$)/);
    expect(model).not.toMatch(/\b(?:name|status|taxStatus)\s+String[^\n]*@default/);
    expect(model).not.toMatch(/\b(?:name|status|taxStatus)\s+String\?/);
  });

  it('uses a data-preserving forward migration that only drops the three defaults', () => {
    const statements = migration
      .replace(/--[^\n]*/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    expect(statements).toBe(
      'ALTER TABLE "OrganizationProfile" ALTER COLUMN "name" DROP DEFAULT, ALTER COLUMN "status" DROP DEFAULT, ALTER COLUMN "taxStatus" DROP DEFAULT;'
    );
    expect(migration).not.toMatch(/\b(?:UPDATE|INSERT|DELETE|TRUNCATE|DROP COLUMN|SET DATA TYPE)\b/i);
  });
});
