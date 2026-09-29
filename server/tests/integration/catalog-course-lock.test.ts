import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { lockCourseRow } from '../../src/modules/catalog/locks.js';
import { audit } from '../../src/modules/catalog/audit.js';
import { adminPatch, createCatalogWorld, createFullDraft, type CatalogWorld } from './catalog-helpers.js';

let world: CatalogWorld;

beforeAll(async () => {
  world = await createCatalogWorld(false);
});

afterAll(async () => {
  await world.close();
});

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('course-scoped lock-then-validate concurrency', () => {
  it('waiting structural mutation fails 409 when the course is archived under the lock', async () => {
    const { courseId, sectionId } = await createFullDraft(world, 'lockarch');
    const before = await world.prisma.courseSection.findUniqueOrThrow({ where: { id: sectionId } });
    const auditsBefore = await world.prisma.auditEvent.count({ where: { entityType: 'CourseSection', entityId: sectionId } });

    // T1: hold the course row lock, then archive inside the same transaction.
    let releaseHolder!: () => void;
    const releaseGate = new Promise<void>((resolve) => {
      releaseHolder = resolve;
    });
    let lockAcquired!: () => void;
    const lockGate = new Promise<void>((resolve) => {
      lockAcquired = resolve;
    });
    const holder = world.prisma.$transaction(
      async (tx) => {
        await lockCourseRow(tx, courseId);
        lockAcquired();
        await releaseGate;
        await tx.course.update({
          where: { id: courseId },
          data: { status: 'ARCHIVED', priorStatus: 'DRAFT', archivedAt: new Date() },
        });
        await audit(tx, { actorUserId: world.adminUser.id, action: 'COURSE_ARCHIVED', entityType: 'Course', entityId: courseId, metadata: {} });
      },
      { timeout: 20000, maxWait: 5000 },
    );
    await lockGate;

    // T2: structural mutation started while the lock is held must block, then
    // observe the freshly archived state and fail — never mutate on stale state.
    let settled = false;
    const waiter = adminPatch(world.app, `/admin/catalog/sections/${sectionId}`, world.adminJar, {
      titleAr: 'تعديل متأخر',
      titleEn: 'Late edit',
    }).then((res) => {
      settled = true;
      return res;
    });
    await sleep(750);
    expect(settled).toBe(false);
    expect(await world.prisma.courseSection.findUnique({ where: { id: sectionId } })).toEqual(before);

    releaseHolder();
    await holder;
    const res = await waiter;
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('COURSE_ARCHIVED');

    // Hierarchy and audit rows prove the waiter changed nothing.
    expect(await world.prisma.courseSection.findUnique({ where: { id: sectionId } })).toEqual(before);
    expect(await world.prisma.auditEvent.count({ where: { entityType: 'CourseSection', entityId: sectionId } })).toBe(auditsBefore);
    expect((await world.prisma.course.findUniqueOrThrow({ where: { id: courseId } })).status).toBe('ARCHIVED');
  });
});
