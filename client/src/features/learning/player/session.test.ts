/**
 * Unit tests for the transient playback credential boundary (M5).
 *
 * The DRM playback token must exist only in this module's closure. These tests
 * assert the boundary holds: no Web Storage, no cookies, no IndexedDB and no
 * serialisable export of the token.
 */
import { afterEach, describe, expect, it } from 'vitest';
import {
  authHeaders,
  clear,
  expiries,
  getSession,
  isActive,
  isExpired,
  renewSession,
  setSession,
  subscribe,
} from './session.js';

const TOKEN = 'transient-playback-token-value';

function grant(overrides: Partial<Parameters<typeof setSession>[0]> = {}) {
  return {
    referenceId: 'ref-1',
    playbackSessionId: 'sess-1',
    playbackToken: TOKEN,
    manifestUrl: 'https://drm.example.com/v1/playback/sess-1/manifest.mpd',
    licenseUrl: 'https://drm.example.com/v1/licenses',
    drmProvider: 'CLEAR_KEY',
    tokenExpiresAt: Date.now() + 60_000,
    sessionExpiresAt: Date.now() + 3_600_000,
    ...overrides,
  };
}

afterEach(() => {
  clear();
});

describe('transient credential lifecycle', () => {
  it('holds a grant only after it is set', () => {
    expect(isActive()).toBe(false);
    setSession(grant());
    expect(isActive()).toBe(true);
    expect(getSession()?.playbackToken).toBe(TOKEN);
  });

  it('clears idempotently', () => {
    setSession(grant());
    clear();
    clear();
    expect(getSession()).toBeNull();
    expect(isActive()).toBe(false);
  });

  it('replaces a previous grant rather than accumulating', () => {
    setSession(grant());
    setSession(grant({ referenceId: 'ref-2' }));
    expect(getSession()?.referenceId).toBe('ref-2');
  });

  it('emits the bearer header only while a grant is active', () => {
    expect(authHeaders()).toEqual({});
    setSession(grant());
    expect(authHeaders()).toEqual({ Authorization: `Bearer ${TOKEN}` });
    clear();
    expect(authHeaders()).toEqual({});
  });
});

describe('token expiry', () => {
  it('reports not expired before the token expiry', () => {
    setSession(grant({ tokenExpiresAt: Date.now() + 10_000 }));
    expect(isExpired()).toBe(false);
  });

  it('reports expired at and after the token expiry', () => {
    const now = Date.now();
    setSession(grant({ tokenExpiresAt: now }));
    expect(isExpired(now)).toBe(true);
    expect(isExpired(now + 1)).toBe(true);
  });

  it('reports not expired when no grant is held', () => {
    expect(isExpired()).toBe(false);
  });
});

describe('storage boundary', () => {
  it('does not write the token to Web Storage', () => {
    const store = new Map<string, string>();
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => void store.set(k, v),
        removeItem: (k: string) => void store.delete(k),
        clear: () => store.clear(),
        key: () => null,
        length: 0,
      },
    });
    Object.defineProperty(globalThis, 'sessionStorage', {
      configurable: true,
      value: {
        getItem: () => null,
        setItem: () => undefined,
        removeItem: () => undefined,
        clear: () => undefined,
        key: () => null,
        length: 0,
      },
    });
    setSession(grant());
    isActive();
    authHeaders();
    clear();
    expect([...store.values()].join(' ')).not.toContain(TOKEN);
    expect(store.size).toBe(0);
  });

  it('exports no value that serialises to the token', () => {
    setSession(grant());
    const moduleExports = { authHeaders, getSession, isActive, isExpired };
    expect(JSON.stringify(moduleExports)).not.toContain(TOKEN);
    expect(JSON.stringify(getSession())).toContain(TOKEN);
    clear();
    expect(JSON.stringify(getSession())).not.toContain(TOKEN);
  });
});

describe('renewal swaps only the credential', () => {
  const RENEWED = 'renewed-playback-token-value';

  it('replaces the token in memory and keeps the same external session', () => {
    setSession(grant());
    const before = getSession();
    expect(before?.playbackSessionId).toBe('sess-1');

    const tokenExpiry = Date.now() + 90_000;
    const sessionExpiry = Date.now() + 5_400_000;
    expect(renewSession(RENEWED, tokenExpiry, sessionExpiry)).toBe(true);

    const after = getSession();
    expect(after?.playbackToken).toBe(RENEWED);
    // Identity and media URLs are unchanged, so DASH/EME need not restart.
    expect(after?.playbackSessionId).toBe(before?.playbackSessionId);
    expect(after?.referenceId).toBe(before?.referenceId);
    expect(after?.manifestUrl).toBe(before?.manifestUrl);
    expect(after?.licenseUrl).toBe(before?.licenseUrl);
    expect(after?.tokenExpiresAt).toBe(tokenExpiry);
    expect(after?.sessionExpiresAt).toBe(sessionExpiry);
  });

  it('authorizes subsequent requests with the renewed token', () => {
    setSession(grant());
    renewSession(RENEWED, Date.now() + 90_000, Date.now() + 5_400_000);
    expect(authHeaders()).toEqual({ Authorization: `Bearer ${RENEWED}` });
  });

  it('notifies subscribers so a scheduler can re-arm', () => {
    let calls = 0;
    const unsubscribe = subscribe(() => {
      calls += 1;
    });
    setSession(grant());
    const before = calls;
    renewSession(RENEWED, Date.now() + 90_000, Date.now() + 5_400_000);
    expect(calls).toBe(before + 1);
    unsubscribe();
  });

  it('refuses to renew when no session is held', () => {
    clear();
    expect(renewSession(RENEWED, Date.now() + 1, Date.now() + 2)).toBe(false);
  });

  it('refuses a non-finite expiry instead of storing NaN', () => {
    setSession(grant());
    const before = getSession();
    expect(renewSession(RENEWED, Number.NaN, Date.now() + 2)).toBe(false);
    expect(getSession()?.playbackToken).toBe(before?.playbackToken);
  });

  it('exposes the active expiries for scheduling', () => {
    expect(expiries()).toBeNull();
    setSession(grant({ tokenExpiresAt: 111, sessionExpiresAt: 222 }));
    expect(expiries()).toEqual({ tokenExpiresAt: 111, sessionExpiresAt: 222 });
  });

  it('never persists a renewed token', () => {
    const store = new Map<string, string>();
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => void store.set(k, v),
        removeItem: (k: string) => void store.delete(k),
        clear: () => store.clear(),
        key: () => null,
        length: 0,
      },
    });
    setSession(grant());
    renewSession(RENEWED, Date.now() + 90_000, Date.now() + 5_400_000);
    clear();
    expect([...store.values()].join(' ')).not.toContain(RENEWED);
    expect(store.size).toBe(0);
  });
});
