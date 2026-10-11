// One bounded, owner-authorized compatibility probe; never deploys services.
// CLI login credentials stay in memory and are never passed to sandbox jobs.
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { Sandbox } from './node_modules/railway/dist/index.js';

const projectId = '92f470f3-76bd-4575-9f68-c2ef0e39f84b';
const environmentId = '2b532e83-ac59-4a98-a887-84114f581094';
const token = JSON.parse(readFileSync(join(homedir(), '.railway/config.json'), 'utf8')).user?.accessToken;
if (!token) throw new Error('Complete Railway CLI login first.');
const config = { token, authType: 'bearer', environmentId,
  fetch: (url, options) => fetch(url, { ...options, signal: AbortSignal.timeout(20_000) }) };
let sandbox;
let cleanupConfirmed = false;
let passed = false;
try {
  const response = await config.fetch('https://backboard.railway.com/graphql/v2', {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: 'query($id:String!){project(id:$id){name environments{edges{node{id name}}}}}', variables: { id: projectId } }),
  });
  const result = await response.json();
  const project = result.data?.project;
  if (project?.name !== 'sweet-embrace' || !project.environments.edges.some(({node}) => node.id === environmentId && node.name === 'testing')) {
    throw new Error('Project/environment identity guard refused.');
  }
  const existing = await Sandbox.list(config);
  if (existing.some(item => ['CREATING', 'RUNNING', 'DESTROYING'].includes(item.status))) {
    throw new Error('Testing already has a live sandbox; refusing ambiguous ownership.');
  }
  console.log('scope=testing cpu=0.5 memoryGB=1 idleTimeoutMinutes=1');
  sandbox = await Sandbox.create({ ...config, resources: { cpu: 0.5, memoryGB: 1 }, idleTimeoutMinutes: 1, networkIsolation: 'ISOLATED' });
  console.log(`ownedSandbox=${sandbox.id}`);
  const probes = [
    ['javascript', `node -e 'if (7*7 !== 49) process.exit(1); console.log("JS_OK")'`, 15],
    ['python', `python3 -c 'assert 7*7 == 49; print("PYTHON_OK")'`, 15],
    ['docker', `docker info --format '{{json .Runtimes}}'`, 15],
    ['docker-javascript', `docker run --rm --network none --read-only --cap-drop ALL --security-opt no-new-privileges --memory 256m --cpus 0.5 --pids-limit 64 node:22-alpine node -e 'if (7*7 !== 49) process.exit(1); console.log("DOCKER_JS_OK")'`, 60],
    ['docker-python', `docker run --rm --network none --read-only --cap-drop ALL --security-opt no-new-privileges --memory 256m --cpus 0.5 --pids-limit 64 python:3.12-alpine python -B -c 'assert 7*7 == 49; print("DOCKER_PYTHON_OK")'`, 60],
  ];
  passed = true;
  for (const [name, command, timeoutSec] of probes) {
    const output = await sandbox.execHttp(command, { timeoutSec });
    const ok = output.exitCode === 0 && !output.timedOut;
    passed &&= ok;
    console.log(JSON.stringify({ probe: name, pass: ok, exitCode: output.exitCode, timedOut: output.timedOut,
      ...(name === 'docker' ? { runscPresent: /"runsc"/.test(output.stdout ?? '') } : {}) }));
  }
} catch (error) {
  passed = false;
  // Do not print provider response bodies or authentication-bearing errors.
  console.log(`probeFailed type=${error?.constructor?.name ?? 'Error'}`);
} finally {
  if (sandbox) {
    for (let attempt = 0; attempt < 3 && !cleanupConfirmed; attempt++) {
      try {
        await sandbox.destroy();
        const remaining = await Sandbox.list(config);
        cleanupConfirmed = !remaining.some(item => item.id === sandbox.id && item.status !== 'DESTROYED');
      } catch { console.log(`cleanupRetry=${attempt + 1}`); }
    }
  } else {
    // If creation failed before returning a handle, do not delete unknown resources.
    console.log('No owned sandbox handle; automatic idle shutdown is the fallback if creation was accepted.');
  }
  console.log(`compatibilityPass=${passed} cleanupConfirmed=${cleanupConfirmed}`);
  process.exitCode = passed && cleanupConfirmed ? 0 : 1;
}
