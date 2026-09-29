import type { PrismaClient } from '@prisma/client';
import { ApiError } from '../../identity/errors.js';
import { audit } from '../audit.js';
import { courseIdForPlan, withCourseLock } from '../courseTx.js';
import { ensureMutable } from '../courses/service.js';
import { assertUuid, rejectUnknownFields, validateDurationDays, validatePricePair } from '../validation.js';

const CREATE_FIELDS = new Set(['currentPricePiastres', 'previousPricePiastres', 'durationDays']);
const UPDATE_FIELDS = new Set(['currentPricePiastres', 'previousPricePiastres', 'durationDays']);

export async function createPlan(prisma: PrismaClient, actorId: string, courseId: string, raw: unknown) {
  assertUuid(courseId, 'courseId');
  rejectUnknownFields(raw, CREATE_FIELDS);
  const body = raw as Record<string, unknown>;
  const { current, previous } = validatePricePair(body['currentPricePiastres'], body['previousPricePiastres']);
  const durationDays = validateDurationDays(body['durationDays']);
  return withCourseLock(prisma, courseId, async (tx) => {
    const course = await tx.course.findUnique({ where: { id: courseId } });
    if (course === null) throw new ApiError(404, 'NOT_FOUND', 'Course not found.');
    ensureMutable(course, 'Plan change');
    const created = await tx.subscriptionPlan.create({
      data: { courseId, currentPricePiastres: current, previousPricePiastres: previous, durationDays },
    });
    await audit(tx, { actorUserId: actorId, action: 'PLAN_CREATED', entityType: 'SubscriptionPlan', entityId: created.id, metadata: { courseId, currentPricePiastres: current, durationDays } });
    return created;
  });
}

export async function updatePlan(prisma: PrismaClient, actorId: string, planId: string, raw: unknown) {
  assertUuid(planId, 'planId');
  rejectUnknownFields(raw, UPDATE_FIELDS);
  const body = raw as Record<string, unknown>;
  const courseId = await courseIdForPlan(prisma, planId);
  return withCourseLock(prisma, courseId, async (tx) => {
    const plan = await tx.subscriptionPlan.findUnique({ where: { id: planId }, include: { course: true } });
    if (plan === null) throw new ApiError(404, 'NOT_FOUND', 'Plan not found.');
    ensureMutable(plan.course, 'Plan change');
    const currentRaw = body['currentPricePiastres'] ?? plan.currentPricePiastres;
    const previousRaw = body['previousPricePiastres'] ?? plan.previousPricePiastres;
    const { current, previous } = validatePricePair(currentRaw, previousRaw);
    const durationDays = body['durationDays'] === undefined ? plan.durationDays : validateDurationDays(body['durationDays']);
    const updated = await tx.subscriptionPlan.update({
      where: { id: planId },
      data: { currentPricePiastres: current, previousPricePiastres: previous, durationDays },
    });
    await audit(tx, { actorUserId: actorId, action: 'PLAN_UPDATED', entityType: 'SubscriptionPlan', entityId: planId, metadata: { currentPricePiastres: current, durationDays } });
    return updated;
  });
}

export async function deletePlan(prisma: PrismaClient, actorId: string, planId: string) {
  assertUuid(planId, 'planId');
  const courseId = await courseIdForPlan(prisma, planId);
  return withCourseLock(prisma, courseId, async (tx) => {
    const plan = await tx.subscriptionPlan.findUnique({ where: { id: planId }, include: { course: true } });
    if (plan === null) throw new ApiError(404, 'NOT_FOUND', 'Plan not found.');
    ensureMutable(plan.course, 'Plan change');
    const remaining = await tx.subscriptionPlan.count({ where: { courseId: plan.courseId } });
    await tx.subscriptionPlan.delete({ where: { id: planId } });
    await audit(tx, { actorUserId: actorId, action: 'PLAN_DELETED', entityType: 'SubscriptionPlan', entityId: planId, metadata: { courseId: plan.courseId, remaining: remaining - 1 } });
    return { ok: true };
  });
}
