import { describe, expect, it } from 'vitest';
import { pageMetadata, safeJson } from './metadata';
import { publicHref, publicLocation } from './paths';
import type { PublicPageData } from './publicData';
const base: PublicPageData = { lang: 'en', page: 'home', path: '/en', pageNumber: 1, pageSize: 10, origin: 'https://seo.example.test', indexing: true };
describe('public SEO boundaries', () => {
  it('uses real language-specific paths without changing protected fragments', () => {
    expect(publicHref('#/courses/js-course', 'ar')).toBe('/ar/courses/js-course');
    expect(publicHref('#/learn/js-course?lesson=x', 'en')).toBe('#/learn/js-course?lesson=x');
    expect(publicLocation('/en/courses')).toEqual({ lang: 'en', hash: '#/courses' });
  });
  it('publishes reciprocal canonical alternatives and truthful site schema', () => {
    const meta = pageMetadata('en', 'home', base);
    expect(meta.canonical).toBe('https://seo.example.test/en');
    expect(meta.alternatives.map(a => a.url)).toEqual(['https://seo.example.test/ar', 'https://seo.example.test/en']);
    expect(meta.robots).toBe('index, follow');
    expect(meta.schema.find(s => s['@type'] === 'WebSite')).not.toHaveProperty('potentialAction');
  });
  it.each(['account', 'admin', 'learn', 'assessment', 'wallet', 'login', 'register', 'terms', 'privacy', 'refunds', 'not-found'] as const)('excludes %s and removes stale public identity', route => {
    const meta = pageMetadata('en', route, base);
    expect(meta.robots).toBe('noindex, follow'); expect(meta.canonical).toBeUndefined(); expect(meta.schema).toEqual([]);
  });
  it('does not guess a production origin or enable staging indexing', () => {
    expect(pageMetadata('en', 'home', { ...base, origin: undefined, indexing: false }).canonical).toBeUndefined();
    expect(pageMetadata('en', 'home', { ...base, indexing: false }).robots).toBe('noindex, follow');
  });
  it('keeps meaningful paginated canonicals and distinct descriptions', () => {
    const meta = pageMetadata('en', 'courses', { ...base, page: 'courses', pageNumber: 2, path: '/en/courses?page=2' });
    expect(meta.canonical).toContain('?page=2'); expect(meta.title).toContain('Page 2'); expect(meta.description).toContain('Page 2');
  });
  it('does not index or canonicalize alternate catalog page sizes', () => {
    const meta = pageMetadata('en', 'courses', { ...base, page: 'courses', pageSize: 20, path: '/en/courses', indexing: true });
    expect(meta.robots).toBe('noindex, follow'); expect(meta.canonical).toBeUndefined(); expect(meta.alternatives).toEqual([]);
  });
  it('uses real translated offer content without fabricated reviews', () => {
    const course = { id: 'fixture', slug: 'javascript', titleAr: 'برمجة', titleEn: 'JavaScript basics', descriptionAr: 'شرح البرمجة', descriptionEn: 'Variables and functions.', publishedAt: null, plans: [] };
    const meta = pageMetadata('en', 'course-detail', { ...base, page: 'course-detail', path: '/en/courses/javascript', course });
    expect(meta.title).toBe('JavaScript basics | FAYQ'); expect(meta.description).toBe(course.titleEn + " — " + course.descriptionEn);
    expect(meta.schema.find(s => s['@type'] === 'Course')).not.toHaveProperty('aggregateRating');
  });
  it('escapes script terminators while preserving JSON values', () => {
    const value = { title: '</script><script>alert(1)</script>' };
    const escaped = safeJson(value); expect(escaped).not.toContain('<'); expect(JSON.parse(escaped)).toEqual(value);
  });
});
