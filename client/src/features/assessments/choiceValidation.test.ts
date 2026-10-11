import { describe, expect, it } from 'vitest';
import { unansweredChoices } from './choiceValidation';

const questions = [
  { id: 'first', type: 'CHOICE', choices: [{ id: 'a' }, { id: 'b' }] },
  { id: 'second', type: 'CHOICE', choices: [{ id: 'c' }, { id: 'd' }] },
];

describe('unanswered choice questions', () => {
  it('identifies every missing question in display order', () => {
    expect(unansweredChoices(questions, [])).toEqual(['first', 'second']);
  });
  it('accepts any valid selection without revealing or checking the answer key', () => {
    expect(unansweredChoices(questions, [{ questionId: 'first', choiceId: 'b' }, { questionId: 'second', choiceId: 'c' }])).toEqual([]);
  });
  it('identifies an empty saved draft selection', () => {
    expect(unansweredChoices(questions, [{ questionId: 'first', choiceId: '' }])).toEqual(['first', 'second']);
  });
  it('rejects stale or cross-question choice IDs', () => {
    expect(unansweredChoices(questions, [{ questionId: 'first', choiceId: 'c' }, { questionId: 'second', choiceId: 'retired' }])).toEqual(['first', 'second']);
  });
  it('does not change coding or program submission rules', () => {
    expect(unansweredChoices([{ id: 'code', type: 'CODING' }, { id: 'program', type: 'PROGRAM' }], [])).toEqual([]);
  });
  it('keeps only the unanswered question after completing another', () => {
    expect(unansweredChoices(questions, [{ questionId: 'second', choiceId: 'd' }])).toEqual(['first']);
  });
});
