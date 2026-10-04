import { describe, expect, it } from 'vitest';
import { formatDuration, formatDurationTotal, sumDurations } from './duration';

describe('course-learning duration display', () => {
  it('formats subminute values as m:ss', () => {
    expect(formatDuration(5)).toBe('0:05');
    expect(formatDuration(0)).toBe('0:00');
  });

  it('formats minutes and hour-long values', () => {
    expect(formatDuration(65)).toBe('1:05');
    expect(formatDuration(3600)).toBe('1:00:00');
    expect(formatDuration(3725)).toBe('1:02:05');
  });

  it('rounds fractional seconds consistently', () => {
    expect(formatDuration(59.4)).toBe('0:59');
    expect(formatDuration(59.5)).toBe('1:00');
    expect(formatDuration(3599.5)).toBe('1:00:00');
  });

  it('treats missing/invalid durations as unknown', () => {
    expect(formatDuration(null)).toBeNull();
    expect(formatDuration(undefined)).toBeNull();
    expect(formatDuration(NaN)).toBeNull();
    expect(formatDuration(-1)).toBeNull();
    expect(formatDuration(Infinity)).toBeNull();
  });

  it('marks totals complete only when every duration is known', () => {
    const complete = sumDurations([60, 120]);
    expect(complete).toEqual({ totalSeconds: 180, complete: true, unknownCount: 0 });
    expect(formatDurationTotal(complete, 'en')).toBe('3:00');

    const partial = sumDurations([60, null]);
    expect(partial.complete).toBe(false);
    expect(partial.totalSeconds).toBe(60);
    expect(formatDurationTotal(partial, 'en')).toBe('1:00+ (partial)');
    expect(formatDurationTotal(partial, 'ar')).toBe('1:00+ (جزئي)');

    const unknown = sumDurations([null, undefined]);
    expect(unknown.totalSeconds).toBeNull();
    expect(formatDurationTotal(unknown, 'en')).toBe('Duration unknown');
    expect(formatDurationTotal(unknown, 'ar')).toBe('المدة غير معروفة');
  });

  it('handles legacy empty payloads without guessing', () => {
    const empty = sumDurations([]);
    expect(empty.totalSeconds).toBeNull();
    expect(empty.complete).toBe(false);
  });
});
