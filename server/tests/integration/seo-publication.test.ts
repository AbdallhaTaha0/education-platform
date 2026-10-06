import express from 'express';
import request from 'supertest';
import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { createWorld, type IdentityWorld } from './identity-helpers';
import { createSeoRouter } from '../../src/modules/seo/router';
let world: IdentityWorld;
const slugs = ['seo-published-fixture', 'seo-draft-fixture', 'seo-deleting-fixture'];
beforeAll(async () => {
  world = await createWorld();
  await world.prisma.course.createMany({
    data: slugs.map((slug, i) => ({
      slug,
      titleAr: 'دورة اختبار',
      titleEn: 'SEO test course',
      descriptionAr: 'وصف اختبار معزول',
      descriptionEn: 'Isolated test description.',
      status: i === 1 ? 'DRAFT' : 'PUBLISHED',
      deletionRequestedAt: i === 2 ? new Date() : null,
    })),
  });
});
afterAll(async () => {
  await world.prisma.course.deleteMany({ where: { slug: { in: slugs } } });
  await world.close();
});
describe('real PostgreSQL SEO publication boundary', () => {
  const app = () =>
    express().use(
      createSeoRouter(world.prisma, { origin: 'https://seo.example.test', indexing: true }),
    );
  it('serves only published, nondeleting offers', async () => {
    expect((await request(app()).get('/en/courses/' + slugs[0])).status).toBe(200);
    for (const slug of slugs.slice(1))
      expect((await request(app()).get('/en/courses/' + slug)).status).toBe(404);
  });
  it('excludes draft and deleting records from initial catalog data', async () => {
    const res = await request(app()).get('/en/courses');
    expect(res.status).toBe(200);
    expect(res.text).toContain(slugs[0]);
    for (const slug of slugs.slice(1)) expect(res.text).not.toContain(slug);
  });
  it('excludes private lifecycle states from the sitemap', async () => {
    const res = await request(app()).get('/sitemap.xml');
    expect(res.status).toBe(200);
    expect(res.text).toContain(slugs[0]);
    for (const slug of slugs.slice(1)) expect(res.text).not.toContain(slug);
  });
});
