// Host orchestration only; fixture generation, migrations and probes run in Docker.
import { spawnSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
const docker = process.env.DOCKER_EXE || 'docker';
const project = `fayq-deploy-verify-${Date.now()}`;
const file = resolve('docker/browser/evidence', `${project}.env.local`);
const env = { ...process.env, VERIFY_ENV_FILE: file };
const args = ['compose', '-p', project, '-f', 'docker/railway/verify.compose.yml'];
function run(argv, capture = false) {
  const result = spawnSync(docker, argv, { env, encoding: 'utf8', stdio: capture ? ['ignore','pipe','pipe'] : 'inherit' });
  if (result.status !== 0) throw new Error(`Docker operation failed (exit ${result.status ?? 'unavailable'})`);
  return result.stdout;
}
let exit = 1;
try {
  mkdirSync(resolve('docker/browser/evidence'), { recursive: true });
  const fixture = run(['run','--rm','--network','none','node:22-bookworm-slim','node','-e',`
    const c=require('node:crypto'); const pair=c.generateKeyPairSync('rsa',{modulusLength:2048});
    const e={NODE_ENV:'production',PORT:'3000',COOKIE_SECURE:'true',AUTH_JWT_SECRET:c.randomBytes(32).toString('hex'),
      AUTH_ISSUER:'deployment-verification',AUTH_AUDIENCE:'deployment-verification-web',ALLOWED_ORIGINS:'https://students.example.test',
      STUDENT_DATA_ENCRYPTION_KEY_B64:c.randomBytes(32).toString('base64'),STUDENT_DATA_INDEX_KEY_B64:c.randomBytes(32).toString('base64'),
      DRM_BASE_URL:'https://drm.example.test',DRM_PUBLIC_BASE_URL:'https://drm.example.test',DRM_CLIENT_ID:'synthetic-verification',DRM_CLIENT_SECRET:c.randomBytes(32).toString('hex'),
      DRM_ASSERTION_ISSUER:'https://students.example.test',DRM_ASSERTION_AUDIENCE:'drm-service',DRM_ASSERTION_KEY_ID:'verification-only',
      DRM_ASSERTION_PRIVATE_KEY_B64:Buffer.from(pair.privateKey.export({type:'pkcs8',format:'pem'})).toString('base64'),
      SEO_PUBLIC_ORIGIN:'https://students.example.test',SEO_INDEXING_ENABLED:'false'};
    console.log(Object.entries(e).map(([k,v])=>k+'='+v).join(String.fromCharCode(10)));
  `], true);
  writeFileSync(file, fixture, { mode: 0o600 });
  run([...args, 'up','-d','--wait']);
  for (const service of ['migrate', 'drm-migrate']) {
    const id = run([...args, 'ps', '--all', '--quiet', service], true).trim();
    if (!id) throw new Error(`Missing ${service} container`);
    const state = JSON.parse(run(['inspect', id], true))[0].State;
    if (state.Status !== 'exited' || state.ExitCode !== 0) throw new Error(`${service} did not exit successfully`);
    console.log(`PASS ${service} exit zero`);
  }
  // Feed the probe through stdin; no host mount enters serving containers.
  run([...args, 'cp','docker/railway/verify-probe.mjs','backend:/tmp/verify-probe.mjs']);
  run([...args, 'exec','-T','backend','node','/tmp/verify-probe.mjs']);
  exit = 0;
} catch (error) {
  console.error(error.message);
} finally {
  try {
    const ids = run(['ps','-aq','--filter',`label=com.docker.compose.project=${project}`], true).trim().split(/\s+/).filter(Boolean);
    if (ids.length) {
      const containers = JSON.parse(run(['inspect', ...ids], true));
      const volumes = [];
      for (const container of containers) {
        if (container.Config.Labels['com.docker.compose.project'] !== project) throw new Error('Cleanup refused: project mismatch');
        for (const mount of container.Mounts) {
          if (mount.Type !== 'volume' || !/^[a-f0-9]{64}$/.test(mount.Name)) throw new Error('Cleanup refused: non-disposable mount');
          const users = run(['ps','-aq','--filter',`volume=${mount.Name}`], true).trim().split(/\s+/).filter(Boolean);
          if (users.some(id => !containers.some(c => c.Id.startsWith(id)))) throw new Error('Cleanup refused: volume shared outside verification');
          volumes.push(mount.Name);
        }
      }
      run([...args, 'down','-v']);
      const remaining = run(['volume','ls','-q'], true).trim().split(/\s+/);
      if (volumes.some(name => remaining.includes(name))) throw new Error('Verification volumes remain');
    }
    if (run(['ps','-aq','--filter',`label=com.docker.compose.project=${project}`], true).trim()) throw new Error('Verification containers remain');
    if (run(['network','ls','-q','--filter',`label=com.docker.compose.project=${project}`], true).trim()) throw new Error('Verification network remains');
    console.log('PASS disposable verification cleanup');
  } catch (error) { console.error(error.message); exit = 1; }
  rmSync(file, { force: true });
}
process.exitCode = exit;
