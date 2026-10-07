/**
 * Watermark presentation rules (M5, Gate F).
 *
 * The important behaviour is not that a string is drawn but WHEN it is drawn:
 * a watermark that disappears is not a watermark, and an invented one would
 * misattribute a session. These cases cover both directions.
 */
import { describe, expect, it } from 'vitest';
import {
  MAX_WATERMARK_LABELS,
  randomWatermarkPosition,
  isWatermarkVisible,
  watermarkLabels,
  watermarkText,
} from './watermark';
import type { PlaybackGrant } from '../types/models';

type Watermark = NonNullable<PlaybackGrant['watermark']>;

function watermark(overrides: Partial<Watermark> = {}): PlaybackGrant['watermark'] {
  return {
    type: 'VISIBLE',
    maskedIdentity: 'fixt***@example',
    positions: [{ x: 25, y: 30 }],
    expiresAt: null,
    ...overrides,
  };
}

describe('watermark visibility', () => {
  it('renders when the dependency supplies a masked identity', () => {
    expect(isWatermarkVisible(watermark())).toBe(true);
    expect(watermarkText(watermark())).toBe('fixt***@example');
  });

  it('draws nothing when no policy was supplied', () => {
    expect(isWatermarkVisible(null)).toBe(false);
    expect(watermarkLabels(null)).toEqual([]);
    expect(watermarkText(null)).toBeNull();
  });

  it('draws nothing for an empty masked identity rather than inventing one', () => {
    const empty = watermark({ maskedIdentity: '' });
    expect(isWatermarkVisible(empty)).toBe(false);
    expect(watermarkLabels(empty)).toEqual([]);
    expect(watermarkText(empty)).toBeNull();
  });

  it('shows only the masked identity, never extra personal fields', () => {
    // The model carries no email, phone or name: there is nothing else to leak.
    const text = watermarkText(watermark());
    expect(text).not.toMatch(/@example\.(com|test)$/);
    expect(text).toContain('***');
  });
});

describe('single random watermark', () => {
  it('renders one label regardless of dependency positions', () => {
    expect(watermarkLabels(watermark({ positions: [{ x: 20, y: 40 }, { x: 80, y: 60 }] }))).toHaveLength(1);
    expect(watermarkLabels(watermark({ positions: [] }))).toHaveLength(1);
    expect(watermarkLabels(watermark({ positions: [null as never] }))).toHaveLength(1);
    expect(MAX_WATERMARK_LABELS).toBe(1);
  });
  it('keeps the entire measured label within the available video area', () => {
    expect(randomWatermarkPosition(300, 100, 100, 20, undefined, () => 1)).toEqual({ x: 200, y: 80 });
    expect(randomWatermarkPosition(300, 100, 100, 20, undefined, () => 0)).toEqual({ x: 0, y: 0 });
  });
  it('moves again even when the random sample would repeat the last position', () => {
    const previous = { x: 100, y: 40 };
    const next = randomWatermarkPosition(300, 100, 100, 20, previous, () => 0.5);
    expect(next).not.toEqual(previous);
    expect(next.x).toBeLessThanOrEqual(200);
    expect(next.y).toBeLessThanOrEqual(80);
  });
  it('clamps safely on small frames, resize, and invalid measurements/random values', () => {
    expect(randomWatermarkPosition(60, 10, 100, 20)).toEqual({ x: 0, y: 0 });
    expect(randomWatermarkPosition(Number.NaN, -10, 100, 20)).toEqual({ x: 0, y: 0 });
    expect(randomWatermarkPosition(300, 100, 100, 20, { x: 999, y: 999 }, () => Number.NaN)).toEqual({ x: 100, y: 40 });
  });
});
describe('owner-selected phone watermark', () => {
  it('replaces dependency identity with the authenticated E.164 phone', () => {
    expect(watermarkText(watermark(), '+201005344368')).toBe('+201005344368');
    expect(watermarkText(watermark(), '01005344368')).toBe('01005344368');
  });
  it('preserves fallback and absent-policy behavior', () => {
    const policy = watermark();
    expect(watermarkText(policy, 'not a phone')).toBe(policy!.maskedIdentity);
    expect(watermarkText(policy)).toBe(policy!.maskedIdentity);
    expect(watermarkText(null, '+201005344368')).toBeNull();
  });
});
