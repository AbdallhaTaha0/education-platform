import type { PrismaClient } from '@prisma/client';
import { ApiError } from '../../identity/errors.js';
import { createStorageClient } from '../../../infra/storage.js';
import { audit } from '../audit.js';
import { courseIdForLesson, withCourseLock } from '../courseTx.js';
import { ensureLessonAdditionAllowed } from '../courses/service.js';
import type { ServerConfig } from '../../../config.js';
import { assertUuid } from '../validation.js';

const MAX_VIDEO_BYTES = 2 * 1024 * 1024 * 1024;

export async function completeLessonUpload(
  prisma: PrismaClient,
  config: ServerConfig,
  _drmFactory: unknown,
  actorId: string,
  lessonId: string,
) {
  assertUuid(lessonId, 'lessonId');
  const storage = createStorageClient(config);
  if (!storage) throw new ApiError(503, 'STORAGE_UNCONFIGURED', 'Video storage is not configured.');
  const courseId = await courseIdForLesson(prisma, lessonId);
  const current = await withCourseLock(prisma, courseId, async (tx) => {
    const lesson = await tx.lesson.findUnique({
      where: { id: lessonId },
      include: { media: true, section: { include: { course: true } } },
    });
    if (!lesson || !lesson.media)
      throw new ApiError(404, 'MEDIA_MISSING', 'Video upload not found.');
    ensureLessonAdditionAllowed(lesson.section.course);
    if (!lesson.media.assetId)
      throw new ApiError(409, 'MEDIA_MISSING', 'Video upload is not registered.');
    return lesson.media;
  });

  const objectKey = `lesson-videos/${current.assetId}`;
  const object = await storage.headObject(objectKey);
  if (!object)
    throw new ApiError(409, 'UPLOAD_NOT_FOUND', 'The uploaded video was not found in storage.');
  if (object.contentLength < 1 || object.contentLength > MAX_VIDEO_BYTES) {
    await storage.deleteObject(objectKey).catch(() => undefined);
    throw new ApiError(413, 'UPLOAD_SIZE_INVALID', 'Video must be smaller than 2 GB.');
  }
  if (!['video/mp4', 'video/webm', 'video/quicktime'].includes(object.contentType.toLowerCase())) {
    await storage.deleteObject(objectKey).catch(() => undefined);
    throw new ApiError(
      415,
      'UPLOAD_TYPE_INVALID',
      'Only MP4, WebM, and QuickTime videos are accepted.',
    );
  }

  return withCourseLock(prisma, courseId, async (tx) => {
    const lesson = await tx.lesson.findUnique({
      where: { id: lessonId },
      include: { media: true, section: { include: { course: true } } },
    });
    if (!lesson || !lesson.media || lesson.media.id !== current.id)
      throw new ApiError(404, 'MEDIA_MISSING', 'Video mapping changed during upload.');
    ensureLessonAdditionAllowed(lesson.section.course);
    if (lesson.media.status === 'READY') return lesson.media;
    if (lesson.media.status !== 'UPLOAD_PENDING')
      throw new ApiError(409, 'MEDIA_EXISTS', 'Video is not waiting for upload completion.');
    const updated = await tx.mediaMapping.update({
      where: { id: current.id },
      data: {
        status: 'READY',
        uploadCompletedAt: new Date(),
        lastSyncedAt: new Date(),
        durationSeconds: null,
        errorCategory: null,
      },
    });
    await audit(tx, {
      actorUserId: actorId,
      action: 'MEDIA_COMPLETED',
      entityType: 'Lesson',
      entityId: lessonId,
      metadata: { status: 'READY', bytes: object.contentLength },
    });
    return updated;
  });
}
