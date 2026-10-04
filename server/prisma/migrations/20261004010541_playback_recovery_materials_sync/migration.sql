-- CreateEnum
CREATE TYPE "CaptionState" AS ENUM ('PENDING', 'VALIDATED', 'FAILED');

-- AlterTable
ALTER TABLE "MediaMapping" ADD COLUMN     "durationSeconds" INTEGER;

-- CreateTable
CREATE TABLE "LessonCaption" (
    "id" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "labelAr" TEXT NOT NULL,
    "labelEn" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "byteSize" INTEGER NOT NULL,
    "cueCount" INTEGER NOT NULL,
    "state" "CaptionState" NOT NULL DEFAULT 'PENDING',
    "errorCategory" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "validatedAt" TIMESTAMP(3),

    CONSTRAINT "LessonCaption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LessonResource" (
    "id" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "labelAr" TEXT NOT NULL,
    "labelEn" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "byteSize" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LessonResource_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LessonCaption_storageKey_key" ON "LessonCaption"("storageKey");

-- CreateIndex
CREATE INDEX "LessonCaption_lessonId_idx" ON "LessonCaption"("lessonId");

-- CreateIndex
CREATE UNIQUE INDEX "LessonCaption_lessonId_language_key" ON "LessonCaption"("lessonId", "language");

-- CreateIndex
CREATE UNIQUE INDEX "LessonResource_storageKey_key" ON "LessonResource"("storageKey");

-- CreateIndex
CREATE INDEX "LessonResource_lessonId_idx" ON "LessonResource"("lessonId");

-- AddForeignKey
ALTER TABLE "LessonCaption" ADD CONSTRAINT "LessonCaption_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonResource" ADD CONSTRAINT "LessonResource_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

