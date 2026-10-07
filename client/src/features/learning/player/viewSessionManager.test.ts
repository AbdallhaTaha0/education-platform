/**
 * M10 view-session lifecycle tests (agent 1).
 *
 * Exercises the grant lifecycle owned by ViewSessionManager — refresh,
 * same-grant remount, delayed responses, teardown, bounded retry — with an
 * injected transport and fake timers. No media element or browser is needed;
 * the thin React hook in useViewTracking.ts only wires this manager to the
 * video element and the real viewApi.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ViewSessionManager,
  VIEW_START_MAX_ATTEMPTS,
  VIEW_START_RETRY_DELAYS_MS,
} from './viewSessionManager.js';
import type { PlaybackActivitySample } from './viewTracking.js';

function playing(nowMs: number, overrides: Partial<PlaybackActivitySample> = {}): PlaybackActivitySample {
  return { paused: false, seeking: false, ended: false, waiting: false, nowMs, ...overrides };
}

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (error: unknown) => void;
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function httpError(status: number): { status: number; code: string } {
  return { status, code: `HTTP_${status}` };
}

interface Harness {
  manager: ViewSessionManager;
  starts: Array<{ courseRef: string; lessonId: string; referenceId: string }>;
  startQueue: Array<Deferred<{ viewSessionId: string }>>;
  heartbeats: Array<{ viewSessionId: string; playedMs: number }>;
  heartbeatQueue: Array<Deferred<{ playedMilliseconds: number }>>;
}

function harness(): Harness {
  const h = {} as Harness;
  h.starts = [];
  h.startQueue = [];
  h.heartbeats = [];
  h.heartbeatQueue = [];
  h.manager = new ViewSessionManager(
    (courseRef, lessonId, referenceId) => {
      h.starts.push({ courseRef, lessonId, referenceId });
      const d = deferred<{ viewSessionId: string }>();
      h.startQueue.push(d);
      return d.promise;
    },
    (viewSessionId, playedMs) => {
      h.heartbeats.push({ viewSessionId, playedMs });
      const d = deferred<{ playedMilliseconds: number }>();
      h.heartbeatQueue.push(d);
      return d.promise;
    },
  );
  return h;
}

async function flush(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('start success and pending accumulation', () => {
  it('starts once per grant and heartbeats time observed while pending', async () => {
    const h = harness();
    h.manager.attach('course-a', 'lesson-a', 'ref-1');
    expect(h.starts).toHaveLength(1);
    expect(h.starts[0]).toEqual({ courseRef: 'course-a', lessonId: 'lesson-a', referenceId: 'ref-1' });

    // Playback continues while the start request is still in flight: the
    // elapsed time must not be lost.
    h.manager.observe(playing(0));
    h.manager.observe(playing(1500));
    h.manager.observe(playing(2000));
    expect(h.manager.playedMs).toBe(2000);

    h.startQueue[0]!.resolve({ viewSessionId: 'view-1' });
    await flush();
    expect(h.manager.snapshot()).toMatchObject({ status: 'active', viewSessionId: 'view-1' });

    const sent = h.manager.heartbeatNow({});
    h.heartbeatQueue[0]!.resolve({ playedMilliseconds: 2000 });
    await expect(sent).resolves.toEqual({ sent: true });
    expect(h.heartbeats).toEqual([{ viewSessionId: 'view-1', playedMs: 2000 }]);
  });

  it('skips redundant heartbeats with an unchanged total', async () => {
    const h = harness();
    h.manager.attach('c', 'l', 'ref-1');
    h.startQueue[0]!.resolve({ viewSessionId: 'view-1' });
    await flush();
    h.manager.observe(playing(0));
    h.manager.observe(playing(1000));
    const first = h.manager.heartbeatNow({});
    h.heartbeatQueue[0]!.resolve({ playedMilliseconds: 1000 });
    await expect(first).resolves.toEqual({ sent: true });
    // Same total: no second request.
    await expect(h.manager.heartbeatNow({})).resolves.toEqual({ sent: false });
    expect(h.heartbeats).toHaveLength(1);
  });
});

describe('bounded retry for transient failures', () => {
  it('retries 5xx on the documented backoff then succeeds', async () => {
    const h = harness();
    h.manager.attach('c', 'l', 'ref-1');
    h.startQueue[0]!.reject(httpError(500));
    await flush();
    expect(h.manager.snapshot()).toMatchObject({ status: 'starting', attempt: 1 });
    expect(h.starts).toHaveLength(1);

    // First retry after 1s, not before.
    await vi.advanceTimersByTimeAsync(999);
    expect(h.starts).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(h.starts).toHaveLength(2);

    h.startQueue[1]!.reject(httpError(502));
    await flush();
    // Second retry after 2s.
    await vi.advanceTimersByTimeAsync(1999);
    expect(h.starts).toHaveLength(2);
    await vi.advanceTimersByTimeAsync(1);
    expect(h.starts).toHaveLength(3);

    h.startQueue[2]!.resolve({ viewSessionId: 'view-1' });
    await flush();
    expect(h.manager.snapshot()).toMatchObject({ status: 'active', viewSessionId: 'view-1' });
  });

  it('retries rate limiting and transport failures', async () => {
    const h = harness();
    h.manager.attach('c', 'l', 'ref-1');
    h.startQueue[0]!.reject(httpError(429));
    await flush();
    await vi.advanceTimersByTimeAsync(1000);
    expect(h.starts).toHaveLength(2);
    h.startQueue[1]!.reject(new Error('network down'));
    await flush();
    await vi.advanceTimersByTimeAsync(2000);
    expect(h.starts).toHaveLength(3);
  });

  it(`stops after exactly ${VIEW_START_MAX_ATTEMPTS} attempts`, async () => {
    const h = harness();
    h.manager.attach('c', 'l', 'ref-1');
    const totalDelay = VIEW_START_RETRY_DELAYS_MS.reduce((a, b) => a + b, 0);
    for (let i = 0; i < VIEW_START_MAX_ATTEMPTS; i += 1) {
      h.startQueue[i]!.reject(httpError(503));
      await flush();
      await vi.advanceTimersByTimeAsync(totalDelay + 60_000);
    }
    expect(h.starts).toHaveLength(VIEW_START_MAX_ATTEMPTS);
    expect(h.manager.snapshot()).toMatchObject({ status: 'failed', attempt: VIEW_START_MAX_ATTEMPTS });
  });

  it('never retries terminal authorization/access failures', async () => {
    for (const status of [400, 401, 403, 404, 409]) {
      const h = harness();
      h.manager.attach('c', 'l', 'ref-1');
      h.startQueue[0]!.reject(httpError(status));
      await flush();
      await vi.advanceTimersByTimeAsync(120_000);
      expect(h.starts).toHaveLength(1);
      expect(h.manager.snapshot()).toMatchObject({ status: 'failed' });
    }
  });
});

describe('grant supersession and stale responses', () => {
  it('refresh cancels the old grant: late success is ignored', async () => {
    const h = harness();
    h.manager.attach('c', 'l', 'ref-old');
    h.manager.observe(playing(0));
    h.manager.observe(playing(3000));

    // Refresh before the old start resolves: new grant, fresh threshold.
    h.manager.attach('c', 'l', 'ref-new');
    expect(h.starts.map((s) => s.referenceId)).toEqual(['ref-old', 'ref-new']);
    expect(h.manager.playedMs).toBe(0);

    // The old grant's late success must not write into the new session.
    h.startQueue[0]!.resolve({ viewSessionId: 'view-old' });
    await flush();
    expect(h.manager.snapshot()).toMatchObject({ status: 'starting', viewSessionId: null });

    h.startQueue[1]!.resolve({ viewSessionId: 'view-new' });
    await flush();
    expect(h.manager.snapshot()).toMatchObject({ status: 'active', viewSessionId: 'view-new' });
  });

  it('cancels a pending retry when a new grant attaches', async () => {
    const h = harness();
    h.manager.attach('c', 'l', 'ref-old');
    h.startQueue[0]!.reject(httpError(500));
    await flush();
    h.manager.attach('c', 'l', 'ref-new');
    // The old grant's 1s retry must never fire.
    await vi.advanceTimersByTimeAsync(30_000);
    expect(h.starts.map((s) => s.referenceId)).toEqual(['ref-old', 'ref-new']);
    h.startQueue[1]!.resolve({ viewSessionId: 'view-new' });
    await flush();
    expect(h.manager.snapshot()).toMatchObject({ status: 'active', viewSessionId: 'view-new' });
  });

  it('same-grant remount reuses the server-deduped row', async () => {
    const h = harness();
    h.manager.attach('c', 'l', 'ref-1');
    h.startQueue[0]!.resolve({ viewSessionId: 'view-1' });
    await flush();
    expect(h.manager.snapshot()).toMatchObject({ status: 'active', viewSessionId: 'view-1' });

    // React StrictMode remount with the same grant: a second start for the
    // same referenceId converges server-side via UNIQUE(playbackReferenceId).
    h.manager.attach('c', 'l', 'ref-1');
    expect(h.starts).toHaveLength(2);
    h.startQueue[1]!.resolve({ viewSessionId: 'view-1' });
    await flush();
    expect(h.manager.snapshot()).toMatchObject({ status: 'active', viewSessionId: 'view-1' });
  });

  it('ignores a delayed start success after detach', async () => {
    const h = harness();
    h.manager.attach('c', 'l', 'ref-1');
    h.manager.detach();
    h.startQueue[0]!.resolve({ viewSessionId: 'view-1' });
    await flush();
    expect(h.manager.snapshot()).toMatchObject({ status: 'inactive', viewSessionId: null });
    await expect(h.manager.heartbeatNow({})).resolves.toEqual({ sent: false });
    expect(h.heartbeats).toHaveLength(0);
  });

  it('detaching cancels a scheduled retry', async () => {
    const h = harness();
    h.manager.attach('c', 'l', 'ref-1');
    h.startQueue[0]!.reject(httpError(500));
    await flush();
    h.manager.detach();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(h.starts).toHaveLength(1);
  });

  it('ignores a late heartbeat response after a grant change', async () => {
    const h = harness();
    h.manager.attach('c', 'l', 'ref-old');
    h.startQueue[0]!.resolve({ viewSessionId: 'view-old' });
    await flush();
    h.manager.observe(playing(0));
    h.manager.observe(playing(1000));
    const sending = h.manager.heartbeatNow({});
    expect(h.heartbeats).toHaveLength(1);

    h.manager.attach('c', 'l', 'ref-new');
    h.heartbeatQueue[0]!.resolve({ playedMilliseconds: 1000 });
    await expect(sending).resolves.toEqual({ sent: false });
    // The new session is unaffected by the old response.
    expect(h.manager.snapshot()).toMatchObject({ status: 'starting', viewSessionId: null });
  });

  it('observe while detached accumulates nothing', () => {
    const h = harness();
    expect(h.manager.observe(playing(0))).toBe(0);
    expect(h.manager.observe(playing(1000))).toBe(0);
    expect(h.manager.playedMs).toBe(0);
  });
});
