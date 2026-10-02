/** Reproducible UI/queue proof; never reads owner .env or touches DRM. */
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync, openSync, closeSync, rmSync } from 'node:fs';
import { resolve, join } from 'node:path';
const root = resolve(import.meta.dirname, '../..'); const docker = process.env.DOCKER_EXE || 'docker';
const project = 'fayq-m9-ui'; const compose = ['compose', '-p', project, '-f', 'docker/ide/compose.ui.yml'];
const evidence = join(root, 'docker/browser/evidence/m9'); mkdirSync(evidence, { recursive: true });
function capture(args, input) {
  const r = spawnSync(docker, args, { cwd: root, input, encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 });
  if (r.status !== 0) { if(input) writeFileSync(join(evidence,'ui-fixture-failure.log'),r.stderr ?? '',{mode:0o600}); throw new Error('Docker inspection/fixture failed; synthetic fixture diagnostics saved privately.'); } return r.stdout;
}
function guard() {
  const c = JSON.parse(capture([...compose, 'config', '--format', 'json']));
  const names = [`${project}_pg-ui`, `${project}_redis-ui`];
  if (c.name !== project || Object.keys(c.volumes ?? {}).length !== 2 || Object.values(c.volumes).some((v) => v.external || !names.includes(v.name))) throw new Error('UI volume guard refused.');
  for (const [name, s] of Object.entries(c.services)) {
    if (s.ports?.length && (name !== 'nginx' || s.ports.length !== 1 || s.ports[0].published !== '8084' || s.ports[0].host_ip !== '127.0.0.1')) throw new Error('UI port guard refused.');
    for (const m of s.volumes ?? []) {
      if (name === 'grading' && m.type === 'bind' && m.source === '/var/run/docker.sock' && m.target === '/var/run/docker.sock') continue;
      if (m.type !== 'volume' || !names.includes(c.volumes[m.source]?.name)) throw new Error('UI mount guard refused.');
    }
  }
  if (c.services.server.environment.NODE_ENV !== 'test' || !c.services.server.environment.DATABASE_URL.endsWith('/education_platform_test')) throw new Error('UI database guard refused.');
}
function run(label, args) {
  const fd = openSync(join(evidence, `${label}.log`), 'w', 0o600); let r;
  try { r = spawnSync(docker, args, { cwd: root, stdio: ['ignore', fd, fd] }); } finally { closeSync(fd); }
  console.log(`${label} exit=${r.status ?? 1}`); if (r.status !== 0) throw new Error(`${label} failed; inspect saved evidence.`);
}
function browser(script, label) {
  run(label, ['run', '--rm', '--name', `${project}-${label}`, '--label', `com.docker.compose.project=${project}`, '--network', `${project}_default`, '--mount', `type=bind,source=${resolve(root, script)},target=/srv/browser/m9-test.mjs,readonly`, '--mount', `type=bind,source=${evidence},target=/evidence`, 'fayq-m9-browser:0.9.0', 'node', '/srv/browser/m9-test.mjs']);
}
let code = 0, fixtureWritten = false; guard();
try {
  run('ui-start', [...compose, 'up', '-d', '--wait']);
  // The direct Puppeteer flow is independently runnable when the optional
  // inspection CLI is unavailable; never report its skipped probe as passing.
  if (!process.argv.includes('--flow-only')) browser('docker/ide/cli-check.mjs', 'ui-cli');
  else console.log('Inspection CLI skipped explicitly; verifying direct browser/controller flow.');
  const fixture = capture([...compose, 'exec', '-T', 'server', 'node', '-e', "eval(require('fs').readFileSync(0,'utf8'))"], readFileSync(join(root, 'docker/ide/ui-fixtures.cjs'), 'utf8'));
  JSON.parse(fixture.trim()); writeFileSync(join(evidence, 'm9-fixtures.json'), fixture, { mode: 0o600 }); fixtureWritten = true;
  if (!process.argv.includes('--ux-only') && !process.argv.includes('--support-only') && !process.argv.includes('--navigation-only') && !process.argv.includes('--auth-only')) browser('docker/ide/ui-flow.mjs', 'ui-flow');
  if (process.argv.includes('--auth-only')) browser('docker/ide/auth-navigation-flow.mjs', 'auth-navigation-flow');
  // Navigation uses the initial fixture credentials; UX checks intentionally
  // change a fixture password. Run read-only navigation before that mutation.
  if (process.argv.includes('--navigation-only') || process.argv.includes('--navigation')) browser('docker/ide/navigation-flow.mjs','navigation-flow');
  if (process.argv.includes('--ux')) browser('docker/ide/ux-flow.mjs','ux-flow');
  if (process.argv.includes('--support-only')) browser('docker/ide/support-flow.mjs','support-flow');
} catch (error) { code = 1; console.error(error.message); }
finally {
  if (fixtureWritten) rmSync(join(evidence, 'm9-fixtures.json'), { force: true });
  try {
    guard();
    const ids = capture([...compose, 'ps', '-aq']).trim().split(/\s+/).filter(Boolean);
    for (const id of ids) {
      const [c] = JSON.parse(capture(['inspect', id]));
      if (c.Config.Labels?.['com.docker.compose.project'] !== project) throw new Error('Cleanup project refused.');
      for (const m of c.Mounts) {
        if (c.Config.Labels['com.docker.compose.service'] === 'grading' && m.Type === 'bind' && m.Source === '/var/run/docker.sock' && m.Destination === '/var/run/docker.sock') continue;
        if (m.Type !== 'volume' || ![`${project}_pg-ui`, `${project}_redis-ui`].includes(m.Name)) throw new Error('Cleanup mount refused.');
      }
    }
    run('ui-cleanup', [...compose, 'down', '-v']);
    for (const kind of ['container', 'network', 'volume']) {
      if (capture([...(kind === 'container' ? ['ps', '-aq'] : [kind, 'ls', '-q']), '--filter', `label=com.docker.compose.project=${project}`]).trim()) throw new Error(`Owned ${kind} remains.`);
    }
    console.log('UI cleanup containers=0 networks=0 volumes=0');
  } catch (error) { code = 1; console.error(error.message); }
}
process.exitCode = code;
