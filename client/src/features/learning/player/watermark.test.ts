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

describe('watermark positions', () => {
  it('keeps the supplied positions', () => {
    const labels = watermarkLabels(
      watermark({
        positions: [
          { x: 20, y: 40 },
          { x: 80, y: 60 },
        ],
      }),
    );
    expect(labels).toHaveLength(2);
    expect(labels[0]).toMatchObject({ x: 20, y: 40 });
    expect(labels[1]).toMatchObject({ x: 80, y: 60 });
  });

  it('falls back to one centred label when the dependency supplies none', () => {
    const labels = watermarkLabels(watermark({ positions: [] }));
    expect(labels).toEqual([{ key: '0-50-50', x: 50, y: 50 }]);
  });

  it('clamps out-of-range and non-finite positions instead of hiding the label', () => {
    const labels = watermarkLabels(
      watermark({
        positions: [
          { x: -25, y: 900 },
          { x: Number.NaN, y: Number.POSITIVE_INFINITY },
        ],
      }),
    );
    expect(labels).toHaveLength(2);
    expect(labels[0]).toMatchObject({ x: 0, y: 100 });
    expect(labels[1]).toMatchObject({ x: 50, y: 50 });
  });

  it('drops duplicate coordinates so identical labels cannot stack', () => {
    const labels = watermarkLabels(
      watermark({
        positions: [
          { x: 30, y: 30 },
          { x: 30, y: 30 },
          { x: 70, y: 70 },
        ],
      }),
    );
    expect(labels).toHaveLength(2);
  });

  it('bounds how many labels a dependency response can add', () => {
    const many = Array.from({ length: MAX_WATERMARK_LABELS * 3 }, (_, i) => ({
      x: i % 100,
      y: (i * 7) % 100,
    }));
    expect(watermarkLabels(watermark({ positions: many })).length).toBeLessThanOrEqual(
      MAX_WATERMARK_LABELS,
    );
  });

  it('ignores malformed entries but still draws a label', () => {
    const labels = watermarkLabels(
      watermark({ positions: [null as never, 'nope' as never, { x: 10, y: 10 }] }),
    );
    expect(labels).toHaveLength(1);
    expect(labels[0]).toMatchObject({ x: 10, y: 10 });
  });

  it('gives every label a distinct, identity-free key', () => {
    const labels = watermarkLabels(
      watermark({
        positions: [
          { x: 10, y: 10 },
          { x: 20, y: 20 },
        ],
      }),
    );
    expect(new Set(labels.map((l) => l.key)).size).toBe(labels.length);
    for (const label of labels) expect(label.key).not.toContain('fixt');
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
