import type { PrismaClient } from '@prisma/client';
import { ApiError } from '../identity/errors.js';
import { lockCourseRow } from './locks.js';
import type { TxClient } from './types.js';
import { assertUuid } from './validation.js';

/**
 * Canonical course-scoped mutation sequence. Every course mutation runs
 * inside a short transaction that FIRST acquires the owning course row lock,
 * THEN reads fresh state, validates lifecycle/deletion invariants against
 * that locked state, and finally mutates + audits atomically.
 *
 * Pure input-shape validation (unknown fields, string shapes, price bounds)
 * stays outside; anything that depends on database state happens under lock.
 */
export async function withCourseLock<T>(prisma: PrismaClient, courseId: string, fn: (tx: TxClient) => Promise<T>): Promise<T> {
  assertUuid(courseId, 'courseId');
  return prisma.$transaction(async (tx) => {
    await lockCourseRow(tx, courseId);
    return fn(tx);
  });
}

/** Lookup-only resolvers (no state decisions) to find the owning course before locking. */
export async function courseIdForSection(prisma: PrismaClient, sectionId: string): Promise<string> {
  assertUuid(sectionId, 'sectionId');
  const section = await prisma.courseSection.findUnique({ where: { id: sectionId }, select: { courseId: true } });
  if (section === null) throw new ApiError(404, 'NOT_FOUND', 'Section not found.');
  return section.courseId;
}

export async function courseIdForLesson(prisma: PrismaClient, lessonId: string): Promise<string> {
  assertUuid(lessonId, 'lessonId');
  const lesson = await prisma.lesson.findUnique({ where: { id: lessonId }, select: { section: { select: { courseId: true } } } });
  if (lesson === null) throw new ApiError(404, 'NOT_FOUND', 'Lesson not found.');
  return lesson.section.courseId;
}

export async function courseIdForPlan(prisma: PrismaClient, planId: string): Promise<string> {
  assertUuid(planId, 'planId');
  const plan = await prisma.subscriptionPlan.findUnique({ where: { id: planId }, select: { courseId: true } });
  if (plan === null) throw new ApiError(404, 'NOT_FOUND', 'Plan not found.');
  return plan.courseId;
}
