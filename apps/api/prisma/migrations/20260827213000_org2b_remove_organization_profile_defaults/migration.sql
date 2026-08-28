-- ORG-2B: Require callers to provide authoritative organization identity and readiness states.
ALTER TABLE "OrganizationProfile"
  ALTER COLUMN "name" DROP DEFAULT,
  ALTER COLUMN "status" DROP DEFAULT,
  ALTER COLUMN "taxStatus" DROP DEFAULT;
