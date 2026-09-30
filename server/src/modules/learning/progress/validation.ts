/**
 * Progress validation (M5).
 *
 * Pure, exhaustively testable bounds. Progress is recorded for convenience and
 * never authorizes anything: the write path still re-checks entitlement, and
 * the read path is behind the same guard as the outline.
 */

/** Roughly 27 hours of media; anything larger is a malformed client value. */
export const MAX_POSITION_SECONDS = 100_000;
export const MAX_DURATION_SECONDS = 100_000;

/** Below this fraction of the duration a lesson counts as watched. */
export const COMPLETION_RATIO = 0.9;

export interface NormalizedProgress {
  positionSeconds: number;
  durationSeconds: number | null;
  completed: boolean;
}

function finiteNonNegative(value: unknown, max: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > max) {
    throw new Error('VALIDATION_ERROR');
  }
  return value;
}

/**
 * Normalize a player progress event.
 * `completed` is only honoured from an explicit genuine ended event; a position
 * that merely reaches the end of the media may also mark completion.
 */
export function normalizeProgress(
  rawPosition: unknown,
  rawDuration: unknown,
  rawCompleted: unknown,
): NormalizedProgress {
  const positionSeconds = finiteNonNegative(rawPosition, MAX_POSITION_SECONDS);
  const durationSeconds =
    rawDuration === undefined || rawDuration === null
      ? null
      : finiteNonNegative(rawDuration, MAX_DURATION_SECONDS);
  const requestedComplete = rawCompleted === true;
  if (rawCompleted !== undefined && typeof rawCompleted !== 'boolean') {
    throw new Error('VALIDATION_ERROR');
  }
  const reachedEnd =
    durationSeconds !== null && durationSeconds > 0 && positionSeconds >= durationSeconds * COMPLETION_RATIO;
  return {
    positionSeconds,
    durationSeconds,
    completed: requestedComplete || reachedEnd,
  };
}

export interface AggregateInput {
  totalLessons: number;
  completedLessonIds: readonly string[];
  lastAccessedLessonId: string | null;
}

/** Course progress derived from completed lessons over the current structure. */
export function aggregateProgress(input: AggregateInput): {
  totalLessons: number;
  completedLessons: number;
  percentComplete: number;
  lastLessonId: string | null;
} {
  const total = Math.max(0, input.totalLessons);
  const completed = new Set(input.completedLessonIds).size;
  const percent = total === 0 ? 0 : Math.round((Math.min(completed, total) / total) * 100);
  return {
    totalLessons: total,
    completedLessons: Math.min(completed, total),
    percentComplete: percent,
    lastLessonId: input.lastAccessedLessonId,
  };
}
