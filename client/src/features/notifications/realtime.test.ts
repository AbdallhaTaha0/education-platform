import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { InboxStore } from './inbox';

const mock = vi.hoisted(() => ({
  fetch: vi.fn(),
  csrf: vi.fn(() => 'fixture-csrf'),
  sockets: [] as FakeWebSocket[],
}));

class FakeWebSocket {
  static OPEN = 1;
  static CONNECTING = 0;
  static CLOSED = 3;
  readyState = FakeWebSocket.CONNECTING;
  onopen: (() => void) | null = null;
  onmessage: ((ev: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  onclose: ((ev: { code: number }) => void) | null = null;
  close = vi.fn(() => {
    this.readyState = FakeWebSocket.CLOSED;
  });
  constructor(public readonly url: string) {
    mock.sockets.push(this);
  }
}

vi.mock('../../auth', () => ({
  apiFetch: mock.fetch,
  readCsrfCookie: mock.csrf,
  ApiError: class extends Error {
    constructor(
      public status: number,
      public code: string,
    ) {
      super(code);
    }
  },
}));

import { connectInbox } from './realtime';
import { ApiError } from '../../auth';

describe('notification realtime lifecycle', () => {
  let dispose: (() => void) | undefined;
  const synchronize = vi.fn();
  const connection = vi.fn();
  const invalidated = vi.fn();

  function start() {
    dispose = connectInbox({ synchronize } as unknown as InboxStore, connection, invalidated);
  }

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    mock.sockets.length = 0;
    mock.fetch.mockResolvedValue({});
    vi.stubGlobal('WebSocket', FakeWebSocket);
    vi.stubGlobal('window', {
      location: { protocol: 'https:', host: 'fayq.example' },
      dispatchEvent: vi.fn(),
    });
    vi.stubGlobal('navigator', { onLine: true });
    vi.stubGlobal('document', { visibilityState: 'visible' });
  });

  afterEach(() => {
    dispose?.();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('connects to same-origin /api/notifications/ws with readable CSRF synchronizer', () => {
    start();
    expect(mock.sockets).toHaveLength(1);
    expect(mock.sockets[0]!.url).toBe('wss://fayq.example/api/notifications/ws?csrf=fixture-csrf');
  });

  it('coalesces duplicate signals and always resynchronizes after reconnect', async () => {
    start();
    const ws = mock.sockets[0]!;
    for (let i = 0; i < 10; i++) {
      ws.onmessage?.({
        data: JSON.stringify({
          event: 'notifications:changed',
          data: { schemaVersion: 1, revision: '2' },
        }),
      });
    }
    await vi.advanceTimersByTimeAsync(100);
    expect(synchronize).toHaveBeenCalledTimes(1);
    ws.onopen?.();
    await vi.advanceTimersByTimeAsync(100);
    expect(synchronize).toHaveBeenCalledTimes(2);
  });

  it('ignores invalid revision envelopes and releases recovery timers on account disposal', async () => {
    start();
    const ws = mock.sockets[0]!;
    ws.onmessage?.({
      data: JSON.stringify({
        event: 'notifications:changed',
        data: { schemaVersion: 1, revision: 'unsafe' },
      }),
    });
    await vi.advanceTimersByTimeAsync(100);
    expect(synchronize).not.toHaveBeenCalled();
    dispose!();
    await vi.advanceTimersByTimeAsync(60000);
    expect(synchronize).not.toHaveBeenCalled();
    expect(ws.close).toHaveBeenCalled();
  });

  it('clears authentication only on a final HTTP authentication failure', async () => {
    start();
    const ws = mock.sockets[0]!;
    mock.fetch.mockRejectedValue(new ApiError(401, 'SESSION_REVOKED', 'fixture'));
    ws.onmessage?.({ data: JSON.stringify({ event: 'notifications:reauthenticate' }) });
    await vi.advanceTimersByTimeAsync(0);
    expect(invalidated).toHaveBeenCalledWith('SESSION_REVOKED');
  });

  it('ignores a late authentication failure after disposal', async () => {
    let reject!: (error: Error) => void;
    mock.fetch.mockReturnValue(
      new Promise((_resolve, fail) => {
        reject = fail;
      }),
    );
    start();
    const ws = mock.sockets[0]!;
    ws.onmessage?.({ data: JSON.stringify({ event: 'notifications:reauthenticate' }) });
    dispose!();
    reject(new ApiError(401, 'SESSION_REVOKED', 'fixture'));
    await vi.advanceTimersByTimeAsync(0);
    expect(invalidated).not.toHaveBeenCalled();
  });
});
