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
 * of the dependency masked identity. Use one randomly moving label (owner clarification, 2026-10-07).
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

/** Owner-selected single label, relocated every eight seconds in the video frame. */
export const WATERMARK_MOVE_INTERVAL_MS = 8_000;
export const MAX_WATERMARK_LABELS = 1;

export function isWatermarkVisible(watermark: PlaybackGrant['watermark']): boolean {
  return watermark !== null && typeof watermark.maskedIdentity === 'string' && watermark.maskedIdentity.trim() !== '';
}

/** Dependency positions no longer duplicate the visible account label. */
export function watermarkLabels(watermark: PlaybackGrant['watermark']): WatermarkLabel[] {
  return isWatermarkVisible(watermark) ? [{ key: 'single', x: 50, y: 50 }] : [];
}

export interface WatermarkPosition { x: number; y: number }
/** Pixel bounds use the measured available overlay area and label dimensions. */
export function randomWatermarkPosition(
  width: number, height: number, labelWidth: number, labelHeight: number,
  previous?: WatermarkPosition, random: () => number = Math.random,
): WatermarkPosition {
  const bound = (value: number) => Number.isFinite(value) ? Math.max(0, value) : 0;
  const maxX = Math.max(0, bound(width) - bound(labelWidth));
  const maxY = Math.max(0, bound(height) - bound(labelHeight));
  const fraction = () => { const value = random(); return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0.5; };
  let x = fraction() * maxX;
  let y = fraction() * maxY;
  // Prevent a random draw from repeatedly looking fixed. Resize still clamps.
  if (previous && Math.abs(x - previous.x) < 16 && Math.abs(y - previous.y) < 16) {
    x = previous.x < maxX / 2 ? maxX : 0;
    y = previous.y < maxY / 2 ? maxY : 0;
  }
  return { x, y };
}
/** The single visible text, or `null` when nothing should be drawn. */
export function watermarkText(watermark: PlaybackGrant['watermark'], phone?: string): string | null {
  if (!isWatermarkVisible(watermark) || watermark === null) return null;
  return phone && /^(?:\+[1-9]\d{7,14}|01[0125]\d{8})$/.test(phone) ? phone : watermark.maskedIdentity;
}
