-- M10 video-view tracking (agent 1): additive platform-owned view ledger.
--
-- Additive only. No existing table, column, index or data changes. Existing
-- LessonProgress rows are never converted into views. Counts are bound to the
-- media version actually watched via snapshot columns (no FK to MediaMapping
-- so retired-then-deleted mappings never delete historical views).
-- playedMilliseconds is reported playback activity, not proof of attention.
-- No credential is persisted.
CREATE TABLE "M10VideoViewSession" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "mediaAssetId" TEXT NOT NULL,
    "mediaExternalAssetId" TEXT NOT NULL,
    "playbackReferenceId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "countedAt" TIMESTAMP(3),
    "playedMilliseconds" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "M10VideoViewSession_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "M10VideoViewSession_played_nonnegative_check" CHECK ("playedMilliseconds" >= 0)
);

CREATE TABLE "M10ViewTrackingState" (
    "id" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "M10ViewTrackingState_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "M10VideoViewSession_playbackReferenceId_key" ON "M10VideoViewSession" ("playbackReferenceId");

CREATE INDEX "M10VideoViewSession_studentId_courseId_idx" ON "M10VideoViewSession" ("studentId", "courseId");

CREATE INDEX "M10VideoViewSession_studentId_courseId_lessonId_idx" ON "M10VideoViewSession" ("studentId", "courseId", "lessonId");

CREATE INDEX "M10VideoViewSession_studentId_courseId_countedAt_idx" ON "M10VideoViewSession" ("studentId", "courseId", "countedAt");

CREATE INDEX "M10VideoViewSession_courseId_lessonId_countedAt_idx" ON "M10VideoViewSession" ("courseId", "lessonId", "countedAt");

CREATE INDEX "M10VideoViewSession_lessonId_countedAt_idx" ON "M10VideoViewSession" ("lessonId", "countedAt");

CREATE INDEX "M10VideoViewSession_mediaAssetId_countedAt_idx" ON "M10VideoViewSession" ("mediaAssetId", "countedAt");

CREATE INDEX "M10VideoViewSession_countedAt_idx" ON "M10VideoViewSession" ("countedAt");

CREATE INDEX "M10VideoViewSession_startedAt_idx" ON "M10VideoViewSession" ("startedAt");

CREATE INDEX "M10VideoViewSession_studentId_countedAt_idx" ON "M10VideoViewSession" ("studentId", "countedAt");

ALTER TABLE "M10VideoViewSession" ADD CONSTRAINT "M10VideoViewSession_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
ADD CONSTRAINT "M10VideoViewSession_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Singleton coverage fence. No pre-activation backfill: periods before this
-- instant are UNKNOWN, never reliable zero.
INSERT INTO "M10ViewTrackingState" ("id", "startedAt")
VALUES ('global', CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;