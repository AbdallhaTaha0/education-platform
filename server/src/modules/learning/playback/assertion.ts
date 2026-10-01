/**
 * Server-side playback assertion (M5).
 *
 * The platform is the issuer of the short-lived assertion the external DRM
 * verifies (see drm-integration.md). Claims come exclusively from trusted
 * platform records resolved in access/service.ts:
 *
 *   iss, aud, sub, app, course, lesson, asset, iat, exp, jti (+ optional device)
 *
 * `app` is the DRM client id. `sub` is the platform student id. `asset` is the
 * MediaMapping external asset id. The signing key and the DRM application
 * secret are server-only and never returned, logged, or audited.
 */
import { createPrivateKey, createPublicKey, randomUUID } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { LearningError } from '../errors.js';
import type { LearningBinding } from '../types.js';

export interface AssertionConfig {
  algorithm: 'HS256' | 'RS256';
  signingKey: string;
  keyId?: string;
  issuer: string;
  audience: string;
  maxLifetimeSec: number;
  /** DRM application (client) id; becomes the `app` claim. */
  applicationId: string;
}

export interface MintedAssertion {
  token: string;
  expiresAt: Date;
  jti: string;
}

/** All claims are validated as short, non-empty, single-line strings. */
function claim(value: string, field: string, maxLen = 255): string {
  if (typeof value !== 'string') throw new LearningError('VALIDATION_ERROR');
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > maxLen || /[\r\n]/.test(trimmed)) {
    throw new LearningError('VALIDATION_ERROR', `Invalid assertion claim: ${field}`);
  }
  return trimmed;
}

export function mintAssertion(
  config: AssertionConfig,
  binding: LearningBinding,
  nowMs: number,
  deviceId?: string,
): MintedAssertion {
  if (config.signingKey.length < 32) {
    throw new LearningError('PLAYBACK_UNAVAILABLE', 'Assertion signing is not configured.');
  }
  const issuedAt = Math.floor(nowMs / 1000);
  const lifetime = Math.max(1, Math.min(config.maxLifetimeSec, 300));
  const expiresAt = new Date((issuedAt + lifetime) * 1000);
  const jti = randomUUID();

  const payload: Record<string, unknown> = {
    iss: claim(config.issuer, 'iss'),
    aud: claim(config.audience, 'aud'),
    sub: claim(binding.studentId, 'sub'),
    app: claim(config.applicationId, 'app'),
    course: claim(binding.courseId, 'course'),
    lesson: claim(binding.lessonId, 'lesson'),
    asset: claim(binding.externalAssetId, 'asset'),
    iat: issuedAt,
    nbf: issuedAt,
    exp: issuedAt + lifetime,
    jti,
  };
  if (deviceId !== undefined) payload['device'] = claim(deviceId, 'device', 128);

  const token = jwt.sign(payload, config.signingKey, {
    algorithm: config.algorithm,
    ...(config.algorithm === 'RS256' ? { keyid: claim(config.keyId ?? '', 'kid', 64) } : {}),
  });
  return { token, expiresAt, jti };
}

/** Export only the public RSA material the external DRM verifier needs. */
export function createAssertionJwks(
  config: AssertionConfig,
): { keys: Array<Record<string, unknown>> } | null {
  if (config.algorithm !== 'RS256') return null;
  try {
    const privateKey = createPrivateKey(config.signingKey);
    const jwk = createPublicKey(privateKey).export({ format: 'jwk' });
    return {
      keys: [{ ...jwk, kid: claim(config.keyId ?? '', 'kid', 64), use: 'sig', alg: 'RS256' }],
    };
  } catch {
    throw new LearningError('PLAYBACK_UNAVAILABLE', 'Assertion signing is not configured.');
  }
}
