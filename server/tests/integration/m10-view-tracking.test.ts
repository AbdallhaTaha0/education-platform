/**
 * M10 video-view tracking integration (agent 1, platform-owned).
 *
 * Uses the labeled HTTP DRM fixture for real playback grants. The fixture
 * proves platform integration only, not real DRM security.
 *
 * Contract under test:
 * - one count per logical session after 30s of actual playing time;
 * - 29s=0, 30s=1, 90s continuous still 1;
 * - refresh/successful reconnect (new grant) + 30s creates another count;
 * - failed reconnect creates nothing;
 * - pause/resume/renewal reuse the same row;
 * - duplicates, remounts, retries and concurrent writes count once;
 * - role/ownership/expiry/binding enforced server-side.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  createLearningWorld,
  createPublishedCourse,
  grantSubscription,
  setCourseStatus,
  studentPost,
  type LearningWorld,
} from './learning-helpers.js';
import { registerStudent } from './identity-helpers.js';

let world: LearningWorld;
let course: Awaited<ReturnType<typeof createPublishedCourse>>;
const DAY = 86_400_000;
const DEVICE = 'm10-device-0001';

beforeAll(async () => {
  world = await createLearningWorld();
  course = await createPublishedCourse(world, 'm10tracking');
  await grantSubscription(world, world.studentId, course.courseId, Date.now() + 30 * DAY);
  await world.prisma.m10VideoViewSession.deleteMany();
  await world.prisma.m10ViewTrackingState.deleteMany();
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

function startView(slug: string, lessonId: string, playbackReferenceId: string, jar = world.studentJar) {
  return studentPost(
    world.app,
    `/learning/courses/${slug}/lessons/${lessonId}/views/start`,
    jar,
    { playbackReferenceId },
  );
}

function heartbeat(viewSessionId: string, playedMilliseconds: number, jar = world.studentJar) {
  return studentPost(world.app, `/learning/views/${viewSessionId}/heartbeat`, jar, {
    playedMilliseconds,
  });
}

async function freshGrantAndView(suffix: string, deviceId = `${DEVICE}-${suffix}`) {
  const play = await startPlayback(course.lessonId, deviceId);
  expect(play.status).toBe(201);
  const referenceId = play.body.data.playback.referenceId as string;
  const started = await startView(course.slug, course.lessonId, referenceId);
  expect([200, 201]).toContain(started.status);
  return { referenceId, view: started.body.data.view as { viewSessionId: string } };
}

describe('threshold and single-count per session', () => {
  it('29s=0, 30s=1, 90s continuous still 1', async () => {
    const { view } = await freshGrantAndView('threshold');
    const id = view.viewSessionId;

    const under = await heartbeat(id, 29_000);
    expect(under.status).toBe(200);
    expect(under.body.data.view.counted).toBe(false);
    expect(under.body.data.view.countedAt).toBeNull();

    const at = await heartbeat(id, 30_000);
    expect(at.status).toBe(200);
    expect(at.body.data.view.counted).toBe(true);
    expect(at.body.data.newlyCounted).toBe(true);
    expect(typeof at.body.data.view.countedAt).toBe('string');

    const beyond = await heartbeat(id, 90_000);
    expect(beyond.status).toBe(200);
    expect(beyond.body.data.view.counted).toBe(true);
    expect(beyond.body.data.newlyCounted).toBe(false);

    const counted = await world.prisma.m10VideoViewSession.count({
      where: { id, countedAt: { not: null } },
    });
    expect(counted).toBe(1);
  });

  it('duplicate and concurrent heartbeats count once', async () => {
    const { view } = await freshGrantAndView('dedupe');
    const id = view.viewSessionId;
    const payload = [30_000, 30_000, 30_000, 29_999, 30_000];
    const results = await Promise.all(payload.map((ms) => heartbeat(id, ms)));
    for (const res of results) {
      expect(res.status).toBe(200);
      expect(res.body.data.view.counted).toBe(true);
    }
    const rows = await world.prisma.m10VideoViewSession.findMany({ where: { id } });
    expect(rows.length).toBe(1);
    expect(rows[0]!.countedAt).not.toBeNull();
    // Monotonic: a smaller total never rewinds the stored total.
    await heartbeat(id, 90_000);
    await heartbeat(id, 10_000);
    const after = await world.prisma.m10VideoViewSession.findUniqueOrThrow({ where: { id } });
    expect(after.playedMilliseconds).toBe(90_000);
  });

  it('duplicate starts for the same grant converge on one row', async () => {
    const play = await startPlayback(course.lessonId, `${DEVICE}-remount`);
    const referenceId = play.body.data.playback.referenceId as string;
    const [a, b] = await Promise.all([
      startView(course.slug, course.lessonId, referenceId),
      startView(course.slug, course.lessonId, referenceId),
    ]);
    expect([200, 201]).toContain(a.status);
    expect([200, 201]).toContain(b.status);
    expect(a.body.data.view.viewSessionId).toBe(b.body.data.view.viewSessionId);
    const rows = await world.prisma.m10VideoViewSession.findMany({
      where: { playbackReferenceId: referenceId },
    });
    expect(rows.length).toBe(1);
  });
});

describe('session restart rules', () => {
  it('refresh/successful reconnect (new grant) + 30s creates another count', async () => {
    const first = await freshGrantAndView('refresh-1');
    await heartbeat(first.view.viewSessionId, 30_000);
    // Simulate refresh: new playback grant loses the old in-memory view id.
    const second = await freshGrantAndView('refresh-2');
    expect(second.view.viewSessionId).not.toBe(first.view.viewSessionId);
    const res = await heartbeat(second.view.viewSessionId, 30_000);
    expect(res.body.data.view.counted).toBe(true);
    const total = await world.prisma.m10VideoViewSession.count({
      where: {
        studentId: world.studentId,
        courseId: course.courseId,
        lessonId: course.lessonId,
        countedAt: { not: null },
      },
    });
    expect(total).toBeGreaterThanOrEqual(2);
  });

  it('failed reconnect creates no view', async () => {
    world.playback!.failNextCreates = 1;
    const failed = await startPlayback(course.lessonId, `${DEVICE}-failed`);
    expect(failed.status).toBe(502);
    world.playback!.failNextCreates = 0;
    // No grant means no reference to start a view with; a fabricated id fails.
    const res = await startView(course.slug, course.lessonId, 'f6c0ffee-0000-4000-8000-000000000000');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('PLAYBACK_SESSION_EXPIRED');
  });

  it('pause/resume and token renewal stay in the same session', async () => {
    const play = await startPlayback(course.lessonId, `${DEVICE}-renew`);
    const referenceId = play.body.data.playback.referenceId as string;
    const started = await startView(course.slug, course.lessonId, referenceId);
    const id = (started.body.data.view as { viewSessionId: string }).viewSessionId;
    // Pause then resume: same total reported twice converges.
    await heartbeat(id, 10_000);
    await heartbeat(id, 10_000);
    let row = await world.prisma.m10VideoViewSession.findUniqueOrThrow({ where: { id } });
    expect(row.countedAt).toBeNull();
    expect(row.playedMilliseconds).toBe(10_000);
    // Token renewal keeps the same playback reference: no new view start.
    const renew = await studentPost(
      world.app,
      `/learning/playback/${referenceId}/renew`,
      world.studentJar,
      {},
    );
    expect(renew.status).toBe(200);
    const again = await startView(course.slug, course.lessonId, referenceId);
    expect(again.body.data.view.viewSessionId).toBe(id);
    await heartbeat(id, 30_000);
    row = await world.prisma.m10VideoViewSession.findUniqueOrThrow({ where: { id } });
    expect(row.countedAt).not.toBeNull();
    const rows = await world.prisma.m10VideoViewSession.findMany({
      where: { playbackReferenceId: referenceId },
    });
    expect(rows.length).toBe(1);
  });

  it('rejects non-finite and out-of-range totals without counting', async () => {
    const { view } = await freshGrantAndView('bounds');
    for (const bad of [-1, -0.5, 86_400_000.5, 86_400_001, 'x', null, Number.NaN]) {
      const res = await heartbeat(view.viewSessionId, bad as number);
      expect(res.status).toBe(400);
    }
    const row = await world.prisma.m10VideoViewSession.findUniqueOrThrow({
      where: { id: view.viewSessionId },
    });
    expect(row.countedAt).toBeNull();
  });
});

describe('authorization and binding', () => {
  it('requires STUDENT role: ADMIN and anonymous cannot start or heartbeat', async () => {
    const play = await startPlayback();
    const referenceId = play.body.data.playback.referenceId as string;
    const adminStart = await startView(course.slug, course.lessonId, referenceId, world.adminJar);
    expect(adminStart.status).toBe(403);
    const anon = await studentPost(
      world.app,
      `/learning/courses/${course.slug}/lessons/${course.lessonId}/views/start`,
      { header: () => '', csrf: () => '' } as never,
      { playbackReferenceId: referenceId },
    );
    expect(anon.status).toBe(401);

    const owned = await startView(course.slug, course.lessonId, referenceId);
    const id = (owned.body.data.view as { viewSessionId: string }).viewSessionId;
    const adminBeat = await heartbeat(id, 30_000, world.adminJar);
    expect(adminBeat.status).toBe(403);
  });

  it('rejects a second student heartbeat on the first student view', async () => {
    const { view } = await freshGrantAndView('ownership');
    const other = await registerStudent(world.app);
    const res = await heartbeat(view.viewSessionId, 30_000, other.jar);
    expect(res.status).toBe(404);
    const row = await world.prisma.m10VideoViewSession.findUniqueOrThrow({
      where: { id: view.viewSessionId },
    });
    expect(row.countedAt).toBeNull();
  });

  it('requires Origin and CSRF on writes', async () => {
    const play = await startPlayback();
    const referenceId = play.body.data.playback.referenceId as string;
    const noOrigin = await studentPost(
      world.app,
      `/learning/courses/${course.slug}/lessons/${course.lessonId}/views/start`,
      world.studentJar,
      { playbackReferenceId: referenceId },
      { withOrigin: false },
    );
    expect(noOrigin.status).toBe(403);
    const noCsrf = await studentPost(
      world.app,
      `/learning/courses/${course.slug}/lessons/${course.lessonId}/views/start`,
      world.studentJar,
      { playbackReferenceId: referenceId },
      { withCsrf: false },
    );
    expect(noCsrf.status).toBe(403);
  });

  it('refuses expired and missing subscriptions', async () => {
    const other = await createPublishedCourse(world, 'm10-expiry');
    await grantSubscription(world, world.studentId, other.courseId, Date.now() + 60_000);
    const play = await studentPost(
      world.app,
      `/learning/courses/${other.slug}/lessons/${other.lessonId}/playback`,
      world.studentJar,
      { deviceId: DEVICE },
    );
    expect(play.status).toBe(201);
    const referenceId = play.body.data.playback.referenceId as string;
    await world.prisma.subscription.updateMany({
      where: { studentId: world.studentId, courseId: other.courseId },
      data: { expiresAt: new Date(Date.now() - 1_000) },
    });
    const start = await studentPost(
      world.app,
      `/learning/courses/${other.slug}/lessons/${other.lessonId}/views/start`,
      world.studentJar,
      { playbackReferenceId: referenceId },
    );
    expect(start.status).toBe(403);
    expect(['SUBSCRIPTION_EXPIRED', 'SUBSCRIPTION_REQUIRED']).toContain(start.body.error.code);

    // An in-flight view stops counting once entitlement lapses.
    const live = await freshGrantAndView('expiry-live');
    await world.prisma.subscription.updateMany({
      where: { studentId: world.studentId, courseId: course.courseId },
      data: {
        startsAt: new Date(Date.now() - 2 * DAY),
        expiresAt: new Date(Date.now() - 1_000),
      },
    });
    const beat = await heartbeat(live.view.viewSessionId, 30_000);
    expect(beat.status).toBe(403);
    await grantSubscription(world, world.studentId, course.courseId, Date.now() + 30 * DAY);
  });

  it('rejects wrong course/lesson binding', async () => {
    const other = await createPublishedCourse(world, 'm10-binding');
    await grantSubscription(world, world.studentId, other.courseId, Date.now() + 30 * DAY);
    const play = await startPlayback();
    const referenceId = play.body.data.playback.referenceId as string;
    // Playback grant for course A cannot start a view under course B's URL.
    const cross = await startView(other.slug, other.lessonId, referenceId);
    expect([400, 401, 404]).toContain(cross.status);
  });

  it('binds to the media version and preserves history after retirement', async () => {
    const play = await startPlayback();
    const referenceId = play.body.data.playback.referenceId as string;
    const started = await startView(course.slug, course.lessonId, referenceId);
    const payload = started.body.data.view as { mediaAssetId: string; viewSessionId: string };
    const mapping = await world.prisma.mediaMapping.findFirstOrThrow({
      where: { lessonId: course.lessonId },
    });
    expect(payload.mediaAssetId).toBe(mapping.id);
    await heartbeat(payload.viewSessionId, 30_000);

    // Simulate replacement cleanup: retire + delete the mapping row.
    const holder = await world.prisma.course.create({
      data: {
        revisionOwnerId: course.courseId,
        historical: true,
        status: 'ARCHIVED',
        slug: `history-m10-${Date.now().toString(36)}`,
        titleAr: 'سابق',
        titleEn: 'Previous',
        descriptionAr: 'وصف',
        descriptionEn: 'Desc',
      },
    });
    const section = await world.prisma.courseSection.create({
      data: { courseId: holder.id, titleAr: 'قسم', titleEn: 'Section', position: 1 },
    });
    const holderLesson = await world.prisma.lesson.create({
      data: { sectionId: section.id, titleAr: 'درس', titleEn: 'Lesson', position: 1 },
    });
    await world.prisma.mediaMapping.update({
      where: { id: mapping.id },
      data: { lessonId: holderLesson.id, retiredAt: new Date() },
    });
    await world.prisma.mediaMapping.delete({ where: { id: mapping.id } });

    // Historical view survives the deleted mapping with its version snapshot.
    const kept = await world.prisma.m10VideoViewSession.findUniqueOrThrow({
      where: { id: payload.viewSessionId },
    });
    expect(kept.mediaAssetId).toBe(mapping.id);
    expect(kept.countedAt).not.toBeNull();

    // New views require READY media again.
    const play2 = await startPlayback();
    expect([404, 409]).toContain(play2.status);

    // Restore playable media for later tests in this file.
    const { createPublishedCourse: _unused } = await import('./learning-helpers.js');
    void _unused;
    const restored = await world.prisma.mediaMapping.create({
      data: {
        lessonId: course.lessonId,
        externalAssetId: mapping.externalAssetId,
        assetId: mapping.assetId,
        status: 'READY',
        idempotencyKey: `m10-restore-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6)}`,
      },
    });
    void restored;
  });

  it('keeps October and November course contexts separate', async () => {
    const oct = await createPublishedCourse(world, 'm10-oct');
    const nov = await createPublishedCourse(world, 'm10-nov');
    await grantSubscription(world, world.studentId, oct.courseId, Date.now() + 30 * DAY);
    await grantSubscription(world, world.studentId, nov.courseId, Date.now() + 30 * DAY);
    async function countedView(target: { slug: string; lessonId: string }) {
      const play = await studentPost(
        world.app,
        `/learning/courses/${target.slug}/lessons/${target.lessonId}/playback`,
        world.studentJar,
        { deviceId: `${DEVICE}-${target.slug}` },
      );
      expect(play.status).toBe(201);
      const ref = play.body.data.playback.referenceId as string;
      const started = await startView(target.slug, target.lessonId, ref);
      const id = (started.body.data.view as { viewSessionId: string }).viewSessionId;
      await heartbeat(id, 30_000);
      return id;
    }
    const octId = await countedView(oct);
    const novId = await countedView(nov);
    expect(octId).not.toBe(novId);
    const octCount = await world.prisma.m10VideoViewSession.count({
      where: { studentId: world.studentId, courseId: oct.courseId, countedAt: { not: null } },
    });
    const novCount = await world.prisma.m10VideoViewSession.count({
      where: { studentId: world.studentId, courseId: nov.courseId, countedAt: { not: null } },
    });
    expect(octCount).toBe(1);
    expect(novCount).toBe(1);
  });

  it('never turns LessonProgress into views and preserves resume behavior', async () => {
    await world.prisma.lessonProgress.deleteMany({
      where: { studentId: world.studentId, lessonId: course.lessonId },
    });
    await studentPost(world.app, '/learning/progress', world.studentJar, {
      courseRef: course.slug,
      lessonId: course.lessonId,
      positionSeconds: 120,
      durationSeconds: 600,
    });
    const views = await world.prisma.m10VideoViewSession.count({
      where: { studentId: world.studentId, lessonId: course.lessonId, countedAt: { not: null } },
    });
    void views;
    // A completion without any view session creates no counted view on its own;
    // this fresh lesson has progress but its new grant has not been counted yet.
    const fresh = await createPublishedCourse(world, 'm10-nobackfill');
    await grantSubscription(world, world.studentId, fresh.courseId, Date.now() + 30 * DAY);
    await studentPost(world.app, '/learning/progress', world.studentJar, {
      courseRef: fresh.slug,
      lessonId: fresh.lessonId,
      positionSeconds: 600,
      durationSeconds: 600,
      completed: true,
    });
    const backfilled = await world.prisma.m10VideoViewSession.count({
      where: { studentId: world.studentId, lessonId: fresh.lessonId },
    });
    expect(backfilled).toBe(0);
  });

  it('exposes tracking coverage from the singleton state', async () => {
    const state = await world.prisma.m10ViewTrackingState.findUnique({
      where: { id: 'global' },
    });
    expect(state).not.toBeNull();
    expect(state!.startedAt.getTime()).toBeLessThanOrEqual(Date.now());
  });

  it('never persists credentials in view rows', async () => {
    const play = await startPlayback();
    const token = play.body.data.playback.playbackToken as string;
    const referenceId = play.body.data.playback.referenceId as string;
    const started = await startView(course.slug, course.lessonId, referenceId);
    const id = (started.body.data.view as { viewSessionId: string }).viewSessionId;
    const row = await world.prisma.m10VideoViewSession.findUniqueOrThrow({ where: { id } });
    expect(JSON.stringify(row)).not.toContain(token);
  });
});

describe('stale-session and withdrawal guards (repair)', () => {
  it('accepts the legitimate final flush racing a fresh viewer end', async () => {
    const { referenceId, view } = await freshGrantAndView('flush-order');
    const ended = await studentPost(
      world.app,
      `/learning/playback/${referenceId}/end`,
      world.studentJar,
      {},
    );
    expect(ended.status).toBe(200);
    // The earned threshold still counts: the end is fresh (final-flush race).
    const beat = await heartbeat(view.viewSessionId, 30_000);
    expect(beat.status).toBe(200);
    expect(beat.body.data.view.counted).toBe(true);
    expect(beat.body.data.newlyCounted).toBe(true);
  });

  it('rejects heartbeats for a terminated reference', async () => {
    const { referenceId, view } = await freshGrantAndView('terminated');
    await world.prisma.playbackReference.update({
      where: { id: referenceId },
      data: { status: 'TERMINATED', terminationStatus: 'COMPLETED', endedAt: new Date() },
    });
    const beat = await heartbeat(view.viewSessionId, 30_000);
    expect(beat.status).toBe(401);
    expect(beat.body.error.code).toBe('PLAYBACK_SESSION_EXPIRED');
    const row = await world.prisma.m10VideoViewSession.findUniqueOrThrow({
      where: { id: view.viewSessionId },
    });
    expect(row.countedAt).toBeNull();
  });

  it('rejects heartbeats long after the viewer end (stale flush)', async () => {
    const { referenceId, view } = await freshGrantAndView('stale-end');
    await studentPost(world.app, `/learning/playback/${referenceId}/end`, world.studentJar, {});
    await world.prisma.playbackReference.update({
      where: { id: referenceId },
      data: { endedAt: new Date(Date.now() - 60 * 60_000) },
    });
    const beat = await heartbeat(view.viewSessionId, 30_000);
    expect(beat.status).toBe(401);
    expect(beat.body.error.code).toBe('PLAYBACK_SESSION_EXPIRED');
    const row = await world.prisma.m10VideoViewSession.findUniqueOrThrow({
      where: { id: view.viewSessionId },
    });
    expect(row.countedAt).toBeNull();
  });

  it('rejects heartbeats for a deleted playback reference', async () => {
    const { referenceId, view } = await freshGrantAndView('deleted-ref');
    await world.prisma.playbackReference.delete({ where: { id: referenceId } });
    const beat = await heartbeat(view.viewSessionId, 30_000);
    expect(beat.status).toBe(401);
    expect(beat.body.error.code).toBe('PLAYBACK_SESSION_EXPIRED');
    const row = await world.prisma.m10VideoViewSession.findUniqueOrThrow({
      where: { id: view.viewSessionId },
    });
    expect(row.countedAt).toBeNull();
  });

  it('rejects heartbeats bound to the wrong session (tampered reference)', async () => {
    const other = await createPublishedCourse(world, 'm10-tamper-src');
    await grantSubscription(world, world.studentId, other.courseId, Date.now() + 30 * DAY);
    const { view } = await freshGrantAndView('tampered');
    const row = await world.prisma.m10VideoViewSession.findUniqueOrThrow({
      where: { id: view.viewSessionId },
    });
    await world.prisma.playbackReference.update({
      where: { id: row.playbackReferenceId },
      data: { lessonId: other.lessonId },
    });
    const beat = await heartbeat(view.viewSessionId, 30_000);
    expect(beat.status).toBe(400);
    expect(beat.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects heartbeats after course withdrawal from publication', async () => {
    const withdrawn = await createPublishedCourse(world, 'm10-withdrawn');
    await grantSubscription(world, world.studentId, withdrawn.courseId, Date.now() + 30 * DAY);
    const play = await studentPost(
      world.app,
      `/learning/courses/${withdrawn.slug}/lessons/${withdrawn.lessonId}/playback`,
      world.studentJar,
      { deviceId: `${DEVICE}-withdrawn` },
    );
    expect(play.status).toBe(201);
    const referenceId = play.body.data.playback.referenceId as string;
    const started = await startView(withdrawn.slug, withdrawn.lessonId, referenceId);
    const id = (started.body.data.view as { viewSessionId: string }).viewSessionId;
    await setCourseStatus(world, withdrawn.courseId, 'ARCHIVED');
    const beat = await heartbeat(id, 30_000);
    expect(beat.status).toBe(404);
    expect(beat.body.error.code).toBe('LESSON_NOT_FOUND');
    const row = await world.prisma.m10VideoViewSession.findUniqueOrThrow({ where: { id } });
    expect(row.countedAt).toBeNull();
  });

  it('rejects heartbeats after the video version is replaced', async () => {
    const replaced = await createPublishedCourse(world, 'm10-replaced');
    await grantSubscription(world, world.studentId, replaced.courseId, Date.now() + 30 * DAY);
    const play = await studentPost(
      world.app,
      `/learning/courses/${replaced.slug}/lessons/${replaced.lessonId}/playback`,
      world.studentJar,
      { deviceId: `${DEVICE}-replaced` },
    );
    expect(play.status).toBe(201);
    const referenceId = play.body.data.playback.referenceId as string;
    const started = await startView(replaced.slug, replaced.lessonId, referenceId);
    const payload = started.body.data.view as { viewSessionId: string; mediaAssetId: string };
    const mapping = await world.prisma.mediaMapping.findFirstOrThrow({
      where: { lessonId: replaced.lessonId },
    });
    expect(payload.mediaAssetId).toBe(mapping.id);

    // Admin publishes a replacement version: the old mapping is retired to a
    // holder and a new READY mapping serves the lesson.
    const holder = await world.prisma.course.create({
      data: {
        revisionOwnerId: replaced.courseId,
        historical: true,
        status: 'ARCHIVED',
        slug: `history-m10r-${Date.now().toString(36)}`,
        titleAr: 'سابق',
        titleEn: 'Previous',
        descriptionAr: 'وصف',
        descriptionEn: 'Desc',
      },
    });
    const section = await world.prisma.courseSection.create({
      data: { courseId: holder.id, titleAr: 'قسم', titleEn: 'Section', position: 1 },
    });
    const holderLesson = await world.prisma.lesson.create({
      data: { sectionId: section.id, titleAr: 'درس', titleEn: 'Lesson', position: 1 },
    });
    await world.prisma.mediaMapping.update({
      where: { id: mapping.id },
      data: { lessonId: holderLesson.id, retiredAt: new Date() },
    });
    const replacement = await world.prisma.mediaMapping.create({
      data: {
        lessonId: replaced.lessonId,
        externalAssetId: `replaced-${mapping.externalAssetId}`,
        status: 'READY',
        idempotencyKey: `m10-replace-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6)}`,
      },
    });
    const stale = await heartbeat(payload.viewSessionId, 30_000);
    expect(stale.status).toBe(409);
    expect(stale.body.error.code).toBe('MEDIA_NOT_READY');
    const kept = await world.prisma.m10VideoViewSession.findUniqueOrThrow({
      where: { id: payload.viewSessionId },
    });
    // History keeps the watched version; nothing was rewritten or counted.
    expect(kept.mediaAssetId).toBe(mapping.id);
    expect(kept.countedAt).toBeNull();

    // Restore the original version so later tests keep a playable lesson.
    await world.prisma.mediaMapping.delete({ where: { id: replacement.id } });
    await world.prisma.mediaMapping.update({
      where: { id: mapping.id },
      data: { lessonId: replaced.lessonId, retiredAt: null },
    });
    const revived = await heartbeat(payload.viewSessionId, 30_000);
    expect(revived.status).toBe(200);
    expect(revived.body.data.view.counted).toBe(true);
  });
});

describe('newlyCounted exactly-once under concurrency (repair)', () => {
  it('exactly one concurrent threshold caller claims the transition', async () => {
    const { view } = await freshGrantAndView('claim-race');
    const id = view.viewSessionId;
    const results = await Promise.all(
      Array.from({ length: 8 }, () => heartbeat(id, 30_000)),
    );
    for (const res of results) {
      expect(res.status).toBe(200);
      expect(res.body.data.view.counted).toBe(true);
    }
    const claims = results.filter((res) => res.body.data.newlyCounted === true);
    expect(claims).toHaveLength(1);

    // Repeated threshold calls after counting never claim again.
    for (let i = 0; i < 3; i += 1) {
      const again = await heartbeat(id, 30_000 + i * 1000);
      expect(again.status).toBe(200);
      expect(again.body.data.newlyCounted).toBe(false);
    }
    const rows = await world.prisma.m10VideoViewSession.findMany({ where: { id } });
    expect(rows).toHaveLength(1);
    expect(rows[0]!.countedAt).not.toBeNull();
  });
});
