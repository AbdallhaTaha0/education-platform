/** Disposable course-learning UI runner (agent 2 only). Verifies project labels
 * and every resolved mount before removal; deletes only owned resources.
 * Preserves the retained preview, DRM/data, unrelated projects, reusable
 * images and retained screenshots/test evidence. Never uses global prune. */
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync, openSync, closeSync, rmSync } from 'node:fs';
import { resolve, join } from 'node:path';

const root = resolve(import.meta.dirname, '../..');
const docker = process.env.DOCKER_EXE || 'docker';
const project = 'fayq-course-learning-ui-20261004';
const compose = ['compose', '-p', project, '-f', 'docker/course-learning-ui/compose.ui.yml'];
const evidence = join(root, 'docker/browser/evidence/course-learning-ui');
mkdirSync(evidence, { recursive: true });

function capture(args, input) {
  const r = spawnSync(docker, args, { cwd: root, input, encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 });
  if (r.status !== 0) {
    if (input) writeFileSync(join(evidence, 'ui-fixture-failure.log'), r.stderr ?? '', { mode: 0o600 });
    throw new Error('Docker inspection/fixture failed; synthetic fixture diagnostics saved privately.');
  }
  return r.stdout;
}

function guard() {
  const c = JSON.parse(capture([...compose, 'config', '--format', 'json']));
  const names = [`${project}_pg-course-learning-ui`, `${project}_redis-course-learning-ui`];
  if (c.name !== project || Object.keys(c.volumes ?? {}).length !== 2 || Object.values(c.volumes).some((v) => v.external || !names.includes(v.name))) {
    throw new Error('UI volume guard refused.');
  }
  for (const [name, s] of Object.entries(c.services)) {
    if (s.ports?.length && (name !== 'nginx' || s.ports.length !== 1 || s.ports[0].published !== '8091' || s.ports[0].host_ip !== '127.0.0.1')) {
      throw new Error('UI port guard refused.');
    }
    for (const m of s.volumes ?? []) {
      if (name === 'grading' && m.type === 'bind' && m.source === '/var/run/docker.sock' && m.target === '/var/run/docker.sock') continue;
      if (m.type !== 'volume' || !names.includes(c.volumes[m.source]?.name)) throw new Error('UI mount guard refused.');
    }
  }
  if (c.services.server.environment.NODE_ENV !== 'test' || !c.services.server.environment.DATABASE_URL.endsWith('/education_platform_test')) {
    throw new Error('UI database guard refused.');
  }
}

function run(label, args, env) {
  const fd = openSync(join(evidence, `${label}.log`), 'w', 0o600);
  let r;
  try {
    r = spawnSync(docker, args, { cwd: root, stdio: ['ignore', fd, fd], env: { ...process.env, ...(env ?? {}) } });
  } finally {
    closeSync(fd);
  }
  console.log(`${label} exit=${r.status ?? 1}`);
  if (r.status !== 0) throw new Error(`${label} failed; inspect saved evidence.`);
}

function browser(script, label) {
  run(label, ['run', '--rm', '--name', `${project}-${label}`, '--label', `com.docker.compose.project=${project}`, '--network', `${project}_default`, '--mount', `type=bind,source=${resolve(root, script)},target=/srv/browser/course-learning-ui-test.mjs,readonly`, '--mount', `type=bind,source=${evidence},target=/evidence`, 'fayq-m9-browser:0.9.0', 'node', '/srv/browser/course-learning-ui-test.mjs']);
}

let code = 0;
let fixtureWritten = false;
guard();
try {
  run('course-learning-ui-start', [...compose, 'up', '-d', '--wait'], { COURSE_LEARNING_UI_IMAGE: process.env.COURSE_LEARNING_UI_IMAGE ?? 'fayq-course-learning-ui-client:20261004' });
  const fixture = capture([...compose, 'exec', '-T', 'server', 'node', '-e', "eval(require('fs').readFileSync(0,'utf8'))"], readFileSync(join(root, 'docker/ide/ui-fixtures.cjs'), 'utf8'));
  JSON.parse(fixture.trim());
  writeFileSync(join(evidence, 'course-learning-ui-fixtures.json'), fixture, { mode: 0o600 });
  fixtureWritten = true;
  browser('docker/course-learning-ui/course-learning-ui-flow.mjs', 'course-learning-ui-flow');
} catch (error) {
  code = 1;
  console.error(error.message);
} finally {
  if (fixtureWritten) rmSync(join(evidence, 'course-learning-ui-fixtures.json'), { force: true });
  try {
    guard();
    const ids = capture([...compose, 'ps', '-aq']).trim().split(/\s+/).filter(Boolean);
    for (const id of ids) {
      const [c] = JSON.parse(capture(['inspect', id]));
      if (c.Config.Labels?.['com.docker.compose.project'] !== project) throw new Error('Cleanup project refused.');
      for (const m of c.Mounts) {
        if (c.Config.Labels['com.docker.compose.service'] === 'grading' && m.Type === 'bind' && m.Source === '/var/run/docker.sock' && m.Destination === '/var/run/docker.sock') continue;
        if (m.Type !== 'volume' || ![`${project}_pg-course-learning-ui`, `${project}_redis-course-learning-ui`].includes(m.Name)) {
          throw new Error('Cleanup mount refused.');
        }
      }
    }
    run('course-learning-ui-cleanup', [...compose, 'down', '-v']);
    for (const kind of ['container', 'network', 'volume']) {
      const listArgs = kind === 'container' ? ['ps', '-aq'] : [kind, 'ls', '-q'];
      if (capture([...listArgs, '--filter', `label=com.docker.compose.project=${project}`]).trim()) {
        throw new Error(`Owned ${kind} remains.`);
      }
    }
    console.log('UI cleanup containers=0 networks=0 volumes=0');
  } catch (error) {
    code = 1;
    console.error(error.message);
  }
}
process.exitCode = code;
