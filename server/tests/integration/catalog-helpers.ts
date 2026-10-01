import request from 'supertest';
import type { Express } from 'express';
import {
  createTestAdmin,
  createWorld,
  loginWith,
  registerStudent,
  uniqueEmail,
  TEST_ORIGIN,
  uniqueIp,
  type IdentityWorld,
} from './identity-helpers.js';
import { DrmFixture } from '../fixtures/drmFixture.js';

export interface CatalogWorld extends IdentityWorld {
  adminJar: import('./identity-helpers.js').Jar;
  adminUser: { id: string; email: string };
  studentJar: import('./identity-helpers.js').Jar;
  /** The student actually logged in as; the shared database holds other students. */
  studentUser: { id: string; email: string };
  fixture?: DrmFixture;
}

export interface CatalogWorldOptions {
  /**
   * Clear the catalog tables this world will use (default `true`).
   *
   * A world created *while a sibling world is still in use* must pass `false`:
   * the reset is global, so running it would delete the sibling's courses,
   * media, plans and progress out from under it.
   */
  resetSharedState?: boolean;
}

export async function createCatalogWorld(
  withFixture: DrmFixture | boolean = false,
  extraOverrides: Record<string, unknown> = {},
  options: CatalogWorldOptions = {},
): Promise<CatalogWorld> {
  let fixture: DrmFixture | undefined;
  let overrides: Record<string, unknown> = {};
  // A pre-started fixture lets a caller enable extra routes (e.g. playback)
  // and read its URL before the app config is frozen.
  if (withFixture === true) {
    fixture = new DrmFixture();
  } else if (typeof withFixture === 'object') {
    fixture = withFixture;
  }
  if (fixture !== undefined) {
    if (fixture.url === '') await fixture.start();
    overrides = {
      drmBaseUrl: fixture.url,
      drmClientId: fixture.expectedClientId,
      drmClientSecret: fixture.expectedClientSecret,
    };
  }
  Object.assign(overrides, extraOverrides);
  const world = await createWorld(overrides as never);
  if (options.resetSharedState !== false) {
    // Integration files share one disposable database and run sequentially, so
    // each world clears exactly what it is about to assert on.
    await world.prisma.playbackReference.deleteMany();
    await world.prisma.lessonProgress.deleteMany();
    await world.prisma.catalogDeletionAsset.deleteMany();
    await world.prisma.catalogDeletionOperation.deleteMany();
    await world.prisma.auditEvent.deleteMany();
    await world.prisma.mediaMapping.deleteMany();
    await world.prisma.subscriptionPlan.deleteMany();
    await world.prisma.lesson.deleteMany();
    await world.prisma.courseSection.deleteMany();
    await world.prisma.course.deleteMany();
  }
  // The admin belongs to this world only. Deleting every admin here would
  // revoke the session of any world that is still in use.
  const admin = await createTestAdmin(world, 'Catalog Admin', 'catalog secret twelve words');
  const session = await loginWith(world.app, admin.email, 'catalog secret twelve words');
  const student = await registerStudent(world.app);
  const studentRow = await world.prisma.user.findUniqueOrThrow({
    where: { email: student.user.email },
  });
  const out = world as CatalogWorld;
  (out as { adminJar: unknown }).adminJar = session.jar;
  (out as { adminUser: unknown }).adminUser = { id: admin.id, email: admin.email };
  (out as { studentJar: unknown }).studentJar = student.jar;
  (out as { studentUser: unknown }).studentUser = { id: studentRow.id, email: studentRow.email };
  if (fixture) (out as { fixture: unknown }).fixture = fixture;
  return out;
}

export function adminPost(
  app: Express,
  path: string,
  jar: { header(): string; csrf(): string },
  body: Record<string, unknown> = {},
) {
  return request(app)
    .post(path)
    .set('Origin', TEST_ORIGIN)
    .set('X-Forwarded-For', uniqueIp())
    .set('Cookie', jar.header())
    .set('X-Csrf-Token', jar.csrf())
    .send(body);
}

export function adminPatch(
  app: Express,
  path: string,
  jar: { header(): string; csrf(): string },
  body: Record<string, unknown> = {},
) {
  return request(app)
    .patch(path)
    .set('Origin', TEST_ORIGIN)
    .set('X-Forwarded-For', uniqueIp())
    .set('Cookie', jar.header())
    .set('X-Csrf-Token', jar.csrf())
    .send(body);
}

export function adminDelete(app: Express, path: string, jar: { header(): string; csrf(): string }) {
  return request(app)
    .delete(path)
    .set('Origin', TEST_ORIGIN)
    .set('X-Forwarded-For', uniqueIp())
    .set('Cookie', jar.header())
    .set('X-Csrf-Token', jar.csrf());
}

export function adminGet(app: Express, path: string, jar: { header(): string }) {
  return request(app).get(path).set('X-Forwarded-For', uniqueIp()).set('Cookie', jar.header());
}

export async function createFullDraft(
  world: CatalogWorld,
  slugSuffix: string,
): Promise<{ courseId: string; sectionId: string; lessonId: string; planId: string }> {
  const slug = `course-${Date.now().toString(36)}-${slugSuffix}`
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '')
    .slice(0, 60);
  const c = await adminPost(world.app, '/admin/catalog/courses', world.adminJar, {
    slug,
    titleAr: 'دورة اختبار',
    titleEn: 'Test course',
    descriptionAr: 'وصف عربي',
    descriptionEn: 'English description',
  });
  if (c.status !== 201)
    throw new Error(`course create failed ${c.status} ${JSON.stringify(c.body)}`);
  const courseId = c.body.data.course.id as string;
  const p = await adminPost(world.app, `/admin/catalog/courses/${courseId}/plans`, world.adminJar, {
    currentPricePiastres: 60000,
    previousPricePiastres: 90000,
    durationDays: 90,
  });
  const planId = p.body.data.plan.id as string;
  const s = await adminPost(
    world.app,
    `/admin/catalog/courses/${courseId}/sections`,
    world.adminJar,
    {
      titleAr: 'قسم أول',
      titleEn: 'Section one',
    },
  );
  const sectionId = s.body.data.section.id as string;
  const l = await adminPost(
    world.app,
    `/admin/catalog/sections/${sectionId}/lessons`,
    world.adminJar,
    {
      titleAr: 'درس أول',
      titleEn: 'Lesson one',
    },
  );
  const lessonId = l.body.data.lesson.id as string;
  return { courseId, sectionId, lessonId, planId };
}
