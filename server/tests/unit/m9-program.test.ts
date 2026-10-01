import { describe, expect, it } from 'vitest';
import { content, publicContent, answers } from '../../src/modules/assessments/contracts.js';
import { freezePrograms, preparationHash } from '../../src/modules/assessments/program-contracts.js';
const source = { html: '', css: '', javascript: '' };
const question = { id: 'p', type: 'PROGRAM', titleAr: 'مربع', titleEn: 'Square', starter: source, program: { inputAr: 'رقم', inputEn: 'Number', outputAr: 'مربع', outputEn: 'Square', comparison: 'tokens', samples: [{ input: '3', output: '9' }], reference: 'console.log(Number(readline()) ** 2)', generator: { mode: 'integer', min: -10, max: 10, count: 10 } } };
const draft = { titleAr: 'اختبار', titleEn: 'Test', instructionsAr: 'حل', instructionsEn: 'Solve', questions: [question] };
describe('input/output problem contracts', () => {
  it('ignores supplied frozen cases and accepts only a validated reference/generator draft', () => {
    const c = content({ ...draft, questions: [{ ...question, program: { ...question.program, tests: [{ input: '3', output: 'forged' }] } }] });
    expect(c.questions[0]!.program!.tests).toBeUndefined();
    expect(answers([{ questionId: 'p', source, correct: true }], c)).toEqual([{ questionId: 'p', source }]);
  });
  it('never serves references, generators, or hidden tests to students', () => {
    const c = freezePrograms(content(draft), [{ questionId: 'p', tests: [{ input: '3', output: '9' }, { input: 'private-input', output: 'private-output' }] }]);
    const safe = JSON.stringify(publicContent(c));
    for (const privateValue of ['reference', 'generator', 'tests', 'private-input', 'private-output']) expect(safe).not.toContain(privateValue);
    expect(safe).toContain('samples'); expect(c.questions[0]!.program!.reference).toBeUndefined();
    expect(c.questions[0]!.program!.generator).toBeUndefined();
  });
  it('binds exactly one preparation record per problem and includes sample inputs', () => {
    const c = content(draft);
    for (const records of [[], [{ questionId: 'other', tests: [{ input: '3', output: '9' }] }], [{ questionId: 'p', tests: [{ input: '4', output: '16' }] }], [{ questionId: 'p', tests: [{ input: '3', output: 'forged' }] }], [{ questionId: 'p', tests: [{ input: '3', output: '9' }, { input: '3', output: '9' }] }], [{ questionId: 'p', tests: [] }]]) expect(() => freezePrograms(c, records)).toThrow();
  });
  it('bounds inputs, generated cases, missing translations, invalid ranges and reference size', () => {
    for (const program of [{ ...question.program, inputAr: '' }, { ...question.program, reference: 'x'.repeat(32769) }, { ...question.program, samples: [{ input: 'x'.repeat(8193), output: '' }] }, { ...question.program, generator: { mode: 'integer', min: 10, max: -10, count: 1 } }, { ...question.program, generator: { mode: 'integer', min: 0, max: 10, count: 17 } }]) expect(() => content({ ...draft, questions: [{ ...question, program }] })).toThrow();
    expect(() => freezePrograms(content(draft), [{ questionId: 'p', tests: Array.from({ length: 21 }, () => ({ input: '3', output: '9' })) }])).toThrow();
  });
  it('changes the preparation fingerprint when source, samples or generation changes', () => {
    const hash = preparationHash(content(draft));
    expect(preparationHash(content(draft))).toBe(hash);
    expect(preparationHash(content({ ...draft, questions: [{ ...question, program: { ...question.program, reference: 'console.log(9)' } }] }))).not.toBe(hash);
  });
});
