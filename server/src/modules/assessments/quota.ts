import type { PrismaClient, Prisma } from '@prisma/client';
import { ApiError } from '../identity/errors.js';

const DAY = 86_400_000;
const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo', year: 'numeric', month: '2-digit', day: '2-digit' });
const cached = new Map<string, { start: Date; end: Date }>();
export function quotaWindow(now: number, anchor: Date | null): { start: Date; end: Date } {
  if (anchor) { const start = anchor.getTime() + Math.max(0, Math.floor((now - anchor.getTime()) / DAY)) * DAY; return { start: new Date(start), end: new Date(start + DAY) }; }
  const date = formatter.format(now); const prior = cached.get(date); if (prior) return prior;
  // Binary search real calendar transitions: Cairo days can be 23/25 hours.
  const second = Math.floor(now / 1000);
  let lo = second - 36 * 3600, hi = second;
  while (hi - lo > 1) { const mid = Math.floor((lo + hi) / 2); if (formatter.format(mid * 1000) === date) hi = mid; else lo = mid; }
  const start = new Date(hi * 1000); lo = second; hi = second + 36 * 3600;
  while (hi - lo > 1) { const mid = Math.floor((lo + hi) / 2); if (formatter.format(mid * 1000) === date) lo = mid; else hi = mid; }
  const value = { start, end: new Date(hi * 1000) }; if (cached.size > 8) cached.clear(); cached.set(date, value); return value;
}
export async function practiceEligible(db: PrismaClient, studentId: string, now: number): Promise<void> {
  const subs = await db.subscription.findMany({ where: { studentId, startsAt: { lte: new Date(now) }, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date(now) } }] }, select: { courseId: true } });
  const course = await db.course.findFirst({ where: { id: { in: subs.map((s) => s.courseId) }, deletionRequestedAt: null }, select: { id: true } });
  if (!course) throw new ApiError(403, 'SUBSCRIPTION_REQUIRED', 'An active course subscription is required.');
}
export async function quotaLocked(tx: Prisma.TransactionClient, studentId: string, now: number) {
  const win = quotaWindow(now, null);
  await tx.practiceQuota.upsert({ where: { studentId }, create: { studentId, windowStart: win.start, windowEnd: win.end }, update: {} });
  await tx.$queryRaw`SELECT "studentId" FROM "PracticeQuota" WHERE "studentId"=${studentId} FOR UPDATE`;
  let q = await tx.practiceQuota.findUniqueOrThrow({ where: { studentId } });
  if (q.windowEnd.getTime() <= now) { const w = quotaWindow(now, q.anchor); q = await tx.practiceQuota.update({ where: { studentId }, data: { windowStart: w.start, windowEnd: w.end, used: 0, epoch: { increment: 1 } } }); }
  return q;
}
export function quotaView(q: { limit: number | null; anchor: Date | null; used: number; windowEnd: Date; epoch: number }) {
  const limit = q.limit ?? 50; return { limit, customLimit: q.limit, used: q.used, remaining: Math.max(0, limit - q.used), nextResetAt: q.windowEnd, schedule: q.anchor ? 'ANCHORED_24H' : 'CAIRO_MIDNIGHT', epoch: q.epoch };
}
export async function readQuota(db: PrismaClient, studentId: string, now: number) { return db.$transaction(async (tx) => quotaView(await quotaLocked(tx, studentId, now))); }
export async function reserveRun(db: PrismaClient, studentId: string, idempotencyKey: string, now: number) {
  await practiceEligible(db, studentId, now);
  return db.$transaction(async (tx) => {
    const q = await quotaLocked(tx, studentId, now);
    const old = await tx.practiceRun.findUnique({ where: { studentId_idempotencyKey: { studentId, idempotencyKey } } });
    if (old) return { ...quotaView(q), duplicate: true };
    if (q.used >= (q.limit ?? 50)) throw new ApiError(429, 'PRACTICE_LIMIT_REACHED', 'Practice allowance is exhausted.', { nextResetAt: q.windowEnd.toISOString() });
    await tx.practiceRun.create({ data: { studentId, idempotencyKey, epoch: q.epoch } });
    const updated = await tx.practiceQuota.update({ where: { studentId }, data: { used: { increment: 1 } } });
    return { ...quotaView(updated), duplicate: false };
  });
}
export async function adjustQuota(db: PrismaClient, actor: string, studentId: string, action: 'LIMIT' | 'RESET', limit: number | null, now: number, idempotencyKey: string) {
  const student = await db.user.findFirst({ where: { id: studentId, role: 'STUDENT' }, select: { id: true } });
  if (!student) throw new ApiError(404, 'NOT_FOUND', 'Student not found.');
  if (limit !== null && (!Number.isInteger(limit) || limit < 0 || limit > 2147483647)) throw new ApiError(400, 'VALIDATION_ERROR', 'Limit must be a non-negative database integer.');
  return db.$transaction(async (tx) => {
    await quotaLocked(tx, studentId, now);
    const previous = await tx.auditEvent.findFirst({ where: { actorUserId: actor, entityId: studentId, action: `PRACTICE_${action}`, metadata: { path: ['idempotencyKey'], equals: idempotencyKey } } });
    if (previous) {
      const meta = previous.metadata as { requestedLimit: number | null };
      if (meta.requestedLimit !== limit) throw new ApiError(409, 'IDEMPOTENCY_CONFLICT', 'Adjustment key belongs to a different action.');
      return quotaView(await tx.practiceQuota.findUniqueOrThrow({ where: { studentId } }));
    }
    const q = await tx.practiceQuota.update({ where: { studentId }, data: action === 'LIMIT' ? { limit } : { anchor: new Date(now), windowStart: new Date(now), windowEnd: new Date(now + DAY), used: 0, epoch: { increment: 1 } } });
    await tx.auditEvent.create({ data: { actorUserId: actor, action: `PRACTICE_${action}`, entityType: 'User', entityId: studentId, metadata: { limit: q.limit, requestedLimit: limit, epoch: q.epoch, idempotencyKey } } });
    return quotaView(q);
  });
}
