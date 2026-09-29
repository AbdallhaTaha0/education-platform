-- M3 correction migration (additive only; original M3 migration untouched).
-- Adds owning-course scope to deletion operations so at most one active
-- deletion exists per course and surviving courses can regain visibility.
-- Backfills existing rows where the target is still present; evidence rows
-- whose targets are already gone keep NULL (NULLs never conflict in the
-- partial unique index).

ALTER TABLE "CatalogDeletionOperation" ADD COLUMN "courseId" TEXT;

UPDATE "CatalogDeletionOperation" AS op
SET "courseId" = c.id
FROM "Course" AS c
WHERE op."targetType" = 'COURSE' AND op."targetId" = c.id AND op."courseId" IS NULL;

UPDATE "CatalogDeletionOperation" AS op
SET "courseId" = s."courseId"
FROM "CourseSection" AS s
WHERE op."targetType" = 'SECTION' AND op."targetId" = s.id AND op."courseId" IS NULL;

UPDATE "CatalogDeletionOperation" AS op
SET "courseId" = s."courseId"
FROM "Lesson" AS l JOIN "CourseSection" AS s ON s.id = l."sectionId"
WHERE op."targetType" = 'LESSON' AND op."targetId" = l.id AND op."courseId" IS NULL;

CREATE INDEX "CatalogDeletionOperation_courseId_idx" ON "CatalogDeletionOperation"("courseId");
CREATE UNIQUE INDEX "CatalogDeletionOperation_active_course_uniq" ON "CatalogDeletionOperation"("courseId") WHERE status IN ('PENDING', 'RUNNING') AND "courseId" IS NOT NULL;
