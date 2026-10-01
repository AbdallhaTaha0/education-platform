/** M7-03 final-runtime flows: real DB ops through the NEW serving image's own code.
 *
 * Runs inside a container from edu-platform-server:0.7.0-m7-03-runtime on the
 * disposable m7-03-runtime network. Seeds run-owned rows directly (labelled
 * m7-03:<run> prefix), then drives SUPPORTED APIs only: register/login/CSRF,
 * inbox/catalog reads, admin recharge approval, student purchase/renewal and
 * authorization failures. No test-only application route, no DRM access.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { randomUUID, randomInt } = require('node:crypto');
const { createRequire } = require('node:module');
const fromServer = createRequire('/srv/server/package.json');
const { PrismaClient } = fromServer('@prisma/client');
const { hashPassword, PRODUCTION_ARGON2 } = fromServer('./dist/modules/identity/password.js');

const db = new PrismaClient();
const file = '/tmp/m7-03-runtime-flows.json';
const url = new URL(process.env.DATABASE_URL);
assert.equal(url.hostname, 'postgres');
assert.equal(url.pathname, '/education_platform');
assert.equal(process.env.ALLOWED_ORIGINS, 'http://localhost:8082');
assert.notEqual(process.env.NODE_ENV, 'production');
const entry = process.env.M7_ENTRY ?? 'http://nginx:8082';
assert.equal(entry, 'http://nginx:8082');
const ORIGIN = 'http://localhost:8082';
const prefix = () => `m7-03-${fixture.run}-`;

let fixture = null;

function jarFrom(headers) {
  const jar = new Map();
  for (const h of headers.getSetCookie()) {
    const pair = h.split(';')[0];
    const at = pair.indexOf('=');
    jar.set(pair.slice(0, at), pair.slice(at + 1));
  }
  return jar;
}
const cookies = (jar) => [...jar].map(([k, v]) => `${k}=${v}`).join('; ');
const csrfOf = (jar) => decodeURIComponent(jar.get('edu_csrf'));

async function csrfJar() {
  const res = await fetch(entry + '/api/auth/csrf');
  assert.equal(res.status, 200);
  return jarFrom(res.headers);
}

async function register(label) {
  const jar = await csrfJar();
  const credentials = {
    displayName: `M7-03 flow ${label}`,
    email: `m7-03-${fixture.run}-${label}@example.test`,
    phone: `011${randomInt(10000000, 100000000)}`,
    password: randomUUID() + '!a9A',
  };
  fixture.users.push({ label, email: credentials.email, password: credentials.password });
  fs.writeFileSync(file, JSON.stringify(fixture), { mode: 0o600 });
  const res = await fetch(entry + '/api/auth/register', {
    method: 'POST',
    headers: {
      Origin: ORIGIN,
      'Content-Type': 'application/json',
      Cookie: cookies(jar),
      'X-Csrf-Token': csrfOf(jar),
    },
    body: JSON.stringify(credentials),
  });
  assert.equal(res.status, 201, `${label} registration`);
  const body = await res.json();
  const user = fixture.users.at(-1);
  user.id = body.data.user.id;
  fs.writeFileSync(file, JSON.stringify(fixture), { mode: 0o600 });
  return { jar: jarFrom(res.headers), user };
}

async function login(email, password) {
  const jar = await csrfJar();
  const res = await fetch(entry + '/api/auth/login', {
    method: 'POST',
    headers: {
      Origin: ORIGIN,
      'Content-Type': 'application/json',
      Cookie: cookies(jar),
      'X-Csrf-Token': csrfOf(jar),
    },
    body: JSON.stringify({ identifier: email, password }),
  });
  assert.equal(res.status, 200, `login ${email}`);
  return jarFrom(res.headers);
}

async function api(method, path, jar, body) {
  const res = await fetch(entry + path, {
    method,
    headers: {
      Origin: ORIGIN,
      'Content-Type': 'application/json',
      ...(jar ? { Cookie: cookies(jar), 'X-Csrf-Token': csrfOf(jar) } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
    /* non-JSON ignored */
  }
  return { status: res.status, data };
}

async function seed() {
  assert.ok(!fs.existsSync(file), 'previous fixture receipt must be cleaned first');
  fixture = { run: randomUUID(), users: [], courses: [] };
  fs.writeFileSync(file, JSON.stringify(fixture), { mode: 0o600 });
  const a = await register('a');
  const b = await register('b');
  console.log(`register A/B 201, login verifies Argon2 next`);
  const admin = {
    label: 'admin',
    email: `m7-03-${fixture.run}-admin@example.test`,
    password: randomUUID() + '!a9A',
  };
  fixture.users.push(admin);
  fs.writeFileSync(file, JSON.stringify(fixture), { mode: 0o600 });
  const row = await db.user.create({
    data: {
      email: admin.email,
      phone: `012${randomInt(10000000, 100000000)}`,
      displayName: 'M7-03 flow admin',
      passwordHash: await hashPassword(admin.password, PRODUCTION_ARGON2),
      role: 'ADMIN',
    },
  });
  admin.id = row.id;
  const course = await db.course.create({
    data: {
      slug: `m7-03-${fixture.run}-course`,
      titleAr: 'دورة التحقق',
      titleEn: 'Verification course',
      descriptionAr: 'اختبار فقط',
      descriptionEn: 'Fixture only',
      status: 'PUBLISHED',
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
  fixture.courses.push({ id: course.id, slug: course.slug });
  const plan = await db.subscriptionPlan.create({
    data: { courseId: course.id, currentPricePiastres: 60000, durationDays: 90 },
  });
  fixture.planId = plan.id;
  const request = await db.rechargeRequest.create({
    data: {
      studentId: a.user.id,
      amountPiastres: 100000,
      channel: 'INSTAPAY',
      referenceNorm: randomUUID().replaceAll('-', '').toUpperCase(),
      senderName: 'M7-03 flow',
      senderPhone: '01012345678',
      transferDate: new Date(),
      proofFilename: 'fixture.png',
      proofMime: 'image/png',
      proofSize: 1,
      proofHash: 'e'.repeat(64),
      idempotencyKey: randomUUID(),
    },
  });
  fixture.requestId = request.id;
  fs.writeFileSync(file, JSON.stringify(fixture), { mode: 0o600 });

  const adminJar = await login(admin.email, admin.password);
  const studentJar = await login(a.user.email, a.user.password);
  console.log(`admin + student API logins 200 (Argon2 verify through serving runtime)`);
  const wallet0 = await api('GET', '/api/wallet', studentJar);
  assert.equal(wallet0.status, 200);
  assert.equal(wallet0.data.data.balancePiastres, 0);
  const inboxAnon = await api('GET', '/api/notifications', null);
  assert.equal(inboxAnon.status, 401);
  const inbox = await api('GET', '/api/notifications', studentJar);
  assert.equal(inbox.status, 200);
  const catalog = await api('GET', '/api/catalog/courses', null);
  assert.equal(catalog.status, 200);
  assert.ok(JSON.stringify(catalog.data).includes(course.slug), 'published course listed');

  const studentBJar = await login(b.user.email, b.user.password);
  const forbidden = await api(
    'POST',
    `/api/admin/recharge-requests/${request.id}/review`,
    studentBJar,
    { decision: 'APPROVE', receiptVerified: true },
  );
  console.log(
    `student approve attempt status=${forbidden.status} code=${forbidden.data?.error?.code ?? 'n/a'}`,
  );
  assert.equal(forbidden.status, 403);
  assert.equal(forbidden.data.error.code, 'FORBIDDEN');

  const approval = await api(
    'POST',
    `/api/admin/recharge-requests/${request.id}/review`,
    adminJar,
    { decision: 'APPROVE', receiptVerified: true },
  );
  assert.equal(approval.status, 200, 'admin approval');
  const wallet1 = await api('GET', '/api/wallet', studentJar);
  assert.equal(wallet1.data.data.balancePiastres, 100000);
  const recon1 = await api('GET', '/api/wallet/reconcile', studentJar);
  assert.equal(recon1.data.data.matches, true);
  console.log(
    `approval credited exact: balance=${wallet1.data.data.balancePiastres} ledgerMatch=${recon1.data.data.matches}`,
  );
  let inboxAfter = null;
  for (let attempt = 0; attempt < 10; attempt += 1) {
    inboxAfter = await api('GET', '/api/notifications', studentJar);
    assert.equal(inboxAfter.status, 200);
    if (inboxAfter.data.data.items.some((item) => item.type === 'RECHARGE_APPROVED')) break;
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }
  console.log(
    `approval notice visible after dispatcher poll: items=${inboxAfter.data.data.items.length}`,
  );
  assert.ok(
    inboxAfter.data.data.items.some((item) => item.type === 'RECHARGE_APPROVED'),
    'approval notice visible to requester',
  );
  const foreignInbox = await api('GET', '/api/notifications', studentBJar);
  assert.equal(foreignInbox.status, 200);
  assert.equal(foreignInbox.data.data.items.length, 0, 'approval notice is private to requester');

  const replay = await api('POST', `/api/admin/recharge-requests/${request.id}/review`, adminJar, {
    decision: 'APPROVE',
    receiptVerified: true,
  });
  assert.equal(replay.status, 409, 'duplicate approval immutable');
  const walletAfterReplay = await api('GET', '/api/wallet', studentJar);
  assert.equal(
    walletAfterReplay.data.data.balancePiastres,
    100000,
    'duplicate approval never credits again',
  );

  const purchase = await api('POST', '/api/wallet/purchases', studentJar, {
    planId: plan.id,
    idempotencyKey: randomUUID(),
  });
  assert.equal(purchase.status, 201, 'student purchase');
  assert.equal(purchase.data.data.pricePiastres, 60000);
  const sub = purchase.data.data.subscription;
  const spanMs = Date.parse(sub.expiresAt) - Date.parse(sub.startsAt);
  assert.equal(spanMs, 90 * 86400000, 'subscription duration is exact to the millisecond');
  const spanDays = spanMs / 86400000;
  assert.equal(spanDays, 90);
  const wallet2 = await api('GET', '/api/wallet', studentJar);
  assert.equal(wallet2.data.data.balancePiastres, 40000);
  const recon2 = await api('GET', '/api/wallet/reconcile', studentJar);
  assert.equal(recon2.data.data.matches, true);
  console.log(
    `purchase debited exact: balance=${wallet2.data.data.balancePiastres} spanDays=${spanDays} ledgerMatch=${recon2.data.data.matches}`,
  );

  const renewal = await api('POST', '/api/wallet/purchases', studentJar, {
    planId: plan.id,
    idempotencyKey: randomUUID(),
  });
  assert.equal(renewal.status, 402, 'second purchase needs funds (40000 < 60000)');
  const poor = await api('POST', '/api/wallet/purchases', studentBJar, {
    planId: plan.id,
    idempotencyKey: randomUUID(),
  });
  assert.equal(poor.status, 402, 'zero-balance purchase refused');
  console.log(`M7-03 runtime flows PASS: approval=100000 purchase=60000 renewal402 poor402.`);
}

async function cleanup() {
  if (!fs.existsSync(file)) return console.log('No M7-03 flow receipt exists.');
  fixture = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.match(fixture.run, /^[a-f0-9-]{36}$/);
  const userPrefix = `m7-03-${fixture.run}-`;
  const ownedUsers = await db.user.findMany({
    where: { email: { startsWith: userPrefix } },
    select: { id: true },
  });
  const ids = ownedUsers.map((r) => r.id);
  const ownedCourses = await db.course.findMany({
    where: { slug: { startsWith: userPrefix } },
    select: { id: true },
  });
  const courseIds = ownedCourses.map((r) => r.id);
  const ownedRequests = await db.rechargeRequest.findMany({
    where: { studentId: { in: ids } },
    select: { id: true },
  });
  await db.notificationEvent.deleteMany({
    where: {
      OR: [
        { courseId: { in: courseIds } },
        ...ownedRequests.map((r) => ({ eventKey: `recharge:${r.id}:decision` })),
      ],
    },
  });
  await db.auditEvent.deleteMany({ where: { actorUserId: { in: ids } } });
  await db.walletLedgerEntry.deleteMany({ where: { wallet: { userId: { in: ids } } } });
  await db.wallet.deleteMany({ where: { userId: { in: ids } } });
  await db.rechargeProof.deleteMany({ where: { request: { studentId: { in: ids } } } });
  await db.rechargeRequest.deleteMany({ where: { studentId: { in: ids } } });
  await db.purchase.deleteMany({ where: { studentId: { in: ids } } });
  await db.subscription.deleteMany({ where: { studentId: { in: ids } } });
  await db.course.deleteMany({ where: { slug: { startsWith: userPrefix } } });
  const users = await db.user.deleteMany({ where: { email: { startsWith: userPrefix } } });
  assert.equal(await db.user.count({ where: { email: { startsWith: userPrefix } } }), 0);
  fs.unlinkSync(file);
  console.log(`M7-03 flow cleanup PASS: users=${users.count}.`);
}

(async () => {
  try {
    if (process.argv[2] === 'cleanup') {
      await cleanup();
      return;
    }
    assert.equal(process.argv[2], 'seed');
    await seed();
  } catch (error) {
    console.error(
      `M7-03 flow operation failed: ${error instanceof assert.AssertionError ? error.message : 'API/database/file operation'}`,
    );
    process.exitCode = 1;
  } finally {
    await db.$disconnect();
  }
})();
