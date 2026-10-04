/** Actual processed-video duration formatting (course-learning UI).
 *
 * Displays only the real nullable `durationSeconds` from the authorized
 * outline/materials payload. Never guesses from titles, counts, player
 * progress or fixtures. Legacy payloads with a missing duration stay unknown.
 */

/** A duration is known only when it is a finite nonnegative number. */
export function isKnownDuration(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

/**
 * Format a known duration as m:ss or h:mm:ss, rounded to the nearest second.
 * Returns null for unknown values so callers render the unknown label.
 */
export function formatDuration(durationSeconds: number | null | undefined): string | null {
  if (!isKnownDuration(durationSeconds)) return null;
  const total = Math.round(durationSeconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const mm = String(minutes).padStart(hours > 0 ? 2 : 1, '0');
  const ss = String(seconds).padStart(2, '0');
  if (hours > 0) return `${hours}:${mm}:${ss}`;
  return `${minutes}:${ss}`;
}

export interface DurationTotal {
  /** Sum of known durations, rounded consistently (sum of rounded lessons). */
  totalSeconds: number | null;
  /** True only when every lesson duration is known. */
  complete: boolean;
  /** Number of lessons with unknown duration. */
  unknownCount: number;
}

/**
 * Compute a section/course total. The total is `complete` only when every
 * duration is known; otherwise it is a partial sum and callers must label it
 * as partial. Unknown lessons are never guessed.
 */
export function sumDurations(
  durations: Array<number | null | undefined>,
): DurationTotal {
  let sum = 0;
  let unknownCount = 0;
  for (const value of durations) {
    if (isKnownDuration(value)) sum += Math.round(value);
    else unknownCount += 1;
  }
  if (durations.length === 0) return { totalSeconds: null, complete: false, unknownCount: 0 };
  if (unknownCount === durations.length) return { totalSeconds: null, complete: false, unknownCount };
  if (unknownCount > 0) return { totalSeconds: sum, complete: false, unknownCount };
  return { totalSeconds: sum, complete: true, unknownCount: 0 };
}

/** Render a total with its complete/partial distinction for both languages. */
export function formatDurationTotal(
  total: DurationTotal,
  lang: 'ar' | 'en',
): string {
  if (total.totalSeconds === null) {
    return lang === 'ar' ? 'المدة غير معروفة' : 'Duration unknown';
  }
  const formatted = formatDuration(total.totalSeconds) ?? (lang === 'ar' ? 'المدة غير معروفة' : 'Duration unknown');
  if (total.complete) return formatted;
  return lang === 'ar'
    ? `${formatted}+ (جزئي)`
    : `${formatted}+ (partial)`;
}
