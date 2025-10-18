-- Create SetupJob table for queue monitoring
CREATE TABLE "SetupJob" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "currentStep" TEXT,
    "config" JSONB NOT NULL,
    "error" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdBy" TEXT,
    "partnerId" TEXT,
    "customerId" TEXT,
    "reservationLedgerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SetupJob_pkey" PRIMARY KEY ("id")
);

-- Ensure jobId stays unique
CREATE UNIQUE INDEX "SetupJob_jobId_key" ON "SetupJob"("jobId");

-- Query helpers
CREATE INDEX "SetupJob_status_createdAt_idx" ON "SetupJob"("status", "createdAt");
CREATE INDEX "SetupJob_domain_idx" ON "SetupJob"("domain");
CREATE INDEX "SetupJob_partnerId_idx" ON "SetupJob"("partnerId");

-- Create SetupCleanup table to track cleanup tasks
CREATE TABLE "SetupCleanup" (
    "id" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "resources" JSONB NOT NULL,
    "status" TEXT NOT NULL,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    CONSTRAINT "SetupCleanup_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SetupCleanup_status_createdAt_idx" ON "SetupCleanup"("status", "createdAt");
CREATE INDEX "SetupCleanup_domain_idx" ON "SetupCleanup"("domain");
