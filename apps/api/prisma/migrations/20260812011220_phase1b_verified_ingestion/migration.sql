-- AlterTable
ALTER TABLE "FundingOpportunity" ADD COLUMN     "externalOpportunityId" TEXT,
ADD COLUMN     "fundingOpportunityNumber" TEXT,
ADD COLUMN     "sourceLastUpdatedTimestamp" TIMESTAMP(3),
ADD COLUMN     "sourcePayloadHash" TEXT,
ADD COLUMN     "sourceSystem" TEXT NOT NULL DEFAULT 'DEMO_FIXTURE',
ADD COLUMN     "verificationStatus" TEXT NOT NULL DEFAULT 'PENDING_HUMAN_REVIEW';

-- CreateTable
CREATE TABLE "IngestionRun" (
    "id" TEXT NOT NULL,
    "sourceSystem" TEXT NOT NULL DEFAULT 'GRANTS_GOV',
    "searchParameters" JSONB NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completionTime" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'IN_PROGRESS',
    "recordsDiscovered" INTEGER NOT NULL DEFAULT 0,
    "recordsCreated" INTEGER NOT NULL DEFAULT 0,
    "recordsUpdated" INTEGER NOT NULL DEFAULT 0,
    "recordsUnchanged" INTEGER NOT NULL DEFAULT 0,
    "recordsFailed" INTEGER NOT NULL DEFAULT 0,
    "errorSummary" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IngestionRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SourceSnapshot" (
    "id" TEXT NOT NULL,
    "ingestionRunId" TEXT,
    "fundingOpportunityId" TEXT,
    "externalOpportunityId" TEXT NOT NULL,
    "retrievalTimestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "payloadHash" TEXT NOT NULL,
    "schemaVersion" TEXT NOT NULL DEFAULT '1.0',
    "rawPayload" JSONB NOT NULL,

    CONSTRAINT "SourceSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FundingOpportunity_sourceSystem_externalOpportunityId_key" ON "FundingOpportunity"("sourceSystem", "externalOpportunityId");

-- AddForeignKey
ALTER TABLE "SourceSnapshot" ADD CONSTRAINT "SourceSnapshot_ingestionRunId_fkey" FOREIGN KEY ("ingestionRunId") REFERENCES "IngestionRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceSnapshot" ADD CONSTRAINT "SourceSnapshot_fundingOpportunityId_fkey" FOREIGN KEY ("fundingOpportunityId") REFERENCES "FundingOpportunity"("id") ON DELETE SET NULL ON UPDATE CASCADE;
