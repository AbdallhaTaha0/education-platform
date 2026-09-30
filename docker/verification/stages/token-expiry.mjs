/**
 * Stage: real DRM playback-token expiry with real elapsed time (TEST-ONLY).
 *
 * Requires PLAYBACK_TOKEN_TTL=10 (development drill) with a long session TTL
 * so token expiry is distinguishable from session expiry. One READY asset and
 * one authorized session: a protected manifest succeeds before expiry, then
 * after ~30 s of real time without renewal the identical request, bearer,
 * device and session receives the documented 401 expiry denial. The asset
 * stays READY and the session stays usable (proven by owning-application
 * renewal with a fresh working bearer), then the session ends and the exact
 * asset is deleted with storage cleanup. System time is never modified.
 */
import { readFile } from 'node:fs/promises';
import { expect, step } from '../lib/safe-log.mjs';
import { mediaPath, pollUntil } from '../lib/context.mjs';
import { createPlaybackAssertion } from '../lib/assertion.mjs';
import {
  absolutePlaybackUrl,
  buildClearKeyChallenge,
  extractClearKeyKid,
} from '../lib/drm.mjs';
import { objectKeyFromPresignedUrl, drmResponseState, validClearKeyLicense } from './drm-lifecycle.mjs';

const TOKEN_TTL_DRILL_SECONDS = 10;
const SETTLE_MS = 30000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function tokenExpiry(ctx) {
  step('token-expiry');
  const owner = ctx.drm;
  const runId = ctx.runId;
  const externalAssetId = `token-expiry-${runId}`;
  const deviceId = `token-expiry-device-${runId}`;
  let assetId;
  let deleted = false;

  const video = await readFile(mediaPath(ctx.env));
  expect('token-register-media', video.length > 0, { bytes: video.length });
  const register = await owner.registerMedia({
    externalAssetId,
    title: 'Token expiry verification',
    contentType: 'video/mp4',
    securityTier: 'STANDARD',
    idempotencyKey: `token-expiry-${runId}`,
  });
  expect('token-register-status', register.status === 202, { status: register.status });
  assetId = register.json?.assetId;
  const uploadUrl = register.json?.uploadUrl;
  if (!assetId || !uploadUrl) return { completed: false };
  const uploadObjectKey = objectKeyFromPresignedUrl(uploadUrl, ctx.s3.config);
  const put = await fetch(uploadUrl, { method: 'PUT', headers: { 'Content-Type': 'video/mp4' }, body: video });
  expect('token-upload', put.status === 200, { status: put.status, bytes: video.length });
  const complete = await owner.completeMedia(assetId);
  expect('token-complete', complete.status === 202, { status: complete.status });
  const ready = await pollUntil({
    label: 'token-ready', attempts: 40, intervalMs: 5000,
    probe: async () => owner.mediaStatus(assetId),
    getState: drmResponseState,
    done: (state) => state === 'READY',
    onState: (attempt, state) => expect('token-ready-state', true, { state, attempts: attempt }),
  });
  expect('token-ready', ready.reached, { state: ready.state, attempts: ready.attempts });
  if (!ready.reached) return { completed: false, assetId, externalAssetId };

  try {
    const session = await owner.createPlaybackSession({
      externalUserId: `token-expiry-user-${runId}`,
      externalAssetId,
      deviceId,
      assertion: createPlaybackAssertion(ctx.env, {
        applicationId: ctx.env.DRM_CLIENT_ID,
        userId: `token-expiry-user-${runId}`,
        courseId: `token-expiry-course-${runId}`,
        lessonId: `token-expiry-lesson-${runId}`,
        assetId: externalAssetId,
        deviceId,
      }),
    });
    expect('token-session-create', session.status === 201, { status: session.status });
    const sessionId = session.json?.playbackSessionId;
    const bearer = session.json?.playbackToken;
    const manifestUrl = absolutePlaybackUrl(ctx.env.DRM_BASE_URL, session.json?.manifestUrl);
    const licenseUrl = absolutePlaybackUrl(ctx.env.DRM_BASE_URL, session.json?.licenseUrl);
    if (!sessionId || !bearer || !session.json?.manifestUrl || !session.json?.licenseUrl) {
      return { completed: false, assetId, externalAssetId };
    }

    // Before expiry: the protected manifest succeeds with this bearer.
    const before = await fetch(manifestUrl, { headers: { Authorization: `Bearer ${bearer}` } });
    const beforeText = await before.text();
    expect('token-manifest-before-expiry', before.status === 200, { status: before.status, bytes: beforeText.length });
    const kid = extractClearKeyKid(beforeText);
    const t0 = Date.now();
    await sleep(SETTLE_MS);
    const elapsedMs = Date.now() - t0;
    expect('token-real-elapsed', elapsedMs >= SETTLE_MS, { durationMs: elapsedMs });

    // After expiry: identical request, bearer, device and session are denied.
    const after = await fetch(manifestUrl, { headers: { Authorization: `Bearer ${bearer}` } });
    await after.text().then(() => {}).catch(() => {});
    expect('token-manifest-after-expiry-denied', after.status === 401, { status: after.status });

    // The asset is still READY and the session was not ended, revoked or
    // deleted: the owning application renews it and the fresh bearer works.
    const assetState = await owner.mediaStatus(assetId);
    expect('token-asset-still-ready', assetState.status === 200 && assetState.json?.status === 'READY', {
      status: assetState.status, state: assetState.json?.status,
    });
    const renewed = await owner.request('POST', `/v1/playback/sessions/${encodeURIComponent(sessionId)}/renew-admin`, {});
    expect('token-renew-after-expiry', renewed.status === 200, { status: renewed.status });
    const freshBearer = renewed.json?.playbackToken;
    const usable = typeof freshBearer === 'string' && freshBearer.length > 0 && freshBearer !== bearer;
    expect('token-renew-rotates', usable, { ok: usable });
    if (!usable) return { completed: false, assetId, externalAssetId };
    const manifestFresh = await fetch(manifestUrl, { headers: { Authorization: `Bearer ${freshBearer}` } });
    const manifestFreshText = await manifestFresh.text();
    expect('token-manifest-fresh-bearer', manifestFresh.status === 200, {
      status: manifestFresh.status, bytes: manifestFreshText.length,
    });
    if (kid) {
      const license = await fetch(licenseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/octet-stream', Authorization: `Bearer ${freshBearer}` },
        body: Buffer.from(JSON.stringify(buildClearKeyChallenge(kid))),
      });
      const licenseText = await license.text();
      let licenseJson = {};
      try { licenseJson = JSON.parse(licenseText); } catch { /* checked below */ }
      expect('token-license-fresh-bearer', license.status === 200 && validClearKeyLicense(licenseJson, kid), {
        status: license.status, bytes: licenseText.length,
      });
    }

    const ended = await owner.endSession(sessionId, { deviceId, bearer: freshBearer });
    expect('token-session-end', ended.status === 200, { status: ended.status });
    const deletion = await owner.requestDeletion(assetId, externalAssetId);
    expect('token-delete-request', deletion.status === 202, { status: deletion.status });
    const deletionId = deletion.json?.deletionId;
    if (!deletionId) return { completed: false, assetId, externalAssetId };
    const removed = await pollUntil({
      label: 'token-delete', attempts: 40, intervalMs: 5000,
      probe: async () => owner.deletionStatus(deletionId),
      getState: drmResponseState,
      done: (state) => state === 'COMPLETED',
      onState: (attempt, state) => expect('token-delete-state', true, { state, attempts: attempt }),
    });
    expect('token-delete-complete', removed.reached, { state: removed.state, attempts: removed.attempts });
    deleted = removed.reached;
    const packaged = await ctx.s3.listKeys({ prefix: `assets/${assetId}/` });
    expect('token-packaged-prefix-empty', packaged.status === 200 && packaged.keys.length === 0, {
      count: packaged.keys.length,
    });
    const uploaded = await ctx.s3.headObject({ key: uploadObjectKey });
    expect('token-owned-upload-absent', uploaded.status === 404, { status: uploaded.status });
    return { completed: deleted, assetId, externalAssetId };
  } finally {
    if (assetId && !deleted) {
      const cleanup = await owner.requestDeletion(assetId, externalAssetId).catch(() => null);
      if (cleanup?.status === 202 && cleanup.json?.deletionId) {
        const reconciled = await pollUntil({
          label: 'token-best-effort-delete', attempts: 40, intervalMs: 5000,
          probe: async () => owner.deletionStatus(cleanup.json.deletionId),
          getState: drmResponseState,
          done: (state) => state === 'COMPLETED',
        });
        expect('token-best-effort-cleanup', reconciled.reached, { state: reconciled.state });
      }
    }
  }
}
