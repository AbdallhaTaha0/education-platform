import type { PrismaClient } from '@prisma/client';
import { ApiError } from '../../identity/errors.js';
import { assertUuid, rejectUnknownFields } from '../../catalog/validation.js';
import { lockedMembers, lockPackage } from '../../catalog/packages.js';
import { audit } from '../../catalog/audit.js';
import { lockWallet, postEntry } from '../ledger.js';
import { assertIdempotencyKey } from '../money.js';

const purchaseInclude = { items: { orderBy: { position: 'asc' as const } }, subscriptions: true };
export async function requireStudent(prisma: PrismaClient, studentId: string) {
  const user = await prisma.user.findUnique({ where: { id: studentId }, select: { role: true } });
  if (user?.role !== 'STUDENT') throw new ApiError(403, 'FORBIDDEN', 'Student access required.');
}

export async function packageReview(prisma: PrismaClient, studentId: string, packageId: string) {
  await requireStudent(prisma, studentId);
  assertUuid(packageId);
  const row = await prisma.coursePackage.findUnique({
    where: { id: packageId },
    include: { members: true },
  });
  if (!row || row.status !== 'PUBLISHED')
    throw new ApiError(404, 'NOT_FOUND', 'Package not found.');
  const existing = await prisma.subscription.findMany({
    where: {
      studentId,
      courseId: { in: row.members.map((m) => m.courseId) },
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
    select: { courseId: true, expiresAt: true },
  });
  return {
    packageId,
    version: row.version,
    pricePiastres: row.pricePiastres,
    endsAt: row.endsAt.toISOString(),
    warnings: existing.length
      ? [{ code: 'EXISTING_ACCESS', courseIds: [...new Set(existing.map((s) => s.courseId))] }]
      : [],
  };
}

export async function purchasePackage(prisma: PrismaClient, studentId: string, raw: unknown) {
  await requireStudent(prisma, studentId);
  rejectUnknownFields(raw, new Set(['packageId', 'expectedVersion', 'idempotencyKey']));
  const body = raw as Record<string, unknown>;
  const packageId = assertUuid(body.packageId, 'packageId');
  const key = assertIdempotencyKey(body.idempotencyKey);
  if (
    typeof body.expectedVersion !== 'number' ||
    !Number.isInteger(body.expectedVersion) ||
    body.expectedVersion < 1
  )
    throw new ApiError(400, 'VALIDATION_ERROR', 'expectedVersion is required.');
  const replay = await prisma.packagePurchase.findUnique({
    where: { studentId_idempotencyKey: { studentId, idempotencyKey: key } },
    include: purchaseInclude,
  });
  if (replay) {
    if (replay.packageId !== packageId)
      throw new ApiError(409, 'IDEMPOTENCY_CONFLICT', 'Key used for another package.');
    return replay;
  }
  return prisma.$transaction(async (tx) => {
    const pkg = await lockPackage(tx, packageId);
    const afterLock = await tx.packagePurchase.findUnique({
      where: { studentId_idempotencyKey: { studentId, idempotencyKey: key } },
      include: purchaseInclude,
    });
    if (afterLock) {
      if (afterLock.packageId !== packageId)
        throw new ApiError(409, 'IDEMPOTENCY_CONFLICT', 'Key used for another package.');
      return afterLock;
    }
    const courses = await lockedMembers(
      tx,
      pkg.members.map((m) => m.courseId),
      false,
    );
    const wallet = await lockWallet(tx, studentId);
    const settled = await tx.packagePurchase.findUnique({
      where: { studentId_idempotencyKey: { studentId, idempotencyKey: key } },
      include: purchaseInclude,
    });
    if (settled) {
      if (settled.packageId !== packageId)
        throw new ApiError(409, 'IDEMPOTENCY_CONFLICT', 'Key used for another package.');
      return settled;
    }
    if (
      await tx.purchase.findUnique({
        where: { studentId_idempotencyKey: { studentId, idempotencyKey: key } },
      })
    )
      throw new ApiError(409, 'IDEMPOTENCY_CONFLICT', 'Key used for a course.');
    const now = new Date();
    if (pkg.status !== 'PUBLISHED')
      throw new ApiError(409, 'PACKAGE_UNAVAILABLE', 'Package is not published.');
    if (pkg.version !== body.expectedVersion)
      throw new ApiError(409, 'OFFER_CHANGED', 'Review the latest terms.');
    if (pkg.endsAt <= now)
      throw new ApiError(409, 'OFFER_EXPIRED', 'The package deadline has passed.');
    if (wallet.balancePiastres < pkg.pricePiastres)
      throw new ApiError(402, 'INSUFFICIENT_FUNDS', 'Wallet balance is insufficient.');
    const purchase = await tx.packagePurchase.create({
      data: {
        studentId,
        packageId: pkg.id,
        version: pkg.version,
        titleAr: pkg.titleAr,
        titleEn: pkg.titleEn,
        pricePiastres: pkg.pricePiastres,
        endsAt: pkg.endsAt,
        idempotencyKey: key,
        items: {
          create: courses.map((c, i) => ({
            courseId: c.id,
            titleAr: c.titleAr,
            titleEn: c.titleEn,
            position: i + 1,
          })),
        },
        subscriptions: {
          create: courses.map((c) => ({
            studentId,
            courseId: c.id,
            startsAt: now,
            expiresAt: pkg.endsAt,
          })),
        },
      },
      include: purchaseInclude,
    });
    await postEntry(
      tx,
      wallet.id,
      -pkg.pricePiastres,
      'DEBIT_PURCHASE',
      'PACKAGE_PURCHASE',
      purchase.id,
    );
    await audit(tx, {
      actorUserId: studentId,
      action: 'PACKAGE_PURCHASED',
      entityType: 'PackagePurchase',
      entityId: purchase.id,
      metadata: {
        packageId: pkg.id,
        version: pkg.version,
        pricePiastres: pkg.pricePiastres,
        courseIds: courses.map((c) => c.id),
      },
    });
    return purchase;
  });
}

export async function listPackagePurchases(prisma: PrismaClient, studentId: string) {
  await requireStudent(prisma, studentId);
  return prisma.packagePurchase.findMany({
    where: { studentId },
    include: purchaseInclude,
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
}
