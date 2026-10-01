/** Cookie contract (names fixed by M2 decisions).
 *
 * - edu_access:  HttpOnly, SameSite=Lax, path /api, 15-minute max age.
 * - edu_refresh: HttpOnly, SameSite=Lax, path /api/auth, bounded by the
 *   remaining absolute session lifetime (never extended by rotation).
 * - edu_csrf:    JavaScript-readable CSRF value ONLY (no credential),
 *   SameSite=Lax, path /, 1-day max age.
 * `Secure` is true in production and explicitly false for local Docker HTTP.
 * `Domain` is never set. Clearing reuses exactly matching attributes.
 *
 * Lifetime invariant: a session-bound CSRF cookie never outlives the
 * session's remaining absolute lifetime (callers pass the remaining
 * seconds); only the anonymous bootstrap uses the short standalone lifetime.
 */

export const ACCESS_COOKIE = 'edu_access';
export const REFRESH_COOKIE = 'edu_refresh';
export const CSRF_COOKIE = 'edu_csrf';
export const ACCESS_PATH = '/api';
export const REFRESH_PATH = '/api/auth';
export const CSRF_PATH = '/';
export const ACCESS_MAX_AGE_SEC = 15 * 60;
export const CSRF_MAX_AGE_SEC = 24 * 60 * 60;

export interface CookieFlags {
  secure: boolean;
}

function base(
  name: string,
  value: string,
  path: string,
  maxAgeSec: number,
  flags: CookieFlags,
  httpOnly: boolean,
): string {
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    `Path=${path}`,
    `Max-Age=${maxAgeSec}`,
    'SameSite=Lax',
  ];
  if (httpOnly) parts.push('HttpOnly');
  if (flags.secure) parts.push('Secure');
  return parts.join('; ');
}

export function accessCookie(token: string, flags: CookieFlags): string {
  return base(ACCESS_COOKIE, token, ACCESS_PATH, ACCESS_MAX_AGE_SEC, flags, true);
}

export function refreshCookie(secret: string, maxAgeSec: number, flags: CookieFlags): string {
  return base(
    REFRESH_COOKIE,
    secret,
    REFRESH_PATH,
    Math.max(0, Math.floor(maxAgeSec)),
    flags,
    true,
  );
}

export function csrfCookie(
  token: string,
  flags: CookieFlags,
  maxAgeSec: number = CSRF_MAX_AGE_SEC,
): string {
  return base(CSRF_COOKIE, token, CSRF_PATH, Math.max(1, Math.floor(maxAgeSec)), flags, false);
}

function clear(name: string, path: string, flags: CookieFlags, httpOnly: boolean): string {
  const cleared = base(name, '', path, 0, flags, httpOnly);
  return `${cleared}; Expires=Thu, 01 Jan 1970 00:00:00 GMT`;
}

export function clearAuthCookies(flags: CookieFlags): string[] {
  return [
    clear(ACCESS_COOKIE, ACCESS_PATH, flags, true),
    clear(REFRESH_COOKIE, REFRESH_PATH, flags, true),
    clear(CSRF_COOKIE, CSRF_PATH, flags, false),
  ];
}

/** Minimal cookie-header parser for the three platform cookies. Values are
 * decodeURIComponent-decoded to mirror the encoder above. */
export function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx <= 0) continue;
    const name = part.slice(0, idx).trim();
    if (name !== ACCESS_COOKIE && name !== REFRESH_COOKIE && name !== CSRF_COOKIE) continue;
    try {
      out[name] = decodeURIComponent(part.slice(idx + 1).trim());
    } catch {
      out[name] = part.slice(idx + 1).trim();
    }
  }
  return out;
}
