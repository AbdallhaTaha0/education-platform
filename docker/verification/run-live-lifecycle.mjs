/** Reproducible Docker runner for the live R2/DRM lifecycle (TEST-ONLY).
 *
 * Executes `r2-smoke drm-lifecycle r2-cleanup` from
 * pre-m5-live-lifecycle.mjs entirely inside Docker: a fresh MP4 is generated
 * with the DRM worker image, the harness stages run in a transient node
 * container, and exact cleanup (control object, run prefix, scratch volume)
 * runs on failure as well as success (harness finalizers).
 *
 * Safety properties:
 * - Credentials travel in a 0600 env-file passed via --env-file, never in
 *   command arguments and never printed. The file is deleted afterwards,
 *   even when a stage fails.
 * - The repository is mounted read-only; all writable state (media, harness
 *   state file) lives in a uniquely named scratch volume removed afterwards.
 * - The harness state file is pre-created owned by the stage runtime user
 *   (uid 999) with mode 0600. No world-writable files are ever created.
 * - Every subprocess exit code is checked explicitly; stderr is captured and
 *   reported truncated. The runner exits non-zero when any setup step, stage
 *   or required cleanup fails. The final `runner exit=N` line is authoritative:
 *   PowerShell `$?`/`exit=False` only reflects that the harness writes
 *   informational records to stderr by design, never the process outcome.
 * - Only run-scoped R2 prefixes are touched (harness prefix guards); the
 *   container uses the container-accessible DRM address
 *   http://host.docker.internal:3000, so platform JWKS connectivity is
 *   preserved for the RS256 assertion path.
 * - No tenants, users, CORS changes, tenants isolation/expiry tests, commits
 *   or pushes. Earlier host-executed runs are historical/provisional; only a
 *   run through this file counts as reproducible Docker evidence.
 *
 * Usage (repository root, PowerShell):
 *   node docker/verification/run-live-lifecycle.mjs [--dry-run] [stage...]
 * Stages default to `r2-smoke drm-lifecycle r2-cleanup`; any lifecycle stage
 * name is accepted (validated by the harness), e.g. `tenant-isolation` for
 * the cross-tenant asset-isolation proof (media is still generated first).
 */
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(import.meta.dirname, '..', '..');
const STAGE_IMAGE = 'edu-platform-server:0.5.0-m5-rs256verify';
const WORKER_IMAGE = 'education-drm-service-worker:0.5.0-m5-verify';
const HARNESS = 'docker/verification/pre-m5-live-lifecycle.mjs';
const STAGES = ['r2-smoke', 'drm-lifecycle', 'r2-cleanup'];
/** Stage containers serve as uid 999; scratch state must belong to them. */
export const STAGE_UID = 999;

export function isUniqueScratch(name) {
  return /^m5-lifecycle-scratch-[0-9a-f]{12}$/.test(name);
}

/** Write KEY=value lines with mode 0600. Values are never returned or printed. */
export function writeEnvFile(path, values, fs = { writeFileSync }) {
  fs.writeFileSync(path, Object.entries(values).map(([k, v]) => `${k}=${v}`).join('\n'), {
    encoding: 'utf8',
    mode: 0o600,
  });
}

/** Argv that pre-creates the harness state file owned by the stage user. */
export function stateSetupArgs(scratch) {
  return scratchFilesSetupArgs(scratch, ['state.json']);
}

/** Truncated stderr for reports. Docker CLI errors carry no credentials because
 * secret values are never placed in argv (regression-tested). */
export function summarizeStderr(text) {
  const flat = `${text || ''}`.replace(/\s+/g, ' ').trim();
  return flat.length > 400 ? `${flat.slice(0, 397)}...` : flat;
}

/** Runner exit: 0 only when setup, media, stages AND cleanup all succeed. */
export function decideExit(results) {
  const parts = [results.volume, results.media, results.mediaVisible, results.stateFile, results.stages, results.cleanup];
  return parts.every((code) => code === 0) ? 0 : 1;
}

export function mediaGenArgs(scratch, mediaName) {
  return ['run', '--rm', '--network', 'none', '-u', '0', '-v', `${scratch}:/scratch`, WORKER_IMAGE,
    'ffmpeg', '-hide_banner', '-loglevel', 'error',
    '-f', 'lavfi', '-i', 'testsrc=duration=1:size=320x240:rate=15',
    '-f', 'lavfi', '-i', 'sine=frequency=440:duration=1',
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest', `/scratch/${mediaName}`];
}

export function lsMediaArgs(scratch, mediaName) {
  return ['run', '--rm', '-v', `${scratch}:/scratch`, STAGE_IMAGE, 'ls', '-l', `/scratch/${mediaName}`];
}

/** Pre-create scratch files owned by the stage user with mode 0600. */
export function scratchFilesSetupArgs(scratch, names) {
  const chain = names.map((n) => `touch /scratch/${n} && chown ${STAGE_UID}:${STAGE_UID} /scratch/${n} && chmod 600 /scratch/${n}`).join(' && ');
  return ['run', '--rm', '--network', 'none', '-u', '0', '-v', `${scratch}:/scratch`, WORKER_IMAGE, 'sh', '-c', chain];
}

/**
 * Independently recount harness evidence: every emitted check record must be
 * reflected in the summary, and the verdict must match the process outcome.
 * Returns { records, fails, summary, verdict, disagreement[] }.
 */
export function verifyEvidence(logText) {
  const records = [];
  for (const line of String(logText ?? '').split(/\r?\n/)) {
    const text = line.trim();
    if (!text.startsWith('{')) continue;
    try {
      const record = JSON.parse(text);
      if (record && typeof record.step === 'string') records.push(record);
    } catch { /* non-evidence line */ }
  }
  const checks = records.filter((r) => 'ok' in r && r.step !== 'summary' && r.step !== 'result');
  const negative = checks.filter((r) => r.ok === false).length;
  const summaries = records.filter((r) => r.step === 'summary');
  const summary = summaries[summaries.length - 1] ?? null;
  const result = records.filter((r) => r.step === 'result').pop() ?? null;
  const disagreement = [];
  if (!summary) {
    disagreement.push('missing summary record');
  } else {
    if (summary.checks !== checks.length) {
      disagreement.push(`summary checks=${summary.checks} but emitted check records=${checks.length}`);
    }
    const counted = (summary.failed ?? 0) + (summary.blocked ?? 0);
    if (counted !== negative) {
      disagreement.push(`summary failed+blocked=${counted} but emitted ok:false=${negative}`);
    }
  }
  return { records: records.length, fails: negative, summary, verdict: result?.verdict ?? null, disagreement };
}

function loadEnvFile(path) {
  const values = {};
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const index = line.indexOf('=');
    if (index > 0) values[line.slice(0, index).trim()] = line.slice(index + 1);
  }
  return values;
}

function realSpawn(args, opts = {}) {
  return spawnSync('docker', args, { encoding: 'utf8', ...opts });
}

/**
 * Full flow with injectable doubles for Docker-executed unit tests.
 * deps: { spawn(args, opts), tag, envValues, root, tmpdir }.
 * Returns { exitCode, results, argvLog }.
 */
export function runFlow(deps) {
  const { spawn, tag, envValues, root: repoRoot, tmpdir: tmp, stages: flowStages = STAGES } = deps;
  const scratch = `m5-lifecycle-scratch-${tag}`;
  const mediaName = `m5-live-${tag}.mp4`;
  const envFile = join(tmp, `m5-lifecycle-env-${tag}`);
  const results = { volume: 1, media: 1, mediaVisible: 1, stateFile: 1, stages: 1, cleanup: 1 };
  const argvLog = [];
  const run = (args, opts = {}) => {
    argvLog.push(args);
    return spawn(args, opts);
  };
  const fail = (step, res) => {
    const detail = summarizeStderr(res.stderr);
    if (detail) process.stderr.write(`run-live-lifecycle: ${step} failed: ${detail}\n`);
    else process.stderr.write(`run-live-lifecycle: ${step} failed with exit ${res.status ?? 'unknown'}\n`);
  };

  try {
    if (!isUniqueScratch(scratch)) throw new Error('scratch volume name is not unique/run-scoped');
    writeEnvFile(envFile, envValues);

    const mkVol = run(['volume', 'create', scratch]);
    results.volume = mkVol.status ?? 1;
    if (results.volume !== 0) { fail('volume create', mkVol); return { exitCode: 1, results, argvLog }; }

    const gen = run(
      ['run', '--rm', '--network', 'none', '-u', '0', '-v', `${scratch}:/scratch`, WORKER_IMAGE,
        'ffmpeg', '-hide_banner', '-loglevel', 'error',
        '-f', 'lavfi', '-i', 'testsrc=duration=1:size=320x240:rate=15',
        '-f', 'lavfi', '-i', 'sine=frequency=440:duration=1',
        '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest', `/scratch/${mediaName}`],
      { stdio: 'pipe' },
    );
    results.media = gen.status ?? 1;
    if (results.media !== 0) { fail('media generation', gen); return { exitCode: 1, results, argvLog }; }

    const lsMedia = run(lsMediaArgs(scratch, mediaName));
    results.mediaVisible = lsMedia.status ?? 1;
    if (results.mediaVisible !== 0) { fail('media visibility', lsMedia); return { exitCode: 1, results, argvLog }; }
    process.stdout.write(`media file present: ${(lsMedia.stdout || '').trim().split(/\s+/)[4] || 'unknown'} bytes\n`);

    const setup = run(stateSetupArgs(scratch));
    results.stateFile = setup.status ?? 1;
    if (results.stateFile !== 0) { fail('state file setup', setup); return { exitCode: 1, results, argvLog }; }

    const stages = run(
      ['run', '--rm', '--env-file', envFile, '-v', `${repoRoot}:/repo:ro`, '-v', `${scratch}:/scratch`,
        '-w', '/repo', STAGE_IMAGE, 'node', HARNESS, ...flowStages],
      { stdio: 'inherit' },
    );
    results.stages = stages.status ?? 1;
    if (results.stages !== 0) fail('harness stages', stages);
  } finally {
    try { rmSync(envFile, { force: true }); } catch { /* already gone */ }
    const ls = run(['volume', 'inspect', scratch]);
    if (ls.status === 0) {
      const rm = run(['volume', 'rm', scratch]);
      results.cleanup = rm.status ?? 1;
      process.stdout.write(`scratch volume removed=${results.cleanup === 0}\n`);
      if (results.cleanup !== 0) fail('scratch volume removal', rm);
    } else {
      results.cleanup = 0;
      process.stdout.write('scratch volume removed=n/a (absent)\n');
    }
  }
  return { exitCode: decideExit(results), results, argvLog };
}

export const RS256_POSTGRES = 'education-platform-rs256-postgres-1';

/** Toolbox argv addressing a file INSIDE the mounted scratch volume (/s/...),
 * never the container root. Regression-tested: a missing /s/ prefix made the
 * orchestrator blind to the stage's fixture request. */
export function scratchReadArgs(volume, file) {
  return ['run', '--rm', '-v', `${volume}:/s`, STAGE_IMAGE, 'cat', `/s/${file}`];
}

export function scratchWriteArgs(volume, file) {
  return ['run', '--rm', '-i', '-v', `${volume}:/s`, STAGE_IMAGE, 'sh', '-c', `cat > /s/${file}`];
}

/**
 * Detached subscription-expiry flow with a guarded mid-flow SQL fixture.
 * The stage container (no docker CLI, no secrets on disk beyond the harness
 * env-file) performs setup, writes the fixture request to ISO_FILE and waits
 * for ISO_DONE_FILE. The orchestrator (this function, host docker CLI)
 * applies the identical guarded SQL from stages/subscription-expiry.mjs,
 * verifies exactly one row changed, writes the marker, then collects the
 * stage logs, verifies evidence agreement, and cleans up. Every step is
 * exit-checked; cleanup runs on all paths.
 */
export async function runIsoFlow(deps) {
  const { spawn, tag, envValues, root: repoRoot, tmpdir: tmp, readScratch, writeScratch, sleepMs = 5000, isoWaits = 48,
    stageImage = STAGE_IMAGE, stageCommand = ['node', HARNESS, 'subscription-expiry'],
    extraMounts = [], generateMedia = mediaGenArgs, stageWorkdir = '/repo', evidencePath = null,
  } = deps;
  const scratch = `m5-lifecycle-scratch-${tag}`;
  const mediaName = `m5-live-${tag}.mp4`;
  const envFile = join(tmp, `m5-lifecycle-env-${tag}`);
  const cname = `m5-iso-stage-${tag}`;
  const results = { volume: 1, media: 1, mediaVisible: 1, stateFile: 1, stages: 1, fixture: 1, evidence: 1, cleanup: 1 };
  const argvLog = [];
  let cid = null;
  const run = (args, opts = {}) => {
    argvLog.push(args);
    return spawn(args, opts);
  };
  const fail = (step, res) => {
    const detail = summarizeStderr(res?.stderr);
    if (detail) process.stderr.write(`run-live-lifecycle: ${step} failed: ${detail}\n`);
    else process.stderr.write(`run-live-lifecycle: ${step} failed with exit ${res?.status ?? 'unknown'}\n`);
  };

  try {
    if (!isUniqueScratch(scratch)) throw new Error('scratch volume name is not unique/run-scoped');
    writeEnvFile(envFile, envValues);

    const mkVol = run(['volume', 'create', scratch]);
    results.volume = mkVol.status ?? 1;
    if (results.volume !== 0) { fail('volume create', mkVol); return { exitCode: 1, results, argvLog }; }

    const gen = run(generateMedia(scratch, mediaName), { stdio: 'pipe' });
    results.media = gen.status ?? 1;
    if (results.media !== 0) { fail('media generation', gen); return { exitCode: 1, results, argvLog }; }

    const lsMedia = run(lsMediaArgs(scratch, mediaName));
    results.mediaVisible = lsMedia.status ?? 1;
    if (results.mediaVisible !== 0) { fail('media visibility', lsMedia); return { exitCode: 1, results, argvLog }; }

    const setup = run(scratchFilesSetupArgs(scratch, ['state.json', 'iso.json', 'iso-done.json']));
    results.stateFile = setup.status ?? 1;
    if (results.stateFile !== 0) { fail('scratch files setup', setup); return { exitCode: 1, results, argvLog }; }

    const start = run(['run', '-d', '--name', cname, '--env-file', envFile,
      '-v', `${repoRoot}:/repo:ro`, '-v', `${scratch}:/scratch`, ...extraMounts, '-w', stageWorkdir,
      stageImage, ...stageCommand]);
    if (start.status !== 0) { fail('stage container start', start); return { exitCode: 1, results, argvLog }; }
    cid = `${start.stdout || ''}`.trim();

    // Wait for the fixture request, apply the guarded SQL, mark done.
    let iso = null;
    for (let i = 0; i < isoWaits; i += 1) {
      const content = await readScratch(`${scratch}/iso.json`);
      if (content) {
        try { iso = JSON.parse(content); } catch { iso = null; }
        if (iso && iso.subscriptionId) break;
        iso = null;
      }
      const ps = run(['inspect', '-f', '{{.State.Running}}', cname]);
      if (`${ps.stdout || ''}`.trim() === 'false') break;
      await new Promise((resolveSleep) => setTimeout(resolveSleep, sleepMs));
    }
    if (!iso) {
      const diag = run(['logs', cname]);
      const fullLog = `${diag.stdout || ''}\n${diag.stderr || ''}`;
      const tail = fullLog.trim().split('\n').slice(-8).join(' | ');
      writeFileSync(join(tmp, `m5-iso-evidence-${tag}.log`), fullLog, { mode: 0o600 });
      fail('fixture request', { status: 1, stderr: `iso request never appeared. stage log tail: ${tail}` });
      return { exitCode: 1, results, argvLog };
    }
    const { buildExpiryFixture, buildFixtureGuardSelect } = await import('./stages/subscription-expiry.mjs');
    const guard = run(['exec', RS256_POSTGRES, 'psql', '-U', 'postgres', '-d', 'education_platform', '-tA', '-c',
      buildFixtureGuardSelect(iso.subscriptionId, iso.studentId, iso.courseId)]);
    const guarded = guard.status === 0 && `${guard.stdout || ''}`.trim() === '1';
    if (!guarded) {
      fail('fixture guard', guard);
      return { exitCode: 1, results, argvLog };
    }
    const apply = run(['exec', RS256_POSTGRES, 'psql', '-U', 'postgres', '-d', 'education_platform', '-tA', '-c',
      buildExpiryFixture(iso.subscriptionId, iso.studentId, iso.courseId, iso.targetIso)]);
    const appliedOne = apply.status === 0 && `${apply.stdout || ''}`.trim() === 'UPDATE 1';
    results.fixture = appliedOne ? 0 : 1;
    if (!appliedOne) { fail('fixture apply (exactly one row)', apply); return { exitCode: 1, results, argvLog }; }
    await writeScratch(`${scratch}/iso-done.json`, '{"done":true}');

    const waited = run(['wait', cname]);
    const stageExit = parseInt(`${waited.stdout || ''}`.trim(), 10);
    results.stages = Number.isSafeInteger(stageExit) ? stageExit : 1;
    const logs = run(['logs', cname]);
    // Container stdout AND stderr both carry evidence: safe-log sends
    // passing records to stdout and failures to stderr. Reading only one
    // side hides failures while the summary still counts them.
    const logText = `${logs.stdout || ''}\n${logs.stderr || ''}`;
    if (evidencePath) writeFileSync(evidencePath, logText, { encoding: 'utf8', mode: 0o600 });
    const evidence = verifyEvidence(logText);
    process.stdout.write(`evidence records=${evidence.records} fails=${evidence.fails} verdict=${evidence.verdict} disagreement=${evidence.disagreement.length}\n`);
    results.evidence = evidence.disagreement.length === 0 && evidence.verdict === 'PASS' && results.stages === 0 ? 0 : 1;
    if (results.evidence !== 0) {
      process.stderr.write(`run-live-lifecycle: evidence disagreement: ${evidence.disagreement.join('; ') || `verdict=${evidence.verdict} exit=${results.stages}`}\n`);
      const tail = logText.trim().split('\n').slice(-60).join('\n');
      process.stdout.write(`--- stage log tail ---\n${tail}\n--- end stage log ---\n`);
      try {
        const evidencePath = join(tmp, `m5-iso-evidence-${tag}.log`);
        writeFileSync(evidencePath, logText, { encoding: 'utf8', mode: 0o600 });
        process.stdout.write(`evidence preserved at ${evidencePath}\n`);
      } catch { /* best effort */ }
    }
  } finally {
    try { rmSync(envFile, { force: true }); } catch { /* already gone */ }
    if (cid) run(['rm', '-f', cid]);
    const ls = run(['volume', 'inspect', scratch]);
    if (ls.status === 0) {
      const rm = run(['volume', 'rm', scratch]);
      results.cleanup = rm.status ?? 1;
      process.stdout.write(`scratch volume removed=${results.cleanup === 0}\n`);
      if (results.cleanup !== 0) fail('scratch volume removal', rm);
    } else {
      results.cleanup = 0;
      process.stdout.write('scratch volume removed=n/a (absent)\n');
    }
  }
  const parts = [results.volume, results.media, results.mediaVisible, results.stateFile, results.fixture, results.stages, results.evidence, results.cleanup];
  return { exitCode: parts.every((c) => c === 0) ? 0 : 1, results, argvLog };
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const stages = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  const runStages = stages.length > 0 ? stages : STAGES;
  const tag = randomBytes(6).toString('hex');
  if (dryRun) {
    const scratch = `m5-lifecycle-scratch-${tag}`;
    if (!isUniqueScratch(scratch)) throw new Error('scratch volume name is not unique/run-scoped');
    process.stdout.write(
      `dry-run ok\nvolume=${scratch}\nimages=${STAGE_IMAGE} ${WORKER_IMAGE}\nstages=${runStages.join(' ')}\nstateFile=chown ${STAGE_UID}:${STAGE_UID} mode 600\n`,
    );
    return 0;
  }
  const merged = {
    ...loadEnvFile(join(root, 'education-drm-service', '.env')),
    ...loadEnvFile(join(root, '.env')),
    DRM_BASE_URL: 'http://host.docker.internal:3000',
    PLATFORM_BASE_URL: 'http://host.docker.internal:8082',
    PLATFORM_ORIGIN: 'http://localhost:8082',
    VERIFY_MEDIA_PATH: `/scratch/m5-live-${tag}.mp4`,
    VERIFY_STATE_FILE: '/scratch/state.json',
    ISO_FILE: '/scratch/iso.json',
    ISO_DONE_FILE: '/scratch/iso-done.json',
    R2_APPROVED_ORIGIN: 'http://localhost:8082',
  };
  const isoMode = runStages.length === 1 && runStages[0] === 'subscription-expiry';
  const outcome = isoMode
    ? await runIsoFlow({
      spawn: realSpawn,
      tag,
      envValues: merged,
      root,
      tmpdir: tmpdir(),
      readScratch: async (path) => {
        const [volume, ...rest] = path.split('/').filter(Boolean);
        const r = realSpawn(['run', '--rm', '-v', `${volume}:/s`, STAGE_IMAGE, 'cat', `/s/${rest.join('/')}`], { encoding: 'utf8' });
        return r.status === 0 ? r.stdout : null;
      },
      writeScratch: async (path, content) => {
        const [volume, ...rest] = path.split('/').filter(Boolean);
        const r = realSpawn(['run', '--rm', '-v', `${volume}:/s`, STAGE_IMAGE, 'sh', '-c', `cat > /s/${rest.join('/')}`], {
          encoding: 'utf8', input: content,
        });
        if (r.status !== 0) throw new Error('scratch marker write failed');
      },
    })
    : runFlow({
    spawn: realSpawn,
    tag,
    envValues: merged,
    root,
    tmpdir: tmpdir(),
    stages: runStages,
  });
  process.stdout.write(`runner exit=${outcome.exitCode}\n`);
  return outcome.exitCode;
}

const invokedAsMain = Boolean(process.argv[1]) && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedAsMain) {
  (async () => {
    let code = 1;
    try {
      code = (await main()) ?? 0;
    } catch (err) {
      process.stderr.write(`run-live-lifecycle: ${err.message ?? 'failed'}\n`);
      code = 1;
    }
    process.stdout.write(`runner exit=${code}\n`);
    process.exit(code);
  })();
}
