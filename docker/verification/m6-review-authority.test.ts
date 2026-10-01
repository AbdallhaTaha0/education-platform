/** Independent review-only reproduction, mounted into the Docker test image. */
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { io, type Socket } from 'socket.io-client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  createWorld,
  registerStudent,
  TEST_ORIGIN,
  type IdentityWorld,
  type Credential,
} from './identity-helpers.js';
import { attachNotificationRealtime } from '../../src/modules/notifications/realtime.js';
import { recordExpiry } from '../../src/modules/notifications/producers.js';
import { purchaseCourse } from '../../src/modules/wallet/purchase/service.js';

describe('independent M6 authority and scanner-first renewal reproduction', () => {
  let world: IdentityWorld, student: Credential;
  const courses: string[] = [];
  const sockets: Socket[] = [];
  beforeAll(async () => {
    world = await createWorld();
    student = await registerStudent(world.app);
  });
  afterAll(async () => {
    sockets.forEach((s) => s.disconnect());
    await world.prisma.notificationEvent.deleteMany({ where: { courseId: { in: courses } } });
    await world.prisma.auditEvent.deleteMany({ where: { actorUserId: student.user.id } });
    await world.prisma.course.deleteMany({ where: { id: { in: courses } } });
    await world.prisma.user.delete({ where: { id: student.user.id } });
    await world.close();
  });
  it('rejects absent/foreign Origin, absent access cookie and session-mismatched CSRF; disconnects on durable role change', async () => {
    const server = createServer(world.app);
    const runtime = await attachNotificationRealtime(server, world.app.get('identity'), 50);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address() as { port: number };
    function connect(headers: Record<string, string>, csrf = student.jar.csrf()) {
      const socket = io(`http://127.0.0.1:${address.port}/notifications`, {
        path: '/notifications/socket.io/',
        transports: ['websocket'],
        reconnection: false,
        extraHeaders: headers,
        auth: { csrf },
      });
      sockets.push(socket);
      return {
        socket,
        result: new Promise<void>((resolve, reject) => {
          const timer = setTimeout(() => reject(new Error('review connection timeout')), 3000);
          socket.once('connect', () => {
            clearTimeout(timer);
            resolve();
          });
          socket.once('connect_error', (error) => {
            clearTimeout(timer);
            reject(error);
          });
        }),
      };
    }
    try {
      for (const headers of [
        { Cookie: student.jar.header() },
        { Origin: 'http://foreign.test', Cookie: student.jar.header() },
        { Origin: TEST_ORIGIN },
      ]) {
        await expect(connect(headers).result).rejects.toThrow();
      }
      await expect(
        connect({ Origin: TEST_ORIGIN, Cookie: student.jar.header() }, 'invalid').result,
      ).rejects.toThrow();
      const authorized = connect({ Origin: TEST_ORIGIN, Cookie: student.jar.header() });
      await authorized.result;
      const signals: unknown[] = [];
      authorized.socket.on('notifications:changed', (signal) => signals.push(signal));
      const disconnected = new Promise<void>((resolve) =>
        authorized.socket.once('disconnect', () => resolve()),
      );
      await world.prisma.user.update({ where: { id: student.user.id }, data: { role: 'ADMIN' } });
      await runtime.publish(student.user.id, '777');
      await disconnected;
      expect(signals.some((s) => (s as { revision: string }).revision === '777')).toBe(false);
    } finally {
      sockets.forEach((s) => s.disconnect());
      await runtime.stop();
      await world.prisma.user.update({ where: { id: student.user.id }, data: { role: 'STUDENT' } });
    }
  });
  it('scanner holds wallet first: commits one valid lapse before the waiting real renewal extends access', async () => {
    const course = await world.prisma.course.create({
      data: {
        slug: `m6-review-${randomUUID()}`,
        titleAr: 'اختبار',
        titleEn: 'Fixture',
        descriptionAr: 'اختبار',
        descriptionEn: 'Fixture',
        status: 'PUBLISHED',
        plans: { create: { currentPricePiastres: 1000, durationDays: 1 } },
      },
      include: { plans: true },
    });
    courses.push(course.id);
    await world.prisma.wallet.create({ data: { userId: student.user.id, balancePiastres: 10000 } });
    const oldExpiry = new Date(Date.now() - 1);
    await world.prisma.subscription.create({
      data: {
        studentId: student.user.id,
        courseId: course.id,
        purchaseId: randomUUID(),
        startsAt: new Date(Date.now() - 86400000),
        expiresAt: oldExpiry,
      },
    });
    let held!: () => void, release!: () => void;
    const locked = new Promise<void>((resolve) => {
        held = resolve;
      }),
      wait = new Promise<void>((resolve) => {
        release = resolve;
      });
    const wrapped = new Proxy(world.prisma, {
      get(target, name) {
        if (name === '$transaction')
          return (fn: (tx: any) => Promise<unknown>) =>
            target.$transaction(async (tx) => {
              const proxy = new Proxy(tx, {
                get(transaction, field) {
                  if (field === 'notificationEvent')
                    return new Proxy(transaction.notificationEvent, {
                      get(model, operation) {
                        if (operation === 'create')
                          return async (args: any) => {
                            const row = await model.create(args);
                            held();
                            await wait;
                            return row;
                          };
                        const value = Reflect.get(model, operation);
                        return typeof value === 'function' ? value.bind(model) : value;
                      },
                    });
                  const value = Reflect.get(transaction, field);
                  return typeof value === 'function' ? value.bind(transaction) : value;
                },
              });
              return fn(proxy);
            });
        const value = Reflect.get(target, name);
        return typeof value === 'function' ? value.bind(target) : value;
      },
    });
    const scanning = recordExpiry(wrapped, student.user.id, course.id);
    await locked;
    let purchased = false;
    const renewal = purchaseCourse(world.prisma, student.user.id, {
      planId: course.plans[0].id,
      idempotencyKey: randomUUID(),
    }).then((result) => {
      purchased = true;
      return result;
    });
    try {
      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(purchased).toBe(false);
      expect(await world.prisma.notificationEvent.count({ where: { courseId: course.id } })).toBe(
        0,
      );
    } finally {
      release();
    }
    expect(await scanning).toBe(true);
    const purchase = await renewal;
    expect(new Date(purchase.subscription.expiresAt as string).getTime()).toBeGreaterThan(
      Date.now(),
    );
    expect(
      await world.prisma.notificationEvent.count({
        where: { courseId: course.id, type: 'SUBSCRIPTION_EXPIRED' },
      }),
    ).toBe(1);
    expect(
      (
        await world.prisma.notificationExpiryMarker.findUniqueOrThrow({
          where: { studentId_courseId: { studentId: student.user.id, courseId: course.id } },
        })
      ).recordedExpiry,
    ).toEqual(oldExpiry);
    expect(await recordExpiry(world.prisma, student.user.id, course.id)).toBe(false);
    expect(await world.prisma.purchase.count({ where: { studentId: student.user.id } })).toBe(1);
  });
});
