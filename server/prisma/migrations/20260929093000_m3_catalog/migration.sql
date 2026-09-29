-- M3 catalog, administration, and platform-side DRM mapping.
-- Additive only: creates new enums/tables/indexes/checks. Never edits M1/M2.
-- Platform Prisma owns platform PostgreSQL only; no DRM tables here.
-- Catalog cascades are permitted only after external media deletion completes
-- (enforced in service code); deletions preserve operation/audit evidence via
-- identifier snapshots (no FK from deletion ops to catalog rows).
-- Rollback: previous images remain compatible (new tables unused by old code).
-- Do not use `migrate reset`; to roll back, redeploy the M2 image (tables stay, unused).

-- CreateEnum: course lifecycle
CREATE TYPE "CourseStatus" AS ENUM ('DRAFT', 'PROCESSING', 'READY', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum: local media lifecycle
CREATE TYPE "MediaState" AS ENUM ('UNREGISTERED', 'UPLOAD_PENDING', 'PROCESSING', 'READY', 'FAILED', 'DELETION_PENDING', 'DELETION_FAILED');

-- CreateEnum: durable deletion operation state
CREATE TYPE "CatalogDeletionStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED');

-- CreateEnum: deletion target snapshot
CREATE TYPE "CatalogDeletionTarget" AS ENUM ('COURSE', 'SECTION', 'LESSON');

-- CreateTable: Course
CREATE TABLE "Course" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "titleAr" TEXT NOT NULL,
    "titleEn" TEXT NOT NULL,
    "descriptionAr" TEXT NOT NULL,
    "descriptionEn" TEXT NOT NULL,
    "status" "CourseStatus" NOT NULL DEFAULT 'DRAFT',
    "priorStatus" "CourseStatus",
    "publishedAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "deletionRequestedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Course_pkey" PRIMARY KEY ("id")
);

-- CreateTable: CourseSection
CREATE TABLE "CourseSection" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "titleAr" TEXT NOT NULL,
    "titleEn" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CourseSection_pkey" PRIMARY KEY ("id")
);

-- CreateTable: Lesson
CREATE TABLE "Lesson" (
    "id" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "titleAr" TEXT NOT NULL,
    "titleEn" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Lesson_pkey" PRIMARY KEY ("id")
);

-- CreateTable: SubscriptionPlan (exact EGP piastres, fixed days)
CREATE TABLE "SubscriptionPlan" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "currentPricePiastres" INTEGER NOT NULL,
    "previousPricePiastres" INTEGER,
    "durationDays" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SubscriptionPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable: MediaMapping (one per lesson, opaque external ids)
CREATE TABLE "MediaMapping" (
    "id" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "externalAssetId" TEXT NOT NULL,
    "assetId" TEXT,
    "status" "MediaState" NOT NULL DEFAULT 'UPLOAD_PENDING',
    "idempotencyKey" TEXT NOT NULL,
    "uploadCompletedAt" TIMESTAMP(3),
    "lastSyncedAt" TIMESTAMP(3),
    "errorCategory" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MediaMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable: CatalogDeletionOperation (evidence survives target rows)
CREATE TABLE "CatalogDeletionOperation" (
    "id" TEXT NOT NULL,
    "targetType" "CatalogDeletionTarget" NOT NULL,
    "targetId" TEXT NOT NULL,
    "requestedBy" TEXT NOT NULL,
    "status" "CatalogDeletionStatus" NOT NULL DEFAULT 'PENDING',
    "errorCategory" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    CONSTRAINT "CatalogDeletionOperation_pkey" PRIMARY KEY ("id")
);

-- CreateTable: CatalogDeletionAsset (per-asset evidence snapshot)
CREATE TABLE "CatalogDeletionAsset" (
    "id" TEXT NOT NULL,
    "operationId" TEXT NOT NULL,
    "mappingId" TEXT NOT NULL,
    "drmAssetId" TEXT,
    "externalAssetId" TEXT NOT NULL,
    "drmDeletionId" TEXT,
    "lastState" TEXT,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "lastCheckedAt" TIMESTAMP(3),
    "errorCategory" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CatalogDeletionAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable: AuditEvent (sanitized metadata, never secrets)
CREATE TABLE "AuditEvent" (
    "id" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,
    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- Unique + indexes
CREATE UNIQUE INDEX "Course_slug_key" ON "Course"("slug");
CREATE INDEX "Course_status_idx" ON "Course"("status");
CREATE INDEX "Course_deletionRequestedAt_idx" ON "Course"("deletionRequestedAt");

CREATE UNIQUE INDEX "CourseSection_courseId_position_key" ON "CourseSection"("courseId", "position");
CREATE INDEX "CourseSection_courseId_position_idx" ON "CourseSection"("courseId", "position");

CREATE UNIQUE INDEX "Lesson_sectionId_position_key" ON "Lesson"("sectionId", "position");
CREATE INDEX "Lesson_sectionId_position_idx" ON "Lesson"("sectionId", "position");

CREATE INDEX "SubscriptionPlan_courseId_idx" ON "SubscriptionPlan"("courseId");

CREATE UNIQUE INDEX "MediaMapping_lessonId_key" ON "MediaMapping"("lessonId");
CREATE UNIQUE INDEX "MediaMapping_externalAssetId_key" ON "MediaMapping"("externalAssetId");
CREATE UNIQUE INDEX "MediaMapping_assetId_key" ON "MediaMapping"("assetId");
CREATE UNIQUE INDEX "MediaMapping_idempotencyKey_key" ON "MediaMapping"("idempotencyKey");
CREATE INDEX "MediaMapping_status_idx" ON "MediaMapping"("status");
CREATE INDEX "MediaMapping_assetId_idx" ON "MediaMapping"("assetId");

CREATE INDEX "CatalogDeletionOperation_target_idx" ON "CatalogDeletionOperation"("targetType", "targetId");
CREATE INDEX "CatalogDeletionOperation_status_idx" ON "CatalogDeletionOperation"("status");

CREATE INDEX "CatalogDeletionAsset_operationId_idx" ON "CatalogDeletionAsset"("operationId");
CREATE INDEX "CatalogDeletionAsset_drmDeletionId_idx" ON "CatalogDeletionAsset"("drmDeletionId");

CREATE INDEX "AuditEvent_actorUserId_idx" ON "AuditEvent"("actorUserId");
CREATE INDEX "AuditEvent_entity_idx" ON "AuditEvent"("entityType", "entityId");
CREATE INDEX "AuditEvent_createdAt_idx" ON "AuditEvent"("createdAt");

-- Foreign keys with explicit deletion behavior.
-- Catalog cascades are service-gated: rows are removed only after external
-- media deletion COMPLETES (or when no media exists). Evidence tables have no
-- FK to catalog rows so they survive target deletion.
ALTER TABLE "CourseSection" ADD CONSTRAINT "CourseSection_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Lesson" ADD CONSTRAINT "Lesson_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "CourseSection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SubscriptionPlan" ADD CONSTRAINT "SubscriptionPlan_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MediaMapping" ADD CONSTRAINT "MediaMapping_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CatalogDeletionAsset" ADD CONSTRAINT "CatalogDeletionAsset_operationId_fkey" FOREIGN KEY ("operationId") REFERENCES "CatalogDeletionOperation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Database-level CHECKs where Prisma cannot express them.
-- Nonblank bilingual fields (trimmed length > 0).
ALTER TABLE "Course" ADD CONSTRAINT "Course_titleAr_nonblank" CHECK (btrim("titleAr") <> '');
ALTER TABLE "Course" ADD CONSTRAINT "Course_titleEn_nonblank" CHECK (btrim("titleEn") <> '');
ALTER TABLE "Course" ADD CONSTRAINT "Course_descriptionAr_nonblank" CHECK (btrim("descriptionAr") <> '');
ALTER TABLE "Course" ADD CONSTRAINT "Course_descriptionEn_nonblank" CHECK (btrim("descriptionEn") <> '');
ALTER TABLE "CourseSection" ADD CONSTRAINT "CourseSection_titleAr_nonblank" CHECK (btrim("titleAr") <> '');
ALTER TABLE "CourseSection" ADD CONSTRAINT "CourseSection_titleEn_nonblank" CHECK (btrim("titleEn") <> '');
ALTER TABLE "Lesson" ADD CONSTRAINT "Lesson_titleAr_nonblank" CHECK (btrim("titleAr") <> '');
ALTER TABLE "Lesson" ADD CONSTRAINT "Lesson_titleEn_nonblank" CHECK (btrim("titleEn") <> '');

-- Positive positions.
ALTER TABLE "CourseSection" ADD CONSTRAINT "CourseSection_position_positive" CHECK ("position" >= 1);
ALTER TABLE "Lesson" ADD CONSTRAINT "Lesson_position_positive" CHECK ("position" >= 1);

-- Exact price/duration bounds + previous-price comparison (no floats, EGP piastres).
ALTER TABLE "SubscriptionPlan" ADD CONSTRAINT "SubscriptionPlan_currentPrice_bounds" CHECK ("currentPricePiastres" >= 1 AND "currentPricePiastres" <= 2000000000);
ALTER TABLE "SubscriptionPlan" ADD CONSTRAINT "SubscriptionPlan_previousPrice_bounds" CHECK ("previousPricePiastres" IS NULL OR ("previousPricePiastres" >= 1 AND "previousPricePiastres" <= 2000000000));
ALTER TABLE "SubscriptionPlan" ADD CONSTRAINT "SubscriptionPlan_previous_gt_current" CHECK ("previousPricePiastres" IS NULL OR "previousPricePiastres" > "currentPricePiastres");
ALTER TABLE "SubscriptionPlan" ADD CONSTRAINT "SubscriptionPlan_duration_bounds" CHECK ("durationDays" >= 1 AND "durationDays" <= 3650);

-- Partial unique: at most one active (PENDING/RUNNING) deletion per target.
-- Enforced in service code via advisory locks + lookup; this index makes it
-- durable under concurrency (only one active row per target).
CREATE UNIQUE INDEX "CatalogDeletionOperation_active_target_uniq" ON "CatalogDeletionOperation"("targetType", "targetId") WHERE "status" IN ('PENDING', 'RUNNING');
