import { spawn } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import type { Question, Answer } from './contracts.js';
import type { ProgramSpec } from './program-contracts.js';

export interface PythonOutput { output: string; error: string | null }
/** The trusted controller compares results. Each case sees only its own code/input. */
export async function runPython(source: string, input: string): Promise<PythonOutput> {
  const image = process.env.PYTHON_GRADING_IMAGE ?? 'fayq-python-execution:0.10.0';
  if (!/^fayq-python-execution:[\w.-]+(@sha256:[a-f0-9]{64})?$/.test(image)) throw new Error('GRADING_IMAGE_INVALID');
  const runtime = process.env.GRADING_RUNTIME ?? '';
  if (process.env.NODE_ENV === 'production' && runtime !== 'runsc') throw new Error('GRADING_ISOLATION_UNQUALIFIED');
  const name = `fayq-grade-${randomUUID()}`;
  const docker = process.env.DOCKER_EXE ?? 'docker';
  const args = ['run', '--rm', '--init', '-i', '--name', name, '--label', 'fayq.owner=m9-grading', '--network', 'none', '--read-only', '--tmpfs', '/tmp:rw,nosuid,nodev,noexec,size=16m', '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges', '--memory', '192m', '--cpus', '1', '--pids-limit', '32', ...(runtime ? ['--runtime', runtime] : []), image];
  let result: PythonOutput;
  try {
    result = await new Promise<PythonOutput>((resolve, reject) => {
      const child = spawn(docker, args, { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
      let output = '', limited = false;
      const timer = setTimeout(() => { limited = true; child.kill(); }, 6000);
      child.stdin.on('error', () => {});
      child.stdout.setEncoding('utf8');
      child.stdout.on('data', (chunk: string) => { output += chunk; if (Buffer.byteLength(output) > 8192) { limited = true; child.kill(); } });
      // Do not retain/log raw stderr; Python can deliberately print private source there.
      child.stderr.resume();
      child.on('error', () => { clearTimeout(timer); reject(new Error('GRADING_LAUNCH_FAILED')); });
      child.on('close', (code) => {
        clearTimeout(timer);
        if (!limited && (code === 125 || code === 126 || code === 127 || code === null)) return reject(new Error('GRADING_EXECUTION_FAILED'));
        resolve({ output: output.slice(0, 8192), error: limited || code === 137 || code === 152 ? 'CODE_LIMIT' : code !== 0 ? 'CODE_ERROR' : null });
      });
      child.stdin.end(JSON.stringify({ source, input }));
    });
  } finally {
    await command(docker, ['rm', '-f', name]);
    const remaining = await command(docker, ['ps', '-aq', '--filter', `name=^${name}$`]);
    if (remaining.code !== 0 || remaining.output.trim()) throw new Error('GRADING_CLEANUP_FAILED');
  }
  return result;
}
function command(docker: string, args: string[]): Promise<{ code: number; output: string }> {
  return new Promise((resolve) => {
    const child = spawn(docker, args, { windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] }); let output = '';
    const timer = setTimeout(() => { child.kill(); resolve({ code: -1, output: '' }); }, 10000);
    child.stdout.on('data', (b: Buffer) => { output += b.toString(); });
    child.on('error', () => { clearTimeout(timer); resolve({ code: -1, output: '' }); });
    child.on('close', (code) => { clearTimeout(timer); resolve({ code: code ?? -1, output }); });
  });
}
export function comparePythonOutput(actual: string, expected: string, mode: string): boolean {
  const normalize = (s: string) => s.replace(/\r\n?/g, '\n').trimEnd();
  if (mode === 'exact') return normalize(actual) === normalize(expected);
  if (mode === 'tokens') return isDeepStrictEqual(actual.trim().split(/\s+/).filter(Boolean), expected.trim().split(/\s+/).filter(Boolean));
  if (mode === 'json') { try { return isDeepStrictEqual(JSON.parse(actual), JSON.parse(expected)); } catch { return false; } }
  return false;
}
export async function executePythonAssessment(payload: { questions: Question[]; answers: Answer[]; mode?: string; seed?: string }, execute = runPython) {
  const results: unknown[] = [];
  const deadline = Date.now() + 45000;
  for (const q of payload.questions) {
    if (q.type === 'CHOICE') {
      const correct = payload.answers.find((a) => a.questionId === q.id)?.choiceId === q.correctChoiceId;
      results.push({ questionId: q.id, correct, checksPassed: correct ? 1 : 0, checksTotal: 1 }); continue;
    }
    if (q.runtime !== 'python' || q.type !== 'PROGRAM' || !q.program) throw new Error('INPUT_INVALID');
    const p = q.program;
    const run = async (source: string, input: string): Promise<string> => {
      if (Date.now() > deadline) throw new Error('CODE_LIMIT');
      const output = await execute(source, input); if (output.error) throw new Error(output.error); return output.output;
    };
    if (payload.mode === 'prepare') {
      try {
        const tests = await preparePython(p, `${payload.seed}:${q.id}`, run);
        results.push({ questionId: q.id, tests });
      } catch (e) { return { correct: false, results: [{ error: (e as Error).message }] }; }
    } else {
      const tests = p.tests; const source = payload.answers.find((a) => a.questionId === q.id)?.source?.python;
      if (!tests?.length || source === undefined) throw new Error('INPUT_INVALID');
      let passed = 0;
      for (const test of tests) {
        try { if (comparePythonOutput(await run(source, test.input), test.output, p.comparison)) passed++; }
        catch (e) { if (!['CODE_ERROR', 'CODE_LIMIT'].includes((e as Error).message)) throw e; }
      }
      results.push({ questionId: q.id, correct: passed === tests.length, checksPassed: passed, checksTotal: tests.length });
    }
  }
  return { correct: payload.mode === 'prepare' || results.every((r) => (r as { correct: boolean }).correct), results };
}
async function preparePython(p: ProgramSpec, seed: string, run: (source: string, input: string) => Promise<string>) {
  if (!p.reference || !p.generator) throw new Error('REFERENCE_FAILED');
  let inputs: string[];
  if (p.generator.mode === 'integer') {
    const { min, max, count } = p.generator; const values = new Set<number>(); const size = Math.min(count, max - min + 1);
    for (const edge of [min, max, 0, -1, 1]) if (values.size < size && edge >= min && edge <= max) values.add(edge);
    for (let n = 0; values.size < size && n < 1000; n++) values.add(min + createHash('sha256').update(`${seed}:${n}`).digest().readUInt32BE(0) % (max - min + 1));
    for (let n = min; values.size < size; n++) values.add(n);
    inputs = [...values].map(String);
  } else {
    try {
      const generated: unknown = JSON.parse(await run(p.generator.code, ''));
      if (!Array.isArray(generated) || !generated.length || generated.length > 16 || generated.some((s) => typeof s !== 'string' || s.length > 8192)) throw new Error();
      inputs = generated;
    } catch { throw new Error('GENERATOR_FAILED'); }
  }
  inputs = [...new Set([...p.samples.map((s) => s.input), ...inputs])];
  if (inputs.length > 20) throw new Error('PREPARATION_LIMIT');
  const tests = [];
  for (const input of inputs) {
    let output: string, repeated: string;
    try { output = await run(p.reference, input); repeated = await run(p.reference, input); } catch { throw new Error('REFERENCE_FAILED'); }
    if (output !== repeated) throw new Error('UNSTABLE_REFERENCE');
    if (p.samples.some((s) => s.input === input && !comparePythonOutput(output, s.output, p.comparison))) throw new Error('SAMPLE_MISMATCH');
    tests.push({ input, output });
  }
  return tests;
}
