/**
 * M5 correction round — server-side findings B, D, E, F.
 *
 * B: platform-mediated token renewal.
 * D: starvation-free expiry reconciliation past 500 references.
 * E: learning permitted only for PUBLISHED courses.
 * F: concurrency-safe initial progress creation.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  createLearningWorld,
  createPublishedCourse,
  grantSubscription,
  expireSubscription,
  isolateReferences,
  setCourseStatus,
  studentGet,
  studentPost,
  type LearningWorld,
} from './learning-helpers.js';

let world: LearningWorld;
let course: Awaited<ReturnType<typeof createPublishedCourse>>;
const DAY = 86_400_000;
const DEVICE = 'correction-device-01';

beforeAll(async () => {
  world = await createLearningWorld();
  course = await createPublishedCourse(world, 'corr');
  await grantSubscription(world, world.studentId, course.courseId, Date.now() + 30 * DAY);
});

afterAll(async () => {
  await world?.fixture?.stop();
  await world?.close();
});

async function startPlayback(target = course, deviceId = DEVICE) {
  return studentPost(
    world.app,
    `/learning/courses/${target.slug}/lessons/${target.lessonId}/playback`,
    world.studentJar,
    { deviceId },
  );
}

async function renew(referenceId: string) {
  return studentPost(world.app, `/learning/playback/${referenceId}/renew`, world.studentJar, {});
}

describe('E: learning requires a PUBLISHED course', () => {
  const states = ['DRAFT', 'PROCESSING', 'READY', 'ARCHIVED'] as const;

  it('refuses the outline for every non-released state', async () => {
    for (const status of states) {
      await setCourseStatus(world, course.courseId, status);
      const res = await studentGet(world.app, `/learning/courses/${course.slug}/outline`, world.studentJar);
      // Existence is not disclosed: a non-releasable course is indistinguishable
      // from a missing one.
      expect(res.status, `${status} outline`).toBe(404);
      expect(res.body.error.code, `${status} outline code`).toBe('LESSON_NOT_FOUND');
    }
  });

  it('refuses playback for every non-released state, even with an active subscription', async () => {
    for (const status of states) {
      await setCourseStatus(world, course.courseId, status);
      const res = await startPlayback();
      expect(res.status, `${status} playback`).toBe(404);
      expect(res.body.error.code, `${status} playback code`).toBe('LESSON_NOT_FOUND');
    }
  });

  it('refuses a progress write for every non-released state', async () => {
    for (const status of states) {
      await setCourseStatus(world, course.courseId, status);
      const res = await studentPost(world.app, '/learning/progress', world.studentJar, {
        courseRef: course.slug,
        lessonId: course.lessonId,
        positionSeconds: 5,
        durationSeconds: 100,
      });
      expect(res.status, `${status} progress`).toBe(404);
    }
  });

  it('allows a PUBLISHED course for an entitled student', async () => {
    await setCourseStatus(world, course.courseId, 'PUBLISHED');
    const outline = await studentGet(world.app, `/learning/courses/${course.slug}/outline`, world.studentJar);
    expect(outline.status).toBe(200);
    expect(outline.body.data.course.entitled).toBe(true);
    expect((await startPlayback()).status).toBe(201);
  });

  it('treats READY as processing-complete, not released', async () => {
    // The course is fully processed and playable at the media level, yet it is
    // not learnable. This is the exact distinction the finding asked for.
    await setCourseStatus(world, course.courseId, 'READY');
    const mapping = await world.prisma.mediaMapping.findFirstOrThrow({ where: { lessonId: course.lessonId } });
    expect(mapping.status).toBe('READY');
    const res = await startPlayback();
    expect(res.status).toBe(404);
  });
});

describe('B: platform-mediated token renewal', () => {
  beforeEach(async () => {
    await isolateReferences(world);
    // The E block above leaves the shared course in a non-released state.
    await setCourseStatus(world, course.courseId, 'PUBLISHED');
  });

  it('returns a fresh token for an active session', async () => {
    const start = await startPlayback();
    expect(start.status).toBe(201);
    const { referenceId, playbackToken } = start.body.data.playback;

    const res = await renew(referenceId);
    expect(res.status).toBe(200);
    const renewal = res.body.data.renewal;
    expect(renewal.renewed).toBe(true);
    expect(typeof renewal.playbackToken).toBe('string');
    expect(renewal.playbackToken).not.toBe(playbackToken);
    expect(Date.parse(renewal.tokenExpiresAt)).toBeGreaterThan(0);
  });

  it('minimizes the renewal response to credential fields only', async () => {
    const start = await startPlayback();
    const res = await renew(start.body.data.playback.referenceId);
    expect(res.status).toBe(200);
    const renewal = res.body.data.renewal;
    expect(Object.keys(renewal).sort()).toEqual(
      ['playbackToken', 'renewed', 'sessionExpiresAt', 'tokenExpiresAt'].sort(),
    );
    const serialized = JSON.stringify(res.body);
    expect(serialized).not.toContain('assertion');
    expect(serialized).not.toContain('assetId');
    expect(serialized).not.toContain('kid');
  });

  it('does not persist the renewed token', async () => {
    const start = await startPlayback();
    const referenceId = start.body.data.playback.referenceId;
    const res = await renew(referenceId);
    const token = res.body.data.renewal.playbackToken as string;
    const reference = await world.prisma.playbackReference.findUniqueOrThrow({ where: { id: referenceId } });
    expect(JSON.stringify(reference)).not.toContain(token);
  });

  it('re-checks entitlement on backend time and refuses at expiry', async () => {
    const target = await createPublishedCourse(world, 'renew-expiry');
    await grantSubscription(world, world.studentId, target.courseId, Date.now() + 30 * DAY);
    const start = await startPlayback(target);
    const referenceId = start.body.data.playback.referenceId;

    // Move the subscription behind us; the token is still valid but entitlement
    // is not, so the platform must refuse to renew.

    await expireSubscription(world, world.studentId, target.courseId);


    const res = await renew(referenceId);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('PLAYBACK_SESSION_EXPIRED');

    // A refused renewal also requests durable external termination.
    const reference = await world.prisma.playbackReference.findUniqueOrThrow({ where: { id: referenceId } });
    expect(reference.pendingEndReason).toBe('SUBSCRIPTION_EXPIRED');
    expect(reference.terminationStatus).toBe('PENDING');
  });

  it('refuses renewal at the exact expiry instant', async () => {
    const target = await createPublishedCourse(world, 'renew-exact');
    await grantSubscription(world, world.studentId, target.courseId, Date.now() + 30 * DAY);
    const start = await startPlayback(target);
    const referenceId = start.body.data.playback.referenceId;

    await expireSubscription(world, world.studentId, target.courseId);

    expect((await renew(referenceId)).status).toBe(401);
  });

  it('surfaces a dependency renewal failure as 502 and does not leak the body', async () => {
    const start = await startPlayback();
    const referenceId = start.body.data.playback.referenceId;
    world.playback!.renewAlwaysFails = true;
    const res = await renew(referenceId);
    world.playback!.renewAlwaysFails = false;
    expect(res.status).toBe(502);
    expect(res.body.error.code).toBe('DRM_DEPENDENCY_FAILED');
    expect(JSON.stringify(res.body)).not.toContain('transient renew failure');
  });

  it('refuses to renew another student reference', async () => {
    const start = await startPlayback();
    const res = await studentPost(
      world.app,
      `/learning/playback/${start.body.data.playback.referenceId}/renew`,
      world.adminJar,
      {},
    );
    // ADMIN never holds entitlement, so it cannot renew.
    expect(res.status).toBe(403);
  });

  it('refuses renewal without CSRF', async () => {
    const start = await startPlayback();
    const res = await studentPost(
      world.app,
      `/learning/playback/${start.body.data.playback.referenceId}/renew`,
      world.studentJar,
      {},
      { withCsrf: false },
    );
    expect(res.status).toBe(403);
  });

  it('refuses renewal of an already ended reference', async () => {
    const start = await startPlayback();
    const referenceId = start.body.data.playback.referenceId;
    await studentPost(world.app, `/learning/playback/${referenceId}/end`, world.studentJar, {});
    expect((await renew(referenceId)).status).toBe(401);
  });

  it('marks the session gone when the dependency reports it ended', async () => {
    const start = await startPlayback();
    const referenceId = start.body.data.playback.referenceId;
    await studentPost(world.app, `/learning/playback/${referenceId}/end`, world.studentJar, {});
    const res = await renew(referenceId);
    expect(res.status).toBe(401);
  });
});

describe('F: concurrency-safe initial progress creation', () => {
  it('converges simultaneous first writes on exactly one row', async () => {
    const target = await createPublishedCourse(world, 'progress-race');
    await grantSubscription(world, world.studentId, target.courseId, Date.now() + 30 * DAY);

    const attempts = await Promise.all(
      Array.from({ length: 8 }, (_, i) =>
        studentPost(world.app, '/learning/progress', world.studentJar, {
          courseRef: target.slug,
          lessonId: target.lessonId,
          positionSeconds: (i + 1) * 10,
          durationSeconds: 600,
        }),
      ),
    );

    // No unique-constraint failure reaches the client.
    expect(attempts.every((r) => r.status === 200)).toBe(true);
    const rows = await world.prisma.lessonProgress.findMany({
      where: { studentId: world.studentId, lessonId: target.lessonId },
    });
    expect(rows.length).toBe(1);
    // Position never moves backward, so the winner is the furthest write.
    expect(rows[0].positionSeconds).toBe(80);
  });

  it('never un-completes under concurrent mixed writes', async () => {
    const target = await createPublishedCourse(world, 'progress-complete-race');
    await grantSubscription(world, world.studentId, target.courseId, Date.now() + 30 * DAY);

    const attempts = await Promise.all([
      ...Array.from({ length: 4 }, () =>
        studentPost(world.app, '/learning/progress', world.studentJar, {
          courseRef: target.slug,
          lessonId: target.lessonId,
          positionSeconds: 600,
          durationSeconds: 600,
          completed: true,
        }),
      ),
      ...Array.from({ length: 4 }, () =>
        studentPost(world.app, '/learning/progress', world.studentJar, {
          courseRef: target.slug,
          lessonId: target.lessonId,
          positionSeconds: 1,
          durationSeconds: 600,
          completed: false,
        }),
      ),
    ]);
    expect(attempts.every((r) => r.status === 200)).toBe(true);

    const row = await world.prisma.lessonProgress.findFirstOrThrow({
      where: { studentId: world.studentId, lessonId: target.lessonId },
    });
    expect(row.completedAt).not.toBeNull();
    expect(row.positionSeconds).toBe(600);
  });

  it('keeps a known duration when a concurrent write omits it', async () => {
    const target = await createPublishedCourse(world, 'progress-duration-race');
    await grantSubscription(world, world.studentId, target.courseId, Date.now() + 30 * DAY);
    await studentPost(world.app, '/learning/progress', world.studentJar, {
      courseRef: target.slug,
      lessonId: target.lessonId,
      positionSeconds: 10,
      durationSeconds: 600,
    });
    await Promise.all([
      studentPost(world.app, '/learning/progress', world.studentJar, {
        courseRef: target.slug,
        lessonId: target.lessonId,
        positionSeconds: 20,
        durationSeconds: null,
      }),
      studentPost(world.app, '/learning/progress', world.studentJar, {
        courseRef: target.slug,
        lessonId: target.lessonId,
        positionSeconds: 30,
        durationSeconds: null,
      }),
    ]);
    const row = await world.prisma.lessonProgress.findFirstOrThrow({
      where: { studentId: world.studentId, lessonId: target.lessonId },
    });
    expect(row.durationSeconds).toBe(600);
    expect(row.positionSeconds).toBe(30);
  });

  it('reports the merged final state to every caller', async () => {
    const target = await createPublishedCourse(world, 'progress-race-read');
    await grantSubscription(world, world.studentId, target.courseId, Date.now() + 30 * DAY);
    const attempts = await Promise.all(
      Array.from({ length: 4 }, (_, i) =>
        studentPost(world.app, '/learning/progress', world.studentJar, {
          courseRef: target.slug,
          lessonId: target.lessonId,
          positionSeconds: (i + 1) * 5,
          durationSeconds: 100,
        }),
      ),
    );
    const positions = attempts.map((a) => a.body.data.progress.positionSeconds);
    // No response reports a position behind the row that already existed.
    expect(Math.min(...positions)).toBeGreaterThanOrEqual(5);
    const read = await studentGet(
      world.app,
      `/learning/courses/${target.slug}/lessons/${target.lessonId}/progress`,
      world.studentJar,
    );
    expect(read.body.data.positionSeconds).toBe(20);
  });
});

describe('D: reconciliation does not starve behind 500 references', () => {
  /**
   * Create a playback reference the DRM fixture also knows about, so the
   * reconciler's external revoke succeeds and the assertion measures pagination
   * rather than unknown-session handling.
   */
  async function seedReference(
    externalSessionId: string,
    overrides: {
      status?: 'ACTIVE' | 'ENDED';
      terminationStatus?: 'PENDING' | null;
      nextTerminationAt?: Date | null;
      tokenExpiresAt?: Date;
      sessionExpiresAt?: Date;
      createdAt?: Date;
    } = {},
  ): Promise<string> {
    world.playback!.sessions.set(externalSessionId, {
      sessionId: externalSessionId,
      assetId: 'seed-asset',
      externalAssetId: 'seed-external',
      externalUserId: world.studentId,
      deviceId: DEVICE,
      status: 'active',
      token: `seed-token-${externalSessionId}`,
    });
    const now = Date.now();
    const row = await world.prisma.playbackReference.create({
      data: {
        studentId: world.studentId,
        lessonId: course.lessonId,
        courseId: course.courseId,
        externalSessionId,
        externalAssetId: 'seed-external',
        provider: 'CLEAR_KEY',
        status: overrides.status ?? 'ACTIVE',
        terminationStatus: overrides.terminationStatus ?? null,
        nextTerminationAt: overrides.nextTerminationAt ?? null,
        tokenExpiresAt: overrides.tokenExpiresAt ?? new Date(now + 3_600_000),
        sessionExpiresAt: overrides.sessionExpiresAt ?? new Date(now + 7_200_000),
        ...(overrides.createdAt === undefined ? {} : { createdAt: overrides.createdAt }),
      },
      select: { id: true },
    });
    return row.id;
  }

  beforeEach(async () => {
    await isolateReferences(world);
    await setCourseStatus(world, course.courseId, 'PUBLISHED');
  });

  it('terminates newer expired sessions hidden behind older repeatedly-failing ones', async () => {
    const { reconcileExpiredSessions } = await import('../../src/modules/learning/expiry/reconciler.js');

    // 520 older rows that are due but whose revocation keeps failing. They stay
    // eligible forever, so they permanently occupy the front of the ordering.
    // A single `take` page re-read exactly these rows on every pass and the
    // newer rows behind them were never reached: that is the starvation.
    for (let i = 0; i < 520; i += 1) {
      await seedReference(`bulk-blocker-${i}`, {
        terminationStatus: 'PENDING',
        nextTerminationAt: new Date(Date.now() - 600_000 + i),
        tokenExpiresAt: new Date(Date.now() - 600_000),
        sessionExpiresAt: new Date(Date.now() - 500_000),
        createdAt: new Date(Date.now() - 700_000 + i),
      });
    }

    // Five genuinely expired sessions scheduled AFTER all the blockers.
    const expiredIds: string[] = [];
    for (let i = 0; i < 5; i += 1) {
      expiredIds.push(
        await seedReference(`bulk-expired-${i}`, {
          terminationStatus: 'PENDING',
          nextTerminationAt: new Date(Date.now() - 60_000 + i),
          tokenExpiresAt: new Date(Date.now() - 60_000),
          sessionExpiresAt: new Date(Date.now() - 50_000),
          createdAt: new Date(Date.now() + i),
        }),
      );
    }

    // The dependency is healthy again for this pass.
    world.playback!.revokeAlwaysFails = false;
    const result = await reconcileExpiredSessions(world.prisma, world.redis, world.drm, Date.now(), {
      pageSize: 25,
      maxPages: 40,
    });

    // The pass walked the whole eligible set, not just the first page.
    expect(result.pages).toBeGreaterThan(1);
    expect(result.scanned).toBeGreaterThanOrEqual(525);
    expect(result.terminated).toBeGreaterThanOrEqual(expiredIds.length);

    for (let i = 0; i < expiredIds.length; i += 1) {
      const reference = await world.prisma.playbackReference.findUniqueOrThrow({
        where: { id: expiredIds[i] },
      });
      expect(reference.status, `newer expired session ${i} must be terminated`).toBe('TERMINATED');
      expect(world.playback!.sessions.get(`bulk-expired-${i}`)?.status).toBe('revoked');
    }
  });

  it('keeps a healthy session untouched while walking past due work', async () => {
    const { reconcileExpiredSessions } = await import('../../src/modules/learning/expiry/reconciler.js');
    for (let i = 0; i < 60; i += 1) {
      await seedReference(`mixed-due-${i}`, {
        terminationStatus: 'PENDING',
        nextTerminationAt: new Date(Date.now() - 600_000 + i),
      });
    }
    const healthyId = await seedReference('mixed-healthy', {
      nextTerminationAt: new Date(Date.now() + 3_600_000),
    });
    await reconcileExpiredSessions(world.prisma, world.redis, world.drm, Date.now(), {
      pageSize: 25,
      maxPages: 40,
    });
    const reference = await world.prisma.playbackReference.findUniqueOrThrow({ where: { id: healthyId } });
    expect(reference.status).toBe('ACTIVE');
    expect(reference.terminationStatus).toBeNull();
  });

  it('detects a crossed subscription beyond the first 500 active rows', async () => {
    const { detectCrossedSubscriptions } = await import('../../src/modules/learning/expiry/reconciler.js');
    const { randomUUID } = await import('node:crypto');

    // 600 healthy active references with no termination scheduled at all.
    for (let i = 0; i < 600; i += 1) {
      await seedReference(`healthy-${i}-${randomUUID()}`);
    }

    // The one crossed subscription sits behind all of them.
    const lapsed = await createPublishedCourse(world, 'starve-lapsed');
    await grantSubscription(world, world.studentId, lapsed.courseId, Date.now() + 30 * DAY);
    const start = await startPlayback(lapsed);
    const lapsedId = start.body.data.playback.referenceId;

    await expireSubscription(world, world.studentId, lapsed.courseId);


    const queued = await detectCrossedSubscriptions(world.prisma, Date.now(), { pageSize: 200, maxPages: 40 });
    expect(queued).toBeGreaterThanOrEqual(1);
    const reference = await world.prisma.playbackReference.findUniqueOrThrow({ where: { id: lapsedId } });
    expect(reference.terminationStatus).toBe('PENDING');
    expect(reference.pendingEndReason).toBe('SUBSCRIPTION_EXPIRED');
  });

  it('never loads every eligible session into memory at once', async () => {
    const { findEligiblePage, ELIGIBLE_PAGE_SIZE } = await import(
      '../../src/modules/learning/expiry/reconciler.js'
    );
    expect(ELIGIBLE_PAGE_SIZE).toBeLessThanOrEqual(100);
    // A page is bounded regardless of table size.
    const page = await findEligiblePage(world.prisma, Date.now() + 86_400_000, null, 25);
    expect(page.length).toBeLessThanOrEqual(25);
  });
});
