import { randomUUID } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import { ApiError } from '../../identity/errors.js';
import { createStorageClient } from '../../../infra/storage.js';
import { audit } from '../audit.js';
import { courseIdForLesson, withCourseLock } from '../courseTx.js';
import { ensureLessonAdditionAllowed } from '../courses/service.js';
import type { ServerConfig } from '../../../config.js';
import {
  assertUuid,
  generateExternalAssetId,
  generateIdempotencyKey,
  nonBlankString,
  normalizeContentType,
  rejectUnknownFields,
} from '../validation.js';

const FIELDS = new Set(['contentType', 'title']);
const UPLOAD_URL_TTL_SEC = 900;

/** Register an opaque platform object and return a short-lived direct upload URL. */
export async function registerLessonMedia(
  prisma: PrismaClient,
  config: ServerConfig,
  _drmFactory: unknown,
  actorId: string,
  lessonId: string,
  raw: unknown,
): Promise<{
  mapping: {
    id: string;
    lessonId: string;
    externalAssetId: string;
    assetId: string;
    status: string;
  };
  uploadUrl: string;
}> {
  assertUuid(lessonId, 'lessonId');
  rejectUnknownFields(raw, FIELDS);
  const body = raw as Record<string, unknown>;
  const contentType = normalizeContentType(body['contentType']);
  const title =
    body['title'] === undefined ? undefined : nonBlankString(body['title'], 'title', 255);
  const storage = createStorageClient(config);
  if (!storage) throw new ApiError(503, 'STORAGE_UNCONFIGURED', 'Video storage is not configured.');

  const courseId = await courseIdForLesson(prisma, lessonId);
  const mapping = await withCourseLock(prisma, courseId, async (tx) => {
    const lesson = await tx.lesson.findUnique({
      where: { id: lessonId },
      include: { media: true, section: { include: { course: true } } },
    });
    if (!lesson) throw new ApiError(404, 'NOT_FOUND', 'Lesson not found.');
    ensureLessonAdditionAllowed(lesson.section.course);
    if (lesson.inheritedMediaId)
      throw new ApiError(
        409,
        'MEDIA_EXISTS',
        'Remove the inherited draft video before uploading a replacement.',
      );
    if (
      lesson.media &&
      (lesson.media.status !== 'UPLOAD_PENDING' || lesson.media.uploadCompletedAt !== null)
    ) {
      throw new ApiError(
        409,
        'MEDIA_EXISTS',
        'Lesson already has a video. Remove it before uploading a replacement.',
      );
    }
    if (lesson.media) {
      if (!lesson.media.assetId)
        throw new ApiError(
          409,
          'MEDIA_REGISTRATION_UNRESOLVED',
          'Remove this incomplete upload and try again.',
        );
      return lesson.media;
    }
    const created = await tx.mediaMapping.create({
      data: {
        lessonId,
        externalAssetId: generateExternalAssetId(),
        assetId: randomUUID(),
        status: 'UPLOAD_PENDING',
        idempotencyKey: generateIdempotencyKey(),
        lastSyncedAt: new Date(),
      },
    });
    await audit(tx, {
      actorUserId: actorId,
      action: 'MEDIA_INTENT_CREATED',
      entityType: 'Lesson',
      entityId: lessonId,
      metadata: { videoMode: 'UNPROTECTED' },
    });
    return created;
  });

  const objectKey = `lesson-videos/${mapping.assetId}`;
  return {
    mapping: {
      id: mapping.id,
      lessonId: mapping.lessonId,
      externalAssetId: mapping.externalAssetId,
      assetId: mapping.assetId!,
      status: mapping.status,
    },
    uploadUrl: storage.presign('PUT', objectKey, UPLOAD_URL_TTL_SEC, contentType),
  };
}
