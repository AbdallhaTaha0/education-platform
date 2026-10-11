import { randomUUID } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import type Redis from 'ioredis';
import { ApiError } from '../../identity/errors.js';
import { courseIdForLesson, withCourseLock } from '../courseTx.js';
import { ensureStructuralAllowed } from '../courses/service.js';
import { audit } from '../audit.js';
import type { StorageClient } from '../../../infra/storage.js';
import { withRenewingLease } from '../deletion/lease.js';

export async function removeDraftVideo(db: PrismaClient, actor: string, lessonId: string) {
  const courseId = await courseIdForLesson(db, lessonId);
  return withCourseLock(db, courseId, async tx => {
    const course = await tx.course.findUniqueOrThrow({ where: { id: courseId } });
    ensureStructuralAllowed(course);
    const lesson = await tx.lesson.findUniqueOrThrow({ where: { id: lessonId }, include: { media: true } });
    if (lesson.media && !lesson.media.assetId) throw new ApiError(409, 'MEDIA_REGISTRATION_UNRESOLVED', 'Retry registration before removing the video.');
    if (lesson.media) {
      const history = await tx.course.create({ data: { revisionOwnerId: course.revisionOwnerId ?? courseId, historical: true, status: 'ARCHIVED', slug: `history-${randomUUID()}`, titleAr: course.titleAr, titleEn: course.titleEn, descriptionAr: course.descriptionAr, descriptionEn: course.descriptionEn } });
      const section = await tx.courseSection.create({ data: { courseId: history.id, titleAr: 'فيديو سابق', titleEn: 'Previous video', position: 1 } });
      const holder = await tx.lesson.create({ data: { sectionId: section.id, titleAr: lesson.titleAr, titleEn: lesson.titleEn, position: 1 } });
      await tx.mediaMapping.update({ where: { id: lesson.media.id }, data: { lessonId: holder.id, retiredAt: new Date(), retirementNextAttempt: new Date() } });
    }
    await tx.lesson.update({ where: { id: lessonId }, data: { inheritedMediaId: null } });
    await audit(tx, { actorUserId: actor, action: 'DRAFT_VIDEO_REMOVED', entityType: 'Lesson', entityId: lessonId });
    return { removed: true };
  });
}

/** Durable, bounded, replica-leased cleanup. Never deletes an inherited or session-used asset. */
export async function reconcileRetiredMedia(db: PrismaClient, storage: StorageClient | null, redis: Redis, now = new Date()) {
  if (!storage) return;
  const rows = await db.mediaMapping.findMany({ where: { retiredAt: { not: null }, retirementNextAttempt: { lte: now } }, orderBy: { retirementNextAttempt: 'asc' }, take: 10 });
  for (const candidate of rows) await withRenewingLease(redis, `retired-${candidate.id}`, 30000, async scope => {
    const m = await db.mediaMapping.findUnique({ where: { id: candidate.id }, include: { lesson: { include: { section: { include: { course: true } } } } } });
    if (!m || !m.retiredAt || !m.assetId || scope.lost) return;
    if (!m.lesson.section.course.historical) return;
    if (m.lesson.section.course.deletionRequestedAt) return;
    const inherited = await db.lesson.count({ where: { inheritedMediaId: m.id } });
    const sessions = await db.playbackReference.findMany({ where: { externalAssetId: m.externalAssetId, OR: [{ status: { in: ['ACTIVE', 'TERMINATION_FAILED'] } }, { terminationStatus: { in: ['PENDING', 'FAILED'] } }, { terminationStatus: null }] } });
    // A recorded absolute session expiry is required. Unknown expiry fails closed.
    if (inherited || sessions.some(s => s.status !== 'ENDED' && (!s.sessionExpiresAt || s.sessionExpiresAt > now))) {
      await db.mediaMapping.update({ where: { id: m.id }, data: { retirementNextAttempt: new Date(now.getTime() + 30000) } });
      return;
    }
    try {
      for (const s of sessions) {
        if (scope.lost) return;
        await db.playbackReference.updateMany({ where: { id: s.id }, data: { status: s.status === 'ENDED' ? 'ENDED' : 'TERMINATED', endedAt: now, terminationStatus: 'COMPLETED', nextTerminationAt: null, pendingEndReason: null } });
      }
      if (scope.lost) return;
      await storage.deleteObject(`lesson-videos/${m.assetId}`);
      if (!scope.lost) await db.mediaMapping.deleteMany({ where: { id: m.id, retiredAt: { not: null } } });
    } catch (error) {
      await db.mediaMapping.updateMany({ where: { id: m.id }, data: { retirementNextAttempt: new Date(now.getTime() + 60000), errorCategory: 'RETIREMENT_RETRY' } });
    }
  });
}
