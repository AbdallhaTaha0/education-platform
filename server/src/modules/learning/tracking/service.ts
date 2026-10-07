/**
 * M10 view-tracking service (agent 1, platform-owned).
 *
 * Properties that matter:
 *   - ownership: every row's student must be the authenticated caller;
 *   - binding: course/lesson/media/playback are resolved from platform
 *     records only; the browser contributes only ids, never identity;
 *   - idempotency: starting twice for the same playback grant converges on
 *     one row via UNIQUE(playbackReferenceId); heartbeats converge via a
 *     monotonic GREATEST advance plus a row-locked conditional countedAt
 *     claim, so duplicate deliveries, React remounts, transport retries and
 *     concurrent replica writes count at most once per session, and exactly
 *     one concurrent caller observes the threshold transition;
 *   - continuity: pause/resume and token renewal reuse the same
 *     playbackReferenceId and therefore the same row; refresh and successful
 *     reconnect mint a new playback grant and therefore a new row after
 *     authorization; failed reconnects mint no grant and therefore no row;
 *   - version binding: mediaAssetId/mediaExternalAssetId snapshot the
 *     MediaMapping at session start (no FK), so replacing a video never
 *     misattributes old views and deleting a retired mapping never deletes
 *     history;
 *   - no backfill: LessonProgress rows are never converted into views;
 *     coverage starts at M10ViewTrackingState.startedAt.
 *
 * Client measurements represent reported playback activity, not proof of
 * human attention; this module never claims fraud-proof tracking.
 */
import { randomUUID } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import { LearningError } from '../errors.js';
import type { LearningBinding } from '../types.js';
import { evaluateEntitlement, isLearnableStatus } from '../access/entitlement.js';
import { assertLessonUnlocked } from '../../assessments/progression.js';
import { normalizePlayedMs, VIEW_THRESHOLD_MS } from './validation.js';

/**
 * Transport-reorder tolerance for the legitimate final flush: a heartbeat for
 * a normally-ended reference is still accepted while the end is fresh, so a
 * flush racing the viewer's own end call (lesson switch, tab close, natural
 * completion) is not lost. This is not a viewing window — no new playback can
 * accrue after the player ended; it only delivers already-accumulated time.
 * Terminated/revoked/superseded references are always rejected, and heartbeats
 * past this grace are rejected as stale.
 */
export const FINAL_FLUSH_GRACE_MS = 120_000;

export interface ViewSessionRow {
  id: string;
  studentId: string;
  courseId: string;
  lessonId: string;
  mediaAssetId: string;
  mediaExternalAssetId: string;
  playbackReferenceId: string;
  startedAt: Date;
  countedAt: Date | null;
  playedMilliseconds: number;
}

export interface TrackingState {
  id: string;
  startedAt: Date;
}

/** Singleton coverage fence; replica-safe upsert, never backfills. */
export async function ensureTrackingState(
  prisma: PrismaClient,
  nowMs: number,
): Promise<TrackingState> {
  const row = await prisma.m10ViewTrackingState.upsert({
    where: { id: 'global' },
    create: { id: 'global', startedAt: new Date(nowMs) },
    update: {},
    select: { id: true, startedAt: true },
  });
  return row;
}

export async function readTrackingState(prisma: PrismaClient): Promise<TrackingState | null> {
  return prisma.m10ViewTrackingState.findUnique({
    where: { id: 'global' },
    select: { id: true, startedAt: true },
  });
}

export interface StartViewInput {
  binding: LearningBinding;
  playbackReferenceId: string;
  nowMs: number;
}

export interface StartViewResult {
  view: ViewSessionRow;
  created: boolean;
  trackingStartedAt: Date;
}

/**
 * Start (or re-attach to) the view session for one playback grant.
 *
 * The caller must already have resolved the trusted course/lesson binding
 * (entitlement, unlocks, READY media). This service additionally verifies the
 * playback reference is owned, ACTIVE and bound to the same lesson/course and
 * external asset, then inserts the view row idempotently.
 */
export async function startViewSession(
  prisma: PrismaClient,
  input: StartViewInput,
): Promise<StartViewResult> {
  const tracking = await ensureTrackingState(prisma, input.nowMs);

  const reference = await prisma.playbackReference.findFirst({
    where: { id: input.playbackReferenceId, studentId: input.binding.studentId },
    select: {
      id: true,
      studentId: true,
      courseId: true,
      lessonId: true,
      externalAssetId: true,
      status: true,
    },
  });
  // Owner-scoped and existence-preserving: a foreign or missing reference
  // behaves like an expired session, never revealing the row.
  if (reference === null) {
    throw new LearningError('PLAYBACK_SESSION_EXPIRED');
  }
  if (reference.status !== 'ACTIVE') {
    throw new LearningError('PLAYBACK_SESSION_EXPIRED');
  }
  if (
    reference.lessonId !== input.binding.lessonId ||
    reference.courseId !== input.binding.courseId ||
    reference.externalAssetId !== input.binding.externalAssetId
  ) {
    throw new LearningError('VALIDATION_ERROR', 'Playback binding does not match.');
  }

  const mapping = await prisma.mediaMapping.findFirst({
    where: { lessonId: input.binding.lessonId },
    select: { id: true, externalAssetId: true, status: true, retiredAt: true },
  });
  if (
    mapping === null ||
    mapping.status !== 'READY' ||
    mapping.retiredAt !== null ||
    mapping.externalAssetId !== input.binding.externalAssetId
  ) {
    throw new LearningError('MEDIA_NOT_READY');
  }

  const now = new Date(input.nowMs);
  const id = randomUUID();

  // One atomic insert; a concurrent or repeated start for the same grant
  // converges via the UNIQUE(playbackReferenceId) fence.
  const inserted = await prisma.$queryRaw<ViewSessionRow[]>`
    INSERT INTO "M10VideoViewSession"
      ("id", "studentId", "courseId", "lessonId", "mediaAssetId",
       "mediaExternalAssetId", "playbackReferenceId", "startedAt",
       "countedAt", "playedMilliseconds")
    VALUES (${id}, ${input.binding.studentId}, ${input.binding.courseId},
            ${input.binding.lessonId}, ${mapping.id},
            ${mapping.externalAssetId}, ${reference.id}, ${now}, NULL, 0)
    ON CONFLICT ("playbackReferenceId") DO NOTHING
    RETURNING "id", "studentId", "courseId", "lessonId", "mediaAssetId",
              "mediaExternalAssetId", "playbackReferenceId",
              "startedAt", "countedAt", "playedMilliseconds"
  `;

  const first = inserted[0];
  if (first !== undefined) {
    return { view: first, created: true, trackingStartedAt: tracking.startedAt };
  }

  const existing = await prisma.m10VideoViewSession.findUnique({
    where: { playbackReferenceId: reference.id },
    select: {
      id: true,
      studentId: true,
      courseId: true,
      lessonId: true,
      mediaAssetId: true,
      mediaExternalAssetId: true,
      playbackReferenceId: true,
      startedAt: true,
      countedAt: true,
      playedMilliseconds: true,
    },
  });
  if (existing === null || existing.studentId !== input.binding.studentId) {
    throw new LearningError('PLAYBACK_SESSION_EXPIRED');
  }
  // A grant is bound to one lesson; a mismatched re-attach is rejected rather
  // than silently re-bound.
  if (
    existing.lessonId !== input.binding.lessonId ||
    existing.courseId !== input.binding.courseId
  ) {
    throw new LearningError('VALIDATION_ERROR', 'Playback binding does not match.');
  }
  return { view: existing, created: false, trackingStartedAt: tracking.startedAt };
}

export interface HeartbeatInput {
  viewSessionId: string;
  studentId: string;
  playedMilliseconds: number;
  nowMs: number;
}

export interface HeartbeatResult {
  view: ViewSessionRow;
  counted: boolean;
  newlyCounted: boolean;
  trackingStartedAt: Date;
}

/**
 * Record accumulated actual playing time for one session.
 *
 * Every write re-checks the protections that governed session creation, at
 * backend time: the owning playback reference must still be valid (ACTIVE, or
 * a fresh viewer end whose final flush is racing it), the subscription must
 * still entitle the student, the course must still be published and present,
 * the lesson must still belong to the course and be unlocked, and the media
 * version must still be the READY version this session started on. An
 * ended-outside-grace, terminated, revoked, superseded, wrong or stale session
 * never produces a new count. Version snapshots on the row are immutable, so
 * replacements never rewrite history.
 *
 * The reported total only moves the stored total forward (GREATEST). The
 * 30-second transition is claimed by exactly one caller with a conditional
 * second update inside the same row-locked transaction, so concurrent
 * threshold calls yield exactly one newlyCounted=true while the durable count
 * stays one, and continued playback at 60/90s adds nothing.
 */
export async function recordHeartbeat(
  prisma: PrismaClient,
  input: HeartbeatInput,
): Promise<HeartbeatResult> {
  let reported: number;
  try {
    reported = normalizePlayedMs(input.playedMilliseconds);
  } catch {
    throw new LearningError('VALIDATION_ERROR');
  }

  const existing = await prisma.m10VideoViewSession.findFirst({
    where: { id: input.viewSessionId, studentId: input.studentId },
    select: {
      id: true,
      studentId: true,
      courseId: true,
      lessonId: true,
      mediaAssetId: true,
      mediaExternalAssetId: true,
      playbackReferenceId: true,
      countedAt: true,
      playedMilliseconds: true,
    },
  });
  if (existing === null) {
    throw new LearningError('LESSON_NOT_FOUND');
  }

  // The owning playback session must still be valid. Owner-scoped and
  // existence-preserving: a foreign or missing reference behaves like an
  // expired session. A normally-ended reference is accepted only as an
  // in-flight final flush (FINAL_FLUSH_GRACE_MS); terminated, revocation-like
  // and superseded references never count again, nor do wrong/stale bindings.
  const reference = await prisma.playbackReference.findFirst({
    where: { id: existing.playbackReferenceId, studentId: input.studentId },
    select: {
      id: true,
      studentId: true,
      courseId: true,
      lessonId: true,
      externalAssetId: true,
      status: true,
      endedAt: true,
    },
  });
  if (reference === null || reference.studentId !== input.studentId) {
    throw new LearningError('PLAYBACK_SESSION_EXPIRED');
  }
  if (
    reference.lessonId !== existing.lessonId ||
    reference.courseId !== existing.courseId ||
    reference.externalAssetId !== existing.mediaExternalAssetId
  ) {
    throw new LearningError('VALIDATION_ERROR', 'Playback binding does not match.');
  }
  if (reference.status === 'ACTIVE') {
    // Genuinely playing: proceed to the remaining checks.
  } else if (reference.status === 'ENDED') {
    const endedAtMs = reference.endedAt?.getTime();
    if (!Number.isFinite(endedAtMs) || input.nowMs - (endedAtMs as number) > FINAL_FLUSH_GRACE_MS) {
      throw new LearningError('PLAYBACK_SESSION_EXPIRED');
    }
  } else {
    // TERMINATED and TERMINATION_FAILED (lapsed entitlement, revocation,
    // superseded video, exhausted retries) never produce new counts.
    throw new LearningError('PLAYBACK_SESSION_EXPIRED');
  }

  // Current access is re-decided from subscriptions at backend time, exactly
  // like the renewal path: progress/playback rows never grant access.
  const subscriptions = await prisma.subscription.findMany({
    where: { studentId: input.studentId },
    select: { courseId: true, startsAt: true, expiresAt: true },
  });
  const decision = evaluateEntitlement(subscriptions, existing.courseId, input.nowMs);
  if (!decision.allowed) {
    throw new LearningError(decision.reason);
  }

  // The course must still be published and present; withdrawal behaves like
  // the outline boundary (indistinguishable from missing, same safe code).
  const course = await prisma.course.findUnique({
    where: { id: existing.courseId },
    select: { id: true, status: true, deletionRequestedAt: true },
  });
  if (course === null || course.deletionRequestedAt !== null || !isLearnableStatus(course.status)) {
    throw new LearningError('LESSON_NOT_FOUND');
  }

  // The lesson must still belong to the recorded course; a moved or deleted
  // lesson never counts through a stale view id.
  const lesson = await prisma.lesson.findUnique({
    where: { id: existing.lessonId },
    select: { id: true, section: { select: { courseId: true } } },
  });
  if (lesson === null || lesson.section.courseId !== existing.courseId) {
    throw new LearningError('LESSON_NOT_FOUND');
  }

  // Required-assessment locks are enforced on writes, not just on playback
  // creation: a lesson locked after the session started stops counting.
  // Throws 404 LESSON_NOT_FOUND (unknown lesson) or 403 ASSESSMENTS_REQUIRED.
  await assertLessonUnlocked(prisma, input.studentId, existing.courseId, existing.lessonId);

  // The media version must still be the READY version this session started on.
  // A replacement retires the old mapping, so post-replacement heartbeats stop
  // here (their playback was or will be revoked as superseded); the row keeps
  // its snapshot and history is never rewritten.
  const mapping = await prisma.mediaMapping.findFirst({
    where: { lessonId: existing.lessonId },
    select: { id: true, externalAssetId: true, status: true, retiredAt: true },
  });
  if (
    mapping === null ||
    mapping.status !== 'READY' ||
    mapping.retiredAt !== null ||
    mapping.id !== existing.mediaAssetId ||
    mapping.externalAssetId !== existing.mediaExternalAssetId
  ) {
    throw new LearningError('MEDIA_NOT_READY');
  }

  const tracking = await ensureTrackingState(prisma, input.nowMs);
  const now = new Date(input.nowMs);

  // Row-locked transaction: the monotonic total always advances, while the
  // threshold transition is claimed by exactly one caller. Concurrent writers
  // serialize on the row lock; only the winner's conditional update matches a
  // row (countedAt IS NULL), so exactly one response reports newlyCounted.
  const outcome = await prisma.$transaction(async (tx) => {
    const advanced = await tx.$queryRaw<ViewSessionRow[]>`
      UPDATE "M10VideoViewSession"
      SET "playedMilliseconds" = GREATEST("playedMilliseconds", ${reported})
      WHERE "id" = ${existing.id} AND "studentId" = ${input.studentId}
      RETURNING "id", "studentId", "courseId", "lessonId", "mediaAssetId",
                "mediaExternalAssetId", "playbackReferenceId",
                "startedAt", "countedAt", "playedMilliseconds"
    `;
    const current = advanced[0];
    if (current === undefined) {
      throw new LearningError('LESSON_NOT_FOUND');
    }
    if (current.countedAt !== null || current.playedMilliseconds < VIEW_THRESHOLD_MS) {
      return { row: current, newlyCounted: false };
    }
    const claimed = await tx.$queryRaw<Array<{ id: string }>>`
      UPDATE "M10VideoViewSession"
      SET "countedAt" = ${now}
      WHERE "id" = ${current.id} AND "countedAt" IS NULL
      RETURNING "id"
    `;
    if (claimed.length === 0) {
      // A concurrent caller won the transition first; re-read its result.
      const loser = await tx.m10VideoViewSession.findUniqueOrThrow({
        where: { id: current.id },
        select: {
          id: true,
          studentId: true,
          courseId: true,
          lessonId: true,
          mediaAssetId: true,
          mediaExternalAssetId: true,
          playbackReferenceId: true,
          startedAt: true,
          countedAt: true,
          playedMilliseconds: true,
        },
      });
      return { row: loser, newlyCounted: false };
    }
    return { row: { ...current, countedAt: now }, newlyCounted: true };
  });

  return {
    view: outcome.row,
    counted: outcome.row.countedAt !== null,
    newlyCounted: outcome.newlyCounted,
    trackingStartedAt: tracking.startedAt,
  };
}

/** Owner-visible view payload (no credentials; ids are row identifiers). */
export function toViewPayload(
  view: ViewSessionRow,
  trackingStartedAt: Date,
): {
  viewSessionId: string;
  studentId: string;
  courseId: string;
  lessonId: string;
  mediaAssetId: string;
  startedAt: string;
  countedAt: string | null;
  playedMilliseconds: number;
  counted: boolean;
  thresholdMs: number;
  trackingStartedAt: string;
} {
  return {
    viewSessionId: view.id,
    studentId: view.studentId,
    courseId: view.courseId,
    lessonId: view.lessonId,
    mediaAssetId: view.mediaAssetId,
    startedAt: view.startedAt.toISOString(),
    countedAt: view.countedAt ? view.countedAt.toISOString() : null,
    playedMilliseconds: view.playedMilliseconds,
    counted: view.countedAt !== null,
    thresholdMs: VIEW_THRESHOLD_MS,
    trackingStartedAt: trackingStartedAt.toISOString(),
  };
}
