import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from '../../src/modules/identity/password.js';
import {
  generateRefreshSecret,
  sha256Hex,
  signAccessToken,
  verifyAccessToken,
} from '../../src/modules/identity/tokens.js';
import { issueCsrfToken, verifyAnonymousCsrf, verifySessionCsrf, csrfDigest } from '../../src/modules/identity/csrf.js';
import { ApiError } from '../../src/modules/identity/errors.js';

const FAST_ARGON = { memoryKb: 1024, timeCost: 1, parallelism: 1 };
const TOKEN_CONFIG = { secret: 'test-secret-that-is-long-enough-32', issuer: 'edu-test', audience: 'edu-web' };

describe('argon2id password hashing', () => {
  it('hashes to argon2id and verifies (wrong password fails)', async () => {
    const hash = await hashPassword('correct horse battery staple', FAST_ARGON);
    expect(hash.startsWith('$argon2id$')).toBe(true);
    expect(hash).not.toContain('correct horse');
    expect(await verifyPassword(hash, 'correct horse battery staple')).toBe(true);
    expect(await verifyPassword(hash, 'wrong password here!')).toBe(false);
    expect(await verifyPassword('not-a-hash', 'whatever password')).toBe(false);
  });
});

describe('access tokens', () => {
  it('round-trips sub/role/sid/jti with issuer/audience', () => {
    const at = 1_700_000_000_000;
    const { token, jti } = signAccessToken({ sub: 'user-1', role: 'STUDENT', sid: 'sess-1' }, TOKEN_CONFIG, at);
    const claims = verifyAccessToken(token, TOKEN_CONFIG, at);
    expect(claims).toMatchObject({ sub: 'user-1', role: 'STUDENT', sid: 'sess-1', jti });
  });

  it('rejects expiry via injected time (no sleeps)', () => {
    const at = 1_700_000_000_000;
    const { token } = signAccessToken({ sub: 'u', role: 'ADMIN', sid: 's' }, TOKEN_CONFIG, at);
    expect(() => verifyAccessToken(token, TOKEN_CONFIG, at + 15 * 60 * 1000 + 1000)).toThrowError(
      expect.objectContaining({ code: 'SESSION_EXPIRED' }),
    );
  });

  it('rejects wrong secret, issuer, audience, and malformed tokens', () => {
    const at = 1_700_000_000_000;
    const { token } = signAccessToken({ sub: 'u', role: 'STUDENT', sid: 's' }, TOKEN_CONFIG, at);
    expect(() => verifyAccessToken(token, { ...TOKEN_CONFIG, secret: 'x'.repeat(32) }, at)).toThrowError(
      expect.objectContaining({ code: 'TOKEN_INVALID' }),
    );
    expect(() => verifyAccessToken(token, { ...TOKEN_CONFIG, issuer: 'evil' }, at)).toThrowError(
      expect.objectContaining({ code: 'TOKEN_INVALID' }),
    );
    expect(() => verifyAccessToken(token, { ...TOKEN_CONFIG, audience: 'evil' }, at)).toThrowError(
      expect.objectContaining({ code: 'TOKEN_INVALID' }),
    );
    expect(() => verifyAccessToken('garbage.token.here', TOKEN_CONFIG, at)).toThrowError(
      expect.objectContaining({ code: 'TOKEN_INVALID' }),
    );
  });
});

describe('refresh secrets', () => {
  it('carry 256 bits of randomness; only digests persist', () => {
    const a = generateRefreshSecret();
    const b = generateRefreshSecret();
    expect(a).not.toBe(b);
    expect(Buffer.from(a, 'base64url').length).toBe(32);
    expect(sha256Hex(a)).toMatch(/^[0-9a-f]{64}$/);
    expect(sha256Hex(a)).not.toContain(a);
  });
});

describe('csrf synchronizer', () => {
  it('issues 256-bit values and double-submits them', () => {
    const token = issueCsrfToken();
    expect(token).toMatch(/^[0-9a-f]{64}$/);
    expect(verifyAnonymousCsrf(token, token)).toBe(token);
    expect(() => verifyAnonymousCsrf(token, issueCsrfToken())).toThrowError(
      expect.objectContaining({ code: 'CSRF_INVALID' }),
    );
    expect(() => verifyAnonymousCsrf(undefined, token)).toThrowError(
      expect.objectContaining({ code: 'CSRF_INVALID' }),
    );
  });

  it('binds to the session digest', () => {
    const token = issueCsrfToken();
    expect(verifySessionCsrf(token, token, csrfDigest(token))).toBe(token);
    expect(() => verifySessionCsrf(token, token, csrfDigest(issueCsrfToken()))).toThrowError(
      expect.objectContaining({ code: 'CSRF_INVALID' }),
    );
    expect(() => verifySessionCsrf(token, token, null)).toThrowError(
      expect.objectContaining({ code: 'CSRF_INVALID' }),
    );
  });

  it('ApiError carries status without secrets', () => {
    const err = new ApiError(403, 'CSRF_INVALID', 'Request verification failed.');
    expect(err.status).toBe(403);
    expect(JSON.stringify(err)).not.toContain('secret');
  });
});
