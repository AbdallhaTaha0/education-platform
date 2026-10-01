/**
 * Integration world for M5 protected learning.
 *
 * Builds a real published course with a real READY media mapping against the
 * labeled HTTP DRM fixture, then grants or expires a subscription directly in
 * the database so the entitlement boundary can be tested at an exact instant.
 */
import type { Express } from 'express';
import { DrmFixture } from '../fixtures/drmFixture.js';
import { DrmPlaybackFixture } from '../fixtures/drmPlaybackFixture.js';
import { createCatalogWorld, adminPost, type CatalogWorld } from './catalog-helpers.js';
import { createDrmClient, type DrmClient } from '../../src/modules/catalog/drmClient.js';
import { TEST_ORIGIN, uniqueIp, type Jar } from './identity-helpers.js';
import request from 'supertest';

export const ASSERTION_SECRET = 'm5-assertion-secret-that-is-long-enough-0123456789';
export const ASSERTION_ISSUER = 'https://platform.test.internal';
export const ASSERTION_AUDIENCE = 'edu-drm-fixture';

export interface LearningWorld extends CatalogWorld {
  fixture: DrmFixture;
  playback: DrmPlaybackFixture;
  /** Client instance the expiry reconciler is driven with in tests. */
  drm: DrmClient;
  adminJar: Jar;
  studentJar: Jar;
  studentId: string;
}

export interface PublishedCourse {
  courseId: string;
  sectionId: string;
  lessonId: string;
  /** Every lesson in the course, in position order. Lessons are addressed by id. */
  lessonIds: string[];
  slug: string;
}

export async function createLearningWorld(): Promise<LearningWorld> {
  // The DRM public origin is the fixture itself, so the relative manifest and
  // license URLs it returns resolve back to the same server. The fixture must
  // be started before the app config is frozen.
  const fixture = new DrmFixture();
  await fixture.start();
  const playback = fixture.enablePlayback({
    expectedSecret: ASSERTION_SECRET,
    expectedIssuer: ASSERTION_ISSUER,
    expectedAudience: ASSERTION_AUDIENCE,
  });
  const world = await createCatalogWorld(fixture, {
    drmAssertionIssuer: ASSERTION_ISSUER,
    drmAssertionAudience: ASSERTION_AUDIENCE,
    // Explicitly labeled test-only fixture mode. Real DRM accepts RS256/JWKS.
    drmAssertionAlgorithm: 'HS256',
    drmAssertionSigningKey: ASSERTION_SECRET,
    drmAssertionMaxLifetimeSec: 120,
    drmPublicBaseUrl: fixture.url,
  });
  const student = await world.prisma.user.findUniqueOrThrow({
    where: { id: world.studentUser.id },
  });
  const out = world as LearningWorld;
  out.playback = playback;
  out.studentId = student.id;
  const drm = createDrmClient(world.config);
  if (drm === null) throw new Error('fixture DRM client could not be created');
  out.drm = drm;
  return out;
}

/** Register media for a lesson and drive the fixture asset to READY. */
export async function makeLessonPlayable(
  world: LearningWorld,
  courseId: string,
  lessonId: string,
): Promise<{ externalAssetId: string }> {
  const reg = await adminPost(
    world.app,
    `/admin/catalog/lessons/${lessonId}/media`,
    world.adminJar,
    {
      contentType: 'video/mp4',
      securityTier: 'STANDARD',
    },
  );
  if (reg.status !== 201)
    throw new Error(`media register failed ${reg.status} ${JSON.stringify(reg.body)}`);
  const complete = await adminPost(
    world.app,
    `/admin/catalog/lessons/${lessonId}/media/complete`,
    world.adminJar,
    {},
  );
  if (complete.status !== 200) throw new Error(`media complete failed ${complete.status}`);
  const mapping = await world.prisma.mediaMapping.findFirstOrThrow({ where: { lessonId } });
  world.fixture!.markReady(mapping.assetId as string);
  const sync = await adminPost(
    world.app,
    `/admin/catalog/lessons/${lessonId}/media/sync`,
    world.adminJar,
    {},
  );
  if (sync.status !== 200) throw new Error(`media sync failed ${sync.status}`);
  const internal = world.fixture!.assets.get(mapping.assetId as string);
  if (!internal) throw new Error('fixture asset missing');
  return { externalAssetId: internal.externalAssetId };
}

/** Create, register, sync and publish a course with one playable lesson. */
export async function createPublishedCourse(
  world: LearningWorld,
  suffix: string,
  options: { extraLessons?: number } = {},
): Promise<PublishedCourse> {
  const slug = `m5-${Date.now().toString(36)}-${suffix}`
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '')
    .slice(0, 60);
  const created = await adminPost(world.app, '/admin/catalog/courses', world.adminJar, {
    slug,
    titleAr: 'دورة محمية',
    titleEn: 'Protected course',
    descriptionAr: 'وصف',
    descriptionEn: 'Desc',
  });
  if (created.status !== 201) throw new Error(`course create failed ${created.status}`);
  const courseId = created.body.data.course.id as string;
  await adminPost(world.app, `/admin/catalog/courses/${courseId}/plans`, world.adminJar, {
    currentPricePiastres: 60000,
    previousPricePiastres: 90000,
    durationDays: 90,
  });
  const section = await adminPost(
    world.app,
    `/admin/catalog/courses/${courseId}/sections`,
    world.adminJar,
    {
      titleAr: 'قسم',
      titleEn: 'Section',
    },
  );
  const sectionId = section.body.data.section.id as string;
  const lesson = await adminPost(
    world.app,
    `/admin/catalog/sections/${sectionId}/lessons`,
    world.adminJar,
    {
      titleAr: 'درس',
      titleEn: 'Lesson',
    },
  );
  const lessonId = lesson.body.data.lesson.id as string;
  await makeLessonPlayable(world, courseId, lessonId);
  const lessonIds = [lessonId];
  for (let i = 0; i < (options.extraLessons ?? 0); i += 1) {
    const extra = await adminPost(
      world.app,
      `/admin/catalog/sections/${sectionId}/lessons`,
      world.adminJar,
      {
        titleAr: `درس ${i + 2}`,
        titleEn: `Lesson ${i + 2}`,
      },
    );
    const extraId = extra.body.data.lesson.id as string;
    await makeLessonPlayable(world, courseId, extraId);
    lessonIds.push(extraId);
  }
  await adminPost(world.app, `/admin/catalog/courses/${courseId}/transitions`, world.adminJar, {
    to: 'PROCESSING',
  });
  await adminPost(world.app, `/admin/catalog/courses/${courseId}/transitions`, world.adminJar, {
    to: 'READY',
  });
  await adminPost(world.app, `/admin/catalog/courses/${courseId}/transitions`, world.adminJar, {
    to: 'PUBLISHED',
  });
  const row = await world.prisma.course.findUniqueOrThrow({ where: { id: courseId } });
  return { courseId, sectionId, lessonId, lessonIds, slug: row.slug };
}
/**
 * Grant a subscription with an exact expiry instant.
 *
 * A real Purchase row backs it, because the M4 schema requires the link; the
 * entitlement rule under test reads Subscription.expiresAt only.
 */
export async function grantSubscription(
  world: LearningWorld,
  studentId: string,
  courseId: string,
  expiresAtMs: number,
): Promise<void> {
  const plan = await world.prisma.subscriptionPlan.findFirstOrThrow({ where: { courseId } });
  const purchase = await world.prisma.purchase.create({
    data: {
      studentId,
      planId: plan.id,
      courseId,
      pricePiastres: plan.currentPricePiastres,
      durationDays: plan.durationDays,
      idempotencyKey: `m5-${courseId}-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6)}`,
    },
  });
  await world.prisma.subscription.create({
    data: {
      studentId,
      courseId,
      purchaseId: purchase.id,
      startsAt: new Date(expiresAtMs - 86_400_000),
      expiresAt: new Date(expiresAtMs),
    },
  });
}

export function studentGet(app: Express, path: string, jar: Jar) {
  return request(app).get(path).set('X-Forwarded-For', uniqueIp()).set('Cookie', jar.header());
}

/**
 * Move a subscription behind the current instant, keeping startsAt < expiresAt so
 * the accepted `Subscription_interval_check` constraint stays satisfied.
 */
export async function expireSubscription(
  world: LearningWorld,
  studentId: string,
  courseId: string,
): Promise<void> {
  const now = Date.now();
  await world.prisma.subscription.updateMany({
    where: { studentId, courseId },
    data: { startsAt: new Date(now - 2 * 86_400_000), expiresAt: new Date(now - 1_000) },
  });
}

/**
 * Move a course to a lifecycle state directly, for the published-only learning
 * boundary. The public lifecycle route is the real path; this is the shortcut
 * for asserting the four non-releasable states.
 */
export async function setCourseStatus(
  world: LearningWorld,
  courseId: string,
  status: 'DRAFT' | 'PROCESSING' | 'READY' | 'PUBLISHED' | 'ARCHIVED',
): Promise<void> {
  await world.prisma.course.update({ where: { id: courseId }, data: { status } });
}

/** Retire every playback reference so a reconciliation batch contains only the
 * one a test creates. The reconciler takes a bounded batch and these tests
 * assert exact counts, so they must not inherit rows from other cases in the
 * shared database.
 */
export async function isolateReferences(world: LearningWorld, keepId?: string): Promise<void> {
  await world.prisma.playbackReference.updateMany({
    where:
      keepId === undefined
        ? { status: { in: ['ACTIVE', 'ENDED'] } }
        : { id: { not: keepId }, status: { in: ['ACTIVE', 'ENDED'] } },
    data: {
      status: 'TERMINATED',
      terminationStatus: 'COMPLETED',
      pendingEndReason: null,
      nextTerminationAt: null,
      // The schema requires an end instant for any non-active status.
      endedAt: new Date(),
    },
  });
}

export function studentPost(
  app: Express,
  path: string,
  jar: Jar,
  body: Record<string, unknown> = {},
  options: { withOrigin?: boolean; withCsrf?: boolean } = {},
) {
  const req = request(app)
    .post(path)
    .set('X-Forwarded-For', uniqueIp())
    .set('Cookie', jar.header());
  if (options.withOrigin !== false) req.set('Origin', TEST_ORIGIN);
  if (options.withCsrf !== false) req.set('X-Csrf-Token', jar.csrf());
  return req.send(body);
}
