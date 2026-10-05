import type { LessonProgressState } from '../types/models';

/** Older responses must never undo a later completion or saved position. */
export function mergeProgress(previous: LessonProgressState | undefined, next: LessonProgressState): LessonProgressState {
  if (!previous || previous.lessonId !== next.lessonId) return next;
  return {
    ...next,
    completed: previous.completed || next.completed,
    positionSeconds: Math.max(previous.positionSeconds, next.positionSeconds),
    durationSeconds: next.durationSeconds ?? previous.durationSeconds,
  };
}
