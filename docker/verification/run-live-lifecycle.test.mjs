/** Docker-executed unit tests for run-live-lifecycle.mjs hardening.
 * Credential-free: dummy values only; docker is never contacted (injected
 * spawn double); no live R2 lifecycle runs here. Execute inside Docker:
 *   docker run --rm --network none -v <repo>:/repo:ro -w /repo
 *     edu-platform-server:0.5.0-m5-rs256verify
 *     node docker/verification/run-live-lifecycle.test.mjs
 */
import { readFileSync, statSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  STAGE_UID,
  decideExit,
  isUniqueScratch,
  runFlow,
  runIsoFlow,
  scratchWriteArgs,
  stateSetupArgs,
  summarizeStderr,
  verifyEvidence,
  writeEnvFile,
} from './run-live-lifecycle.mjs';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const DUMMY_SECRET = 's3cr3t-dummy-value-xyz';
const DUMMY_ID = 'AKIA-DUMMY-EXAMPLE';
const dummyEnv = { S3_SECRET_ACCESS_KEY: DUMMY_SECRET, S3_ACCESS_KEY_ID: DUMMY_ID, PLAIN: 'x' };

let failed = 0;
const check = (label, cond) => {
  if (!cond) failed += 1;
  process.stdout.write(`${cond ? 'PASS' : 'FAIL'} ${label}\n`);
};
check(
  'scratch marker writer keeps Docker stdin open',
  scratchWriteArgs('m5-lifecycle-scratch-abcdef123456', 'iso-done.json').includes('-i'),
);

/** Scripted spawn double. Keys: volume, media, visible, setup, stages, rm. */
function fakeSpawn(script) {
  const calls = [];
  const spawn = (args) => {
    calls.push(args);
    if (args[0] === 'volume' && args[1] === 'create') return script.volume ?? { status: 0 };
    if (args[0] === 'volume' && args[1] === 'inspect') return { status: 0 };
    if (args[0] === 'volume' && args[1] === 'rm') return script.rm ?? { status: 0 };
    if (args.includes('ffmpeg')) return script.media ?? { status: 0 };
    if (args.includes('touch')) return script.setup ?? { status: 0 };
    if (args.includes('ls'))
      return script.visible ?? { status: 0, stdout: '-rw-r--r-- 1 999 999 17773 x\n' };
    if (args.some((a) => String(a).includes('pre-m5-live-lifecycle.mjs')))
      return script.stages ?? { status: 0 };
    return { status: 0 };
  };
  return { spawn, calls };
}

function baseDeps(spawn) {
  return { spawn, tag: 'abcdef123456', envValues: dummyEnv, root: '/repo', tmpdir: tmpdir() };
}

const argvHasSecrets = (calls) =>
  calls.some((argv) =>
    argv.some((a) => typeof a === 'string' && (a.includes(DUMMY_SECRET) || a.includes(DUMMY_ID))),
  );

// 1. Successful execution propagates zero and uses restrictive state perms.
{
  const { spawn, calls } = fakeSpawn({});
  const outcome = runFlow(baseDeps(spawn));
  check('success exits zero', outcome.exitCode === 0);
  check(
    'success records all steps zero',
    Object.values(outcome.results).every((c) => c === 0),
  );
  check(
    'success removes the scratch volume',
    calls.some((a) => a[0] === 'volume' && a[1] === 'rm'),
  );
  check('no secret value in any argv', !argvHasSecrets(calls));
}

// 2. Non-zero stage exit propagates and still cleans up.
{
  const { spawn, calls } = fakeSpawn({ stages: { status: 1, stderr: 'stage boom' } });
  const outcome = runFlow(baseDeps(spawn));
  check('stage failure exits non-zero', outcome.exitCode === 1 && outcome.results.stages === 1);
  check(
    'stage failure still removes the scratch volume',
    calls.some((a) => a[0] === 'volume' && a[1] === 'rm'),
  );
  check('stage failure argv carries no secrets', !argvHasSecrets(calls));
}

// 3. Failure before registration (empty stage output) is still a failure.
{
  const { spawn, calls } = fakeSpawn({ stages: { status: 1, stdout: '', stderr: '' } });
  const outcome = runFlow(baseDeps(spawn));
  check('early failure exits non-zero', outcome.exitCode === 1);
  check(
    'early failure still attempts cleanup',
    calls.some((a) => a[0] === 'volume' && a[1] === 'rm'),
  );
}

// 4. Cleanup failure overrides an otherwise green run.
{
  const { spawn } = fakeSpawn({ rm: { status: 1, stderr: 'volume in use' } });
  const outcome = runFlow(baseDeps(spawn));
  check('cleanup failure exits non-zero', outcome.exitCode === 1 && outcome.results.cleanup === 1);
}

// 5. State-file access: ownership matches the stage user, mode restrictive.
{
  const setup = stateSetupArgs('m5-lifecycle-scratch-abcdef123456');
  const flat = setup.join(' ');
  check('state setup targets uid 999', STAGE_UID === 999 && flat.includes('chown 999:999'));
  check('state setup uses mode 600', flat.includes('chmod 600'));
  check(
    'state setup never world-writable',
    !flat.includes('666') && !flat.includes('777') && !flat.includes('o+w'),
  );
  const source = readFileSync(join(HERE, 'run-live-lifecycle.mjs'), 'utf8');
  check('runner source contains no 666/777 modes', !/chmod 666|chmod 777|0o666|0o777/.test(source));
}

// 6. Env file is written 0600 with exact content (dummy values, container tmp).
{
  const p = join(tmpdir(), 'm5-lifecycle-env-test');
  writeEnvFile(p, { A: '1', B: 'x=y' });
  const mode = statSync(p).mode & 0o777;
  const content = readFileSync(p, 'utf8');
  rmSync(p, { force: true });
  check('env file mode is 0600', mode === 0o600);
  check('env file content exact', content === 'A=1\nB=x=y');
}

// 7. Exit decision table.
check(
  'decideExit all-zero is zero',
  decideExit({ volume: 0, media: 0, mediaVisible: 0, stateFile: 0, stages: 0, cleanup: 0 }) === 0,
);
for (const key of ['volume', 'media', 'mediaVisible', 'stateFile', 'stages', 'cleanup']) {
  const r = { volume: 0, media: 0, mediaVisible: 0, stateFile: 0, stages: 0, cleanup: 0, [key]: 1 };
  check(`decideExit fails on ${key}`, decideExit(r) === 1);
}
check(
  'scratch names validated',
  isUniqueScratch('m5-lifecycle-scratch-abcdef123456') && !isUniqueScratch('docker_pgdata'),
);
check('stderr summarized and truncated', summarizeStderr(`x${'y'.repeat(500)}`).length === 400);

if (failed > 0) {
  process.stderr.write(`runner unit tests: ${failed} failure(s)\n`);
  process.exit(1);
}
process.stdout.write('runner unit tests: all pass\n');

// ---- evidence verification (summary must agree with emitted records) ----
const PASS_LOG = [
  '{"step":"a","ok":true,"status":200}',
  '{"step":"b","ok":true,"status":201}',
  '{"step":"summary","checks":2,"failed":0,"blocked":0,"skipped":0}',
  '{"step":"result","verdict":"PASS"}',
].join('\n');
const FAIL_LOG = [
  '{"step":"a","ok":true,"status":200}',
  '{"step":"b","ok":false,"status":500}',
  '{"step":"summary","checks":2,"failed":1,"blocked":0,"skipped":0}',
  '{"step":"result","verdict":"FAIL"}',
].join('\n');
// The historically observed anomaly shape: every check green, summary failed.
const MYSTERY_LOG = [
  '{"step":"a","ok":true,"status":200}',
  '{"step":"b","ok":true,"status":201}',
  '{"step":"summary","checks":2,"failed":1,"blocked":0,"skipped":0}',
  '{"step":"result","verdict":"FAIL"}',
].join('\n');

{
  const v = verifyEvidence(PASS_LOG);
  check(
    'evidence agreeing pass has no disagreement',
    v.disagreement.length === 0 && v.verdict === 'PASS' && v.fails === 0,
  );
}
{
  const v = verifyEvidence(FAIL_LOG);
  check(
    'evidence agreeing fail still agrees (verdict FAIL)',
    v.disagreement.length === 0 && v.verdict === 'FAIL' && v.fails === 1,
  );
}
{
  const v = verifyEvidence(MYSTERY_LOG);
  check(
    'evidence anomaly shape is flagged',
    v.disagreement.length > 0 && v.disagreement.some((d) => d.includes('ok:false=0')),
  );
}
{
  // Failures arrive on container stderr while passes arrive on stdout; the
  // runner must combine both before recounting (regression test: reading
  // stdout alone hid failures while the summary counted them).
  const outLines = [
    '{"step":"a","ok":true,"status":200}',
    '{"step":"summary","checks":2,"failed":1,"blocked":0,"skipped":0}',
    '{"step":"result","verdict":"FAIL"}',
  ];
  const errLines = ['{"step":"b","ok":false,"status":500}'];
  const v = verifyEvidence(`${outLines.join('\n')}\n${errLines.join('\n')}`);
  check('evidence combines stdout and stderr', v.disagreement.length === 0 && v.fails === 1);
}
{
  const v = verifyEvidence('{"step":"a","ok":true}\nnoise without braces\n');
  check(
    'evidence missing summary is flagged',
    v.disagreement.some((d) => d.includes('missing summary')),
  );
  check('evidence ignores non-JSON lines', v.records === 1);
}

// ---- detached iso-flow with doubles ----
const ISO_IDS = {
  subscriptionId: '11111111-1111-4111-8111-111111111111',
  studentId: '22222222-2222-4222-8222-222222222222',
  courseId: '33333333-3333-4333-8333-333333333333',
  targetIso: '2026-09-30T12:00:00.000Z',
};
const ISO_JSON = JSON.stringify(ISO_IDS);

function isoFake({
  guard = '1\n',
  update = 'UPDATE 1\n',
  wait = '0\n',
  log = PASS_LOG,
  rmVol = { status: 0 },
  iso = ISO_JSON,
} = {}) {
  const calls = [];
  const written = [];
  const spawn = (args) => {
    calls.push(args);
    if (args[0] === 'volume' && args[1] === 'create') return { status: 0 };
    if (args[0] === 'volume' && args[1] === 'inspect') return { status: 0 };
    if (args[0] === 'volume' && args[1] === 'rm') return rmVol;
    if (args.includes('ffmpeg')) return { status: 0 };
    if (args.includes('touch') || args.includes('sh')) return { status: 0 };
    if (args.includes('ls')) return { status: 0, stdout: '-rw-r--r-- 1 999 999 17773 x\n' };
    if (args[1] === '-d') return { status: 0, stdout: 'cid-abc\n' };
    if (args[0] === 'exec') {
      const sql = args[args.length - 1];
      if (sql.startsWith('SELECT')) return { status: 0, stdout: guard };
      return { status: 0, stdout: update };
    }
    if (args[0] === 'wait') return { status: 0, stdout: wait };
    if (args[0] === 'logs') return { status: 0, stdout: log };
    if (args[0] === 'inspect') return { status: 0, stdout: 'true\n' };
    if (args[0] === 'rm') return { status: 0 };
    return { status: 0 };
  };
  return {
    spawn,
    calls,
    written,
    readScratch: async () => iso,
    writeScratch: async (p, c) => {
      written.push([p, c]);
    },
  };
}

function isoDeps(fake) {
  return {
    spawn: fake.spawn,
    tag: 'abcdef123456',
    envValues: dummyEnv,
    root: '/repo',
    tmpdir: tmpdir(),
    readScratch: fake.readScratch,
    writeScratch: fake.writeScratch,
    sleepMs: 0,
    isoWaits: 3,
  };
}

{
  const fake = isoFake({});
  const outcome = await runIsoFlow(isoDeps(fake));
  check('iso success exits zero', outcome.exitCode === 0);
  const fixtureCall = fake.calls.find(
    (a) => a[0] === 'exec' && String(a[a.length - 1]).startsWith('UPDATE'),
  );
  const fixtureSql = String((fixtureCall || [])[(fixtureCall || []).length - 1] || '');
  check(
    'iso fixture guards all three identifiers',
    [ISO_IDS.subscriptionId, ISO_IDS.studentId, ISO_IDS.courseId].every((id) =>
      fixtureSql.includes(id),
    ),
  );
  check(
    'iso marker written after fixture',
    fake.written.some(([p]) => p.endsWith('iso-done.json')),
  );
  check(
    'iso removes stage container and volume',
    fake.calls.some((a) => a[0] === 'rm' && a[1] === '-f') &&
      fake.calls.some((a) => a[0] === 'volume' && a[1] === 'rm'),
  );
  check('iso argv carries no secrets', !argvHasSecrets(fake.calls));
}
{
  const fake = isoFake({ guard: '0\n' });
  const outcome = await runIsoFlow(isoDeps(fake));
  check(
    'iso fixture zero-row aborts non-zero',
    outcome.exitCode === 1 && outcome.results.fixture === 1,
  );
  check(
    'iso abort still removes container and volume',
    fake.calls.some((a) => a[0] === 'rm' && a[1] === '-f') &&
      fake.calls.some((a) => a[0] === 'volume' && a[1] === 'rm'),
  );
}
{
  const fake = isoFake({ wait: '1\n', log: FAIL_LOG });
  const outcome = await runIsoFlow(isoDeps(fake));
  check('iso stage failure exits non-zero', outcome.exitCode === 1 && outcome.results.stages === 1);
  check(
    'iso stage failure still cleans the volume',
    fake.calls.some((a) => a[0] === 'volume' && a[1] === 'rm'),
  );
}
{
  const fake = isoFake({ log: MYSTERY_LOG });
  const outcome = await runIsoFlow(isoDeps(fake));
  check(
    'iso evidence disagreement exits non-zero',
    outcome.exitCode === 1 && outcome.results.evidence === 1,
  );
}
{
  const fake = isoFake({});
  fake.readScratch = async () => null;
  const outcome = await runIsoFlow(isoDeps(fake));
  check('iso missing fixture request times out non-zero', outcome.exitCode === 1);
}
{
  // Reader/writer must address the file INSIDE the mounted volume (/s/...),
  // not the container root: regression test for the missed-marker defect.
  const seen = [];
  const outcome = await runIsoFlow({
    ...isoDeps(isoFake({})),
    readScratch: async (path) => {
      seen.push(['read', path]);
      return ISO_JSON;
    },
    writeScratch: async (path, content) => {
      seen.push(['write', path, content.length]);
    },
  });
  check(
    'iso scratch paths stay inside the volume mount',
    seen.every(([op, p]) => p.startsWith('m5-lifecycle-scratch-abcdef123456/')),
  );
  check('iso success exits zero', outcome.exitCode === 0);
}
{
  // Stage container exits before writing the request: abort fast with logs.
  const fake = isoFake({});
  let polls = 0;
  const origSpawn = fake.spawn;
  fake.spawn = (args, opts) => {
    if (args[0] === 'inspect') {
      polls += 1;
      return { status: 0, stdout: 'false\n' };
    }
    return origSpawn(args, opts);
  };
  fake.readScratch = async () => null;
  const outcome = await runIsoFlow(isoDeps(fake));
  check('iso early stage exit aborts without full wait', outcome.exitCode === 1 && polls <= 2);
}

if (failed > 0) {
  process.stderr.write(`iso-flow unit tests: ${failed} failure(s)\n`);
  process.exit(1);
}
process.stdout.write('iso-flow unit tests: all pass\n');
