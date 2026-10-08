// Bounded Railway grading-image qualification probe. No service deployment.
// Upload allowlist excludes environment files, credentials and application data.
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import ts from './node_modules/typescript/lib/typescript.js';
import { Sandbox } from './node_modules/railway/dist/index.js';
import { saveEvidence, redact } from './probe-evidence.mjs';

const root = resolve(import.meta.dirname, '..');
const runscMode = process.argv.includes('--runsc');
if (process.argv.slice(2).some(arg => arg !== '--runsc')) throw new Error('Unknown probe option.');
const remote = '/tmp/fayq-grading-probe';
const token = JSON.parse(readFileSync(join(homedir(), '.railway/config.json'), 'utf8')).user?.accessToken;
if (!token) throw new Error('Railway CLI login required.');
const evidencePath = join(root, '.railway/probe-evidence', `grading-${Date.now()}.jsonl`);
const record = data => saveEvidence(evidencePath, data, [token]);
record({ event: 'attempt-start', runscMode });
console.log(`localEvidence=${evidencePath}`);
const projectId = '92f470f3-76bd-4575-9f68-c2ef0e39f84b';
const environmentId = '2b532e83-ac59-4a98-a887-84114f581094';
const config = { token, authType: 'bearer', environmentId,
  fetch: (url, options) => {
    const body = typeof options?.body === 'string' ? JSON.parse(options.body) : {};
    const timeout = body.query?.includes('sandboxExec') ? Math.min(255_000, (body.variables?.timeoutSec ?? 120) * 1000 + 15_000) : 30_000;
    return fetch(url, { ...options, signal: AbortSignal.timeout(timeout) });
  } };
const files = [
  'server/execution/Dockerfile', 'server/execution/package.json', 'server/execution/package-lock.json',
  'server/execution/tsconfig.json', 'server/execution/src/index.ts', 'server/execution/src/program.ts',
  'server/python-execution/Dockerfile', 'server/python-execution/runner.py',
  'docker/ide/seccomp.chromium.json', 'docker/ide/execution-proof.mjs', 'docker/ide/python-execution-proof.mjs',
];
let sandbox;
let cleanupConfirmed = false;
let allPassed = true;
let expired = false;
const started = Date.now();
const watchdog = setTimeout(() => {
  expired = true; allPassed = false;
  console.log('wallDeadlineExceeded=true');
  if (sandbox) void sandbox.destroy().catch(() => {});
}, 600_000);
const deadline = () => { if (expired || Date.now() - started > 600_000) throw new Error('BUDGET_TIME_BOUND'); };
async function command(name, script, timeoutSec, showPassLines = false) {
  deadline();
  record({ event: 'command-start', name, timeoutSec });
  const result = await sandbox.exec(script, { timeoutSec, maxOutputBytes: 16_000 });
  record({ event: 'command-result', name, ...result });
  const pass = result.exitCode === 0 && !result.timedOut;
  allPassed &&= pass;
  console.log(JSON.stringify({ probe: name, pass, exitCode: result.exitCode, timedOut: result.timedOut }));
  if (showPassLines) for (const line of (result.stdout ?? '').split('\n')) {
    if (/^PASS [\w ,.+()/-]+$/.test(line) || /^(execution proof:|Python execution checks=)/.test(line)) console.log(line);
  }
  if (!pass) {
    // This sandbox receives allowlisted source and synthetic tests only. Avoid
    // raw provider errors; classify only known build/sandbox diagnostics.
    const diagnostics = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
    for (const marker of ['SANDBOX_DISABLED', 'Operation not permitted', 'No usable sandbox', 'GRADING_EXECUTION_FAILED', 'Execution image failed', 'ENOMEM', 'Killed', 'ENOSPC']) {
      if (diagnostics.includes(marker)) console.log(`diagnostic=${marker}`);
    }
  }
  return pass;
}
try {
  const response = await config.fetch('https://backboard.railway.com/graphql/v2', {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: 'query($id:String!){project(id:$id){name environments{edges{node{id name}}}}}', variables: { id: projectId } }),
  });
  const project = (await response.json()).data?.project;
  if (project?.name !== 'sweet-embrace' || !project.environments.edges.some(({node}) => node.id === environmentId && node.name === 'testing')) throw new Error('SCOPE_REFUSED');
  if ((await Sandbox.list(config)).some(item => ['CREATING', 'RUNNING', 'DESTROYING'].includes(item.status))) throw new Error('LIVE_SANDBOX_REFUSED');
  console.log('scope=testing cpu=2 memoryGB=2 idleTimeoutMinutes=1 wallDeadlineSeconds=600');
  sandbox = await Sandbox.create({ ...config, resources: { cpu: 2, memoryGB: 2 }, idleTimeoutMinutes: 1, networkIsolation: 'ISOLATED' });
  record({ event: 'sandbox-created', id: sandbox.id });
  console.log(`ownedSandbox=${sandbox.id}`);
  if (runscMode) {
    // Installation and Docker reload affect ONLY this newly owned disposable VM.
    // Full upstream archive includes runsc's required sidecar binaries.
    const installed = await command('install-verified-runsc', `set -e
      docker info --format 'DockerServer={{.ServerVersion}} Kernel={{.KernelVersion}}'
      if ! pgrep -xo dockerd > /tmp/fayq-dockerd.pid; then
        echo DOCKER_DAEMON_NOT_LOCAL
        docker context inspect --format '{{json .Endpoints.docker.Host}}'
        ps -eo comm | sort -u
        exit 1
      fi
      mkdir -p /tmp/fayq-runsc-install
      cd /tmp/fayq-runsc-install
      root() { if test "$(id -u)" = 0; then "$@"; else sudo -n "$@"; fi; }
      base=https://storage.googleapis.com/gvisor/releases/release/latest/$(uname -m)
      curl -fSL --max-time 40 "$base/gvisor.tar.bz2" -o gvisor.tar.bz2
      curl -fSL --max-time 10 "$base/gvisor.tar.bz2.sha512" -o gvisor.tar.bz2.sha512
      sha512sum -c gvisor.tar.bz2.sha512
      root tar -xjf gvisor.tar.bz2 -C /usr/local/bin
      root mkdir -p /tmp/fayq-runsc-debug
      root /usr/local/bin/runsc install -- --debug --debug-log=/tmp/fayq-runsc-debug/ --panic-log=/tmp/fayq-runsc-panic.log
      root kill -HUP "$(cat /tmp/fayq-dockerd.pid)"
      sleep 2
      /usr/local/bin/runsc --version
      docker info --format '{{json .Runtimes}}' | node -e 'const r=JSON.parse(require("fs").readFileSync(0,"utf8")); console.log(JSON.stringify({runscPresent:!!r.runsc,path:r.runsc?.path})); if(!r.runsc)process.exit(1)'`, 90);
    if (!installed) throw new Error('RUNSC_INSTALL_FAILED');
    const smoke = await command('runsc-runtime-smoke', 'docker run --rm --runtime runsc --network none --read-only --cap-drop ALL --security-opt no-new-privileges --memory 768m --cpus 1 --pids-limit 256 hello-world', 45);
    if (!smoke) throw new Error('RUNSC_STARTUP_FAILED');
  }
  for (const path of files) {
    deadline();
    const content = readFileSync(join(root, path));
    const upload = runscMode && path === 'docker/ide/execution-proof.mjs'
      ? Buffer.from(content.toString().replace("'--network', 'none'", "'--runtime', 'runsc', '--network', 'none'")) : content;
    await sandbox.files.write(`${remote}/${path}`, upload);
    await sandbox.heartbeat();
    console.log(`uploaded=${path} sha256=${createHash('sha256').update(upload).digest('hex')}`);
  }
  // Trusted orchestration module is compiled from current TypeScript. Only
  // individual code/input pairs reach Python jobs; tests remain outside them.
  for (const name of ['python', 'launcher']) {
    const source = readFileSync(join(root, `server/src/modules/assessments/${name}.ts`), 'utf8');
    const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
    await sandbox.files.write(`${remote}/controller/${name}.js`, js);
    await sandbox.heartbeat();
  }
  await sandbox.files.write(`${remote}/controller/package.json`, '{"type":"module"}');
  const pythonProof = readFileSync(join(root, 'docker/ide/python-execution-proof.mjs'), 'utf8').replace('/srv/server/dist/modules/assessments/python.js', `${remote}/controller/python.js`);
  await sandbox.files.write(`${remote}/docker/ide/python-execution-proof.mjs`, pythonProof);
  const jsBuilt = await command('build-javascript-image', `cd ${remote} && docker build -t fayq-assessment-execution:0.9.0 -f server/execution/Dockerfile . > /tmp/js-build.log 2>&1`, 240);
  const pyBuilt = await command('build-python-image', `cd ${remote} && docker build -t fayq-python-execution:0.10.0 -f server/python-execution/Dockerfile . > /tmp/py-build.log 2>&1`, 90);
  if (jsBuilt) await command('actual-browser-grading-proof', `cd ${remote} && node docker/ide/execution-proof.mjs`, 120, true);
  if (pyBuilt) await command('actual-python-grading-proof', `cd ${remote} && ${runscMode ? 'NODE_ENV=production GRADING_RUNTIME=runsc ' : ''}node docker/ide/python-execution-proof.mjs`, 60, true);
  if (runscMode && jsBuilt) await command('production-launcher-runsc', `cd ${remote} && GRADING_SECCOMP_FILE=${remote}/docker/ide/seccomp.chromium.json GRADING_RUNTIME=runsc NODE_ENV=production node --input-type=module -e 'const {executeIsolated}=await import("./controller/launcher.js"); const result=await executeIsolated({questions:[{id:"q",type:"CODING",checks:[{type:"console",expected:"2"}]}],answers:[{questionId:"q",source:{html:"",css:"",javascript:"console.log(2)"}}]});if(!result.correct)process.exit(1);console.log("PASS production launcher with runsc")'`, 45, true);
  await command('production-guards-preserved', `cd ${remote} && GRADING_SECCOMP_FILE=${remote}/docker/ide/seccomp.chromium.json NODE_ENV=production node --input-type=module -e 'const {runPython}=await import("./controller/python.js"); const {executeIsolated}=await import("./controller/launcher.js"); for(const run of [()=>runPython("print(2)",""),()=>executeIsolated({questions:[],answers:[]})]){let rejected=false;try{await run()}catch(e){rejected=e.message==="GRADING_ISOLATION_UNQUALIFIED"}if(!rejected)process.exit(1)}console.log("PASS production guards preserved")'`, 15, true);
  await command('execution-containers-cleaned', `test -z "$(docker ps -aq --filter label=fayq.owner=m9-execution-proof)" && test -z "$(docker ps -aq --filter label=fayq.owner=m9-grading)"`, 15);
} catch (error) {
  allPassed = false;
  record({ event: 'provider-failure', type: error?.constructor?.name, message: error?.message,
    status: error?.status, errors: error?.errors?.map(item => ({ message: item.message, code: item.extensions?.code })) });
  console.log(`probeFailed type=${error?.constructor?.name ?? 'Error'}`);
  // Only provider's scalar error messages; redact the exact in-memory token.
  for (const item of error?.errors ?? []) console.log(`providerError=${redact(item.message, [token]).slice(0, 300)}`);
} finally {
  // Save build diagnostics BEFORE destruction. Collection failure never blocks
  // cleanup; the wall deadline remains armed during this best-effort step.
  if (sandbox && !expired) {
    try {
      const logs = await sandbox.exec('if test -f /tmp/fayq-runsc-panic.log; then printf "PANIC HEADER\\n"; head -n 40 /tmp/fayq-runsc-panic.log; fi; for f in /tmp/fayq-runsc-debug/*.boot* /tmp/fayq-runsc-debug/*.create* /tmp/js-build.log /tmp/py-build.log; do if test -f "$f"; then printf "\\nLOG %s\\n" "$f"; tail -n 35 "$f"; fi; done',
        { timeoutSec: 5, maxOutputBytes: 16_000, signal: AbortSignal.timeout(12_000) });
      record({ event: 'build-log-tail', ...logs });
    } catch (error) { record({ event: 'diagnostics-unavailable', type: error?.constructor?.name }); }
  }
  if (sandbox) for (let attempt = 0; attempt < 3 && !cleanupConfirmed; attempt++) {
    try {
      await sandbox.destroy();
      await new Promise(resolve => setTimeout(resolve, 1500));
      cleanupConfirmed = !(await Sandbox.list(config)).some(item => item.id === sandbox.id && item.status !== 'DESTROYED');
    } catch (error) { record({ event: 'cleanup-retry', attempt: attempt + 1, type: error?.constructor?.name }); console.log(`cleanupRetry=${attempt + 1}`); }
  }
  clearTimeout(watchdog);
  record({ event: 'final', allPassed, cleanupConfirmed, elapsedSeconds: Math.ceil((Date.now()-started)/1000) });
  console.log(`gradingProbePass=${allPassed} cleanupConfirmed=${cleanupConfirmed} elapsedSeconds=${Math.ceil((Date.now()-started)/1000)}`);
  process.exitCode = allPassed && cleanupConfirmed ? 0 : 1;
}
