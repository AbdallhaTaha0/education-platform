import { randomUUID } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import { withEntityLocks } from '../../infra/locks-do.js';
import { materializeNotification, lockInbox } from './store.js';
import type { Clock } from '../identity/tokens.js';
import { scanExpiries } from './producers.js';
import { getLogger } from '../../logger.js';

export type SignalPublisher = (userId: string, revision: string) => Promise<void>;
const LEASE_MS = 30000;
export function retryDelay(attempt: number) {
  return Math.min(300000, 1000 * 2 ** Math.min(attempt - 1, 9));
}

export async function fanoutOnce(
  prisma: PrismaClient,
  clock: Clock = Date.now,
  batch = 100,
  eventId?: string,
) {
  const now = new Date(clock()),
    token = randomUUID();
  const event = await withEntityLocks(['cron:notifications:fanout'], () =>
    prisma.$transaction(async (tx) => {
      const candidate = await tx.notificationEvent.findFirst({
        where: {
          expiresAt: { gt: now },
          deliveryStatus: { not: 'COMPLETED' },
          nextAttemptAt: { lte: now },
          ...(eventId ? { id: eventId } : {}),
          OR: [{ leaseExpiresAt: null }, { leaseExpiresAt: { lte: now } }],
        },
        orderBy: [{ nextAttemptAt: 'asc' }, { id: 'asc' }],
        select: { id: true },
      });
      if (!candidate) return null;
      return tx.notificationEvent.update({
        where: { id: candidate.id },
        data: {
          deliveryStatus: 'PROCESSING',
          leaseToken: token,
          leaseExpiresAt: new Date(now.getTime() + LEASE_MS),
          attemptCount: { increment: 1 },
        },
      });
    }),
  );
  if (!event) return 0;
  try {
    const recipients = await prisma.notificationAudience.findMany({
      where: { eventId: event.id, materializedAt: null },
      orderBy: { recipientId: 'asc' },
      take: batch,
    });
    for (const recipient of recipients) {
      const owned = await prisma.notificationEvent.updateMany({
        where: { id: event.id, leaseToken: token, leaseExpiresAt: { gt: new Date(clock()) } },
        data: { leaseExpiresAt: new Date(clock() + LEASE_MS) },
      });
      if (!owned.count) return 0;
      await materializeNotification(prisma, event.id, recipient.recipientId, clock);
    }
    const pending = await prisma.notificationAudience.count({
      where: { eventId: event.id, materializedAt: null },
    });
    await prisma.notificationEvent.updateMany({
      where: { id: event.id, leaseToken: token },
      data: {
        deliveryStatus: pending ? 'PENDING' : 'COMPLETED',
        fanoutCursor: recipients.at(-1)?.recipientId,
        leaseToken: null,
        leaseExpiresAt: null,
        attemptCount: 0,
        nextAttemptAt: new Date(clock()),
        lastErrorCategory: null,
      },
    });
    return recipients.length;
  } catch {
    await prisma.notificationEvent.updateMany({
      where: { id: event.id, leaseToken: token },
      data: {
        deliveryStatus: event.attemptCount >= 10 ? 'FAILED' : 'PENDING',
        leaseToken: null,
        leaseExpiresAt: null,
        nextAttemptAt: new Date(clock() + retryDelay(event.attemptCount)),
        lastErrorCategory: 'FANOUT_UNAVAILABLE',
      },
    });
    getLogger().warn(
      { category: 'FANOUT_UNAVAILABLE', attempts: event.attemptCount },
      'notification fanout will retry',
    );
    return 0;
  }
}

/** One coalesced durable signal per owner covers inserts, read changes and cleanup. */
export async function signalOnce(
  prisma: PrismaClient,
  publish: SignalPublisher,
  clock: Clock = Date.now,
  userId?: string,
) {
  const now = new Date(clock()),
    token = randomUUID();
  const state = await withEntityLocks(['cron:notifications:signal'], () =>
    prisma.$transaction(async (tx) => {
      const candidates = await tx.notificationInboxState.findMany({
        where: {
          signalNextAttemptAt: { lte: now },
          ...(userId ? { userId } : {}),
          OR: [{ signalLeaseExpiresAt: null }, { signalLeaseExpiresAt: { lte: now } }],
        },
        orderBy: [{ signalNextAttemptAt: 'asc' }, { userId: 'asc' }],
        take: 25,
        select: { userId: true, revision: true, deliveredRevision: true },
      });
      const due = candidates.find((c) => c.revision > c.deliveredRevision);
      if (!due) return null;
      return tx.notificationInboxState.update({
        where: { userId: due.userId },
        data: {
          signalLeaseToken: token,
          signalLeaseExpiresAt: new Date(now.getTime() + LEASE_MS),
          signalAttemptCount: { increment: 1 },
        },
      });
    }),
  );
  if (!state) return false;
  try {
    await publish(state.userId, state.revision.toString());
    await prisma.notificationInboxState.updateMany({
      where: { userId: state.userId, signalLeaseToken: token },
      data: {
        deliveredRevision: state.revision,
        signalLeaseToken: null,
        signalLeaseExpiresAt: null,
        signalAttemptCount: 0,
        signalNextAttemptAt: new Date(clock()),
      },
    });
    return true;
  } catch {
    await prisma.notificationInboxState.updateMany({
      where: { userId: state.userId, signalLeaseToken: token },
      data: {
        signalLeaseToken: null,
        signalLeaseExpiresAt: null,
        signalNextAttemptAt: new Date(clock() + retryDelay(state.signalAttemptCount)),
      },
    });
    getLogger().warn(
      {
        category: state.signalAttemptCount >= 10 ? 'SIGNAL_FAILED_RETRYING' : 'SIGNAL_UNAVAILABLE',
        attempts: state.signalAttemptCount,
      },
      'notification signal will retry',
    );
    return false;
  }
}

export async function cleanupNotifications(
  prisma: PrismaClient,
  clock: Clock = Date.now,
  limit = 100,
) {
  const now = new Date(clock());
  const due = await prisma.notification.findMany({
    where: { expiresAt: { lte: now } },
    orderBy: { id: 'asc' },
    take: limit,
    select: { id: true, recipientId: true },
  });
  let removed = 0;
  for (const recipientId of new Set(due.map((row) => row.recipientId))) {
    removed += await withEntityLocks([`inbox:${recipientId}`], () =>
      prisma.$transaction(async (tx) => {
        await lockInbox(tx, recipientId, now);
        const result = await tx.notification.deleteMany({
          where: { recipientId, id: { in: due.map((row) => row.id) }, expiresAt: { lte: now } },
        });
        if (result.count)
          await tx.notificationInboxState.update({
            where: { userId: recipientId },
            data: { revision: { increment: 1n } },
          });
        return result.count;
      }),
    );
  }
  await prisma.$executeRaw`DELETE FROM "NotificationEvent" WHERE id IN (
    SELECT e.id FROM "NotificationEvent" e WHERE e."expiresAt" <= ${now}
      AND NOT EXISTS (SELECT 1 FROM "Notification" n WHERE n."eventId" = e.id)
    ORDER BY e.id LIMIT ${limit})`;
  return removed;
}

/** Single-pass delivery helper invoked by Cloudflare Cron Triggers. */
export async function runNotificationDeliveryPass(
  prisma: PrismaClient,
  publish: SignalPublisher,
  clock: Clock = Date.now,
): Promise<void> {
  await withEntityLocks(['cron:notifications'], async () => {
    await fanoutOnce(prisma, clock);
    for (let i = 0; i < 20; i++) {
      if (!(await signalOnce(prisma, publish, clock))) break;
    }
    await scanExpiries(prisma, clock);
  });
}

export function startNotificationWorker(prisma: PrismaClient, publish: SignalPublisher) {
  let stopped = false,
    running: Promise<void> | undefined,
    ticks = 0;
  const tick = () => {
    if (stopped || running) return;
    running = (async () => {
      await fanoutOnce(prisma);
      if (stopped) return;
      for (let i = 0; i < 20 && !stopped; i++) if (!(await signalOnce(prisma, publish))) break;
      if (!stopped && ticks++ % 5 === 0) await scanExpiries(prisma);
      if (!stopped && ticks % 60 === 0) await cleanupNotifications(prisma);
    })()
      .catch(() =>
        getLogger().warn(
          { category: 'NOTIFICATION_WORK_UNAVAILABLE' },
          'notification work will resume',
        ),
      )
      .finally(() => {
        running = undefined;
      });
  };
  const timer = setInterval(tick, 1000);
  timer.unref();
  tick();
  return {
    stop: async () => {
      stopped = true;
      clearInterval(timer);
      await running;
    },
  };
}
