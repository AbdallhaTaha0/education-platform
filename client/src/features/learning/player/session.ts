/**
 * Transient playback session state (M5).
 *
 * The DRM playback bearer token is a short-lived credential that exists ONLY in
 * this module's closure variable and the mounted player instance. It is never
 * written to localStorage, sessionStorage, IndexedDB, cookies, a URL, a log, or
 * an error message. A page reload or route change therefore loses it by
 * design, and the player must request a fresh grant.
 *
 * The `clear()` path is called on end, error, entitlement loss, logout and
 * unmount. Nothing here is serializable state on purpose.
 */

export interface TransientPlaybackSession {
  referenceId: string;
  playbackSessionId: string;
  playbackToken: string;
  manifestUrl: string;
  licenseUrl: string;
  drmProvider: string;
  tokenExpiresAt: number;
  sessionExpiresAt: number;
}

let current: TransientPlaybackSession | null = null;
const listeners = new Set<() => void>();

function notify(): void {
  for (const listener of listeners) listener();
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Store a freshly minted grant. Replaces any previous session. */
export function setSession(session: TransientPlaybackSession): void {
  current = session;
  notify();
}

/** Read the active session. Callers must not log the returned token. */
export function getSession(): TransientPlaybackSession | null {
  return current;
}

/** Authorization header for a manifest/segment/license request. */
export function authHeaders(): Record<string, string> {
  if (current === null) return {};
  return { Authorization: `Bearer ${current.playbackToken}` };
}

/** Drop the transient credential. Idempotent. */
export function clear(): void {
  if (current === null) return;
  current = null;
  notify();
}

export function isActive(): boolean {
  return current !== null;
}

/** True when the transient token has passed its own expiry. */
export function isExpired(nowMs = Date.now()): boolean {
  return current !== null && current.tokenExpiresAt <= nowMs;
}

/**
 * Swap in a renewed credential without rebuilding the session (M5 correction
 * round). Only the token and its expiry change: the reference, the external
 * session id and the media URLs are the same session, so DASH, EME and the media
 * element must not be disturbed. Nothing is persisted.
 */
export function renewSession(
  playbackToken: string,
  tokenExpiresAtMs: number,
  sessionExpiresAtMs: number,
): boolean {
  if (current === null) return false;
  if (!Number.isFinite(tokenExpiresAtMs) || !Number.isFinite(sessionExpiresAtMs)) return false;
  current = {
    ...current,
    playbackToken,
    tokenExpiresAt: tokenExpiresAtMs,
    sessionExpiresAt: sessionExpiresAtMs,
  };
  notify();
  return true;
}

/** Active expiry instants, for scheduling renewal before the token dies. */
export function expiries(): { tokenExpiresAt: number; sessionExpiresAt: number } | null {
  if (current === null) return null;
  return { tokenExpiresAt: current.tokenExpiresAt, sessionExpiresAt: current.sessionExpiresAt };
}
