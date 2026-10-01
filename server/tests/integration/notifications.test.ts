import { randomUUID } from 'node:crypto';
import { PrismaClient, type NotificationType } from '@prisma/client';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { materializeNotification, NOTIFICATION_RETENTION_MS } from '../../src/modules/notifications/store.js';
import { createWorld, registerStudent, createTestAdmin, loginWith, authedPost, sessionIdFromJar,
  TEST_ORIGIN, TEST_PASSWORD, type IdentityWorld, type Credential, type Jar } from './identity-helpers.js';

describe('M6 private durable inbox (real PostgreSQL and Redis)', () => {
  let world: IdentityWorld;
  let replica: PrismaClient;
  let a: Credential;
  let b: Credential;
  let admin: Credential;
  let now: number;
  const eventIds: string[] = [];
  const courseIds: string[] = [];
  const ownUsers: string[] = [];
  const clock = () => now;
  const inbox = (jar = a.jar, query: Record<string, string> = {}) =>
    request(world.app).get('/notifications').set('Cookie', jar.header()).query(query);
  const read = (id: string, value = true, jar = a.jar) => request(world.app)
    .put(`/notifications/${id}/read-state`).set('Cookie', jar.header())
    .set('Origin', TEST_ORIGIN).set('X-Csrf-Token', jar.csrf()).send({ read: value });
  const all = (sequence: string, jar = a.jar) =>
    authedPost(world.app, '/notifications/read-all', jar, { throughSequence: sequence });
  async function event(recipientId = a.user.id, type: NotificationType = 'RECHARGE_APPROVED',
    recordedAt = now, courseId: string | null = null) {
    const id = randomUUID();
    eventIds.push(id);
    return world.prisma.notificationEvent.create({ data: {
      id, eventKey: `m6-inbox-test:${id}`, type, courseId,
      occurredAt: new Date(recordedAt), recordedAt: new Date(recordedAt),
      expiresAt: new Date(recordedAt + NOTIFICATION_RETENTION_MS),
      audience: { create: { recipientId } },
    } });
  }
  async function notice(recipientId = a.user.id, type: NotificationType = 'RECHARGE_APPROVED',
    recordedAt = now, courseId: string | null = null) {
    const source = await event(recipientId, type, recordedAt, courseId);
    const result = await materializeNotification(world.prisma, source.id, recipientId, clock);
    if (!result) throw new Error('test notice was not materialized');
    return result;
  }
  beforeAll(async () => {
    now = Date.now();
    world = await createWorld({}, clock);
    replica = new PrismaClient();
    const studentA = await registerStudent(world.app);
    const studentB = await registerStudent(world.app);
    expect([studentA.status, studentB.status]).toEqual([201, 201]);
    a = studentA; b = studentB;
    const adminRow = await createTestAdmin(world, 'M6 owned admin', TEST_PASSWORD);
    const logged = await loginWith(world.app, adminRow.email);
    expect(logged.status).toBe(200); admin = logged;
    ownUsers.push(a.user.id, b.user.id, admin.user.id);
  });
  beforeEach(async () => {
    await world.prisma.notificationEvent.deleteMany({ where: { id: { in: eventIds } } });
    await world.prisma.notificationInboxState.deleteMany({ where: { userId: { in: ownUsers } } });
    await world.prisma.course.deleteMany({ where: { id: { in: courseIds } } });
    eventIds.length = 0; courseIds.length = 0;
  });
  afterAll(async () => {
    if (world) {
      await world.prisma.notificationEvent.deleteMany({ where: { id: { in: eventIds } } });
      await world.prisma.course.deleteMany({ where: { id: { in: courseIds } } });
      await world.prisma.user.deleteMany({ where: { id: { in: ownUsers } } });
      await world.close();
    }
    await replica?.$disconnect();
  });
  it('authenticates empty inbox/count and keeps responses out of caches', async () => {
    expect((await request(world.app).get('/notifications')).status).toBe(401);
    const res = await inbox();
    expect(res.status).toBe(200); expect(res.headers['cache-control']).toBe('no-store');
    expect(res.body.data).toEqual({ items: [], nextCursor: null, unreadCount: 0, revision: '0', throughSequence: '0' });
    const count = await request(world.app).get('/notifications/unread-count').set('Cookie', a.jar.header());
    expect(count.body.data).toEqual({ unreadCount: 0, revision: '0', throughSequence: '0' });
  });
  it('isolates recipients, including admins, and projects only safe bilingual fields', async () => {
    const own = await notice(); const foreign = await notice(b.user.id, 'RECHARGE_REJECTED');
    const res = await inbox(); expect(res.body.data.items.map((item: { id: string }) => item.id)).toEqual([own.id]);
    expect(res.body.data.items[0].target).toEqual({ kind: 'WALLET' });
    expect(Object.keys(res.body.data.items[0]).sort()).toEqual(['id', 'type', 'schemaVersion', 'sequence',
      'titleAr', 'titleEn', 'bodyAr', 'bodyEn', 'createdAt', 'occurredAt', 'expiresAt', 'readAt', 'target'].sort());
    for (const secret of [a.user.id, b.user.id, 'eventKey', 'signalPending', 'leaseToken', 'recipientId']) {
      expect(JSON.stringify(res.body)).not.toContain(secret);
    }
    const absent = await read(randomUUID()); const denied = await read(foreign.id);
    expect(denied.status).toBe(404);
    expect(denied.body.error).toMatchObject({ code: absent.body.error.code, message: absent.body.error.message });
    expect(Object.keys(denied.body.error).sort()).toEqual(['code', 'message', 'requestId']);
    expect((await inbox(admin.jar)).body.data.items).toEqual([]);
    expect((await read(own.id, true, admin.jar)).status).toBe(404);
    expect((await inbox(a.jar, { recipientId: b.user.id })).status).toBe(400);
  });
  it('requires Origin and CSRF for each write and rejects arbitrary creation/dismissal', async () => {
    const item = await notice();
    expect((await request(world.app).put(`/notifications/${item.id}/read-state`)
      .set('Cookie', a.jar.header()).send({ read: true })).status).toBe(403);
    expect((await request(world.app).put(`/notifications/${item.id}/read-state`)
      .set('Cookie', a.jar.header()).set('Origin', TEST_ORIGIN).send({ read: true })).status).toBe(403);
    expect((await request(world.app).post('/notifications').set('Cookie', a.jar.header()).send({})).status).toBe(404);
    expect((await request(world.app).delete(`/notifications/${item.id}`).set('Cookie', a.jar.header())).status).toBe(404);
    expect((await inbox()).body.data.unreadCount).toBe(1);
  });
  it('read/unread retries are idempotent and only real changes advance revision', async () => {
    const item = await notice();
    const first = await read(item.id);
    expect(first.body.data).toMatchObject({ unreadCount: 0, revision: '2', throughSequence: '1' });
    expect((await read(item.id)).body.data).toEqual(first.body.data);
    const unread = await read(item.id, false);
    expect(unread.body.data).toMatchObject({ unreadCount: 1, revision: '3', item: { readAt: null } });
    expect((await read(item.id, false)).body.data).toEqual(unread.body.data);
  });
  it('mark-all uses the observed sequence fence and leaves later arrivals unread', async () => {
    const old = await notice(); const observed = (await inbox()).body.data.throughSequence;
    const late = await notice(a.user.id, 'RECHARGE_REJECTED', now - 60000);
    const res = await all(observed);
    expect(res.body.data).toEqual({ changedCount: 1, unreadCount: 1, revision: '3', throughSequence: '2' });
    expect((await all(observed)).body.data.changedCount).toBe(0);
    const rows = (await inbox()).body.data.items;
    expect(rows.find((item: { id: string }) => item.id === old.id).readAt).not.toBeNull();
    expect(rows.find((item: { id: string }) => item.id === late.id).readAt).toBeNull();
    expect((await all('3')).status).toBe(400);
    expect((await all('0')).body.data.changedCount).toBe(0);
  });
  it('concurrent replicas materialize one event once without consuming duplicate sequences', async () => {
    const source = await event();
    const attempts = await Promise.all(Array.from({ length: 8 }, (_, index) =>
      materializeNotification(index % 2 ? replica : world.prisma, source.id, a.user.id, clock)));
    expect(new Set(attempts.map((item) => item!.id)).size).toBe(1);
    expect(attempts.filter((item) => item!.created)).toHaveLength(1);
    expect((await inbox()).body.data).toMatchObject({ unreadCount: 1, revision: '1', throughSequence: '1' });
    expect(await materializeNotification(world.prisma, source.id, b.user.id, clock)).toBeNull();
    expect((await inbox(b.jar)).body.data.throughSequence).toBe('0');
  });
  it('concurrent distinct events and read-all serialize per recipient', async () => {
    const first = await notice();
    const sources = await Promise.all(Array.from({ length: 6 }, () => event()));
    await Promise.all([all(first.sequence), ...sources.map((source, index) =>
      materializeNotification(index % 2 ? replica : world.prisma, source.id, a.user.id, clock))]);
    const res = await inbox();
    expect(res.body.data.items.map((item: { sequence: string }) => item.sequence)).toEqual(['7', '6', '5', '4', '3', '2', '1']);
    expect(res.body.data).toMatchObject({ unreadCount: 6, revision: '8', throughSequence: '7' });
  });
  it('stable cursor pages do not duplicate or skip older items when new notices arrive', async () => {
    for (let index = 0; index < 5; index++) await notice();
    const page = (await inbox(a.jar, { limit: '2' })).body.data;
    expect(page.items.map((item: { sequence: string }) => item.sequence)).toEqual(['5', '4']);
    await notice();
    const next = (await inbox(a.jar, { limit: '2', cursor: page.nextCursor })).body.data;
    expect(next.items.map((item: { sequence: string }) => item.sequence)).toEqual(['3', '2']);
    const last = (await inbox(a.jar, { limit: '2', cursor: next.nextCursor })).body.data;
    expect(last.items.map((item: { sequence: string }) => item.sequence)).toEqual(['1']);
    expect(last.nextCursor).toBeNull();
    await read(page.items[0].id);
    expect((await inbox(a.jar, { unreadOnly: 'true' })).body.data.items).toHaveLength(5);
    expect((await inbox(b.jar, { cursor: page.nextCursor })).body.data.items).toEqual([]);
  });
  it('excludes expiry exactly at 180 days even before physical cleanup', async () => {
    const item = await notice(a.user.id, 'RECHARGE_APPROVED', now - NOTIFICATION_RETENTION_MS + 1000);
    expect((await inbox()).body.data.unreadCount).toBe(1);
    now += 1000;
    expect((await inbox()).body.data.items).toEqual([]);
    expect((await inbox()).body.data.unreadCount).toBe(0);
    expect((await read(item.id)).status).toBe(404);
    expect((await all(item.sequence)).body.data.changedCount).toBe(0);
    expect(await world.prisma.notification.count({ where: { id: item.id } })).toBe(1);
    const expired = await event(a.user.id, 'RECHARGE_APPROVED', now - NOTIFICATION_RETENTION_MS);
    expect(await materializeNotification(world.prisma, expired.id, a.user.id, clock)).toBeNull();
  });
  it('removes course navigation for archived, pending-deletion and deleted targets', async () => {
    const course = await world.prisma.course.create({ data: {
      slug: `m6-${randomUUID()}`, titleAr: 'عنوان خاص', titleEn: 'Private title',
      descriptionAr: 'وصف', descriptionEn: 'Description', status: 'PUBLISHED',
    } }); courseIds.push(course.id);
    await notice(a.user.id, 'COURSE_PUBLISHED', now, course.id);
    expect((await inbox()).body.data.items[0].target).toEqual({ kind: 'COURSE_OFFER', slug: course.slug });
    expect(JSON.stringify((await inbox()).body)).not.toContain('Private title');
    await world.prisma.course.update({ where: { id: course.id }, data: { status: 'ARCHIVED' } });
    expect((await inbox()).body.data.items[0].target).toBeNull();
    await world.prisma.course.update({ where: { id: course.id }, data: { status: 'PUBLISHED', deletionRequestedAt: new Date(now) } });
    expect((await inbox()).body.data.items[0].target).toBeNull();
    await world.prisma.course.delete({ where: { id: course.id } });
    expect((await inbox()).body.data.items[0].target).toBeNull();
    expect((await inbox()).body.data.items).toHaveLength(1);
  });
  it('rejects malformed HTTP inputs without mutation', async () => {
    const item = await notice();
    for (const path of ['/notifications?limit=1&limit=2', '/notifications?cursor=0',
      '/notifications?unreadOnly=yes', '/notifications/unread-count?recipientId=x']) {
      expect((await request(world.app).get(path).set('Cookie', a.jar.header())).status).toBe(400);
    }
    for (const body of [{ read: 'true' }, { read: true, recipientId: b.user.id }, {}]) {
      expect((await request(world.app).put(`/notifications/${item.id}/read-state`)
        .set('Cookie', a.jar.header()).set('Origin', TEST_ORIGIN).set('X-Csrf-Token', a.jar.csrf()).send(body)).status).toBe(400);
    }
    expect((await read('not-a-uuid')).status).toBe(400);
    expect((await all('9223372036854775808')).status).toBe(400);
    expect((await inbox()).body.data).toMatchObject({ unreadCount: 1, revision: '1' });
  });
  it('enforces durable event uniqueness, exact retention and frozen audience membership', async () => {
    const source = await event();
    const data = { eventKey: source.eventKey, type: source.type, occurredAt: source.occurredAt,
      recordedAt: source.recordedAt, expiresAt: source.expiresAt };
    await expect(world.prisma.notificationEvent.create({ data })).rejects.toThrow();
    await expect(world.prisma.notificationEvent.create({ data: {
      ...data, eventKey: `m6-bad:${randomUUID()}`, expiresAt: new Date(now + 1000),
    } })).rejects.toThrow();
    await expect(world.prisma.notification.create({ data: {
      eventId: source.id, recipientId: b.user.id, recipientSequence: 1n,
      createdAt: source.recordedAt, occurredAt: source.occurredAt, expiresAt: source.expiresAt,
    } })).rejects.toThrow();
    expect((await inbox()).body.data.items).toEqual([]);
  });
  it('rolls back intent and audience with an aborted source transaction', async () => {
    const id = randomUUID(); eventIds.push(id);
    await expect(world.prisma.$transaction(async (tx) => {
      await tx.notificationEvent.create({ data: {
        id, eventKey: `m6-rollback:${id}`, type: 'RECHARGE_REJECTED', occurredAt: new Date(now),
        recordedAt: new Date(now), expiresAt: new Date(now + NOTIFICATION_RETENTION_MS),
        audience: { create: { recipientId: a.user.id } },
      } });
      throw new Error('abort source');
    })).rejects.toThrow('abort source');
    expect(await world.prisma.notificationEvent.findUnique({ where: { id } })).toBeNull();
    expect(await world.prisma.notificationAudience.count({ where: { eventId: id } })).toBe(0);
  });
  it('rolls back an inbox insertion if its atomic state update fails, allowing a clean retry', async () => {
    const source = await event();
    await world.prisma.notificationInboxState.create({ data: {
      userId: a.user.id, lastSequence: 1n, revision: 9223372036854775807n,
    } });
    await expect(materializeNotification(world.prisma, source.id, a.user.id, clock)).rejects.toThrow();
    expect(await world.prisma.notification.count({ where: { eventId: source.id } })).toBe(0);
    expect((await world.prisma.notificationAudience.findUnique({
      where: { eventId_recipientId: { eventId: source.id, recipientId: a.user.id } },
    }))?.materializedAt).toBeNull();
    expect((await world.prisma.notificationInboxState.findUnique({ where: { userId: a.user.id } }))?.lastSequence).toBe(1n);
    await world.prisma.notificationInboxState.update({ where: { userId: a.user.id }, data: { revision: 1n } });
    expect(await materializeNotification(world.prisma, source.id, a.user.id, clock)).toMatchObject({ created: true, sequence: '2' });
  });
  it('rechecks durable revocation instead of trusting an unexpired cookie', async () => {
    const own = await registerStudent(world.app); ownUsers.push(own.user.id);
    await world.prisma.authSession.update({ where: { id: sessionIdFromJar(own.jar) }, data: { revokedAt: new Date(now) } });
    expect((await inbox(own.jar)).status).toBe(401);
  });
  it('fails closed with a sanitized service error when Redis is unavailable', async () => {
    const dead = await createWorld({ redisUrl: 'redis://127.0.0.1:1' }, clock);
    try {
      const res = await request(dead.app).get('/notifications').set('Cookie', a.jar.header());
      expect(res.status).toBe(503);
      expect(res.body.error).toMatchObject({ code: 'NOTIFICATIONS_UNAVAILABLE', message: 'Notifications are temporarily unavailable.' });
      expect(Object.keys(res.body.error).sort()).toEqual(['code', 'message', 'requestId']);
      expect(JSON.stringify(res.body)).not.toContain('127.0.0.1');
    } finally { await dead.close(); }
  });
  it('fails closed when the durable session database cannot be reached', async () => {
    const dead = await createWorld({}, clock);
    const unavailable = new PrismaClient({ datasourceUrl: 'postgresql://test:test@127.0.0.1:1/unavailable?connect_timeout=1' });
    dead.app.get('identity').prisma = unavailable;
    try {
      const res = await request(dead.app).get('/notifications').set('Cookie', a.jar.header());
      expect(res.status).toBe(503);
      expect(res.body.error).toMatchObject({ code: 'NOTIFICATIONS_UNAVAILABLE', message: 'Notifications are temporarily unavailable.' });
      expect(Object.keys(res.body.error).sort()).toEqual(['code', 'message', 'requestId']);
      expect(JSON.stringify(res.body)).not.toContain('127.0.0.1');
    } finally { await unavailable.$disconnect(); await dead.close(); }
  });
});
