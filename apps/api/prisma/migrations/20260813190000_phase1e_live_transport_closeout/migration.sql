-- AlterTable
ALTER TABLE "SponsorDiscoveryQueryLog" ADD COLUMN     "candidatesAccepted" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "candidatesDeduplicated" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "contentType" TEXT,
ADD COLUMN     "fetchMode" TEXT NOT NULL DEFAULT 'LIVE_HTTP',
ADD COLUMN     "finalUrl" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "fixtureFallbackUsed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "pageTitle" TEXT,
ADD COLUMN     "redirectsFollowed" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "rejectionReason" TEXT,
ADD COLUMN     "requestedUrl" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "responseByteCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "sourceStatus" TEXT NOT NULL DEFAULT 'SUCCESS',
ADD COLUMN     "transportError" TEXT;
