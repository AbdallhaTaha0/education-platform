CREATE TABLE "AssessmentPreparation" (
 "id" TEXT NOT NULL PRIMARY KEY,
 "assessmentId" TEXT NOT NULL REFERENCES "Assessment"("id") ON DELETE CASCADE,
 "contentHash" TEXT NOT NULL,
 "content" JSONB NOT NULL,
 "state" TEXT NOT NULL DEFAULT 'PENDING',
 "result" JSONB,
 "error" TEXT,
 "leaseToken" TEXT,
 "leasedUntil" TIMESTAMP(3),
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "AssessmentPreparation_state_check" CHECK ("state" IN ('PENDING','RUNNING','READY','FAILED'))
);
CREATE UNIQUE INDEX "AssessmentPreparation_assessmentId_contentHash_key" ON "AssessmentPreparation"("assessmentId","contentHash");
CREATE INDEX "AssessmentPreparation_state_leasedUntil_createdAt_idx" ON "AssessmentPreparation"("state","leasedUntil","createdAt");
