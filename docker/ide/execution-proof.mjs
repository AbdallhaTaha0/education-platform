/** Trusted test orchestrator: all submitted JS executes inside restricted Docker.
 * No host mounts, credentials, source on argv, or internet inside execution jobs. */
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
const docker = process.env.DOCKER_EXE || 'docker';
const root = resolve(import.meta.dirname, '../..');
const profile = resolve(root, 'docker/ide/seccomp.chromium.json');
const code = (js, html = '', css = '') => ({ html, css, javascript: js });
function execute(payload) {
  const name = `fayq-m9-proof-${randomUUID()}`;
  let r;
  try {
    r = spawnSync(docker, ['run', '--rm', '--init', '-i', '--name', name, '--label', 'fayq.owner=m9-execution-proof', '--network', 'none', '--read-only', '--tmpfs', '/tmp:rw,nosuid,nodev,size=256m', '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges', '--security-opt', `seccomp=${profile}`, '--memory', '768m', '--cpus', '1', '--pids-limit', '256', 'fayq-assessment-execution:0.9.0'], { cwd: root, input: payload ? JSON.stringify(payload) : '', encoding: 'utf8', timeout: 45000, maxBuffer: 64000 });
    assert.equal(r.status, 0, 'Execution image failed (diagnostics suppressed).');
    return JSON.parse(r.stdout.trim());
  } finally {
    spawnSync(docker, ['rm', '-f', name], { stdio: 'ignore', timeout: 10000 });
    const remaining = spawnSync(docker, ['ps', '-aq', '--filter', `name=^${name}$`], { encoding: 'utf8', timeout: 10000 });
    assert.equal(remaining.status, 0); assert.equal(remaining.stdout.trim(), '', 'Owned execution container remains.');
  }
}
const one = (source, checks) => ({ questions: [{ id: 'code', type: 'CODING', checks }], answers: [{ questionId: 'code', source }] });
const proof = (name, run) => { run(); console.log(`PASS ${name}`); };
proof('Chromium namespace and seccomp enabled', () => assert.deepEqual(execute(), { sandboxStarted: true, namespaceSandbox: true, seccompSandbox: true }));
proof('real JS, DOM interactions, input, CSS and console', () => {
  const result = execute(one(code(`const sum=(a,b)=>a+b; document.querySelector('#button').onclick=()=>document.querySelector('#out').textContent='done'; document.querySelector('#field').oninput=e=>document.querySelector('#out').textContent=e.target.value; console.log('hello 3');`, '<button id="button">Click</button><p id="out">start</p><input id="field">', '#out { color: rgb(255, 0, 0); }'), [
    { type: 'function', name: 'sum', args: [2, 3], expected: 5 }, { type: 'text', selector: '#out', expected: 'done', steps: [{ action: 'click', selector: '#button' }] }, { type: 'value', selector: '#field', expected: 'fayq', steps: [{ action: 'input', selector: '#field', value: 'fayq' }] }, { type: 'text', selector: '#out', expected: 'fayq' }, { type: 'style', selector: '#out', name: 'color', expected: 'rgb(255, 0, 0)' }, { type: 'console', expected: 'hello 3' },
  ])); assert.equal(result.correct, true); assert.equal(result.results[0].checksPassed, 6);
});
proof('incorrect behavior fails', () => assert.equal(execute(one(code('function sum(){ return 99 }'), [{ type: 'function', name: 'sum', args: [1, 2], expected: 3 }])).correct, false));
proof('console.log(2) matches text and existing numeric expectations', () => {
  const result = execute(one(code('console.log(2)'), [{ type: 'console', expected: '2' }, { type: 'console', expected: 2 }]));
  assert.equal(result.correct, true); assert.equal(result.results[0].checksPassed, 2);
});
proof('console output checks remain exact and function result types stay strict', () => {
  assert.equal(execute(one(code('console.log(3)'), [{ type: 'console', expected: 2 }])).correct, false);
  assert.equal(execute(one(code('console.log(2); console.log(3)'), [{ type: 'console', expected: '2' }])).correct, false);
  assert.equal(execute(one(code('function answer(){return "2"}'), [{ type: 'function', name: 'answer', args: [], expected: 2 }])).correct, false);
});
proof('quoted output and a missing click target fail with a valid console.log(2)', () => {
  assert.equal(execute(one(code('console.log(2)'), [{ type: 'console', expected: '"2"' }])).correct, false);
  assert.equal(execute(one(code('console.log(2)'), [{ type: 'console', expected: '2', steps: [{ action: 'click', selector: '#missing' }] }])).correct, false);
});
proof('syntax errors fail without fabricating success', () => assert.equal(execute(one(code('const = invalid'), [{ type: 'exists', selector: '#ok' }])).correct, false));
proof('student pass flags and DOM prototype tampering cannot forge checking', () => assert.equal(execute(one(code("window.correct=true; window.checksPassed=99; document.querySelector=()=>({textContent:'correct'}); Document.prototype.querySelector=document.querySelector;"), [{ type: 'text', selector: '#missing', expected: 'correct' }])).correct, false));
proof('network is unavailable to student code', () => assert.equal(execute(one(code("async function allowed(){try{await fetch('https://example.com');return true}catch{return false}}"), [{ type: 'function', name: 'allowed', args: [], expected: false }])).correct, true));
proof('mixed coding and choice questions must all pass', () => {
  const payload = one(code('function sum(a,b){return a+b}'), [{ type: 'function', name: 'sum', args: [1, 2], expected: 3 }]);
  payload.questions.push({ id: 'choice', type: 'CHOICE', correctChoiceId: 'a' }); payload.answers.push({ questionId: 'choice', choiceId: 'b' });
  const result = execute(payload); assert.equal(result.results[0].correct, true); assert.equal(result.correct, false);
});
proof('endless source is interrupted and incorrect', () => {
  const result = execute(one(code('while(true){}'), [{ type: 'exists', selector: '#missing' }])); assert.equal(result.correct, false); assert.equal(result.results[0].error, 'CODE_LIMIT');
});
const square = { comparison: 'tokens', samples: [{ input: '3', output: '9' }], reference: 'const n=Number(readline()); console.log(n*n)', generator: { mode: 'integer', min: -10, max: 10, count: 8 } };
const prepare = (program) => execute({ mode: 'prepare', seed: 'repeatable-proof', questions: [{ id: 'p', type: 'PROGRAM', program }], answers: [] });
const programAnswer = (source, tests, comparison = 'tokens') => execute({ questions: [{ id: 'p', type: 'PROGRAM', program: { comparison, tests } }], answers: [{ questionId: 'p', source: code(source) }] });
let generated;
proof('reference preparation generates stable boundary cases and validates the public sample', () => {
  const result = prepare(square); assert.equal(result.correct, true); generated = result.results[0].tests;
  assert(generated.some((t) => t.input === '-10' && t.output === '100')); assert(generated.some((t) => t.input === '0' && t.output === '0'));
  assert.deepEqual(prepare(square).results[0].tests, generated);
});
proof('dynamic square passes every frozen input and hardcoded sample output fails', () => {
  assert.equal(programAnswer('console.log(Number(readline()) ** 2)', generated).correct, true);
  assert.equal(programAnswer('console.log(9)', generated).correct, false);
});
proof('wrong reference and syntax errors cannot prepare publishable tests', () => {
  assert.equal(prepare({ ...square, reference: 'console.log(2)' }).results[0].error, 'SAMPLE_MISMATCH');
  assert.equal(prepare({ ...square, reference: 'const = invalid' }).results[0].error, 'REFERENCE_FAILED');
});
proof('unstable reference outputs and oversized generators are rejected', () => {
  assert.equal(prepare({ ...square, reference: 'console.log(Math.random())' }).results[0].error, 'UNSTABLE_REFERENCE');
  assert.equal(prepare({ ...square, generator: { mode: 'custom', code: 'console.log(JSON.stringify(Array.from({length:17},(_,n)=>String(n))))' } }).results[0].error, 'GENERATOR_FAILED');
});
proof('custom generator supports multiline inputs and generated expected outputs', () => {
  const result = prepare({ ...square, samples: [{ input: '2\r\n3', output: '5' }], reference: 'console.log(Number(readline())+Number(readline()))', generator: { mode: 'custom', code: 'console.log(JSON.stringify(["5\\n7", "-1\\n4"]))' } });
  assert.equal(result.correct, true); assert.equal(result.results[0].tests.length, 3);
  assert.equal(programAnswer('console.log(Number(readline())+Number(readline()))', result.results[0].tests).correct, true);
  assert.equal(prepare({ ...square, generator: { mode: 'custom', code: 'console.log(JSON.stringify([1,2]))' } }).results[0].error, 'GENERATOR_FAILED');
});
proof('tokens, exact text and JSON comparers enforce their documented rules', () => {
  assert.equal(programAnswer('console.log("2   3")', [{ input: '', output: '2\n3' }]).correct, true);
  assert.equal(programAnswer('console.log("2   3")', [{ input: '', output: '2 3' }], 'exact').correct, false);
  assert.equal(programAnswer('console.log(JSON.stringify({b:[2],a:1}))', [{ input: '', output: '{"a":1,"b":[2]}' }], 'json').correct, true);
  assert.equal(programAnswer('console.log(JSON.stringify({a:"1",b:[2]}))', [{ input: '', output: '{"a":1,"b":[2]}' }], 'json').correct, false);
});
proof('extra output, runtime errors, tampered success and oversized output fail', () => {
  for (const source of ['console.log(9);console.log("debug")', 'console.log(9);throw Error("bad")', 'window.correct=true;', 'console.log("x".repeat(9000))']) assert.equal(programAnswer(source, [{ input: '3', output: '9' }]).correct, false);
});
console.log('execution proof: 18/18 passed; owned containers=0');
