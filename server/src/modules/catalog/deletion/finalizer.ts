import { Prisma } from '@prisma/client';
import type { PrismaClient } from '@prisma/client';
import { audit } from '../audit.js';
import { advisoryLock, deletionAdvisoryKey, lockCourseRow } from '../locks.js';
import type { TxClient } from '../types.js';

/** Clear the owning course marker when no active op remains (course survives).
 * The completing operation itself is excluded: it is still PENDING/RUNNING
 * until this transaction marks it COMPLETED below. */
async function clearCourseMarkerIfIdle(tx: TxClient, courseId: string, completingOperationId: string): Promise<void> {
  const remaining = await tx.$queryRaw<{ id: string }[]>(
    Prisma.sql`SELECT id FROM "CatalogDeletionOperation" WHERE "courseId" = ${courseId} AND status IN ('PENDING','RUNNING') AND id != ${completingOperationId} LIMIT 1`,
  );
  if (remaining.length === 0) {
    await tx.course.updateMany({ where: { id: courseId, deletionRequestedAt: { not: null } }, data: { deletionRequestedAt: null } });
  }
}

async function recompactSections(tx: TxClient, courseId: string, removedPosition: number): Promise<void> {
  await tx.$executeRaw(Prisma.sql`UPDATE "CourseSection" SET position = position - 1 WHERE "courseId" = ${courseId} AND position > ${removedPosition}`);
}

async function recompactLessons(tx: TxClient, sectionId: string, removedPosition: number): Promise<void> {
  await tx.$executeRaw(Prisma.sql`UPDATE "Lesson" SET position = position - 1 WHERE "sectionId" = ${sectionId} AND position > ${removedPosition}`);
}

/** No-media targets complete synchronously; surviving courses regain visibility. */
export async function finalizeNoMediaTarget(prisma: PrismaClient, actorId: string, operationId: string): Promise<void> {
  const op = await prisma.catalogDeletionOperation.findUnique({ where: { id: operationId } });
  if (op === null || op.status === 'COMPLETED') return;
  const targetType = op.targetType as string;
  const targetId = op.targetId;
  const courseId = (op as { courseId?: string | null }).courseId ?? null;
  await prisma.$transaction(async (tx) => {
    await advisoryLock(tx, deletionAdvisoryKey(targetType, targetId));
    if (courseId !== null) await lockCourseRow(tx, courseId);
    if (targetType === 'COURSE') {
      await tx.course.deleteMany({ where: { id: targetId } });
    } else if (targetType === 'SECTION') {
      const section = await tx.courseSection.findUnique({ where: { id: targetId } });
      if (section !== null) {
        await tx.lesson.deleteMany({ where: { sectionId: section.id } });
        await tx.courseSection.delete({ where: { id: section.id } });
        await recompactSections(tx, section.courseId, section.position);
        await clearCourseMarkerIfIdle(tx, section.courseId, operationId);
      }
    } else {
      const lesson = await tx.lesson.findUnique({ where: { id: targetId } });
      if (lesson !== null) {
        await tx.lesson.delete({ where: { id: lesson.id } });
        await recompactLessons(tx, lesson.sectionId, lesson.position);
        const parent = await tx.courseSection.findUnique({ where: { id: lesson.sectionId }, select: { courseId: true } });
        if (parent !== null) await clearCourseMarkerIfIdle(tx, parent.courseId, operationId);
      }
    }
    if (courseId !== null && targetType !== 'COURSE') {
      await clearCourseMarkerIfIdle(tx, courseId, operationId);
    }
    await tx.catalogDeletionOperation.update({ where: { id: operationId }, data: { status: 'COMPLETED', completedAt: new Date(), errorCategory: null } });
    await audit(tx, { actorUserId: actorId, action: 'DELETION_COMPLETED', entityType: targetType, entityId: targetId, metadata: { operationId } });
  });
}

/** Media-backed completion: delete platform rows only after all DRM COMPLETED. */
export async function finalizeMediaBackedTarget(prisma: PrismaClient, operationId: string): Promise<boolean> {
  const op = await prisma.catalogDeletionOperation.findUnique({ where: { id: operationId }, include: { assets: true } });
  if (op === null || op.status === 'COMPLETED') return op?.status === 'COMPLETED';
  if (op.assets.some((a) => a.lastState !== 'COMPLETED')) return false;
  const targetType = op.targetType as string;
  const targetId = op.targetId;
  const courseId = (op as { courseId?: string | null }).courseId ?? (targetType === 'COURSE' ? targetId : null);
  await prisma.$transaction(async (tx) => {
    await advisoryLock(tx, deletionAdvisoryKey(targetType, targetId));
    if (courseId !== null) await lockCourseRow(tx, courseId);
    const fresh = await tx.catalogDeletionOperation.findUnique({ where: { id: operationId }, include: { assets: true } });
    if (fresh === null || fresh.status === 'COMPLETED') return;
    if (fresh.assets.some((a) => a.lastState !== 'COMPLETED')) return;
    if (targetType === 'COURSE') {
      const sections = await tx.courseSection.findMany({ where: { courseId: targetId }, select: { id: true } });
      for (const s of sections) {
        const lessons = await tx.lesson.findMany({ where: { sectionId: s.id }, select: { id: true } });
        for (const l of lessons) await tx.mediaMapping.deleteMany({ where: { lessonId: l.id } });
        await tx.lesson.deleteMany({ where: { sectionId: s.id } });
      }
      await tx.courseSection.deleteMany({ where: { courseId: targetId } });
      await tx.subscriptionPlan.deleteMany({ where: { courseId: targetId } });
      await tx.course.deleteMany({ where: { id: targetId } });
    } else if (targetType === 'SECTION') {
      const section = await tx.courseSection.findUnique({ where: { id: targetId } });
      if (section !== null) {
        const lessons = await tx.lesson.findMany({ where: { sectionId: section.id }, select: { id: true } });
        for (const l of lessons) await tx.mediaMapping.deleteMany({ where: { lessonId: l.id } });
        await tx.lesson.deleteMany({ where: { sectionId: section.id } });
        await tx.courseSection.delete({ where: { id: section.id } });
        await recompactSections(tx, section.courseId, section.position);
        await clearCourseMarkerIfIdle(tx, section.courseId, operationId);
      }
    } else {
      const lesson = await tx.lesson.findUnique({ where: { id: targetId } });
      if (lesson !== null) {
        await tx.mediaMapping.deleteMany({ where: { lessonId: lesson.id } });
        await tx.lesson.delete({ where: { id: lesson.id } });
        await recompactLessons(tx, lesson.sectionId, lesson.position);
        const parent = await tx.courseSection.findUnique({ where: { id: lesson.sectionId }, select: { courseId: true } });
        if (parent !== null) await clearCourseMarkerIfIdle(tx, parent.courseId, operationId);
      }
    }
    await tx.catalogDeletionOperation.update({ where: { id: operationId }, data: { status: 'COMPLETED', completedAt: new Date(), errorCategory: null } });
    await audit(tx, { actorUserId: fresh.requestedBy, action: 'DELETION_COMPLETED', entityType: targetType, entityId: targetId, metadata: { operationId } });
  });
  return true;
}
