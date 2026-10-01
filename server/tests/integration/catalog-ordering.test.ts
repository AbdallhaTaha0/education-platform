import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  adminGet,
  adminPost,
  createCatalogWorld,
  createFullDraft,
  type CatalogWorld,
} from './catalog-helpers.js';

let world: CatalogWorld;

beforeAll(async () => {
  world = await createCatalogWorld(false);
});

afterAll(async () => {
  await world.close();
});

describe('catalog ordering + constraints', () => {
  it('creates deterministic contiguous positions and reorders transactionally', async () => {
    const { courseId } = await createFullDraft(world, 'ord1');
    // Add two more sections.
    const s2 = await adminPost(
      world.app,
      `/admin/catalog/courses/${courseId}/sections`,
      world.adminJar,
      { titleAr: 'قسم ثان', titleEn: 'Section two' },
    );
    const s3 = await adminPost(
      world.app,
      `/admin/catalog/courses/${courseId}/sections`,
      world.adminJar,
      { titleAr: 'قسم ثالث', titleEn: 'Section three' },
    );
    expect(s2.status).toBe(201);
    expect(s3.status).toBe(201);
    const full = await adminGet(world.app, `/admin/catalog/courses/${courseId}`, world.adminJar);
    const sections = full.body.data.course.sections as { id: string; position: number }[];
    expect(sections.map((s) => s.position)).toEqual([1, 2, 3]);
    // Reverse order.
    const reversed = [...sections].reverse().map((s) => s.id);
    const reorder = await adminPost(
      world.app,
      `/admin/catalog/courses/${courseId}/sections/reorder`,
      world.adminJar,
      { orderedIds: reversed },
    );
    expect(reorder.status).toBe(200);
    const after = await adminGet(world.app, `/admin/catalog/courses/${courseId}`, world.adminJar);
    const sectionsAfter = after.body.data.course.sections as { id: string; position: number }[];
    expect(sectionsAfter.map((s) => s.id)).toEqual(reversed);
    expect(sectionsAfter.map((s) => s.position)).toEqual([1, 2, 3]);
  });

  it('rejects incomplete/duplicate/foreign reorder sets', async () => {
    const { courseId } = await createFullDraft(world, 'ord2');
    const full = await adminGet(world.app, `/admin/catalog/courses/${courseId}`, world.adminJar);
    const sections = full.body.data.course.sections as { id: string }[];
    const onlyOne = await adminPost(
      world.app,
      `/admin/catalog/courses/${courseId}/sections/reorder`,
      world.adminJar,
      { orderedIds: [sections[0]?.id] },
    );
    // Single-section course reorder with exact set should succeed; create a second section to test omission.
    const s2 = await adminPost(
      world.app,
      `/admin/catalog/courses/${courseId}/sections`,
      world.adminJar,
      { titleAr: 'قسم', titleEn: 'Sec' },
    );
    expect(s2.status).toBe(201);
    const refreshed = await adminGet(
      world.app,
      `/admin/catalog/courses/${courseId}`,
      world.adminJar,
    );
    const ids = (refreshed.body.data.course.sections as { id: string }[]).map((s) => s.id);
    const omission = await adminPost(
      world.app,
      `/admin/catalog/courses/${courseId}/sections/reorder`,
      world.adminJar,
      { orderedIds: [ids[0]] },
    );
    expect(omission.status).toBe(400);
    expect(omission.body.error.code).toBe('REORDER_INVALID');
    const dup = await adminPost(
      world.app,
      `/admin/catalog/courses/${courseId}/sections/reorder`,
      world.adminJar,
      { orderedIds: [ids[0], ids[0]] },
    );
    expect(dup.status).toBe(400);
    const foreign = await adminPost(
      world.app,
      `/admin/catalog/courses/${courseId}/sections/reorder`,
      world.adminJar,
      {
        orderedIds: [ids[0], '11111111-1111-1111-1111-111111111111'],
      },
    );
    expect(foreign.status).toBe(400);
    void onlyOne;
  });

  it('enforces database CHECKs for prices/durations/titles', async () => {
    const { courseId } = await createFullDraft(world, 'chk1');
    // Invalid price via API.
    const badPrice = await adminPost(
      world.app,
      `/admin/catalog/courses/${courseId}/plans`,
      world.adminJar,
      {
        currentPricePiastres: 0,
        durationDays: 30,
      },
    );
    expect(badPrice.status).toBe(400);
    // Previous must exceed current.
    const badPrev = await adminPost(
      world.app,
      `/admin/catalog/courses/${courseId}/plans`,
      world.adminJar,
      {
        currentPricePiastres: 90000,
        previousPricePiastres: 50000,
        durationDays: 30,
      },
    );
    expect(badPrev.status).toBe(400);
    // DB-level check: raw insert with blank title must fail.
    await expect(
      world.prisma.$executeRawUnsafe(
        `INSERT INTO "Course"(id, slug, "titleAr", "titleEn", "descriptionAr", "descriptionEn", status, "createdAt", "updatedAt") VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'chk-blank-${Date.now()}', '   ', 'x', 'y', 'z', 'DRAFT', NOW(), NOW())`,
      ),
    ).rejects.toThrow();
    // DB CHECK for duration bounds.
    await expect(
      world.prisma.subscriptionPlan.create({
        data: { courseId, currentPricePiastres: 100, durationDays: 9999 },
      }),
    ).rejects.toThrow();
  });

  it('handles concurrent section creates without duplicate positions', async () => {
    const { courseId } = await createFullDraft(world, 'conc1');
    const results = await Promise.allSettled(
      Array.from({ length: 5 }, (_, i) =>
        adminPost(world.app, `/admin/catalog/courses/${courseId}/sections`, world.adminJar, {
          titleAr: `قسم ${i}`,
          titleEn: `Section ${i}`,
        }),
      ),
    );
    const ok = results.filter(
      (r) => r.status === 'fulfilled' && (r.value as { status: number }).status === 201,
    );
    expect(ok.length).toBe(5);
    const full = await adminGet(world.app, `/admin/catalog/courses/${courseId}`, world.adminJar);
    const positions = (full.body.data.course.sections as { position: number }[])
      .map((s) => s.position)
      .sort((a, b) => a - b);
    // 1 initial + 5 concurrent = 6 contiguous.
    expect(positions).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('keeps price updates exact under concurrency', async () => {
    const { courseId, planId } = await createFullDraft(world, 'price1');
    void courseId;
    const updates = await Promise.allSettled(
      [61000, 62000, 63000].map((p) =>
        (async () => {
          const { adminPatch } = await import('./catalog-helpers.js');
          return adminPatch(world.app, `/admin/catalog/plans/${planId}`, world.adminJar, {
            currentPricePiastres: p,
            previousPricePiastres: p + 10000,
          });
        })(),
      ),
    );
    const succeeded = updates.filter((r) => r.status === 'fulfilled');
    expect(succeeded.length).toBeGreaterThan(0);
    const plan = await world.prisma.subscriptionPlan.findUniqueOrThrow({ where: { id: planId } });
    expect([61000, 62000, 63000]).toContain(plan.currentPricePiastres);
    expect(plan.previousPricePiastres as number).toBeGreaterThan(plan.currentPricePiastres);
  });
});
