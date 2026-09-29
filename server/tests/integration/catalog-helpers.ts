import request from 'supertest';
import type { Express } from 'express';
import { bootstrapFirstAdmin } from '../../src/modules/identity/bootstrap.js';
import {
  createWorld,
  loginWith,
  registerStudent,
  uniqueEmail,
  uniquePhone,
  TEST_ORIGIN,
  uniqueIp,
  type IdentityWorld,
} from './identity-helpers.js';
import { DrmFixture } from '../fixtures/drmFixture.js';

export interface CatalogWorld extends IdentityWorld {
  adminJar: import('./identity-helpers.js').Jar;
  adminUser: { id: string; email: string };
  studentJar: import('./identity-helpers.js').Jar;
  fixture?: DrmFixture;
}

export async function createCatalogWorld(withFixture = false): Promise<CatalogWorld> {
  let fixture: DrmFixture | undefined;
  let overrides: Record<string, unknown> = {};
  if (withFixture) {
    fixture = new DrmFixture();
    const url = await fixture.start();
    overrides = {
      drmBaseUrl: url,
      drmClientId: fixture.expectedClientId,
      drmClientSecret: fixture.expectedClientSecret,
    };
  }
  const world = await createWorld(overrides as never);
  // Ensure clean catalog state per world (tests share DB file-sequentially; clean explicitly).
  await world.prisma.catalogDeletionAsset.deleteMany();
  await world.prisma.catalogDeletionOperation.deleteMany();
  await world.prisma.auditEvent.deleteMany();
  await world.prisma.mediaMapping.deleteMany();
  await world.prisma.subscriptionPlan.deleteMany();
  await world.prisma.lesson.deleteMany();
  await world.prisma.courseSection.deleteMany();
  await world.prisma.course.deleteMany();

  await world.prisma.user.deleteMany({ where: { role: 'ADMIN' } });
  const admin = await bootstrapFirstAdmin(
    { displayName: 'Catalog Admin', email: uniqueEmail(), phone: uniquePhone(), password: 'catalog secret twelve words' },
    { prisma: world.prisma, argon2: { memoryKb: 8192, timeCost: 2, parallelism: 1 } },
  );
  const session = await loginWith(world.app, admin.email, 'catalog secret twelve words');
  const student = await registerStudent(world.app);
  const out = world as CatalogWorld;
  (out as { adminJar: unknown }).adminJar = session.jar;
  (out as { adminUser: unknown }).adminUser = { id: admin.id, email: admin.email };
  (out as { studentJar: unknown }).studentJar = student.jar;
  if (fixture) (out as { fixture: unknown }).fixture = fixture;
  return out;
}

export function adminPost(app: Express, path: string, jar: { header(): string; csrf(): string }, body: Record<string, unknown> = {}) {
  return request(app).post(path).set('Origin', TEST_ORIGIN).set('X-Forwarded-For', uniqueIp()).set('Cookie', jar.header()).set('X-Csrf-Token', jar.csrf()).send(body);
}

export function adminPatch(app: Express, path: string, jar: { header(): string; csrf(): string }, body: Record<string, unknown> = {}) {
  return request(app).patch(path).set('Origin', TEST_ORIGIN).set('X-Forwarded-For', uniqueIp()).set('Cookie', jar.header()).set('X-Csrf-Token', jar.csrf()).send(body);
}

export function adminDelete(app: Express, path: string, jar: { header(): string; csrf(): string }) {
  return request(app).delete(path).set('Origin', TEST_ORIGIN).set('X-Forwarded-For', uniqueIp()).set('Cookie', jar.header()).set('X-Csrf-Token', jar.csrf());
}

export function adminGet(app: Express, path: string, jar: { header(): string }) {
  return request(app).get(path).set('X-Forwarded-For', uniqueIp()).set('Cookie', jar.header());
}

export async function createFullDraft(world: CatalogWorld, slugSuffix: string): Promise<{ courseId: string; sectionId: string; lessonId: string; planId: string }> {
  const slug = `course-${Date.now().toString(36)}-${slugSuffix}`.toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 60);
  const c = await adminPost(world.app, '/admin/catalog/courses', world.adminJar, {
    slug,
    titleAr: 'دورة اختبار',
    titleEn: 'Test course',
    descriptionAr: 'وصف عربي',
    descriptionEn: 'English description',
  });
  if (c.status !== 201) throw new Error(`course create failed ${c.status} ${JSON.stringify(c.body)}`);
  const courseId = c.body.data.course.id as string;
  const p = await adminPost(world.app, `/admin/catalog/courses/${courseId}/plans`, world.adminJar, {
    currentPricePiastres: 60000,
    previousPricePiastres: 90000,
    durationDays: 90,
  });
  const planId = p.body.data.plan.id as string;
  const s = await adminPost(world.app, `/admin/catalog/courses/${courseId}/sections`, world.adminJar, {
    titleAr: 'قسم أول',
    titleEn: 'Section one',
  });
  const sectionId = s.body.data.section.id as string;
  const l = await adminPost(world.app, `/admin/catalog/sections/${sectionId}/lessons`, world.adminJar, {
    titleAr: 'درس أول',
    titleEn: 'Lesson one',
  });
  const lessonId = l.body.data.lesson.id as string;
  return { courseId, sectionId, lessonId, planId };
}
