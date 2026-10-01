import { randomBytes, timingSafeEqual } from 'node:crypto';
import { ApiError } from './errors.js';
import { sha256Hex } from './tokens.js';

export const CSRF_HEADER = 'x-csrf-token';
const CSRF_TOKEN_BYTES = 32;
const CSRF_TOKEN_PATTERN = /^[0-9a-f]{64}$/;

/** Issue a fresh 256-bit CSRF value (hex). Carries no authentication
 * credential; it is bound to the session via its stored digest. */
export function issueCsrfToken(): string {
  return randomBytes(CSRF_TOKEN_BYTES).toString('hex');
}

export function csrfDigest(token: string): string {
  return sha256Hex(token);
}

function sameValue(a: string, b: string): boolean {
  const ab = Buffer.from(a, 'utf8');
  const bb = Buffer.from(b, 'utf8');
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/**
 * Double-submit check for pre-session requests (register/login): the header
 * must equal the readable cookie, both well-formed. A cross-site attacker
 * cannot read the cookie value, so it cannot forge the header.
 */
export function verifyAnonymousCsrf(
  headerValue: string | undefined,
  cookieValue: string | undefined,
): string {
  if (
    !headerValue ||
    !cookieValue ||
    !CSRF_TOKEN_PATTERN.test(headerValue) ||
    !sameValue(headerValue, cookieValue)
  ) {
    throw new ApiError(403, 'CSRF_INVALID', 'Request verification failed.');
  }
  return headerValue;
}

/**
 * Session-bound check: double-submit plus binding to the session's stored
 * digest. Rotation re-binds on every refresh, so a leaked value dies fast.
 */
export function verifySessionCsrf(
  headerValue: string | undefined,
  cookieValue: string | undefined,
  sessionCsrfHash: string | null,
): string {
  const token = verifyAnonymousCsrf(headerValue, cookieValue);
  if (!sessionCsrfHash || !sameValue(csrfDigest(token), sessionCsrfHash)) {
    throw new ApiError(403, 'CSRF_INVALID', 'Request verification failed.');
  }
  return token;
}
