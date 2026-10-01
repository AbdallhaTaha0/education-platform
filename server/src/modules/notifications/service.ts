import { Prisma, type PrismaClient } from '@prisma/client';
import { ApiError } from '../identity/errors.js';
import type { Clock } from '../identity/tokens.js';
import { presentNotification, type PresentationRow } from './presentation.js';
import { lockInbox, type NotificationTx } from './store.js';
import type { InboxQuery } from './validation.js';

export interface NotificationContext {
  prisma: PrismaClient;
  clock?: Clock;
}
const rowInclude = { audience: { include: { event: true } } } as const;

async function metadata(tx: NotificationTx, userId: string, now: Date) {
  const state = await tx.notificationInboxState.findUnique({ where: { userId } });
  const unreadCount = await tx.notification.count({
    where: { recipientId: userId, readAt: null, expiresAt: { gt: now } },
  });
  return {
    unreadCount,
    revision: (state?.revision ?? 0n).toString(),
    throughSequence: (state?.lastSequence ?? 0n).toString(),
  };
}

async function presentRows(tx: NotificationTx, rows: PresentationRow[]) {
  const ids = [
    ...new Set(
      rows.map((row) => row.audience.event.courseId).filter((id): id is string => id !== null),
    ),
  ];
  const courses =
    ids.length === 0
      ? []
      : await tx.course.findMany({
          where: { id: { in: ids }, status: 'PUBLISHED', deletionRequestedAt: null },
          select: { id: true, slug: true },
        });
  const publicCourses = new Map(courses.map((course) => [course.id, course.slug]));
  return rows.map((row) => presentNotification(row, publicCourses));
}

export async function listInbox(ctx: NotificationContext, userId: string, query: InboxQuery) {
  return ctx.prisma.$transaction(
    async (tx) => {
      const now = new Date((ctx.clock ?? Date.now)());
      const rows = await tx.notification.findMany({
        where: {
          recipientId: userId,
          expiresAt: { gt: now },
          ...(query.unreadOnly ? { readAt: null } : {}),
          ...(query.before === undefined ? {} : { recipientSequence: { lt: query.before } }),
        },
        orderBy: { recipientSequence: 'desc' },
        take: query.limit + 1,
        include: rowInclude,
      });
      const page = rows.slice(0, query.limit);
      return {
        items: await presentRows(tx, page),
        nextCursor:
          rows.length > query.limit ? page[page.length - 1].recipientSequence.toString() : null,
        ...(await metadata(tx, userId, now)),
      };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
  );
}

export async function unreadCount(ctx: NotificationContext, userId: string) {
  return ctx.prisma.$transaction(
    (tx) => metadata(tx, userId, new Date((ctx.clock ?? Date.now)())),
    { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
  );
}

export async function setReadState(
  ctx: NotificationContext,
  userId: string,
  id: string,
  read: boolean,
) {
  return ctx.prisma.$transaction(async (tx) => {
    await lockInbox(tx, userId, new Date((ctx.clock ?? Date.now)()));
    const now = new Date((ctx.clock ?? Date.now)());
    const prior = await tx.notification.findFirst({
      where: { id, recipientId: userId, expiresAt: { gt: now } },
      include: rowInclude,
    });
    if (!prior) throw new ApiError(404, 'NOT_FOUND', 'Notification not found.');
    const changed = (prior.readAt !== null) !== read;
    const row = changed
      ? await tx.notification.update({
          where: { id: prior.id },
          data: { readAt: read ? now : null },
          include: rowInclude,
        })
      : prior;
    if (changed)
      await tx.notificationInboxState.update({
        where: { userId },
        data: { revision: { increment: 1n } },
      });
    return { item: (await presentRows(tx, [row]))[0], ...(await metadata(tx, userId, now)) };
  });
}

export async function readAll(ctx: NotificationContext, userId: string, through: bigint) {
  return ctx.prisma.$transaction(async (tx) => {
    const state = await lockInbox(tx, userId, new Date((ctx.clock ?? Date.now)()));
    const now = new Date((ctx.clock ?? Date.now)());
    if (through > state.lastSequence)
      throw new ApiError(400, 'VALIDATION_ERROR', 'Notification fence is beyond this inbox.');
    const changed = await tx.notification.updateMany({
      where: {
        recipientId: userId,
        recipientSequence: { lte: through },
        readAt: null,
        expiresAt: { gt: now },
      },
      data: { readAt: now },
    });
    if (changed.count > 0)
      await tx.notificationInboxState.update({
        where: { userId },
        data: { revision: { increment: 1n } },
      });
    return { changedCount: changed.count, ...(await metadata(tx, userId, now)) };
  });
}
