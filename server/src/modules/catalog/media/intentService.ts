import type { PrismaClient } from '@prisma/client';
import { ApiError } from '../../identity/errors.js';
import { audit } from '../audit.js';
import { courseIdForLesson, withCourseLock } from '../courseTx.js';
import { ensureLessonAdditionAllowed } from '../courses/service.js';
import type { DrmClient } from '../drmClient.js';
import type { ServerConfig } from '../../../config.js';
import {
  assertUuid,
  generateExternalAssetId,
  generateIdempotencyKey,
  nonBlankString,
  normalizeContentType,
  rejectUnknownFields,
  validateSecurityTier,
} from '../validation.js';

const FIELDS = new Set(['contentType', 'title', 'securityTier']);

interface Intent {
  id: string;
  lessonId: string;
  externalAssetId: string;
  idempotencyKey: string;
  assetId: string | null;
  status: string;
}

/**
 * Durable retry-safe registration intent. No network I/O inside transactions:
 * 1. short tx: lock + validate, create-or-reuse intent row (assetId null), commit.
 * 2. DRM call outside tx with stable identifiers.
 * 3. short tx: conditionally record assetId/status (no overwrite of a converged row).
 * Uncertain failures retain a retryable intent; repeats reuse identifiers.
 */
export async function registerLessonMedia(
  prisma: PrismaClient,
  config: ServerConfig,
  drmFactory: (cfg: ServerConfig) => DrmClient | null,
  actorId: string,
  lessonId: string,
  raw: unknown,
): Promise<{ mapping: Intent; uploadUrl: string }> {
  assertUuid(lessonId, 'lessonId');
  rejectUnknownFields(raw, FIELDS);
  const body = raw as Record<string, unknown>;
  const contentType = normalizeContentType(body['contentType']);
  const securityTier = validateSecurityTier(body['securityTier']);
  const title =
    body['title'] === undefined ? undefined : nonBlankString(body['title'], 'title', 255);

  const drm = drmFactory(config);
  if (drm === null)
    throw new ApiError(503, 'DRM_UNCONFIGURED', 'External media service is not configured.');

  const owningCourseId = await courseIdForLesson(prisma, lessonId);
  let intent: Intent;
  try {
    intent = await withCourseLock(prisma, owningCourseId, async (tx) => {
      const lesson = await tx.lesson.findUnique({
        where: { id: lessonId },
        include: { media: true, section: { include: { course: true } } },
      });
      if (lesson === null) throw new ApiError(404, 'NOT_FOUND', 'Lesson not found.');
      ensureLessonAdditionAllowed(lesson.section.course);
      if (lesson.inheritedMediaId) throw new ApiError(409, 'MEDIA_EXISTS', 'Remove the inherited draft video before uploading a replacement.');
      if (
        lesson.media !== null &&
        lesson.media.assetId !== null &&
        (lesson.media.status !== 'UPLOAD_PENDING' || lesson.media.uploadCompletedAt !== null)
      ) {
        throw new ApiError(
          409,
          'MEDIA_EXISTS',
          'Lesson already has a media mapping. Replacement is not supported.',
        );
      }
      if (lesson.media !== null) return lesson.media as unknown as Intent;
      const created = await tx.mediaMapping.create({
        data: {
          lessonId,
          externalAssetId: generateExternalAssetId(),
          assetId: null,
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
        metadata: { externalAssetId: created.externalAssetId },
      });
      return created as unknown as Intent;
    });
  } catch (err) {
    if ((err as { code?: string }).code === 'P2002') {
      const existing = await prisma.mediaMapping.findUnique({ where: { lessonId } });
      if (existing === null) throw err;
      if (
        existing.assetId !== null &&
        (existing.status !== 'UPLOAD_PENDING' || existing.uploadCompletedAt !== null)
      ) {
        throw new ApiError(
          409,
          'MEDIA_EXISTS',
          'Lesson already has a media mapping. Replacement is not supported.',
        );
      }
      intent = existing as unknown as Intent;
    } else {
      throw err;
    }
  }

  let registered: { assetId: string; status: string; uploadUrl?: string; idempotent?: boolean };
  try {
    registered = await drm.registerMedia({
      externalAssetId: intent.externalAssetId,
      ...(title === undefined ? {} : { title }),
      contentType,
      securityTier,
      idempotencyKey: intent.idempotencyKey,
    });
  } catch (err) {
    const code = err instanceof ApiError ? err.code : 'DRM_UNKNOWN';
    await prisma.mediaMapping.update({
      where: { id: intent.id },
      data: {
        lastSyncedAt: new Date(),
        errorCategory: code.startsWith('DRM_') ? code : 'DRM_UNKNOWN',
      },
    });
    await audit(prisma, {
      actorUserId: actorId,
      action: 'MEDIA_REGISTER_FAILED',
      entityType: 'Lesson',
      entityId: lessonId,
      metadata: { errorCategory: code },
    });
    throw err;
  }

  if (intent.assetId !== null && registered.assetId !== intent.assetId) {
    throw new ApiError(502, 'DRM_MALFORMED', 'Retry must return the same registered asset.');
  }

  // The accepted external contract omits `uploadUrl` on idempotent repeats.
  // Without a fresh URL the administrator cannot upload, so a repeat without
  // a URL is a safe retryable failure — never success-with-null, never a
  // second asset, never a stored or fabricated URL.
  if (registered.uploadUrl === undefined && registered.idempotent !== true) {
    throw new ApiError(502, 'DRM_MALFORMED', 'Initial registration must include an upload URL.');
  }
  if (registered.uploadUrl === undefined) {
    const courseId = await courseIdForLesson(prisma, lessonId);
    await withCourseLock(prisma, courseId, async (tx) => {
      const current = await tx.mediaMapping.findUnique({
        where: { id: intent.id },
        include: { lesson: { include: { section: { include: { course: true } } } } },
      });
      if (current === null) throw new ApiError(404, 'MEDIA_MISSING', 'Media mapping not found.');
      ensureLessonAdditionAllowed(current.lesson.section.course);
      if (current.assetId === null) {
        await tx.mediaMapping.update({
          where: { id: intent.id },
          data: {
            assetId: registered.assetId,
            lastSyncedAt: new Date(),
            errorCategory: 'UPLOAD_URL_UNAVAILABLE',
          },
        });
      }
      await audit(tx, {
        actorUserId: actorId,
        action: 'MEDIA_REGISTER_FAILED',
        entityType: 'Lesson',
        entityId: lessonId,
        metadata: {
          errorCategory: 'UPLOAD_URL_UNAVAILABLE',
          externalAssetId: intent.externalAssetId,
        },
      });
    });
    throw new ApiError(
      409,
      'UPLOAD_URL_UNAVAILABLE',
      'The external service confirmed the existing asset but issued no fresh upload URL. Upload cannot proceed until the external contract provides one.',
    );
  }

  const courseId = await courseIdForLesson(prisma, lessonId);
  const recorded = await withCourseLock(prisma, courseId, async (tx) => {
    const current = await tx.mediaMapping.findUnique({
      where: { id: intent.id },
      include: { lesson: { include: { section: { include: { course: true } } } } },
    });
    if (current === null) throw new ApiError(404, 'MEDIA_MISSING', 'Media mapping not found.');
    ensureLessonAdditionAllowed(current.lesson.section.course);
    if (current.assetId !== null) {
      if (
        current.assetId !== registered.assetId ||
        current.status !== 'UPLOAD_PENDING' ||
        current.uploadCompletedAt !== null
      ) {
        throw new ApiError(
          409,
          'MEDIA_EXISTS',
          'Upload already completed or media changed during retry.',
        );
      }
      const recovered = await tx.mediaMapping.update({
        where: { id: current.id },
        data: { lastSyncedAt: new Date(), errorCategory: null },
      });
      await audit(tx, {
        actorUserId: actorId,
        action: 'MEDIA_UPLOAD_URL_REISSUED',
        entityType: 'Lesson',
        entityId: lessonId,
        metadata: { externalAssetId: current.externalAssetId, status: current.status },
      });
      return recovered as unknown as Intent;
    }
    const updated = await tx.mediaMapping.update({
      where: { id: intent.id },
      data: {
        assetId: registered.assetId,
        status: 'UPLOAD_PENDING',
        lastSyncedAt: new Date(),
        errorCategory: null,
      },
    });
    await audit(tx, {
      actorUserId: actorId,
      action: 'MEDIA_REGISTERED',
      entityType: 'Lesson',
      entityId: lessonId,
      metadata: { externalAssetId: intent.externalAssetId, status: 'UPLOAD_PENDING' },
    });
    return updated as unknown as Intent;
  });

  return { mapping: recorded, uploadUrl: registered.uploadUrl as string };
}
