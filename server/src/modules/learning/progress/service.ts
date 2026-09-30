/**
 * Durable progress writes (M5).
 *
 * Properties that matter:
 *   - ownership: the row's student must be the authenticated caller;
 *   - idempotency: a repeated write converges on the same row (unique key);
 *   - monotonic completion: a completed lesson never becomes un-completed, and
 *     the stored position never moves backwards for the same lesson;
 *   - concurrency safety: two simultaneous *first* writes for the same
 *     student/lesson must not surface a unique-constraint failure. The row is
 *     created with a single atomic upsert whose update clause itself enforces
 *     the monotonic rules, so a losing racer re-reads the winner's row instead
 *     of failing.
 */
import { randomUUID } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import { LearningError } from '../errors.js';
import type { LearningBinding, ProgressAggregate } from '../types.js';
import { aggregateProgress, normalizeProgress } from './validation.js';

export interface ProgressWriteInput {
  binding: LearningBinding;
  positionSeconds: number;
  durationSeconds: number | null;
  completed: boolean;
  nowMs: number;
}

export interface ProgressWriteResult {
  lessonId: string;
  positionSeconds: number;
  durationSeconds: number | null;
  completed: boolean;
  updated: boolean;
}

export async function recordProgress(
  prisma: PrismaClient,
  input: ProgressWriteInput,
): Promise<ProgressWriteResult> {
  let normalized;
  try {
    normalized = normalizeProgress(input.positionSeconds, input.durationSeconds, input.completed);
  } catch {
    throw new LearningError('VALIDATION_ERROR');
  }

  const now = new Date(input.nowMs);
  const completedAt = normalized.completed ? now : null;

  // One atomic statement. The monotonic rules live in the ON CONFLICT clause, so
  // two simultaneous first writes converge on a single row: the loser updates
  // the winner's row instead of failing on the unique key, and it can never rewind
  // the position, lose a completion, or replace a known duration with null.
  const rows = await prisma.$queryRaw<ProgressRow[]>`
    INSERT INTO "LessonProgress"
      ("id", "studentId", "lessonId", "courseId", "positionSeconds", "durationSeconds",
       "completedAt", "lastAccessedAt", "createdAt", "updatedAt")
    VALUES (${randomUUID()}, ${input.binding.studentId}, ${input.binding.lessonId},
            ${input.binding.courseId}, ${normalized.positionSeconds}, ${normalized.durationSeconds},
            ${completedAt}, ${now}, ${now}, ${now})
    ON CONFLICT ("studentId", "lessonId") DO UPDATE SET
      "positionSeconds" = GREATEST("LessonProgress"."positionSeconds", EXCLUDED."positionSeconds"),
      "durationSeconds"  = COALESCE(EXCLUDED."durationSeconds", "LessonProgress"."durationSeconds"),
      "completedAt"      = COALESCE("LessonProgress"."completedAt", EXCLUDED."completedAt"),
      "courseId"         = EXCLUDED."courseId",
      "lastAccessedAt"   = GREATEST("LessonProgress"."lastAccessedAt", EXCLUDED."lastAccessedAt"),
      "updatedAt"        = EXCLUDED."updatedAt"
    RETURNING "lessonId", "positionSeconds", "durationSeconds", "completedAt"
  `;

  const row = rows[0];
  if (row === undefined) throw new LearningError('VALIDATION_ERROR');
  return {
    lessonId: row.lessonId,
    positionSeconds: row.positionSeconds,
    durationSeconds: row.durationSeconds,
    completed: row.completedAt !== null,
    updated: true,
  };
}

interface ProgressRow {
  lessonId: string;
  positionSeconds: number;
  durationSeconds: number | null;
  completedAt: Date | null;
}

export async function readProgress(
  prisma: PrismaClient,
  studentId: string,
  courseId: string,
): Promise<{
  lessons: Array<{ lessonId: string; positionSeconds: number; completed: boolean }>;
  aggregate: ProgressAggregate;
}> {
  const lessons = await prisma.lessonProgress.findMany({
    where: { studentId, courseId },
    select: { lessonId: true, positionSeconds: true, completedAt: true, lastAccessedAt: true },
    orderBy: { lastAccessedAt: 'desc' },
  });
  const totalLessons = await prisma.lesson.count({ where: { section: { courseId } } });
  const completedIds = lessons.filter((l) => l.completedAt !== null).map((l) => l.lessonId);
  const last = lessons.find((l) => l.completedAt === null) ?? lessons[0] ?? null;
  return {
    lessons: lessons.map((l) => ({
      lessonId: l.lessonId,
      positionSeconds: l.positionSeconds,
      completed: l.completedAt !== null,
    })),
    aggregate: aggregateProgress({
      totalLessons,
      completedLessonIds: completedIds,
      lastAccessedLessonId: last?.lessonId ?? null,
    }),
  };
}
