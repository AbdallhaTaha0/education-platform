import { afterEach, describe, expect, it, vi } from 'vitest';
import { completeMedia, registerMedia, syncLessonMedia } from './client';
afterEach(() => vi.unstubAllGlobals());
describe('video upload session recovery', () => {
  it.each(['register', 'complete', 'sync'])('refreshes before retrying %s without repeating storage PUT', async phase => {
    const cookie = { cookie: 'edu_csrf=old' }; vi.stubGlobal('document', cookie);
    let refreshed = false; const calls: { path: string; csrf: string | null }[] = [];
    vi.stubGlobal('fetch', vi.fn(async (path: string, init: RequestInit) => {
      calls.push({ path, csrf: new Headers(init.headers).get('x-csrf-token') });
      if (path.endsWith('/auth/refresh')) { refreshed = true; cookie.cookie = 'edu_csrf=new'; return new Response('{}'); }
      if (!refreshed) return new Response(JSON.stringify({ error: { code: 'TOKEN_MISSING' } }), { status: 401 });
      return new Response(JSON.stringify({ data: { uploadUrl: 'https://storage.example.test/upload', mapping: { status: 'READY' } } }));
    }));
    if (phase === 'register') await registerMedia('lesson', { contentType: 'video/mp4', securityTier: 'STANDARD', title: 'Fixture' });
    else if (phase === 'complete') await completeMedia('lesson');
    else expect(await syncLessonMedia('lesson')).toBe('READY');
    expect(calls).toHaveLength(4); expect(calls[0].path).toBe(calls[3].path);
    expect(calls[1].path).toBe('/api/auth/me');
    expect(calls[0].csrf).toBe('old'); expect(calls[3].csrf).toBe('new');
    expect(calls.every(call => call.path.startsWith('/api/'))).toBe(true);
  });
});
