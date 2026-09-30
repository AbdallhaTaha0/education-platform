/**
 * Entitlement evaluation for protected learning (M5).
 *
 * The rule is deliberately small and pure so it can be exhaustively unit
 * tested: access requires a subscription row whose `expiresAt` is strictly in
 * the future at *backend* time. Progress rows and playback rows are never
 * consulted here, which is what makes progress incapable of granting access.
 *
 * The exact expiry instant is exclusive: at `expiresAt` the student is already
 * expired. Backend time is injected so tests never depend on wall clock.
 */
import type { EntitlementDecision } from '../types.js';

export interface SubscriptionRow {
  courseId: string;
  startsAt: Date;
  expiresAt: Date;
}

export type EntitlementResult =
  | { allowed: true; expiresAt: Date }
  | { allowed: false; reason: 'SUBSCRIPTION_REQUIRED' | 'SUBSCRIPTION_EXPIRED'; expiresAt: Date | null };

/**
 * Decide entitlement for one course.
 *
 * @param subscriptions all rows the student owns for any course
 * @param courseId the course being accessed
 * @param nowMs backend time in milliseconds
 */
export function evaluateEntitlement(
  subscriptions: readonly SubscriptionRow[],
  courseId: string,
  nowMs: number,
): EntitlementResult {
  const forCourse = subscriptions.filter((s) => s.courseId === courseId);
  if (forCourse.length === 0) {
    return { allowed: false, reason: 'SUBSCRIPTION_REQUIRED', expiresAt: null };
  }
  // Effective access is the union of every purchase covering this course, so
  // the latest expiry wins (early renewal extends from the existing expiry).
  const latest = forCourse.reduce<Date>((max, s) => (s.expiresAt > max ? s.expiresAt : max), forCourse[0]!.expiresAt);
  // Strictly before expiresAt: the expiry instant itself is already expired.
  if (latest.getTime() <= nowMs) {
    return { allowed: false, reason: 'SUBSCRIPTION_EXPIRED', expiresAt: latest };
  }
  return { allowed: true, expiresAt: latest };
}

/** Envelope form used by dashboard and outline responses. */
export function toDecision(result: EntitlementResult): EntitlementDecision {
  return { entitled: result.allowed, expiresAt: result.expiresAt };
}

/**
 * True when a course state may be used for learning access.
 *
 * Only `PUBLISHED` is releasable to students. `READY` means processing has
 * finished, not that the course has been released, so an unpublished course is
 * never learnable no matter how complete its media is. `ARCHIVED` is a
 * reversible administrative state, not a student-visible one.
 */
export function isLearnableStatus(status: string): boolean {
  return status === 'PUBLISHED';
}
