import test from 'node:test';
import assert from 'node:assert/strict';
import {
  absolutePlaybackUrl,
  buildClearKeyChallenge,
  extractClearKeyKid,
  resolveSegmentUrl,
} from '../lib/drm.mjs';
import { configureSensitiveValues, sanitizeRecord, verdictFor } from '../lib/safe-log.mjs';
import { assertKeyWithinPrefix, S3Client } from '../lib/s3.mjs';
import {
  drmResponseState,
  objectKeyFromPresignedUrl,
  validClearKeyLicense,
} from '../stages/drm-lifecycle.mjs';
import {
  platformDeletionState,
  platformMediaState,
  requestExactCourseCleanup,
} from '../stages/platform-lifecycle.mjs';
import { isNarrowCorsRule } from '../stages/cors.mjs';
import { requiredPreflightNames, requiredStateValue } from '../pre-m5-live-lifecycle.mjs';

const root = 'pre-m5-live-verify/';
const fakeSecrets = {
  S3_ACCESS_KEY_ID: 'OFFLINE-SENTINEL-ACCESS',
  S3_SECRET_ACCESS_KEY: 'OFFLINE-SENTINEL-SECRET',
  DRM_CLIENT_ID: 'OFFLINE-SENTINEL-CLIENT',
  DRM_CLIENT_SECRET: 'OFFLINE-SENTINEL-DRM-SECRET',
};

test('direct object mutations reject keys outside the exact run scope', () => {
  assert.throws(() =>
    assertKeyWithinPrefix(`${root}run-b/media/object.txt`, `${root}run-a/media/`, root),
  );
  assert.equal(
    assertKeyWithinPrefix(`${root}run-a/media/object.txt`, `${root}run-a/media/`, root),
    `${root}run-a/media/object.txt`,
  );
});

test('failed S3 LIST retains its failure status and cannot mean empty proof', async () => {
  const client = new S3Client({ testRoot: root });
  client.send = async () => ({ status: 403, body: Buffer.alloc(0), elapsedMs: 1 });
  const result = await client.listKeys({ prefix: `${root}run-a/media/` });
  assert.equal(result.status, 403);
  assert.deepEqual(result.keys, []);
  assert.notEqual(result.status === 200 && result.keys.length === 0, true);
});

test('logger redacts allowed-field URLs, signed queries, bearer values, and configured secrets', () => {
  configureSensitiveValues(Object.values(fakeSecrets));
  for (const value of [
    'https://example.invalid/path',
    'query X-Amz-Signature=abcdef',
    'Bearer abc.def.ghi',
    `prefix ${fakeSecrets.S3_SECRET_ACCESS_KEY} suffix`,
  ]) {
    assert.equal(sanitizeRecord({ step: 'probe', note: value }).note, '[redacted]');
  }
  assert.equal(
    sanitizeRecord({ step: 'probe', unexpectedSecret: 'value' }).unexpectedSecret,
    undefined,
  );
});

test('relative manifest, numbered segment, UUID KID and ClearKey challenge match public contracts', () => {
  const manifestUrl = absolutePlaybackUrl(
    'https://drm.example.invalid',
    '/v1/playback/session/manifest.mpd',
  );
  const manifest = [
    '<MPD xmlns:cenc="urn:mpeg:cenc:2013">',
    '<ContentProtection cenc:default_KID="00112233-4455-6677-8899-aabbccddeeff"/>',
    '<Representation id="video"><SegmentTemplate startNumber="7" media="video_seg_$Number%05d$.m4s"/></Representation>',
    '</MPD>',
  ].join('');
  assert.equal(
    resolveSegmentUrl(manifestUrl, manifest),
    'https://drm.example.invalid/v1/playback/session/media/video_seg_00007.m4s',
  );
  const kid = extractClearKeyKid(manifest);
  assert.equal(kid, 'ABEiM0RVZneImaq7zN3u_w');
  assert.deepEqual(buildClearKeyChallenge(kid), {
    kids: ['ABEiM0RVZneImaq7zN3u_w'],
    type: 'temporary',
  });
  assert.equal(validClearKeyLicense({ keys: [{ kid, k: 'non-empty' }] }, kid), true);
  assert.equal(validClearKeyLicense({ keys: [{ kid: 'different', k: 'non-empty' }] }, kid), false);
});

test('poll response adapters accept only successful documented envelopes', () => {
  assert.equal(drmResponseState({ status: 200, json: { status: 'READY' } }), 'READY');
  assert.equal(drmResponseState({ status: 503, json: { status: 'READY' } }), undefined);
  assert.equal(
    platformMediaState({ status: 200, json: { data: { mapping: { status: 'READY' } } } }),
    'READY',
  );
  assert.equal(platformMediaState({ status: 200, json: { status: 'READY' } }), undefined);
  assert.equal(
    platformDeletionState({
      status: 200,
      json: { data: { operation: { status: 'COMPLETED' } } },
    }),
    'COMPLETED',
  );
});

test('CORS acceptance rejects wildcard and requires the exact approved origin', () => {
  const base = { methods: ['GET', 'HEAD', 'PUT'], headers: ['Content-Type'] };
  assert.equal(
    isNarrowCorsRule({ ...base, origins: ['https://app.example'] }, 'https://app.example'),
    true,
  );
  assert.equal(isNarrowCorsRule({ ...base, origins: ['*'] }, 'https://app.example'), false);
  assert.equal(
    isNarrowCorsRule({ ...base, origins: ['https://other.example'] }, 'https://app.example'),
    false,
  );
});

test('presigned upload key extraction is exact for virtual and path-style endpoints', () => {
  assert.equal(
    objectKeyFromPresignedUrl(
      'https://bucket.example.invalid/uploads/asset/source.mp4?X-Amz-Signature=x',
      { forcePathStyle: false, bucket: 'bucket' },
    ),
    'uploads/asset/source.mp4',
  );
  assert.equal(
    objectKeyFromPresignedUrl(
      'https://example.invalid/bucket/uploads/asset/source.mp4?X-Amz-Signature=x',
      { forcePathStyle: true, bucket: 'bucket' },
    ),
    'uploads/asset/source.mp4',
  );
});

test('required blocked and failed outcomes are non-zero', () => {
  assert.deepEqual(verdictFor({ failures: 0, blocked: 1 }), {
    verdict: 'BLOCKED',
    exitCode: 1,
  });
  assert.deepEqual(verdictFor({ failures: 1, blocked: 0 }), { verdict: 'FAIL', exitCode: 1 });
  assert.deepEqual(verdictFor({ failures: 0, blocked: 0 }), { verdict: 'PASS', exitCode: 0 });
});

test('preflight and state prerequisites fail closed as pure offline checks', () => {
  const missing = requiredPreflightNames({ PLATFORM_BASE_URL: 'set' });
  assert.equal(missing.includes('PLATFORM_BASE_URL'), false);
  assert.equal(missing.includes('PLATFORM_ORIGIN'), true);
  assert.throws(() => requiredStateValue({}, 'controlKey'));
  assert.throws(() => requiredStateValue({ controlKey: 42 }, 'controlKey'));
  assert.equal(requiredStateValue({ controlKey: 'owned-key' }, 'controlKey'), 'owned-key');
});

test('intermediate platform cleanup remains scoped to the exact verification course', async () => {
  const calls = [];
  const platform = {
    async deleteCourse(pathId, confirmation) {
      calls.push({ pathId, confirmation });
      return { status: 202 };
    },
  };
  const result = await requestExactCourseCleanup(platform, 'course-owned-by-test');
  assert.equal(result.status, 202);
  assert.deepEqual(calls, [
    { pathId: 'course-owned-by-test', confirmation: 'course-owned-by-test' },
  ]);
});
