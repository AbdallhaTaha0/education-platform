/**
 * M10 view-tracking validation unit tests (agent 1).
 *
 * Pure bounds only. Counting, idempotency and entitlement are covered by the
 * Docker integration suite against real PostgreSQL/Redis.
 */
import { describe, expect, it } from 'vitest';
import {
  MAX_PLAYED_MS,
  normalizePlayedMs,
  meetsThreshold,
  VIEW_THRESHOLD_MS,
  assertViewUuid,
} from '../../src/modules/learning/tracking/validation.js';

describe('view threshold contract', () => {
  it('keeps the owner-approved 30s threshold', () => {
    expect(VIEW_THRESHOLD_MS).toBe(30_000);
  });

  it('counts at 30s and not at 29s; 90s adds no second count by itself', () => {
    expect(meetsThreshold(29_000)).toBe(false);
    expect(meetsThreshold(30_000)).toBe(true);
    // Continued playback is still "meets threshold" for the SAME row; the
    // service guarantees it transitions countedAt at most once per row.
    expect(meetsThreshold(90_000)).toBe(true);
  });
});

describe('played-ms validation', () => {
  it('accepts zero and the threshold', () => {
    expect(normalizePlayedMs(0)).toBe(0);
    expect(normalizePlayedMs(30_000)).toBe(30_000);
  });

  it('rejects negative, non-finite and over-bound totals', () => {
    expect(() => normalizePlayedMs(-1)).toThrow();
    expect(() => normalizePlayedMs(-0.5)).toThrow();
    expect(() => normalizePlayedMs(Number.NaN)).toThrow();
    expect(() => normalizePlayedMs(Number.POSITIVE_INFINITY)).toThrow();
    expect(() => normalizePlayedMs(MAX_PLAYED_MS + 1)).toThrow();
    expect(() => normalizePlayedMs(MAX_PLAYED_MS + 0.5)).toThrow();
    expect(() => normalizePlayedMs('30000')).toThrow();
  });

  it('truncates sub-millisecond fractions instead of rejecting telemetry', () => {
    expect(normalizePlayedMs(29_999.7)).toBe(29_999);
  });
});

describe('view id validation', () => {
  it('accepts UUIDs and rejects anything else', () => {
    const id = 'f6c0ffee-0000-4000-8000-000000000000';
    expect(assertViewUuid(id)).toBe(id);
    expect(() => assertViewUuid('not-a-uuid')).toThrow();
    expect(() => assertViewUuid('')).toThrow();
    expect(() => assertViewUuid(undefined)).toThrow();
  });
});
