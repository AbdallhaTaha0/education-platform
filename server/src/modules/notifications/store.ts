import { Prisma, type PrismaClient } from '@prisma/client';
import type { Clock } from '../identity/tokens.js';

export const NOTIFICATION_RETENTION_MS = 180 * 86400 * 1000;
export type NotificationTx = Prisma.TransactionClient;

/** ON CONFLICT handles a first-writer race; an empty Prisma update is not a row lock. */
export async function lockInbox(tx: NotificationTx, userId: string, now: Date) {
  await tx.$executeRaw`INSERT INTO "NotificationInboxState" ("userId", "lastSequence", revision, "updatedAt")
    VALUES (${userId}, 0, 0, ${now}) ON CONFLICT ("userId") DO NOTHING`;
  const rows = await tx.$queryRaw<Array<{ lastSequence: bigint; revision: bigint }>>`
    SELECT "lastSequence", revision FROM "NotificationInboxState" WHERE "userId" = ${userId} FOR UPDATE`;
  if (!rows[0]) throw new Error('Notification inbox state is missing.');
  return rows[0];
}

/** Internal-only consumer of a frozen audience, never an HTTP notification-creation API. */
export async function materializeNotification(
  prisma: PrismaClient,
  eventId: string,
  recipientId: string,
  clock: Clock = Date.now,
) {
  return prisma.$transaction(async (tx) => {
    const state = await lockInbox(tx, recipientId, new Date(clock()));
    const now = new Date(clock());
    const audience = await tx.notificationAudience.findUnique({
      where: { eventId_recipientId: { eventId, recipientId } },
      include: { event: true },
    });
    if (audience === null || audience.event.expiresAt <= now) return null;
    // Rechecked after the inbox lock so two replicas observe the winner.
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
  });
}
