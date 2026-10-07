import { describe, expect, it } from 'vitest';
import {
  emptySession,
  expectedPartCount,
  heldParts,
  holdsText,
  isSameSelection,
  remainingPartIndexes,
  reportReducer,
  type ReportSessionState,
} from './session';
import type { GeneratedReport, ReportType } from './types';

function report(overrides: Partial<GeneratedReport> = {}): GeneratedReport {
  return {
    studentId: 'student-1',
    courseIds: ['course-1'],
    reportType: 'WEEK',
    generatedAt: '2026-10-07T09:00:00.000Z',
    period: { start: '2026-09-30T21:00:00.000Z', end: '2026-10-07T21:00:00.000Z', timeZone: 'Africa/Cairo' },
    guardian: { phone: '+201001234567' },
    parts: [{ index: 1, total: 1, text: 'تقرير FAYQ' }],
    ...overrides,
  };
}

function ready(overrides: Partial<GeneratedReport> = {}, recheckedPhone: string | null = '+201001234567'): ReportSessionState {
  return reportReducer(
    reportReducer(emptySession, { type: 'GENERATE_START', studentId: 'student-1', courseIds: ['course-1'], reportType: 'WEEK', language: 'ar' }),
    { type: 'GENERATED', report: report(overrides), recheckedPhone },
  );
}

describe('temporary session lifecycle', () => {
  it('drops both recipient references after the last handoff and preserves the requested language', () => {
    const generating = reportReducer(emptySession, { type: 'GENERATE_START', studentId: 'student-1', courseIds: ['course-1'], reportType: 'WEEK', language: 'en' });
    const generated = reportReducer(generating, { type: 'GENERATED', report: report(), recheckedPhone: '+201001234567' });
    expect(generated.language).toBe('en');
    const done = reportReducer(generated, { type: 'PART_HANDED_OFF', index: 1 });
    expect(done.preparedPhone).toBeNull();
    expect(done.contactPhone).toBeNull();
    expect(holdsText(done)).toBe(false);
  });
  it('holds the prepared text and rechecked contact after generation', () => {
    const state = ready();
    expect(state.phase).toBe('READY');
    expect(state.parts[0]?.text).toBe('تقرير FAYQ');
    expect(state.preparedPhone).toBe('+201001234567');
    expect(state.contactPhone).toBe('+201001234567');
    expect(state.period?.timeZone).toBe('Africa/Cairo');
  });

  it('disposes each part at its own handoff and keeps the rest transient', () => {
    const state = ready(
      {
        reportType: 'FOUR_WEEKS',
        parts: [
          { index: 1, total: 4, text: 'الأسبوع 1' },
          { index: 2, total: 4, text: 'الأسبوع 2' },
          { index: 3, total: 4, text: 'الأسبوع 3' },
          { index: 4, total: 4, text: 'الأسبوع 4' },
        ],
      },
    );
    const after = reportReducer(state, { type: 'PART_HANDED_OFF', index: 2 });
    expect(after.parts.map(part => part.text)).toEqual(['الأسبوع 1', '', 'الأسبوع 3', 'الأسبوع 4']);
    expect(after.handedOff).toEqual([2]);
    // No part is silently dropped: the list length is unchanged.
    expect(after.parts).toHaveLength(4);
    expect(heldParts(after)).toEqual([1, 3, 4]);
    expect(remainingPartIndexes(after)).toEqual([1, 3, 4]);
  });

  it('ignores a repeated handoff of the same part', () => {
    const once = reportReducer(ready(), { type: 'PART_HANDED_OFF', index: 1 });
    const twice = reportReducer(once, { type: 'PART_HANDED_OFF', index: 1 });
    expect(twice.handedOff).toEqual([1]);
    expect(holdsText(twice)).toBe(false);
  });

  it('discards everything still held on DISPOSE', () => {
    const disposed = reportReducer(ready(), { type: 'DISPOSE' });
    expect(disposed).toEqual(emptySession);
    expect(holdsText(disposed)).toBe(false);
    expect(disposed.preparedPhone).toBeNull();
  });

  it('discards the previous report before a new generation starts', () => {
    const again = reportReducer(ready(), {
      type: 'GENERATE_START',
      studentId: 'student-2',
      courseIds: ['course-2'],
      reportType: 'TWO_WEEKS',
      language: 'en',
    });
    expect(again.parts).toEqual([]);
    expect(again.preparedPhone).toBeNull();
    expect(again.studentId).toBe('student-2');
    expect(again.phase).toBe('GENERATING');
  });

  it('keeps no text after a failed generation', () => {
    const failed = reportReducer(ready(), { type: 'GENERATE_FAILED', code: 'SERVICE_ERROR' });
    expect(failed.parts).toEqual([]);
    expect(failed.preparedPhone).toBeNull();
    expect(failed.error).toBe('SERVICE_ERROR');
  });

  it('holds no text and no number after an unverified contact', () => {
    const unverified = ready({}, null);
    expect(unverified.phase).toBe('READY');
    expect(unverified.contactPhone).toBeNull();
    // The handoff is refused because the recheck produced nothing usable.
    expect(unverified.preparedPhone).toBeNull();
  });

  it('destroys the session when the contact changed after preparation', () => {
    const changed = reportReducer(ready(), { type: 'CONTACT_CHANGED', phone: '+201119999999' });
    expect(changed.parts).toEqual([]);
    expect(changed.preparedPhone).toBeNull();
    expect(changed.error).toBe('CONTACT_CHANGED');
  });

  it('returns to READY when a blocking note is dismissed', () => {
    const blocked = reportReducer(ready(), { type: 'HANDOFF_BLOCKED', note: 'CONTACT_CHANGED' });
    expect(blocked.phase).toBe('HANDOFF_BLOCKED');
    const dismissed = reportReducer(blocked, { type: 'DISMISS_NOTE' });
    expect(dismissed.phase).toBe('READY');
    expect(dismissed.note).toBeNull();
  });
});

describe('selection identity', () => {
  it('treats the same courses in a different order as unchanged', () => {
    const state: ReportSessionState = { ...emptySession, studentId: 's', courseIds: ['a', 'b'] };
    expect(isSameSelection(state, { studentId: 's', courseIds: ['b', 'a'] })).toBe(true);
  });

  it('detects a changed student, an added course and a removed course', () => {
    const state: ReportSessionState = { ...emptySession, studentId: 's', courseIds: ['a'] };
    expect(isSameSelection(state, { studentId: 'other', courseIds: ['a'] })).toBe(false);
    expect(isSameSelection(state, { studentId: 's', courseIds: ['a', 'b'] })).toBe(false);
    expect(isSameSelection(state, { studentId: 's', courseIds: [] })).toBe(false);
  });
});

describe('expected part count', () => {
  it('trusts the server-declared total', () => {
    expect(expectedPartCount({ reportType: 'WEEK', parts: [{ index: 1, total: 3, text: 'x' }] })).toBe(3);
  });

  it('falls back to the weekly composition when the total is absent', () => {
    const cases: Array<[ReportType, number]> = [['WEEK', 1], ['TWO_WEEKS', 2], ['FOUR_WEEKS', 4]];
    for (const [type, weeks] of cases) {
      expect(expectedPartCount({ reportType: type, parts: [] })).toBe(weeks);
    }
  });
});
