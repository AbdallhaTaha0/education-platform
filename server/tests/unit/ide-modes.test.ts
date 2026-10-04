import { describe, expect, it } from 'vitest';
import { content, publicContent, answers, ideMode } from '../../src/modules/assessments/contracts.js';
import { freezePrograms } from '../../src/modules/assessments/program-contracts.js';
import { executePythonAssessment, comparePythonOutput } from '../../src/modules/assessments/python.js';
const source = { html: '', css: '', javascript: '', python: 'n = int(input())\nprint(n*n)' };
const draft = { ide: 'python', titleAr: 'مربع', titleEn: 'Square', instructionsAr: 'حل', instructionsEn: 'Solve', questions: [{ id: 'q', type: 'PROGRAM', titleAr: 'رقم', titleEn: 'Number', starter: source, program: { inputAr: 'رقم', inputEn: 'Number', outputAr: 'مربع', outputEn: 'Square', comparison: 'tokens', samples: [{ input: '3', output: '9' }], reference: source.python, generator: { mode: 'integer', min: -2, max: 2, count: 3 } } }] };
describe('independent IDE modes and Python grading', () => {
  it('preserves historical JavaScript contracts and rejects unsupported modes', () => {
    expect(ideMode(undefined)).toBe('javascript'); expect(() => ideMode('ruby')).toThrow();
    const { ide: _, ...legacy } = draft; expect(content(legacy).ide).toBeUndefined(); expect(content(legacy).questions[0]?.runtime).toBeUndefined();
  });
  it('binds Python runtime server-side and rejects browser behavior checks in Python', () => {
    expect(content(draft).questions[0]?.runtime).toBe('python');
    expect(() => content({ ...draft, questions: [{ ...draft.questions[0], type: 'CODING', checks: [{ type: 'console', expected: '9' }] }] })).toThrow();
    expect(() => answers([{ questionId: 'q', source: { ...source, python: undefined } }], content(draft))).toThrow();
    expect(() => answers([{ questionId: 'q', source: { ...source, javascript: 'forge' } }], content(draft))).toThrow();
  });
  it('never reveals Python reference, generator, checks or private starter', () => {
    const c = content(draft); const safe = publicContent(c);
    expect(safe.questions[0]?.starter?.python).toBe('');
    for (const key of ['reference', 'generator', 'checks']) expect(JSON.stringify(safe)).not.toContain(key);
    const frozen = freezePrograms(c, [{ questionId: 'q', tests: [{ input: '3', output: '9' }] }]);
    expect(frozen.questions[0]?.runtime).toBe('python'); expect(publicContent(frozen).ide).toBe('python');
  });
  it('accepts web DOM checks and preserves all three starter files', () => {
    const c = content({ ...draft, ide: 'web', questions: [{ ...draft.questions[0], type: 'CODING', shareStarter: true, starter: { html: '<p id="x">Hi</p>', css: 'p{color:red}', javascript: '' }, checks: [{ type: 'text', selector: '#x', expected: 'Hi', steps: [{ action: 'click', selector: '#x' }] }] }] });
    expect(publicContent(c).questions[0]?.starter?.html).toContain('<p'); expect(c.questions[0]?.runtime).toBeUndefined();
  });
  it('prepares deterministic private Python cases and checks samples', async () => {
    const payload = { mode: 'prepare', seed: 'test', questions: content(draft).questions, answers: [] };
    const prepared = await executePythonAssessment(payload, async (_s, input) => ({ output: String(Number(input) ** 2), error: null }));
    expect(prepared.correct).toBe(true); expect(prepared.results).toEqual([{ questionId: 'q', tests: [{ input: '3', output: '9' }, { input: '-2', output: '4' }, { input: '2', output: '4' }, { input: '0', output: '0' }] }]);
    const mismatch = await executePythonAssessment(payload, async () => ({ output: '0', error: null }));
    expect(mismatch).toMatchObject({ correct: false, results: [{ error: 'SAMPLE_MISMATCH' }] });
  });
  it('detects unstable reference output before publishing', async () => {
    let n = 0; const output = await executePythonAssessment({ mode: 'prepare', questions: content(draft).questions, answers: [] }, async () => ({ output: String(++n), error: null }));
    expect(output).toMatchObject({ correct: false, results: [{ error: 'UNSTABLE_REFERENCE' }] });
  });
  it('grades every hidden case; runtime errors cannot pass and infrastructure errors propagate', async () => {
    const frozen = freezePrograms(content(draft), [{ questionId: 'q', tests: [{ input: '3', output: '9' }, { input: '-2', output: '4' }] }]);
    const payload = { questions: frozen.questions, answers: [{ questionId: 'q', source }] };
    expect(await executePythonAssessment(payload, async (_s, input) => ({ output: String(Number(input) ** 2), error: null }))).toMatchObject({ correct: true, results: [{ checksPassed: 2, checksTotal: 2 }] });
    expect(await executePythonAssessment(payload, async () => ({ output: '9', error: 'CODE_LIMIT' }))).toMatchObject({ correct: false, results: [{ checksPassed: 0, checksTotal: 2 }] });
    await expect(executePythonAssessment(payload, async () => { throw new Error('GRADING_LAUNCH_FAILED'); })).rejects.toThrow('GRADING_LAUNCH_FAILED');
  });
  it('compares Python printed output with the existing whole-output rules', () => {
    expect(comparePythonOutput('9\n', '9', 'tokens')).toBe(true);
    expect(comparePythonOutput('a  b\n', 'a b', 'exact')).toBe(false);
    expect(comparePythonOutput('{"n":2}', '{"n":"2"}', 'json')).toBe(false);
    expect(comparePythonOutput('{"n":2}', '{ "n": 2 }', 'json')).toBe(true);
  });
});
