/** Docker-only acceptance harness. Never copied into application images. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { randomUUID } = require('node:crypto');
const { createRequire } = require('node:module');
const fromServer = createRequire('/srv/server/package.json');
const { PrismaClient } = fromServer('@prisma/client');
const { fanoutOnce, signalOnce, cleanupNotifications } = fromServer(
  './dist/modules/notifications/delivery.js',
);
const { reviewRecharge } = fromServer('./dist/modules/wallet/recharge/service.js');
const { requestTransition } = fromServer('./dist/modules/catalog/lifecycle/service.js');
const { recordExpiry } = fromServer('./dist/modules/notifications/producers.js');
const { createApp } = fromServer('./dist/app.js');
const { loadConfig } = fromServer('./dist/config.js');
const { createPostgresPool } = fromServer('./dist/infra/postgres.js');
const { createRedisClient, ensureRedis } = fromServer('./dist/infra/redis.js');
const { attachNotificationRealtime } = fromServer('./dist/modules/notifications/realtime.js');
const db = new PrismaClient();
assert.equal(process.env.NODE_ENV, 'test');
const url = new URL(process.env.DATABASE_URL);
assert.equal(url.hostname, 'postgres');
assert.equal(url.pathname, '/education_platform');
assert.equal(process.env.ALLOWED_ORIGINS, 'http://localhost:8082');
const command = process.argv[2],
  phase = process.argv[3];
const receipt = () => JSON.parse(fs.readFileSync('/evidence/private.json', 'utf8'));
const save = (name, value) =>
  fs.writeFileSync(
    `/evidence/${name}.json`,
    JSON.stringify(value, (_, v) => (typeof v === 'bigint' ? v.toString() : v), 2),
    { mode: 0o600 },
  );
const checks = [];
function check(label, value) {
  assert.ok(value, label);
  checks.push({ label, passed: true });
  console.log(`PASS ${label}`);
}
async function snapshot() {
  const f = receipt(),
    ids = f.users.map((u) => u.id);
  const wallet = await db.wallet.findMany({
    where: { userId: { in: ids } },
    orderBy: { id: 'asc' },
  });
  const ledger = await db.walletLedgerEntry.findMany({
    where: { wallet: { userId: { in: ids } } },
    orderBy: { id: 'asc' },
  });
  const subscriptions = await db.subscription.findMany({
    where: { studentId: { in: ids } },
    orderBy: { id: 'asc' },
  });
  const requests = await db.rechargeRequest.findMany({
    where: { studentId: { in: ids } },
    orderBy: { id: 'asc' },
  });
  const audit = await db.auditEvent.findMany({
    where: { actorUserId: { in: ids } },
    orderBy: { id: 'asc' },
  });
  return { wallet, ledger, subscriptions, requests, audit };
}
async function realtime() {
  const config = loadConfig(process.env),
    pool = createPostgresPool(config.databaseUrl),
    redis = createRedisClient(config.redisUrl);
  await ensureRedis(redis);
  const app = createApp({ config, postgresPool: pool, redisClient: redis, prisma: db });
  const server = app.listen(3000);
  const rt = await attachNotificationRealtime(server, app.get('identity'));
  return { rt, pool, redis };
}
async function freeze(label) {
  save(`${phase}-checkpoint`, { label, reachedAt: Date.now() });
  console.log(`BOUNDARY_HIT ${label}`);
  setInterval(() => {}, 1000); // Deterministic checkpoint stays alive until SIGKILL.
  await new Promise(() => {});
}
async function createSource() {
  const f = receipt(),
    a = f.users.find((u) => u.label === 'a'),
    admin = f.users.find((u) => u.label === 'admin');
  assert.match(f.run, /^[a-f0-9-]{36}$/);
  let event;
  if (['claim', 'signal', 'source'].includes(phase)) {
    const request = await db.rechargeRequest.create({
      data: {
        studentId: a.id,
        amountPiastres: 10000,
        channel: 'INSTAPAY',
        referenceNorm: randomUUID().replaceAll('-', '').toUpperCase(),
        senderName: 'M6 acceptance fixture',
        senderPhone: '01012345678',
        transferDate: new Date(),
        proofFilename: 'fixture.png',
        proofMime: 'image/png',
        proofSize: 1,
        proofHash: 'f'.repeat(64),
        idempotencyKey: randomUUID(),
      },
    });
    await reviewRecharge(db, admin.id, request.id, { decision: 'APPROVE', receiptVerified: true });
    event = await db.notificationEvent.findUniqueOrThrow({
      where: { eventKey: `recharge:${request.id}:decision` },
    });
  } else {
    const course = await db.course.create({
      data: {
        slug: `m6-ui-${f.run}-${phase}`,
        titleAr: 'اختبار التعافي',
        titleEn: 'Recovery fixture',
        descriptionAr: 'اختبار فقط',
        descriptionEn: 'Fixture only',
        status: 'READY',
        plans: { create: { currentPricePiastres: 1000, durationDays: 1 } },
        sections: {
          create: {
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
                    status: 'READY',
                    externalAssetId: randomUUID(),
                    assetId: randomUUID(),
                    idempotencyKey: randomUUID(),
                  },
                },
              },
            },
          },
        },
      },
    });
    await requestTransition(db, admin.id, course.id, 'PUBLISHED');
    event = await db.notificationEvent.findUniqueOrThrow({
      where: { eventKey: `course:${course.id}:first-publication` },
    });
  }
  const audience = await db.notificationAudience.findMany({
    where: { eventId: event.id },
    orderBy: { recipientId: 'asc' },
  });
  save(`${phase}-source`, {
    eventId: event.id,
    recipients: audience.map((r) => r.recipientId),
    finance: await snapshot(),
  });
  return event;
}
async function crash() {
  const event = await createSource();
  if (phase === 'source') return freeze('source transaction committed, no dispatcher claim');
  if (phase === 'signal') {
    assert.equal(await fanoutOnce(db, Date.now, 100, event.id), 1);
    const { rt } = await realtime();
    const owner = receipt().users.find((u) => u.label === 'a').id;
    await signalOnce(
      db,
      async (userId, revision) => {
        await rt.publish(userId, revision);
        await freeze('Redis published, deliveredRevision not committed');
      },
      Date.now,
      owner,
    );
    throw new Error('signal boundary was not hit');
  }
  let transactions = 0;
  const tx = db.$transaction.bind(db);
  const eventModel = db.notificationEvent;
  const wrappedEvents = new Proxy(eventModel, {
    get(target, name) {
      if (name === 'updateMany')
        return async (args) => {
          if (phase === 'fanout' && args.data.deliveryStatus === 'COMPLETED')
            await freeze('all recipient commits, event completion not committed');
          return target.updateMany(args);
        };
      const member = Reflect.get(target, name);
      return typeof member === 'function' ? member.bind(target) : member;
    },
  });
  const wrapped = new Proxy(db, {
    get(target, name) {
      if (name === '$transaction')
        return async (...args) => {
          const result = await tx(...args);
          transactions++;
          if (phase === 'claim' && transactions === 1)
            await freeze('claim committed, no recipient committed');
          if (phase === 'recipient' && transactions === 2)
            await freeze('first recipient committed, second pending');
          return result;
        };
      if (name === 'notificationEvent') return wrappedEvents;
      const member = Reflect.get(target, name);
      return typeof member === 'function' ? member.bind(target) : member;
    },
  });
  await fanoutOnce(wrapped, Date.now, 100, event.id);
  throw new Error('fanout boundary was not hit');
}
async function inspect() {
  const source = JSON.parse(fs.readFileSync(`/evidence/${phase}-source.json`, 'utf8'));
  const event = await db.notificationEvent.findUniqueOrThrow({
    where: { id: source.eventId },
    include: { audience: true },
  });
  event.notifications = await db.notification.findMany({ where: { eventId: event.id } });
  const expected =
    phase === 'recipient' ? 1 : ['fanout', 'signal'].includes(phase) ? source.recipients.length : 0;
  check(`${phase}: committed recipient boundary is exact`, event.notifications.length === expected);
  check(
    `${phase}: audience progress is atomic`,
    event.audience.filter((a) => a.materializedAt !== null).length === expected,
  );
  if (phase !== 'signal' && phase !== 'source')
    check(
      `${phase}: unfinished event retains a real lease`,
      event.deliveryStatus === 'PROCESSING' &&
        event.leaseToken !== null &&
        event.leaseExpiresAt > new Date(),
    );
  if (phase === 'signal') {
    const state = await db.notificationInboxState.findUniqueOrThrow({
      where: { userId: source.recipients[0] },
    });
    check(
      'signal: published revision remains due with crashed owner lease',
      state.revision > state.deliveredRevision && state.signalLeaseToken !== null,
    );
  }
  save(`${phase}-before`, { checks });
}
async function recovered() {
  const source = JSON.parse(fs.readFileSync(`/evidence/${phase}-source.json`, 'utf8'));
  const deadline = Date.now() + 45000;
  let event, states;
  while (Date.now() < deadline) {
    event = await db.notificationEvent.findUniqueOrThrow({
      where: { id: source.eventId },
      include: { audience: true },
    });
    event.notifications = await db.notification.findMany({ where: { eventId: event.id } });
    states = await db.notificationInboxState.findMany({
      where: { userId: { in: source.recipients } },
    });
    if (
      event.deliveryStatus === 'COMPLETED' &&
      states.length === source.recipients.length &&
      states.every((s) => s.revision === s.deliveredRevision)
    )
      break;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  check(
    `${phase}: restarted replicas finish abandoned work`,
    event.deliveryStatus === 'COMPLETED' && states.every((s) => s.revision === s.deliveredRevision),
  );
  check(
    `${phase}: one durable notice per frozen recipient`,
    event.notifications.length === source.recipients.length &&
      new Set(event.notifications.map((n) => n.recipientId)).size === source.recipients.length,
  );
  check(
    `${phase}: no recipient progress omitted`,
    event.audience.every((a) => a.materializedAt !== null),
  );
  const actualFinance = JSON.stringify(await snapshot(), (_, v) =>
    typeof v === 'bigint' ? v.toString() : v,
  );
  check(
    `${phase}: wallet, ledger, subscription, review and audit unchanged on recovery`,
    actualFinance === JSON.stringify(source.finance),
  );
  save(`${phase}-recovered`, { checks });
}
async function retention() {
  const before = await snapshot(),
    f = receipt(),
    ids = f.users.map((u) => u.id);
  const max = await db.notification.aggregate({
    where: { recipientId: { in: ids } },
    _max: { expiresAt: true },
  });
  assert.ok(max._max.expiresAt);
  const future = max._max.expiresAt.getTime();
  const oldCount = await db.notification.count({ where: { recipientId: { in: ids } } });
  await Promise.all([
    cleanupNotifications(db, () => future, 100),
    cleanupNotifications(db, () => future, 100),
  ]);
  check(
    'concurrent cleanup removes all owned notices at the exact cutoff',
    oldCount > 0 && (await db.notification.count({ where: { recipientId: { in: ids } } })) === 0,
  );
  check(
    'cleanup preserves financial, proof metadata, subscriptions and audits',
    JSON.stringify(await snapshot()) === JSON.stringify(before),
  );
  const course = await db.course.findUniqueOrThrow({ where: { id: f.courses[0].id } });
  check('publication marker survives retention', course.firstPublicationAt !== null);
  const owner = f.users.find((u) => u.label === 'a').id;
  const expiry = await db.notificationExpiryMarker.findUnique({
    where: { studentId_courseId: { studentId: owner, courseId: course.id } },
  });
  check(
    'expiry boundary marker survives retention and suppresses replay',
    expiry !== null && (await recordExpiry(db, owner, course.id)) === false,
  );
  for (const request of before.requests.filter((r) => r.status === 'APPROVED')) {
    await assert.rejects(
      reviewRecharge(db, f.users.find((u) => u.label === 'admin').id, request.id, {
        decision: 'APPROVE',
        receiptVerified: true,
      }),
      (e) => e.code === 'ALREADY_REVIEWED',
    );
  }
  check(
    'recharge retries cannot recreate expired notices',
    (await db.notificationEvent.count({ where: { type: 'RECHARGE_APPROVED' } })) === 0,
  );
  save('retention', { checks });
}
(async () => {
  try {
    if (command === 'listener') {
      await realtime();
      console.log('LISTENER_READY');
      return;
    }
    if (command === 'crash') await crash();
    else if (command === 'inspect') await inspect();
    else if (command === 'recovered') await recovered();
    else if (command === 'retention') await retention();
    else if (command === 'expiry') {
      const f = receipt(),
        owner = f.users.find((u) => u.label === 'a').id,
        courseId = f.courses[0].id;
      const changed = await db.subscription.updateMany({
        where: { studentId: owner, courseId },
        data: { startsAt: new Date(Date.now() - 86400000), expiresAt: new Date(Date.now() - 1) },
      });
      assert.equal(changed.count, 1);
      await recordExpiry(db, owner, courseId);
      console.log('Owned expiry fixture recorded without playback.');
    } else if (command === 'summary')
      save('final-data', {
        finances: await snapshot(),
        notices: await db.notification.count(),
        noticesByA: await db.notification.count({
          where: { recipientId: receipt().users.find((u) => u.label === 'a').id },
        }),
        events: await db.notificationEvent.count(),
      });
    else throw new Error('Unknown acceptance command');
  } catch (error) {
    console.error(
      error instanceof assert.AssertionError
        ? error.message
        : `Acceptance probe failed: ${command}/${phase}`,
    );
    process.exitCode = 1;
  } finally {
    if (command !== 'listener' && command !== 'crash') await db.$disconnect();
  }
})();
