import { describe, expect, it } from 'vitest';
import { academicPlacement, cairoDeadline, accessTerms } from '../../src/modules/catalog/academic.js';

describe('academic access validation', () => {
  it('keeps unclassified legacy placement explicit', () => { expect(academicPlacement(null).grade).toBeNull(); });
  it('requires a term for both secondary grades', () => {
    const data = { grade: 'FIRST_SECONDARY', academicYear: '2026/2027', courseKind: 'MONTHLY_EXPLANATION', teachingMonth: '2026-10' };
    expect(() => academicPlacement(data)).toThrow();
    expect(academicPlacement({ ...data, term: 1 }).term).toBe(1);
    expect(() => academicPlacement({ ...data, grade: 'SECOND_SECONDARY' })).toThrow();
    expect(academicPlacement({ ...data, grade: 'SECOND_SECONDARY', term: 2 }).term).toBe(2);
  });
  it.each(['2026/2028', 'year', '2026/2026'])('rejects invalid academic year %s', academicYear => {
    expect(() => academicPlacement({ grade: 'SECOND_SECONDARY', academicYear, courseKind: 'REVISION' })).toThrow();
  });
  it('separates revision from teaching month', () => {
    expect(() => academicPlacement({ grade: 'SECOND_SECONDARY', academicYear: '2026/2027', courseKind: 'REVISION', teachingMonth: '2026-10' })).toThrow();
  });
  it('resolves both Cairo seasonal offsets and rejects the wrong offset', () => {
    expect(cairoDeadline('2027-01-15T18:00:00+02:00').toISOString()).toBe('2027-01-15T16:00:00.000Z');
    expect(cairoDeadline('2027-07-15T18:00:00+03:00').toISOString()).toBe('2027-07-15T15:00:00.000Z');
    expect(() => cairoDeadline('2027-07-15T18:00:00+02:00')).toThrow();
  });
  it('rejects a winter +03:00 offset and accepts fractional seconds with the correct offset', () => {
    expect(() => cairoDeadline('2027-01-15T18:00:00+03:00')).toThrow();
    expect(cairoDeadline('2027-01-15T18:00:00.000+02:00').toISOString()).toBe('2027-01-15T16:00:00.000Z');
  });
  it.each(['2027-02-30T12:00:00+02:00', '2027-01-15', '2027-01-15T18:00:00', '2027-01-15T99:00:00+02:00'])('rejects ambiguous/invalid date %s', value => {
    expect(() => cairoDeadline(value)).toThrow();
  });
  it('requires explicit access terms and academic context for fixed dates', () => {
    expect(() => accessTerms({}, null, { term: null, academicYear: null })).toThrow();
    expect(() => accessTerms({ accessMode: 'TERM_END', accessEndsAt: '2027-01-15T18:00:00+02:00' }, null, { term: null, academicYear: '2026/2027' })).toThrow();
    expect(accessTerms({ durationDays: 30 }, null, { term: null, academicYear: null }).durationDays).toBe(30);
    expect(accessTerms({ accessMode: 'YEAR_END', accessEndsAt: '2027-07-15T18:00:00+03:00' }, null, { term: null, academicYear: '2026/2027' }).durationDays).toBeNull();
  });
  it('allows explicit access until removal without inventing a deadline', () => {
    expect(accessTerms({ accessMode: 'UNTIL_REMOVAL' }, null, { term: null, academicYear: null })).toMatchObject({ accessMode: 'UNTIL_REMOVAL', durationDays: null, accessEndsAt: null });
    expect(() => accessTerms({ accessMode: 'UNTIL_REMOVAL', durationDays: 30 }, null, { term: null, academicYear: null })).toThrow();
    expect(() => accessTerms({ accessMode: 'UNTIL_REMOVAL', accessEndsAt: '2027-01-15T18:00:00+02:00' }, null, { term: null, academicYear: null })).toThrow();
  });
});
