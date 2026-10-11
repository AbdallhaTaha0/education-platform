import { afterEach, describe, expect, it } from 'vitest';
import { codingIdeEnabled, choiceOnly, parseCodingIdeEnabled, requireCodingIde, gradeChoices } from '../../src/modules/assessments/availability.js';
import type { Content } from '../../src/modules/assessments/contracts.js';
const prior = process.env.CODING_IDE_ENABLED;
afterEach(() => { if (prior === undefined) delete process.env.CODING_IDE_ENABLED; else process.env.CODING_IDE_ENABLED = prior; });
describe('IDE release capability', () => {
  it('defaults off, accepts explicit booleans and rejects invalid configuration', () => {
    delete process.env.CODING_IDE_ENABLED; expect(codingIdeEnabled()).toBe(false); expect(() => requireCodingIde()).toThrow();
    expect(parseCodingIdeEnabled('false')).toBe(false); expect(parseCodingIdeEnabled('true')).toBe(true);
    expect(() => parseCodingIdeEnabled('yes')).toThrow('Invalid CODING_IDE_ENABLED');
  });
  it('only allows nonempty choice-only content', () => {
    expect(choiceOnly(null)).toBe(false); expect(choiceOnly({ questions: [] })).toBe(false);
    expect(choiceOnly({ questions: [{ type: 'CHOICE' }, { type: 'PROGRAM' }] })).toBe(false);
    expect(choiceOnly({ questions: [{ type: 'CHOICE' }] })).toBe(true);
  });
  it('requires every answer and returns no private answer keys', () => {
    const c = { questions: [{ id: 'a', type: 'CHOICE', correctChoiceId: 'private' }, { id: 'b', type: 'CHOICE', correctChoiceId: 'secret' }] } as Content;
    const wrong = gradeChoices(c, [{ questionId: 'a', choiceId: 'private' }]); expect(wrong.correct).toBe(false);
    const correct = gradeChoices(c, [{ questionId: 'a', choiceId: 'private' }, { questionId: 'b', choiceId: 'secret' }]); expect(correct.correct).toBe(true);
    expect(JSON.stringify(correct)).not.toMatch(/private|secret|correctChoiceId/);
  });
});
