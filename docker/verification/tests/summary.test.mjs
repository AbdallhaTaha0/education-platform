import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  expect,
  outcomeCounts,
  recordBlocked,
  recordFail,
  recordOk,
  verdictFor,
} from '../lib/safe-log.mjs';

for (const [method, verdict, status] of [['recordOk', 'PASS', 0], ['recordFail', 'FAIL', 1], ['recordBlocked', 'BLOCKED', 1]]) {
  await test(`summary process propagates ${verdict} and exit ${status}`, () => {
    const moduleUrl = new URL('../lib/safe-log.mjs', import.meta.url).href;
    const child = spawnSync(process.execPath, ['--input-type=module', '-e',
      `import { ${method}, summary } from ${JSON.stringify(moduleUrl)}; ${method}('probe'); summary();`], { encoding: 'utf8' });
    assert.equal(child.status, status);
    const records = `${child.stdout}\n${child.stderr}`.trim().split('\n').filter(line => line.trim()).map(line => JSON.parse(line));
    assert.equal(records.find(record => record.step === 'result')?.verdict, verdict);
    assert.equal(records.find(record => record.step === 'summary')?.failed, method === 'recordFail' ? 1 : 0);
    assert.equal(records.find(record => record.step === 'summary')?.blocked, method === 'recordBlocked' ? 1 : 0);
  });
}

/**
 * Direct regression tests for verdict and evidence-summary accounting.
 * Covers the previously observed `failed` versus `failures` key mismatch:
 * verdictFor must read the same outcome shape the summary path uses, and any
 * failing or blocked check must force a failure verdict with a non-zero exit.
 */

await test('verdictFor passes only a clean outcome', () => {
  assert.deepEqual(verdictFor({ failures: 0, blocked: 0 }), { verdict: 'PASS', exitCode: 0 });
});

await test('verdictFor fails when any check failed', () => {
  assert.deepEqual(verdictFor({ failures: 1, blocked: 0 }), { verdict: 'FAIL', exitCode: 1 });
  assert.deepEqual(verdictFor({ failures: 3, blocked: 0 }), { verdict: 'FAIL', exitCode: 1 });
});

await test('verdictFor blocks when any check is blocked', () => {
  assert.deepEqual(verdictFor({ failures: 0, blocked: 1 }), { verdict: 'BLOCKED', exitCode: 1 });
});

await test('verdictFor prefers FAIL over BLOCKED when both present', () => {
  assert.deepEqual(verdictFor({ failures: 1, blocked: 2 }), { verdict: 'FAIL', exitCode: 1 });
});

await test('outcomeCounts reflects mixed recorded outcomes', () => {
  recordOk('summary-test-ok', {});
  expect('summary-test-expect-true', true, {});
  expect('summary-test-expect-false', false, {});
  recordBlocked('summary-test-blocked', {});
  const counts = outcomeCounts();
  assert.equal(counts.failures >= 1, true);
  assert.equal(counts.blocked >= 1, true);
  assert.deepEqual(verdictFor(counts).exitCode === 0, false);
});

await test('recordFail always marks the failure for the verdict', () => {
  const before = outcomeCounts();
  recordFail('summary-test-fail-marker', {});
  const after = outcomeCounts();
  assert.equal(after.failures, before.failures + 1);
  assert.equal(verdictFor(after).verdict, 'FAIL');
});
