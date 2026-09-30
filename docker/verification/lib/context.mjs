/**
 * Run context for the Pre-M5 verification harness (TEST-ONLY).
 *
 * Builds a cryptographically unique run identity and the exact, run-scoped
 * prefixes this run is permitted to touch. Nothing else is ever created or
 * deleted.
 */

import crypto from 'node:crypto';
import { S3Client } from './s3.mjs';
import { DrmClient } from './drm.mjs';
import { PlatformClient } from './platform.mjs';

export const DEFAULT_TEST_ROOT = 'pre-m5-live-verify/';

/** Legacy prefix left behind by the pre-rotation run (see report §14). */
export const LEGACY_PREFIX = 'pre-m5-preserve/';

export function newRunId() {
  const unique = crypto.randomBytes(12).toString('hex');
  const stamp = Date.now().toString(36);
  return `${stamp}-${unique}`;
}

export function buildContext(env) {
  const testRoot = env.R2_TEST_ROOT || DEFAULT_TEST_ROOT;
  if (!testRoot.endsWith('/')) {
    throw new Error('R2_TEST_ROOT must end with "/"');
  }
  const runId = env.R2_RUN_ID || newRunId();
  const runPrefix = `${testRoot}${runId}/`;

  return {
    env,
    runId,
    testRoot,
    runPrefix,
    mediaPrefix: `${runPrefix}media/`,
    preservePrefix: `${runPrefix}preserve/`,
    smokePrefix: `${runPrefix}smoke/`,
    s3: S3Client.fromEnv(env),
    drm: DrmClient.fromEnv(env),
    platform: env.PLATFORM_BASE_URL ? PlatformClient.fromEnv(env) : null,
    approvedOrigin: env.R2_APPROVED_ORIGIN || '',
  };
}

/** Media source used for upload proofs: a small freshly generated H.264/AAC MP4. */
export function mediaPath(env) {
  const path = env.VERIFY_MEDIA_PATH;
  if (!path) {
    throw new Error('VERIFY_MEDIA_PATH is required (a freshly generated H.264/AAC MP4)');
  }
  return path;
}

/** Bounded polling helper. Never hides an attempt; reports the count. */
export async function pollUntil({
  label,
  attempts = 30,
  intervalMs = 5000,
  probe,
  done,
  onState,
  getState = (result) => (typeof result === 'string' ? result : result?.state),
}) {
  let state;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const result = await probe(attempt);
    state = getState(result);
    if (onState) onState(attempt, state, result);
    if (done(state, result)) {
      return { reached: true, state, attempts: attempt, result };
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  return { reached: false, state, attempts, result: undefined };
}
