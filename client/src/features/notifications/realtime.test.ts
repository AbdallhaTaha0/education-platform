import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { InboxStore } from './inbox';
const mock = vi.hoisted(() => {
  const listeners = new Map<string, (...args: any[]) => void>();
  return {
    listeners,
    fetch: vi.fn(),
    csrf: vi.fn(() => 'fixture-csrf'),
    io: vi.fn(),
    socket: {
      connected: false,
      connect: vi.fn(),
      disconnect: vi.fn(),
      removeAllListeners: vi.fn(() => listeners.clear()),
      on: vi.fn((event: string, fn: (...args: any[]) => void) => listeners.set(event, fn)),
    },
  };
});
vi.mock('socket.io-client', () => ({ io: mock.io }));
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
  const synchronize = vi.fn(),
    connection = vi.fn(),
    invalidated = vi.fn();
  function start() {
    dispose = connectInbox({ synchronize } as unknown as InboxStore, connection, invalidated);
  }
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    mock.listeners.clear();
    mock.io.mockReturnValue(mock.socket);
    mock.fetch.mockResolvedValue({});
    vi.stubGlobal('navigator', { onLine: true });
    vi.stubGlobal('document', { visibilityState: 'visible' });
  });
  afterEach(() => {
    dispose?.();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });
  it('uses same-origin WebSocket cookies and only the readable CSRF synchronizer in auth', () => {
    start();
    const [namespace, options] = mock.io.mock.calls[0];
    expect(namespace).toBe('/notifications');
    expect(options.path).toBe('/api/notifications/socket.io/');
    expect(options.transports).toEqual(['websocket']);
    const done = vi.fn();
    options.auth(done);
    expect(done).toHaveBeenCalledWith({ csrf: 'fixture-csrf' });
  });
  it('coalesces duplicate signals and always resynchronizes after reconnect', async () => {
    start();
    for (let i = 0; i < 10; i++)
      mock.listeners.get('notifications:changed')?.({ schemaVersion: 1, revision: '2' });
    await vi.advanceTimersByTimeAsync(100);
    expect(synchronize).toHaveBeenCalledTimes(1);
    mock.listeners.get('connect')?.();
    await vi.advanceTimersByTimeAsync(100);
    expect(synchronize).toHaveBeenCalledTimes(2);
  });
  it('ignores invalid revision envelopes and releases recovery timers on account disposal', async () => {
    start();
    mock.listeners.get('notifications:changed')?.({ schemaVersion: 1, revision: 'unsafe' });
    await vi.advanceTimersByTimeAsync(100);
    expect(synchronize).not.toHaveBeenCalled();
    dispose!();
    await vi.advanceTimersByTimeAsync(60000);
    expect(synchronize).not.toHaveBeenCalled();
    expect(mock.socket.disconnect).toHaveBeenCalled();
  });
  it('clears authentication only on a final HTTP authentication failure', async () => {
    start();
    mock.fetch.mockRejectedValue(new ApiError(401, 'SESSION_REVOKED', 'fixture'));
    mock.listeners.get('notifications:reauthenticate')?.();
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
    mock.listeners.get('notifications:reauthenticate')?.();
    dispose!();
    reject(new ApiError(401, 'SESSION_REVOKED', 'fixture'));
    await vi.advanceTimersByTimeAsync(0);
    expect(invalidated).not.toHaveBeenCalled();
  });
});
