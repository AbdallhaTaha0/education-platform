CREATE TABLE "PythonRun" (
  "id" TEXT NOT NULL, "userId" TEXT NOT NULL, "assessmentId" TEXT,
  "idempotencyKey" TEXT NOT NULL, "inputHash" TEXT NOT NULL,
  "source" TEXT, "input" TEXT, "state" TEXT NOT NULL DEFAULT 'PENDING',
  "output" TEXT, "error" TEXT, "leaseToken" TEXT, "leasedUntil" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PythonRun_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PythonRun_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "PythonRun_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "PythonRun_userId_idempotencyKey_key" ON "PythonRun"("userId", "idempotencyKey");
CREATE INDEX "PythonRun_state_leasedUntil_createdAt_idx" ON "PythonRun"("state", "leasedUntil", "createdAt");
CREATE INDEX "PythonRun_userId_createdAt_idx" ON "PythonRun"("userId", "createdAt");
CREATE INDEX "PythonRun_createdAt_idx" ON "PythonRun"("createdAt");
-- Python previews and official submissions share the existing bounded admission.
CREATE TRIGGER python_admission_guard BEFORE INSERT OR UPDATE OR DELETE ON "PythonRun"
  FOR EACH ROW EXECUTE FUNCTION m9_admission();
