/** Docker-only application verification. This host script only orchestrates
 * isolated resources and saves evidence. Always cleans its own project. */
import { spawnSync } from 'node:child_process';
import { mkdirSync, openSync, closeSync } from 'node:fs';
import { resolve, join } from 'node:path';
const root = resolve(import.meta.dirname, '../..');
const docker = process.env.DOCKER_EXE || 'docker';
const project = 'fayq-m9-test';
const prefix = ['compose', '-p', project, '-f', 'docker/compose.test.yml', '-f', 'docker/ide/compose.test.yml'];
const evidence = join(root, 'docker/browser/evidence/m9'); mkdirSync(evidence, { recursive: true });
function capture(args) {
  const r = spawnSync(docker, args, { cwd: root, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
  if (r.status !== 0) throw new Error('Docker inspection failed.'); return r.stdout;
}
function guard() {
  const c = JSON.parse(capture([...prefix, 'config', '--format', 'json']));
  if (c.name !== project || Object.keys(c.volumes ?? {}).length !== 1 || c.volumes['pgdata-test']?.name !== `${project}_pgdata-test` || c.volumes['pgdata-test'].external) throw new Error('Volume guard refused.');
  for (const s of Object.values(c.services)) {
    if (s.ports?.length) throw new Error('Port guard refused.');
    for (const m of s.volumes ?? []) if (m.type !== 'volume' || m.source !== 'pgdata-test') throw new Error('Mount guard refused.');
  }
  if (c.services.test.environment.NODE_ENV !== 'test' || !c.services.test.environment.DATABASE_URL.endsWith('/education_platform_test') || c.services.test.image !== 'fayq-m9-server-test:0.9.0') throw new Error('Test guard refused.');
}
function run(label, args) {
  const fd = openSync(join(evidence, `${label}.log`), 'w', 0o600);
  let r; try { r = spawnSync(docker, [...prefix, ...args], { cwd: root, stdio: ['ignore', fd, fd] }); } finally { closeSync(fd); }
  console.log(`${label} exit=${r.status ?? 1}`); if (r.status !== 0) throw new Error(`${label} failed; inspect saved evidence.`);
}
let code = 0; guard();
try {
  if (process.argv.includes('--build')) run('build', ['build', 'test', 'client-test']);
  run('start', ['up', '-d', '--wait', 'migrate', 'redis']);
  run('server-types', ['run', '--rm', '--no-deps', 'test', 'npm', 'run', 'typecheck']);
  if (process.argv.includes('--support')) {
    run('support-tests', ['run', '--rm', '--no-deps', 'test', 'npx', 'vitest', 'run', 'tests/integration/support-contact.test.ts', 'tests/integration/ux-profile.test.ts']);
    run('client-types', ['run', '--rm', '--no-deps', 'client-test', 'npm', 'run', 'typecheck']);
  } else if (process.argv.includes('--focused')) {
    run('m9-focused-tests', ['run', '--rm', '--no-deps', 'test', 'npx', 'vitest', 'run', 'tests/unit/m9-contracts.test.ts', 'tests/integration/m9-assessments.test.ts']);
  } else {
    run('server-tests', ['run', '--rm', '--no-deps', 'test', 'npm', 'run', 'test:ci']);
    run('client-types', ['run', '--rm', '--no-deps', 'client-test', 'npm', 'run', 'typecheck']);
    run('client-tests', ['run', '--rm', '--no-deps', 'client-test', 'npm', 'test']);
  }
} catch (error) { code = 1; console.error(error.message); }
finally {
  try {
    guard();
    const ids = capture([...prefix, 'ps', '-aq']).trim().split(/\s+/).filter(Boolean);
    for (const id of ids) {
      const [c] = JSON.parse(capture(['inspect', id]));
      if (c.Config.Labels?.['com.docker.compose.project'] !== project) throw new Error('Cleanup ownership refused.');
      for (const m of c.Mounts) {
        if (m.Type !== 'volume') throw new Error('Cleanup mount refused.');
        if (m.Name === `${project}_pgdata-test`) continue;
        // redis:7 declares /data as an anonymous image volume. Permit only
        // that exact mount after proving every attached container is ours.
        if (c.Config.Labels?.['com.docker.compose.service'] !== 'redis' || m.Destination !== '/data' || !/^[a-f0-9]{64}$/.test(m.Name)) throw new Error('Cleanup volume refused.');
        const owners = capture(['ps', '-aq', '--filter', `volume=${m.Name}`]).trim().split(/\s+/).filter(Boolean);
        for (const owner of owners) {
          const [attached] = JSON.parse(capture(['inspect', owner]));
          if (attached.Config.Labels?.['com.docker.compose.project'] !== project) throw new Error('Shared volume cleanup refused.');
        }
      }
    }
    run('cleanup', ['down', '-v']);
    for (const kind of ['container', 'network', 'volume']) {
      const args = kind === 'container' ? ['ps', '-aq'] : [kind, 'ls', '-q'];
      if (capture([...args, '--filter', `label=com.docker.compose.project=${project}`]).trim()) throw new Error(`Owned ${kind} remains.`);
    }
    console.log('cleanup containers=0 networks=0 volumes=0');
  } catch (error) { code = 1; console.error(error.message); }
}
process.exitCode = code;
