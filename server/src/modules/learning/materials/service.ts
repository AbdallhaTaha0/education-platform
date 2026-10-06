import { randomUUID } from 'node:crypto';
import type { PrismaClient, Prisma } from '@prisma/client';
import type { StorageClient } from '../../../infra/storage.js';
import { LearningError } from '../errors.js';
import { evaluateEntitlement } from '../access/entitlement.js';
import { assertLessonUnlocked } from '../../assessments/progression.js';
import { lockCourseRow } from '../../catalog/locks.js';
import { ensureMutable } from '../../catalog/courses/service.js';
import { validateResourceBytes, sanitizeFilename } from './validation.js';

export interface ResourceUploadInput { labelAr: string; labelEn: string; fileName: string; mimeType: string; content: Uint8Array }
export interface MaterialsDeps { prisma: PrismaClient; storage: StorageClient; now: () => number }
export type MaterialsReadDeps = Pick<MaterialsDeps, 'prisma' | 'now'>;
export interface UploadedResource { id: string; labelAr: string; labelEn: string; fileName: string; mimeType: string; byteSize: number }

function label(value: unknown): string {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > 200) throw new LearningError('MATERIAL_INVALID');
  return value.trim();
}
async function mutableLesson(tx: Prisma.TransactionClient, lessonId: string) {
  const before = await tx.lesson.findUnique({ where: { id: lessonId }, include: { section: true } });
  if (!before) throw new LearningError('LESSON_NOT_FOUND');
  const owner = await tx.course.findUniqueOrThrow({ where: { id: before.section.courseId } });
  if (owner.revisionOwnerId) {
    await lockCourseRow(tx, owner.revisionOwnerId);
    const live = await tx.course.findUniqueOrThrow({ where: { id: owner.revisionOwnerId } });
    if (live.deletionRequestedAt) throw new LearningError('LESSON_NOT_FOUND');
  }
  await lockCourseRow(tx, before.section.courseId);
  const lesson = await tx.lesson.findUnique({ where: { id: lessonId }, include: { section: { include: { course: true } } } });
  if (!lesson) throw new LearningError('LESSON_NOT_FOUND');
  ensureMutable(lesson.section.course, 'Materials change');
  return lesson;
}
async function reserve(deps: MaterialsDeps, lessonId: string, keys: string[]) {
  await deps.prisma.$transaction(async tx => {
    await mutableLesson(tx, lessonId);
    await tx.materialObject.createMany({ data: keys.map(storageKey => ({ storageKey })) });
  });
}
async function abandon(deps: MaterialsDeps, keys: string[]) {
  // If the database itself is unavailable, committed PENDING intents remain
  // discoverable after the one-hour crash grace period. Never lose object keys.
  await deps.prisma.materialObject.updateMany({ where: { storageKey: { in: keys }, state: 'PENDING' }, data: { state: 'DELETE' } }).catch(() => undefined);
}
export async function reconcileMaterialObjects(deps: MaterialsDeps, limit = 25): Promise<number> {
  const cutoff = new Date(deps.now() - 60 * 60 * 1000);
  const rows = await deps.prisma.materialObject.findMany({ where: { OR: [{ state: 'DELETE' }, { state: 'PENDING', updatedAt: { lt: cutoff } }] }, orderBy: [{ updatedAt: 'asc' }, { storageKey: 'asc' }], take: limit });
  let deleted = 0;
  for (const row of rows) {
    try {
      await deps.prisma.$transaction(async tx => {
        const locked = await tx.$queryRaw<Array<{ storageKey: string }>>`SELECT "storageKey" FROM "MaterialObject" WHERE "storageKey" = ${row.storageKey} FOR UPDATE SKIP LOCKED`;
        if (!locked.length) return;
        const current = await tx.materialObject.findUnique({ where: { storageKey: row.storageKey } });
        if (!current || current.state === 'LIVE' || (current.state === 'PENDING' && current.updatedAt >= cutoff)) return;
        await deps.storage.deleteObject(row.storageKey);
        await tx.materialObject.delete({ where: { storageKey: row.storageKey } });
        deleted++;
      }, { timeout: 125_000 });
    } catch {
      // Fair retry: failed keys move behind other eligible work. They remain durable.
      await deps.prisma.materialObject.updateMany({ where: { storageKey: row.storageKey, state: { not: 'LIVE' } }, data: { state: 'DELETE', updatedAt: new Date(deps.now()) } }).catch(() => undefined);
    }
  }
  return deleted;
}
export async function uploadResource(deps: MaterialsDeps, lessonId: string, input: ResourceUploadInput, actorId: string): Promise<UploadedResource> {
  const labelAr = label(input.labelAr), labelEn = label(input.labelEn);
  if (typeof input.fileName !== 'string' || !input.fileName.trim() || input.fileName.length > 255 || /[/\\]|[\x00-\x1f\x7f]/.test(input.fileName) || ['.', '..'].includes(input.fileName)) throw new LearningError('MATERIAL_INVALID');
  if (!(input.content instanceof Uint8Array)) throw new LearningError('MATERIAL_INVALID');
  if (input.content.length > 10_485_760) throw new LearningError('MATERIAL_TOO_LARGE');
  if (!validateResourceBytes(input.fileName, input.mimeType, input.content)) throw new LearningError('MATERIAL_INVALID');
  const id = randomUUID(), storageKey = `resources/${lessonId}/${id}`;
  const dto = { id, labelAr, labelEn, fileName: sanitizeFilename(input.fileName), mimeType: input.mimeType, byteSize: input.content.length };
  await reserve(deps, lessonId, [storageKey]);
  try {
    try { await deps.storage.putObject(storageKey, input.content, input.mimeType); } catch { throw new LearningError('MATERIAL_STORAGE_UNAVAILABLE'); }
    await deps.prisma.$transaction(async tx => {
      await mutableLesson(tx, lessonId);
      await tx.lessonResource.create({ data: { ...dto, lessonId, storageKey } });
      const live = await tx.materialObject.updateMany({ where: { storageKey, state: 'PENDING' }, data: { state: 'LIVE' } });
      if (!live.count) throw new LearningError('MATERIAL_STORAGE_UNAVAILABLE');
      await tx.auditEvent.create({ data: { actorUserId: actorId, action: 'RESOURCE_UPLOADED', entityType: 'Lesson', entityId: lessonId, metadata: { resourceId: id } } });
    });
  } catch (err) { await abandon(deps, [storageKey]); throw err; }
  return dto;
}
export async function deleteResource(deps: MaterialsDeps, resourceId: string, actorId: string): Promise<void> {
  const before = await deps.prisma.lessonResource.findUnique({ where: { id: resourceId } });
  if (!before) return;
  await deps.prisma.$transaction(async tx => {
    await mutableLesson(tx, before.lessonId);
    const result = await tx.lessonResource.deleteMany({ where: { id: resourceId } });
    if (result.count) await tx.auditEvent.create({ data: { actorUserId: actorId, action: 'RESOURCE_DELETED', entityType: 'LessonResource', entityId: resourceId, metadata: { lessonId: before.lessonId } } });
  });
}
export async function getStudentMaterials(
  deps: MaterialsReadDeps,
  studentId: string,
  courseRef: string,
  lessonId: string,
): Promise<{ lessonId: string; durationSeconds: number | null; resources: ResourceMetadata[] }> {
  const lesson = await deps.prisma.lesson.findUnique({
    where: { id: lessonId },
    include: { media: true, section: { select: { courseId: true } } },
  });
  if (!lesson) throw new LearningError('LESSON_NOT_FOUND');

  // Resolve course and check entitlement
  const course = await deps.prisma.course.findUnique({
    where: { id: lesson.section.courseId },
  });
  if (!course || course.deletionRequestedAt !== null || course.status !== 'PUBLISHED') {
    throw new LearningError('LESSON_NOT_FOUND');
  }

  const subscriptions = await deps.prisma.subscription.findMany({
    where: { studentId },
    select: { courseId: true, startsAt: true, expiresAt: true },
  });
  const decision = evaluateEntitlement(subscriptions, course.id, deps.now());
  if (!decision.allowed) {
    throw new LearningError(decision.reason);
  }

  await assertLessonUnlocked(deps.prisma, studentId, course.id, lessonId);

  const resources = await deps.prisma.lessonResource.findMany({
    where: { lessonId },
    select: { id: true, labelAr: true, labelEn: true, fileName: true, mimeType: true, byteSize: true },
  });

  return {
    lessonId,
    durationSeconds: lesson.media?.durationSeconds ?? null,
    resources: resources.map((r) => ({
      id: r.id,
      labelAr: r.labelAr,
      labelEn: r.labelEn,
      fileName: r.fileName,
      mimeType: r.mimeType,
      byteSize: r.byteSize,
    })),
  };
}

export async function getAdminMaterials(
  deps: MaterialsReadDeps,
  lessonId: string,
): Promise<{ lessonId: string; durationSeconds: number | null; resources: (ResourceMetadata & { inherited?: boolean })[] }> {
  const lesson = await deps.prisma.lesson.findUnique({
    where: { id: lessonId },
    include: { media: true },
  });
  if (!lesson) throw new LearningError('LESSON_NOT_FOUND');

  const resources = await deps.prisma.lessonResource.findMany({
    where: { lessonId },
    select: { id: true, labelAr: true, labelEn: true, fileName: true, mimeType: true, byteSize: true },
  });

  const inheritedResources = lesson.originId ? await deps.prisma.lessonResource.findMany({ where: { lessonId: lesson.originId }, select: { id: true, labelAr: true, labelEn: true, fileName: true, mimeType: true, byteSize: true } }) : [];
  const inheritedMedia = lesson.inheritedMediaId ? await deps.prisma.mediaMapping.findUnique({ where: { id: lesson.inheritedMediaId }, select: { durationSeconds: true } }) : null;
  return {
    lessonId,
    durationSeconds: lesson.media?.durationSeconds ?? inheritedMedia?.durationSeconds ?? null,
    resources: [...inheritedResources.map(r => ({ ...r, inherited: true })), ...resources.map((r) => ({
      id: r.id,
      labelAr: r.labelAr,
      labelEn: r.labelEn,
      fileName: r.fileName,
      mimeType: r.mimeType,
      byteSize: r.byteSize,
    }))],
  };
}

export async function getResourceContent(
  deps: MaterialsDeps,
  studentId: string,
  courseRef: string,
  resourceId: string,
): Promise<{ content: Uint8Array; fileName: string; mimeType: string }> {
  const resource = await deps.prisma.lessonResource.findUnique({
    where: { id: resourceId },
    include: { lesson: { include: { media: true, section: { select: { courseId: true } } } } },
  });
  if (!resource) throw new LearningError('MATERIAL_NOT_FOUND');

  const lesson = resource.lesson;

  // Resolve course and check entitlement
  const course = await deps.prisma.course.findUnique({
    where: { id: lesson.section.courseId },
  });
  if (!course || course.deletionRequestedAt !== null || course.status !== 'PUBLISHED') {
    throw new LearningError('LESSON_NOT_FOUND');
  }

  const subscriptions = await deps.prisma.subscription.findMany({
    where: { studentId },
    select: { courseId: true, startsAt: true, expiresAt: true },
  });
  const decision = evaluateEntitlement(subscriptions, course.id, deps.now());
  if (!decision.allowed) {
    throw new LearningError(decision.reason);
  }

  await assertLessonUnlocked(deps.prisma, studentId, course.id, lesson.id);

  let result;
  try { result = await deps.storage.getObject(resource.storageKey); } catch { throw new LearningError('MATERIAL_STORAGE_UNAVAILABLE'); }
  return { content: result.body, fileName: resource.fileName, mimeType: resource.mimeType };
}

export interface ResourceMetadata {
  id: string;
  labelAr: string;
  labelEn: string;
  fileName: string;
  mimeType: string;
  byteSize: number;
}
