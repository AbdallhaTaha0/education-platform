import { randomUUID } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import { materializeNotification, lockInbox } from './store.js';
import type { Clock } from '../identity/tokens.js';
import { scanExpiries } from './producers.js';
import { getLogger } from '../../logger.js';

export type SignalPublisher = (userId: string, revision: string) => Promise<void>;
const LEASE_MS = 30000;
export function retryDelay(attempt: number) { return Math.min(300000, 1000 * 2 ** Math.min(attempt - 1, 9)); }

export async function fanoutOnce(prisma: PrismaClient, clock: Clock = Date.now, batch = 100, eventId?: string) {
  const now = new Date(clock()), token = randomUUID();
  const event = await prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<Array<{ id: string }>>`SELECT id FROM "NotificationEvent"
      WHERE "expiresAt" > ${now} AND "deliveryStatus" <> 'COMPLETED' AND "nextAttemptAt" <= ${now}
      AND (${eventId ?? null}::text IS NULL OR id = ${eventId ?? null})
      AND ("leaseExpiresAt" IS NULL OR "leaseExpiresAt" <= ${now})
      ORDER BY "nextAttemptAt", id LIMIT 1 FOR UPDATE SKIP LOCKED`;
    if (!rows[0]) return null;
    return tx.notificationEvent.update({ where: { id: rows[0].id }, data: {
      deliveryStatus: 'PROCESSING', leaseToken: token, leaseExpiresAt: new Date(now.getTime() + LEASE_MS),
      attemptCount: { increment: 1 },
    } });
  });
  if (!event) return 0;
  try {
    const recipients = await prisma.notificationAudience.findMany({ where: { eventId: event.id, materializedAt: null },
      orderBy: { recipientId: 'asc' }, take: batch });
    for (const recipient of recipients) {
      const owned = await prisma.notificationEvent.updateMany({ where: { id: event.id, leaseToken: token,
        leaseExpiresAt: { gt: new Date(clock()) } }, data: { leaseExpiresAt: new Date(clock() + LEASE_MS) } });
      if (!owned.count) return 0;
      await materializeNotification(prisma, event.id, recipient.recipientId, clock);
    }
    const pending = await prisma.notificationAudience.count({ where: { eventId: event.id, materializedAt: null } });
    await prisma.notificationEvent.updateMany({ where: { id: event.id, leaseToken: token }, data: {
      deliveryStatus: pending ? 'PENDING' : 'COMPLETED', fanoutCursor: recipients.at(-1)?.recipientId,
      leaseToken: null, leaseExpiresAt: null, attemptCount: 0, nextAttemptAt: new Date(clock()), lastErrorCategory: null,
    } });
    return recipients.length;
  } catch {
    await prisma.notificationEvent.updateMany({ where: { id: event.id, leaseToken: token }, data: {
      deliveryStatus: event.attemptCount >= 10 ? 'FAILED' : 'PENDING', leaseToken: null, leaseExpiresAt: null,
      nextAttemptAt: new Date(clock() + retryDelay(event.attemptCount)), lastErrorCategory: 'FANOUT_UNAVAILABLE',
    } });
    getLogger().warn({ category: 'FANOUT_UNAVAILABLE', attempts: event.attemptCount }, 'notification fanout will retry');
    return 0;
  }
}

/** One coalesced durable signal per owner covers inserts, read changes and cleanup. */
export async function signalOnce(prisma: PrismaClient, publish: SignalPublisher, clock: Clock = Date.now, userId?: string) {
  const now = new Date(clock()), token = randomUUID();
  const state = await prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<Array<{ userId: string }>>`SELECT "userId" FROM "NotificationInboxState"
      WHERE revision > "deliveredRevision" AND "signalNextAttemptAt" <= ${now}
      AND (${userId ?? null}::text IS NULL OR "userId" = ${userId ?? null})
      AND ("signalLeaseExpiresAt" IS NULL OR "signalLeaseExpiresAt" <= ${now})
      ORDER BY "signalNextAttemptAt", "userId" LIMIT 1 FOR UPDATE SKIP LOCKED`;
    if (!rows[0]) return null;
    return tx.notificationInboxState.update({ where: { userId: rows[0].userId }, data: {
      signalLeaseToken: token, signalLeaseExpiresAt: new Date(now.getTime() + LEASE_MS), signalAttemptCount: { increment: 1 },
    } });
  });
  if (!state) return false;
  try {
    await publish(state.userId, state.revision.toString()); // Never a financial or source replay.
    await prisma.notificationInboxState.updateMany({ where: { userId: state.userId, signalLeaseToken: token }, data: {
      deliveredRevision: state.revision, signalLeaseToken: null, signalLeaseExpiresAt: null,
      signalAttemptCount: 0, signalNextAttemptAt: new Date(clock()),
    } });
    return true;
  } catch {
    await prisma.notificationInboxState.updateMany({ where: { userId: state.userId, signalLeaseToken: token }, data: {
      signalLeaseToken: null, signalLeaseExpiresAt: null,
      signalNextAttemptAt: new Date(clock() + retryDelay(state.signalAttemptCount)),
    } });
    getLogger().warn({ category: state.signalAttemptCount >= 10 ? 'SIGNAL_FAILED_RETRYING' : 'SIGNAL_UNAVAILABLE',
      attempts: state.signalAttemptCount }, 'notification signal will retry');
    return false;
  }
}

export async function cleanupNotifications(prisma: PrismaClient, clock: Clock = Date.now, limit = 100) {
  const now = new Date(clock());
  const due = await prisma.notification.findMany({ where: { expiresAt: { lte: now } },
    orderBy: { id: 'asc' }, take: limit, select: { id: true, recipientId: true } });
  let removed = 0;
  for (const recipientId of new Set(due.map((row) => row.recipientId))) {
    removed += await prisma.$transaction(async (tx) => {
      await lockInbox(tx, recipientId, now);
      const result = await tx.notification.deleteMany({ where: { recipientId, id: { in: due.map((row) => row.id) }, expiresAt: { lte: now } } });
      if (result.count) await tx.notificationInboxState.update({ where: { userId: recipientId }, data: { revision: { increment: 1n } } });
      return result.count;
    });
  }
  // Only empty expired events: never cascade notices without their owner's revision lock.
  await prisma.$executeRaw`DELETE FROM "NotificationEvent" WHERE id IN (
    SELECT e.id FROM "NotificationEvent" e WHERE e."expiresAt" <= ${now}
      AND NOT EXISTS (SELECT 1 FROM "Notification" n WHERE n."eventId" = e.id)
    ORDER BY e.id LIMIT ${limit})`;
  return removed;
}

export function startNotificationWorker(prisma: PrismaClient, publish: SignalPublisher) {
  let stopped = false, running: Promise<void> | undefined, ticks = 0;
  const tick = () => {
    if (stopped || running) return;
    running = (async () => {
      await fanoutOnce(prisma);
      if (stopped) return;
      // Bound each tick; durable outstanding owner rows converge across replicas.
      for (let i = 0; i < 20 && !stopped; i++) if (!await signalOnce(prisma, publish)) break;
      if (!stopped && ticks++ % 5 === 0) await scanExpiries(prisma);
      if (!stopped && ticks % 60 === 0) await cleanupNotifications(prisma);
    })().catch(() => getLogger().warn({ category: 'NOTIFICATION_WORK_UNAVAILABLE' }, 'notification work will resume'))
      .finally(() => { running = undefined; });
  };
  const timer = setInterval(tick, 1000); timer.unref(); tick();
  return { stop: async () => { stopped = true; clearInterval(timer); await running; } };
}
