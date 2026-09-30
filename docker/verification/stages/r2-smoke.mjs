/**
 * Stage: direct R2 object-storage proof (TEST-ONLY).
 *
 * Covers PUT, HEAD, GET byte equality, LIST, single-object DELETE and the final
 * empty-prefix check, plus an unrelated preservation control that must survive
 * deletion of a media asset and is removed only by an exact-key delete.
 */

import { assertTestPrefix } from '../lib/s3.mjs';
import { expect, recordSkip, step } from '../lib/safe-log.mjs';

export async function r2Smoke(ctx) {
  step('r2-smoke');
  const s3 = ctx.s3;
  assertTestPrefix(ctx.smokePrefix, ctx.testRoot);
  assertTestPrefix(ctx.preservePrefix, ctx.testRoot);

  // 1. Credentials: presence and length only.
  const described = s3.constructor.describeCredentials(s3.config);
  for (const field of described) {
    expect('r2-credential-present', field.present, {
      label: field.label,
      length: field.length,
    });
  }

  // 2. Exact-prefix round trip with an unrelated control object.
  const body = Buffer.from(`pre-m5-live-verify ${ctx.runId}`);
  const objectKey = `${ctx.smokePrefix}probe.txt`;
  const controlKey = `${ctx.preservePrefix}control.txt`;

  const put = await s3.putObject({
    key: objectKey,
    body,
    contentType: 'text/plain',
    scopePrefix: ctx.smokePrefix,
  });
  expect('r2-put', put.status === 200, { status: put.status, bytes: put.bytes, ms: put.elapsedMs });

  const head = await s3.headObject({ key: objectKey });
  expect('r2-head', head.status === 200, { status: head.status, ms: head.elapsedMs });

  const get = await s3.getObject({ key: objectKey });
  expect('r2-get-status', get.status === 200, { status: get.status, ms: get.elapsedMs });
  expect('r2-get-bytes-equal', get.body.equals(body), { bytes: get.bytes });

  const listed = await s3.listKeys({ prefix: ctx.smokePrefix });
  expect('r2-list-status', listed.status === 200, { status: listed.status });
  expect('r2-list', listed.status === 200 && listed.keys.includes(objectKey), {
    status: listed.status,
    count: listed.keys.length,
  });

  // 3. Unrelated preservation control, created under the run prefix.
  const controlPut = await s3.putObject({
    key: controlKey,
    body: Buffer.from(`preserve ${ctx.runId}`),
    contentType: 'text/plain',
    scopePrefix: ctx.preservePrefix,
  });
  expect('r2-control-created', controlPut.status === 200, { status: controlPut.status });

  // 4. Single-object delete of the probe only.
  const del = await s3.deleteObject({ key: objectKey, scopePrefix: ctx.smokePrefix });
  expect('r2-delete-object', del.status === 204 || del.status === 200, { status: del.status });

  const headAfter = await s3.headObject({ key: objectKey });
  expect('r2-deleted-absent', headAfter.status === 404, { status: headAfter.status });

  const empty = await s3.listKeys({ prefix: ctx.smokePrefix });
  expect('r2-empty-list-status', empty.status === 200, { status: empty.status });
  expect('r2-prefix-empty', empty.status === 200 && empty.keys.length === 0, {
    count: empty.keys.length,
  });

  // 5. The control must still exist.
  const controlHead = await s3.headObject({ key: controlKey });
  expect('r2-control-preserved', controlHead.status === 200, { status: controlHead.status });

  recordSkip(
    'r2-control-cleanup',
    'run r2-cleanup after the lifecycle stages to delete the preservation control by exact key',
  );
  return { objectKey, controlKey, controlBody: body };
}

/** Stage: delete the run's preservation control by exact key and verify empty. */
export async function r2ControlCleanup(ctx, controlKey) {
  step('r2-control-cleanup');
  const s3 = ctx.s3;
  assertTestPrefix(ctx.preservePrefix, ctx.testRoot);
  if (!controlKey || !controlKey.startsWith(ctx.preservePrefix)) {
    throw new Error('refusing to delete a control outside this run prefix');
  }
  const del = await s3.deleteObject({ key: controlKey, scopePrefix: ctx.preservePrefix });
  expect('r2-control-deleted', del.status === 204 || del.status === 200, { status: del.status });
  const after = await s3.listKeys({ prefix: ctx.preservePrefix });
  expect('r2-control-list-status', after.status === 200, { status: after.status });
  expect('r2-control-prefix-empty', after.status === 200 && after.keys.length === 0, {
    count: after.keys.length,
  });
}

/** Stage: verify a preservation control still exists (used after asset deletion). */
export async function r2ControlPresent(ctx, controlKey) {
  step('r2-control-present');
  if (!controlKey) {
    recordSkip('r2-control-present', 'no preservation control in this run');
    return false;
  }
  const head = await ctx.s3.headObject({ key: controlKey });
  return expect('r2-control-still-present', head.status === 200, { status: head.status });
}
