import type { MediaState, PrismaClient } from '@prisma/client';
import { ApiError } from '../../identity/errors.js';
import { audit } from '../audit.js';
import { assertUuid } from '../validation.js';
import type { DrmClient } from '../drmClient.js';
import type { ServerConfig } from '../../../config.js';
import { createStorageClient } from '../../../infra/storage.js';

export async function syncLessonMedia(
  prisma: PrismaClient,
  config: ServerConfig,
  drmFactory: (cfg: ServerConfig) => DrmClient | null,
  actorId: string,
  lessonId: string,
) {
  assertUuid(lessonId, 'lessonId');
  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    include: { media: true },
  });
  if (lesson?.inheritedMediaId && !lesson.media) {
    const inherited = await prisma.mediaMapping.findUnique({
      where: { id: lesson.inheritedMediaId },
    });
    if (inherited && !inherited.retiredAt) return inherited;
  }
  void drmFactory;
  const storage = createStorageClient(config);
  if (!storage) throw new ApiError(503, 'STORAGE_UNCONFIGURED', 'Video storage is not configured.');
  if (lesson === null || lesson.media === null)
    throw new ApiError(404, 'MEDIA_MISSING', 'Media mapping not found.');
  if (lesson.media.assetId === null)
    throw new ApiError(409, 'MEDIA_MISSING', 'Video upload is not registered.');
  const object = await storage.headObject(`lesson-videos/${lesson.media.assetId}`);
  const nextLocal: MediaState = object
    ? 'READY'
    : lesson.media.status === 'UPLOAD_PENDING'
      ? 'UPLOAD_PENDING'
      : 'FAILED';
  const prev = lesson.media.status;
  const updated = await prisma.mediaMapping.update({
    where: { id: lesson.media.id },
    data: {
      status: nextLocal,
      lastSyncedAt: new Date(),
      durationSeconds: null,
      ...(nextLocal === 'FAILED'
        ? { errorCategory: 'STORAGE_NOT_FOUND' }
        : { errorCategory: null }),
    },
  });
  if (prev !== nextLocal || updated.durationSeconds !== lesson.media.durationSeconds) {
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
  void drmFactory;
  const storage = createStorageClient(config);
  if (!storage) throw new ApiError(503, 'STORAGE_UNCONFIGURED', 'Video storage is not configured.');
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    include: { sections: { include: { lessons: { include: { media: true } } } } },
  });
  if (course === null) throw new ApiError(404, 'NOT_FOUND', 'Course not found.');
  const details: { lessonId: string; from: string; to: string; durationSeconds?: number | null }[] =
    [];
  for (const s of course.sections) {
    for (const l of s.lessons) {
      if (l.media?.assetId == null) continue;
      try {
        const object = await storage.headObject(`lesson-videos/${l.media.assetId}`);
        const nextLocal: MediaState = object
          ? 'READY'
          : l.media.status === 'UPLOAD_PENDING'
            ? 'UPLOAD_PENDING'
            : 'FAILED';
        if (nextLocal !== l.media.status || l.media.durationSeconds !== null) {
          await prisma.mediaMapping.update({
            where: { id: l.media.id },
            data: {
              status: nextLocal,
              lastSyncedAt: new Date(),
              durationSeconds: null,
              errorCategory: nextLocal === 'FAILED' ? 'STORAGE_NOT_FOUND' : null,
            },
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
