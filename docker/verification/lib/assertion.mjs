/**
 * Minimal RS256 playback-assertion signer for the test-only live harness.
 *
 * The private key is read from the environment and the resulting assertion is
 * returned only to the caller. Neither value is logged or persisted here.
 */
import crypto from 'node:crypto';

export function createPlaybackAssertion(env, input) {
  const required = [
    'DRM_ASSERTION_ISSUER',
    'DRM_ASSERTION_AUDIENCE',
    'DRM_ASSERTION_PRIVATE_KEY_B64',
    'DRM_ASSERTION_KEY_ID',
  ];
  const missing = required.filter((name) => !env[name]);
  if (missing.length > 0) {
    throw new Error(`missing assertion configuration: ${missing.join(', ')}`);
  }

  const now = Math.floor(Date.now() / 1000);
  const lifetime = Number(env.DRM_ASSERTION_MAX_LIFETIME_SEC || 120);
  if (!Number.isSafeInteger(lifetime) || lifetime < 1 || lifetime > 300) {
    throw new Error('DRM_ASSERTION_MAX_LIFETIME_SEC must be between 1 and 300');
  }

  const header = {
    alg: 'RS256',
    typ: 'JWT',
    kid: input.keyId || env.DRM_ASSERTION_KEY_ID,
  };
  const payload = {
    iss: input.issuer || env.DRM_ASSERTION_ISSUER,
    aud: input.audience || env.DRM_ASSERTION_AUDIENCE,
    sub: input.userId,
    app: input.applicationId,
    course: input.courseId,
    lesson: input.lessonId,
    asset: input.assetId,
    device: input.deviceId,
    iat: input.issuedAt || now,
    nbf: input.notBefore || now - 1,
    exp: input.expiresAt || now + lifetime,
    jti: input.jti || crypto.randomUUID(),
  };
  const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const privatePem = Buffer.from(env.DRM_ASSERTION_PRIVATE_KEY_B64, 'base64').toString('utf8');
  const signature = crypto
    .sign('RSA-SHA256', Buffer.from(signingInput), privatePem)
    .toString('base64url');
  return `${signingInput}.${signature}`;
}
