/** Persistent local preview, repository-root invocation:
 * node docker/local-preview.mjs check|build|up|stop|status
 * build uses --no-cache --pull; stop preserves all data. No destructive command.
 * docker/local-settings.env.local stores volume names only, never credentials.
 * Platform and external DRM credentials remain in their ignored .env files.
 */
import { readFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const docker = process.env.DOCKER_EXE || 'docker';
const settingsPath = 'docker/local-settings.env.local';
if (resolve(process.cwd()) !== root) throw new Error('Run from the repository root.');
for (const [cwd, path] of [[root, '.env'], [resolve(root, 'education-drm-service'), '.env'], [root, settingsPath]]) {
  if (!existsSync(resolve(cwd, path)) || spawnSync('git', ['check-ignore', '--quiet', path], {cwd}).status !== 0)
    throw new Error(`Required ignored local file missing or tracked: ${path}`);
}
const settings = Object.fromEntries(readFileSync(resolve(root, settingsPath), 'utf8').split(/\r?\n/)
  .filter(line => line && !line.startsWith('#') && line.includes('='))
  .map(line => { const i = line.indexOf('='); return [line.slice(0, i), line.slice(i + 1)]; }));
const keys = ['LOCAL_PGDATA_NAME', 'LOCAL_REDISDATA_NAME', 'LOCAL_DRM_PGDATA_NAME', 'LOCAL_DRM_REDISDATA_NAME'];
if (Object.keys(settings).length !== keys.length || keys.some(key => !/^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/.test(settings[key] || '')) ||
    new Set(Object.values(settings)).size !== keys.length) throw new Error('Local volume settings refused.');
const childEnv = { ...process.env, ...settings, COMPOSE_PROFILES: '' };
const platforms = {
  platform: {project: 'fayq-local-preview', files: ['docker/compose.dev.yml', 'docker/compose.local.yml'], env: '.env',
    volumes: [settings.LOCAL_PGDATA_NAME, settings.LOCAL_REDISDATA_NAME], services: ['postgres','redis','migrate','server','client','nginx'],
    images: {migrate:'fayq-platform-migrate:0.8.0-local',server:'fayq-platform-server:0.8.0-local',client:'fayq-platform-client:0.8.0-local',nginx:'fayq-platform-nginx:0.8.0-local'},
    ingress: 'nginx', port: 8080, containerPort: 8080},
  drm: {project: 'education-drm-service', files: ['education-drm-service/docker/docker-compose.yml', 'docker/compose.local-drm.yml'], env: 'education-drm-service/.env',
    volumes: [settings.LOCAL_DRM_PGDATA_NAME, settings.LOCAL_DRM_REDISDATA_NAME], services: ['postgres','valkey','migrate','api','worker'],
    images: {api:'fayq-drm-api:0.8.0-local',worker:'fayq-drm-worker:0.8.0-local',migrate:'fayq-drm-migrate:0.8.0-local'},
    ingress: 'api', port: 3000, containerPort: 3000},
};
function args(group) { return ['compose','--env-file',group.env,'--env-file',settingsPath,'-p',group.project,
  ...group.files.flatMap(path => ['-f',path])]; }
function capture(argv) {
  const r = spawnSync(docker, argv, {cwd:root,env:childEnv,encoding:'utf8',maxBuffer:8*1024*1024});
  if (r.status !== 0) throw new Error('Docker inspection/configuration failed; no environment output forwarded.');
  return r.stdout;
}
for (const group of Object.values(platforms)) {
  const config = JSON.parse(capture([...args(group),'config','--format','json']));
  if (config.name !== group.project || Object.values(config.volumes || {}).length !== group.volumes.length ||
    Object.values(config.volumes).some(v => v.external !== true || !group.volumes.includes(v.name))) throw new Error('Persistent volume guard refused.');
  for (const name of group.services) {
    const s = config.services[name];
    if (!s || (group.images[name] && s.image !== group.images[name])) throw new Error('Image/service guard refused.');
    for (const mount of s.volumes || []) {
      if (mount.type !== 'volume' || !group.volumes.includes(config.volumes[mount.source]?.name)) throw new Error('Mount guard refused.');
    }
    const ports = s.ports || [];
    if (name === group.ingress) {
      if (ports.length !== 1 || ports[0].host_ip !== '127.0.0.1' || Number(ports[0].published) !== group.port || ports[0].target !== group.containerPort)
        throw new Error('Local ingress guard refused.');
    } else if (ports.length) throw new Error('Unexpected published dependency port.');
  }
  for (const name of group.volumes) capture(['volume','inspect',name]);
  console.log(`guard project=${group.project} retainedVolumes=${group.volumes.length} localhostPort=${group.port}`);
}
function run(group, argv) {
  const r = spawnSync(docker,[...args(group),...argv],{cwd:root,env:childEnv,stdio:'inherit'});
  if (r.status !== 0) throw new Error(`Docker action failed for ${group.project}.`);
}
const action = process.argv[2] || 'check';
if (action === 'check') process.exit(0);
if (action === 'build') {
  run(platforms.platform,['build','--no-cache','--pull','server','migrate','client','nginx']);
  run(platforms.drm,['build','--no-cache','--pull','api','worker','migrate']);
} else if (action === 'up') {
  run(platforms.platform,['up','-d','--wait','nginx']);
  run(platforms.drm,['up','-d','--wait','api','worker']);
} else if (action === 'stop') {
  run(platforms.platform,['stop']); run(platforms.drm,['stop']);
} else if (action === 'status') {
  run(platforms.platform,['ps']); run(platforms.drm,['ps']);
} else throw new Error('Supported commands: check, build, up, stop, status.');
