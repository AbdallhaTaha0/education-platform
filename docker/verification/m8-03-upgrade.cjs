// Run only against m8_upgrade inside the owned disposable m8-03-test project.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { PrismaClient } = require('/srv/server/node_modules/@prisma/client');
const crypto = require('node:crypto');
assert(process.env.DATABASE_URL.endsWith('/m8_upgrade'), 'migration fixture database guard');
const db = new PrismaClient();
const evidence = '/evidence/upgrade-before.json';
async function snapshot() {
  const result = {};
  for (const [key, sql] of Object.entries({
    users: 'SELECT id, email, phone, role FROM "User" ORDER BY id',
    courses: 'SELECT id, slug, "titleAr", "titleEn", status FROM "Course" ORDER BY id',
    plans: 'SELECT id, "courseId", "currentPricePiastres", "durationDays" FROM "SubscriptionPlan" ORDER BY id',
    purchases: 'SELECT id, "studentId", "courseId", "planId", "pricePiastres", "durationDays", "idempotencyKey", "createdAt" FROM "Purchase" ORDER BY id',
    subscriptions: 'SELECT id, "studentId", "courseId", "purchaseId", "startsAt", "expiresAt", "createdAt" FROM "Subscription" ORDER BY id',
    sections: 'SELECT id, "courseId", "titleAr", "titleEn", position FROM "CourseSection" ORDER BY id',
    lessons: 'SELECT id, "sectionId", "titleAr", "titleEn", position FROM "Lesson" ORDER BY id',
    progress: 'SELECT id, "studentId", "lessonId", "courseId", "positionSeconds", "completedAt" FROM "LessonProgress" ORDER BY id',
    wallets: 'SELECT id, "userId", "balancePiastres" FROM "Wallet" ORDER BY id',
    ledger: 'SELECT id, "walletId", "amountPiastres", "entryType", "refType", "refId" FROM "WalletLedgerEntry" ORDER BY id',
  })) result[key] = await db.$queryRawUnsafe(sql);
  return JSON.parse(JSON.stringify(result));
}
async function run() {
  if (process.argv[2] === 'seed') {
    // Explicit historical migration fixture, not a public/media test bypass.
    const u = await db.user.create({ data: { email: 'migration-only@example.test', phone: '+201000000555', displayName: 'Migration fixture', passwordHash: 'not-a-login-password' } });
    const c = await db.course.create({ data: { slug: 'migration-only', titleAr: 'اختبار ترحيل', titleEn: 'Migration fixture', descriptionAr: 'غير منشور', descriptionEn: 'Unpublished fixture' } });
    const p = await db.subscriptionPlan.create({ data: { courseId: c.id, currentPricePiastres: 5000, durationDays: 90 } });
    const w = await db.wallet.create({ data: { userId: u.id, balancePiastres: 5000 } });
    const purchase = await db.purchase.create({ data: { studentId: u.id, planId: p.id, courseId: c.id, pricePiastres: 5000, durationDays: 90, idempotencyKey: 'migration-fixture-purchase' } });
    await db.walletLedgerEntry.createMany({ data: [
      { walletId: w.id, entryType: 'CREDIT_RECHARGE', amountPiastres: 10000, refType: 'MIGRATION_FIXTURE', refId: crypto.randomUUID() },
      { walletId: w.id, entryType: 'DEBIT_PURCHASE', amountPiastres: -5000, refType: 'PURCHASE', refId: purchase.id },
    ] });
    await db.subscription.create({ data: { studentId: u.id, courseId: c.id, purchaseId: purchase.id, startsAt: new Date('2026-10-01T00:00:00Z'), expiresAt: new Date('2026-12-30T00:00:00Z') } });
    const s = await db.courseSection.create({ data: { courseId: c.id, titleAr: 'قسم ترحيل', titleEn: 'Migration section', position: 1 } });
    const l = await db.lesson.create({ data: { sectionId: s.id, titleAr: 'درس ترحيل', titleEn: 'Migration lesson', position: 1 } });
    await db.lessonProgress.create({ data: { studentId: u.id, lessonId: l.id, courseId: c.id, positionSeconds: 42 } });
    fs.writeFileSync(evidence, JSON.stringify(await snapshot(), null, 2));
    console.log('Historical snapshot recorded: one unpublished course, purchase, grant, balanced ledger, section/lesson and progress.');
  } else {
    assert.deepEqual(await snapshot(), JSON.parse(fs.readFileSync(evidence, 'utf8')));
    assert.equal((await db.course.findFirst()).grade, null);
    assert.equal((await db.subscriptionPlan.findFirst()).accessMode, 'DURATION');
    assert.equal((await db.purchase.findFirst()).accessMode, 'DURATION');
    assert.equal(await db.packagePurchase.count(), 0);
    console.log('PASS: populated upgrade preserves all recorded IDs, terms, dates, balances, ledger rows, sections/lessons/progress; no guessed academic placement.');
  }
}
run().finally(() => db.$disconnect()).catch(error => { console.error(error); process.exitCode = 1; });
