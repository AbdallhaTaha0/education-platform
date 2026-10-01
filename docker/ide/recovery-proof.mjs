/** Real Docker crash-orphan cleanup proof; only freshly owned fixture IDs. */
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
const docker = process.env.DOCKER_EXE || 'docker', root = resolve(import.meta.dirname, '../..');
function call(args) { const r = spawnSync(docker, args, { cwd: root, encoding: 'utf8', timeout: 20000 }); assert.equal(r.status, 0, 'Docker proof failed (diagnostics suppressed).'); return r.stdout.trim(); }
assert.equal(call(['ps', '-aq', '--filter', 'label=fayq.owner=m9-grading']), '', 'Run after other grading verification finishes.');
const name = `fayq-grade-${randomUUID()}`; let id;
try {
  id = call(['run', '-d', '--rm', '--name', name, '--label', 'fayq.owner=m9-grading', '--network', 'none', '--read-only', '--tmpfs', '/tmp:rw,nosuid,nodev,size=256m', '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges', '--security-opt', `seccomp=${resolve(root, 'docker/ide/seccomp.chromium.json')}`, '--memory', '768m', '--cpus', '1', '--pids-limit', '256', 'fayq-assessment-execution:0.9.0', 'node', '-e', 'setTimeout(()=>{},300000)']);
  const cleanup = (advance) => call(['run', '--rm', '--name', 'fayq-m9-recovery-controller', '--label', 'fayq.owner=m9-recovery-proof', '--network', 'none', '--mount', 'type=bind,source=/var/run/docker.sock,target=/var/run/docker.sock', 'fayq-assessment-controller:0.9.0', 'node', '-e', `require('./dist/modules/assessments/launcher.js').cleanupExpiredExecutions(Date.now()+${advance}).then(()=>console.log('cleanup ok'),()=>process.exit(1))`]);
  cleanup(0); assert.equal(call(['ps', '-aq', '--filter', `name=^${name}$`]), id.slice(0, 12));
  console.log('PASS running execution younger than expiry is preserved');
  assert.equal(call(['ps', '-aq', '--filter', 'label=fayq.owner=m9-grading']), id.slice(0, 12));
  cleanup(91000); assert.equal(call(['ps', '-aq', '--filter', `name=^${name}$`]), '');
  console.log('PASS crash orphan recovered with exact ownership and isolation checks');
} finally {
  spawnSync(docker, ['rm', '-f', name, 'fayq-m9-recovery-controller'], { stdio: 'ignore', timeout: 10000 });
  assert.equal(call(['ps', '-aq', '--filter', `name=^${name}$`]), '');
}
console.log('Recovery proof 2/2; owned containers=0');
