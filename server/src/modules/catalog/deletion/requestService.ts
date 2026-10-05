import type { CatalogDeletionTarget, PrismaClient } from '@prisma/client';
import type Redis from 'ioredis';
import { ApiError } from '../../identity/errors.js';
import { audit } from '../audit.js';
import { deletionAdvisoryKey, advisoryLock, lockCourseRow } from '../locks.js';
import type { DeletionTargetType, TxClient } from '../types.js';
import type { DrmClient } from '../drmClient.js';
import type { ServerConfig } from '../../../config.js';
import { assertUuid } from '../validation.js';
import { collectDeletionScope, findActiveOpForCourse, findActiveOpForTarget } from './scopes.js';
import { runDeletionCycle } from './reconciler.js';
import { finalizeNoMediaTarget } from './finalizer.js';
import { getLogger } from '../../../logger.js';

function confirmationFor(
  targetType: DeletionTargetType,
  targetId: string,
  courseSlug: string | null,
  confirmation: unknown,
): void {
  if (typeof confirmation !== 'string' || confirmation.trim() === '') {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Explicit confirmation is required.', {
      field: 'confirmation',
    });
  }
  if (targetType === 'COURSE') {
    if (confirmation !== courseSlug && confirmation !== targetId) {
      throw new ApiError(
        400,
        'CONFIRMATION_MISMATCH',
        'Confirmation must exactly match the course slug.',
      );
    }
    return;
  }
  if (confirmation !== targetId) {
    throw new ApiError(
      400,
      'CONFIRMATION_MISMATCH',
      'Confirmation must exactly match the target id.',
    );
  }
}

/**
 * Permanent-deletion request. For targets with externally registered media
 * the adapter must be configured BEFORE any catalog mutation; otherwise 503
 * with zero side effects. No network I/O inside transactions.
 */
export async function requestPermanentDeletion(
  prisma: PrismaClient,
  config: ServerConfig,
  drmFactory: (cfg: ServerConfig) => DrmClient | null,
  actorId: string,
  targetType: DeletionTargetType,
  targetId: string,
  raw: unknown,
  redis?: Redis,
) {
  assertUuid(targetId, 'targetId');
  const body = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;

  const confirmationCourse = targetType === 'COURSE' ? await prisma.course.findUnique({ where: { id: targetId }, select: { slug: true, requestedSlug: true } }) : null;
  const courseSlug = confirmationCourse?.requestedSlug ?? confirmationCourse?.slug ?? null;
  if (targetType === 'COURSE' && courseSlug === null)
    throw new ApiError(404, 'NOT_FOUND', 'Course not found.');
  confirmationFor(targetType, targetId, courseSlug, body['confirmation']);

  // Read-only scope inspection first: fail 503 before mutating when DRM is
  // required but unconfigured. No operation, audit, marker, or media change.
  const preview = await collectDeletionScope(prisma as unknown as TxClient, targetType, targetId);
  const needsDrm = preview.affected.some((a) => a.drmAssetId !== null);
  const drm = drmFactory(config);
  if (needsDrm && drm === null) {
    throw new ApiError(503, 'DRM_UNCONFIGURED', 'External media service is not configured.');
  }

  const created = await prisma.$transaction(async (tx) => {
    await advisoryLock(tx, deletionAdvisoryKey(targetType, targetId));
    const unlocked = await collectDeletionScope(tx, targetType, targetId);
    const child = await tx.course.findUniqueOrThrow({ where: { id: unlocked.courseId } });
    if (child.revisionOwnerId) {
      await lockCourseRow(tx, child.revisionOwnerId);
      const parent = await tx.course.findUniqueOrThrow({ where: { id: child.revisionOwnerId } });
      if (parent.deletionRequestedAt) throw new ApiError(409, 'DELETION_PENDING', 'Parent course deletion is pending.');
    }
    // Participate in the same course row lock as every other course mutation,
    // then re-read everything under it: no new media mapping or structural
    // mutation can interleave between the checks below and the writes.
    await lockCourseRow(tx, unlocked.courseId);
    const lockedCourse = await tx.course.findUniqueOrThrow({ where: { id: unlocked.courseId } });
    if (targetType !== 'COURSE' && lockedCourse.workingCopyId) throw new ApiError(409, 'COURSE_NOT_DRAFT', 'Delete content in the working copy, not the published course.');
    if ((await findActiveOpForTarget(tx, targetType, targetId)) !== null) {
      throw new ApiError(
        409,
        'DELETION_IN_PROGRESS',
        'A deletion operation is already active for this target.',
      );
    }
    const scope = await collectDeletionScope(tx, targetType, targetId);
    if ((await findActiveOpForCourse(tx, scope.courseId)) !== null) {
      throw new ApiError(
        409,
        'DELETION_IN_PROGRESS',
        'Another deletion is already active for this course.',
      );
    }
    // A mapping without a recorded DRM id is not proof that no external
    // asset exists: registration may have succeeded while its response or
    // platform result write was lost. Require registration reconciliation
    // before permanent deletion so storage can never be orphaned.
    if (scope.affected.some((a) => a.drmAssetId === null)) {
      throw new ApiError(
        409,
        'MEDIA_REGISTRATION_UNRESOLVED',
        'Media registration must be reconciled before deletion.',
      );
    }
    const lockedNeedsDrm = scope.affected.length > 0;
    if (lockedNeedsDrm && drm === null) {
      throw new ApiError(503, 'DRM_UNCONFIGURED', 'External media service is not configured.');
    }
    for (const cid of [scope.courseId]) {
      await tx.course.update({ where: { id: cid }, data: { deletionRequestedAt: new Date() } });
    }
    const mappingIds = scope.affected.map((a) => a.mappingId);
    if (mappingIds.length > 0) {
      await tx.mediaMapping.updateMany({
        where: { id: { in: mappingIds } },
        data: { status: 'DELETION_PENDING' },
      });
    }
    const op = await tx.catalogDeletionOperation.create({
      data: {
        targetType: targetType as CatalogDeletionTarget,
        targetId,
        requestedBy: actorId,
        status: 'PENDING',
        courseId: scope.courseId,
      },
    });
    for (const a of scope.affected) {
      await tx.catalogDeletionAsset.create({
        data: {
          operationId: op.id,
          mappingId: a.mappingId,
          drmAssetId: a.drmAssetId,
          externalAssetId: a.externalAssetId,
          lastState: 'PENDING',
          attemptCount: 0,
        },
      });
    }
    await audit(tx, {
      actorUserId: actorId,
      action: 'DELETION_REQUESTED',
      entityType: targetType,
      entityId: targetId,
      metadata: { operationId: op.id, assetCount: scope.affected.length },
    });
    return { op, scope, needsDrm: lockedNeedsDrm };
  });

  if (!created.needsDrm) {
    await finalizeNoMediaTarget(prisma, actorId, created.op.id);
    return prisma.catalogDeletionOperation.findUnique({
      where: { id: created.op.id },
      include: { assets: true },
    });
  }

  // All external work — initial scheduling included — runs through the same
  // leased shared cycle as reconciliation and retry. Without a lease (lease
  // held elsewhere, or no Redis to coordinate through) the request stays
  // durably PENDING and a later tick or retry performs the work.
  if (redis === undefined) {
    getLogger().warn(
      { operationId: created.op.id },
      'deletion coordination unavailable; operation left pending',
    );
    return prisma.catalogDeletionOperation.findUnique({
      where: { id: created.op.id },
      include: { assets: true },
    });
  }
  await prisma.catalogDeletionOperation.update({
    where: { id: created.op.id },
    data: { status: 'RUNNING' },
  });
  const client = drm as DrmClient;
  await runDeletionCycle(prisma, client, redis, created.op.id).catch(() => null);
  return prisma.catalogDeletionOperation.findUnique({
    where: { id: created.op.id },
    include: { assets: true },
  });
}
