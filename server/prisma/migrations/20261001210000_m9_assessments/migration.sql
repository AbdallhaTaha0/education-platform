-- CreateTable
CREATE TABLE "Assessment" (
    "id" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "required" BOOLEAN NOT NULL,
    "draftRequired" BOOLEAN,
    "version" INTEGER NOT NULL DEFAULT 0,
    "content" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Assessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssessmentVersion" (
    "id" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "content" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssessmentVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssessmentDraft" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "context" TEXT NOT NULL,
    "assessmentId" TEXT,
    "content" JSONB NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssessmentDraft_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssessmentSubmission" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "inputHash" TEXT NOT NULL,
    "answers" JSONB,
    "state" TEXT NOT NULL DEFAULT 'PENDING',
    "result" JSONB,
    "leaseToken" TEXT,
    "leasedUntil" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssessmentSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssessmentPass" (
    "studentId" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "passedVersion" INTEGER NOT NULL,
    "passedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssessmentPass_pkey" PRIMARY KEY ("studentId","assessmentId")
);

-- CreateTable
CREATE TABLE "PreservedLessonUnlock" (
    "studentId" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PreservedLessonUnlock_pkey" PRIMARY KEY ("studentId","lessonId")
);

-- CreateTable
CREATE TABLE "PracticeQuota" (
    "studentId" TEXT NOT NULL,
    "limit" INTEGER,
    "anchor" TIMESTAMP(3),
    "windowStart" TIMESTAMP(3) NOT NULL,
    "windowEnd" TIMESTAMP(3) NOT NULL,
    "used" INTEGER NOT NULL DEFAULT 0,
    "epoch" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PracticeQuota_pkey" PRIMARY KEY ("studentId")
);

-- CreateTable
CREATE TABLE "PracticeRun" (
    "studentId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "epoch" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PracticeRun_pkey" PRIMARY KEY ("studentId","idempotencyKey")
);

-- CreateTable
CREATE TABLE "AssessmentQueueBudget" (
    "id" INTEGER NOT NULL,
    "pending" INTEGER NOT NULL DEFAULT 0,
    "capacity" INTEGER NOT NULL DEFAULT 10000,

    CONSTRAINT "AssessmentQueueBudget_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Assessment_lessonId_status_idx" ON "Assessment"("lessonId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "AssessmentVersion_assessmentId_version_key" ON "AssessmentVersion"("assessmentId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "AssessmentDraft_studentId_context_key" ON "AssessmentDraft"("studentId", "context");

-- CreateIndex
CREATE INDEX "AssessmentSubmission_state_leasedUntil_createdAt_idx" ON "AssessmentSubmission"("state", "leasedUntil", "createdAt");

-- CreateIndex
CREATE INDEX "AssessmentSubmission_studentId_assessmentId_createdAt_idx" ON "AssessmentSubmission"("studentId", "assessmentId", "createdAt");

-- CreateIndex
CREATE INDEX "AssessmentSubmission_createdAt_idx" ON "AssessmentSubmission"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AssessmentSubmission_studentId_idempotencyKey_key" ON "AssessmentSubmission"("studentId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "PracticeRun_createdAt_idx" ON "PracticeRun"("createdAt");

-- AddForeignKey
ALTER TABLE "Assessment" ADD CONSTRAINT "Assessment_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentVersion" ADD CONSTRAINT "AssessmentVersion_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentDraft" ADD CONSTRAINT "AssessmentDraft_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentDraft" ADD CONSTRAINT "AssessmentDraft_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentSubmission" ADD CONSTRAINT "AssessmentSubmission_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentSubmission" ADD CONSTRAINT "AssessmentSubmission_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentSubmission" ADD CONSTRAINT "AssessmentSubmission_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "AssessmentVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentPass" ADD CONSTRAINT "AssessmentPass_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentPass" ADD CONSTRAINT "AssessmentPass_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreservedLessonUnlock" ADD CONSTRAINT "PreservedLessonUnlock_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreservedLessonUnlock" ADD CONSTRAINT "PreservedLessonUnlock_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PracticeQuota" ADD CONSTRAINT "PracticeQuota_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PracticeRun" ADD CONSTRAINT "PracticeRun_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Preserve existing reached lessons without fabricating assessment grades.
INSERT INTO "PreservedLessonUnlock" ("studentId", "lessonId")
SELECT "studentId", "lessonId" FROM "LessonProgress"
UNION SELECT "studentId", "lessonId" FROM "PlaybackReference"
ON CONFLICT DO NOTHING;

ALTER TABLE "Assessment" ADD CONSTRAINT "assessment_kind" CHECK (kind IN ('ASSIGNMENT','QUIZ'));
ALTER TABLE "Assessment" ADD CONSTRAINT "assessment_status" CHECK (status IN ('DRAFT','PUBLISHED','ARCHIVED'));
ALTER TABLE "AssessmentSubmission" ADD CONSTRAINT "submission_state" CHECK (state IN ('PENDING','RUNNING','CORRECT','INCORRECT','ERROR'));
ALTER TABLE "PracticeQuota" ADD CONSTRAINT "practice_bounds" CHECK (used >= 0 AND ("limit" IS NULL OR "limit" >= 0) AND "windowEnd" > "windowStart");

-- Durable bounded admission. This counter cannot be bypassed by replicas or
-- forgotten by queue loss. Terminal transitions/deletion release one slot.
INSERT INTO "AssessmentQueueBudget" (id, pending, capacity) VALUES (1,0,10000);
CREATE FUNCTION m9_admission() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='INSERT' AND NEW.state IN ('PENDING','RUNNING') THEN
    UPDATE "AssessmentQueueBudget" SET pending=pending+1 WHERE id=1 AND pending<capacity;
    IF NOT FOUND THEN RAISE EXCEPTION 'M9_QUEUE_BUSY'; END IF;
  ELSIF TG_OP='DELETE' THEN
    IF OLD.state IN ('PENDING','RUNNING') THEN UPDATE "AssessmentQueueBudget" SET pending=pending-1 WHERE id=1; END IF;
    RETURN OLD;
  ELSIF TG_OP='UPDATE' AND OLD.state IN ('PENDING','RUNNING') AND NEW.state NOT IN ('PENDING','RUNNING') THEN
    UPDATE "AssessmentQueueBudget" SET pending=pending-1 WHERE id=1;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER m9_admission_guard BEFORE INSERT OR UPDATE OR DELETE ON "AssessmentSubmission" FOR EACH ROW EXECUTE FUNCTION m9_admission();
ALTER TABLE "AssessmentQueueBudget" ADD CONSTRAINT "admission_bounds" CHECK (pending >= 0 AND pending <= capacity AND capacity > 0);
