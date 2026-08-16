-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('OFFICIAL_NOTICE', 'AMENDMENT', 'SUPPLEMENTAL', 'OTHER_OFFICIAL_DOCUMENT');

-- CreateEnum
CREATE TYPE "DocumentVersionStatus" AS ENUM ('UPLOADED', 'PROCESSING', 'READY', 'OCR_REQUIRED', 'FAILED', 'SUPERSEDED');

-- CreateTable
CREATE TABLE "FundingDocument" (
    "id" TEXT NOT NULL,
    "fundingOpportunityId" TEXT NOT NULL,
    "documentType" "DocumentType" NOT NULL DEFAULT 'OFFICIAL_NOTICE',
    "title" TEXT NOT NULL,
    "officialSourceUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FundingDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FundingDocumentVersion" (
    "id" TEXT NOT NULL,
    "fundingDocumentId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "status" "DocumentVersionStatus" NOT NULL DEFAULT 'UPLOADED',
    "originalFileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "pageCount" INTEGER NOT NULL DEFAULT 0,
    "extractionVersion" TEXT NOT NULL DEFAULT 'pdf-page-text-v1',
    "uploadedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "failureCode" TEXT,
    "failureMessage" TEXT,

    CONSTRAINT "FundingDocumentVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FundingDocumentPage" (
    "id" TEXT NOT NULL,
    "documentVersionId" TEXT NOT NULL,
    "pageNumber" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "textHash" TEXT NOT NULL,
    "characterCount" INTEGER NOT NULL,
    "citationRef" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FundingDocumentPage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FundingDocument_fundingOpportunityId_idx" ON "FundingDocument"("fundingOpportunityId");

-- CreateIndex
CREATE INDEX "FundingDocumentVersion_fundingDocumentId_idx" ON "FundingDocumentVersion"("fundingDocumentId");

-- CreateIndex
CREATE INDEX "FundingDocumentVersion_uploadedByUserId_idx" ON "FundingDocumentVersion"("uploadedByUserId");

-- CreateIndex
CREATE INDEX "FundingDocumentVersion_status_idx" ON "FundingDocumentVersion"("status");

-- CreateIndex
CREATE UNIQUE INDEX "FundingDocumentVersion_fundingDocumentId_version_key" ON "FundingDocumentVersion"("fundingDocumentId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "FundingDocumentVersion_fundingDocumentId_sha256_key" ON "FundingDocumentVersion"("fundingDocumentId", "sha256");

-- CreateIndex
CREATE INDEX "FundingDocumentPage_documentVersionId_idx" ON "FundingDocumentPage"("documentVersionId");

-- CreateIndex
CREATE INDEX "FundingDocumentPage_citationRef_idx" ON "FundingDocumentPage"("citationRef");

-- CreateIndex
CREATE UNIQUE INDEX "FundingDocumentPage_documentVersionId_pageNumber_key" ON "FundingDocumentPage"("documentVersionId", "pageNumber");

-- AddForeignKey
ALTER TABLE "FundingDocument" ADD CONSTRAINT "FundingDocument_fundingOpportunityId_fkey" FOREIGN KEY ("fundingOpportunityId") REFERENCES "FundingOpportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FundingDocumentVersion" ADD CONSTRAINT "FundingDocumentVersion_fundingDocumentId_fkey" FOREIGN KEY ("fundingDocumentId") REFERENCES "FundingDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FundingDocumentVersion" ADD CONSTRAINT "FundingDocumentVersion_uploadedByUserId_fkey" FOREIGN KEY ("uploadedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FundingDocumentPage" ADD CONSTRAINT "FundingDocumentPage_documentVersionId_fkey" FOREIGN KEY ("documentVersionId") REFERENCES "FundingDocumentVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
