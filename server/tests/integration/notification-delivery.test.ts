import { randomUUID } from 'node:crypto';
import { createServer, type Server } from 'node:http';
import { io, type Socket } from 'socket.io-client';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import {
  createWorld,
  registerStudent,
  createTestAdmin,
  TEST_PASSWORD,
  TEST_ORIGIN,
  sessionIdFromJar,
  type IdentityWorld,
  type Credential,
} from './identity-helpers.js';
import { recordFirstPublication, recordExpiry } from '../../src/modules/notifications/producers.js';
import { reviewRecharge } from '../../src/modules/wallet/recharge/service.js';
import {
  fanoutOnce,
  signalOnce,
  cleanupNotifications,
} from '../../src/modules/notifications/delivery.js';
import {
  materializeNotification,
  NOTIFICATION_RETENTION_MS,
} from '../../src/modules/notifications/store.js';
import { setReadState } from '../../src/modules/notifications/service.js';
import { attachNotificationRealtime } from '../../src/modules/notifications/realtime.js';
import {
  requestTransition,
  archiveCourse,
  unarchiveCourse,
} from '../../src/modules/catalog/lifecycle/service.js';
import { ensureRedis } from '../../src/infra/redis.js';

describe('M6 committed producers, recoverable work and authorized multi-replica sockets', () => {
  let world: IdentityWorld,
    replica: PrismaClient,
    a: Credential,
    b: Credential,
    adminId: string,
    now: number;
  const courses: string[] = [],
    requests: string[] = [],
    events: string[] = [],
    subs: string[] = [];
  const clock = () => now;
  let servers: Server[] = [],
    runtimes: Awaited<ReturnType<typeof attachNotificationRealtime>>[] = [],
    sockets: Socket[] = [];
  const users: string[] = [];
  async function course() {
    const row = await world.prisma.course.create({
      data: {
        slug: `m6-delivery-${randomUUID()}`,
        titleAr: 'اختبار',
        titleEn: 'Fixture',
        descriptionAr: 'اختبار',
        descriptionEn: 'Fixture',
        status: 'READY',
      },
    });
    courses.push(row.id);
    return row;
  }
  async function event() {
    const row = await world.prisma.notificationEvent.create({
      data: {
        eventKey: `m6-delivery:${randomUUID()}`,
        type: 'RECHARGE_APPROVED',
        recordedAt: new Date(now),
        occurredAt: new Date(now),
        nextAttemptAt: new Date(now),
        expiresAt: new Date(now + NOTIFICATION_RETENTION_MS),
        audience: { create: [{ recipientId: a.user.id }, { recipientId: b.user.id }] },
      },
    });
    events.push(row.id);
    return row;
  }
  async function recharge() {
    const row = await world.prisma.rechargeRequest.create({
      data: {
        studentId: a.user.id,
        amountPiastres: 10000,
        channel: 'INSTAPAY',
        referenceNorm: randomUUID().replaceAll('-', '').toUpperCase(),
        senderName: 'Fixture',
        senderPhone: '01012345678',
        transferDate: new Date(),
        proofFilename: 'fixture.png',
        proofMime: 'image/png',
        proofSize: 1,
        proofHash: 'f'.repeat(64),
        idempotencyKey: randomUUID(),
      },
    });
    requests.push(row.id);
    return row;
  }
  async function subscription(courseId: string, expiry: number) {
    const id = randomUUID();
    subs.push(id);
    return world.prisma.subscription.create({
      data: {
        id,
        studentId: a.user.id,
        courseId,
        purchaseId: randomUUID(),
        startsAt: new Date(expiry - 86400000),
        expiresAt: new Date(expiry),
      },
    });
  }
  async function startReplica() {
    const server = createServer(world.app);
    servers.push(server);
    const runtime = await attachNotificationRealtime(
      server,
      {
        prisma: replica,
        redis: world.redis,
        clock,
        auth: {
          secret: world.config.jwtSecret,
          issuer: world.config.authIssuer,
          audience: world.config.authAudience,
          allowedOrigins: [TEST_ORIGIN],
        },
      },
      50,
    );
    runtimes.push(runtime);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address() as { port: number };
    return { runtime, url: `http://127.0.0.1:${address.port}` };
  }
  function socket(url: string, credential: Credential, extra: Record<string, unknown> = {}) {
    const s = io(url + '/notifications', {
      path: '/notifications/socket.io/',
      transports: ['websocket'],
      reconnection: false,
      extraHeaders: { Origin: TEST_ORIGIN, Cookie: credential.jar.header() },
      auth: { csrf: credential.jar.csrf(), ...extra },
    });
    sockets.push(s);
    return s;
  }
  const connected = (s: Socket) =>
    new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('socket fixture timeout')), 5000);
      s.once('connect', () => {
        clearTimeout(timer);
        resolve();
      });
      s.once('connect_error', (error) => {
        clearTimeout(timer);
        reject(error);
      });
    });
  beforeAll(async () => {
    now = Date.now();
    world = await createWorld({}, clock);
    replica = new PrismaClient();
    a = await registerStudent(world.app);
    b = await registerStudent(world.app);
    users.push(a.user.id, b.user.id);
    adminId = (await createTestAdmin(world, 'M6 delivery admin', TEST_PASSWORD)).id;
    users.push(adminId);
    await world.prisma.wallet.create({ data: { userId: a.user.id } });
    await ensureRedis(world.redis);
    // Expiry fixtures occur after the actual migration fence, without editing it.
    now += 10000;
  });
  beforeEach(async () => {
    sockets.forEach((s) => s.disconnect());
    sockets = [];
    for (const runtime of runtimes) await runtime.stop();
    runtimes = [];
    servers = [];
    await world.prisma.notificationEvent.deleteMany({
      where: {
        OR: [
          { id: { in: events } },
          { courseId: { in: courses } },
          ...requests.map((id) => ({ eventKey: `recharge:${id}:decision` })),
        ],
      },
    });
    events.length = 0;
    await world.prisma.notificationInboxState.deleteMany({ where: { userId: { in: users } } });
  });
  afterAll(async () => {
    sockets.forEach((s) => s.disconnect());
    for (const runtime of runtimes) await runtime.stop();
    await world.prisma.notificationEvent.deleteMany({
      where: {
        OR: [
          { id: { in: events } },
          { courseId: { in: courses } },
          ...requests.map((id) => ({ eventKey: `recharge:${id}:decision` })),
        ],
      },
    });
    await world.prisma.subscription.deleteMany({ where: { id: { in: subs } } });
    await world.prisma.course.deleteMany({ where: { id: { in: courses } } });
    await world.prisma.user.deleteMany({ where: { id: { in: users } } });
    await replica.$disconnect();
    await world.close();
  });
  it('commits one approval intent with one credit across six concurrent reviews; never buys', async () => {
    const row = await recharge(),
      initial = (await world.prisma.wallet.findUniqueOrThrow({ where: { userId: a.user.id } }))
        .balancePiastres;
    const outcomes = await Promise.allSettled(
      Array.from({ length: 6 }, () =>
        reviewRecharge(world.prisma, adminId, row.id, {
          decision: 'APPROVE',
          receiptVerified: true,
        }),
      ),
    );
    expect(outcomes.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(
      outcomes
        .filter((r) => r.status === 'rejected')
        .every((r) => (r as PromiseRejectedResult).reason.code === 'ALREADY_REVIEWED'),
    ).toBe(true);
    expect(
      (await world.prisma.wallet.findUniqueOrThrow({ where: { userId: a.user.id } }))
        .balancePiastres,
    ).toBe(initial + 10000);
    const intent = await world.prisma.notificationEvent.findUniqueOrThrow({
      where: { eventKey: `recharge:${row.id}:decision` },
      include: { audience: true },
    });
    expect(intent.type).toBe('RECHARGE_APPROVED');
    expect(intent.audience.map((r) => r.recipientId)).toEqual([a.user.id]);
    expect(await world.prisma.purchase.count({ where: { studentId: a.user.id } })).toBe(0);
    expect(
      (await world.prisma.rechargeRequest.findUniqueOrThrow({ where: { id: row.id } }))
        .notificationRecordedAt,
    ).not.toBeNull();
  });
  it('rejects without credit and preserves rejection privacy', async () => {
    const row = await recharge(),
      initial = (await world.prisma.wallet.findUniqueOrThrow({ where: { userId: a.user.id } }))
        .balancePiastres;
    await reviewRecharge(world.prisma, adminId, row.id, {
      decision: 'REJECT',
      reason: 'Private bank detail',
    });
    const intent = await world.prisma.notificationEvent.findUniqueOrThrow({
      where: { eventKey: `recharge:${row.id}:decision` },
    });
    expect(intent.type).toBe('RECHARGE_REJECTED');
    expect(JSON.stringify(intent)).not.toContain('Private bank detail');
    expect(
      (await world.prisma.wallet.findUniqueOrThrow({ where: { userId: a.user.id } }))
        .balancePiastres,
    ).toBe(initial);
  });
  it('rolls back decision, credit and intent when the transaction fails after intent insertion', async () => {
    const row = await recharge(),
      initial = (await world.prisma.wallet.findUniqueOrThrow({ where: { userId: a.user.id } }))
        .balancePiastres;
    const failing = new Proxy(world.prisma, {
      get(target, name) {
        if (name === '$transaction')
          return (fn: (tx: unknown) => Promise<unknown>) =>
            target.$transaction(async (tx) => {
              await fn(tx);
              throw new Error('rollback fixture');
            });
        const value = Reflect.get(target, name);
        return typeof value === 'function' ? value.bind(target) : value;
      },
    });
    await expect(
      reviewRecharge(failing, adminId, row.id, { decision: 'APPROVE', receiptVerified: true }),
    ).rejects.toThrow('rollback fixture');
    expect(
      (await world.prisma.rechargeRequest.findUniqueOrThrow({ where: { id: row.id } })).status,
    ).toBe('PENDING');
    expect(
      await world.prisma.notificationEvent.count({
        where: { eventKey: `recharge:${row.id}:decision` },
      }),
    ).toBe(0);
    expect(
      (await world.prisma.wallet.findUniqueOrThrow({ where: { userId: a.user.id } }))
        .balancePiastres,
    ).toBe(initial);
  });
  it('freezes all STUDENT recipients once; retries exclude later registrations and admins', async () => {
    const c = await course();
    await world.prisma.$transaction((tx) => recordFirstPublication(tx, c.id, new Date(now)));
    const source = await world.prisma.notificationEvent.findUniqueOrThrow({
      where: { eventKey: `course:${c.id}:first-publication` },
      include: { audience: true },
    });
    expect(source.audience.some((r) => r.recipientId === adminId)).toBe(false);
    expect(source.audience.map((r) => r.recipientId)).toEqual(
      expect.arrayContaining([a.user.id, b.user.id]),
    );
    const late = await registerStudent(world.app);
    users.push(late.user.id);
    await world.prisma.$transaction((tx) => recordFirstPublication(tx, c.id, new Date(now)));
    expect(
      await world.prisma.notificationEvent.count({ where: { eventKey: source.eventKey } }),
    ).toBe(1);
    expect(
      await world.prisma.notificationAudience.count({
        where: { eventId: source.id, recipientId: late.user.id },
      }),
    ).toBe(0);
    await world.prisma.notificationEvent.delete({ where: { id: source.id } });
    await world.prisma.$transaction((tx) => recordFirstPublication(tx, c.id, new Date(now)));
    expect(
      await world.prisma.notificationEvent.count({ where: { eventKey: source.eventKey } }),
    ).toBe(0);
  });
  it('invalid publication has no intent or marker', async () => {
    const c = await course();
    await expect(requestTransition(world.prisma, adminId, c.id, 'PUBLISHED')).rejects.toThrow();
    expect(await world.prisma.notificationEvent.count({ where: { courseId: c.id } })).toBe(0);
    expect(
      (await world.prisma.course.findUniqueOrThrow({ where: { id: c.id } })).firstPublicationAt,
    ).toBeNull();
  });
  it('records validated publication once and suppresses unarchive broadcasts', async () => {
    const c = await course();
    await world.prisma.subscriptionPlan.create({
      data: { courseId: c.id, currentPricePiastres: 10000, durationDays: 30 },
    });
    await world.prisma.courseSection.create({
      data: {
        courseId: c.id,
        titleAr: 'قسم',
        titleEn: 'Section',
        position: 1,
        lessons: {
          create: {
            titleAr: 'درس',
            titleEn: 'Lesson',
            position: 1,
            media: {
              create: {
                externalAssetId: randomUUID(),
                assetId: randomUUID(),
                idempotencyKey: randomUUID(),
                status: 'READY',
              },
            },
          },
        },
      },
    });
    const expected = await world.prisma.user.findMany({
      where: { role: 'STUDENT' },
      select: { id: true },
    });
    await requestTransition(world.prisma, adminId, c.id, 'PUBLISHED');
    const source = await world.prisma.notificationEvent.findUniqueOrThrow({
      where: { eventKey: `course:${c.id}:first-publication` },
      include: { audience: true },
    });
    expect(source.audience.map((row) => row.recipientId).sort()).toEqual(
      expected.map((row) => row.id).sort(),
    );
    const first = (await world.prisma.course.findUniqueOrThrow({ where: { id: c.id } }))
      .firstPublicationAt;
    await archiveCourse(world.prisma, adminId, c.id);
    await unarchiveCourse(world.prisma, adminId, c.id);
    expect(await world.prisma.notificationEvent.count({ where: { courseId: c.id } })).toBe(1);
    expect(
      (await world.prisma.course.findUniqueOrThrow({ where: { id: c.id } })).firstPublicationAt,
    ).toEqual(first);
  });
  it('retention cleanup does not regenerate a recharge decision or effective expiry', async () => {
    const row = await recharge();
    await reviewRecharge(world.prisma, adminId, row.id, {
      decision: 'APPROVE',
      receiptVerified: true,
    });
    const c = await course();
    await subscription(c.id, now - 1);
    expect(await recordExpiry(world.prisma, a.user.id, c.id, clock)).toBe(true);
    const deadline = now + NOTIFICATION_RETENTION_MS + 10000;
    await cleanupNotifications(world.prisma, () => deadline);
    expect(await recordExpiry(world.prisma, a.user.id, c.id, () => deadline)).toBe(false);
    await expect(
      reviewRecharge(world.prisma, adminId, row.id, { decision: 'APPROVE', receiptVerified: true }),
    ).rejects.toMatchObject({ code: 'ALREADY_REVIEWED' });
    expect(await world.prisma.notificationEvent.count({ where: { courseId: c.id } })).toBe(0);
    expect(
      (await world.prisma.rechargeRequest.findUniqueOrThrow({ where: { id: row.id } }))
        .notificationRecordedAt,
    ).not.toBeNull();
  });
  it('resumes partial fanout and simultaneous replicas materialize exactly once', async () => {
    const source = await event();
    expect(await fanoutOnce(world.prisma, clock, 1, source.id)).toBe(1);
    await Promise.all([
      fanoutOnce(world.prisma, clock, 100, source.id),
      fanoutOnce(replica, clock, 100, source.id),
    ]);
    expect(await world.prisma.notification.count({ where: { eventId: source.id } })).toBe(2);
    expect(
      (await world.prisma.notificationEvent.findUniqueOrThrow({ where: { id: source.id } }))
        .deliveryStatus,
    ).toBe('COMPLETED');
    expect(
      (
        await world.prisma.notificationInboxState.findUniqueOrThrow({
          where: { userId: a.user.id },
        })
      ).lastSequence,
    ).toBe(1n);
  });
  it('reclaims a crashed expired event lease', async () => {
    const source = await event();
    await world.prisma.notificationEvent.update({
      where: { id: source.id },
      data: {
        deliveryStatus: 'PROCESSING',
        leaseToken: randomUUID(),
        leaseExpiresAt: new Date(now - 1),
      },
    });
    expect(await fanoutOnce(replica, clock, 100, source.id)).toBe(2);
  });
  it('keeps a committed notice through signal failure and retries without repeating credit', async () => {
    const source = await event();
    await fanoutOnce(world.prisma, clock, 100, source.id);
    expect(
      await signalOnce(
        world.prisma,
        async () => {
          throw new Error('Redis outage fixture');
        },
        clock,
        a.user.id,
      ),
    ).toBe(false);
    expect(await world.prisma.notification.count({ where: { eventId: source.id } })).toBe(2);
    now += 1001;
    const published: string[] = [];
    await signalOnce(
      replica,
      async (_id, revision) => {
        published.push(revision);
      },
      clock,
      a.user.id,
    );
    expect(published).toEqual(['1']);
  });
  it('does not consume a new revision committed during publication of an older revision', async () => {
    const source = await event();
    await materializeNotification(world.prisma, source.id, a.user.id, clock);
    const notice = await world.prisma.notification.findFirstOrThrow({
      where: { eventId: source.id, recipientId: a.user.id },
    });
    await signalOnce(
      world.prisma,
      async () => {
        await setReadState({ prisma: replica, clock }, a.user.id, notice.id, true);
      },
      clock,
      a.user.id,
    );
    const state = await world.prisma.notificationInboxState.findUniqueOrThrow({
      where: { userId: a.user.id },
    });
    expect(state.revision).toBe(2n);
    expect(state.deliveredRevision).toBe(1n);
    expect(await signalOnce(replica, async () => {}, clock, a.user.id)).toBe(true);
  });
  it('ignores historical expiry and active early-renewal rows without playback references', async () => {
    const c = await course();
    const fence = (
      await world.prisma.notificationRollout.findUniqueOrThrow({ where: { id: 1 } })
    ).installedAt.getTime();
    await subscription(c.id, fence - 1);
    expect(await recordExpiry(world.prisma, a.user.id, c.id, clock)).toBe(false);
    await subscription(c.id, now - 1000);
    await subscription(c.id, now + 10000);
    expect(await recordExpiry(world.prisma, a.user.id, c.id, clock)).toBe(false);
    now += 10001;
    expect(await recordExpiry(world.prisma, a.user.id, c.id, clock)).toBe(true);
    expect(await recordExpiry(replica, a.user.id, c.id, clock)).toBe(false);
    expect(await world.prisma.playbackReference.count({ where: { studentId: a.user.id } })).toBe(0);
    await subscription(c.id, now + 10000);
    now += 10001;
    expect(await recordExpiry(world.prisma, a.user.id, c.id, clock)).toBe(true);
    expect(
      await world.prisma.notificationEvent.count({
        where: { courseId: c.id, type: 'SUBSCRIPTION_EXPIRED' },
      }),
    ).toBe(2);
  });
  it('rereads expiry after waiting for the renewal wallet lock', async () => {
    const c = await course();
    await subscription(c.id, now - 1);
    let release!: () => void, locked!: () => void;
    const acquired = new Promise<void>((r) => {
        locked = r;
      }),
      hold = new Promise<void>((r) => {
        release = r;
      });
    const renewal = world.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Course" WHERE id = ${c.id} FOR SHARE`;
      await tx.$queryRaw`SELECT id FROM "Wallet" WHERE "userId" = ${a.user.id} FOR UPDATE`;
      locked();
      await hold;
      const id = randomUUID();
      subs.push(id);
      await tx.subscription.create({
        data: {
          id,
          studentId: a.user.id,
          courseId: c.id,
          purchaseId: randomUUID(),
          startsAt: new Date(now),
          expiresAt: new Date(now + 10000),
        },
      });
    });
    await acquired;
    const scanning = recordExpiry(replica, a.user.id, c.id, clock);
    release();
    await renewal;
    expect(await scanning).toBe(false);
  });
  it('cleans exact retention boundaries, advances revision and retains immutable source markers', async () => {
    const source = await event();
    await materializeNotification(world.prisma, source.id, a.user.id, clock);
    expect(
      await cleanupNotifications(world.prisma, () => now + NOTIFICATION_RETENTION_MS - 1),
    ).toBe(0);
    expect(await cleanupNotifications(world.prisma, () => now + NOTIFICATION_RETENTION_MS)).toBe(1);
    expect(await world.prisma.notificationEvent.count({ where: { id: source.id } })).toBe(0);
    expect(
      (
        await world.prisma.notificationInboxState.findUniqueOrThrow({
          where: { userId: a.user.id },
        })
      ).revision,
    ).toBe(2n);
    expect(await materializeNotification(world.prisma, source.id, a.user.id, clock)).toBeNull();
    expect(await world.prisma.notificationRollout.count()).toBe(1);
  });
  it('delivers only a minimal revision across two real Redis-adapter replicas', async () => {
    const left = await startReplica(),
      right = await startReplica();
    await new Promise((resolve) => setTimeout(resolve, 100));
    const s = socket(left.url, a);
    await connected(s);
    const received = new Promise<unknown>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('revision fixture timeout')), 5000);
      s.on('notifications:changed', (signal) => {
        if (signal.revision === '1') {
          clearTimeout(timer);
          resolve(signal);
        }
      });
    });
    const source = await event();
    await materializeNotification(world.prisma, source.id, a.user.id, clock);
    await right.runtime.publish(a.user.id, '1');
    expect(await received).toEqual({ schemaVersion: 1, revision: '1' });
  });
  it('denies foreign recipient selection and missing session CSRF in handshakes', async () => {
    const node = await startReplica();
    await new Promise((resolve) => setTimeout(resolve, 100));
    const foreign = socket(node.url, a, { recipientId: b.user.id });
    await expect(connected(foreign)).rejects.toThrow();
    const bad = socket(node.url, a, { csrf: '0'.repeat(64) });
    await expect(connected(bad)).rejects.toThrow();
  });
  it('disconnects a revoked session and sends no subsequent private revision', async () => {
    const node = await startReplica();
    await new Promise((resolve) => setTimeout(resolve, 100));
    const s = socket(node.url, b);
    await connected(s);
    const messages: unknown[] = [];
    s.on('notifications:changed', (signal) => messages.push(signal));
    await world.prisma.authSession.update({
      where: { id: sessionIdFromJar(b.jar) },
      data: { revokedAt: new Date(now) },
    });
    const disconnected = new Promise<void>((resolve) => s.once('disconnect', () => resolve()));
    await node.runtime.publish(b.user.id, '99');
    await disconnected;
    expect(messages.some((signal) => (signal as { revision: string }).revision === '99')).toBe(
      false,
    );
  });
  it('disconnects at access expiry and never signals under the expired cookie identity', async () => {
    const node = await startReplica();
    const s = socket(node.url, a);
    await connected(s);
    const disconnected = new Promise<void>((resolve) => s.once('disconnect', () => resolve()));
    now += 16 * 60000;
    await node.runtime.publish(a.user.id, '999');
    await disconnected;
    expect(s.connected).toBe(false);
  });
});
