import { Router } from 'express';
import { Prisma } from '@prisma/client';
import { ok } from '../../identity/errors.js';
import type { CatalogRouteContext } from '../types.js';
import { readGuard } from './guards.js';
import { asyncRoute } from './shared.js';

/** Aggregate-only admin overview. No student/payment identity or CSV export. */
export function createSummaryRouter(ctx: CatalogRouteContext): Router {
  const router = Router();
  router.get('/catalog/summary', readGuard, asyncRoute(async (_req, res) => {
    const data = await ctx.prisma.$transaction(async tx => {
      const now = new Date();
      const [students, publishedCourses, draftCourses, publishedPackages, pendingRecharges, coursePurchases, packagePurchases, walletBalances, active] = await Promise.all([
        tx.user.count({ where: { role: 'STUDENT' } }),
        tx.course.count({ where: { status: 'PUBLISHED', deletionRequestedAt: null } }),
        tx.course.count({ where: { status: 'DRAFT', deletionRequestedAt: null } }),
        tx.coursePackage.count({ where: { status: 'PUBLISHED' } }),
        tx.rechargeRequest.count({ where: { status: 'PENDING' } }),
        tx.purchase.count(), tx.packagePurchase.count(), tx.wallet.aggregate({ _sum: { balancePiastres: true } }),
        tx.$queryRaw<{ count: bigint }[]>`SELECT COUNT(*) AS count FROM (SELECT DISTINCT s."studentId", s."courseId" FROM "Subscription" s JOIN "Course" c ON c.id = s."courseId" WHERE s."expiresAt" IS NULL OR s."expiresAt" > ${now}) AS grants`,
      ]);
      return { asOf: now.toISOString(), students, publishedCourses, draftCourses, publishedPackages, pendingRecharges, coursePurchases, packagePurchases, walletBalancePiastres: walletBalances._sum.balancePiastres ?? 0, activeCourseAccess: Number(active[0]?.count ?? 0) };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
    res.json(ok(data));
  }));
  return router;
}
