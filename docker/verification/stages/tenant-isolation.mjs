/**
 * Stage: bidirectional tenant isolation for renewal and protected media (TEST-ONLY).
 *
 * One READY asset per tenant (main owns A, second owns B). Proves, in both
 * directions with owning-tenant positive controls:
 * - tenant-scoped status reads (owner 200 READY, stranger 404, no leak);
 * - tenant-scoped playback creation (owner 201, stranger 404);
 * - tenant-scoped permanent deletion (stranger 404 with correct confirmation);
 * - application-authenticated renew-admin (owner 200, other app 403
 *   APP_MISMATCH, denied renewal leaves the session usable via heartbeat);
 * - manifest/segment/license authorization boundaries.
 *
 * Authorization-boundary notes (possession is not proof):
 * - A stolen bearer authorizes its OWN session by design. Cross-tenant denial
 *   is proven only where the endpoint binds identity: the bearer-to-session
 *   path binding on the gateway (SESSION_MISMATCH 403 when the path session
 *   differs from the token session), and the KID-to-asset binding on licenses
 *   (KID_NOT_AUTHORIZED 403 when the challenge KID belongs to another asset).
 *   Tenant boundaries proper are proven on the application-credentialed routes
 *   (status, playback creation, deletion, renew-admin), which scope every
 *   lookup by the calling application.
 * Every playback attempt uses a fresh RS256 assertion whose `app` claim names
 * its own calling application. Browser-bearer renewal and further directions
 * are out of scope.
 */
import { readFile } from 'node:fs/promises';
import {
  absolutePlaybackUrl,
  buildClearKeyChallenge,
  DrmClient,
  extractClearKeyKid,
  resolveSegmentUrl,
} from '../lib/drm.mjs';
import { expect, recordBlocked, recordFail, step } from '../lib/safe-log.mjs';
import { mediaPath, pollUntil } from '../lib/context.mjs';
import { createPlaybackAssertion } from '../lib/assertion.mjs';
import { objectKeyFromPresignedUrl, drmResponseState, validClearKeyLicense } from './drm-lifecycle.mjs';

export const ISOLATION_CODES = {
  ownerStatus: 200,
  strangerStatus: 404,
  ownerPlaybackCreate: 201,
  strangerPlaybackCreate: 404,
  strangerDelete: 404,
  ownerDeleteRequest: 202,
  ownerSessionEnd: 200,
  renewOwner: 200,
  renewStranger: 403,
  heartbeatAfterDeniedRenew: 200,
  manifestControl: 200,
  bearerSessionMismatch: 403,
  segmentControl: 206,
  segmentSessionMismatch: 403,
  licenseControl: 200,
  licenseWrongKid: 403,
};

function assertionFor(env, applicationClientId, externalAssetId, deviceId, runId) {
  return createPlaybackAssertion(env, {
    applicationId: applicationClientId,
    userId: `tenant-iso-user-${runId}`,
    courseId: `tenant-iso-course-${runId}`,
    lessonId: `tenant-iso-lesson-${runId}`,
    assetId: externalAssetId,
    deviceId,
  });
}

async function prepareAsset(ctx, client, tag, video) {
  const externalAssetId = `tenant-iso-${tag}-${ctx.runId}`;
  const register = await client.registerMedia({
    externalAssetId,
    title: 'Tenant isolation verification',
    contentType: 'video/mp4',
    securityTier: 'STANDARD',
    idempotencyKey: `tenant-iso-${tag}-${ctx.runId}`,
  });
  expect(`tenant-${tag}-register`, register.status === 202, { status: register.status });
  const assetId = register.json?.assetId;
  const uploadUrl = register.json?.uploadUrl;
  if (!assetId || !uploadUrl) return null;
  const uploadObjectKey = objectKeyFromPresignedUrl(uploadUrl, ctx.s3.config);
  const put = await fetch(uploadUrl, { method: 'PUT', headers: { 'Content-Type': 'video/mp4' }, body: video });
  expect(`tenant-${tag}-upload`, put.status === 200, { status: put.status, bytes: video.length });
  const complete = await client.completeMedia(assetId);
  expect(`tenant-${tag}-complete`, complete.status === 202, { status: complete.status });
  const ready = await pollUntil({
    label: `tenant-${tag}-ready`, attempts: 40, intervalMs: 5000,
    probe: async () => client.mediaStatus(assetId),
    getState: drmResponseState,
    done: (state) => state === 'READY',
    onState: (attempt, state) => expect(`tenant-${tag}-ready-state`, true, { state, attempts: attempt }),
  });
  expect(`tenant-${tag}-ready`, ready.reached, { state: ready.state, attempts: ready.attempts });
  if (!ready.reached) return null;
  return { assetId, externalAssetId, uploadObjectKey };
}

async function deleteAsset(ctx, client, asset) {
  const deletion = await client.requestDeletion(asset.assetId, asset.externalAssetId);
  expect('tenant-owner-delete-request', deletion.status === ISOLATION_CODES.ownerDeleteRequest, {
    status: deletion.status,
  });
  const deletionId = deletion.json?.deletionId;
  if (!deletionId) return false;
  const removed = await pollUntil({
    label: 'tenant-delete', attempts: 40, intervalMs: 5000,
    probe: async () => client.deletionStatus(deletionId),
    getState: drmResponseState,
    done: (state) => state === 'COMPLETED',
    onState: (attempt, state) => expect('tenant-delete-state', true, { state, attempts: attempt }),
  });
  expect('tenant-delete-complete', removed.reached, { state: removed.state, attempts: removed.attempts });
  const packaged = await ctx.s3.listKeys({ prefix: `assets/${asset.assetId}/` });
  expect('tenant-packaged-prefix-empty', packaged.status === 200 && packaged.keys.length === 0, {
    count: packaged.keys.length,
  });
  const uploaded = await ctx.s3.headObject({ key: asset.uploadObjectKey });
  expect('tenant-owned-upload-absent', uploaded.status === 404, { status: uploaded.status });
  return removed.reached;
}

export async function tenantIsolation(ctx) {
  step('tenant-isolation');
  const altId = ctx.env.VERIFY_ALT_DRM_CLIENT_ID;
  const altSecret = ctx.env.VERIFY_ALT_DRM_CLIENT_SECRET;
  if (!altId || !altSecret) {
    recordBlocked('tenant-isolation-alt-tenant', { note: 'VERIFY_ALT_DRM_CLIENT_ID/SECRET are required' });
    return { completed: false };
  }
  const clients = {
    main: DrmClient.fromEnv(ctx.env),
    alt: DrmClient.fromEnv({ ...ctx.env, DRM_CLIENT_ID: altId, DRM_CLIENT_SECRET: altSecret }),
  };
  const clientIds = { main: ctx.env.DRM_CLIENT_ID, alt: altId };
  const devices = { main: `tenant-iso-device-main-${ctx.runId}`, alt: `tenant-iso-device-alt-${ctx.runId}` };
  const video = await readFile(mediaPath(ctx.env));
  expect('tenant-register-media', video.length > 0, { bytes: video.length });

  // 1. One fresh READY asset per tenant.
  const assetA = await prepareAsset(ctx, clients.main, 'a', video);
  const assetB = await prepareAsset(ctx, clients.alt, 'b', video);
  if (!assetA || !assetB) return { completed: false };
  const assets = { main: assetA, alt: assetB };
  let deletedA = false;
  let deletedB = false;
  const sessions = [];

  try {
    // 2. Status, playback-creation and deletion isolation, both directions.
    for (const [ownerName, strangerName] of [['main', 'alt'], ['alt', 'main']]) {
      const asset = assets[ownerName];
      const status = await clients[ownerName].mediaStatus(asset.assetId);
      expect('tenant-owner-status-ready', status.status === ISOLATION_CODES.ownerStatus && status.json?.status === 'READY', {
        status: status.status, state: status.json?.status,
      });
      const denied = await clients[strangerName].mediaStatus(asset.assetId);
      expect('tenant-stranger-status-denied', denied.status === ISOLATION_CODES.strangerStatus, {
        status: denied.status,
      });
      const created = await clients[ownerName].createPlaybackSession({
        externalUserId: `tenant-iso-user-${ctx.runId}`,
        externalAssetId: asset.externalAssetId,
        deviceId: devices[ownerName],
        assertion: assertionFor(ctx.env, clientIds[ownerName], asset.externalAssetId, devices[ownerName], ctx.runId),
      });
      expect('tenant-owner-playback-create', created.status === ISOLATION_CODES.ownerPlaybackCreate, {
        status: created.status,
      });
      const deniedPlayback = await clients[strangerName].createPlaybackSession({
        externalUserId: `tenant-iso-user-${ctx.runId}`,
        externalAssetId: asset.externalAssetId,
        deviceId: devices[strangerName],
        assertion: assertionFor(ctx.env, clientIds[strangerName], asset.externalAssetId, devices[strangerName], ctx.runId),
      });
      expect('tenant-stranger-playback-denied', deniedPlayback.status === ISOLATION_CODES.strangerPlaybackCreate, {
        status: deniedPlayback.status,
      });
      const deniedDelete = await clients[strangerName].requestDeletion(asset.assetId, asset.externalAssetId);
      expect('tenant-stranger-delete-denied', deniedDelete.status === ISOLATION_CODES.strangerDelete, {
        status: deniedDelete.status,
      });
      if (created.json?.playbackSessionId && created.json?.playbackToken && created.json?.manifestUrl && created.json?.licenseUrl) {
        sessions.push({
          tenant: ownerName, id: created.json.playbackSessionId, bearer: created.json.playbackToken,
          deviceId: devices[ownerName], manifestUrl: created.json.manifestUrl, licenseUrl: created.json.licenseUrl,
        });
      }
    }
    const sessA = sessions.find((s) => s.tenant === 'main');
    const sessB = sessions.find((s) => s.tenant === 'alt');
    if (!sessA || !sessB) return { completed: false, reason: 'owner sessions missing' };

    // 3. Manifest controls, then cross bearer-to-session denials.
    const manifests = {};
    for (const [name, s] of [['main', sessA], ['alt', sessB]]) {
      const absolute = absolutePlaybackUrl(ctx.env.DRM_BASE_URL, s.manifestUrl);
      const res = await fetch(absolute, { headers: { Authorization: `Bearer ${s.bearer}` } });
      const text = await res.text();
      manifests[name] = text;
      expect('tenant-manifest-control', res.status === ISOLATION_CODES.manifestControl, {
        status: res.status, bytes: text.length,
      });
    }
    const crossA = await fetch(absolutePlaybackUrl(ctx.env.DRM_BASE_URL, sessA.manifestUrl), {
      headers: { Authorization: `Bearer ${sessB.bearer}` },
    });
    await crossA.text().then(() => {}).catch(() => {});
    expect('tenant-manifest-session-mismatch', crossA.status === ISOLATION_CODES.bearerSessionMismatch, {
      status: crossA.status,
    });
    const crossB = await fetch(absolutePlaybackUrl(ctx.env.DRM_BASE_URL, sessB.manifestUrl), {
      headers: { Authorization: `Bearer ${sessA.bearer}` },
    });
    await crossB.text().then(() => {}).catch(() => {});
    expect('tenant-manifest-session-mismatch-reverse', crossB.status === ISOLATION_CODES.bearerSessionMismatch, {
      status: crossB.status,
    });

    // 4. Packaged-segment control plus one cross-session denial.
    const segUrl = resolveSegmentUrl(absolutePlaybackUrl(ctx.env.DRM_BASE_URL, sessA.manifestUrl), manifests.main);
    if (!segUrl) {
      expect('tenant-segment-control', false, { note: 'no concrete segment resolved' });
    } else {
      const seg = await fetch(segUrl, { headers: { Authorization: `Bearer ${sessA.bearer}`, Range: 'bytes=0-1023' } });
      const segBytes = Buffer.from(await seg.arrayBuffer());
      expect('tenant-segment-control', (seg.status === 200 || seg.status === ISOLATION_CODES.segmentControl) && segBytes.length > 0, {
        status: seg.status, bytes: segBytes.length,
      });
      const segCross = await fetch(segUrl, { headers: { Authorization: `Bearer ${sessB.bearer}`, Range: 'bytes=0-1023' } });
      await segCross.arrayBuffer().then(() => {}).catch(() => {});
      expect('tenant-segment-session-mismatch', segCross.status === ISOLATION_CODES.segmentSessionMismatch, {
        status: segCross.status,
      });
    }

    // 5. License controls, then wrong-KID denials with the valid bearer.
    const kids = { main: extractClearKeyKid(manifests.main), alt: extractClearKeyKid(manifests.alt) };
    if (!kids.main || !kids.alt) {
      recordFail('tenant-license-kid', { note: 'manifest did not publish a ClearKey KID' });
      return { completed: false };
    }
    const licenses = {};
    for (const [name, s] of [['main', sessA], ['alt', sessB]]) {
      const lic = await clients[name].requestLicense({ bearer: s.bearer, challenge: buildClearKeyChallenge(kids[name]) });
      licenses[name] = lic;
      expect('tenant-license-control', lic.status === ISOLATION_CODES.licenseControl && validClearKeyLicense(lic.json, kids[name]), {
        status: lic.status, bytes: lic.rawLength,
      });
    }
    const licWrongA = await clients.main.requestLicense({ bearer: sessA.bearer, challenge: buildClearKeyChallenge(kids.alt) });
    expect('tenant-license-wrong-kid-denied', licWrongA.status === ISOLATION_CODES.licenseWrongKid, {
      status: licWrongA.status,
    });
    const licWrongB = await clients.alt.requestLicense({ bearer: sessB.bearer, challenge: buildClearKeyChallenge(kids.main) });
    expect('tenant-license-wrong-kid-denied-reverse', licWrongB.status === ISOLATION_CODES.licenseWrongKid, {
      status: licWrongB.status,
    });

    // 6. Application-authenticated renew-admin, both directions. Renewal
    // rotates the token binding, so the renewed bearer (not the original)
    // is the usable credential afterwards; the stranger's denial must leave
    // the session usable under it.
    for (const [ownerName, strangerName] of [['main', 'alt'], ['alt', 'main']]) {
      const s = ownerName === 'main' ? sessA : sessB;
      const renewed = await clients[ownerName].request(
        'POST', `/v1/playback/sessions/${encodeURIComponent(s.id)}/renew-admin`, {},
      );
      expect('tenant-renew-owner', renewed.status === ISOLATION_CODES.renewOwner, { status: renewed.status });
      if (typeof renewed.json?.playbackToken === 'string' && renewed.json.playbackToken.length > 0) {
        s.bearer = renewed.json.playbackToken;
      }
      const deniedRenew = await clients[strangerName].request(
        'POST', `/v1/playback/sessions/${encodeURIComponent(s.id)}/renew-admin`, {},
      );
      expect('tenant-renew-stranger-denied', deniedRenew.status === ISOLATION_CODES.renewStranger, {
        status: deniedRenew.status,
      });
      const stillUsable = await clients[ownerName].heartbeat(s.id, { deviceId: s.deviceId, bearer: s.bearer });
      expect('tenant-heartbeat-after-denied-renew', stillUsable.status === ISOLATION_CODES.heartbeatAfterDeniedRenew, {
        status: stillUsable.status,
      });
    }

    // 7. Both assets survived everything: still READY.
    for (const [name, asset] of [['main', assetA], ['alt', assetB]]) {
      const survived = await clients[name].mediaStatus(asset.assetId);
      expect('tenant-survives-denials', survived.status === ISOLATION_CODES.ownerStatus && survived.json?.status === 'READY', {
        status: survived.status, state: survived.json?.status,
      });
    }

    // 8. End all sessions, delete each asset through its owner, verify cleanup.
    for (const s of sessions) {
      const ended = await clients[s.tenant].endSession(s.id, { deviceId: s.deviceId, bearer: s.bearer });
      expect('tenant-session-end', ended.status === ISOLATION_CODES.ownerSessionEnd, { status: ended.status });
    }
    sessions.length = 0;
    deletedA = await deleteAsset(ctx, clients.main, assetA);
    deletedB = await deleteAsset(ctx, clients.alt, assetB);
    return { completed: deletedA && deletedB };
  } finally {
    for (const s of sessions) {
      await clients[s.tenant].endSession(s.id, { deviceId: s.deviceId, bearer: s.bearer }).catch(() => {});
    }
    if (assetA && !deletedA) {
      deletedA = await deleteAsset(ctx, clients.main, assetA).catch(() => false);
    }
    if (assetB && !deletedB) {
      deletedB = await deleteAsset(ctx, clients.alt, assetB).catch(() => false);
    }
  }
}
