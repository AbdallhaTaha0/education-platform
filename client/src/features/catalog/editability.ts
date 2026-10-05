import type { AdminCourseSummary } from './types/models';

/** Mirrors the existing backend structural guard; never grants permission. */
export function structuralBlockCode(course: Pick<AdminCourseSummary, 'status' | 'deletionRequestedAt'>): string | null {
  if (course.deletionRequestedAt !== null) return 'DELETION_PENDING';
  if (course.status === 'ARCHIVED') return 'COURSE_ARCHIVED';
  return course.status === 'DRAFT' ? null : 'COURSE_NOT_DRAFT';
}

export function lessonAdditionBlockCode(course: Pick<AdminCourseSummary, 'status' | 'deletionRequestedAt'>): string | null {
  return course.status === 'PUBLISHED' && course.deletionRequestedAt === null ? null : structuralBlockCode(course);
}
