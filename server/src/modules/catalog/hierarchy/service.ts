import { Prisma } from '@prisma/client';
import type { PrismaClient } from '@prisma/client';
import { ApiError } from '../../identity/errors.js';
import { audit } from '../audit.js';
import { courseIdForLesson, courseIdForSection, withCourseLock } from '../courseTx.js';
import type { TxClient } from '../types.js';
import { ensureLessonAdditionAllowed, ensureStructuralAllowed } from '../courses/service.js';
import {
  assertUuid,
  nonBlankString,
  rejectUnknownFields,
  validatePosition,
} from '../validation.js';

const SECTION_CREATE = new Set(['titleAr', 'titleEn', 'position']);
const SECTION_UPDATE = new Set(['titleAr', 'titleEn']);
const LESSON_CREATE = new Set(['titleAr', 'titleEn', 'position']);
const LESSON_UPDATE = new Set(['titleAr', 'titleEn']);

async function shiftSectionsForInsert(
  tx: TxClient,
  courseId: string,
  position: number,
): Promise<void> {
  await tx.$executeRaw(
    Prisma.sql`UPDATE "CourseSection" SET position = position + 1 WHERE "courseId" = ${courseId} AND position >= ${position}`,
  );
}

async function shiftLessonsForInsert(
  tx: TxClient,
  sectionId: string,
  position: number,
): Promise<void> {
  await tx.$executeRaw(
    Prisma.sql`UPDATE "Lesson" SET position = position + 1 WHERE "sectionId" = ${sectionId} AND position >= ${position}`,
  );
}

export async function createSection(
  prisma: PrismaClient,
  actorId: string,
  courseId: string,
  raw: unknown,
) {
  assertUuid(courseId, 'courseId');
  rejectUnknownFields(raw, SECTION_CREATE);
  const body = raw as Record<string, unknown>;
  const titleAr = nonBlankString(body['titleAr'], 'titleAr', 300);
  const titleEn = nonBlankString(body['titleEn'], 'titleEn', 300);
  return withCourseLock(prisma, courseId, async (tx) => {
    const course = await tx.course.findUnique({ where: { id: courseId } });
    if (course === null) throw new ApiError(404, 'NOT_FOUND', 'Course not found.');
    ensureStructuralAllowed(course);
    const count = await tx.courseSection.count({ where: { courseId } });
    const position =
      body['position'] === undefined ? count + 1 : validatePosition(body['position']);
    if (position < 1 || position > count + 1) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'Position out of range.', { field: 'position' });
    }
    if (position <= count) await shiftSectionsForInsert(tx, courseId, position);
    const created = await tx.courseSection.create({
      data: { courseId, titleAr, titleEn, position },
    });
    await audit(tx, {
      actorUserId: actorId,
      action: 'SECTION_CREATED',
      entityType: 'CourseSection',
      entityId: created.id,
      metadata: { courseId, position },
    });
    return created;
  });
}

export async function updateSection(
  prisma: PrismaClient,
  actorId: string,
  sectionId: string,
  raw: unknown,
) {
  assertUuid(sectionId, 'sectionId');
  rejectUnknownFields(raw, SECTION_UPDATE);
  const body = raw as Record<string, unknown>;
  const data: { titleAr?: string; titleEn?: string } = {};
  if (body['titleAr'] !== undefined) data.titleAr = nonBlankString(body['titleAr'], 'titleAr', 300);
  if (body['titleEn'] !== undefined) data.titleEn = nonBlankString(body['titleEn'], 'titleEn', 300);
  if (Object.keys(data).length === 0)
    throw new ApiError(400, 'VALIDATION_ERROR', 'No updatable fields.');
  const courseId = await courseIdForSection(prisma, sectionId);
  return withCourseLock(prisma, courseId, async (tx) => {
    const section = await tx.courseSection.findUnique({
      where: { id: sectionId },
      include: { course: true },
    });
    if (section === null) throw new ApiError(404, 'NOT_FOUND', 'Section not found.');
    ensureStructuralAllowed(section.course);
    const updated = await tx.courseSection.update({ where: { id: sectionId }, data });
    await audit(tx, {
      actorUserId: actorId,
      action: 'SECTION_UPDATED',
      entityType: 'CourseSection',
      entityId: sectionId,
      metadata: { fields: Object.keys(data) },
    });
    return updated;
  });
}

export async function deleteSection(prisma: PrismaClient, actorId: string, sectionId: string) {
  assertUuid(sectionId, 'sectionId');
  const courseId = await courseIdForSection(prisma, sectionId);
  return withCourseLock(prisma, courseId, async (tx) => {
    const section = await tx.courseSection.findUnique({
      where: { id: sectionId },
      include: { course: true, lessons: { include: { media: true } } },
    });
    if (section === null) throw new ApiError(404, 'NOT_FOUND', 'Section not found.');
    ensureStructuralAllowed(section.course);
    if (section.lessons.some((l) => l.media !== null)) {
      throw new ApiError(409, 'MEDIA_EXISTS', 'Section has media; use permanent deletion.');
    }
    await tx.lesson.deleteMany({ where: { sectionId } });
    await tx.courseSection.delete({ where: { id: sectionId } });
    await tx.$executeRaw(
      Prisma.sql`UPDATE "CourseSection" SET position = position - 1 WHERE "courseId" = ${section.courseId} AND position > ${section.position}`,
    );
    await audit(tx, {
      actorUserId: actorId,
      action: 'SECTION_DELETED',
      entityType: 'CourseSection',
      entityId: sectionId,
      metadata: { courseId: section.courseId },
    });
    return { ok: true };
  });
}

function assertCompleteSet(ordered: string[], existingIds: Set<string>): void {
  if (ordered.length !== existingIds.size) {
    throw new ApiError(
      400,
      'REORDER_INVALID',
      'Reorder must include the complete set exactly once.',
    );
  }
  const seen = new Set<string>();
  for (const id of ordered) {
    if (seen.has(id) || !existingIds.has(id)) {
      throw new ApiError(
        400,
        'REORDER_INVALID',
        'Reorder contains duplicates, omissions, or foreign IDs.',
      );
    }
    seen.add(id);
  }
}

export async function reorderSections(
  prisma: PrismaClient,
  actorId: string,
  courseId: string,
  raw: unknown,
) {
  assertUuid(courseId, 'courseId');
  const body = raw as { orderedIds?: unknown };
  if (typeof body !== 'object' || body === null || !Array.isArray(body.orderedIds)) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'orderedIds must be an array.', {
      field: 'orderedIds',
    });
  }
  const ordered = body.orderedIds as unknown[];
  for (const id of ordered) assertUuid(id, 'orderedIds');
  const ids = ordered as string[];
  return withCourseLock(prisma, courseId, async (tx) => {
    const course = await tx.course.findUnique({ where: { id: courseId } });
    if (course === null) throw new ApiError(404, 'NOT_FOUND', 'Course not found.');
    ensureStructuralAllowed(course);
    const existing = await tx.courseSection.findMany({ where: { courseId }, select: { id: true } });
    assertCompleteSet(ids, new Set(existing.map((s) => s.id)));
    await tx.$executeRaw(
      Prisma.sql`UPDATE "CourseSection" SET position = position + 100000 WHERE "courseId" = ${courseId}`,
    );
    for (let i = 0; i < ids.length; i += 1) {
      await tx.$executeRaw(
        Prisma.sql`UPDATE "CourseSection" SET position = ${i + 1} WHERE id = ${ids[i]}`,
      );
    }
    await audit(tx, {
      actorUserId: actorId,
      action: 'SECTIONS_REORDERED',
      entityType: 'Course',
      entityId: courseId,
      metadata: { count: ids.length },
    });
    return { ok: true };
  });
}

export async function createLesson(
  prisma: PrismaClient,
  actorId: string,
  sectionId: string,
  raw: unknown,
) {
  assertUuid(sectionId, 'sectionId');
  rejectUnknownFields(raw, LESSON_CREATE);
  const body = raw as Record<string, unknown>;
  const titleAr = nonBlankString(body['titleAr'], 'titleAr', 300);
  const titleEn = nonBlankString(body['titleEn'], 'titleEn', 300);
  const courseId = await courseIdForSection(prisma, sectionId);
  return withCourseLock(prisma, courseId, async (tx) => {
    const section = await tx.courseSection.findUnique({
      where: { id: sectionId },
      include: { course: true },
    });
    if (section === null) throw new ApiError(404, 'NOT_FOUND', 'Section not found.');
    ensureLessonAdditionAllowed(section.course);
    const count = await tx.lesson.count({ where: { sectionId } });
    const position =
      body['position'] === undefined ? count + 1 : validatePosition(body['position']);
    if (position < 1 || position > count + 1)
      throw new ApiError(400, 'VALIDATION_ERROR', 'Position out of range.', { field: 'position' });
    // Inserting before existing lessons changes their order; only draft courses permit that.
    if (position <= count) ensureStructuralAllowed(section.course);
    if (position <= count) await shiftLessonsForInsert(tx, sectionId, position);
    const created = await tx.lesson.create({ data: { sectionId, titleAr, titleEn, position } });
    await audit(tx, {
      actorUserId: actorId,
      action: 'LESSON_CREATED',
      entityType: 'Lesson',
      entityId: created.id,
      metadata: { sectionId, position },
    });
    return created;
  });
}

export async function updateLesson(
  prisma: PrismaClient,
  actorId: string,
  lessonId: string,
  raw: unknown,
) {
  assertUuid(lessonId, 'lessonId');
  rejectUnknownFields(raw, LESSON_UPDATE);
  const body = raw as Record<string, unknown>;
  const data: { titleAr?: string; titleEn?: string } = {};
  if (body['titleAr'] !== undefined) data.titleAr = nonBlankString(body['titleAr'], 'titleAr', 300);
  if (body['titleEn'] !== undefined) data.titleEn = nonBlankString(body['titleEn'], 'titleEn', 300);
  if (Object.keys(data).length === 0)
    throw new ApiError(400, 'VALIDATION_ERROR', 'No updatable fields.');
  const courseId = await courseIdForLesson(prisma, lessonId);
  return withCourseLock(prisma, courseId, async (tx) => {
    const lesson = await tx.lesson.findUnique({
      where: { id: lessonId },
      include: { section: { include: { course: true } } },
    });
    if (lesson === null) throw new ApiError(404, 'NOT_FOUND', 'Lesson not found.');
    ensureStructuralAllowed(lesson.section.course);
    const updated = await tx.lesson.update({ where: { id: lessonId }, data });
    await audit(tx, {
      actorUserId: actorId,
      action: 'LESSON_UPDATED',
      entityType: 'Lesson',
      entityId: lessonId,
      metadata: { fields: Object.keys(data) },
    });
    return updated;
  });
}

export async function deleteLesson(prisma: PrismaClient, actorId: string, lessonId: string) {
  assertUuid(lessonId, 'lessonId');
  const courseId = await courseIdForLesson(prisma, lessonId);
  return withCourseLock(prisma, courseId, async (tx) => {
    const lesson = await tx.lesson.findUnique({
      where: { id: lessonId },
      include: { media: true, section: { include: { course: true } } },
    });
    if (lesson === null) throw new ApiError(404, 'NOT_FOUND', 'Lesson not found.');
    ensureStructuralAllowed(lesson.section.course);
    if (lesson.media !== null)
      throw new ApiError(409, 'MEDIA_EXISTS', 'Lesson has media; use permanent deletion.');
    await tx.lesson.delete({ where: { id: lessonId } });
    await tx.$executeRaw(
      Prisma.sql`UPDATE "Lesson" SET position = position - 1 WHERE "sectionId" = ${lesson.sectionId} AND position > ${lesson.position}`,
    );
    await audit(tx, {
      actorUserId: actorId,
      action: 'LESSON_DELETED',
      entityType: 'Lesson',
      entityId: lessonId,
      metadata: { sectionId: lesson.sectionId },
    });
    return { ok: true };
  });
}

export async function reorderLessons(
  prisma: PrismaClient,
  actorId: string,
  sectionId: string,
  raw: unknown,
) {
  assertUuid(sectionId, 'sectionId');
  const body = raw as { orderedIds?: unknown };
  if (typeof body !== 'object' || body === null || !Array.isArray(body.orderedIds)) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'orderedIds must be an array.', {
      field: 'orderedIds',
    });
  }
  const ordered = body.orderedIds as unknown[];
  for (const id of ordered) assertUuid(id, 'orderedIds');
  const ids = ordered as string[];
  const courseId = await courseIdForSection(prisma, sectionId);
  return withCourseLock(prisma, courseId, async (tx) => {
    const section = await tx.courseSection.findUnique({
      where: { id: sectionId },
      include: { course: true },
    });
    if (section === null) throw new ApiError(404, 'NOT_FOUND', 'Section not found.');
    ensureStructuralAllowed(section.course);
    const existing = await tx.lesson.findMany({ where: { sectionId }, select: { id: true } });
    assertCompleteSet(ids, new Set(existing.map((l) => l.id)));
    await tx.$executeRaw(
      Prisma.sql`UPDATE "Lesson" SET position = position + 100000 WHERE "sectionId" = ${sectionId}`,
    );
    for (let i = 0; i < ids.length; i += 1) {
      await tx.$executeRaw(
        Prisma.sql`UPDATE "Lesson" SET position = ${i + 1} WHERE id = ${ids[i]}`,
      );
    }
    await audit(tx, {
      actorUserId: actorId,
      action: 'LESSONS_REORDERED',
      entityType: 'CourseSection',
      entityId: sectionId,
      metadata: { count: ids.length },
    });
    return { ok: true };
  });
}
