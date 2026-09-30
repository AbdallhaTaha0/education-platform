/**
 * Unit tests for the M5 playback assertion, dependency URL validation and
 * DRM response validation. No network, no credentials, no dependency calls.
 */
import { describe, expect, it } from 'vitest';
import { generateKeyPairSync } from 'node:crypto';
import jwt from 'jsonwebtoken';
import {
  createAssertionJwks,
  mintAssertion,
  type AssertionConfig,
} from '../../src/modules/learning/playback/assertion.js';
import { resolveDependencyUrls } from '../../src/modules/learning/playback/urls.js';
import {
  toWatermarkPresentation,
  validatePlaybackSession,
  validateRenewal,
} from '../../src/modules/learning/playback/schemas.js';
import { LearningError } from '../../src/modules/learning/errors.js';
import type { LearningBinding } from '../../src/modules/learning/types.js';

const NOW = Date.parse('2026-09-30T12:00:00.000Z');
const { privateKey: PRIVATE_KEY, publicKey: PUBLIC_KEY } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  publicKeyEncoding: { type: 'spki', format: 'pem' },
});

const config: AssertionConfig = {
  algorithm: 'RS256',
  signingKey: PRIVATE_KEY,
  keyId: 'm5-unit-key',
  issuer: 'https://platform.example.com',
  audience: 'drm-service',
  maxLifetimeSec: 120,
  applicationId: 'platform-client',
};

const binding: LearningBinding = {
  studentId: 'student-1',
  courseId: 'course-1',
  courseSlug: 'slug-1',
  lessonId: 'lesson-1',
  externalAssetId: 'edu-asset-1',
  externalAssetIdInternal: 'uuid-1',
};

function decode(token: string): Record<string, unknown> {
  return jwt.decode(token) as Record<string, unknown>;
}

describe('playback assertion', () => {
  it('carries exactly the documented claims from trusted records', () => {
    const { token } = mintAssertion(config, binding, NOW, 'device-1');
    const claims = decode(token);
    expect(claims['iss']).toBe('https://platform.example.com');
    expect(claims['aud']).toBe('drm-service');
    expect(claims['sub']).toBe('student-1');
    expect(claims['app']).toBe('platform-client');
    expect(claims['course']).toBe('course-1');
    expect(claims['lesson']).toBe('lesson-1');
    expect(claims['asset']).toBe('edu-asset-1');
    expect(claims['device']).toBe('device-1');
    expect(typeof claims['iat']).toBe('number');
    expect(typeof claims['exp']).toBe('number');
    expect(typeof claims['jti']).toBe('string');
  });

  it('never includes the DRM internal asset id or the course slug', () => {
    const claims = decode(mintAssertion(config, binding, NOW).token);
    expect(claims['asset']).not.toBe('uuid-1');
    expect(Object.values(claims)).not.toContain('slug-1');
  });

  it('caps the lifetime at the configured maximum', () => {
    const { token, expiresAt } = mintAssertion({ ...config, maxLifetimeSec: 60_000 }, binding, NOW);
    const claims = decode(token);
    expect((claims['exp'] as number) - (claims['iat'] as number)).toBeLessThanOrEqual(300);
    expect(expiresAt.getTime()).toBe((claims['exp'] as number) * 1000);
  });

  it('issues a unique jti per assertion', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 25; i += 1) {
      ids.add(decode(mintAssertion(config, binding, NOW + i).token)['jti'] as string);
    }
    expect(ids.size).toBe(25);
  });

  it('signs with the server-only private key and verifies with the public key', () => {
    const { token } = mintAssertion(config, binding, NOW);
    expect(jwt.verify(token, PUBLIC_KEY, { algorithms: ['RS256'], clockTimestamp: NOW / 1000 })).toBeTruthy();
    expect(jwt.decode(token, { complete: true })?.header).toMatchObject({ alg: 'RS256', kid: 'm5-unit-key' });
  });

  it('rejects a weak signing configuration instead of minting', () => {
    expect(() => mintAssertion({ ...config, signingKey: 'short' }, binding, NOW)).toThrow(LearningError);
  });

  it('publishes only the corresponding RSA public key through JWKS', () => {
    const jwks = createAssertionJwks(config);
    expect(jwks?.keys).toHaveLength(1);
    expect(jwks?.keys[0]).toMatchObject({ kty: 'RSA', kid: 'm5-unit-key', use: 'sig', alg: 'RS256' });
    expect(jwks?.keys[0]).not.toHaveProperty('d');
    expect(JSON.stringify(jwks)).not.toContain('PRIVATE KEY');
  });

  it('refuses a claim value that could forge a header', () => {
    expect(() => mintAssertion(config, { ...binding, courseId: 'a\r\nb' }, NOW)).toThrow(LearningError);
  });
});

describe('dependency URL validation', () => {
  it('resolves a relative manifest and license against the configured origin', () => {
    const urls = resolveDependencyUrls(
      '/v1/playback/abc/manifest.mpd',
      '/v1/licenses',
      'https://drm.example.com',
    );
    expect(urls.manifestUrl).toBe('https://drm.example.com/v1/playback/abc/manifest.mpd');
    expect(urls.licenseUrl).toBe('https://drm.example.com/v1/licenses');
  });

  it('accepts an absolute URL on the configured origin', () => {
    const urls = resolveDependencyUrls('https://drm.example.com/a.mpd', 'https://drm.example.com/l', 'https://drm.example.com');
    expect(urls.manifestUrl).toBe('https://drm.example.com/a.mpd');
  });

  it('rejects a foreign origin so a dependency cannot redirect the player', () => {
    expect(() =>
      resolveDependencyUrls('https://evil.example.net/a.mpd', '/v1/licenses', 'https://drm.example.com'),
    ).toThrow(LearningError);
  });

  it('rejects a non-http protocol', () => {
    expect(() =>
      resolveDependencyUrls('javascript:alert(1)', '/v1/licenses', 'https://drm.example.com'),
    ).toThrow(LearningError);
  });

  it('rejects embedded credentials', () => {
    expect(() =>
      resolveDependencyUrls('https://user:pass@drm.example.com/a.mpd', '/v1/licenses', 'https://drm.example.com'),
    ).toThrow(LearningError);
  });

  it('rejects traversal and control characters', () => {
    expect(() => resolveDependencyUrls('/v1/../../etc/passwd', '/v1/licenses', 'https://drm.example.com')).toThrow(
      LearningError,
    );
    expect(() => resolveDependencyUrls('/v1/a\nb', '/v1/licenses', 'https://drm.example.com')).toThrow(LearningError);
  });

  it('fails closed when no browser-facing origin is configured', () => {
    expect(() => resolveDependencyUrls('/v1/a.mpd', '/v1/licenses', undefined)).toThrow(LearningError);
  });
});

describe('DRM playback response validation', () => {
  const valid = {
    playbackSessionId: '11111111-1111-4111-8111-111111111111',
    playbackToken: 'transient-playback-token-value',
    tokenExpiresAt: '2026-09-30T12:05:00.000Z',
    sessionExpiresAt: '2026-09-30T13:00:00.000Z',
    manifestUrl: '/v1/playback/11111111-1111-4111-8111-111111111111/manifest.mpd',
    licenseUrl: '/v1/licenses',
    drmProvider: 'CLEAR_KEY',
    watermark: null,
  };

  it('accepts a well-formed response', () => {
    const out = validatePlaybackSession(valid);
    expect(out.playbackSessionId).toBe(valid.playbackSessionId);
    expect(out.playbackToken).toBe(valid.playbackToken);
  });

  it('rejects a non-UUID session id', () => {
    expect(() => validatePlaybackSession({ ...valid, playbackSessionId: 'nope' })).toThrow(LearningError);
  });

  it('rejects an unknown provider rather than silently downgrading', () => {
    expect(() => validatePlaybackSession({ ...valid, drmProvider: 'SOMETHING_ELSE' })).toThrow(LearningError);
  });

  it('rejects a missing or malformed token', () => {
    expect(() => validatePlaybackSession({ ...valid, playbackToken: '' })).toThrow(LearningError);
    const { playbackToken: _omit, ...withoutToken } = valid;
    expect(() => validatePlaybackSession(withoutToken)).toThrow(LearningError);
  });

  it('rejects unparsable expiry timestamps', () => {
    expect(() => validatePlaybackSession({ ...valid, tokenExpiresAt: 'not-a-date' })).toThrow(LearningError);
  });

  it('rejects a non-object body', () => {
    expect(() => validatePlaybackSession('nope')).toThrow(LearningError);
    expect(() => validatePlaybackSession(null)).toThrow(LearningError);
  });
});

describe('watermark presentation', () => {
  it('projects the real signed DRM payload without exposing signature or trace fields', () => {
    const out = toWatermarkPresentation({ payload: {
      maskedIdentity: 'ab***yz', sessionRef: 'private-session', assetRef: 'private-asset',
      traceCode: 'private-trace', issuedAt: 1700000000, expiresAt: 1700003600,
      positions: [{ x: 10, y: 20, intervalSeconds: 25 }],
    }, signature: 'private-signature' });
    expect(out).toEqual({ type: 'MASKED', maskedIdentity: 'ab***yz',
      positions: [{ x: 10, y: 20 }], expiresAt: '2023-11-14T23:13:20.000Z' });
    expect(JSON.stringify(out)).not.toContain('private-');
    expect(JSON.stringify(out)).not.toContain('intervalSeconds');
  });
  it('exposes only renderable fields and never the signature or trace code', () => {
    const out = toWatermarkPresentation({
      type: 'MASKED',
      maskedIdentity: 'user-***@example',
      positions: [{ x: 20, y: 30 }],
      traceCode: 'trace-abc',
      signature: 'sig-abc',
      expiresAt: '2026-09-30T13:00:00.000Z',
    });
    expect(out).not.toBeNull();
    expect(out?.maskedIdentity).toBe('user-***@example');
    expect(out?.positions).toEqual([{ x: 20, y: 30 }]);
    expect(JSON.stringify(out)).not.toContain('trace-abc');
    expect(JSON.stringify(out)).not.toContain('sig-abc');
  });

  it('clamps out-of-range positions and bounds the count', () => {
    const positions = Array.from({ length: 40 }, () => ({ x: 500, y: -20 }));
    const out = toWatermarkPresentation({ type: 'M', maskedIdentity: 'a', positions });
    expect(out?.positions.length).toBe(12);
    expect(out?.positions[0]).toEqual({ x: 100, y: 0 });
  });

  it('returns null when the dependency supplied no watermark', () => {
    expect(toWatermarkPresentation(null)).toBeNull();
  });
});

describe('renewal response validation', () => {
  const valid = {
    playbackToken: 'renewed-transient-token-value',
    tokenExpiresAt: '2026-09-30T12:05:00.000Z',
    sessionExpiresAt: '2026-09-30T13:00:00.000Z',
  };

  it('accepts a well-formed renewal and forwards only credential fields', () => {
    const out = validateRenewal(valid);
    expect(out.renewed).toBe(true);
    expect(out.playbackToken).toBe(valid.playbackToken);
    expect(Object.keys(out).sort()).toEqual(
      ['playbackToken', 'renewed', 'sessionExpiresAt', 'tokenExpiresAt'].sort(),
    );
  });

  it('accepts the legacy token field name', () => {
    const out = validateRenewal({ ...valid, token: valid.playbackToken, playbackToken: undefined });
    expect(out.renewed).toBe(true);
    expect(out.playbackToken).toBe(valid.playbackToken);
  });

  it('reports a dead session instead of failing the schema', () => {
    for (const status of ['ended', 'revoked', 'expired']) {
      const out = validateRenewal({ status });
      expect(out.renewed).toBe(false);
    }
  });

  it('rejects a missing or malformed token', () => {
    expect(() => validateRenewal({ ...valid, playbackToken: '' })).toThrow(LearningError);
    expect(() => validateRenewal({ ...valid, playbackToken: 'short' })).toThrow(LearningError);
    const { playbackToken: _omit, ...withoutToken } = valid;
    expect(() => validateRenewal(withoutToken)).toThrow(LearningError);
  });

  it('rejects unparsable expiry timestamps', () => {
    expect(() => validateRenewal({ ...valid, tokenExpiresAt: 'not-a-date' })).toThrow(LearningError);
  });

  it('rejects a non-object body', () => {
    expect(() => validateRenewal('nope')).toThrow(LearningError);
    expect(() => validateRenewal(null)).toThrow(LearningError);
  });
});
