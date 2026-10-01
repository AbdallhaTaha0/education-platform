import type { PrismaClient, NotificationType } from '@prisma/client';
import type { Clock } from '../identity/tokens.js';
import { lockCourseRowShared } from '../catalog/locks.js';
import { NOTIFICATION_RETENTION_MS, type NotificationTx } from './store.js';

async function intent(tx: NotificationTx, key: string, type: NotificationType, now: Date,
  recipientId?: string, courseId?: string, occurredAt = now) {
  return tx.notificationEvent.create({ data: {
    eventKey: key, type, courseId, recordedAt: now, occurredAt,
    expiresAt: new Date(now.getTime() + NOTIFICATION_RETENTION_MS), nextAttemptAt: now,
    ...(recipientId ? { audience: { create: { recipientId } } } : {}),
  } });
}

/** Called inside the authoritative decision/credit transaction, never after it. */
export async function recordRecharge(tx: NotificationTx, requestId: string) {
  const request = await tx.rechargeRequest.findUniqueOrThrow({ where: { id: requestId }, include: { student: { select: { role: true } } } });
  if (request.notificationRecordedAt !== null || request.status === 'PENDING') return;
  const now = request.reviewedAt ?? new Date();
  if (request.student.role === 'STUDENT') await intent(tx, `recharge:${request.id}:decision`,
    request.status === 'APPROVED' ? 'RECHARGE_APPROVED' : 'RECHARGE_REJECTED', now, request.studentId);
  await tx.rechargeRequest.update({ where: { id: request.id }, data: { notificationRecordedAt: now } });
}

/** Caller holds the course UPDATE lock. Audience is frozen by one INSERT SELECT. */
export async function recordFirstPublication(tx: NotificationTx, courseId: string, now: Date) {
  const course = await tx.course.findUniqueOrThrow({ where: { id: courseId } });
  if (course.firstPublicationAt !== null) return;
  const event = await intent(tx, `course:${courseId}:first-publication`, 'COURSE_PUBLISHED', now, undefined, courseId);
  await tx.$executeRaw`INSERT INTO "NotificationAudience" ("eventId", "recipientId")
    SELECT ${event.id}, id FROM "User" WHERE role = 'STUDENT'`;
  await tx.course.update({ where: { id: courseId }, data: { firstPublicationAt: now } });
}

/** Discovery is advisory; entitlement is reread after purchase's course/wallet locks. */
export async function recordExpiry(prisma: PrismaClient, studentId: string, courseId: string, clock: Clock = Date.now) {
  return prisma.$transaction(async (tx) => {
    await lockCourseRowShared(tx, courseId); // No row is valid for a deleted course.
    const wallets = await tx.$queryRaw<Array<{ id: string }>>`SELECT id FROM "Wallet" WHERE "userId" = ${studentId} FOR UPDATE`;
    if (!wallets[0]) return false; // A genuine purchased subscription already has its wallet.
    const now = new Date(clock());
    const user = await tx.user.findUnique({ where: { id: studentId }, select: { role: true } });
    if (user?.role !== 'STUDENT') return false;
    const rollout = await tx.notificationRollout.findUniqueOrThrow({ where: { id: 1 } });
    if (await tx.subscription.count({ where: { studentId, courseId, expiresAt: null } })) return false;
    const group = await tx.subscription.aggregate({ where: { studentId, courseId }, _max: { expiresAt: true } });
    const expiry = group._max.expiresAt;
    if (!expiry || expiry > now || expiry <= rollout.installedAt) return false;
    const marker = await tx.notificationExpiryMarker.findUnique({ where: { studentId_courseId: { studentId, courseId } } });
    if (marker && marker.recordedExpiry >= expiry) return false;
    await intent(tx, `expiry:${studentId}:${courseId}:${expiry.toISOString()}`, 'SUBSCRIPTION_EXPIRED', now, studentId, courseId, expiry);
    await tx.notificationExpiryMarker.upsert({ where: { studentId_courseId: { studentId, courseId } },
      create: { studentId, courseId, recordedExpiry: expiry }, update: { recordedExpiry: expiry } });
    return true;
  });
}

export async function scanExpiries(prisma: PrismaClient, clock: Clock = Date.now, limit = 100) {
  const candidates = await prisma.$queryRaw<Array<{ studentId: string; courseId: string }>>`
    SELECT s."studentId", s."courseId" FROM "Subscription" s
    JOIN "User" u ON u.id = s."studentId" AND u.role = 'STUDENT'
    LEFT JOIN "NotificationExpiryMarker" m ON m."studentId" = s."studentId" AND m."courseId" = s."courseId"
    CROSS JOIN "NotificationRollout" r
    WHERE r.id = 1 GROUP BY s."studentId", s."courseId", m."recordedExpiry", r."installedAt"
    HAVING COUNT(*) = COUNT(s."expiresAt") AND MAX(s."expiresAt") <= ${new Date(clock())} AND MAX(s."expiresAt") > r."installedAt"
      AND (m."recordedExpiry" IS NULL OR MAX(s."expiresAt") > m."recordedExpiry")
    ORDER BY s."studentId", s."courseId" LIMIT ${limit}`;
  let recorded = 0;
  for (const candidate of candidates) if (await recordExpiry(prisma, candidate.studentId, candidate.courseId, clock)) recorded++;
  return recorded;
}
