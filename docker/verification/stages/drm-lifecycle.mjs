/**
 * Stage: DRM-direct lifecycle through real R2 (TEST-ONLY).
 *
 * Exercises the public DRM contract end to end and produces the post-rotation
 * evidence the Pre-M5 report requires: registration, presigned upload, worker
 * processing, playback session, manifest, an authenticated packaged-segment
 * fetch, a successful ClearKey license, session lifecycle, and permanent
 * deletion that empties only the owned prefixes.
 *
 * Commercial DRM/Widevine is deliberately out of scope here and is never
 * represented by the ClearKey result.
 */

import {
  buildClearKeyChallenge,
  extractClearKeyKid,
  resolveSegmentUrl,
  absolutePlaybackUrl,
} from '../lib/drm.mjs';
import { expect, recordFail, step } from '../lib/safe-log.mjs';
import { mediaPath, pollUntil } from '../lib/context.mjs';
import { readFile } from 'node:fs/promises';
import { createPlaybackAssertion } from '../lib/assertion.mjs';

export async function drmLifecycle(ctx, { runActiveNegative } = {}) {
  step('drm-lifecycle');
  const drm = ctx.drm;
  const runId = ctx.runId;
  const externalAssetId = `pre-m5-live-${runId}`;
  let assetId;
  let deletionCompleted = false;
  const video = await readFile(mediaPath(ctx.env));
  step('drm-media-loaded');
  expect('drm-media-is-mp4', video.length > 0, { bytes: video.length });

  // 1-2. Register: require 202, UPLOADED and a short-lived upload URL.
  const register = await drm.registerMedia({
    externalAssetId,
    title: 'Pre-M5 live verification',
    contentType: 'video/mp4',
    securityTier: 'STANDARD',
    idempotencyKey: `pre-m5-${runId}`,
  });
  assetId = register.json?.assetId;
  const uploadUrl = register.json?.uploadUrl;
  expect('drm-register-status', register.status === 202, { status: register.status, ms: register.elapsedMs });
  expect('drm-register-state', register.json?.status === 'UPLOADED', {
    state: register.json?.status,
  });
  expect('drm-register-upload-url', typeof uploadUrl === 'string' && uploadUrl.length > 0, {
    label: 'uploadUrl',
  });
  try {
  if (!assetId || !uploadUrl) {
    return { completed: false, reason: 'registration did not return an asset and upload URL' };
  }
  const uploadObjectKey = objectKeyFromPresignedUrl(uploadUrl, ctx.s3.config);
  expect('drm-upload-object-owned', uploadObjectKey.startsWith('uploads/'), {
    label: 'asset-upload-object',
  });

  // 3. Upload the exact bytes with the exact MIME.
  const put = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': 'video/mp4' },
    body: video,
  });
  expect('drm-upload', put.status === 200, { status: put.status, bytes: video.length });

  // 4. Complete the same asset.
  const complete = await drm.completeMedia(assetId);
  expect('drm-complete', complete.status === 202, {
    status: complete.status,
    state: complete.json?.status,
  });

  // 5. Bounded polling to READY, reporting every observed state.
  const ready = await pollUntil({
    label: 'drm-ready',
    attempts: 40,
    intervalMs: 5000,
    probe: async () => drm.mediaStatus(assetId),
    getState: drmResponseState,
    done: (state) => state === 'READY',
    onState: (attempt, state) => expect('drm-ready-state', true, { state, attempts: attempt }),
  });
  expect('drm-ready', ready.reached, { state: ready.state, attempts: ready.attempts });
  if (!ready.reached) return { completed: false, reason: 'asset never reached READY', assetId };

  // 6. Playback session.
  const deviceId = `pre-m5-device-${runId}`;
  const externalUserId = `pre-m5-user-${runId}`;
  const assertion = createPlaybackAssertion(ctx.env, {
    applicationId: ctx.env.DRM_CLIENT_ID,
    userId: externalUserId,
    courseId: `pre-m5-course-${runId}`,
    lessonId: `pre-m5-lesson-${runId}`,
    assetId: externalAssetId,
    deviceId,
  });
  const session = await drm.createPlaybackSession({
    externalUserId,
    externalAssetId,
    deviceId,
    assertion,
  });
  expect('drm-playback-create', session.status === 201, { status: session.status });
  const sessionId = session.json?.playbackSessionId;
  const bearer = session.json?.playbackToken;
  const manifestUrl = session.json?.manifestUrl;
  const licenseUrl = session.json?.licenseUrl;
  expect('drm-playback-session', Boolean(sessionId), { label: 'sessionId' });
  expect('drm-playback-token', Boolean(bearer), { label: 'playbackToken' });
  if (!sessionId || !bearer || !manifestUrl || !licenseUrl) {
    recordFail('drm-playback-contract', { note: 'playback response is incomplete' });
    return { completed: false, assetId, externalAssetId };
  }

  // 7. Manifest with the transient bearer token.
  let manifestText = '';
  const absoluteManifestUrl = absolutePlaybackUrl(drm.config.baseUrl, manifestUrl);
  const manifest = await fetch(absoluteManifestUrl, {
    headers: { Authorization: `Bearer ${bearer}` },
  });
  manifestText = await manifest.text();
  expect('drm-manifest', manifest.status === 200, {
    status: manifest.status,
    mime: (manifest.headers.get('content-type') || '').split(';')[0],
    bytes: manifestText.length,
  });

  // 8-9. Authenticated packaged-segment delivery.
  let segmentProven = false;
  const segmentUrl = resolveSegmentUrl(absoluteManifestUrl, manifestText);
  if (!segmentUrl) {
    recordFail('drm-segment', { note: 'no concrete packaged segment could be resolved' });
  } else {
    const segment = await fetch(segmentUrl, {
      headers: { Authorization: `Bearer ${bearer}`, Range: 'bytes=0-65535' },
    });
    const segmentBytes = Buffer.from(await segment.arrayBuffer());
    const mime = (segment.headers.get('content-type') || '').split(';')[0];
    segmentProven = expect(
      'drm-segment',
      (segment.status === 200 || segment.status === 206) && segmentBytes.length > 0,
      { status: segment.status, mime, bytes: segmentBytes.length },
    );
    expect('drm-segment-mime', mime.length > 0, { mime });
  }

  // 10-11. ClearKey license with a valid KID taken from the published manifest.
  let licenseProven = false;
  const kid = extractClearKeyKid(manifestText);
  if (!kid) {
    recordFail('drm-license', { note: 'manifest did not publish a valid ClearKey KID' });
  } else {
    const challenge = buildClearKeyChallenge(kid);
    const license = await drm.requestLicense({ bearer, challenge });
    licenseProven = expect('drm-license', license.status === 200, {
      status: license.status,
      mime: license.mime,
      bytes: license.rawLength,
    });
    const returnedKeys = Array.isArray(license.json?.keys) ? license.json.keys : [];
    const matching = validClearKeyLicense(license.json, kid);
    expect('drm-license-shape', matching && license.rawLength > 0, {
      bytes: license.rawLength,
      count: returnedKeys.length,
    });
  }

  if (!segmentProven || !licenseProven) {
    recordFail('drm-playback-proof', { note: 'segment or license proof is incomplete' });
  }

  // 12. Session lifecycle.
  const heartbeat = await drm.heartbeat(sessionId, { deviceId, bearer });
  expect('drm-heartbeat', heartbeat.status === 200, { status: heartbeat.status });
  const ended = await drm.endSession(sessionId, { deviceId, bearer });
  expect('drm-session-end', ended.status === 200, { status: ended.status });
  const revoked = await drm.revokeSession(sessionId, { reason: 'PRE_M5_VERIFICATION' });
  expect('drm-session-revoke', revoked.status === 200, { status: revoked.status });

  // Required binding/recovery/expiry cases use a second live session while the
  // asset remains READY. All bearer values remain memory-only.
  if (runActiveNegative) {
    await runActiveNegative({ assetId, externalAssetId });
  }

  // 13-14. Permanent deletion, reconciled to COMPLETED.
  const deletion = await drm.requestDeletion(assetId, externalAssetId);
  expect('drm-delete-request', deletion.status === 202, {
    status: deletion.status,
    state: deletion.json?.status,
  });
  const deletionId = deletion.json?.deletionId;
  if (!deletionId) {
    recordFail('drm-delete-id', { note: 'deletion response carried no operation id' });
    return { completed: false, assetId, externalAssetId };
  }
  const deleted = await pollUntil({
    label: 'drm-delete',
    attempts: 40,
    intervalMs: 5000,
    probe: async () => drm.deletionStatus(deletionId),
    getState: drmResponseState,
    done: (state) => state === 'COMPLETED',
    onState: (attempt, state) => expect('drm-delete-state', true, { state, attempts: attempt }),
  });
  expect('drm-delete-complete', deleted.reached, {
    state: deleted.state,
    attempts: deleted.attempts,
  });
  deletionCompleted = deleted.reached;

  // 15. Only the owned prefixes are empty.
  const packaged = await ctx.s3.listKeys({ prefix: `assets/${assetId}/` });
  expect('drm-packaged-list-status', packaged.status === 200, { status: packaged.status });
  expect('drm-packaged-prefix-empty', packaged.status === 200 && packaged.keys.length === 0, {
    count: packaged.keys.length,
  });
  const uploaded = await ctx.s3.headObject({ key: uploadObjectKey });
  expect('drm-owned-upload-absent', uploaded.status === 404, { status: uploaded.status });

  // 17. Safe terminal repeats.
  const repeatDelete = await drm.requestDeletion(assetId, externalAssetId);
  expect('drm-delete-repeat-safe', repeatDelete.status === 404 || repeatDelete.status === 409, {
    status: repeatDelete.status,
  });
  const repeatComplete = await drm.completeMedia(assetId);
  expect('drm-complete-repeat-safe', repeatComplete.status >= 400, { status: repeatComplete.status });

  return {
    completed: true,
    assetId,
    externalAssetId,
    sessionId,
    deviceId,
    segmentProven,
    licenseProven,
  };
  } finally {
    if (assetId && !deletionCompleted) {
      const cleanup = await drm.requestDeletion(assetId, externalAssetId).catch(() => null);
      if (cleanup?.status === 202 && cleanup.json?.deletionId) {
        const reconciled = await pollUntil({
          label: 'drm-best-effort-delete',
          attempts: 40,
          intervalMs: 5000,
          probe: async () => drm.deletionStatus(cleanup.json.deletionId),
          getState: drmResponseState,
          done: (state) => state === 'COMPLETED',
        });
        expect('drm-best-effort-cleanup', reconciled.reached, {
          state: reconciled.state,
          attempts: reconciled.attempts,
        });
      } else if (cleanup?.status !== 404) {
        recordFail('drm-best-effort-cleanup', {
          status: cleanup?.status,
          note: 'exact verification asset cleanup could not be scheduled',
        });
      }
    }
  }
}

export function objectKeyFromPresignedUrl(uploadUrl, s3Config) {
  const parsed = new URL(uploadUrl);
  const segments = parsed.pathname.split('/').filter(Boolean).map(decodeURIComponent);
  if (s3Config.forcePathStyle && segments[0] === s3Config.bucket) segments.shift();
  const key = segments.join('/');
  if (!key || !key.startsWith('uploads/') || key.includes('..')) {
    throw new Error('presigned upload URL did not identify an owned upload object');
  }
  return key;
}

export function drmResponseState(result) {
  return result?.status === 200 && typeof result.json?.status === 'string'
    ? result.json.status
    : undefined;
}

export function validClearKeyLicense(json, kid) {
  return (
    Array.isArray(json?.keys) &&
    json.keys.some(
      (item) => item && item.kid === kid && typeof item.k === 'string' && item.k.length > 0,
    )
  );
}
