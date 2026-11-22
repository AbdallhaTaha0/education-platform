import { Prisma, type PrismaClient } from '@prisma/client';
import { withEntityLocks } from '../../infra/locks-do.js';
import type { Clock } from '../identity/tokens.js';

export const NOTIFICATION_RETENTION_MS = 180 * 86400 * 1000;
export type NotificationTx = Prisma.TransactionClient;

/** Ensure inbox state row exists; callers serialize via `withEntityLocks([`inbox:${userId}`])`. */
export async function lockInbox(tx: NotificationTx, userId: string, now: Date) {
  const row = await tx.notificationInboxState.upsert({
    where: { userId },
    create: { userId, lastSequence: 0n, revision: 0n, updatedAt: now },
    update: {},
    select: { lastSequence: true, revision: true },
  });
  return row;
}

/** Internal-only consumer of a frozen audience, never an HTTP notification-creation API. */
export async function materializeNotification(
  prisma: PrismaClient,
  eventId: string,
  recipientId: string,
  clock: Clock = Date.now,
) {
  return withEntityLocks([`inbox:${recipientId}`], () =>
    prisma.$transaction(async (tx) => {
      const state = await lockInbox(tx, recipientId, new Date(clock()));
      const now = new Date(clock());
      const audience = await tx.notificationAudience.findUnique({
        where: { eventId_recipientId: { eventId, recipientId } },
        include: { event: true },
      });
      if (audience === null || audience.event.expiresAt <= now) return null;
      const prior = await tx.notification.findUnique({
        where: { eventId_recipientId: { eventId, recipientId } },
      });
      if (prior)
        return { id: prior.id, sequence: prior.recipientSequence.toString(), created: false };
      const event = audience.event;
      const created = await tx.notification.create({
        data: {
          eventId,
          recipientId,
          recipientSequence: state.lastSequence + 1n,
          createdAt: event.recordedAt,
          occurredAt: event.occurredAt,
          expiresAt: event.expiresAt,
          nextSignalAt: now,
        },
      });
      await tx.notificationInboxState.update({
        where: { userId: recipientId },
        data: {
          lastSequence: { increment: 1n },
          revision: { increment: 1n },
        },
      });
      await tx.notificationAudience.update({
        where: { eventId_recipientId: { eventId, recipientId } },
        data: { materializedAt: now },
      });
      return { id: created.id, sequence: created.recipientSequence.toString(), created: true };
    }),
  );
}
