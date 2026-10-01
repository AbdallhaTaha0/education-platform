/** Disposable local regression only: no live R2 or development database. */
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
const root = resolve(import.meta.dirname, '../..');
const docker = process.env.DOCKER_EXE || 'docker';
const project = 'm5-drm-regression';
const args = [
  'compose',
  '-p',
  project,
  '-f',
  'education-drm-service/docker/docker-compose.deletion-test.yml',
  '-f',
  'docker/verification/compose.drm-regression.yml',
  '--profile',
  'verify',
];
const exec = (a, options = {}) => spawnSync(docker, a, { cwd: root, ...options });
const rendered = exec([...args, 'config', '--format', 'json'], { encoding: 'utf8' });
if (rendered.status !== 0) throw new Error('Regression config could not be resolved');
const config = JSON.parse(rendered.stdout);
const allowed = [`${project}_pgdata-test`, `${project}_seaweeddata-test`];
if (
  config.name !== project ||
  Object.values(config.volumes || {}).length !== 2 ||
  Object.values(config.volumes).some((v) => v.external || !allowed.includes(v.name))
)
  throw new Error('Regression volume guard refused');
for (const service of Object.values(config.services)) {
  if (service.ports?.length) throw new Error('Regression published-port guard refused');
  for (const mount of service.volumes || []) {
    if (mount.type !== 'volume' || !allowed.includes(config.volumes[mount.source]?.name))
      throw new Error('Regression mount guard refused');
  }
  if (
    service.environment?.S3_ENDPOINT &&
    service.environment.S3_ENDPOINT !== 'http://seaweedfs:8333'
  )
    throw new Error('Live storage guard refused');
  if (
    service.environment?.DATABASE_URL &&
    !service.environment.DATABASE_URL.endsWith('@postgres:5432/drmdeltest')
  )
    throw new Error('Database guard refused');
}
console.log(`guard project=${project} volumes=${allowed.join(',')}`);
const action = process.argv[2] || 'check';
let command;
if (action === 'check') process.exit(0);
if (action === 'build') command = ['build', 'test-runner'];
else if (action === 'up') command = ['up', '-d', '--wait', 'api', 'worker'];
else if (action === 'down') {
  const ids = exec([...args, 'ps', '-aq'], { encoding: 'utf8' });
  if (ids.status !== 0) throw new Error('Container guard failed');
  for (const id of ids.stdout.trim().split(/\s+/).filter(Boolean)) {
    const inspected = exec(
      ['inspect', '--format', '{{index .Config.Labels "com.docker.compose.project"}}', id],
      { encoding: 'utf8' },
    );
    if (inspected.status !== 0 || inspected.stdout.trim() !== project)
      throw new Error('Container ownership guard refused');
  }
  command = ['down', '-v'];
} else if (action === 'run') {
  const script = process.argv[3];
  if (
    ![
      'test',
      'test:deletion',
      'test:upload-recovery',
      'test:processing-lifecycle',
      'test:integration',
      'test:media',
      'test:e2e',
    ].includes(script)
  )
    throw new Error('Unknown regression suite');
  command = ['run', '--rm', '--no-deps', 'test-runner', 'pnpm', '--filter', '@drm/api', script];
} else throw new Error('Unknown regression action');
const result = exec([...args, ...command], { stdio: 'inherit' });
process.exitCode = Number.isInteger(result.status) ? result.status : 1;
