import { describe, expect, it } from 'vitest';
import { content, publicContent, answers } from '../../src/modules/assessments/contracts.js';
import { quotaWindow } from '../../src/modules/assessments/quota.js';
const source = { html: '<div id="x"></div>', css: '', javascript: '' };
const c = { titleAr: 'عنوان', titleEn: 'Title', instructionsAr: 'تعليمات', instructionsEn: 'Instructions', questions: [{ id: 'q1', type: 'CODING', titleAr: 'سؤال', titleEn: 'Question', starter: source, checks: [{ type: 'text', selector: '#x', expected: 'secret-check' }] }, { id: 'q2', type: 'CHOICE', titleAr: 'اختر', titleEn: 'Choose', choices: [{ id: 'a', textAr: 'أ', textEn: 'A' }, { id: 'b', textAr: 'ب', textEn: 'B' }], correctChoiceId: 'b' }] };
describe('M9 contracts', () => {
  it('keeps admin source private by default, including existing unflagged revisions', () => {
    const parsed = content({ ...c, questions: [{ ...c.questions[0], starter: { ...source, javascript: 'console.log("private-solution")' } }] });
    expect(publicContent(parsed).questions[0]?.starter).toEqual({ html: '', css: '', javascript: '' });
    expect(JSON.stringify(publicContent(parsed))).not.toContain('private-solution');
    delete parsed.questions[0]!.shareStarter;
    expect(publicContent(parsed).questions[0]?.starter?.javascript).toBe('');
  });
  it('shares starter code only by explicit opt-in and validates the flag', () => {
    const parsed = content({ ...c, questions: [{ ...c.questions[0], shareStarter: true }] });
    expect(publicContent(parsed).questions[0]?.starter).toEqual(source);
    expect(() => content({ ...c, questions: [{ ...c.questions[0], shareStarter: 'true' }] })).toThrow();
  });
  it('validates mixed content and strips every private test/answer from student delivery', () => { const parsed = content(c); const safe = JSON.stringify(publicContent(parsed)); expect(safe).not.toContain('secret-check'); expect(safe).not.toContain('correctChoiceId'); expect(safe).not.toContain('checks'); expect(safe).toContain('choices'); });
  it('rejects duplicate question ids and missing translations', () => { expect(() => content({ ...c, titleAr: '' })).toThrow(); expect(() => content({ ...c, questions: [c.questions[0], c.questions[0]] })).toThrow(); });
  it('binds exactly one answer to each question, not forged grades', () => { const input = answers([{ questionId: 'q1', source, correct: true }, { questionId: 'q2', choiceId: 'a', grade: 100 }], content(c)); expect(input).toEqual([{ questionId: 'q1', source }, { questionId: 'q2', choiceId: 'a' }]); expect(() => answers([{ questionId: 'q1', source }, { questionId: 'q1', source }], content(c))).toThrow(); });
  it('rejects executable checker snippets and oversized source', () => { expect(() => content({ ...c, questions: [{ ...c.questions[0], checks: [{ type: 'eval', expected: true }] }] })).toThrow(); expect(() => answers([{ questionId: 'q1', source: { ...source, javascript: 'x'.repeat(32769) } }, { questionId: 'q2', choiceId: 'a' }], content(c))).toThrow(); });
  it('allows incomplete draft choices while rejecting invalid source or unknown choices', () => { const parsed = content(c); expect(answers([{ questionId: 'q1', source }, { questionId: 'q2', choiceId: '' }], parsed, true)[1]?.choiceId).toBe(''); expect(() => answers([{ questionId: 'q1', source: { ...source, javascript: 5 } }, { questionId: 'q2', choiceId: '' }], parsed, true)).toThrow(); expect(() => answers([{ questionId: 'q1', source }, { questionId: 'q2', choiceId: 'unknown' }], parsed)).toThrow(); });
  it('uses Cairo calendar boundaries rather than UTC midnight', () => { const w = quotaWindow(Date.parse('2026-01-01T22:30:00Z'), null); expect(w.start.toISOString()).toBe('2026-01-01T22:00:00.000Z'); expect(w.end.toISOString()).toBe('2026-01-02T22:00:00.000Z'); });
  it('handles Cairo daylight-saving transition without an invented fixed-offset day', () => { const w = quotaWindow(Date.parse('2026-04-24T12:00:00Z'), null); expect(w.end.getTime() - w.start.getTime()).toBe(23 * 3600000); });
  it('continues exact 24h anchored windows and does not bank missed allowances', () => { const anchor = new Date('2026-01-01T17:00:00Z'); const w = quotaWindow(Date.parse('2026-01-05T12:00:00Z'), anchor); expect(w.start.toISOString()).toBe('2026-01-04T17:00:00.000Z'); expect(w.end.toISOString()).toBe('2026-01-05T17:00:00.000Z'); });
});
