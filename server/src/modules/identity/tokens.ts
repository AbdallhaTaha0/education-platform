import { createHash, randomBytes, randomUUID } from 'node:crypto';
import jwt, { type JwtPayload } from 'jsonwebtoken';
import { ApiError } from './errors.js';

/** Lifetimes (seconds). Fixed by confirmed M2 decisions. */
export const ACCESS_TOKEN_TTL_SEC = 15 * 60;
export const REFRESH_ABSOLUTE_TTL_SEC = 30 * 24 * 60 * 60;

export type Clock = () => number;

export interface AccessTokenClaims {
  sub: string;
  role: 'STUDENT' | 'ADMIN';
  sid: string;
  jti: string;
}

export interface TokenConfig {
  secret: string;
  issuer: string;
  audience: string;
}

export function signAccessToken(
  claims: Omit<AccessTokenClaims, 'jti'>,
  config: TokenConfig,
  nowMs: number = Date.now(),
): { token: string; jti: string } {
  const jti = randomUUID();
  // Explicit iat/exp bound to the caller's clock (default: wall time) so
  // minted and verified timestamps stay coherent under injected test time.
  // noTimestamp prevents jsonwebtoken from substituting wall-clock iat.
  const iat = Math.floor(nowMs / 1000);
  const token = jwt.sign(
    {
      sub: claims.sub,
      role: claims.role,
      sid: claims.sid,
      jti,
      iat,
      exp: iat + ACCESS_TOKEN_TTL_SEC,
    },
    config.secret,
    { algorithm: 'HS256', issuer: config.issuer, audience: config.audience, noTimestamp: true },
  );
  return { token, jti };
}

export function verifyAccessToken(
  token: string,
  config: TokenConfig,
  nowMs: number = Date.now(),
): AccessTokenClaims {
  let payload: JwtPayload;
  try {
    const decoded = jwt.verify(token, config.secret, {
      algorithms: ['HS256'],
      issuer: config.issuer,
      audience: config.audience,
      clockTimestamp: Math.floor(nowMs / 1000),
    });
    if (typeof decoded === 'string' || decoded === null) {
      throw new ApiError(401, 'TOKEN_INVALID', 'Session is invalid.');
    }
    payload = decoded;
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      throw new ApiError(401, 'SESSION_EXPIRED', 'Session has expired.');
    }
    throw new ApiError(401, 'TOKEN_INVALID', 'Session is invalid.');
  }
  const { sub, role, sid, jti } = payload as Record<string, unknown>;
  if (typeof sub !== 'string' || typeof sid !== 'string' || typeof jti !== 'string') {
    throw new ApiError(401, 'TOKEN_INVALID', 'Session is invalid.');
  }
  if (role !== 'STUDENT' && role !== 'ADMIN') {
    throw new ApiError(401, 'TOKEN_INVALID', 'Session is invalid.');
  }
  return { sub, role, sid, jti };
}

/** 256-bit refresh secret, base64url (no padding). Raw values never persist. */
export function generateRefreshSecret(): string {
  return randomBytes(32).toString('base64url');
}

/** Digest stored in the database instead of the raw secret. */
export function sha256Hex(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}
