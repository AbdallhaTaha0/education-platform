/**
 * Sanitized reporting for the Pre-M5 live verification harness (TEST-ONLY).
 *
 * This module is the single place that writes to stdout. It deliberately
 * refuses to print anything that could carry a credential or a bearer
 * equivalent:
 *
 *   - credential values / access keys / secrets
 *   - presigned URLs (query strings are signed credentials)
 *   - bearer tokens, cookies, CSRF tokens, playback assertions
 *   - content keys, KIDs, license payloads, license challenges
 *   - object keys that embed a sensitive identifier
 *   - raw response bodies or error stacks from the DRM or S3
 *
 * Only an allow-listed set of scalar facts is emitted: step name, HTTP status,
 * MIME type, byte count, elapsed milliseconds, a state string, and safe counts.
 */

const ALLOWED_FIELDS = new Set([
  'step',
  'status',
  'mime',
  'bytes',
  'ms',
  'state',
  'count',
  'counts',
  'label',
  'ok',
  'note',
  'skipped',
  'method',
  'attempts',
  'present',
  'length',
  'origin',
  'header',
  'rules',
  'durationMs',
]);

/** Values that must never be echoed, matched case-insensitively. */
const FORBIDDEN_KEY_PATTERNS = [
  /secret/i,
  /passwo?rd/i,
  /access[_-]?key/i,
  /authorization/i,
  /cookie/i,
  /csrf/i,
  /token/i,
  /assertion/i,
  /signature/i,
  /presign/i,
  /credential/i,
  /license/i,
  /challenge/i,
  /\bkid\b/i,
  /content[_-]?key/i,
  /uploadkey/i,
];

import { writeSync } from 'node:fs';

const skipList = [];
let sensitiveValues = [];
/**
 * Authoritative record of every counted check, in emission order. Summaries
 * are DERIVED from this ledger (never from independent counters) so a
 * summary can never disagree with the records it summarizes.
 */
const ledger = [];

function configureSensitiveValues(values) {
  sensitiveValues = [
    ...new Set(values.filter((value) => typeof value === 'string' && value.length > 0)),
  ];
}

function assertNeverPrintable(name) {
  if (FORBIDDEN_KEY_PATTERNS.some((re) => re.test(String(name)))) {
    throw new Error(`refusing to print field "${name}": it may carry a secret`);
  }
}

/** Emit one sanitized record. Only allow-listed keys survive. */
function sanitizeScalar(value) {
  const text = String(value);
  const unsafe =
    /https?:\/\/\S+/i.test(text) ||
    /X-Amz-(?:Signature|Credential|Security-Token)/i.test(text) ||
    /\bBearer\s+\S+/i.test(text) ||
    /(?:^|\s)eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+(?:$|\s)/.test(text) ||
    sensitiveValues.some((secret) => text.includes(secret));
  if (unsafe) return '[redacted]';
  return text.length > 120 ? `${text.slice(0, 117)}...` : text;
}

function sanitizeRecord(record) {
  const safe = {};
  for (const [key, value] of Object.entries(record)) {
    if (!ALLOWED_FIELDS.has(key)) continue;
    assertNeverPrintable(key);
    if (value === undefined || value === null) continue;
    if (typeof value === 'number') {
      safe[key] = Number.isFinite(value) ? value : 'non-finite';
      continue;
    }
    if (typeof value === 'boolean') {
      safe[key] = value;
      continue;
    }
    safe[key] = sanitizeScalar(value);
  }
  return safe;
}

function emit(record, stream = process.stdout) {
  const safe = sanitizeRecord(record);
  // Synchronous writes keep evidence order stable across stdout/stderr when
  // both are captured (e.g. `docker logs`), so no record can be reordered
  // past the summary or lost to an async flush.
  writeSync(stream.fd ?? 1, `${JSON.stringify(safe)}\n`);
}

function step(name) {
  emit({ step: name });
}

function info(fields) {
  emit(fields);
}

function recordOk(name, fields = {}) {
  ledger.push({ step: name, ok: true, blocked: false });
  emit({ step: name, ok: true, ...fields });
}

function recordFail(name, fields = {}) {
  ledger.push({ step: name, ok: false, blocked: false });
  emit({ step: name, ok: false, ...fields }, process.stderr);
}

function recordBlocked(name, fields = {}) {
  ledger.push({ step: name, ok: false, blocked: true });
  emit({ step: name, ok: false, state: 'BLOCKED', ...fields }, process.stderr);
}

function recordSkip(name, reason) {
  skipList.push({ step: name, note: reason });
  emit({ step: name, skipped: true, note: reason });
}

/**
 * Assert an expectation. Records a failure instead of throwing so a single run
 * reports every broken expectation before exiting non-zero.
 */
function expect(name, condition, fields = {}) {
  if (condition) {
    recordOk(name, fields);
    return true;
  }
  recordFail(name, fields);
  return false;
}

function tally() {
  const failed = ledger.filter((r) => r.ok === false && !r.blocked).length;
  const blocked = ledger.filter((r) => r.blocked).length;
  return { checks: ledger.length, failures: failed, failed, blocked };
}

function summary() {
  const { checks, failed, blocked } = tally();
  process.stdout.write(
    `${JSON.stringify({ step: 'summary', checks, failed, blocked, skipped: skipList.length })}\n`,
  );
  for (const item of skipList) {
    emit({ step: 'skipped', ...item }, process.stderr);
  }
  const outcome = verdictFor(tally());
  if (outcome.exitCode !== 0) {
    const verdict = outcome.verdict;
    process.stderr.write(`${JSON.stringify({ step: 'result', verdict })}\n`);
    process.exit(1);
  }
  process.stdout.write(`${JSON.stringify({ step: 'result', verdict: 'PASS' })}\n`);
}

function verdictFor(counts) {
  if (counts.failures > 0) return { verdict: 'FAIL', exitCode: 1 };
  if (counts.blocked > 0) return { verdict: 'BLOCKED', exitCode: 1 };
  return { verdict: 'PASS', exitCode: 0 };
}

function outcomeCounts() {
  const { failed, blocked } = tally();
  return { failures: failed, blocked };
}

function safeErrorCategory(error) {
  if (error instanceof TypeError) return 'TypeError';
  if (error instanceof Error && /^[A-Za-z][A-Za-z0-9]*Error$/.test(error.name)) return error.name;
  return 'Error';
}

export {
  step,
  info,
  recordOk,
  recordFail,
  recordBlocked,
  recordSkip,
  expect,
  summary,
  emit,
  sanitizeRecord,
  configureSensitiveValues,
  safeErrorCategory,
  verdictFor,
  outcomeCounts,
};
