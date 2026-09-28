import { describe, expect, it } from 'vitest';
import {
  accessCookie,
  clearAuthCookies,
  csrfCookie,
  parseCookies,
  refreshCookie,
  ACCESS_COOKIE,
  ACCESS_PATH,
  CSRF_COOKIE,
  CSRF_PATH,
  REFRESH_COOKIE,
  REFRESH_PATH,
} from '../../src/modules/identity/cookies.js';

describe('cookie contract', () => {
  it('sets names, paths, HttpOnly, SameSite and lifetimes (dev: no Secure)', () => {
    const access = accessCookie('jwt.value.here', { secure: false });
    expect(access).toContain(`${ACCESS_COOKIE}=jwt.value.here`);
    expect(access).toContain(`Path=${ACCESS_PATH}`);
    expect(access).toContain('HttpOnly');
    expect(access).toContain('SameSite=Lax');
    expect(access).toContain('Max-Age=900');
    expect(access).not.toContain('Secure');

    const refresh = refreshCookie('secret', 1234, { secure: false });
    expect(refresh).toContain(`${REFRESH_COOKIE}=secret`);
    expect(refresh).toContain(`Path=${REFRESH_PATH}`);
    expect(refresh).toContain('HttpOnly');
    expect(refresh).toContain('Max-Age=1234');

    const csrf = csrfCookie('abc123', { secure: false });
    expect(csrf).toContain(`${CSRF_COOKIE}=abc123`);
    expect(csrf).toContain(`Path=${CSRF_PATH}`);
    expect(csrf).not.toContain('HttpOnly');
  });

  it('sets Secure in production mode', () => {
    for (const serialized of [
      accessCookie('t', { secure: true }),
      refreshCookie('s', 60, { secure: true }),
      csrfCookie('c', { secure: true }),
    ]) {
      expect(serialized).toContain('Secure');
    }
  });

  it('clears with exactly matching paths and epoch expiry', () => {
    const cleared = clearAuthCookies({ secure: true });
    expect(cleared).toHaveLength(3);
    const joined = cleared.join('\n');
    expect(joined).toContain(`Path=${ACCESS_PATH}`);
    expect(joined).toContain(`Path=${REFRESH_PATH}`);
    expect(joined).toContain(`Path=${CSRF_PATH}`);
    for (const header of cleared) {
      expect(header).toContain('Max-Age=0');
      expect(header).toContain('Expires=Thu, 01 Jan 1970 00:00:00 GMT');
    }
  });

  it('parses only platform cookies and round-trips values', () => {
    const parsed = parseCookies('edu_access=a.b.c; edu_refresh=s3cr3t; edu_csrf=ff00; Other=ignored; junk');
    expect(parsed).toEqual({ edu_access: 'a.b.c', edu_refresh: 's3cr3t', edu_csrf: 'ff00' });
    expect(parseCookies(undefined)).toEqual({});
  });
});
