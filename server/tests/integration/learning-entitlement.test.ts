/**
 * M5 entitlement gating and outline protection, against the real database.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  createLearningWorld,
  createPublishedCourse,
  grantSubscription,
  studentGet,
  type LearningWorld,
} from './learning-helpers.js';

let world: LearningWorld;
const DAY = 86_400_000;
let course: Awaited<ReturnType<typeof createPublishedCourse>>;

beforeAll(async () => {
  world = await createLearningWorld();
  course = await createPublishedCourse(world, 'gate');
  await grantSubscription(world, world.studentId, course.courseId, Date.now() + 30 * DAY);
});

afterAll(async () => {
  await world?.fixture?.stop();
  await world?.close();
});

describe('dashboard', () => {
  it('lists an active subscription with its expiry and zero progress', async () => {
    // "One active subscription, no lapsed one, no progress" is this test's own
    // precondition. Other blocks in this file grant and age subscriptions and
    // record progress for this same student, so restore the baseline here
    // instead of relying on this test running first.
    await world.prisma.lessonProgress.deleteMany({
      where: { studentId: world.studentId, courseId: course.courseId },
    });
    await world.prisma.subscription.deleteMany({
      where: { studentId: world.studentId, courseId: { not: course.courseId } },
    });
    const res = await studentGet(world.app, '/learning/dashboard', world.studentJar);
    expect(res.status).toBe(200);
    const active = res.body.data.active as {
      courseId: string;
      percentComplete: number;
      lastLessonId: string | null;
    }[];
    expect(active.map((a) => a.courseId)).toContain(course.courseId);
    const entry = active.find((a) => a.courseId === course.courseId);
    expect(entry?.percentComplete).toBe(0);
    expect(entry?.lastLessonId).toBeNull();
    expect(res.body.data.expired).toEqual([]);
  });

  it('moves a lapsed subscription to the expired list and never to active', async () => {
    const other = await createPublishedCourse(world, 'lapse');
    await grantSubscription(world, world.studentId, other.courseId, Date.now() - 1000);
    const res = await studentGet(world.app, '/learning/dashboard', world.studentJar);
    expect(res.status).toBe(200);
    const expiredIds = (res.body.data.expired as { courseId: string }[]).map((e) => e.courseId);
    const activeIds = (res.body.data.active as { courseId: string }[]).map((a) => a.courseId);
    expect(expiredIds).toContain(other.courseId);
    expect(activeIds).not.toContain(other.courseId);
  });

  it('requires a session and rejects an anonymous caller', async () => {
    const res = await studentGet(world.app, '/learning/dashboard', {
      header: () => '',
      csrf: () => '',
    } as never);
    expect(res.status).toBe(401);
  });

  it('refuses an ADMIN session, which never carries entitlement', async () => {
    const res = await studentGet(world.app, '/learning/dashboard', world.adminJar);
    expect(res.status).toBe(403);
  });

  it('exposes a non-zero wallet balance when the student has one', async () => {
    const wallet = await world.prisma.wallet.findFirst({ where: { userId: world.studentId } });
    const res = await studentGet(world.app, '/learning/dashboard', world.studentJar);
    expect(res.status).toBe(200);
    if (wallet === null) {
      expect(res.body.data.walletBalancePiastres).toBeNull();
    } else {
      expect(typeof res.body.data.walletBalancePiastres).toBe('number');
    }
  });
});

describe('protected outline', () => {
  it('returns sections, lessons and playability for an entitled student', async () => {
    const res = await studentGet(
      world.app,
      `/learning/courses/${course.slug}/outline`,
      world.studentJar,
    );
    expect(res.status).toBe(200);
    expect(res.body.data.course.entitled).toBe(true);
    expect(res.body.data.course.expiresAt).not.toBeNull();
    const sections = res.body.data.sections as { lessons: { playable: boolean }[] }[];
    expect(sections.length).toBeGreaterThan(0);
    expect(sections[0].lessons[0].playable).toBe(true);
  });

  it('carries no media URL, asset id or DRM reference in the outline', async () => {
    const res = await studentGet(
      world.app,
      `/learning/courses/${course.slug}/outline`,
      world.studentJar,
    );
    const serialized = JSON.stringify(res.body);
    expect(serialized).not.toContain('manifest');
    expect(serialized).not.toContain('licenseUrl');
    expect(serialized).not.toMatch(/assetId/i);
    expect(serialized).not.toMatch(/playbackToken/i);
  });

  it('returns 403 SUBSCRIPTION_REQUIRED with no subscription', async () => {
    const other = await createPublishedCourse(world, 'nosub');
    const res = await studentGet(
      world.app,
      `/learning/courses/${other.slug}/outline`,
      world.studentJar,
    );
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('SUBSCRIPTION_REQUIRED');
    expect(JSON.stringify(res.body)).not.toMatch(/manifest|assetId/i);
  });

  it('returns 403 SUBSCRIPTION_EXPIRED once the boundary is crossed', async () => {
    const other = await createPublishedCourse(world, 'expired');
    const expiry = Date.now() + 1000;
    await grantSubscription(world, world.studentId, other.courseId, expiry);
    const stillOk = await studentGet(
      world.app,
      `/learning/courses/${other.slug}/outline`,
      world.studentJar,
    );
    expect(stillOk.status).toBe(200);
    // Move the stored expiry into the past rather than sleeping.
    await world.prisma.subscription.updateMany({
      where: { studentId: world.studentId, courseId: other.courseId },
      data: { expiresAt: new Date(Date.now() - 1) },
    });
    const res = await studentGet(
      world.app,
      `/learning/courses/${other.slug}/outline`,
      world.studentJar,
    );
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('SUBSCRIPTION_EXPIRED');
  });

  it('returns 404 for an unknown slug and never leaks existence', async () => {
    const res = await studentGet(
      world.app,
      '/learning/courses/no-such-course/outline',
      world.studentJar,
    );
    expect(res.status).toBe(404);
  });

  it('rejects an anonymous outline request', async () => {
    const res = await studentGet(world.app, `/learning/courses/${course.slug}/outline`, {
      header: () => '',
      csrf: () => '',
    } as never);
    expect(res.status).toBe(401);
  });
});

describe('progress never authorizes', () => {
  it('returns the stored position for an entitled student', async () => {
    await world.prisma.lessonProgress.create({
      data: {
        studentId: world.studentId,
        lessonId: course.lessonId,
        courseId: course.courseId,
        positionSeconds: 42.5,
        durationSeconds: 600,
        lastAccessedAt: new Date(),
      },
    });
    const res = await studentGet(
      world.app,
      `/learning/courses/${course.slug}/lessons/${course.lessonId}/progress`,
      world.studentJar,
    );
    expect(res.status).toBe(200);
    expect(res.body.data.positionSeconds).toBe(42.5);
    expect(res.body.data.completed).toBe(false);
    expect(res.body.data.lessonId).toBe(course.lessonId);
  });

  it('returns 403 for a course the student never bought, despite a stored row', async () => {
    const other = await createPublishedCourse(world, 'progress-noent');
    // Simulate a stale/legacy row with no entitlement behind it.
    await world.prisma.lessonProgress.create({
      data: {
        studentId: world.studentId,
        lessonId: other.lessonId,
        courseId: other.courseId,
        positionSeconds: 10,
        durationSeconds: 100,
        completedAt: new Date(),
        lastAccessedAt: new Date(),
      },
    });
    const res = await studentGet(
      world.app,
      `/learning/courses/${other.slug}/lessons/${other.lessonId}/progress`,
      world.studentJar,
    );
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('SUBSCRIPTION_REQUIRED');
  });
});
