import type { MediaState, PrismaClient } from '@prisma/client';
import { ApiError } from '../../identity/errors.js';
import { audit } from '../audit.js';
import { courseIdForLesson, withCourseLock } from '../courseTx.js';
import { ensureStructuralAllowed } from '../courses/service.js';
import { mapDrmStatusToLocal, assertUuid } from '../validation.js';
import type { DrmClient } from '../drmClient.js';
import type { ServerConfig } from '../../../config.js';

/**
 * Completion never runs network I/O inside a transaction. Two short
 * transactions bracket the external call: the first locks the course and
 * validates fresh lifecycle/deletion state before calling DRM; the second
 * re-locks, re-reads, revalidates, then records the outcome atomically.
 * Timeout/uncertainty is resolved by querying DRM status before deciding
 * whether completion must be retried; ALREADY_COMPLETED converges.
 */
export async function completeLessonUpload(
  prisma: PrismaClient,
  config: ServerConfig,
  drmFactory: (cfg: ServerConfig) => DrmClient | null,
  actorId: string,
  lessonId: string,
) {
  assertUuid(lessonId, 'lessonId');
  const drm = drmFactory(config);
  if (drm === null) throw new ApiError(503, 'DRM_UNCONFIGURED', 'External media service is not configured.');

  const courseId = await courseIdForLesson(prisma, lessonId);
  const precheck = await withCourseLock(prisma, courseId, async (tx) => {
    const lesson = await tx.lesson.findUnique({ where: { id: lessonId }, include: { media: true, section: { include: { course: true } } } });
    if (lesson === null || lesson.media === null) throw new ApiError(404, 'MEDIA_MISSING', 'Media mapping not found.');
    ensureStructuralAllowed(lesson.section.course);
    if (lesson.media.assetId === null) throw new ApiError(409, 'MEDIA_MISSING', 'Media not registered with DRM.');
    return { assetId: lesson.media.assetId, mappingId: lesson.media.id };
  });
  const { assetId, mappingId } = precheck;

  let remoteStatus: string;
  try {
    const result = await drm.completeUpload(assetId);
    remoteStatus = result.status;
  } catch (err) {
    if (err instanceof ApiError && (err.code === 'DRM_TIMEOUT' || err.code === 'DRM_NETWORK' || err.code === 'DRM_UNKNOWN')) {
      return reconcileAfterUncertainCompletion(prisma, drm, actorId, lessonId, mappingId, assetId);
    }
    if (err instanceof ApiError && err.code === 'DRM_CONFLICT') {
      return reconcileAfterUncertainCompletion(prisma, drm, actorId, lessonId, mappingId, assetId);
    }
    throw err;
  }

  const nextLocal = mapDrmStatusToLocal(remoteStatus) as MediaState;
  return withCourseLock(prisma, courseId, async (tx) => {
    const lesson = await tx.lesson.findUnique({ where: { id: lessonId }, include: { media: true, section: { include: { course: true } } } });
    if (lesson === null || lesson.media === null || lesson.media.id !== mappingId) {
      throw new ApiError(404, 'MEDIA_MISSING', 'Media mapping not found.');
    }
    ensureStructuralAllowed(lesson.section.course);
    const updated = await tx.mediaMapping.update({
      where: { id: mappingId },
      data: { status: nextLocal, uploadCompletedAt: new Date(), lastSyncedAt: new Date(), errorCategory: null },
    });
    await audit(tx, { actorUserId: actorId, action: 'MEDIA_COMPLETED', entityType: 'Lesson', entityId: lessonId, metadata: { status: nextLocal } });
    return updated;
  });
}

async function reconcileAfterUncertainCompletion(
  prisma: PrismaClient,
  drm: DrmClient,
  actorId: string,
  lessonId: string,
  mappingId: string,
  assetId: string,
) {
  const remote = await drm.mediaStatus(assetId);
  const nextLocal = mapDrmStatusToLocal(remote.status) as MediaState;
  const courseId = await courseIdForLesson(prisma, lessonId);
  return withCourseLock(prisma, courseId, async (tx) => {
    const lesson = await tx.lesson.findUnique({ where: { id: lessonId }, include: { media: true, section: { include: { course: true } } } });
    if (lesson === null || lesson.media === null || lesson.media.id !== mappingId) {
      throw new ApiError(404, 'MEDIA_MISSING', 'Media mapping not found.');
    }
    ensureStructuralAllowed(lesson.section.course);
    const updated = await tx.mediaMapping.update({
      where: { id: mappingId },
      data: {
        status: nextLocal,
        lastSyncedAt: new Date(),
        ...(nextLocal === 'PROCESSING' || nextLocal === 'READY' ? { uploadCompletedAt: new Date(), errorCategory: null } : {}),
      },
    });
    await audit(tx, { actorUserId: actorId, action: 'MEDIA_RECONCILED', entityType: 'Lesson', entityId: lessonId, metadata: { status: nextLocal } });
    return updated;
  });
}
