/**
 * Stage: legacy leftover cleanup (TEST-ONLY).
 *
 * Removes the single object the pre-rotation run left under `pre-m5-preserve/`.
 * The guard is deliberately strict: exactly one key, matching the known legacy
 * name pattern, and nothing else. If anything is ambiguous the stage aborts
 * without deleting, so an unrelated object can never be removed by accident.
 */

import { expect, recordBlocked, step } from '../lib/safe-log.mjs';
import { LEGACY_PREFIX } from '../lib/context.mjs';

const LEGACY_PATTERN = /^pre-m5-preserve\/unrelated-[A-Za-z0-9-]+\.txt$/;

export async function legacyCleanup(ctx) {
  step('legacy-cleanup');
  const s3 = ctx.s3;

  const listed = await s3.listKeys({ prefix: LEGACY_PREFIX });
  if (listed.status !== 200) {
    recordBlocked('legacy-cleanup', {
      status: listed.status,
      note: 'legacy prefix could not be listed',
    });
    return { removed: false };
  }
  expect('legacy-prefix-listed', true, { count: listed.keys.length });

  if (listed.keys.length === 0) {
    expect('legacy-already-clean', true, { count: 0 });
    return { removed: false, alreadyClean: true };
  }

  if (listed.keys.length !== 1) {
    recordBlocked('legacy-cleanup', {
      count: listed.keys.length,
      note: 'legacy prefix is ambiguous; expected exactly one object',
    });
    return { removed: false, aborted: 'ambiguous' };
  }

  const key = listed.keys[0];
  if (!LEGACY_PATTERN.test(key)) {
    recordBlocked('legacy-cleanup', {
      note: 'legacy object name is not the accepted exact pattern',
    });
    return { removed: false, aborted: 'unexpected-name' };
  }

  const deleted = await s3.deleteLegacyObject({ key });
  expect('legacy-object-deleted', deleted.status === 204 || deleted.status === 200, {
    status: deleted.status,
  });

  const after = await s3.listKeys({ prefix: LEGACY_PREFIX });
  expect('legacy-list-after-status', after.status === 200, { status: after.status });
  expect('legacy-prefix-empty', after.status === 200 && after.keys.length === 0, {
    count: after.keys.length,
  });
  return { removed: true };
}
