import type { PrismaClient } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { ApiError } from '../../identity/errors.js';
import { audit } from '../../catalog/audit.js';
import { courseIdForPlan, withCourseReadLock } from '../../catalog/courseTx.js';
import { rejectUnknownFields } from '../../catalog/validation.js';
import { lockWallet, postEntry } from '../ledger.js';
import { assertIdempotencyKey, assertNonEmptyString } from '../money.js';
import type { PurchaseInput } from '../types.js';

const DAY_MS = 86_400_000;
const PURCHASE_FIELDS = new Set(['planId', 'idempotencyKey']);

function toPurchaseView(purchase: Record<string, unknown>, subscription: Record<string, unknown>) {
  return {
    id: purchase['id'],
    planId: purchase['planId'],
    courseId: purchase['courseId'],
    pricePiastres: purchase['pricePiastres'],
    durationDays: purchase['durationDays'],
    accessMode: purchase['accessMode'],
    accessEndsAt: purchase['accessEndsAt']
      ? (purchase['accessEndsAt'] as Date).toISOString()
      : null,
    createdAt: (purchase['createdAt'] as Date).toISOString(),
    subscription: {
      id: subscription['id'],
      startsAt: (subscription['startsAt'] as Date).toISOString(),
      expiresAt: subscription['expiresAt']
        ? (subscription['expiresAt'] as Date).toISOString()
        : null,
    },
  };
}

/**
 * Explicit student purchase. One transaction: idempotency gate → trusted
 * plan snapshot → wallet lock → balance check → debit → purchase →
 * subscription. Any failure rolls back everything: no partial debit,
 * purchase, or access. Later plan edits never touch the snapshot.
 */
export async function purchaseCourse(
  prisma: PrismaClient,
  studentId: string,
  input: PurchaseInput,
) {
  rejectUnknownFields(input, PURCHASE_FIELDS);
  const planId = assertNonEmptyString(input.planId, 'planId', 64);
  const idempotencyKey = assertIdempotencyKey(input.idempotencyKey);
  if (
    await prisma.packagePurchase.findUnique({
      where: { studentId_idempotencyKey: { studentId, idempotencyKey } },
    })
  ) {
    throw new ApiError(
      409,
      'IDEMPOTENCY_CONFLICT',
      'Idempotency key was used for a package purchase.',
    );
  }

  // Fast idempotent replay outside the write tx (confirmed inside too).
  const prior = await prisma.purchase.findUnique({
    where: { studentId_idempotencyKey: { studentId, idempotencyKey } },
  });
  if (prior) {
    if (prior.planId !== planId) {
      throw new ApiError(
        409,
        'IDEMPOTENCY_CONFLICT',
        'Idempotency key was already used for a different plan.',
      );
    }
    const sub = await prisma.subscription.findUniqueOrThrow({ where: { purchaseId: prior.id } });
    return toPurchaseView(
      prior as unknown as Record<string, unknown>,
      sub as unknown as Record<string, unknown>,
    );
  }

  try {
    // Join the canonical M3 course lock so archive, plan mutation and
    // permanent deletion cannot interleave with a purchase decision.
    const courseId = await courseIdForPlan(prisma, planId);
    const result = await withCourseReadLock(prisma, courseId, async (tx) => {
      const replay = await tx.purchase.findUnique({
        where: { studentId_idempotencyKey: { studentId, idempotencyKey } },
      });
      if (replay) {
        if (replay.planId !== planId) {
          throw new ApiError(
            409,
            'IDEMPOTENCY_CONFLICT',
            'Idempotency key was already used for a different plan.',
          );
        }
        const sub = await tx.subscription.findUniqueOrThrow({ where: { purchaseId: replay.id } });
        return { purchase: replay, subscription: sub };
      }
      // Trusted server-side plan + active published course (never client input).
      const plan = await tx.subscriptionPlan.findUnique({
        where: { id: planId },
        include: { course: { select: { id: true, slug: true, status: true } } },
      });
      if (!plan || plan.course.status !== 'PUBLISHED') {
        throw new ApiError(404, 'NOT_FOUND', 'This plan is not available for purchase.');
      }
      const wallet = await lockWallet(tx, studentId);
      if (
        await tx.packagePurchase.findUnique({
          where: { studentId_idempotencyKey: { studentId, idempotencyKey } },
        })
      ) {
        throw new ApiError(
          409,
          'IDEMPOTENCY_CONFLICT',
          'Idempotency key was used for a package purchase.',
        );
      }
      // Re-check idempotency AFTER the wallet lock. Concurrent identical
      // requests all pass the earlier read, then serialize on the wallet row;
      // whoever commits first has already debited, so a loser that re-decided
      // affordability here would deny itself with INSUFFICIENT_FUNDS for a
      // purchase it is entitled to replay. The post-lock read observes the
      // winner's committed row (READ COMMITTED takes a fresh snapshot per
      // statement), so the retry converges on the same purchase.
      const settled = await tx.purchase.findUnique({
        where: { studentId_idempotencyKey: { studentId, idempotencyKey } },
      });
      if (settled) {
        if (settled.planId !== planId) {
          throw new ApiError(
            409,
            'IDEMPOTENCY_CONFLICT',
            'Idempotency key was already used for a different plan.',
          );
        }
        const sub = await tx.subscription.findUniqueOrThrow({ where: { purchaseId: settled.id } });
        return { purchase: settled, subscription: sub };
      }
      // Different tabs/clicks can carry different idempotency keys. Check
      // ownership after the wallet lock so even those concurrent requests
      // cannot buy the same active course twice. An exact replay above still
      // returns its original receipt without another debit.
      const now = new Date();
      if (await tx.subscription.findFirst({ where: {
        studentId, courseId: plan.course.id,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      }, select: { id: true } })) {
        throw new ApiError(409, 'COURSE_ALREADY_SUBSCRIBED', 'You already have access to this course. No payment was taken.');
      }
      if (wallet.balancePiastres < plan.currentPricePiastres) {
        throw new ApiError(
          402,
          'INSUFFICIENT_FUNDS',
          'Wallet balance is insufficient for this plan.',
        );
      }
      if (
        ['TERM_END', 'YEAR_END'].includes(plan.accessMode) &&
        (!plan.accessEndsAt || plan.accessEndsAt <= now)
      ) {
        throw new ApiError(409, 'OFFER_EXPIRED', 'The access deadline has passed.');
      }
      // Deterministic lock order: wallet → ledger → purchase → subscription.
      const purchase = await tx.purchase.create({
        data: {
          studentId,
          planId: plan.id,
          courseId: plan.course.id,
          pricePiastres: plan.currentPricePiastres,
          durationDays: plan.durationDays,
          accessMode: plan.accessMode,
          accessEndsAt: plan.accessEndsAt,
          idempotencyKey,
        },
      });
      if (plan.currentPricePiastres > 0) await postEntry(
        tx,
        wallet.id,
        -plan.currentPricePiastres,
        'DEBIT_PURCHASE',
        'PURCHASE',
        purchase.id,
      );
      // Once prior access has expired, a new purchase starts immediately.
      const base = now;
      const subscription = await tx.subscription.create({
        data: {
          studentId,
          courseId: plan.course.id,
          purchaseId: purchase.id,
          startsAt: base,
          expiresAt:
            plan.accessMode === 'DURATION'
              ? new Date(base.getTime() + plan.durationDays! * DAY_MS)
              : plan.accessEndsAt,
        },
      });
      await audit(tx, {
        actorUserId: studentId,
        action: 'COURSE_PURCHASED',
        entityType: 'Purchase',
        entityId: purchase.id,
        metadata: {
          courseId: plan.course.id,
          pricePiastres: plan.currentPricePiastres,
          durationDays: plan.durationDays,
        },
      });
      return { purchase, subscription };
    });
    return toPurchaseView(
      result.purchase as unknown as Record<string, unknown>,
      result.subscription as unknown as Record<string, unknown>,
    );
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      // A concurrent identical request may have committed first. Converge on
      // that result; only a mismatched plan is an idempotency conflict.
      const winner = await prisma.purchase.findUnique({
        where: { studentId_idempotencyKey: { studentId, idempotencyKey } },
      });
      if (winner) {
        if (winner.planId !== planId) {
          throw new ApiError(
            409,
            'IDEMPOTENCY_CONFLICT',
            'Idempotency key was already used for a different plan.',
          );
        }
        const sub = await prisma.subscription.findUniqueOrThrow({
          where: { purchaseId: winner.id },
        });
        return toPurchaseView(
          winner as unknown as Record<string, unknown>,
          sub as unknown as Record<string, unknown>,
        );
      }
      throw new ApiError(409, 'IDEMPOTENCY_CONFLICT', 'This purchase was already submitted.');
    }
    throw err;
  }
}

export async function listMyPurchases(prisma: PrismaClient, studentId: string, limit = 100, skip = 0) {
  const rows = await prisma.purchase.findMany({
    where: { studentId },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: limit, skip,
  });
  const subs = await prisma.subscription.findMany({
    where: { studentId, purchaseId: { in: rows.map((p) => p.id) } },
  });
  const byPurchase = new Map(subs.map((s) => [s.purchaseId, s]));
  return rows.map((p) => {
    const sub = byPurchase.get(p.id);
    return {
      id: p.id,
      planId: p.planId,
      courseId: p.courseId,
      pricePiastres: p.pricePiastres,
      durationDays: p.durationDays,
      accessMode: p.accessMode,
      accessEndsAt: p.accessEndsAt?.toISOString() ?? null,
      createdAt: p.createdAt.toISOString(),
      subscription: sub
        ? {
            id: sub.id,
            startsAt: sub.startsAt.toISOString(),
            expiresAt: sub.expiresAt?.toISOString() ?? null,
          }
        : null,
    };
  });
}

export async function listMySubscriptions(prisma: PrismaClient, studentId: string) {
  const rows = await prisma.subscription.findMany({
    where: { studentId },
    orderBy: { expiresAt: 'desc' },
    take: 100,
  });
  return rows.map((s) => ({
    id: s.id,
    courseId: s.courseId,
    purchaseId: s.purchaseId,
    packagePurchaseId: s.packagePurchaseId,
    startsAt: s.startsAt.toISOString(),
    expiresAt: s.expiresAt?.toISOString() ?? null,
  }));
}
