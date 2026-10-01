import type { MediaState, PrismaClient } from '@prisma/client';
import { ApiError } from '../../identity/errors.js';
import { audit } from '../audit.js';
import { mapDrmStatusToLocal, assertUuid } from '../validation.js';
import type { DrmClient } from '../drmClient.js';
import type { ServerConfig } from '../../../config.js';

function requireDrm(
  config: ServerConfig,
  drmFactory: (cfg: ServerConfig) => DrmClient | null,
): DrmClient {
  const drm = drmFactory(config);
  if (drm === null)
    throw new ApiError(503, 'DRM_UNCONFIGURED', 'External media service is not configured.');
  return drm;
}

export async function syncLessonMedia(
  prisma: PrismaClient,
  config: ServerConfig,
  drmFactory: (cfg: ServerConfig) => DrmClient | null,
  actorId: string,
  lessonId: string,
) {
  assertUuid(lessonId, 'lessonId');
  const drm = requireDrm(config, drmFactory);
  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    include: { media: true },
  });
  if (lesson === null || lesson.media === null)
    throw new ApiError(404, 'MEDIA_MISSING', 'Media mapping not found.');
  if (lesson.media.assetId === null)
    throw new ApiError(409, 'MEDIA_MISSING', 'Media not registered with DRM.');
  const remote = await drm.mediaStatus(lesson.media.assetId);
  const nextLocal = mapDrmStatusToLocal(remote.status) as MediaState;
  const prev = lesson.media.status;
  const updated = await prisma.mediaMapping.update({
    where: { id: lesson.media.id },
    data: {
      status: nextLocal,
      lastSyncedAt: new Date(),
      ...(nextLocal === 'FAILED' ? { errorCategory: 'DRM_SERVER' } : { errorCategory: null }),
    },
  });
  if (prev !== nextLocal) {
    await audit(prisma, {
      actorUserId: actorId,
      action: 'MEDIA_SYNCED',
      entityType: 'Lesson',
      entityId: lessonId,
      metadata: { from: prev, to: nextLocal },
    });
  }
  return updated;
}

export async function syncCourseMedia(
  prisma: PrismaClient,
  config: ServerConfig,
  drmFactory: (cfg: ServerConfig) => DrmClient | null,
  actorId: string,
  courseId: string,
) {
  assertUuid(courseId, 'courseId');
  const drm = requireDrm(config, drmFactory);
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    include: { sections: { include: { lessons: { include: { media: true } } } } },
  });
  if (course === null) throw new ApiError(404, 'NOT_FOUND', 'Course not found.');
  const details: { lessonId: string; from: string; to: string }[] = [];
  for (const s of course.sections) {
    for (const l of s.lessons) {
      if (l.media?.assetId == null) continue;
      try {
        const remote = await drm.mediaStatus(l.media.assetId);
        const nextLocal = mapDrmStatusToLocal(remote.status) as MediaState;
        if (nextLocal !== l.media.status) {
          await prisma.mediaMapping.update({
            where: { id: l.media.id },
            data: { status: nextLocal, lastSyncedAt: new Date() },
          });
          await audit(prisma, {
            actorUserId: actorId,
            action: 'MEDIA_SYNCED',
            entityType: 'Lesson',
            entityId: l.id,
            metadata: { from: l.media.status, to: nextLocal },
          });
          details.push({ lessonId: l.id, from: l.media.status, to: nextLocal });
        }
      } catch {
        await prisma.mediaMapping.update({
          where: { id: l.media.id },
          data: { lastSyncedAt: new Date() },
        });
      }
    }
  }
  return { synced: details.length, details };
}
