-- AlterTable
ALTER TABLE "MouChecklistItem" ADD COLUMN IF NOT EXISTS "authenticatedUserId" TEXT;

-- AlterTable
ALTER TABLE "OutreachDeliveryRecord" ADD COLUMN IF NOT EXISTS "authenticatedUserId" TEXT;

-- AlterTable
ALTER TABLE "OutreachDraftVersion" ADD COLUMN IF NOT EXISTS "creatorUserId" TEXT;

-- AlterTable
ALTER TABLE "OutreachFollowUp" ADD COLUMN IF NOT EXISTS "authenticatedUserId" TEXT;

-- AlterTable
ALTER TABLE "OutreachHumanApproval" ADD COLUMN IF NOT EXISTS "authenticatedUserId" TEXT;

-- AlterTable
ALTER TABLE "OutreachResponseRecord" ADD COLUMN IF NOT EXISTS "humanRecorderUserId" TEXT;

-- AlterTable
ALTER TABLE "OutreachWorkflowHistory" ADD COLUMN IF NOT EXISTS "actorRole" TEXT,
ADD COLUMN IF NOT EXISTS "authenticatedUserId" TEXT;

-- CreateTable
CREATE TABLE IF NOT EXISTS "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'OPERATOR',
    "accountState" TEXT NOT NULL DEFAULT 'ACTIVE',
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastLoginAt" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "UserSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sessionHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "UserSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "SecurityAuditEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "eventType" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "details" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SecurityAuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "UserSession_sessionHash_key" ON "UserSession"("sessionHash");

-- AddForeignKey
ALTER TABLE "UserSession" DROP CONSTRAINT IF EXISTS "UserSession_userId_fkey";
ALTER TABLE "UserSession" ADD CONSTRAINT "UserSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SecurityAuditEvent" DROP CONSTRAINT IF EXISTS "SecurityAuditEvent_userId_fkey";
ALTER TABLE "SecurityAuditEvent" ADD CONSTRAINT "SecurityAuditEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutreachDraftVersion" DROP CONSTRAINT IF EXISTS "OutreachDraftVersion_creatorUserId_fkey";
ALTER TABLE "OutreachDraftVersion" ADD CONSTRAINT "OutreachDraftVersion_creatorUserId_fkey" FOREIGN KEY ("creatorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutreachHumanApproval" DROP CONSTRAINT IF EXISTS "OutreachHumanApproval_authenticatedUserId_fkey";
ALTER TABLE "OutreachHumanApproval" ADD CONSTRAINT "OutreachHumanApproval_authenticatedUserId_fkey" FOREIGN KEY ("authenticatedUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutreachDeliveryRecord" DROP CONSTRAINT IF EXISTS "OutreachDeliveryRecord_authenticatedUserId_fkey";
ALTER TABLE "OutreachDeliveryRecord" ADD CONSTRAINT "OutreachDeliveryRecord_authenticatedUserId_fkey" FOREIGN KEY ("authenticatedUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutreachWorkflowHistory" DROP CONSTRAINT IF EXISTS "OutreachWorkflowHistory_authenticatedUserId_fkey";
ALTER TABLE "OutreachWorkflowHistory" ADD CONSTRAINT "OutreachWorkflowHistory_authenticatedUserId_fkey" FOREIGN KEY ("authenticatedUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutreachResponseRecord" DROP CONSTRAINT IF EXISTS "OutreachResponseRecord_humanRecorderUserId_fkey";
ALTER TABLE "OutreachResponseRecord" ADD CONSTRAINT "OutreachResponseRecord_humanRecorderUserId_fkey" FOREIGN KEY ("humanRecorderUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutreachFollowUp" DROP CONSTRAINT IF EXISTS "OutreachFollowUp_authenticatedUserId_fkey";
ALTER TABLE "OutreachFollowUp" ADD CONSTRAINT "OutreachFollowUp_authenticatedUserId_fkey" FOREIGN KEY ("authenticatedUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MouChecklistItem" DROP CONSTRAINT IF EXISTS "MouChecklistItem_authenticatedUserId_fkey";
ALTER TABLE "MouChecklistItem" ADD CONSTRAINT "MouChecklistItem_authenticatedUserId_fkey" FOREIGN KEY ("authenticatedUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
