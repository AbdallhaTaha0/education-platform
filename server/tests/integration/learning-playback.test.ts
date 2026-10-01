/**
 * M5 playback grant, progress writes and expiry termination.
 *
 * Uses the labeled HTTP DRM fixture. The fixture verifies the signed assertion
 * and refuses unknown assets and mismatched devices, so these tests assert the
 * platform's real behaviour. They are NOT evidence about the external service,
 * whose unknown-asset and wrong-device defects remain open blockers.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  createLearningWorld,
  createPublishedCourse,
  grantSubscription,
  isolateReferences,
  studentGet,
  studentPost,
  type LearningWorld,
} from './learning-helpers.js';
import { registerStudent } from './identity-helpers.js';

let world: LearningWorld;
let course: Awaited<ReturnType<typeof createPublishedCourse>>;
const DAY = 86_400_000;
const DEVICE = 'test-device-0001';

beforeAll(async () => {
  world = await createLearningWorld();
  course = await createPublishedCourse(world, 'playback');
  await grantSubscription(world, world.studentId, course.courseId, Date.now() + 30 * DAY);
});

afterAll(async () => {
  await world?.fixture?.stop();
  await world?.close();
});

async function startPlayback(lessonId = course.lessonId, deviceId = DEVICE) {
  return studentPost(
    world.app,
    `/learning/courses/${course.slug}/lessons/${lessonId}/playback`,
    world.studentJar,
    { deviceId },
  );
}

describe('playback grant', () => {
  it('returns a frontend-safe grant for an entitled student', async () => {
    const res = await startPlayback();
    expect(res.status).toBe(201);
    const grant = res.body.data.playback;
    expect(typeof grant.playbackToken).toBe('string');
    expect(grant.manifestUrl.startsWith('http://127.0.0.1:')).toBe(true);
    expect(grant.licenseUrl.startsWith('http://127.0.0.1:')).toBe(true);
    expect(grant.drmProvider).toBe('CLEAR_KEY');
    expect(grant.referenceId).toBeTruthy();
  });

  it('redacts the watermark trace code and signature', async () => {
    const res = await startPlayback();
    const watermark = res.body.data.playback.watermark;
    expect(watermark.maskedIdentity).toBe('fixt***@example');
    expect(watermark.traceCode).toBeUndefined();
    expect(watermark.signature).toBeUndefined();
    const serialized = JSON.stringify(res.body);
    expect(serialized).not.toContain('fixture-trace-code');
    expect(serialized).not.toContain('fixture-signature');
  });

  it('signs an assertion the fixture accepted, proving the claim contract', async () => {
    await startPlayback();
    const claims = world.playback!.lastClaims;
    expect(claims).not.toBeNull();
    expect(claims!['iss']).toBe('https://platform.test.internal');
    expect(claims!['aud']).toBe('edu-drm-fixture');
    expect(claims!['sub']).toBe(world.studentId);
    expect(claims!['device']).toBe(DEVICE);
    expect(typeof claims!['asset']).toBe('string');
    expect(claims!['exp'] as number).toBeLessThanOrEqual(Date.now() / 1000 + 121);
  });

  it('never persists the playback token, assertion or media URL', async () => {
    const res = await startPlayback();
    const token = res.body.data.playback.playbackToken as string;
    const referenceId = res.body.data.playback.referenceId as string;
    const reference = await world.prisma.playbackReference.findUniqueOrThrow({
      where: { id: referenceId },
    });
    const row = JSON.stringify(reference);
    expect(row).not.toContain(token);
    expect(row).not.toContain('manifest');
    expect(row).not.toContain('license');
    expect(row).not.toContain('assertion');
    // The opaque external session id IS persisted, by design.
    expect(reference.externalSessionId).toBe(res.body.data.playback.playbackSessionId);
  });

  it('does not place the token in an audit event or a log-safe field', async () => {
    const res = await startPlayback();
    const token = res.body.data.playback.playbackToken as string;
    const audits = await world.prisma.auditEvent.findMany();
    expect(JSON.stringify(audits)).not.toContain(token);
  });

  it('returns 403 SUBSCRIPTION_REQUIRED without a subscription', async () => {
    const other = await createPublishedCourse(world, 'playback-nosub');
    const res = await studentPost(
      world.app,
      `/learning/courses/${other.slug}/lessons/${other.lessonId}/playback`,
      world.studentJar,
      { deviceId: DEVICE },
    );
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('SUBSCRIPTION_REQUIRED');
  });

  it('returns 403 SUBSCRIPTION_EXPIRED once the boundary is crossed', async () => {
    const other = await createPublishedCourse(world, 'playback-expired');
    await grantSubscription(world, world.studentId, other.courseId, Date.now() + 1000);
    expect((await startPlaybackOn(other)).status).toBe(201);
    await world.prisma.subscription.updateMany({
      where: { studentId: world.studentId, courseId: other.courseId },
      data: { expiresAt: new Date(Date.now() - 1) },
    });
    const res = await startPlaybackOn(other);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('SUBSCRIPTION_EXPIRED');
  });

  it('rejects a missing device id and a non-string one', async () => {
    expect((await startPlayback(course.lessonId, '' as string)).status).toBe(400);
    const bad = await studentPost(
      world.app,
      `/learning/courses/${course.slug}/lessons/${course.lessonId}/playback`,
      world.studentJar,
      { deviceId: { nested: true } },
    );
    expect(bad.status).toBe(400);
  });

  it('requires CSRF on the write and rejects a missing Origin', async () => {
    const noOrigin = await studentPost(
      world.app,
      `/learning/courses/${course.slug}/lessons/${course.lessonId}/playback`,
      world.studentJar,
      { deviceId: DEVICE },
      { withOrigin: false },
    );
    expect(noOrigin.status).toBe(403);
    const noCsrf = await studentPost(
      world.app,
      `/learning/courses/${course.slug}/lessons/${course.lessonId}/playback`,
      world.studentJar,
      { deviceId: DEVICE },
      { withCsrf: false },
    );
    expect(noCsrf.status).toBe(403);
  });

  it('rejects an anonymous playback request', async () => {
    const res = await studentPost(
      world.app,
      `/learning/courses/${course.slug}/lessons/${course.lessonId}/playback`,
      { header: () => '', csrf: () => '' } as never,
      { deviceId: DEVICE },
    );
    expect(res.status).toBe(401);
  });

  it('refuses an ADMIN playback request', async () => {
    const res = await studentPost(
      world.app,
      `/learning/courses/${course.slug}/lessons/${course.lessonId}/playback`,
      world.adminJar,
      { deviceId: DEVICE },
    );
    expect(res.status).toBe(403);
  });

  it('surfaces a dependency failure as 502 without leaking the body', async () => {
    world.playback!.failNextCreates = 1;
    const res = await startPlayback();
    expect(res.status).toBe(502);
    expect(res.body.error.code).toBe('DRM_DEPENDENCY_FAILED');
    expect(JSON.stringify(res.body)).not.toContain('transient playback failure');
  });

  it('keeps entitlement after a dependency failure', async () => {
    world.playback!.failNextCreates = 1;
    await startPlayback();
    const res = await studentGet(
      world.app,
      `/learning/courses/${course.slug}/outline`,
      world.studentJar,
    );
    expect(res.status).toBe(200);
  });
});

async function startPlaybackOn(target: { slug: string; lessonId: string }) {
  return studentPost(
    world.app,
    `/learning/courses/${target.slug}/lessons/${target.lessonId}/playback`,
    world.studentJar,
    { deviceId: DEVICE },
  );
}

/** POST /learning/progress takes the course and lesson in the body. */
function writeProgress(slug: string, lessonId: string, body: Record<string, unknown>) {
  return studentPost(world.app, '/learning/progress', world.studentJar, {
    courseRef: slug,
    lessonId,
    ...body,
  });
}

describe('progress writes', () => {
  /**
   * Forget any progress recorded for a lesson in this world.
   *
   * The progress rule is deliberately monotonic, so a first write only reports
   * the position it was given when no row exists yet. Each test that asserts a
   * first write establishes that baseline itself rather than depending on the
   * order tests happen to run in.
   */
  async function clearProgress(lessonId: string): Promise<void> {
    await world.prisma.lessonProgress.deleteMany({
      where: { studentId: world.studentId, lessonId },
    });
  }

  it('records a position and is monotonic', async () => {
    await clearProgress(course.lessonId);
    const first = await writeProgress(course.slug, course.lessonId, {
      positionSeconds: 30,
      durationSeconds: 600,
    });
    expect(first.status).toBe(200);
    expect(first.body.data.progress.positionSeconds).toBe(30);

    const backwards = await writeProgress(course.slug, course.lessonId, {
      positionSeconds: 5,
      durationSeconds: 600,
    });
    expect(backwards.body.data.progress.positionSeconds).toBe(30);
  });

  it('is idempotent for a repeated write', async () => {
    await clearProgress(course.lessonId);
    const body = { positionSeconds: 120, durationSeconds: 600 };
    await writeProgress(course.slug, course.lessonId, body);
    await writeProgress(course.slug, course.lessonId, body);
    const rows = await world.prisma.lessonProgress.findMany({
      where: { studentId: world.studentId, lessonId: course.lessonId },
    });
    expect(rows.length).toBe(1);
    expect(rows[0].positionSeconds).toBe(120);
  });

  it('rejects out-of-range and non-finite values', async () => {
    for (const body of [
      { positionSeconds: -1, durationSeconds: 600 },
      { positionSeconds: 'abc', durationSeconds: 600 },
      { positionSeconds: 1e12, durationSeconds: 600 },
      { positionSeconds: 1, durationSeconds: -5 },
    ]) {
      const res = await writeProgress(course.slug, course.lessonId, body);
      expect(res.status).toBe(400);
    }
  });

  it('marks completion once and never un-completes', async () => {
    const other = await createPublishedCourse(world, 'progress-complete');
    await grantSubscription(world, world.studentId, other.courseId, Date.now() + 30 * DAY);
    await writeProgress(other.slug, other.lessonId, {
      positionSeconds: 599,
      durationSeconds: 600,
      completed: true,
    });
    const row = await world.prisma.lessonProgress.findFirstOrThrow({
      where: { studentId: world.studentId, lessonId: other.lessonId },
    });
    expect(row.completedAt).not.toBeNull();

    await writeProgress(other.slug, other.lessonId, {
      positionSeconds: 10,
      durationSeconds: 600,
      completed: false,
    });
    const after = await world.prisma.lessonProgress.findFirstOrThrow({
      where: { studentId: world.studentId, lessonId: other.lessonId },
    });
    expect(after.completedAt).not.toBeNull();
  });

  it('surfaces progress and a resume target on the dashboard', async () => {
    const other = await createPublishedCourse(world, 'progress-dash', { extraLessons: 1 });
    await grantSubscription(world, world.studentId, other.courseId, Date.now() + 30 * DAY);
    const [first, second] = other.lessonIds as [string, string];
    // Watching the first lesson to the end completes it and leaves nothing to resume.
    await writeProgress(other.slug, first, { positionSeconds: 600, durationSeconds: 600 });
    const completed = await studentGet(world.app, '/learning/dashboard', world.studentJar);
    const entry = (
      completed.body.data.active as {
        courseId: string;
        percentComplete: number;
        lastLessonId: string | null;
      }[]
    ).find((a) => a.courseId === other.courseId);
    expect(entry?.percentComplete).toBe(50);
    expect(entry?.lastLessonId).toBeNull();

    // A partially watched lesson becomes the continue-learning target.
    await writeProgress(other.slug, second, { positionSeconds: 30, durationSeconds: 600 });
    const resumed = await studentGet(world.app, '/learning/dashboard', world.studentJar);
    const after = (
      resumed.body.data.active as {
        courseId: string;
        percentComplete: number;
        lastLessonId: string | null;
      }[]
    ).find((a) => a.courseId === other.courseId);
    expect(after?.percentComplete).toBe(50);
    expect(after?.lastLessonId).toBe(second);
  });

  it('does not authorize: a fresh write for an unbought course is 403', async () => {
    const other = await createPublishedCourse(world, 'progress-403');
    const res = await writeProgress(other.slug, other.lessonId, {
      positionSeconds: 5,
      durationSeconds: 100,
    });
    expect(res.status).toBe(403);
  });
});

describe('viewer end and expiry termination', () => {
  // Each case starts with no other live reference, so batch counts are exact.
  beforeEach(async () => {
    await isolateReferences(world);
  });

  it('confirms the end with the DRM and records ENDED', async () => {
    const start = await startPlayback();
    const { referenceId, playbackSessionId } = start.body.data.playback;
    const res = await studentPost(
      world.app,
      `/learning/playback/${referenceId}/end`,
      world.studentJar,
      {},
    );
    expect(res.status).toBe(200);
    expect(res.body.data.closure).toBe('CONFIRMED');
    const reference = await world.prisma.playbackReference.findUniqueOrThrow({
      where: { id: referenceId },
    });
    expect(reference.status).toBe('ENDED');
    expect(reference.terminationStatus).toBe('COMPLETED');
    expect(world.playback!.sessions.get(playbackSessionId)?.status).toBe('revoked');
  });

  it('queues a retry when the DRM end confirmation fails', async () => {
    const start = await startPlayback();
    const { referenceId } = start.body.data.playback;
    world.playback!.revokeAlwaysFails = true;
    const res = await studentPost(
      world.app,
      `/learning/playback/${referenceId}/end`,
      world.studentJar,
      {},
    );
    expect(res.status).toBe(200);
    expect(res.body.data.closure).toBe('QUEUED');
    const reference = await world.prisma.playbackReference.findUniqueOrThrow({
      where: { id: referenceId },
    });
    expect(reference.status).toBe('ENDED');
    expect(reference.terminationStatus).toBe('PENDING');
    expect(reference.pendingEndReason).toBe('VIEWER_END');
    world.playback!.revokeAlwaysFails = false;
  });

  it('is idempotent on a repeated end', async () => {
    const start = await startPlayback();
    const { referenceId } = start.body.data.playback;
    await studentPost(world.app, `/learning/playback/${referenceId}/end`, world.studentJar, {});
    const again = await studentPost(
      world.app,
      `/learning/playback/${referenceId}/end`,
      world.studentJar,
      {},
    );
    expect(again.status).toBe(200);
  });

  it('treats a foreign reference id as a silent no-op and never touches the live session', async () => {
    const start = await startPlayback();
    const { referenceId } = start.body.data.playback;
    // An id that belongs to nobody discloses nothing and changes nothing.
    const foreign = await studentPost(
      world.app,
      `/learning/playback/f6c0ffee-0000-4000-8000-000000000000/end`,
      world.studentJar,
      {},
    );
    expect(foreign.status).toBe(200);
    const reference = await world.prisma.playbackReference.findUniqueOrThrow({
      where: { id: referenceId },
    });
    expect(reference.status).toBe('ACTIVE');
    expect(reference.endedAt).toBeNull();
  });

  it('does not let a second student end or observe the first student session', async () => {
    const other = await registerStudent(world.app);
    const start = await startPlayback();
    const { referenceId } = start.body.data.playback;

    const res = await studentPost(
      world.app,
      `/learning/playback/${referenceId}/end`,
      other.jar,
      {},
    );
    // Owner-scoped and existence-preserving: still 200, and the session is live.
    expect(res.status).toBe(200);
    const reference = await world.prisma.playbackReference.findUniqueOrThrow({
      where: { id: referenceId },
    });
    expect(reference.status).toBe('ACTIVE');
    expect(reference.endedAt).toBeNull();

    // The second student cannot even play the lesson without a subscription.
    const play = await studentPost(
      world.app,
      `/learning/courses/${course.slug}/lessons/${course.lessonId}/playback`,
      other.jar,
      { deviceId: DEVICE },
    );
    expect(play.status).toBe(403);
  });

  it('does not terminate a session whose subscription is still active', async () => {
    const other = await createPublishedCourse(world, 'expiry-live');
    await grantSubscription(world, world.studentId, other.courseId, Date.now() + 30 * DAY);
    const start = await startPlaybackOn(other);
    const { referenceId } = start.body.data.playback;
    const { reconcileExpiredSessions } = await import(
      '../../src/modules/learning/expiry/reconciler.js'
    );
    const result = await reconcileExpiredSessions(world.prisma, world.redis, world.drm, Date.now());
    void result;
    const reference = await world.prisma.playbackReference.findUniqueOrThrow({
      where: { id: referenceId },
    });
    expect(reference.status).toBe('ACTIVE');
    expect(reference.terminationStatus).toBeNull();
  });

  it('detects a crossed subscription and revokes the external session', async () => {
    const other = await createPublishedCourse(world, 'expiry-crossed');
    await grantSubscription(world, world.studentId, other.courseId, Date.now() + 60_000);
    const start = await startPlaybackOn(other);
    const { referenceId, playbackSessionId } = start.body.data.playback;

    // Move the expiry behind us without any student request.
    await world.prisma.subscription.updateMany({
      where: { studentId: world.studentId, courseId: other.courseId },
      data: { expiresAt: new Date(Date.now() - 1) },
    });

    const { reconcileExpiredSessions } = await import(
      '../../src/modules/learning/expiry/reconciler.js'
    );
    const result = await reconcileExpiredSessions(world.prisma, world.redis, world.drm, Date.now());
    expect(result.queued).toBeGreaterThanOrEqual(1);
    expect(result.terminated).toBeGreaterThanOrEqual(1);

    const reference = await world.prisma.playbackReference.findUniqueOrThrow({
      where: { id: referenceId },
    });
    expect(reference.status).toBe('TERMINATED');
    expect(reference.terminationStatus).toBe('COMPLETED');
    expect(reference.pendingEndReason).toBeNull();
    expect(world.playback!.sessions.get(playbackSessionId)?.status).toBe('revoked');
  });

  it('retries a failed revoke with backoff and stops after the attempt ceiling', async () => {
    const other = await createPublishedCourse(world, 'expiry-retry');
    await grantSubscription(world, world.studentId, other.courseId, Date.now() + 60_000);
    const start = await startPlaybackOn(other);
    const { referenceId } = start.body.data.playback;
    await world.prisma.subscription.updateMany({
      where: { studentId: world.studentId, courseId: other.courseId },
      data: { expiresAt: new Date(Date.now() - 1) },
    });
    const { MAX_TERMINATION_ATTEMPTS } = await import(
      '../../src/modules/learning/expiry/reconciler.js'
    );
    const { reconcileExpiredSessions } = await import(
      '../../src/modules/learning/expiry/reconciler.js'
    );
    // A persistent dependency failure is rescheduled with backoff, not lost.
    world.playback!.revokeAlwaysFails = true;
    const first = await reconcileExpiredSessions(world.prisma, world.redis, world.drm, Date.now());
    expect(first.failed).toBeGreaterThanOrEqual(1);
    let reference = await world.prisma.playbackReference.findUniqueOrThrow({
      where: { id: referenceId },
    });
    expect(reference.terminationAttempts).toBe(1);
    expect(reference.terminationStatus).toBe('PENDING');
    expect(reference.lastErrorCategory).toBeTruthy();

    // The next due pass completes it once the dependency recovers.
    world.playback!.revokeAlwaysFails = false;
    const second = await reconcileExpiredSessions(
      world.prisma,
      world.redis,
      world.drm,
      Date.now() + 60_000,
    );
    expect(second.terminated).toBeGreaterThanOrEqual(1);
    reference = await world.prisma.playbackReference.findUniqueOrThrow({
      where: { id: referenceId },
    });
    expect(reference.terminationStatus).toBe('COMPLETED');
    expect(reference.status).toBe('TERMINATED');

    // Exhaust the ceiling and confirm the row leaves the active set.
    const { scheduleTermination } = await import('../../src/modules/learning/expiry/reconciler.js');
    const third = await createPublishedCourse(world, 'expiry-exhaust');
    await grantSubscription(world, world.studentId, third.courseId, Date.now() + 60_000);
    const thirdStart = await startPlaybackOn(third);
    await world.prisma.subscription.updateMany({
      where: { studentId: world.studentId, courseId: third.courseId },
      data: { expiresAt: new Date(Date.now() - 1) },
    });
    await scheduleTermination(
      world.prisma,
      thirdStart.body.data.playback.referenceId,
      Date.now() - 1,
    );
    await world.prisma.playbackReference.update({
      where: { id: thirdStart.body.data.playback.referenceId },
      data: { terminationAttempts: MAX_TERMINATION_ATTEMPTS - 1, nextTerminationAt: new Date(0) },
    });
    world.playback!.revokeAlwaysFails = true;
    await reconcileExpiredSessions(world.prisma, world.redis, world.drm, Date.now());
    const exhausted = await world.prisma.playbackReference.findUniqueOrThrow({
      where: { id: thirdStart.body.data.playback.referenceId },
    });
    expect(exhausted.status).toBe('TERMINATION_FAILED');
    expect(exhausted.nextTerminationAt).toBeNull();
    // The give-up state must not fabricate a confirmed end instant.
    expect(exhausted.endedAt).toBeNull();
    expect(exhausted.terminationAttempts).toBeGreaterThanOrEqual(MAX_TERMINATION_ATTEMPTS);
    world.playback!.revokeAlwaysFails = false;
  });

  it('is replica-safe: a second concurrent pass does not double-revoke', async () => {
    const other = await createPublishedCourse(world, 'expiry-replica');
    await grantSubscription(world, world.studentId, other.courseId, Date.now() + 60_000);
    const start = await startPlaybackOn(other);
    const { referenceId, playbackSessionId } = start.body.data.playback;
    await world.prisma.subscription.updateMany({
      where: { studentId: world.studentId, courseId: other.courseId },
      data: { expiresAt: new Date(Date.now() - 1) },
    });
    const { reconcileExpiredSessions } = await import(
      '../../src/modules/learning/expiry/reconciler.js'
    );
    const [a, b] = await Promise.all([
      reconcileExpiredSessions(world.prisma, world.redis, world.drm, Date.now()),
      reconcileExpiredSessions(world.prisma, world.redis, world.drm, Date.now()),
    ]);
    const total = a.terminated + b.terminated;
    expect(total).toBe(1);
    const reference = await world.prisma.playbackReference.findUniqueOrThrow({
      where: { id: referenceId },
    });
    expect(reference.terminationAttempts).toBe(0);
    expect(world.playback!.sessions.get(playbackSessionId)?.status).toBe('revoked');
  });
});
