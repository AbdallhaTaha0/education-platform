import { afterAll, beforeAll, expect, it } from 'vitest';
import {
  createLearningWorld,
  createPublishedCourse,
  grantSubscription,
  studentGet,
  studentPost,
  type LearningWorld,
} from './learning-helpers.js';
import { detectCrossedSubscriptions } from '../../src/modules/learning/expiry/reconciler.js';
import { recordExpiry, scanExpiries } from '../../src/modules/notifications/producers.js';
import { adminPost } from './catalog-helpers.js';
import { loadConfig } from '../../src/config.js';
import { reconcilePendingOperations } from '../../src/modules/catalog/deletion/reconciler.js';
let world: LearningWorld;
beforeAll(async () => {
  world = await createLearningWorld();
});
afterAll(async () => {
  await world?.fixture?.stop();
  await world?.close();
});
it('indefinite ownership permits protected playback and renewal but never bypasses publication or removal', async () => {
  const target = await createPublishedCourse(world, 'indefinite');
  await grantSubscription(world, world.studentId, target.courseId, Date.now() - 1000);
  await grantSubscription(world, world.studentId, target.courseId, Date.now() + 86400000);
  const newest = await world.prisma.subscription.findFirstOrThrow({
    where: { studentId: world.studentId, courseId: target.courseId },
    orderBy: { expiresAt: 'desc' },
  });
  await world.prisma.purchase.update({
    where: { id: newest.purchaseId! },
    data: { accessMode: 'UNTIL_REMOVAL', durationDays: null, accessEndsAt: null },
  });
  await world.prisma.subscription.update({ where: { id: newest.id }, data: { expiresAt: null } });
  const outline = await studentGet(
    world.app,
    `/learning/courses/${target.slug}/outline`,
    world.studentJar,
  );
  expect(outline.status).toBe(200);
  expect(outline.body.data.course.expiresAt).toBeNull();
  const playback = await studentPost(
    world.app,
    `/learning/courses/${target.slug}/lessons/${target.lessonId}/playback`,
    world.studentJar,
    { deviceId: 'm8-indefinite-device' },
  );
  expect(playback.status).toBe(201);
  const referenceId = playback.body.data.playback.referenceId;
  expect(
    (await studentPost(world.app, `/learning/playback/${referenceId}/renew`, world.studentJar, {}))
      .status,
  ).toBe(200);
  await detectCrossedSubscriptions(world.prisma, new Date('2090-01-01').getTime());
  expect(
    (await world.prisma.playbackReference.findUniqueOrThrow({ where: { id: referenceId } }))
      .terminationStatus,
  ).toBeNull();
  expect(
    await recordExpiry(world.prisma, world.studentId, target.courseId, () =>
      new Date('2090-01-01').getTime(),
    ),
  ).toBe(false);
  await scanExpiries(world.prisma, () => new Date('2090-01-01').getTime());
  expect(
    await world.prisma.notificationEvent.count({
      where: { courseId: target.courseId, type: 'SUBSCRIPTION_EXPIRED' },
    }),
  ).toBe(0);
  const dashboard = await studentGet(world.app, '/learning/dashboard', world.studentJar);
  expect(
    dashboard.body.data.active.find((c: { courseId: string }) => c.courseId === target.courseId),
  ).toMatchObject({ expiresAt: null, availableForLearning: true });
  await world.prisma.course.update({
    where: { id: target.courseId },
    data: { status: 'ARCHIVED' },
  });
  expect(
    (await studentGet(world.app, `/learning/courses/${target.slug}/outline`, world.studentJar))
      .status,
  ).toBe(404);
  await world.prisma.course.update({
    where: { id: target.courseId },
    data: { status: 'PUBLISHED', deletionRequestedAt: new Date() },
  });
  expect(
    (await studentGet(world.app, `/learning/courses/${target.slug}/outline`, world.studentJar))
      .status,
  ).toBe(404);
  await world.prisma.course.update({
    where: { id: target.courseId },
    data: { deletionRequestedAt: null },
  });
  const beforeRemoval = await studentGet(world.app, '/admin/catalog/summary', world.adminJar);
  const deletion = await adminPost(
    world.app,
    `/admin/catalog/courses/${target.courseId}/delete`,
    world.adminJar,
    { confirmation: target.slug },
  );
  expect(deletion.status).toBe(202);
  const config = {
    ...loadConfig(process.env),
    drmBaseUrl: world.fixture.url,
    drmClientId: world.fixture.expectedClientId,
    drmClientSecret: world.fixture.expectedClientSecret,
  };
  for (let i = 0; i < 8; i++) {
    await reconcilePendingOperations(world.prisma, config, () => world.drm, world.redis);
    if (
      (
        await world.prisma.catalogDeletionOperation.findUniqueOrThrow({
          where: { id: deletion.body.data.operation.id },
        })
      ).status === 'COMPLETED'
    )
      break;
  }
  expect(await world.prisma.course.findUnique({ where: { id: target.courseId } })).toBeNull();
  // Purchase and grant rows are retained as historical records; a missing
  // course is never learnable and must disappear from the current dashboard.
  expect(
    (await world.prisma.subscription.findUniqueOrThrow({ where: { id: newest.id } })).expiresAt,
  ).toBeNull();
  const afterRemoval = await studentGet(world.app, '/learning/dashboard', world.studentJar);
  expect(
    afterRemoval.body.data.active.some((c: { courseId: string }) => c.courseId === target.courseId),
  ).toBe(false);
  expect(
    (await world.prisma.purchase.findUniqueOrThrow({ where: { id: newest.purchaseId! } }))
      .accessMode,
  ).toBe('UNTIL_REMOVAL');
  const summary = await studentGet(world.app, '/admin/catalog/summary', world.adminJar);
  expect(summary.body.data.activeCourseAccess).toBe(beforeRemoval.body.data.activeCourseAccess - 1);
  expect(
    (await studentGet(world.app, `/learning/courses/${target.slug}/outline`, world.studentJar))
      .status,
  ).toBe(404);
});
