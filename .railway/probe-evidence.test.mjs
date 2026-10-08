import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { redact, saveEvidence } from './probe-evidence.mjs';

test('diagnostics redact authentication and signed URL values', () => {
  const output = redact('known-secret Bearer other-secret https://user:password@example.test/log?signature=signed-secret', ['known-secret']);
  for (const value of ['known-secret', 'other-secret', 'password', 'signed-secret']) assert(!output.includes(value));
  assert(output.includes('example.test/log'));
});
test('failure and cleanup records survive as bounded private local evidence', () => {
  const dir = mkdtempSync(join(tmpdir(), 'fayq-evidence-'));
  try {
    const path = join(dir, 'attempt.jsonl');
    saveEvidence(path, { event: 'failure', detail: 'dummy-token', status: 503 }, ['dummy-token']);
    saveEvidence(path, { event: 'cleanup', confirmed: true, output: 'x'.repeat(50_000) });
    const saved = readFileSync(path, 'utf8');
    assert(!saved.includes('dummy-token'));
    const records = saved.trim().split('\n').map(line => JSON.parse(line));
    assert.equal(records.length, 2);
    assert.equal(records[0].status, 503);
    assert.equal(records[1].confirmed, true);
    assert.equal(records[1].output.length, 16_000);
    if (process.platform !== 'win32') assert.equal(statSync(path).mode & 0o777, 0o600);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
