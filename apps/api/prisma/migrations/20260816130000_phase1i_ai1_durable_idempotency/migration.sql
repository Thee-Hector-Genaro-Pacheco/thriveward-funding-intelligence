-- AlterTable
ALTER TABLE "AiEvaluation" ADD COLUMN "idempotencyKey" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "AiEvaluation_generatedByUserId_opportunityId_idempotencyKey_key" ON "AiEvaluation"("generatedByUserId", "opportunityId", "idempotencyKey");
