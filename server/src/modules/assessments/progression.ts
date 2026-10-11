import type { PrismaClient } from '@prisma/client';
import { ApiError } from '../identity/errors.js';
import { codingIdeEnabled, choiceOnly } from './availability.js';

export async function lessonLocks(db: PrismaClient, studentId: string, courseId: string): Promise<Map<string, string[]>> {
  const [sections, passed, preserved] = await Promise.all([
    db.courseSection.findMany({ where: { courseId }, orderBy: { position: 'asc' }, include: { lessons: { orderBy: { position: 'asc' }, select: { id: true, assessments: { where: { status: 'PUBLISHED', required: true }, select: { id: true, version: true } } } } } }),
    db.assessmentPass.findMany({ where: { studentId, assessment: { lesson: { section: { courseId } } } }, select: { assessmentId: true } }),
    db.preservedLessonUnlock.findMany({ where: { studentId, lesson: { section: { courseId } } }, select: { lessonId: true } }),
  ]);
  const lessons = sections.flatMap((s) => s.lessons);
  const requirements = lessons.flatMap((l) => l.assessments);
  const enabled = codingIdeEnabled();
  const versions = !enabled && requirements.length ? await db.assessmentVersion.findMany({ where: { OR: requirements.map((a) => ({ assessmentId: a.id, version: a.version })) }, select: { assessmentId: true, content: true } }) : [];
  const available = new Set(versions.filter((v) => choiceOnly(v.content)).map((v) => v.assessmentId));
  const earned = new Set(passed.map((p) => p.assessmentId));
  const existing = new Set(preserved.map((p) => p.lessonId));
  // Requirements before the furthest pre-rollout reached lesson must not
  // retroactively trap a returning learner's future progression.
  const furthest = lessons.reduce((index, l, i) => existing.has(l.id) ? i : index, -1);
  const pending: string[] = []; const locks = new Map<string, string[]>();
  lessons.forEach((l, i) => {
    locks.set(l.id, existing.has(l.id) ? [] : [...pending]);
    if (i >= furthest) pending.push(...l.assessments.filter((a) => !earned.has(a.id) && (enabled || available.has(a.id))).map((a) => a.id));
  });
  return locks;
}
export async function assertLessonUnlocked(db: PrismaClient, studentId: string, courseId: string, lessonId: string): Promise<void> {
  const locks = await lessonLocks(db, studentId, courseId);
  if (!locks.has(lessonId)) throw new ApiError(404, 'LESSON_NOT_FOUND', 'Lesson not found.');
  if (locks.get(lessonId)!.length) throw new ApiError(403, 'ASSESSMENTS_REQUIRED', 'Pass the required assessments before continuing.');
}
