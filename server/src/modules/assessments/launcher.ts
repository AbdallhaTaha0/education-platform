import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';

/** Only the trusted grading controller uses this launcher. Serving replicas
 * never mount a Docker socket, and executable source travels via stdin. */
export async function executeIsolated(payload: unknown): Promise<{ correct: boolean; results: unknown[] }> {
  const profile = process.env.GRADING_SECCOMP_FILE ?? '/srv/server/seccomp.chromium.json';
  const runtime = process.env.GRADING_RUNTIME ?? '';
  if (!existsSync(profile)) throw new Error('GRADING_PROFILE_MISSING');
  if (process.env.NODE_ENV === 'production' && runtime !== 'runsc') throw new Error('GRADING_ISOLATION_UNQUALIFIED');
  const image = process.env.GRADING_IMAGE ?? 'fayq-assessment-execution:0.9.0';
  if (!/^fayq-assessment-execution:[\w.-]+(@sha256:[a-f0-9]{64})?$/.test(image)) throw new Error('GRADING_IMAGE_INVALID');
  const name = `fayq-grade-${randomUUID()}`;
  const args = ['run', '--rm', '--init', '-i', '--name', name, '--label', 'fayq.owner=m9-grading', '--network', 'none', '--read-only', '--tmpfs', '/tmp:rw,nosuid,nodev,size=256m', '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges', '--security-opt', `seccomp=${profile}`, '--memory', '768m', '--cpus', '1', '--pids-limit', '256', ...(runtime ? ['--runtime', runtime] : []), image];
  let result: string;
  try { result = await new Promise<string>((resolve, reject) => {
    const child = spawn('docker', args, { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
    let output = ''; let error = ''; let killed = false;
    const timer = setTimeout(() => { killed = true; child.kill(); }, 35000);
    child.stdin.on('error', () => {}); child.stdout.on('data', (b: Buffer) => { output += b.toString(); if (output.length > 64_000) { killed = true; child.kill(); } });
    child.stderr.on('data', (b: Buffer) => { if (error.length < 4096) error += b.toString(); });
    child.on('error', () => { clearTimeout(timer); reject(new Error('GRADING_LAUNCH_FAILED')); });
    child.on('close', (code) => { clearTimeout(timer); if (killed) reject(new Error('CODE_LIMIT')); else if (code !== 0) reject(new Error('GRADING_EXECUTION_FAILED')); else resolve(output); });
    child.stdin.end(JSON.stringify(payload));
  }); } finally {
    // --rm covers success, but disconnects/timeouts also need an awaited cleanup.
    // Names originate here, never from student input. No project-wide deletion.
    await dockerCommand(['rm', '-f', name]);
    const remaining = await dockerCommand(['ps', '-aq', '--filter', `name=^${name}$`]);
    if (remaining.code !== 0 || remaining.output.trim()) throw new Error('GRADING_CLEANUP_FAILED');
  }
  const parsed = JSON.parse(result.trim()) as { correct?: unknown; results?: unknown };
  if (typeof parsed.correct !== 'boolean' || !Array.isArray(parsed.results)) throw new Error('GRADING_RESULT_INVALID');
  return { correct: parsed.correct, results: parsed.results };
}

function dockerCommand(args: string[]): Promise<{ code: number; output: string }> {
  return new Promise((resolve) => {
    const child = spawn('docker', args, { stdio: ['ignore', 'pipe', 'ignore'], windowsHide: true }); let output = '';
    child.stdout.on('data', (b: Buffer) => { output += b.toString(); if (output.length > 1_000_000) child.kill(); });
    const timer = setTimeout(() => { child.kill(); resolve({ code: -1, output: '' }); }, 10000);
    child.on('error', () => { clearTimeout(timer); resolve({ code: -1, output: '' }); });
    child.on('close', (code) => { clearTimeout(timer); resolve({ code: code ?? -1, output }); });
  });
}

/** Repair only expired containers created by this controller after a crash. */
export async function cleanupExpiredExecutions(now = Date.now()): Promise<void> {
  const found = await dockerCommand(['ps', '-aq', '--filter', 'label=fayq.owner=m9-grading']);
  if (found.code !== 0) throw new Error('GRADING_HOST_UNAVAILABLE');
  for (const id of found.output.trim().split(/\s+/).filter(Boolean)) {
    if (!/^[a-f0-9]{12,64}$/.test(id)) throw new Error('GRADING_CONTAINER_INVALID');
    const inspected = await dockerCommand(['inspect', id]); if (inspected.code !== 0) continue;
    const [c] = JSON.parse(inspected.output) as Array<{ Name: string; Created: string; Mounts: unknown[]; Config: { User: string; Labels: Record<string, string> }; HostConfig: { NetworkMode: string; ReadonlyRootfs: boolean; CapDrop: string[] } }>;
    if (!c || c.Config.Labels['fayq.owner'] !== 'm9-grading' || !/^\/fayq-grade-[a-f\d-]{36}$/.test(c.Name) || c.Config.User !== 'node' || c.Mounts.length || c.HostConfig.NetworkMode !== 'none' || !c.HostConfig.ReadonlyRootfs || !c.HostConfig.CapDrop.includes('ALL')) throw new Error('GRADING_CLEANUP_OWNERSHIP');
    if (Date.parse(c.Created) < now - 90000) {
      const removed = await dockerCommand(['rm', '-f', id]); if (removed.code !== 0) throw new Error('GRADING_CLEANUP_FAILED');
    }
  }
}
