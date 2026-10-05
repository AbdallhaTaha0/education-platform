import { ApiError } from '../../identity/errors.js';
import { assertValidTransition } from '../validation.js';
import type { CourseHierarchy } from '../types.js';

export type LifecycleTarget = 'DRAFT' | 'PROCESSING' | 'READY' | 'PUBLISHED';

export function assertTransitionInput(from: string, to: string): LifecycleTarget {
  const target = to.toUpperCase();
  if (target !== 'DRAFT' && target !== 'PROCESSING' && target !== 'READY' && target !== 'PUBLISHED') {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid transition target.', { field: 'to' });
  }
  assertValidTransition(from, target);
  return target;
}

function bilingualIssues(course: CourseHierarchy): string[] {
  const issues: string[] = [];
  if (
    course.titleAr.trim() === '' ||
    course.titleEn.trim() === '' ||
    course.descriptionAr.trim() === '' ||
    course.descriptionEn.trim() === ''
  ) {
    issues.push('course translations incomplete');
  }
  if (course.plans.length === 0) issues.push('at least one plan required');
  if (course.sections.length === 0) issues.push('at least one section required');
  let lessons = 0;
  for (const s of course.sections) {
    if (s.titleAr.trim() === '' || s.titleEn.trim() === '')
      issues.push(`section ${s.id} translations incomplete`);
    for (const l of s.lessons) {
      lessons += 1;
      if (l.titleAr.trim() === '' || l.titleEn.trim() === '')
        issues.push(`lesson ${l.id} translations incomplete`);
    }
  }
  if (lessons === 0) issues.push('at least one lesson required');
  return issues;
}

export function validateDraftForProcessing(course: CourseHierarchy): void {
  const issues = bilingualIssues(course);
  for (const s of course.sections) {
    for (const l of s.lessons) {
      if (l.media === null) issues.push(`lesson ${l.id} missing media mapping`);
      else {
        if (l.media.assetId === null) issues.push(`lesson ${l.id} media not registered with DRM`);
        if (
          l.media.status === 'DELETION_PENDING' ||
          l.media.status === 'DELETION_FAILED' ||
          l.media.status === 'FAILED'
        ) {
          issues.push(`lesson ${l.id} media ${l.media.status}`);
        }
        if (l.media.status === 'UPLOAD_PENDING')
          issues.push(`lesson ${l.id} upload not submitted to DRM completion`);
      }
    }
  }
  if (issues.length > 0) {
    throw new ApiError(
      409,
      'PUBLICATION_BLOCKED',
      'Course does not meet PROCESSING requirements.',
      { issues: issues.slice(0, 20) },
    );
  }
}

export function validateReadyForPublish(course: CourseHierarchy): void {
  const issues = bilingualIssues(course);
  for (const s of course.sections) {
    for (const l of s.lessons) {
      if (l.media === null) issues.push(`lesson ${l.id} missing media`);
      else if (l.media.status !== 'READY')
        issues.push(`lesson ${l.id} media ${l.media.status} (need READY)`);
      else if (l.media.assetId === null) issues.push(`lesson ${l.id} missing DRM asset id`);
    }
  }
  if (issues.length > 0) {
    throw new ApiError(
      409,
      'PUBLICATION_BLOCKED',
      'Course does not meet publication requirements.',
      { issues: issues.slice(0, 20) },
    );
  }
}

export function collectNotReady(course: CourseHierarchy): string[] {
  const ids: string[] = [];
  for (const s of course.sections) {
    for (const l of s.lessons) {
      if (l.media === null || l.media.status !== 'READY') ids.push(l.id);
    }
  }
  return ids;
}

/** UI helper: derive valid next actions + disabled reasons from server state. */
export function availableLifecycleActions(status: string): {
  action: LifecycleTarget | 'ARCHIVE' | 'UNARCHIVE';
  enabled: boolean;
  reason: string | null;
}[] {
  const actions: {
    action: LifecycleTarget | 'ARCHIVE' | 'UNARCHIVE';
    enabled: boolean;
    reason: string | null;
  }[] = [
    { action: 'DRAFT', enabled: status === 'PUBLISHED', reason: status === 'PUBLISHED' ? null : 'Available only from PUBLISHED.' },
    {
      action: 'PROCESSING',
      enabled: status === 'DRAFT',
      reason: status === 'DRAFT' ? null : 'Available only from DRAFT.',
    },
    {
      action: 'READY',
      enabled: status === 'PROCESSING',
      reason: status === 'PROCESSING' ? null : 'Requires PROCESSING with all media READY.',
    },
    {
      action: 'PUBLISHED',
      enabled: status === 'READY',
      reason: status === 'READY' ? null : 'Requires READY with all invariants passing.',
    },
  ];
  if (status === 'ARCHIVED') {
    return [{ action: 'UNARCHIVE', enabled: true, reason: null }];
  }
  return [...actions, { action: 'ARCHIVE' as const, enabled: true, reason: null }];
}
