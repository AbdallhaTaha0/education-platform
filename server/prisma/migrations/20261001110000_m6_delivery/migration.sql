BEGIN;
CREATE TABLE "NotificationRollout" (id INTEGER PRIMARY KEY CHECK (id = 1), "installedAt" TIMESTAMP(3) NOT NULL);
INSERT INTO "NotificationRollout" VALUES (1, CURRENT_TIMESTAMP);
ALTER TABLE "Course" ADD COLUMN "firstPublicationAt" TIMESTAMP(3);
ALTER TABLE "RechargeRequest" ADD COLUMN "notificationRecordedAt" TIMESTAMP(3);
UPDATE "RechargeRequest" SET "notificationRecordedAt" = COALESCE("reviewedAt", CURRENT_TIMESTAMP) WHERE status <> 'PENDING';
-- Existing publication evidence is baselined, never announced retroactively.
UPDATE "Course" c SET "firstPublicationAt" = COALESCE(c."publishedAt", a.first_at, CURRENT_TIMESTAMP)
FROM (SELECT c2.id, MIN(a."createdAt") AS first_at FROM "Course" c2
 LEFT JOIN "AuditEvent" a ON a."entityId" = c2.id AND a."entityType" = 'Course'
 AND (a.action = 'COURSE_PUBLISHED' OR (a.action = 'COURSE_UNARCHIVED' AND a.metadata->>'restoredTo' = 'PUBLISHED'))
 GROUP BY c2.id) a
WHERE c.id = a.id AND (c."publishedAt" IS NOT NULL OR c.status = 'PUBLISHED' OR c."priorStatus" = 'PUBLISHED' OR a.first_at IS NOT NULL);
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM "Course" WHERE status = 'ARCHIVED' AND "priorStatus" IS NULL AND "firstPublicationAt" IS NULL) THEN
  RAISE EXCEPTION 'M6 activation blocked: archived course publication history needs explicit review';
 END IF;
END $$;
CREATE TABLE "NotificationExpiryMarker" (
 "studentId" TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE ON UPDATE CASCADE,
 "courseId" TEXT NOT NULL, "recordedExpiry" TIMESTAMP(3) NOT NULL,
 PRIMARY KEY ("studentId", "courseId")
);
ALTER TABLE "NotificationInboxState"
 ADD COLUMN "deliveredRevision" BIGINT NOT NULL DEFAULT 0,
 ADD COLUMN "signalLeaseToken" TEXT,
 ADD COLUMN "signalLeaseExpiresAt" TIMESTAMP(3),
 ADD COLUMN "signalNextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 ADD COLUMN "signalAttemptCount" INTEGER NOT NULL DEFAULT 0,
 ADD CONSTRAINT "NotificationInboxState_delivery_check" CHECK ("deliveredRevision" >= 0 AND "deliveredRevision" <= revision AND "signalAttemptCount" >= 0);
CREATE INDEX "NotificationInboxState_due_signal" ON "NotificationInboxState" ("signalNextAttemptAt", "userId") WHERE revision > "deliveredRevision";
COMMIT;
