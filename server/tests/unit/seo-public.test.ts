import express from 'express';
import request from 'supertest';
import type { PrismaClient } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { readSeoSettings } from '../../src/modules/seo/config';
import { createSeoRouter, safeJson } from '../../src/modules/seo/router';
const published = {
  id: 'fixture',
  slug: 'javascript',
  titleAr: 'برمجة',
  titleEn: 'JavaScript basics',
  descriptionAr: 'شرح البرمجة',
  descriptionEn: 'Variables and functions.',
  publishedAt: new Date('2026-01-01'),
  status: 'PUBLISHED',
  deletionRequestedAt: null,
  plans: [],
  grade: null,
  academicYear: null,
  term: null,
  courseKind: null,
  teachingMonth: null,
  sections: [{ titleEn: 'PRIVATE LESSON' }],
};
function fixture(settings = { origin: 'https://seo.example.test', indexing: true }) {
  const prisma = {
    course: {
      findMany: vi.fn().mockResolvedValue([published]),
      findUnique: vi
        .fn()
        .mockImplementation(({ where }) =>
          Promise.resolve(where.slug === published.slug ? published : null),
        ),
    },
    coursePackage: {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn().mockResolvedValue(null),
    },
    supportContact: { findUnique: vi.fn().mockResolvedValue(null) },
  };
  const app = express();
  app.use(createSeoRouter(prisma as unknown as PrismaClient, settings));
  return { app, prisma };
}
describe('origin and indexing configuration', () => {
  it('fails closed until configured', () => {
    expect(readSeoSettings({})).toEqual({ origin: undefined, indexing: false });
    expect(() => readSeoSettings({ SEO_INDEXING_ENABLED: 'true' })).toThrow();
  });
  it.each([
    'http://example.test',
    'https://user:pass@example.test',
    'https://example.test/path',
    'https://example.test/?q=1',
    'https://example.test/#x',
  ])('rejects unsafe origin %s', (origin) => {
    expect(() => readSeoSettings({ SEO_PUBLIC_ORIGIN: origin })).toThrow();
  });
});
describe('initial public HTML and HTTP semantics', () => {
  it.each(['/ar', '/en', '/ar/courses', '/en/courses', '/ar/support', '/en/support'])(
    'renders meaningful HTML for %s without browser JavaScript',
    async (path) => {
      const { app } = fixture();
      const res = await request(app).get(path);
      expect(res.status).toBe(200);
      expect(res.headers['x-robots-tag']).toBe('index, follow');
      expect(res.text).toMatch(/<h1\b/);
      expect(res.text).toContain('rel="canonical"');
      expect(res.text).toContain('hrefLang="ar"');
      expect(res.text).not.toContain('PRIVATE LESSON');
    },
  );
  it('renders unique offers using the existing public serializer', async () => {
    const res = await request(fixture().app).get('/en/courses/javascript');
    expect(res.status).toBe(200);
    expect(res.text).toContain('<title>JavaScript basics | FAYQ</title>');
    expect(res.text).toContain('Variables and functions.');
    expect(res.text).not.toContain('PRIVATE LESSON');
    const payload = JSON.parse(
      res.text.match(
        /<script id="public-page-data" type="application\/json">([^]*?)<\/script>/,
      )![1]!,
    );
    expect(payload.course).not.toHaveProperty('sections');
    expect(payload.course).not.toHaveProperty('status');
  });
  it.each([
    '/missing',
    '/en/courses/missing',
    '/ar/courses?page=999',
    '/ar/courses?page=0',
    '/ar/package/not-an-id',
  ])('returns real noindex 404 for %s', async (path) => {
    const res = await request(fixture().app).get(path);
    expect(res.status).toBe(404);
    expect(res.headers['x-robots-tag']).toContain('noindex');
    expect(res.text).toContain('<h1');
    expect(res.text).not.toContain('rel="canonical"');
  });
  it.each([
    ['/', '/ar'],
    ['/AR/', '/ar'],
    ['/en/package/ABCDEFAB-0000-4000-8000-000000000001', '/en/package/abcdefab-0000-4000-8000-000000000001'],
    ['/en/courses/', '/en/courses'],
    ['/en/courses/JAVASCRIPT', '/en/courses/javascript'],
  ])('permanently normalizes %s', async (path, target) => {
    const res = await request(fixture().app).get(path);
    expect(res.status).toBe(308);
    expect(res.headers.location).toBe(target);
  });
  it('uses 503 rather than a soft 404 for catalog outages', async () => {
    const { app, prisma } = fixture();
    prisma.course.findMany.mockRejectedValue(new Error('private DB diagnostic'));
    const res = await request(app).get('/ar/courses');
    expect(res.status).toBe(503);
    expect(res.text).not.toContain('private DB diagnostic');
  });
  it('keeps staging closed even with a configured origin', async () => {
    const app = fixture({ origin: 'https://seo.example.test', indexing: false }).app;
    expect((await request(app).get('/robots.txt')).text).toContain('Disallow: /');
    expect((await request(app).get('/sitemap.xml')).status).toBe(503);
    expect((await request(app).get('/en')).headers['x-robots-tag']).toContain('noindex');
  });
  it('lists only public, canonical language URLs without fake lastmod', async () => {
    const { app, prisma } = fixture();
    const res = await request(app).get('/sitemap.xml');
    expect(res.status).toBe(200);
    expect(res.text).toContain('https://seo.example.test/ar/courses/javascript');
    expect(res.text).not.toContain('lastmod');
    expect(res.text).not.toContain('#');
    expect(prisma.course.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: 'PUBLISHED', deletionRequestedAt: null } }),
    );
  });
  it('ignores hostile request hosts for canonical and sitemap URLs', async () => {
    const res = await request(fixture().app).get('/en').set('Host', 'attacker.example');
    expect(res.text).not.toContain('attacker.example');
  });
  it('escapes script terminators in serialized public data', () => {
    const data = { text: '</script>' };
    expect(safeJson(data)).not.toContain('<');
    expect(JSON.parse(safeJson(data))).toEqual(data);
  });
});
