/**
 * Watermark presentation rules for protected playback (M5, Gate F).
 *
 * Kept as pure functions so the rules are unit-testable without a DOM, and so
 * PlayerChrome only has to render what this module decides.
 *
 * Security boundary, stated plainly: this is a VISIBLE label. It raises the
 * cost of casual re-sharing and identifies a session to whoever can see the
 * screen. It is NOT a forensic control — a DOM/CSS overlay cannot survive screen
 * capture, a camera, or a re-encode, and it carries no trace code or signature
 * (those are redacted server-side and never reach the browser). Forensically
 * attributable watermarking is the external DRM's responsibility (D07).
 *
 * Owner instruction (2026-10-05): show the authenticated student phone instead
 * of the dependency masked identity. Keep dependency placement policy unchanged.
 * Missing/invalid account data falls back to the dependency identity.
 */
import type { PlaybackGrant } from '../types/models';

export type Watermark = NonNullable<PlaybackGrant['watermark']>;

export interface WatermarkLabel {
  /** Stable per-position key; the identity itself is not part of the key. */
  key: string;
  x: number;
  y: number;
}

/** Upper bound on labels, so a dependency response cannot flood the player. */
export const MAX_WATERMARK_LABELS = 12;

/** The single centre position used when the dependency supplies none. */
const CENTRE: WatermarkLabel = { key: '0-50-50', x: 50, y: 50 };

/** A position is a percentage; anything unusable falls back to the centre. */
function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 50;
  return Math.min(100, Math.max(0, value));
}

/**
 * Whether a watermark is renderable at all. An absent policy or an empty
 * masked identity means nothing is drawn — the player must not invent one,
 * because an invented label would misattribute the session.
 */
export function isWatermarkVisible(watermark: PlaybackGrant['watermark']): boolean {
  return (
    watermark !== null &&
    typeof watermark.maskedIdentity === 'string' &&
    watermark.maskedIdentity !== ''
  );
}

/**
 * Resolve the label set. Empty, malformed or out-of-range positions degrade to
 * one centred label rather than disappearing, because a watermark that vanishes
 * is not a watermark. Positions are de-duplicated so a repeated coordinate
 * cannot stack identical labels on top of each other.
 */
export function watermarkLabels(watermark: PlaybackGrant['watermark']): WatermarkLabel[] {
  if (!isWatermarkVisible(watermark) || watermark === null) return [];
  const raw = Array.isArray(watermark.positions) ? watermark.positions : [];
  const seen = new Set<string>();
  const labels: WatermarkLabel[] = [];
  for (const position of raw.slice(0, MAX_WATERMARK_LABELS)) {
    if (position === null || typeof position !== 'object') continue;
    const x = clampPercent(position.x);
    const y = clampPercent(position.y);
    const key = `${labels.length}-${x}-${y}`;
    if (seen.has(`${x}-${y}`)) continue;
    seen.add(`${x}-${y}`);
    labels.push({ key, x, y });
  }
  return labels.length > 0 ? labels : [CENTRE];
}

/** The single visible text, or `null` when nothing should be drawn. */
export function watermarkText(watermark: PlaybackGrant['watermark'], phone?: string): string | null {
  if (!isWatermarkVisible(watermark) || watermark === null) return null;
  return phone && /^(?:\+[1-9]\d{7,14}|01[0125]\d{8})$/.test(phone) ? phone : watermark.maskedIdentity;
}
