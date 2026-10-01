/** Test-only fixtures for the guarded preview, never a notification producer. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { randomUUID, randomInt } = require('node:crypto');
const { createRequire } = require('node:module');
const fromServer = createRequire('/srv/server/package.json');
const { PrismaClient } = fromServer('@prisma/client');
const { hashPassword, PRODUCTION_ARGON2 } = fromServer('./dist/modules/identity/password.js');
const { materializeNotification, NOTIFICATION_RETENTION_MS } = fromServer(
  './dist/modules/notifications/store.js',
);
const db = new PrismaClient();
const file = '/tmp/m6-inbox-ui-fixtures.json';
const url = new URL(process.env.DATABASE_URL);
assert.equal(url.hostname, 'postgres');
assert.equal(url.pathname, '/education_platform');
assert.equal(process.env.ALLOWED_ORIGINS, 'http://localhost:8082');
assert.notEqual(process.env.NODE_ENV, 'production');
const entry = process.env.M6_FIXTURE_ENTRY ?? 'http://nginx:8080';
assert.ok(['http://nginx:8080', 'http://nginx:8082'].includes(entry));

async function signup(fixture, label) {
  const jar = new Map();
  const csrfResponse = await fetch(entry + '/api/auth/csrf');
  for (const header of csrfResponse.headers.getSetCookie()) {
    const pair = header.split(';')[0],
      at = pair.indexOf('=');
    jar.set(pair.slice(0, at), pair.slice(at + 1));
  }
  const credentials = {
    displayName: `M6 UI fixture ${label}`,
    email: `m6-ui-${fixture.run}-${label}@example.test`,
    phone: `011${randomInt(10000000, 100000000)}`,
    password: randomUUID() + '!a9A',
  };
  // Persist ownership before mutation so cleanup can find partially created fixtures.
  fixture.users.push({ label, email: credentials.email, password: credentials.password });
  fs.writeFileSync(file, JSON.stringify(fixture), { mode: 0o600 });
  const res = await fetch(entry + '/api/auth/register', {
    method: 'POST',
    headers: {
      Origin: 'http://localhost:8082',
      'Content-Type': 'application/json',
      Cookie: [...jar].map(([key, value]) => `${key}=${value}`).join('; '),
      'X-Csrf-Token': decodeURIComponent(jar.get('edu_csrf')),
    },
    body: JSON.stringify(credentials),
  });
  assert.equal(res.status, 201, 'fixture registration');
  const body = await res.json();
  const user = fixture.users.at(-1);
  user.id = body.data.user.id;
  fs.writeFileSync(file, JSON.stringify(fixture), { mode: 0o600 });
  return user;
}
async function cleanup() {
  if (!fs.existsSync(file)) return console.log('No M6 UI fixture receipt exists.');
  const fixture = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.match(fixture.run, /^[a-f0-9-]{36}$/);
  const prefix = `m6-ui-${fixture.run}-`;
  const ownedUsers = await db.user.findMany({
    where: { email: { startsWith: prefix } },
    select: { id: true },
  });
  const ownedCourses = await db.course.findMany({
    where: { slug: { startsWith: prefix } },
    select: { id: true },
  });
  const ownedRequests = await db.rechargeRequest.findMany({
    where: { studentId: { in: ownedUsers.map((row) => row.id) } },
    select: { id: true },
  });
  await db.notificationEvent.deleteMany({
    where: {
      OR: [
        { courseId: { in: ownedCourses.map((row) => row.id) } },
        ...ownedRequests.map((row) => ({ eventKey: `recharge:${row.id}:decision` })),
      ],
    },
  });
  await db.auditEvent.deleteMany({
    where: { actorUserId: { in: ownedUsers.map((row) => row.id) } },
  });
  const events = await db.notificationEvent.deleteMany({
    where: { eventKey: { startsWith: `m6-ui:${fixture.run}:` } },
  });
  const courses = await db.course.deleteMany({ where: { slug: { startsWith: prefix } } });
  const users = await db.user.deleteMany({ where: { email: { startsWith: prefix } } });
  assert.equal(
    await db.notificationEvent.count({
      where: { eventKey: { startsWith: `m6-ui:${fixture.run}:` } },
    }),
    0,
  );
  assert.equal(await db.user.count({ where: { email: { startsWith: prefix } } }), 0);
  fs.unlinkSync(file);
  console.log(
    `M6 UI fixture cleanup PASS: users=${users.count}, courses=${courses.count}, events=${events.count}.`,
  );
}
(async () => {
  try {
    if (process.argv[2] === 'cleanup') {
      await cleanup();
      return;
    }
    if (process.argv[2] === 'expire') {
      const fixture = JSON.parse(fs.readFileSync(file, 'utf8'));
      assert.match(fixture.run, /^[a-f0-9-]{36}$/);
      const owner = await db.user.findFirstOrThrow({
        where: { email: `m6-ui-${fixture.run}-a@example.test` },
      });
      const course = await db.course.findFirstOrThrow({
        where: { slug: `m6-ui-${fixture.run}-ready` },
      });
      const result = await db.subscription.updateMany({
        where: { studentId: owner.id, courseId: course.id },
        data: { startsAt: new Date(Date.now() - 10000), expiresAt: new Date(Date.now() + 8000) },
      });
      assert.equal(result.count, 1);
      console.log('M6 owned expiry fixture scheduled in eight seconds.');
      return;
    }
    const realtime = process.argv[2] === 'seed-realtime';
    assert.ok(realtime || process.argv[2] === 'seed');
    assert.ok(!fs.existsSync(file), 'previous fixture receipt must be cleaned first');
    if (realtime)
      assert.equal(
        await db.user.count({ where: { role: 'STUDENT' } }),
        0,
        'broadcast verification needs an empty student audience',
      );
    const fixture = {
      run: randomUUID(),
      users: [],
      courses: [],
      ownNoticeIds: [],
      foreignNoticeIds: [],
    };
    fs.writeFileSync(file, JSON.stringify(fixture), { mode: 0o600 });
    const a = await signup(fixture, 'a'),
      b = await signup(fixture, 'b');
    const admin = {
      label: 'admin',
      email: `m6-ui-${fixture.run}-admin@example.test`,
      password: randomUUID() + '!a9A',
    };
    fixture.users.push(admin);
    fs.writeFileSync(file, JSON.stringify(fixture), { mode: 0o600 });
    // An explicit internal ADMIN fixture, not a bootstrap or product-policy change.
    const row = await db.user.create({
      data: {
        email: admin.email,
        phone: `012${randomInt(10000000, 100000000)}`,
        displayName: 'M6 UI fixture admin',
        passwordHash: await hashPassword(admin.password, PRODUCTION_ARGON2),
        role: 'ADMIN',
      },
    });
    admin.id = row.id;
    for (const status of realtime ? ['READY'] : ['PUBLISHED', 'ARCHIVED']) {
      const course = await db.course.create({
        data: {
          slug: `m6-ui-${fixture.run}-${status.toLowerCase()}`,
          titleAr: 'دورة اختبار الإشعارات',
          titleEn: 'Notification test course',
          descriptionAr: 'اختبار فقط',
          descriptionEn: 'Fixture only',
          status,
        },
      });
      fixture.courses.push({ id: course.id, slug: course.slug, status });
      if (realtime) {
        const plan = await db.subscriptionPlan.create({
          data: { courseId: course.id, currentPricePiastres: 1000, durationDays: 1 },
        });
        fixture.planId = plan.id;
        await db.courseSection.create({
          data: {
            courseId: course.id,
            titleAr: 'قسم اختبار',
            titleEn: 'Fixture section',
            position: 1,
            lessons: {
              create: {
                titleAr: 'درس اختبار',
                titleEn: 'Fixture lesson',
                position: 1,
                media: {
                  create: {
                    status: 'READY',
                    externalAssetId: randomUUID(),
                    assetId: randomUUID(),
                    idempotencyKey: randomUUID(),
                  },
                },
              },
            },
          },
        });
      }
    }
    if (realtime) {
      const request = await db.rechargeRequest.create({
        data: {
          studentId: a.id,
          amountPiastres: 10000,
          channel: 'INSTAPAY',
          referenceNorm: randomUUID().replaceAll('-', '').toUpperCase(),
          senderName: 'M6 fixture',
          senderPhone: '01012345678',
          transferDate: new Date(),
          proofFilename: 'fixture.png',
          proofMime: 'image/png',
          proofSize: 1,
          proofHash: 'f'.repeat(64),
          idempotencyKey: randomUUID(),
        },
      });
      fixture.requestId = request.id;
      fs.writeFileSync(file, JSON.stringify(fixture), { mode: 0o600 });
      console.log(
        'M6 realtime seed PASS: two students, one admin, one READY course and one pending recharge; no synthetic notice.',
      );
      return;
    }
    const types = [
      'RECHARGE_APPROVED',
      'RECHARGE_REJECTED',
      'COURSE_PUBLISHED',
      'SUBSCRIPTION_EXPIRED',
    ];
    async function notice(recipient, index) {
      const type = types[index % 4],
        now = new Date();
      const source = await db.notificationEvent.create({
        data: {
          eventKey: `m6-ui:${fixture.run}:${recipient.label}:${index}`,
          type,
          courseId: index % 4 < 2 ? null : fixture.courses[index % 3 === 0 ? 1 : 0].id,
          recordedAt: now,
          occurredAt: type === 'SUBSCRIPTION_EXPIRED' ? new Date(now.getTime() - 86400000) : now,
          expiresAt: new Date(now.getTime() + NOTIFICATION_RETENTION_MS),
          audience: { create: { recipientId: recipient.id } },
        },
      });
      return (await materializeNotification(db, source.id, recipient.id)).id;
    }
    for (let index = 0; index < 105; index++) fixture.ownNoticeIds.push(await notice(a, index));
    fixture.foreignNoticeIds.push(await notice(b, 1));
    fs.writeFileSync(file, JSON.stringify(fixture), { mode: 0o600 });
    console.log('M6 UI fixture seed PASS: students=2, admin=1, courses=2, synthetic notices=106.');
  } catch (error) {
    console.error(
      `M6 UI fixture operation failed: ${error instanceof assert.AssertionError ? error.message : 'API/database/file operation'}`,
    );
    process.exitCode = 1;
  } finally {
    await db.$disconnect();
  }
})();
