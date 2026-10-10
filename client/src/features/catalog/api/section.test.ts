import { afterEach, expect, it, vi } from 'vitest';
import { createSection } from './client';

afterEach(() => vi.unstubAllGlobals());
it('returns the server-created section identity for workspace selection', async () => {
  vi.stubGlobal('document', { cookie: 'edu_csrf=synthetic' });
  const fetcher = vi.fn(async () => new Response(JSON.stringify({ data: { section: { id: 'created-section' } } }), { status: 201 }));
  vi.stubGlobal('fetch', fetcher);
  expect(await createSection('course', { titleAr: 'قسم', titleEn: 'Section' })).toEqual({ id: 'created-section' });
  expect(fetcher).toHaveBeenCalledWith('/api/admin/catalog/courses/course/sections', expect.objectContaining({ method: 'POST', credentials: 'include' }));
});
