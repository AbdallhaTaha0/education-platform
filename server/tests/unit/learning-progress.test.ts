/**
 * Unit tests for M5 progress validation, aggregation and expiry backoff policy.
 *
 * The player state machine and the transient credential boundary are client
 * code and are covered by the client unit suite
 * (client/src/features/learning/player/*.test.ts).
 */
import { describe, expect, it } from 'vitest';
import {
  aggregateProgress,
  MAX_DURATION_SECONDS,
  MAX_POSITION_SECONDS,
  normalizeProgress,
} from '../../src/modules/learning/progress/validation.js';
import {
  backoffMs,
  MAX_TERMINATION_ATTEMPTS,
} from '../../src/modules/learning/expiry/reconciler.js';

describe('progress validation', () => {
  it('accepts a finite non-negative position', () => {
    expect(normalizeProgress(12.5, 60, false).positionSeconds).toBe(12.5);
  });

  it('accepts a null duration', () => {
    expect(normalizeProgress(5, null, false).durationSeconds).toBeNull();
  });

  it('rejects negative, non-finite and out-of-range values', () => {
    expect(() => normalizeProgress(-1, 10, false)).toThrow();
    expect(() => normalizeProgress(Number.NaN, 10, false)).toThrow();
    expect(() => normalizeProgress(Number.POSITIVE_INFINITY, 10, false)).toThrow();
    expect(() => normalizeProgress(MAX_POSITION_SECONDS + 1, 10, false)).toThrow();
    expect(() => normalizeProgress(1, MAX_DURATION_SECONDS + 1, false)).toThrow();
  });

  it('rejects a non-boolean completed flag', () => {
    expect(() => normalizeProgress(1, 10, 'yes')).toThrow();
  });

  it('marks completion on an explicit ended event', () => {
    expect(normalizeProgress(1, 600, true).completed).toBe(true);
  });

  it('marks completion when the position reaches the completion ratio', () => {
    expect(normalizeProgress(599, 600, false).completed).toBe(true);
    expect(normalizeProgress(100, 600, false).completed).toBe(false);
  });

  it('does not invent completion from a zero-length media', () => {
    expect(normalizeProgress(0, 0, false).completed).toBe(false);
  });
});

describe('aggregate progress', () => {
  it('derives a percentage over the current structure', () => {
    expect(
      aggregateProgress({
        totalLessons: 4,
        completedLessonIds: ['a', 'b'],
        lastAccessedLessonId: 'c',
      }),
    ).toEqual({
      totalLessons: 4,
      completedLessons: 2,
      percentComplete: 50,
      lastLessonId: 'c',
    });
  });

  it('reports zero for an empty course instead of dividing by zero', () => {
    expect(
      aggregateProgress({ totalLessons: 0, completedLessonIds: [], lastAccessedLessonId: null }),
    ).toEqual({
      totalLessons: 0,
      completedLessons: 0,
      percentComplete: 0,
      lastLessonId: null,
    });
  });

  it('caps completed lessons at the structure size and de-duplicates ids', () => {
    const out = aggregateProgress({
      totalLessons: 2,
      completedLessonIds: ['a', 'a', 'b', 'c'],
      lastAccessedLessonId: null,
    });
    expect(out.completedLessons).toBe(2);
    expect(out.percentComplete).toBe(100);
  });
});

describe('expiry retry backoff', () => {
  it('grows exponentially and stays bounded', () => {
    expect(backoffMs(1)).toBe(5_000);
    expect(backoffMs(2)).toBe(10_000);
    expect(backoffMs(3)).toBe(20_000);
    expect(backoffMs(50)).toBeLessThanOrEqual(15 * 60_000);
  });

  it('adds bounded jitter without exceeding the ceiling', () => {
    expect(backoffMs(1, 250)).toBe(5_250);
    expect(backoffMs(50, 10_000_000)).toBeLessThanOrEqual(15 * 60_000);
  });

  it('has a finite attempt ceiling so retries stop', () => {
    expect(MAX_TERMINATION_ATTEMPTS).toBeGreaterThan(0);
    expect(MAX_TERMINATION_ATTEMPTS).toBeLessThanOrEqual(10);
  });
});
