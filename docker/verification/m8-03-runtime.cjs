// Final serving-image service flow, no dev dependencies, no public ports/media.
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { PrismaClient } = require('/srv/server/node_modules/@prisma/client');
const { savePackage } = require('/srv/server/dist/modules/catalog/packages.js');
const { purchasePackage } = require('/srv/server/dist/modules/wallet/purchase/packages.js');
const { lockWallet, postEntry } = require('/srv/server/dist/modules/wallet/ledger.js');
const { evaluateEntitlement } = require('/srv/server/dist/modules/learning/access/entitlement.js');
const argon2 = require('/srv/server/node_modules/argon2');
assert(process.env.DATABASE_URL.endsWith('/education_platform_test'), 'isolated runtime DB guard');
const db = new PrismaClient();
const tag = crypto.randomUUID();
const users = [],
  courses = [];
let packageId;
async function run() {
  const passwordHash = await argon2.hash('test-only-native-runtime-password', {
    memoryCost: 8192,
    timeCost: 1,
    parallelism: 1,
  });
  for (const role of ['ADMIN', 'STUDENT']) {
    const u = await db.user.create({
      data: {
        email: `${role}-${tag}@example.test`,
        phone: `+2010${Math.floor(10000000 + Math.random() * 89999999)}`,
        displayName: 'M8 runtime fixture',
        passwordHash,
        role,
      },
    });
    users.push(u.id);
  }
  for (let i = 0; i < 3; i++) {
    // Synthetic catalog-only fixture in isolated DB, no invented DRM assets.
    const c = await db.course.create({
      data: {
        slug: `runtime-${tag}-${i}`,
        titleAr: 'اختبار تشغيل',
        titleEn: 'Runtime test only',
        descriptionAr: 'بيانات اختبار',
        descriptionEn: 'Synthetic isolated fixture',
        status: 'PUBLISHED',
        publishedAt: new Date(),
        grade: 'SECOND_SECONDARY',
        academicYear: '2026/2027',
        courseKind: 'MONTHLY_EXPLANATION',
        teachingMonth: `2026-${10 + i}`,
      },
    });
    courses.push(c.id);
  }
  await db.$transaction(async (tx) => {
    const w = await lockWallet(tx, users[1]);
    await postEntry(tx, w.id, 200000, 'CREDIT_RECHARGE', 'RUNTIME_FIXTURE', tag);
  });
  const p = await savePackage(db, users[0], null, {
    titleAr: 'باقة اختبار',
    titleEn: 'Runtime fixture package',
    descriptionAr: 'ثلاثة شهور',
    descriptionEn: 'Three selected months',
    courseIds: courses,
    pricePiastres: 90000,
    endsAt: '2027-07-15T18:00:00+03:00',
    status: 'PUBLISHED',
  });
  packageId = p.id;
  const input = { packageId: p.id, expectedVersion: p.version, idempotencyKey: `runtime-${tag}` };
  const first = await purchasePackage(db, users[1], input);
  const second = await purchasePackage(db, users[1], input);
  assert.equal(first.id, second.id);
  assert.equal(first.items.length, 3);
  assert.equal(first.subscriptions.length, 3);
  assert.equal(
    (await db.wallet.findUnique({ where: { userId: users[1] } })).balancePiastres,
    110000,
  );
  assert.equal(
    await db.walletLedgerEntry.count({ where: { refType: 'PACKAGE_PURCHASE', refId: first.id } }),
    1,
  );
  for (const sub of first.subscriptions) {
    assert.equal(sub.expiresAt.toISOString(), '2027-07-15T15:00:00.000Z');
    assert.equal(evaluateEntitlement([sub], sub.courseId, sub.expiresAt.getTime()).allowed, false);
  }
  console.log(
    'PASS final serving image: native argon2, Prisma engine, one 90000 debit, balance 110000, three common-expiry grants and idempotent replay.',
  );
}
run()
  .finally(async () => {
    if (packageId) await db.coursePackage.deleteMany({ where: { id: packageId } });
    await db.course.deleteMany({ where: { id: { in: courses } } });
    await db.user.deleteMany({ where: { id: { in: users } } });
    await db.$disconnect();
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
