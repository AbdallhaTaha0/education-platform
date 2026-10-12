import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import {
  createNoDrmLearningWorld,
  createPublishedCourse,
  grantSubscription,
  isolateReferences,
  studentPost,
  type NoDrmLearningWorld,
} from './learning-helpers.js';
import { registerStudent } from './identity-helpers.js';

let world: NoDrmLearningWorld;
let course: Awaited<ReturnType<typeof createPublishedCourse>>;
const DAY = 86_400_000;

beforeAll(async () => {
  world = await createNoDrmLearningWorld();
  course = await createPublishedCourse(world, 'no-drm-playback');
  await grantSubscription(world, world.studentId, course.courseId, Date.now() + 30 * DAY);
});

afterAll(async () => {
  await world?.fixture?.stop();
  await world?.close();
});

afterEach(async () => {
  if (world) await isolateReferences(world);
});

const start = (jar = world.studentJar, deviceId = 'no-drm-device-0001') =>
  studentPost(
    world.app,
    `/learning/courses/${course.slug}/lessons/${course.lessonId}/playback`,
    jar,
    { deviceId },
  );

describe('no-DRM playback with private object storage', () => {
  it('authorizes a subscriber, returns a short-lived signed URL, supports seeking, and denies unsigned access', async () => {
    const granted = await start();
    expect(granted.status).toBe(201);
    const playback = granted.body.data.playback;
    expect(playback.drmProvider).toBe('NONE');
    expect(playback.playbackToken).toBe('');
    expect(playback.licenseUrl).toBe('');
    const signed = new URL(playback.manifestUrl);
    expect(signed.searchParams.get('X-Amz-Expires')).toBe('300');
    expect(Date.parse(playback.sessionExpiresAt)).toBeGreaterThan(Date.parse(playback.tokenExpiresAt));
    expect(signed.searchParams.has('X-Amz-Signature')).toBe(true);

    const range = await fetch(signed, { headers: { Range: 'bytes=0-6' } });
    expect(range.status).toBe(206);
    expect(range.headers.get('content-range')).toMatch(/^bytes 0-6\//);
    expect(Buffer.from(await range.arrayBuffer()).toString()).toBe('disposa');

    signed.search = '';
    const unsigned = await fetch(signed);
    await unsigned.body?.cancel();
    expect([401, 403]).toContain(unsigned.status);

    const ended = await studentPost(world.app, `/learning/playback/${playback.referenceId}/end`, world.studentJar, {});
    expect(ended.status).toBe(200);
  });

  it('limits concurrent live playback references to two even under simultaneous starts', async () => {
    const results = await Promise.all([
      start(world.studentJar, 'no-drm-device-cap-1'),
      start(world.studentJar, 'no-drm-device-cap-2'),
      start(world.studentJar, 'no-drm-device-cap-3'),
    ]);
    expect(results.filter((result) => result.status === 201)).toHaveLength(2);
    const denied = results.find((result) => result.status === 403);
    expect(denied?.body.error.code).toBe('PLAYBACK_STREAM_LIMIT');
  });

  it('ends the reference when its video is no longer available', async () => {
    const first = await start(world.studentJar, 'no-drm-device-missing');
    expect(first.status).toBe(201);
    const referenceId = first.body.data.playback.referenceId as string;
    await world.prisma.mediaMapping.updateMany({
      where: { lessonId: course.lessonId },
      data: { status: 'FAILED' },
    });
    const denied = await studentPost(
      world.app,
      `/learning/playback/${referenceId}/renew`,
      world.studentJar,
      {},
    );
    await world.prisma.mediaMapping.updateMany({
      where: { lessonId: course.lessonId },
      data: { status: 'READY' },
    });
    expect(denied.status).toBe(401);
    expect(denied.body.error.code).toBe('PLAYBACK_SESSION_EXPIRED');
    const reference = await world.prisma.playbackReference.findUniqueOrThrow({
      where: { id: referenceId },
    });
    expect(reference.status).toBe('TERMINATED');
    expect(reference.terminationStatus).toBe('COMPLETED');
    expect(reference.pendingEndReason).toBeNull();
  });

  it('does not renew an idle reference after its one-hour lease expires', async () => {
    const first = await start(world.studentJar, 'no-drm-device-lease');
    expect(first.status).toBe(201);
    const referenceId = first.body.data.playback.referenceId as string;
    const now = Date.now();
    await world.prisma.playbackReference.update({
      where: { id: referenceId },
      data: {
        tokenExpiresAt: new Date(now - 60_000),
        sessionExpiresAt: new Date(now - 1),
      },
    });
    const denied = await studentPost(
      world.app,
      `/learning/playback/${referenceId}/renew`,
      world.studentJar,
      {},
    );
    expect(denied.status).toBe(401);
    const reference = await world.prisma.playbackReference.findUniqueOrThrow({
      where: { id: referenceId },
    });
    expect(reference.status).toBe('TERMINATED');
    expect(reference.terminationStatus).toBe('COMPLETED');
  });
  it('denies a different student without an active course subscription', async () => {
    const other = await registerStudent(world.app);
    const denied = await start(other.jar, 'no-drm-device-foreign');
    expect(denied.status).toBe(403);
    expect(denied.body.error.code).toBe('SUBSCRIPTION_REQUIRED');
  });

  it('rechecks entitlement when renewing a signed playback URL', async () => {
    const first = await start(world.studentJar, 'no-drm-device-renew');
    expect(first.status).toBe(201);
    const playback = first.body.data.playback;
    const renewed = await studentPost(world.app, `/learning/playback/${playback.referenceId}/renew`, world.studentJar, {});
    expect(renewed.status).toBe(200);
    expect(renewed.body.data.renewal.manifestUrl).toContain('X-Amz-Signature=');
    await world.prisma.subscription.updateMany({
      where: { studentId: world.studentId, courseId: course.courseId },
      data: { startsAt: new Date(Date.now() - 2 * DAY), expiresAt: new Date(Date.now() - 1000) },
    });
    const denied = await studentPost(world.app, `/learning/playback/${playback.referenceId}/renew`, world.studentJar, {});
    expect(denied.status).toBe(401);
    expect(denied.body.error.code).toBe('PLAYBACK_SESSION_EXPIRED');
    const reference = await world.prisma.playbackReference.findUnique({
      where: { id: playback.referenceId },
      select: { pendingEndReason: true },
    });
    expect(reference?.pendingEndReason).toBe('SUBSCRIPTION_EXPIRED');
  });
});
