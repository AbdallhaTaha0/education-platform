/**
 * M10 view-tracking validation (agent 1).
 *
 * Pure, exhaustively testable bounds. A counted view is reported playback
 * activity after 30 seconds of actual playing time in one logical session —
 * never proof of human attention and never fraud-proof.
 */

/** One count per session after this much actual playing time. Owner-approved. */
export const VIEW_THRESHOLD_MS = 30_000;
/** Upper bound for a single reported total; ~24h of playing time. */
export const MAX_PLAYED_MS = 86_400_000;
/** Bounded heartbeat payload: one integer total per request. */
export const MAX_HEARTBEAT_BYTES = 256;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function assertViewUuid(value: unknown): string {
  if (typeof value !== 'string' || !UUID_RE.test(value)) {
    throw new Error('VALIDATION_ERROR');
  }
  return value;
}

/**
 * Normalize a reported total of actual playing time for one session.
 * Seeking/buffering must already be excluded client-side; the server only
 * enforces a finite, non-negative, bounded integer total. Monotonic
 * accumulation (GREATEST) in the write path makes duplicates converge.
 */
export function normalizePlayedMs(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > MAX_PLAYED_MS) {
    throw new Error('VALIDATION_ERROR');
  }
  if (!Number.isInteger(value)) {
    // Truncate sub-millisecond fractions rather than rejecting telemetry.
    value = Math.trunc(value);
  }
  const ms = value as number;
  if (ms < 0 || ms > MAX_PLAYED_MS) {
    throw new Error('VALIDATION_ERROR');
  }
  return ms;
}

/** True when the accumulated total meets the owner-approved threshold. */
export function meetsThreshold(playedMilliseconds: number): boolean {
  return playedMilliseconds >= VIEW_THRESHOLD_MS;
}
