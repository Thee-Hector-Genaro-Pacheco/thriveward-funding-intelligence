-- AlterTable
ALTER TABLE "FiscalSponsorCandidate" ADD COLUMN     "canonicalDomain" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "ein" TEXT,
ADD COLUMN     "hasLiveVerification" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "identityEvidenceCoverage" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "isMerged" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "mergedIntoId" TEXT,
ADD COLUMN     "operationalEvidenceCoverage" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "opportunityCompatibilityCoverage" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "verificationLevel" TEXT NOT NULL DEFAULT 'DIRECTORY_REPORTED';

-- AlterTable
ALTER TABLE "SponsorSourceCitation" ADD COLUMN     "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "responseHash" TEXT,
ADD COLUMN     "verificationLevel" TEXT NOT NULL DEFAULT 'DIRECTORY_REPORTED';

-- CreateTable
CREATE TABLE "SponsorDiscoveryQueryLog" (
    "id" TEXT NOT NULL,
    "sourceName" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL DEFAULT 'DIRECTORY_INDEX',
    "requestAttempted" BOOLEAN NOT NULL DEFAULT true,
    "httpStatus" INTEGER NOT NULL DEFAULT 200,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "responseHash" TEXT NOT NULL,
    "candidatesParsed" INTEGER NOT NULL DEFAULT 0,
    "recordsRejected" INTEGER NOT NULL DEFAULT 0,
    "rejectionReasons" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SponsorDiscoveryQueryLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FiscalSponsorCandidate_canonicalDomain_idx" ON "FiscalSponsorCandidate"("canonicalDomain");

-- CreateIndex
CREATE INDEX "FiscalSponsorCandidate_isMerged_idx" ON "FiscalSponsorCandidate"("isMerged");
