import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { learningApi } from './client';

const json = (data: unknown) => new Response(JSON.stringify({ data }), { headers: { 'Content-Type': 'application/json' } });
const denied = (code = 'TOKEN_MISSING', status = 401) => new Response(JSON.stringify({ error: { code } }), { status });
beforeEach(() => vi.stubGlobal('document', { cookie: 'edu_csrf=before' }));
afterEach(() => vi.unstubAllGlobals());

describe('learning progress cookie transport', () => {
  it('refreshes once for concurrent dashboard and progress calls, using current CSRF', async () => {
    let refreshed = false;
    const calls: { path: string; csrf: string | null; keepalive?: boolean }[] = [];
    vi.stubGlobal('fetch', vi.fn(async (path: string, init: RequestInit) => {
      calls.push({ path, csrf: new Headers(init.headers).get('x-csrf-token'), keepalive: init.keepalive });
      if (path.endsWith('/auth/refresh')) {
        await new Promise(resolve => setTimeout(resolve, 5));
        document.cookie = 'edu_csrf=after'; refreshed = true; return json({});
      }
      if (!refreshed) return denied();
      return json(path.endsWith('/progress') ? { progress: { lessonId: 'lesson', positionSeconds: 19, durationSeconds: 20, completed: true } } : { active: [], expired: [] });
    }));
    const [saved] = await Promise.all([
      learningApi.recordProgress({ courseRef: 'course', lessonId: 'lesson', positionSeconds: 19, durationSeconds: 20, completed: true }, { keepalive: true }),
      learningApi.dashboard(),
    ]);
    expect(saved.completed).toBe(true);
    expect(calls.filter(call => call.path.endsWith('/auth/refresh'))).toHaveLength(1);
    const writes = calls.filter(call => call.path.endsWith('/learning/progress'));
    expect(writes.map(call => call.csrf)).toEqual(['before', 'after']);
    expect(writes.every(call => call.keepalive)).toBe(true);
  });
  it.each([['SUBSCRIPTION_EXPIRED', 403], ['SESSION_REVOKED', 401], ['CSRF_INVALID', 403], ['SERVICE_ERROR', 500]])('never replays %s', async (code, status) => {
    const fetcher = vi.fn(async () => denied(code, status)); vi.stubGlobal('fetch', fetcher);
    await expect(learningApi.recordProgress({ courseRef: 'course', lessonId: 'lesson', positionSeconds: 1, durationSeconds: 20, completed: false })).rejects.toMatchObject({ code, status });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
