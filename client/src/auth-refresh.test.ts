import { afterEach, describe, expect, it, vi } from 'vitest';

const expired = () => new Response(JSON.stringify({ error: { code: 'SESSION_EXPIRED' } }), { status: 401 });
afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });

describe('shared-cookie session refresh', () => {
  it('serializes two tabs and rotates the shared credential only once', async () => {
    let queue = Promise.resolve();
    vi.stubGlobal('navigator', { locks: { request: vi.fn((_name, action) => {
      const task = queue.then(action);
      queue = task.then(() => undefined, () => undefined);
      return task;
    }) } });
    const cookie = { cookie: 'edu_csrf=old' };
    vi.stubGlobal('document', cookie);
    let renewed = false, rotations = 0, initialRequests = 0;
    let release!: () => void;
    const bothRequested = new Promise<void>(resolve => { release = resolve; });
    vi.stubGlobal('fetch', vi.fn(async (path: string, init: RequestInit) => {
      if (path === '/api/auth/me') return renewed ? new Response('{}') : expired();
      if (path === '/api/auth/refresh') {
        rotations++;
        expect(new Headers(init.headers).get('x-csrf-token')).toBe('old');
        renewed = true; cookie.cookie = 'edu_csrf=new';
        return new Response('{}');
      }
      if (!renewed) {
        if (++initialRequests === 2) release();
        await bothRequested;
        return expired();
      }
      expect(new Headers(init.headers).get('x-csrf-token')).toBe('new');
      return new Response('{"ok":true}');
    }));
    vi.resetModules(); const tabA = await import('./auth');
    vi.resetModules(); const tabB = await import('./auth');
    const results = await Promise.all([
      tabA.apiFetch('/complete', { method: 'POST', body: {}, retryOnAuth: true }),
      tabB.apiFetch('/sync', { method: 'POST', body: {}, retryOnAuth: true }),
    ]);
    expect(results).toEqual([{ ok: true }, { ok: true }]);
    expect(rotations).toBe(1);
  });

  it('does not rotate again for a delayed 401 after shared cookies are renewed', async () => {
    vi.stubGlobal('document', { cookie: 'edu_csrf=new' });
    let calls = 0;
    const fetch = vi.fn(async (path: string) => {
      if (path === '/api/auth/me') return new Response('{}');
      return ++calls === 1 ? expired() : new Response('{}');
    });
    vi.stubGlobal('fetch', fetch);
    const { apiFetch } = await import('./auth');
    await apiFetch('/course');
    expect(fetch.mock.calls.map(([path]) => path)).toEqual(['/api/course', '/api/auth/me', '/api/course']);
  });

  it('does not renew or retry a revoked session', async () => {
    vi.stubGlobal('document', { cookie: 'edu_csrf=old' });
    const fetch = vi.fn(async (path: string) => path === '/api/auth/me'
      ? new Response('{"error":{"code":"SESSION_REVOKED"}}', { status: 401 }) : expired());
    vi.stubGlobal('fetch', fetch);
    const { apiFetch } = await import('./auth');
    await expect(apiFetch('/course')).rejects.toMatchObject({ status: 401 });
    expect(fetch.mock.calls.map(([path]) => path)).toEqual(['/api/course', '/api/auth/me']);
  });
});
