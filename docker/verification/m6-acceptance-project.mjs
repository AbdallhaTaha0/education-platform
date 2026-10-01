/** Host orchestration only. Application code, Chromium and probes run in Docker. */
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const project = 'm6-acceptance', stamp = `2026-10-01-m6-05-${Date.now()}`;
const evidence = path.join(root, 'docker/browser/evidence/m6-05', stamp);
fs.mkdirSync(evidence, { recursive: true });
const env = { ...process.env, M6_EVIDENCE_ROOT: evidence };
const files = ['docker/verification/compose.m6-delivery-browser.yml', 'docker/verification/compose.m6-acceptance.yml'];
const args = ['compose', '-p', project, ...files.flatMap(f => ['-f', f])];
const listenerArgs = [...args, '-f', 'docker/verification/compose.m6-acceptance-listener.yml'];
const expectedImages = {
  // Independent review rebuilt the same checkout on 2026-10-01. BuildKit
  // regenerated image attestations/index IDs; retain exact identity guards.
  server: 'sha256:6eb02c11ffd7b3cb24a7577c747170889d6187e698b220a9c15e8624f6d3be16',
  client: 'sha256:f2b015d273f946bb7d6a6893792f39578f688c06ec4a0432cba06813e0d006c1',
};
const checks = [];
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
function check(label, value) { if (!value) throw new Error(label); checks.push({ label, passed: true }); console.log(`PASS ${label}`); }
function docker(command, quiet = false) {
  return new Promise((resolve, reject) => {
    const child = spawn('docker', command, { cwd: root, env, windowsHide: true, shell: false });
    let stdout = '', stderr = '';
    child.stdout.on('data', data => { stdout += data; if (!quiet) process.stdout.write(data); });
    child.stderr.on('data', data => { stderr += data; if (!quiet) process.stderr.write(data); });
    child.on('error', reject); child.on('exit', code => code === 0 ? resolve(stdout.trim()) : reject(new Error(`Docker operation failed (${code}): ${command.slice(0, 2).join(' ')}`)));
  });
}
async function owned(name) {
  const object = JSON.parse(await docker(['inspect', name], true))[0];
  check(`owned test container ${name}`, object.Config.Labels?.['com.docker.compose.project'] === project);
  return object;
}
async function waitFile(name, ms = 60000) {
  const deadline = Date.now() + ms;
  while (!fs.existsSync(path.join(evidence, name))) {
    if (fs.readdirSync(evidence).some(f => f.endsWith('-browser-failed'))) throw new Error('A browser runner failed before its checkpoint');
    if (Date.now() > deadline) throw new Error(`Timed out waiting for ${name}`);
    await pause(250);
  }
}
function marker(name) { fs.writeFileSync(path.join(evidence, name), 'ready'); }
async function browser(phase, extra = {}) {
  const a = await owned('m6-acceptance-server-1'), b = await owned('m6-acceptance-server-b-1');
  const ip = object => object.NetworkSettings.Networks[`${project}_default`].IPAddress;
  const name = `m6-acceptance-browser-${phase}`;
  return docker(['run', '--rm', '--name', name, '--label', `com.docker.compose.project=${project}`, '--network', `${project}_default`, '--shm-size=512m',
    '-e', `M6_PHASE=${phase}`, '-e', `M6_A_IP=${ip(a)}`, '-e', `M6_B_IP=${ip(b)}`,
    ...Object.entries(extra).flatMap(([key, value]) => ['-e', `${key}=${value}`]),
    '-v', `${path.join(root, 'docker/browser/m6-acceptance.mjs')}:/srv/browser/m6-acceptance.mjs:ro`,
    '-v', `${path.join(evidence, 'private.json')}:/fixtures/private.json:ro`, '-v', `${evidence}:/evidence`,
    '--entrypoint', 'node', 'edu-platform-browser:0.6.0-m6-inbox', '/srv/browser/m6-acceptance.mjs']).catch(error => {
      fs.writeFileSync(path.join(evidence, `${phase}-browser-failed`), 'failed'); throw error;
    });
}
async function probe(command, phase) { return docker([...args, 'run', '--rm', '--no-deps', 'server', 'node', '/verification/probe.cjs', command, ...(phase ? [phase] : [])]); }
const crashedNames = [];
let started = false, fixtures = false;
try {
  console.log(`M6 acceptance evidence: ${path.relative(root, evidence)}`);
  const config = JSON.parse(await docker([...args, 'config', '--format', 'json'], true));
  check('resolved project is isolated and publishes no host ports', config.name === project && Object.values(config.services).every(s => !s.ports?.length));
  check('resolved PostgreSQL volume is disposable', Object.values(config.volumes).every(v => v.name === `${project}_pgdata`));
  const existing = await docker(['ps', '-a', '--filter', `label=com.docker.compose.project=${project}`, '--format', '{{.ID}}'], true);
  check('no pre-existing acceptance containers will be reused', existing === '');
  const volumes = (await docker(['volume', 'ls', '--format', '{{.Name}}'], true)).split('\n');
  check('no pre-existing acceptance PostgreSQL volume will be reused', !volumes.includes(`${project}_pgdata`));
  started = true; await docker([...args, 'up', '-d', '--wait']);
  const a = await owned('m6-acceptance-server-1'), b = await owned('m6-acceptance-server-b-1'), client = await owned('m6-acceptance-client-1');
  check('separate replicas run the final identical immutable image', a.Id !== b.Id && a.Image === expectedImages.server && b.Image === expectedImages.server);
  check('client is the verified package-04 image', client.Image === expectedImages.client);
  await docker(['exec', 'm6-acceptance-nginx-1', 'nginx', '-t']);
  await docker(['cp', 'docker/verification/m6-inbox-ui-fixtures.cjs', 'm6-acceptance-server-1:/tmp/m6-inbox-ui-fixtures.cjs']);
  fixtures = true; await docker(['exec', 'm6-acceptance-server-1', 'node', '/tmp/m6-inbox-ui-fixtures.cjs', 'seed-realtime']);
  await docker(['cp', 'm6-acceptance-server-1:/tmp/m6-inbox-ui-fixtures.json', path.join(evidence, 'private.json')]);
  const replicaBrowser = browser('replicas');
  replicaBrowser.catch(() => {});
  await waitFile('kill-a-ready'); await owned('m6-acceptance-server-1'); await docker(['kill', '--signal=KILL', 'm6-acceptance-server-1']); marker('kill-a-done');
  await waitFile('kill-a-recovered'); await docker([...args, 'up', '-d', '--no-deps', '--wait', 'server']); marker('restart-a-done'); await replicaBrowser;
  const startA = (await owned('m6-acceptance-server-1')).State.StartedAt, startB = (await owned('m6-acceptance-server-b-1')).State.StartedAt;
  const databaseBrowser = browser('database'); databaseBrowser.catch(() => {}); await waitFile('database-ready'); await owned('m6-acceptance-postgres-1');
  await docker(['stop', 'm6-acceptance-postgres-1']); marker('database-stopped'); await waitFile('database-observed');
  await docker(['start', 'm6-acceptance-postgres-1']); marker('database-started'); await databaseBrowser;
  check('both backend processes survive database outage without restart', (await owned('m6-acceptance-server-1')).State.StartedAt === startA && (await owned('m6-acceptance-server-b-1')).State.StartedAt === startB);
  for (const phase of ['source', 'claim', 'recipient', 'fanout', 'signal']) {
    console.log(`Starting deterministic crash boundary: ${phase}`);
    await docker([...args, 'stop', 'server', 'server-b']);
    let signalBrowser;
    if (phase === 'signal') {
      await docker([...listenerArgs, 'up', '-d', '--no-deps', '--wait', '--force-recreate', 'server', 'server-b']);
      // Nginx resolves names at startup: reload after the listener replacement.
      await docker(['exec', 'm6-acceptance-nginx-1', 'nginx', '-s', 'reload']);
      const data = JSON.parse(fs.readFileSync(path.join(evidence, 'final-data.json'), 'utf8'));
      signalBrowser = browser('signal', { M6_EXPECTED_NOTICES: String(data.noticesByA + 1) });
      signalBrowser.catch(() => {});
      await waitFile('signal-listener-ready');
    }
    const name = `m6-acceptance-crash-${phase}`; crashedNames.push(name);
    await docker([...args, 'run', '-d', '--no-deps', '--name', name, 'server', 'node', '/verification/probe.cjs', 'crash', phase]);
    await waitFile(`${phase}-checkpoint.json`, 20000);
    if (phase === 'signal') { marker('signal-published'); await waitFile('signal-browser-observed'); await signalBrowser; }
    await probe('inspect', phase); await owned(name); await docker(['kill', '--signal=KILL', name]); await docker(['rm', name]);
    await docker([...args, 'up', '-d', '--no-deps', '--wait', '--force-recreate', 'server', 'server-b']);
    await docker(['exec', 'm6-acceptance-nginx-1', 'nginx', '-s', 'reload']);
    await probe('recovered', phase); await probe('summary');
  }
  await probe('expiry'); await pause(2500); await probe('retention');
  const filesWithChecks = fs.readdirSync(evidence).filter(name => /(?:-browser|-before|-recovered|retention)\.json$/.test(name));
  let total = 0;
  for (const name of filesWithChecks) {
    const data = JSON.parse(fs.readFileSync(path.join(evidence, name), 'utf8'));
    check(`recorded assertions pass: ${name}`, data.checks.length > 0 && data.checks.every(c => c.passed) && !data.skipped); total += data.checks.length;
  }
  console.log(`Acceptance assertions: ${total}; orchestration guards: ${checks.length}; failed=0; skipped=0.`);
  fs.writeFileSync(path.join(evidence, 'orchestration.json'), JSON.stringify({ checks, assertionCount: total, skipped: 0 }, null, 2));
} catch (error) {
  console.error(error.message); process.exitCode = 1;
  fs.writeFileSync(path.join(evidence, 'orchestration.json'), JSON.stringify({ checks, failure: error.message, skipped: 0 }, null, 2));
} finally {
  for (const name of ['m6-acceptance-browser-replicas', 'm6-acceptance-browser-database', 'm6-acceptance-browser-signal', ...crashedNames]) {
    const present = await docker(['ps', '-a', '--filter', `name=^/${name}$`, '--format', '{{.ID}}'], true);
    if (present) { await owned(name); await docker(['rm', '-f', name]); }
  }
  if (started) {
    if (fixtures && fs.existsSync(path.join(evidence, 'private.json'))) {
      await docker([...args, 'up', '-d', '--no-deps', '--wait', 'server']);
      await docker(['cp', 'docker/verification/m6-inbox-ui-fixtures.cjs', 'm6-acceptance-server-1:/tmp/m6-inbox-ui-fixtures.cjs']);
      await docker(['cp', path.join(evidence, 'private.json'), 'm6-acceptance-server-1:/tmp/m6-inbox-ui-fixtures.json']);
      await docker(['exec', '-u', '0', 'm6-acceptance-server-1', 'chown', 'app:app', '/tmp/m6-inbox-ui-fixtures.json']);
      await docker(['exec', 'm6-acceptance-server-1', 'node', '/tmp/m6-inbox-ui-fixtures.cjs', 'cleanup']);
    }
    const pg = await owned('m6-acceptance-postgres-1'), redis = await owned('m6-acceptance-redis-1');
    const disposableVolumes = [...pg.Mounts, ...redis.Mounts].filter(m => m.Type === 'volume').map(m => m.Name);
    check('cleanup volume ownership stays inside disposable project', disposableVolumes.includes(`${project}_pgdata`) && !disposableVolumes.some(v => v.startsWith('education-platform')));
    await docker([...args, 'down', '-v']);
    const remaining = (await docker(['volume', 'ls', '--format', '{{.Name}}'], true)).split('\n');
    check('all inspected acceptance volumes removed', disposableVolumes.every(v => !remaining.includes(v)));
  }
  for (const name of fs.readdirSync(evidence).filter(name => name === 'private.json' || /-(?:source|checkpoint)\.json$/.test(name) || name === 'final-data.json')) fs.unlinkSync(path.join(evidence, name));
  fs.writeFileSync(path.join(evidence, 'cleanup.json'), JSON.stringify({ checks: checks.filter(c => c.label.includes('cleanup') || c.label.includes('volumes removed')), privateReceiptRemoved: !fs.existsSync(path.join(evidence, 'private.json')) }, null, 2));
  console.log('Disposable acceptance environment cleaned; private receipts removed.');
}
