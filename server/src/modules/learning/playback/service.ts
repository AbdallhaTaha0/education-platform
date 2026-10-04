/**
 * Playback-session orchestration (M5).
 *
 * Order matters and is enforced by this module:
 *   1. the caller has already resolved a trusted course/lesson/media binding;
 *   2. mint the short-lived signed assertion from those trusted records;
 *   3. call the external DRM with server-only application credentials;
 *   4. validate the response and resolve dependency URLs;
 *   5. persist a non-secret reference so expiry can request termination later;
 *   6. return a frontend-safe grant.
 *
 * The playback token exists only in the returned grant and in the browser's
 * memory. It is never written to PostgreSQL, Redis, logs, audit metadata or a
 * navigation URL.
 */
import type { PrismaClient } from '@prisma/client';
import type { DrmClient } from '../../catalog/drmClient.js';
import { LearningError } from '../errors.js';
import type { LearningBinding, PlaybackGrant } from '../types.js';
import { mintAssertion, type AssertionConfig } from './assertion.js';
import { scheduleTermination } from '../expiry/reconciler.js';
import { evaluateEntitlement } from '../access/entitlement.js';
import { toWatermarkPresentation, validatePlaybackSession, validateRenewal } from './schemas.js';
import { resolveDependencyUrls } from './urls.js';
import { assertLessonUnlocked } from '../../assessments/progression.js';

export interface PlaybackDeps {
  prisma: PrismaClient;
  drm: DrmClient;
  assertion: AssertionConfig;
  drmPublicBaseUrl: string | undefined;
}

export interface CreatePlaybackInput {
  binding: LearningBinding;
  deviceId: string;
  nowMs: number;
  resumePositionSeconds: number;
}

export async function createPlaybackSession(
  deps: PlaybackDeps,
  input: CreatePlaybackInput,
): Promise<PlaybackGrant> {
  const assertion = mintAssertion(deps.assertion, input.binding, input.nowMs, input.deviceId);

  let raw: unknown;
  try {
    raw = await deps.drm.createPlaybackSession({
      externalUserId: input.binding.studentId,
      externalAssetId: input.binding.externalAssetId,
      deviceId: input.deviceId,
      assertion: assertion.token,
    });
  } catch (err) {
    throw mapDependencyError(err);
  }

  const session = validatePlaybackSession(raw);
  const urls = resolveDependencyUrls(
    session.manifestUrl,
    session.licenseUrl,
    deps.drmPublicBaseUrl,
  );

  const record = await deps.prisma.playbackReference.create({
    data: {
      studentId: input.binding.studentId,
      lessonId: input.binding.lessonId,
      courseId: input.binding.courseId,
      externalSessionId: session.playbackSessionId,
      externalAssetId: input.binding.externalAssetId,
      provider: session.drmProvider,
      status: 'ACTIVE',
      tokenExpiresAt: new Date(session.tokenExpiresAt),
      sessionExpiresAt: new Date(session.sessionExpiresAt),
    },
    select: { id: true },
  });

  return {
    referenceId: record.id,
    playbackSessionId: session.playbackSessionId,
    playbackToken: session.playbackToken,
    tokenExpiresAt: session.tokenExpiresAt,
    sessionExpiresAt: session.sessionExpiresAt,
    manifestUrl: urls.manifestUrl,
    licenseUrl: urls.licenseUrl,
    drmProvider: session.drmProvider,
    watermark: toWatermarkPresentation(session.watermark),
    resumePositionSeconds: input.resumePositionSeconds,
  };
}

/**
 * Platform-mediated playback-token renewal (M5 correction round).
 *
 * The browser never calls the DRM's bearer-protected renew endpoint directly,
 * because it would have to present the playback token to a dependency route the
 * platform controls, and because entitlement must be re-checked on backend
 * time at the moment of renewal. The platform holds only application
 * credentials, so it renews through the idempotent renew call and forwards a
 * minimized, validated credential set.
 *
 * Ownership is re-verified against the authenticated student, so a reference id
 * cannot be used to renew somebody else's session.
 */
export interface RenewalResult {
  renewed: true;
  playbackToken: string;
  tokenExpiresAt: string;
  sessionExpiresAt: string;
}

export type RenewalOutcome =
  | RenewalResult
  | { renewed: false; reason: 'NOT_RENEWABLE' | 'SESSION_GONE' };

export async function renewPlaybackToken(
  deps: PlaybackDeps,
  input: { referenceId: string; studentId: string; nowMs: number },
): Promise<RenewalOutcome> {
  const reference = await deps.prisma.playbackReference.findFirst({
    where: { id: input.referenceId, studentId: input.studentId },
    select: { id: true, status: true, externalSessionId: true, studentId: true, courseId: true, lessonId: true },
  });
  if (reference === null) return { renewed: false, reason: 'NOT_RENEWABLE' };
  if (reference.status !== 'ACTIVE') return { renewed: false, reason: 'NOT_RENEWABLE' };

  // Entitlement is re-evaluated on backend time before every renewal. A
  // subscription that expired since the grant was issued cannot be renewed.
  const decision = await recheckEntitlement(
    deps.prisma,
    reference.studentId,
    reference.courseId,
    input.nowMs,
  );
  if (!decision.allowed) {
    // The session must not outlive the entitlement: queue durable termination.
    await scheduleTermination(deps.prisma, reference.id, input.nowMs, 'SUBSCRIPTION_EXPIRED');
    return { renewed: false, reason: 'NOT_RENEWABLE' };
  }
  await assertLessonUnlocked(deps.prisma, reference.studentId, reference.courseId, reference.lessonId);

  let raw: unknown;
  try {
    raw = await deps.drm.renewPlaybackSession(reference.externalSessionId);
  } catch (err) {
    // The external session is already gone: close it durably instead of
    // reporting a dependency failure.
    if ((err as { code?: string }).code === 'DRM_NOT_FOUND') {
      await deps.prisma.playbackReference.updateMany({
        where: { id: reference.id, status: 'ACTIVE' },
        data: {
          status: 'TERMINATED',
          terminationStatus: 'COMPLETED',
          pendingEndReason: null,
          nextTerminationAt: null,
          endedAt: new Date(input.nowMs),
        },
      });
      return { renewed: false, reason: 'SESSION_GONE' };
    }
    throw mapDependencyError(err);
  }

  const renewal = validateRenewal(raw);
  if (!renewal.renewed) {
    await deps.prisma.playbackReference.updateMany({
      where: { id: reference.id, status: 'ACTIVE' },
      data: {
        status: 'TERMINATED',
        terminationStatus: 'COMPLETED',
        pendingEndReason: null,
        nextTerminationAt: null,
        endedAt: new Date(input.nowMs),
      },
    });
    return { renewed: false, reason: 'SESSION_GONE' };
  }

  // Keep the durable expiry aligned with the dependency's answer.
  await deps.prisma.playbackReference.updateMany({
    where: { id: reference.id, status: 'ACTIVE' },
    data: {
      tokenExpiresAt: new Date(renewal.tokenExpiresAt),
      sessionExpiresAt: new Date(renewal.sessionExpiresAt),
    },
  });

  return {
    renewed: true,
    playbackToken: renewal.playbackToken,
    tokenExpiresAt: renewal.tokenExpiresAt,
    sessionExpiresAt: renewal.sessionExpiresAt,
  };
}

/** Backend-time entitlement re-check used only by the renewal path. */
async function recheckEntitlement(
  prisma: PrismaClient,
  studentId: string,
  courseId: string,
  nowMs: number,
): Promise<{ allowed: boolean }> {
  const subscriptions = await prisma.subscription.findMany({
    where: { studentId },
    select: { courseId: true, startsAt: true, expiresAt: true },
  });
  return evaluateEntitlement(subscriptions, courseId, nowMs);
}

function mapDependencyError(err: unknown): LearningError {
  const code = (err as { code?: string }).code;
  if (code === 'DRM_DEVICE_LIMIT') return new LearningError('PLAYBACK_DEVICE_LIMIT');
  if (code === 'DRM_DEVICE_REVOKED') return new LearningError('PLAYBACK_DEVICE_REVOKED');
  if (code === 'DRM_STREAM_LIMIT') return new LearningError('PLAYBACK_STREAM_LIMIT');
  if (code === 'DRM_UNAUTHORIZED') {
    return new LearningError(
      'PLAYBACK_UNAVAILABLE',
      'The media service rejected the playback request.',
    );
  }
  if (
    code === 'DRM_TIMEOUT' ||
    code === 'DRM_NETWORK' ||
    code === 'DRM_SERVER' ||
    code === 'DRM_UNKNOWN'
  ) {
    return new LearningError('DRM_DEPENDENCY_FAILED');
  }
  if (code === 'DRM_NOT_FOUND' || code === 'DRM_VALIDATION' || code === 'DRM_CONFLICT') {
    return new LearningError(
      'PLAYBACK_UNAVAILABLE',
      'The media service rejected the playback request.',
    );
  }
  return new LearningError('DRM_DEPENDENCY_FAILED');
}

/**
 * Close a platform playback reference after the player ends normally, and make
 * sure the DRM session cannot outlive it.
 *
 * The playback bearer token is never held server-side, so the platform cannot
 * call the DRM's bearer-protected `/end`. Instead it uses the idempotent
 * application-credentialed revoke, and treats the durable status as ENDED
 * immediately because playback really has stopped in the browser. A failed
 * revoke is queued so the replica-safe reconciler retries it; that is what makes
 * the guarantee recoverable rather than best-effort.
 *
 * Idempotent: an already terminal reference is a no-op.
 */
export async function endPlaybackSession(
  prisma: PrismaClient,
  drm: DrmClient | null,
  referenceId: string,
  studentId: string,
  nowMs: number,
): Promise<'CONFIRMED' | 'QUEUED' | 'NOOP'> {
  const reference = await prisma.playbackReference.findFirst({
    where: { id: referenceId, studentId },
    select: { id: true, status: true, externalSessionId: true },
  });
  if (reference === null) return 'NOOP';
  if (reference.status !== 'ACTIVE' && reference.status !== 'ENDED') return 'NOOP';

  // Mark the viewer-facing state first: the request must not hang or fail on a
  // dependency problem, and the queued retry below is what makes the loss
  // recoverable.
  await prisma.playbackReference.updateMany({
    where: { id: referenceId, status: { in: ['ACTIVE', 'ENDED'] } },
    data: { status: 'ENDED', endedAt: new Date(nowMs) },
  });

  if (drm === null) {
    await scheduleTermination(prisma, referenceId, nowMs, 'VIEWER_END');
    return 'QUEUED';
  }
  try {
    const result = await drm.revokePlaybackSession(reference.externalSessionId, 'VIEWER_END');
    if (result.status === 'ended' || result.status === 'revoked') {
      await prisma.playbackReference.updateMany({
        where: { id: referenceId },
        data: { terminationStatus: 'COMPLETED', pendingEndReason: null, nextTerminationAt: null },
      });
      return 'CONFIRMED';
    }
  } catch {
    // Fall through to the queued retry below.
  }
  await scheduleTermination(prisma, referenceId, nowMs, 'VIEWER_END');
  return 'QUEUED';
}
