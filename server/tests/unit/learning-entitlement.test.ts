/**
 * Unit tests for the M5 entitlement boundary, including the exact expiry
 * instant. Pure, so no database, Redis or DRM dependency is involved.
 */
import { describe, expect, it } from 'vitest';
import { evaluateEntitlement, isLearnableStatus, toDecision } from '../../src/modules/learning/access/entitlement.js';
import { LearningError } from '../../src/modules/learning/errors.js';

const T0 = Date.parse('2026-09-30T12:00:00.000Z');
const day = 86_400_000;

function sub(expiresAtMs: number) {
  return { courseId: 'course-1', startsAt: new Date(T0 - day), expiresAt: new Date(expiresAtMs) };
}

describe('entitlement boundary', () => {
  it('grants access strictly before expiry', () => {
    const result = evaluateEntitlement([sub(T0 + 1000)], 'course-1', T0);
    expect(result.allowed).toBe(true);
  });

  it('denies access at the exact expiry instant', () => {
    const result = evaluateEntitlement([sub(T0)], 'course-1', T0);
    expect(result.allowed).toBe(false);
    expect(result.allowed === false && result.reason).toBe('SUBSCRIPTION_EXPIRED');
  });

  it('denies access one millisecond after expiry', () => {
    const result = evaluateEntitlement([sub(T0)], 'course-1', T0 + 1);
    expect(result.allowed).toBe(false);
  });

  it('requires a subscription for the requested course only', () => {
    const rows = [{ courseId: 'other-course', startsAt: new Date(T0 - day), expiresAt: new Date(T0 + day) }];
    const result = evaluateEntitlement(rows, 'course-1', T0);
    expect(result.allowed).toBe(false);
    expect(result.allowed === false && result.reason).toBe('SUBSCRIPTION_REQUIRED');
  });

  it('uses the latest expiry when a course has several purchase rows', () => {
    const rows = [sub(T0 + 1000), sub(T0 + 10 * day), sub(T0 - day)];
    const result = evaluateEntitlement(rows, 'course-1', T0);
    expect(result.allowed).toBe(true);
    expect(result.allowed && result.expiresAt!.getTime()).toBe(T0 + 10 * day);
  });

  it('an expired earlier row does not shorten an active later row', () => {
    const rows = [sub(T0 - day), sub(T0 + day)];
    const result = evaluateEntitlement(rows, 'course-1', T0);
    expect(result.allowed).toBe(true);
  });

  it('exposes the expiry to the client envelope for an expired subscription', () => {
    const result = evaluateEntitlement([sub(T0 - day)], 'course-1', T0);
    const decision = toDecision(result);
    expect(decision.entitled).toBe(false);
    expect(decision.expiresAt?.getTime()).toBe(T0 - day);
  });

  it('treats only PUBLISHED as releasable to students', () => {
    expect(isLearnableStatus('PUBLISHED')).toBe(true);
    // READY means processing finished; it does not mean released.
    expect(isLearnableStatus('READY')).toBe(false);
    expect(isLearnableStatus('DRAFT')).toBe(false);
    expect(isLearnableStatus('PROCESSING')).toBe(false);
    expect(isLearnableStatus('ARCHIVED')).toBe(false);
  });
  it('indefinite access dominates finite expiry in either row order', () => {
    const indefinite = { courseId: 'course-1', startsAt: new Date(T0), expiresAt: null };
    for (const rows of [[sub(T0), indefinite], [indefinite, sub(T0)]]) {
      expect(evaluateEntitlement(rows, 'course-1', T0 + 10000 * day)).toEqual({ allowed: true, expiresAt: null });
    }
    expect(evaluateEntitlement([indefinite], 'other-course', T0).allowed).toBe(false);
  });
});

describe('learning error contract', () => {
  it('maps categories to safe statuses', () => {
    expect(new LearningError('SUBSCRIPTION_REQUIRED').status).toBe(403);
    expect(new LearningError('SUBSCRIPTION_EXPIRED').status).toBe(403);
    expect(new LearningError('LESSON_NOT_FOUND').status).toBe(404);
    expect(new LearningError('MEDIA_NOT_READY').status).toBe(409);
    expect(new LearningError('PLAYBACK_UNAVAILABLE').status).toBe(503);
    expect(new LearningError('PLAYBACK_SESSION_EXPIRED').status).toBe(401);
    expect(new LearningError('DRM_DEPENDENCY_FAILED').status).toBe(502);
    expect(new LearningError('FORBIDDEN').status).toBe(403);
  });

  it('never carries dependency or database detail in the message', () => {
    const err = new LearningError('DRM_DEPENDENCY_FAILED');
    expect(err.message).toBe('The media service is unavailable.');
    expect(err.message).not.toMatch(/select |insert |postgres|http:\/\//i);
  });
});
