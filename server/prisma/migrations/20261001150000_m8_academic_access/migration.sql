-- Expand without reclassifying courses or recalculating purchased access.
CREATE TYPE "AccessMode" AS ENUM ('DURATION', 'TERM_END', 'YEAR_END');
ALTER TABLE "Course" ADD COLUMN "grade" TEXT, ADD COLUMN "academicYear" TEXT,
  ADD COLUMN "term" INTEGER, ADD COLUMN "courseKind" TEXT, ADD COLUMN "teachingMonth" TEXT;
CREATE INDEX "Course_grade_academicYear_term_courseKind_idx" ON "Course"("grade","academicYear","term","courseKind");
ALTER TABLE "Course" ADD CONSTRAINT "Course_academic_shape" CHECK (
  ("grade" IS NULL AND "academicYear" IS NULL AND "term" IS NULL AND "courseKind" IS NULL AND "teachingMonth" IS NULL) OR
  ("grade" IS NOT NULL AND "academicYear" IS NOT NULL AND "courseKind" IS NOT NULL
   AND "grade" IN ('FIRST_SECONDARY','SECOND_SECONDARY')
   AND "academicYear" ~ '^[0-9]{4}/[0-9]{4}$'
   AND "courseKind" IN ('MONTHLY_EXPLANATION','REVISION')
   AND ("term" IS NULL OR "term" IN (1,2))
   AND ("grade" <> 'FIRST_SECONDARY' OR "term" IS NOT NULL)
   AND (("courseKind" = 'REVISION' AND "teachingMonth" IS NULL) OR
        ("courseKind" = 'MONTHLY_EXPLANATION' AND "teachingMonth" IS NOT NULL AND "teachingMonth" ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'))));
ALTER TABLE "SubscriptionPlan" ALTER COLUMN "durationDays" DROP NOT NULL,
  ADD COLUMN "accessMode" "AccessMode" NOT NULL DEFAULT 'DURATION', ADD COLUMN "accessEndsAt" TIMESTAMP(3);
ALTER TABLE "SubscriptionPlan" ADD CONSTRAINT "SubscriptionPlan_access_shape" CHECK (
  ("accessMode" = 'DURATION' AND "durationDays" IS NOT NULL AND "accessEndsAt" IS NULL) OR
  ("accessMode" <> 'DURATION' AND "durationDays" IS NULL AND "accessEndsAt" IS NOT NULL));
ALTER TABLE "Purchase" ALTER COLUMN "durationDays" DROP NOT NULL,
  ADD COLUMN "accessMode" "AccessMode" NOT NULL DEFAULT 'DURATION', ADD COLUMN "accessEndsAt" TIMESTAMP(3);
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_access_shape" CHECK (
  ("accessMode" = 'DURATION' AND "durationDays" IS NOT NULL AND "accessEndsAt" IS NULL) OR
  ("accessMode" <> 'DURATION' AND "durationDays" IS NULL AND "accessEndsAt" IS NOT NULL));
CREATE TABLE "CoursePackage" (
 "id" TEXT PRIMARY KEY, "titleAr" TEXT NOT NULL, "titleEn" TEXT NOT NULL,
 "descriptionAr" TEXT NOT NULL, "descriptionEn" TEXT NOT NULL,
 "status" TEXT NOT NULL DEFAULT 'DRAFT', "pricePiastres" INTEGER NOT NULL,
 "endsAt" TIMESTAMP(3) NOT NULL, "version" INTEGER NOT NULL DEFAULT 1,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
 CHECK ("status" IN ('DRAFT','PUBLISHED','ARCHIVED')), CHECK ("pricePiastres" BETWEEN 1 AND 2000000000),
 CHECK ("version" > 0), CHECK (btrim("titleAr") <> '' AND btrim("titleEn") <> '' AND btrim("descriptionAr") <> '' AND btrim("descriptionEn") <> ''));
CREATE TABLE "PackageMember" (
 "packageId" TEXT NOT NULL REFERENCES "CoursePackage"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 "courseId" TEXT NOT NULL REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 "position" INTEGER NOT NULL CHECK ("position" BETWEEN 1 AND 3),
 PRIMARY KEY ("packageId","courseId"), UNIQUE ("packageId","position"));
CREATE TABLE "PackagePurchase" (
 "id" TEXT PRIMARY KEY, "studentId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 "packageId" TEXT NOT NULL, "version" INTEGER NOT NULL, "titleAr" TEXT NOT NULL, "titleEn" TEXT NOT NULL,
 "pricePiastres" INTEGER NOT NULL CHECK ("pricePiastres" BETWEEN 1 AND 2000000000), "endsAt" TIMESTAMP(3) NOT NULL,
 "idempotencyKey" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE ("studentId","idempotencyKey"));
CREATE INDEX "PackagePurchase_studentId_createdAt_idx" ON "PackagePurchase"("studentId","createdAt");
CREATE TABLE "PackagePurchaseItem" (
 "purchaseId" TEXT NOT NULL REFERENCES "PackagePurchase"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 "courseId" TEXT NOT NULL, "titleAr" TEXT NOT NULL, "titleEn" TEXT NOT NULL,
 "position" INTEGER NOT NULL CHECK ("position" BETWEEN 1 AND 3),
 PRIMARY KEY ("purchaseId","courseId"), UNIQUE ("purchaseId","position"));
ALTER TABLE "Subscription" ALTER COLUMN "purchaseId" DROP NOT NULL,
 ADD COLUMN "packagePurchaseId" TEXT REFERENCES "PackagePurchase"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE UNIQUE INDEX "Subscription_packagePurchaseId_courseId_key" ON "Subscription"("packagePurchaseId","courseId");
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_purchase_source" CHECK (
 ("purchaseId" IS NOT NULL AND "packagePurchaseId" IS NULL) OR ("purchaseId" IS NULL AND "packagePurchaseId" IS NOT NULL));
