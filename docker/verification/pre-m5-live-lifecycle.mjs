#!/usr/bin/env node
/**
 * Pre-M5 live verification harness (TEST-ONLY).
 *
 * Purpose
 *   Produce reproducible, post-rotation evidence for the mandatory Pre-M5
 *   gates that the earlier ad hoc run could not: direct R2 object operations,
 *   R2 CORS, the DRM-direct lifecycle including an authenticated packaged
 *   segment fetch and a successful ClearKey license, the platform-mediated
 *   lifecycle, and the negative/token cases.
 *
 * Placement and isolation
 *   This file lives in the platform repository under docker/verification/.
 *   It is TEST-ONLY: no runtime or frontend image copies this directory
 *   (every Dockerfile copies only client/, server/, docker/nginx/ or
 *   docker/browser/run.mjs), and it is not part of any published bundle.
 *   It never imports platform application packages, so it cannot couple the
 *   platform to DRM internals.
 *
 * Boundary
 *   - Uses only the public DRM/platform HTTP contracts and provider-standard
 *     S3 requests. It never reads the DRM database, queues, keys, or storage
 *     internals.
 *   - Reads every credential from the environment. It prints no credential,
 *     presigned URL, bearer token, cookie, assertion, key, license payload,
 *     challenge, or response body.
 *   - Mutates only run-scoped prefixes it created, and refuses empty, root,
 *     shared, `uploads/`, and `assets/` prefixes before any delete.
 *
 * Exit status
 *   0 when every assertion in the selected stage passed, 1 otherwise.
 *
 * Usage
 *   node docker/verification/pre-m5-live-lifecycle.mjs <stage> [stage...]
 *   node docker/verification/pre-m5-live-lifecycle.mjs all
 *
 * Stages
 *   selftest         harness safety guards; no network, no credentials
 *   preflight        presence/length of configuration only; no network calls
 *   r2-smoke         direct R2 put/head/get/list/delete + preservation control
 *   cors             owner-authorized CORS read, preflight, presigned PUT
 *   drm-lifecycle    full DRM-direct lifecycle with segment and license proofs
 *   negative         negative and token cases
 *   platform         platform-mediated ingestion and deletion
 *   r2-cleanup       remove this run's preservation control by exact key
 *   legacy-cleanup   remove the single pre-rotation leftover object
 */

import { readFile, writeFile, unlink } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { buildContext, DEFAULT_TEST_ROOT } from './lib/context.mjs';
import {
  step,
  expect,
  recordBlocked,
  summary,
  recordFail,
  configureSensitiveValues,
  safeErrorCategory,
  outcomeCounts,
} from './lib/safe-log.mjs';
import { r2Smoke, r2ControlCleanup, r2ControlPresent } from './stages/r2-smoke.mjs';
import { corsProof } from './stages/cors.mjs';
import { drmLifecycle } from './stages/drm-lifecycle.mjs';
import { tenantIsolation } from './stages/tenant-isolation.mjs';
import { tokenExpiry } from './stages/token-expiry.mjs';
import { subscriptionExpiry } from './stages/subscription-expiry.mjs';
import { negativeCases } from './stages/negative.mjs';
import { platformLifecycle } from './stages/platform-lifecycle.mjs';
import { platformRs256 } from './stages/platform-rs256.mjs';
import { legacyCleanup } from './stages/legacy-cleanup.mjs';
import { selfTest } from './stages/selftest.mjs';

const STATE_FILE = process.env.VERIFY_STATE_FILE || '';

const STAGES = [
  'selftest',
  'preflight',
  'r2-smoke',
  'cors',
  'drm-lifecycle',
  'tenant-isolation',
  'token-expiry',
  'subscription-expiry',
  'negative',
  'platform',
  'platform-rs256',
  'r2-cleanup',
  'legacy-cleanup',
];

function usage() {
  process.stdout.write(
    [
      'Pre-M5 live verification harness (TEST-ONLY).',
      '',
      `usage: node pre-m5-live-lifecycle.mjs <stage|all> [stage...]`,
      `stages: ${STAGES.join(', ')}`,
      '',
      'required env: S3_ENDPOINT S3_BUCKET S3_ACCESS_KEY_ID S3_SECRET_ACCESS_KEY',
      '             DRM_BASE_URL DRM_CLIENT_ID DRM_CLIENT_SECRET',
      'optional env: S3_REGION S3_FORCE_PATH_STYLE R2_TEST_ROOT R2_RUN_ID',
      '             R2_APPROVED_ORIGIN VERIFY_MEDIA_PATH VERIFY_STATE_FILE',
      '             PLATFORM_BASE_URL PLATFORM_ORIGIN',
      '             VERIFY_ADMIN_IDENTIFIER VERIFY_ADMIN_PASSWORD',
      '             VERIFY_INCLUDE_EXPIRY',
      '',
    ].join('\n'),
  );
}

async function readState() {
  if (!STATE_FILE || !existsSync(STATE_FILE)) return {};
  try {
    return JSON.parse(await readFile(STATE_FILE, 'utf8'));
  } catch {
    return {};
  }
}

async function writeState(patch) {
  if (!STATE_FILE) return;
  const current = await readState();
  await writeFile(STATE_FILE, JSON.stringify({ ...current, ...patch }, null, 2), 'utf8');
}

async function preflight(ctx) {
  step('preflight');
  expect('preflight-test-root', ctx.testRoot === DEFAULT_TEST_ROOT || ctx.env.R2_TEST_ROOT, {
    label: 'testRoot',
  });
  expect('preflight-run-prefix', ctx.runPrefix.startsWith(ctx.testRoot), { label: 'runPrefix' });
  expect('preflight-run-id-length', ctx.runId.length >= 16, { length: ctx.runId.length });

  for (const field of ctx.s3.constructor.describeCredentials(ctx.s3.config)) {
    expect('preflight-s3-present', field.present, { label: field.label, length: field.length });
  }
  for (const field of ctx.drm.constructor.describeCredentials(ctx.drm.config)) {
    expect('preflight-drm-present', field.present, { label: field.label, length: field.length });
  }
  if (ctx.env.VERIFY_MEDIA_PATH) {
    expect('preflight-media-present', existsSync(ctx.env.VERIFY_MEDIA_PATH), {
      label: 'VERIFY_MEDIA_PATH',
    });
  } else {
    recordBlocked('preflight-media', { note: 'VERIFY_MEDIA_PATH is required' });
  }
  if (!ctx.approvedOrigin) {
    recordBlocked('preflight-approved-origin', { note: 'R2_APPROVED_ORIGIN is required' });
  }
  for (const name of requiredPreflightNames(ctx.env)) {
    expect('preflight-required-config', Boolean(ctx.env[name]), { label: name });
  }
  expect('preflight-expiry-enabled', ctx.env.VERIFY_INCLUDE_EXPIRY === 'true', {
    label: 'VERIFY_INCLUDE_EXPIRY',
  });
}

export function requiredPreflightNames(env) {
  return [
    'PLATFORM_BASE_URL',
    'PLATFORM_ORIGIN',
    'VERIFY_ADMIN_IDENTIFIER',
    'VERIFY_ADMIN_PASSWORD',
    'VERIFY_ALT_DRM_CLIENT_ID',
    'VERIFY_ALT_DRM_CLIENT_SECRET',
  ].filter((name) => !env[name]);
}

export function requiredStateValue(state, name) {
  const value = state?.[name];
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`required state ${name} is missing`);
  }
  return value;
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    usage();
    process.exit(args.length === 0 ? 2 : 0);
  }
  const requested = args[0] === 'all' ? STAGES : args;
  for (const name of requested) {
    if (!STAGES.includes(name)) {
      process.stderr.write(`${JSON.stringify({ step: 'usage', ok: false, label: name })}\n`);
      usage();
      process.exit(2);
    }
  }

  // The self-test needs neither credentials nor network, so it runs before any
  // configuration is resolved. It proves the safety guards before anything is
  // allowed to touch storage.
  if (requested.length === 1 && requested[0] === 'selftest') {
    try {
      await selfTest();
    } catch (err) {
      recordFail('selftest', { note: safeErrorCategory(err) });
    }
    summary();
    return;
  }

  let ctx;
  try {
    const priorState = await readState();
    const effectiveEnv = {
      ...process.env,
      ...(!process.env.R2_RUN_ID && typeof priorState.runId === 'string'
        ? { R2_RUN_ID: priorState.runId }
        : {}),
    };
    ctx = buildContext(effectiveEnv);
    configureSensitiveValues([
      ctx.s3.config.accessKeyId,
      ctx.s3.config.secretAccessKey,
      ctx.drm.config.clientId,
      ctx.drm.config.clientSecret,
      process.env.VERIFY_ADMIN_PASSWORD,
      process.env.VERIFY_ALT_DRM_CLIENT_ID,
      process.env.VERIFY_ALT_DRM_CLIENT_SECRET,
    ]);
  } catch (err) {
    // Configuration is incomplete or absent. Do not attempt network access.
    recordFail('context', { note: safeErrorCategory(err) });
    summary();
    return;
  }

  const runtime = {};
  let activeNegativeRan = false;
  let controlCleaned = false;
  try {
    for (const name of requested) {
      const before = outcomeCounts();
      switch (name) {
        case 'selftest':
          await selfTest();
          break;
        case 'preflight':
          await preflight(ctx);
          break;
        case 'r2-smoke': {
          const result = await r2Smoke(ctx);
          runtime.controlKey = result.controlKey;
          await writeState({ runId: ctx.runId, controlKey: result.controlKey });
          break;
        }
        case 'cors':
          await corsProof(ctx);
          break;
        case 'drm-lifecycle': {
          const result = await drmLifecycle(ctx, {
            runActiveNegative: requested.includes('negative')
              ? async (target) => {
                  await negativeCases(ctx, target);
                  activeNegativeRan = true;
                }
              : undefined,
          });
          await writeState({
            assetId: result.assetId,
            externalAssetId: result.externalAssetId,
            sessionId: result.sessionId,
            deviceId: result.deviceId,
            segmentProven: result.segmentProven,
            licenseProven: result.licenseProven,
          });
          if (result.completed) {
            const state = await readState();
            if (state.controlKey) {
              await r2ControlPresent(ctx, state.controlKey);
            }
          }
          break;
        }
        case 'negative': {
          if (!activeNegativeRan) {
            recordBlocked('negative', {
              note: 'run all so live token-dependent checks execute in memory before cleanup',
            });
          }
          break;
        }
        case 'tenant-isolation': {
          await tenantIsolation(ctx);
          break;
        }
        case 'token-expiry': {
          await tokenExpiry(ctx);
          break;
        }
        case 'subscription-expiry': {
          await subscriptionExpiry(ctx);
          break;
        }
        case 'platform':
          await platformLifecycle(ctx);
          break;
        case 'platform-rs256':
          await platformRs256(ctx);
          break;
        case 'legacy-cleanup':
          await legacyCleanup(ctx);
          break;
        case 'r2-cleanup': {
          const state = await readState();
          let controlKey;
          try {
            controlKey = runtime.controlKey || requiredStateValue(state, 'controlKey');
          } catch {
            recordBlocked('r2-cleanup', { note: 'preservation-control state is missing' });
            break;
          }
          await r2ControlCleanup(ctx, controlKey);
          controlCleaned = true;
          if (STATE_FILE) await unlink(STATE_FILE).catch(() => {});
          break;
        }
        default:
          break;
      }
      const after = outcomeCounts();
      if (after.failures > before.failures || after.blocked > before.blocked) break;
    }
  } catch (err) {
    recordFail('stage', { note: safeErrorCategory(err) });
  }

  if (requested.includes('r2-cleanup') && runtime.controlKey && !controlCleaned) {
    try {
      await r2ControlCleanup(ctx, runtime.controlKey);
      if (STATE_FILE) await unlink(STATE_FILE).catch(() => {});
    } catch (err) {
      recordFail('r2-cleanup-finalizer', { note: safeErrorCategory(err) });
    }
  }

  summary();
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
