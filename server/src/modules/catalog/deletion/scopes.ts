import type { CatalogDeletionTarget, PrismaClient } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { ApiError } from '../../identity/errors.js';
import type { AffectedMedia, DeletionTargetType, TxClient } from '../types.js';

export interface DeletionScope {
  affected: AffectedMedia[];
  courseId: string;
  sectionIds: string[];
  lessonIds: string[];
}

async function courseScope(tx: TxClient, courseId: string): Promise<DeletionScope> {
  const course = await tx.course.findUnique({
    where: { id: courseId },
    include: { sections: { include: { lessons: { include: { media: true } } } } },
  });
  if (course === null) throw new ApiError(404, 'NOT_FOUND', 'Course not found.');
  const affected: AffectedMedia[] = [];
  const lessonIds: string[] = [];
  const children = await tx.courseSection.findMany({ where: { course: { revisionOwnerId: courseId } }, include: { lessons: { include: { media: true } } } });
  const allSections = [...course.sections, ...children];
  const sectionIds = allSections.map((s) => s.id);
  for (const s of allSections) {
    for (const l of s.lessons) {
      lessonIds.push(l.id);
      if (l.media !== null) {
        affected.push({
          mappingId: l.media.id,
          drmAssetId: l.media.assetId,
          externalAssetId: l.media.externalAssetId,
          lessonId: l.id,
          sectionId: s.id,
          courseId: course.id,
        });
      }
    }
  }
  return { affected, courseId: course.id, sectionIds, lessonIds };
}

async function sectionScope(tx: TxClient, sectionId: string): Promise<DeletionScope> {
  const section = await tx.courseSection.findUnique({
    where: { id: sectionId },
    include: { lessons: { include: { media: true } } },
  });
  if (section === null) throw new ApiError(404, 'NOT_FOUND', 'Section not found.');
  const affected: AffectedMedia[] = [];
  const lessonIds: string[] = [];
  for (const l of section.lessons) {
    lessonIds.push(l.id);
    if (l.media !== null) {
      affected.push({
        mappingId: l.media.id,
        drmAssetId: l.media.assetId,
        externalAssetId: l.media.externalAssetId,
        lessonId: l.id,
        sectionId: section.id,
        courseId: section.courseId,
      });
    }
  }
  return { affected, courseId: section.courseId, sectionIds: [section.id], lessonIds };
}

async function lessonScope(tx: TxClient, lessonId: string): Promise<DeletionScope> {
  const lesson = await tx.lesson.findUnique({
    where: { id: lessonId },
    include: { media: true, section: true },
  });
  if (lesson === null) throw new ApiError(404, 'NOT_FOUND', 'Lesson not found.');
  const affected: AffectedMedia[] = [];
  if (lesson.media !== null) {
    affected.push({
      mappingId: lesson.media.id,
      drmAssetId: lesson.media.assetId,
      externalAssetId: lesson.media.externalAssetId,
      lessonId: lesson.id,
      sectionId: lesson.sectionId,
      courseId: lesson.section.courseId,
    });
  }
  return {
    affected,
    courseId: lesson.section.courseId,
    sectionIds: [lesson.sectionId],
    lessonIds: [lesson.id],
  };
}

export async function collectDeletionScope(
  tx: TxClient,
  targetType: DeletionTargetType,
  targetId: string,
): Promise<DeletionScope> {
  if (targetType === 'COURSE') return courseScope(tx, targetId);
  if (targetType === 'SECTION') return sectionScope(tx, targetId);
  return lessonScope(tx, targetId);
}

export async function readDeletionScope(
  prisma: PrismaClient,
  targetType: DeletionTargetType,
  targetId: string,
): Promise<DeletionScope> {
  return collectDeletionScope(prisma as unknown as TxClient, targetType, targetId);
}

export async function findActiveOpForTarget(
  tx: TxClient,
  targetType: DeletionTargetType,
  targetId: string,
) {
  return tx.catalogDeletionOperation.findFirst({
    where: {
      targetType: targetType as CatalogDeletionTarget,
      targetId,
      status: { in: ['PENDING', 'RUNNING'] },
    },
  });
}

/** Course-scoped guard: at most one active deletion per owning course. */
export async function findActiveOpForCourse(
  tx: TxClient,
  courseId: string,
): Promise<{ id: string } | null> {
  const rows = await tx.$queryRaw<{ id: string }[]>(
    Prisma.sql`SELECT id FROM "CatalogDeletionOperation" WHERE "courseId" = ${courseId} AND status IN ('PENDING','RUNNING') LIMIT 1`,
  );
  const first = rows[0];
  return first === undefined ? null : { id: first.id };
}
