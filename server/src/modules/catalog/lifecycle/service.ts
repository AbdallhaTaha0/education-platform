import type { PrismaClient } from '@prisma/client';
import { ApiError } from '../../identity/errors.js';
import { audit } from '../audit.js';
import { recordFirstPublication } from '../../notifications/producers.js';
import { withCourseLock } from '../courseTx.js';
import type { CourseHierarchy } from '../types.js';
import { assertUuid } from '../validation.js';
import { createWorkingCopy, effectiveHierarchy, publishWorkingCopy } from '../courses/revisions.js';
import {
  assertTransitionInput,
  collectNotReady,
  validateDraftForProcessing,
  validateReadyForPublish,
} from './policy.js';

async function loadHierarchy(
  prisma: PrismaClient | import('@prisma/client').Prisma.TransactionClient,
  courseId: string,
): Promise<CourseHierarchy> {
  const client = prisma as PrismaClient;
  const course = await effectiveHierarchy(client, courseId);
  if (course === null) throw new ApiError(404, 'NOT_FOUND', 'Course not found.');
  return course as unknown as CourseHierarchy;
}

export async function requestTransition(
  prisma: PrismaClient,
  actorId: string,
  courseId: string,
  to: string,
) {
  assertUuid(courseId, 'courseId');
  return withCourseLock(prisma, courseId, async (tx) => {
    const course = await tx.course.findUnique({ where: { id: courseId } });
    if (course === null) throw new ApiError(404, 'NOT_FOUND', 'Course not found.');
    if (course.historical) throw new ApiError(409, 'INVALID_TRANSITION', 'Historical content cannot be edited.');
    if (course.deletionRequestedAt !== null)
      throw new ApiError(409, 'DELETION_PENDING', 'Transition blocked while deletion is pending.');
    if (course.status === 'ARCHIVED')
      throw new ApiError(409, 'COURSE_ARCHIVED', 'Archived courses use unarchive.');
    const target = assertTransitionInput(course.status, String(to));
    if (target === 'DRAFT') {
      return createWorkingCopy(tx, actorId, course);
    }
    const hierarchy = await loadHierarchy(tx, courseId);
    if (course.status === 'DRAFT' && target === 'PROCESSING') {
      validateDraftForProcessing(hierarchy);
      const updated = await tx.course.update({
        where: { id: courseId },
        data: { status: 'PROCESSING' },
      });
      await audit(tx, {
        actorUserId: actorId,
        action: 'COURSE_TRANSITION',
        entityType: 'Course',
        entityId: courseId,
        metadata: { from: 'DRAFT', to: 'PROCESSING' },
      });
      return updated;
    }
    if (course.status === 'PROCESSING' && target === 'READY') {
      const notReady = collectNotReady(hierarchy);
      if (notReady.length > 0) {
        throw new ApiError(409, 'READINESS_BLOCKED', 'Not all media are READY.', {
          lessons: notReady.slice(0, 20),
        });
      }
      const updated = await tx.course.update({
        where: { id: courseId },
        data: { status: 'READY' },
      });
      await audit(tx, {
        actorUserId: actorId,
        action: 'COURSE_TRANSITION',
        entityType: 'Course',
        entityId: courseId,
        metadata: { from: 'PROCESSING', to: 'READY' },
      });
      return updated;
    }
    validateReadyForPublish(hierarchy);
    if (course.revisionOwnerId) {
      try { return await publishWorkingCopy(tx, actorId, course); }
      catch (error) {
        if ((error as { code?: string }).code === 'P2002') throw new ApiError(409, 'SLUG_TAKEN', 'The draft slug was claimed by another course. Choose another slug.');
        throw error;
      }
    }
    const updated = await tx.course.update({
      where: { id: courseId },
      data: { status: 'PUBLISHED', publishedAt: new Date() },
    });
    await audit(tx, {
      actorUserId: actorId,
      action: 'COURSE_PUBLISHED',
      entityType: 'Course',
      entityId: courseId,
      metadata: { from: 'READY', to: 'PUBLISHED' },
    });
    await recordFirstPublication(tx, courseId, updated.publishedAt!);
    return updated;
  });
}

export async function archiveCourse(prisma: PrismaClient, actorId: string, courseId: string) {
  assertUuid(courseId, 'courseId');
  return withCourseLock(prisma, courseId, async (tx) => {
    const course = await tx.course.findUnique({ where: { id: courseId } });
    if (course === null) throw new ApiError(404, 'NOT_FOUND', 'Course not found.');
    if (course.deletionRequestedAt !== null)
      throw new ApiError(409, 'DELETION_PENDING', 'Archive blocked while deletion is pending.');
    if (course.status === 'ARCHIVED')
      throw new ApiError(409, 'INVALID_TRANSITION', 'Already archived.');
    const updated = await tx.course.update({
      where: { id: courseId },
      data: { status: 'ARCHIVED', priorStatus: course.status, archivedAt: new Date() },
    });
    await audit(tx, {
      actorUserId: actorId,
      action: 'COURSE_ARCHIVED',
      entityType: 'Course',
      entityId: courseId,
      metadata: { priorStatus: course.status },
    });
    return updated;
  });
}

export async function unarchiveCourse(prisma: PrismaClient, actorId: string, courseId: string) {
  assertUuid(courseId, 'courseId');
  return withCourseLock(prisma, courseId, async (tx) => {
    const course = await tx.course.findUnique({ where: { id: courseId } });
    if (course === null) throw new ApiError(404, 'NOT_FOUND', 'Course not found.');
    if (course.status !== 'ARCHIVED')
      throw new ApiError(409, 'INVALID_TRANSITION', 'Only archived courses can be unarchived.');
    if (course.deletionRequestedAt !== null)
      throw new ApiError(409, 'DELETION_PENDING', 'Unarchive blocked while deletion is pending.');
    const restoreTo = course.priorStatus ?? 'DRAFT';
    const hierarchy = await loadHierarchy(tx, courseId);
    if (restoreTo === 'PROCESSING') validateDraftForProcessing(hierarchy);
    else if (restoreTo === 'READY') {
      validateDraftForProcessing(hierarchy);
      const notReady = collectNotReady(hierarchy);
      if (notReady.length > 0)
        throw new ApiError(409, 'READINESS_BLOCKED', 'Not all media are READY.');
    } else if (restoreTo === 'PUBLISHED') validateReadyForPublish(hierarchy);
    const updated = await tx.course.update({
      where: { id: courseId },
      data: {
        status: restoreTo,
        priorStatus: null,
        archivedAt: null,
        ...(restoreTo === 'PUBLISHED' ? { publishedAt: new Date() } : {}),
      },
    });
    await audit(tx, {
      actorUserId: actorId,
      action: 'COURSE_UNARCHIVED',
      entityType: 'Course',
      entityId: courseId,
      metadata: { restoredTo: restoreTo },
    });
    return updated;
  });
}
