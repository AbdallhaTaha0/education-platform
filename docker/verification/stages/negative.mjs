/**
 * Stage: negative and token cases (TEST-ONLY).
 *
 * Fresh run-scoped identities, expected-versus-actual statuses, and no
 * sensitive response bodies. Production DRM settings are never weakened; the
 * expired-token case waits out the real configured TTL with bounded polling and
 * reports the observed duration.
 */

import crypto from 'node:crypto';
import { expect, recordBlocked, step } from '../lib/safe-log.mjs';
import { pollUntil } from '../lib/context.mjs';
import { DrmClient } from '../lib/drm.mjs';
import { createPlaybackAssertion } from '../lib/assertion.mjs';

const ZERO_UUID = '00000000-0000-4000-8000-000000000000';

export async function negativeCases(ctx, target = {}) {
  step('negative');
  const drm = ctx.drm;
  const runId = ctx.runId;
  const results = {};
  if (!target.assetId || !target.externalAssetId) {
    recordBlocked('negative-live-context', {
      note: 'active lifecycle state is required in the same process',
    });
    return results;
  }

  // 1. Missing credentials.
  const missing = await rawPost(ctx.env.DRM_BASE_URL, '/v1/media', {}, {});
  results.missingCredentials = missing.status;
  expect('neg-missing-credentials', missing.status === 401, { status: missing.status });

  // 2. Wrong client id.
  const wrongClient = await drm.request('POST', '/v1/media', {
    body: {},
    headers: { 'X-Client-Id': `absent-client-${runId}` },
  });
  results.wrongClient = wrongClient.status;
  expect('neg-wrong-client', wrongClient.status === 401, { status: wrongClient.status });

  // 3. Wrong secret.
  const wrongSecret = await rawPost(
    ctx.env.DRM_BASE_URL,
    '/v1/media',
    {},
    { 'X-Client-Id': ctx.env.DRM_CLIENT_ID, 'X-Client-Secret': `absent-secret-${runId}-0000000000` },
  );
  results.wrongSecret = wrongSecret.status;
  expect('neg-wrong-secret', wrongSecret.status === 401, { status: wrongSecret.status });

  // 4. Assertions are mandatory before any asset lookup occurs.
  const missingAssertion = await drm.createPlaybackSession({
    externalUserId: `pre-m5-user-${runId}`,
    externalAssetId: target.externalAssetId,
    deviceId: `pre-m5-device-${runId}`,
  });
  results.missingAssertion = missingAssertion.status;
  expect('neg-missing-assertion', missingAssertion.status === 401, {
    status: missingAssertion.status,
  });

  // 5. Unknown asset on playback for the owning tenant, with a valid signed assertion.
  const unknownExternalAssetId = `absent-asset-${runId}`;
  const unknownDeviceId = `pre-m5-device-${runId}`;
  const unknownAsset = await drm.createPlaybackSession({
    externalUserId: `pre-m5-user-${runId}`,
    externalAssetId: unknownExternalAssetId,
    deviceId: unknownDeviceId,
    assertion: assertionFor(ctx, {
      assetId: unknownExternalAssetId,
      deviceId: unknownDeviceId,
    }),
  });
  results.unknownAsset = unknownAsset.status;
  expect('neg-unknown-asset', unknownAsset.status === 404, { status: unknownAsset.status });

  // 6. A second configured tenant must not see or operate on the first tenant's asset.
  const altId = ctx.env.VERIFY_ALT_DRM_CLIENT_ID;
  const altSecret = ctx.env.VERIFY_ALT_DRM_CLIENT_SECRET;
  if (!altId || !altSecret) {
    recordBlocked('neg-cross-tenant', { note: 'alternate DRM tenant credentials are required' });
  } else {
    const otherTenant = new DrmClient({
      baseUrl: drm.config.baseUrl,
      clientId: altId,
      clientSecret: altSecret,
    });
    const crossTenant = await otherTenant.mediaStatus(target.assetId);
    expect('neg-cross-tenant', crossTenant.status === 404, { status: crossTenant.status });
    const altDeviceId = `pre-m5-alt-device-${runId}`;
    const altPlayback = await otherTenant.createPlaybackSession({
      externalUserId: `pre-m5-alt-user-${runId}`,
      externalAssetId: target.externalAssetId,
      deviceId: altDeviceId,
      assertion: assertionFor(ctx, {
        applicationId: altId,
        assetId: target.externalAssetId,
        deviceId: altDeviceId,
      }),
    });
    expect('neg-cross-tenant-playback', altPlayback.status === 404, {
      status: altPlayback.status,
    });
    const altDelete = await otherTenant.requestDeletion(target.assetId, target.externalAssetId);
    expect('neg-cross-tenant-delete', altDelete.status === 404, { status: altDelete.status });
  }

  const probeDevice = `pre-m5-negative-device-${runId}`;
  const probeSession = await drm.createPlaybackSession({
    externalUserId: `pre-m5-negative-user-${runId}`,
    externalAssetId: target.externalAssetId,
    deviceId: probeDevice,
    assertion: assertionFor(ctx, {
      userId: `pre-m5-negative-user-${runId}`,
      assetId: target.externalAssetId,
      deviceId: probeDevice,
    }),
  });
  expect('neg-probe-session-created', probeSession.status === 201, {
    status: probeSession.status,
  });
  const probeId = probeSession.json?.playbackSessionId;
  const probeBearer = probeSession.json?.playbackToken;
  const probeExpiresAt = Date.parse(probeSession.json?.tokenExpiresAt || '');
  if (!probeId || !probeBearer || !Number.isFinite(probeExpiresAt)) {
    recordBlocked('negative-probe-session', { note: 'negative session contract is incomplete' });
    return results;
  }

  if (altId && altSecret) {
    const otherTenant = new DrmClient({
      baseUrl: drm.config.baseUrl,
      clientId: altId,
      clientSecret: altSecret,
    });
    const crossRenew = await otherTenant.renewSessionForApplication(probeId);
    expect('neg-cross-tenant-renew', crossRenew.status === 403, {
      status: crossRenew.status,
    });
  }

  // 6. Malformed bearer token on heartbeat.
  const malformed = await drm.heartbeat(ZERO_UUID, {
    deviceId: 'absent-device',
    bearer: 'not.a.real.token',
  });
  results.malformedToken = malformed.status;
  expect('neg-malformed-token', malformed.status === 401, { status: malformed.status });

  // 7. Wrong session id with a well-formed request.
  const wrongSession = await drm.heartbeat(ZERO_UUID, {
    deviceId: probeDevice,
    bearer: probeBearer,
  });
  results.wrongSession = wrongSession.status;
  expect('neg-wrong-session', wrongSession.status >= 400, { status: wrongSession.status });

  const wrongDevice = await drm.heartbeat(probeId, {
    deviceId: 'absent-device',
    bearer: probeBearer,
  });
  expect('neg-wrong-device', wrongDevice.status === 403, { status: wrongDevice.status });

  // 8. Malformed playback assertion.
  const badAssertion = await drm.createPlaybackSession({
    externalUserId: `pre-m5-user-${runId}`,
    externalAssetId: target.externalAssetId || `absent-asset-${runId}`,
    deviceId: `pre-m5-device-${runId}`,
    assertion: 'not-a-jwt',
  });
  results.badAssertion = badAssertion.status;
  expect('neg-malformed-assertion', badAssertion.status >= 400, { status: badAssertion.status });

  // 9. License with an invalid challenge.
  const badLicense = await drm.requestLicense({
    bearer: probeBearer,
    challenge: { kids: [], type: 'temporary' },
  });
  results.invalidLicenseChallenge = badLicense.status;
  expect('neg-license-invalid-challenge', badLicense.status >= 400, { status: badLicense.status });

  // 10. Upload recovery after the asset leaves UPLOADED.
  const recovery = await drm.registerMedia({
    externalAssetId: target.externalAssetId,
    contentType: 'video/mp4',
    securityTier: 'STANDARD',
    idempotencyKey: `pre-m5-${ctx.runId}`,
  });
  results.uploadRecoveryAfterReady = recovery.status;
  expect('neg-upload-recovery-after-ready', recovery.status === 409, {
    status: recovery.status,
  });

  // 11-12. Repeated completion and deletion are covered in the lifecycle stage.

  // 13. Expired playback token: bounded wait for the real configured TTL.
  const includeExpiry = String(ctx.env.VERIFY_INCLUDE_EXPIRY || '') === 'true';
  if (!includeExpiry) {
    recordBlocked('neg-expired-token', {
      note: 'VERIFY_INCLUDE_EXPIRY=true is required for the final live proof',
    });
  } else {
    const intervalMs = 5000;
    const attempts = Math.max(
      2,
      Math.min(300, Math.ceil((probeExpiresAt - Date.now() + 15000) / intervalMs)),
    );
    const observed = await pollUntil({
      label: 'neg-expired-token',
      attempts,
      intervalMs,
      probe: async () =>
        drm.heartbeat(probeId, {
          deviceId: probeDevice,
          bearer: probeBearer,
        }),
      done: (state, result) => result && result.status === 401,
      onState: () => step('neg-expired-poll'),
    });
    expect('neg-expired-token', observed.reached, {
      status: observed.result?.status,
      attempts: observed.attempts,
      durationMs: observed.attempts * intervalMs,
    });
    const cleanup = await drm.revokeSession(probeId, { reason: 'PRE_M5_EXPIRY_VERIFICATION' });
    expect('neg-expiry-session-revoked', cleanup.status === 200, { status: cleanup.status });
  }

  return results;
}

function assertionFor(ctx, overrides = {}) {
  return createPlaybackAssertion(ctx.env, {
    applicationId: overrides.applicationId || ctx.env.DRM_CLIENT_ID,
    userId: overrides.userId || `pre-m5-user-${ctx.runId}`,
    courseId: `pre-m5-course-${ctx.runId}`,
    lessonId: `pre-m5-lesson-${ctx.runId}`,
    assetId: overrides.assetId,
    deviceId: overrides.deviceId,
  });
}

async function rawPost(baseUrl, path, body, headers) {
  const response = await fetch(`${baseUrl.replace(/\/+$/, '')}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
  await response.arrayBuffer();
  return { status: response.status };
}

/** Fresh second tenant, used to prove cross-tenant isolation without leaking ids. */
export async function secondTenantCredentials(env) {
  const suffix = crypto.randomBytes(6).toString('hex');
  return {
    clientId: `pre-m5-alt-${suffix}`,
    clientSecret: crypto.randomBytes(32).toString('hex'),
  };
}
