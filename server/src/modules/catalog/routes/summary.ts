import { Router } from 'express';
import { ok } from '../../identity/errors.js';
import type { CatalogRouteContext } from '../types.js';
import { readGuard } from './guards.js';
import { asyncRoute } from './shared.js';

/** Aggregate-only admin overview. No student/payment identity or CSV export. */
export function createSummaryRouter(ctx: CatalogRouteContext): Router {
  const router = Router();
  router.get(
    '/catalog/summary',
    readGuard,
    asyncRoute(async (_req, res) => {
      const now = new Date();
      const [
        students,
        publishedCourses,
        draftCourses,
        publishedPackages,
        pendingRecharges,
        coursePurchases,
        packagePurchases,
        walletBalances,
        active,
      ] = await Promise.all([
        ctx.prisma.user.count({ where: { role: 'STUDENT' } }),
        ctx.prisma.course.count({ where: { status: 'PUBLISHED', deletionRequestedAt: null } }),
        ctx.prisma.course.count({ where: { status: 'DRAFT', deletionRequestedAt: null } }),
        ctx.prisma.coursePackage.count({ where: { status: 'PUBLISHED' } }),
        ctx.prisma.rechargeRequest.count({ where: { status: 'PENDING' } }),
        ctx.prisma.purchase.count(),
        ctx.prisma.packagePurchase.count(),
        ctx.prisma.wallet.aggregate({ _sum: { balancePiastres: true } }),
        ctx.prisma.$queryRaw<
          { count: number | bigint }[]
        >`SELECT CAST(COUNT(*) AS INTEGER) AS count FROM (SELECT DISTINCT s."studentId", s."courseId" FROM "Subscription" s JOIN "Course" c ON c.id = s."courseId" WHERE s."expiresAt" IS NULL OR s."expiresAt" > ${now}) AS grants`,
      ]);
      const data = {
        asOf: now.toISOString(),
        students,
        publishedCourses,
        draftCourses,
        publishedPackages,
        pendingRecharges,
        coursePurchases,
        packagePurchases,
        walletBalancePiastres: walletBalances._sum.balancePiastres ?? 0,
        activeCourseAccess: Number(active[0]?.count ?? 0),
      };
      res.json(ok(data));
    }),
  );
  return router;
}
