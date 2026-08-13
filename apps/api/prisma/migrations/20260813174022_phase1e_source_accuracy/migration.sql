-- CreateEnum
CREATE TYPE "SponsorshipModel" AS ENUM ('MODEL_A', 'MODEL_B', 'MODEL_C', 'MODEL_D', 'MODEL_E', 'MODEL_F', 'ORGANIZATION_SPECIFIC', 'UNKNOWN');

-- AlterTable
ALTER TABLE "FiscalSponsorCandidate" ADD COLUMN     "feeVerified" TEXT NOT NULL DEFAULT 'UNKNOWN',
ADD COLUMN     "governmentGrantAdministrationVerified" TEXT NOT NULL DEFAULT 'UNKNOWN',
ADD COLUMN     "identityVerified" TEXT NOT NULL DEFAULT 'UNKNOWN',
ADD COLUMN     "intakeStatus" TEXT NOT NULL DEFAULT 'UNKNOWN',
ADD COLUMN     "intakeStatusVerifiedAt" TIMESTAMP(3),
ADD COLUMN     "isFixture" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "leadTimeVerified" TEXT NOT NULL DEFAULT 'UNKNOWN',
ADD COLUMN     "opportunitySpecificCompatibility" TEXT NOT NULL DEFAULT 'HUMAN_CONFIRMATION_REQUIRED',
ADD COLUMN     "sponsorshipModelsVerified" TEXT NOT NULL DEFAULT 'UNKNOWN',
ADD COLUMN     "websiteVerified" TEXT NOT NULL DEFAULT 'UNKNOWN';
