-- M5 protected learning: lesson progress and non-secret external playback
-- references.
--
-- Additive only. No existing table or column changes. The DRM playback bearer
-- token, signed assertion, manifest/license URL, content key and KID are
-- deliberately NOT persisted anywhere in the platform database.

CREATE TYPE "PlaybackSessionStatus" AS ENUM ('ACTIVE', 'ENDED', 'TERMINATED', 'TERMINATION_FAILED');

CREATE TYPE "TerminationStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED', 'NOT_REQUIRED');

CREATE TYPE "PlaybackEndReason" AS ENUM ('VIEWER_END', 'SUBSCRIPTION_EXPIRED');

CREATE TABLE "LessonProgress" (
    "id"              TEXT NOT NULL,
    "studentId"       TEXT NOT NULL,
    "lessonId"        TEXT NOT NULL,
    "courseId"        TEXT NOT NULL,
    "positionSeconds" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "durationSeconds" DOUBLE PRECISION,
    "completedAt"     TIMESTAMP(3),
    "lastAccessedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"       TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LessonProgress_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "LessonProgress_position_finite_check"
      CHECK ("positionSeconds" >= 0 AND "positionSeconds" < 1000000),
    CONSTRAINT "LessonProgress_duration_finite_check"
      CHECK ("durationSeconds" IS NULL OR ("durationSeconds" >= 0 AND "durationSeconds" < 1000000)),
    CONSTRAINT "LessonProgress_completed_needs_position_check"
      CHECK ("completedAt" IS NULL OR "positionSeconds" >= 0)
);

CREATE TABLE "PlaybackReference" (
    "id"                  TEXT NOT NULL,
    "studentId"           TEXT NOT NULL,
    "lessonId"            TEXT NOT NULL,
    "courseId"            TEXT NOT NULL,
    "externalSessionId"   TEXT NOT NULL,
    "externalAssetId"     TEXT NOT NULL,
    "provider"            TEXT NOT NULL,
    "status"              "PlaybackSessionStatus" NOT NULL DEFAULT 'ACTIVE',
    "terminationStatus"   "TerminationStatus",
    "pendingEndReason"    "PlaybackEndReason",
    "terminationAttempts" INTEGER NOT NULL DEFAULT 0,
    "nextTerminationAt"   TIMESTAMP(3),
    "lastErrorCategory"   TEXT,
    "tokenExpiresAt"      TIMESTAMP(3) NOT NULL,
    "sessionExpiresAt"    TIMESTAMP(3) NOT NULL,
    "endedAt"             TIMESTAMP(3),
    "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"           TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlaybackReference_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "PlaybackReference_attempts_nonnegative_check" CHECK ("terminationAttempts" >= 0),
    CONSTRAINT "PlaybackReference_expiry_order_check" CHECK ("sessionExpiresAt" > "tokenExpiresAt"),
    -- A reference only owes a termination call when the reason is recorded, and
    -- a recorded reason never outlives a completed or exhausted termination.
    CONSTRAINT "PlaybackReference_pending_reason_check" CHECK (
      ("pendingEndReason" IS NULL) OR ("terminationStatus" IN ('PENDING', 'FAILED'))
    ),
    -- A confirmed ENDED or TERMINATED row must carry its end instant.
    -- TERMINATION_FAILED is the deliberate exception: it records that retries
    -- were exhausted while the external session may still be open, so
    -- fabricating an end instant would be a lie.
    CONSTRAINT "PlaybackReference_active_needs_termination_check"
      CHECK (
        ("status" = 'ACTIVE')
        OR ("status" = 'TERMINATION_FAILED')
        OR "endedAt" IS NOT NULL
      )
);

CREATE UNIQUE INDEX "LessonProgress_studentId_lessonId_key" ON "LessonProgress"("studentId", "lessonId");
CREATE INDEX "LessonProgress_studentId_courseId_idx" ON "LessonProgress"("studentId", "courseId");
CREATE INDEX "LessonProgress_studentId_lastAccessedAt_idx" ON "LessonProgress"("studentId", "lastAccessedAt");

CREATE UNIQUE INDEX "PlaybackReference_externalSessionId_key" ON "PlaybackReference"("externalSessionId");
CREATE INDEX "PlaybackReference_studentId_status_idx" ON "PlaybackReference"("studentId", "status");
CREATE INDEX "PlaybackReference_status_nextTerminationAt_idx" ON "PlaybackReference"("status", "nextTerminationAt");
CREATE INDEX "PlaybackReference_studentId_courseId_idx" ON "PlaybackReference"("studentId", "courseId");
CREATE INDEX "PlaybackReference_courseId_status_idx" ON "PlaybackReference"("courseId", "status");

ALTER TABLE "LessonProgress"
  ADD CONSTRAINT "LessonProgress_studentId_fkey" FOREIGN KEY ("studentId")
    REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "LessonProgress_lessonId_fkey" FOREIGN KEY ("lessonId")
    REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PlaybackReference"
  ADD CONSTRAINT "PlaybackReference_studentId_fkey" FOREIGN KEY ("studentId")
    REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "PlaybackReference_lessonId_fkey" FOREIGN KEY ("lessonId")
    REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;
