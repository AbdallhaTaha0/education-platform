/**
 * Stage: harness self-test (TEST-ONLY).
 *
 * Verifies the harness's own safety guards with no network access and no
 * credentials. It must pass before any live stage is attempted: if the prefix
 * guard or the sanitized logger is wrong, nothing else in this harness should be
 * trusted to mutate storage.
 */

import { assertKeyWithinPrefix, assertTestPrefix } from '../lib/s3.mjs';
import { DEFAULT_TEST_ROOT } from '../lib/context.mjs';
import { expect, sanitizeRecord, step } from '../lib/safe-log.mjs';
import { presignUrl } from '../lib/sigv4.mjs';
import {
  absolutePlaybackUrl,
  buildClearKeyChallenge,
  extractClearKeyKid,
  resolveSegmentUrl,
} from '../lib/drm.mjs';
import { objectKeyFromPresignedUrl } from './drm-lifecycle.mjs';
import crypto from 'node:crypto';
import { createPlaybackAssertion } from '../lib/assertion.mjs';

const TEST_ROOT = DEFAULT_TEST_ROOT;

function rejects(fn) {
  try {
    fn();
    return false;
  } catch {
    return true;
  }
}

export async function selfTest() {
  step('selftest');

  // Prefix guard: accept only a run-scoped child of the test root.
  expect('selftest-prefix-accepts-run-scope', (() => {
    try {
      assertTestPrefix(`${TEST_ROOT}run-abc/media/`, TEST_ROOT);
      return true;
    } catch {
      return false;
    }
  })(), { label: 'run-scoped-prefix' });

  expect('selftest-prefix-rejects-empty', rejects(() => assertTestPrefix('', TEST_ROOT)), {
    label: 'empty',
  });
  expect('selftest-prefix-rejects-root', rejects(() => assertTestPrefix('/', TEST_ROOT)), {
    label: 'root',
  });
  expect('selftest-prefix-rejects-uploads', rejects(() => assertTestPrefix('uploads/', TEST_ROOT)), {
    label: 'uploads',
  });
  expect('selftest-prefix-rejects-assets', rejects(() => assertTestPrefix('assets/', TEST_ROOT)), {
    label: 'assets',
  });
  expect(
    'selftest-prefix-rejects-test-root',
    rejects(() => assertTestPrefix(TEST_ROOT, TEST_ROOT)),
    { label: 'testRoot' },
  );
  expect(
    'selftest-prefix-rejects-outside-root',
    rejects(() => assertTestPrefix('other-root/run-a/media/', TEST_ROOT)),
    { label: 'outside-root' },
  );
  expect(
    'selftest-prefix-rejects-untrailing-slash',
    rejects(() => assertTestPrefix(`${TEST_ROOT}run-abc/media`, TEST_ROOT)),
    { label: 'no-trailing-slash' },
  );
  expect(
    'selftest-prefix-rejects-shallow',
    rejects(() => assertTestPrefix(`${TEST_ROOT}run-abc/`, TEST_ROOT)),
    { label: 'not-run-scoped' },
  );

  expect(
    'selftest-logger-redacts-url',
    sanitizeRecord({ step: 'probe', note: 'https://example.invalid/?X-Amz-Signature=abc' }).note ===
      '[redacted]',
    { label: 'url' },
  );
  expect(
    'selftest-logger-drops-unknown-fields',
    !Object.hasOwn(sanitizeRecord({ step: 'probe', status: 200, unexpectedSecret: 'x' }), 'unexpectedSecret'),
    { label: 'unknown-field' },
  );

  expect(
    'selftest-key-rejects-outside-scope',
    rejects(() =>
      assertKeyWithinPrefix(
        `${TEST_ROOT}run-b/media/object.txt`,
        `${TEST_ROOT}run-a/media/`,
        TEST_ROOT,
      ),
    ),
    { label: 'object-scope' },
  );

  const baseUrl = 'https://drm.example.invalid';
  const manifestUrl = absolutePlaybackUrl(baseUrl, '/v1/playback/session/manifest.mpd');
  const manifest = [
    '<MPD xmlns:cenc="urn:mpeg:cenc:2013">',
    '<ContentProtection cenc:default_KID="00112233-4455-6677-8899-aabbccddeeff"/>',
    '<Representation id="v1"><SegmentTemplate startNumber="1" media="video_seg_$Number$.m4s"/></Representation>',
    '</MPD>',
  ].join('');
  expect(
    'selftest-relative-manifest-url',
    manifestUrl === 'https://drm.example.invalid/v1/playback/session/manifest.mpd',
    { label: 'relative-url' },
  );
  expect(
    'selftest-numbered-segment-url',
    resolveSegmentUrl(manifestUrl, manifest) ===
      'https://drm.example.invalid/v1/playback/session/media/video_seg_1.m4s',
    { label: 'numbered-segment' },
  );
  const kid = extractClearKeyKid(manifest);
  expect('selftest-clearkey-kid', kid === 'ABEiM0RVZneImaq7zN3u_w', { label: 'kid-conversion' });
  expect(
    'selftest-clearkey-challenge',
    JSON.stringify(buildClearKeyChallenge(kid)) ===
      JSON.stringify({ kids: ['ABEiM0RVZneImaq7zN3u_w'], type: 'temporary' }),
    { label: 'challenge-shape' },
  );
  expect(
    'selftest-upload-key-extraction',
    objectKeyFromPresignedUrl(
      'https://bucket.example.invalid/uploads/asset/source.mp4?X-Amz-Signature=redacted',
      { forcePathStyle: false, bucket: 'bucket' },
    ) === 'uploads/asset/source.mp4',
    { label: 'upload-key' },
  );

  // Presigning must produce a signed URL without contacting anything here.
  const signed = presignUrl({
    method: 'PUT',
    endpoint: 'https://example.invalid',
    bucket: 'example-bucket',
    region: 'auto',
    accessKeyId: 'PLACEHOLDER-ACCESS-KEY',
    secretAccessKey: 'PLACEHOLDER-SECRET-KEY',
    key: `${TEST_ROOT}probe/object.txt`,
    expiresIn: 60,
  });
  expect('selftest-presign-shape', signed.startsWith('https://example-bucket.example.invalid/'), {
    label: 'presign-shape',
  });
  expect('selftest-presign-has-signature-param', signed.includes('X-Amz-Signature='), {
    label: 'signature-param',
  });
  // Never print `signed`; it is a credential even with placeholder values.

  const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const assertion = createPlaybackAssertion(
    {
      DRM_ASSERTION_ISSUER: 'https://issuer.example.invalid',
      DRM_ASSERTION_AUDIENCE: 'drm-test',
      DRM_ASSERTION_PRIVATE_KEY_B64: Buffer.from(
        privateKey.export({ type: 'pkcs8', format: 'pem' }),
      ).toString('base64'),
      DRM_ASSERTION_KEY_ID: 'test-key',
      DRM_ASSERTION_MAX_LIFETIME_SEC: '60',
    },
    {
      applicationId: 'test-app',
      userId: 'test-user',
      courseId: 'test-course',
      lessonId: 'test-lesson',
      assetId: 'test-asset',
      deviceId: 'test-device',
    },
  );
  const [headerPart, payloadPart, signaturePart] = assertion.split('.');
  const assertionValid =
    Boolean(headerPart && payloadPart && signaturePart) &&
    crypto.verify(
      'RSA-SHA256',
      Buffer.from(`${headerPart}.${payloadPart}`),
      publicKey,
      Buffer.from(signaturePart || '', 'base64url'),
    );
  expect('selftest-rs256-assertion', assertionValid, { label: 'rs256-signature' });
  return true;
}
