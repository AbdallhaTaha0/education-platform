// Only disposable M8 browser DB. Synthetic catalog states test UI, not DRM readiness.
const fs = require('node:fs'); const assert = require('node:assert/strict'); const { randomUUID, randomInt } = require('node:crypto');
const { createRequire } = require('node:module'); const r = createRequire('/srv/server/package.json');
const { PrismaClient } = r('@prisma/client'); const { hashPassword, PRODUCTION_ARGON2 } = r('./dist/modules/identity/password.js');
const { lockWallet, postEntry } = r('./dist/modules/wallet/ledger.js');
const db = new PrismaClient(); const receipt = '/tmp/m8-final-fixtures.json';
assert.equal(process.env.NODE_ENV, 'test'); assert.equal(new URL(process.env.DATABASE_URL).hostname, 'postgres');
assert.equal(process.env.ALLOWED_ORIGINS, 'http://localhost:8082');
(async () => {
  if (process.argv[2] === 'cleanup') {
    const f = JSON.parse(fs.readFileSync(receipt)); assert.match(f.run, /^[a-f0-9-]{36}$/);
    const actions = await db.auditEvent.findMany({ where: { actorUserId: f.users.find(u => u.role === 'ADMIN').id, action: 'PACKAGE_CREATED', entityType: 'CoursePackage' }, select: { entityId: true } });
    await db.coursePackage.deleteMany({ where: { id: { in: [...f.packageIds, ...actions.map(a => a.entityId)] } } });
    await db.course.deleteMany({ where: { slug: { startsWith: `m8-final-${f.run}-` } } });
    await db.user.deleteMany({ where: { id: { in: f.users.map(u => u.id) } } });
    await db.auditEvent.deleteMany({ where: { actorUserId: { in: f.users.map(u => u.id) } } });
    fs.unlinkSync(receipt); console.log('Owned M8 browser fixtures removed.'); return;
  }
  assert.equal(process.argv[2], 'seed'); assert(!fs.existsSync(receipt));
  const f = { run: randomUUID(), users: [], courseIds: [], packageIds: [], plans: [] }; fs.writeFileSync(receipt, JSON.stringify(f), { mode: 0o600 });
  for (const role of ['STUDENT','ADMIN']) {
    const input = { role, email: `m8-final-${f.run}-${role.toLowerCase()}@example.test`, password: randomUUID()+'aA9!' };
    const u = await db.user.create({ data: { role, email: input.email, phone: `011${randomInt(10000000,100000000)}`, displayName: role === 'STUDENT' ? 'طالب تجريبي' : 'إدارة تجريبية', passwordHash: await hashPassword(input.password, PRODUCTION_ARGON2) } });
    f.users.push({ ...input, id: u.id }); fs.writeFileSync(receipt, JSON.stringify(f), { mode: 0o600 });
  }
  await db.$transaction(async tx => { const wallet = await lockWallet(tx, f.users[0].id); await postEntry(tx, wallet.id, 500000, 'CREDIT_RECHARGE', 'M8_SYNTHETIC_FIXTURE', f.run); });
  for (let i=0; i<4; i++) {
    const c = await db.course.create({ data: { slug: `m8-final-${f.run}-${i}`, titleAr: i===3 ? 'مراجعة ثانية ثانوي' : `شرح شهر ${10+i} — أولى ثانوي`, titleEn: i===3 ? 'Second secondary revision' : `First secondary — Month ${10+i}`, descriptionAr: 'بيانات اختبار توضيحية، ليست دورة فعلية أو فيديو جاهز.', descriptionEn: 'Synthetic test data, not a real course or prepared video.', status: i===1 ? 'DRAFT' : 'PUBLISHED', publishedAt: i===1 ? null : new Date(), grade: i===3 ? 'SECOND_SECONDARY' : 'FIRST_SECONDARY', academicYear: '2026/2027', term: i===3 ? 2 : 1, courseKind: i===3 ? 'REVISION' : 'MONTHLY_EXPLANATION', teachingMonth: i===3 ? null : `2026-${10+i}` } });
    f.courseIds.push(c.id);
    if(i!==1) { const p = await db.subscriptionPlan.create({ data: { courseId: c.id, currentPricePiastres: 10000, durationDays: i===2 ? 90 : null, accessMode: i===0 ? 'UNTIL_REMOVAL' : i===2 ? 'DURATION' : 'YEAR_END', accessEndsAt: i===3 ? new Date('2027-07-15T15:00:00Z') : null } }); f.plans.push({ courseId: c.id, id: p.id }); }
    fs.writeFileSync(receipt, JSON.stringify(f), { mode: 0o600 });
  }
  const p = await db.coursePackage.create({ data: { titleAr: 'باقة أولى ثانوي — ثلاثة شهور', titleEn: 'First secondary — Three months', descriptionAr: 'باقة اختبار تشمل كورسًا لم يُنشر بعد.', descriptionEn: 'Synthetic package including an unpublished monthly course.', status: 'PUBLISHED', pricePiastres: 25000, endsAt: new Date('2027-07-15T15:00:00Z'), members: { create: f.courseIds.slice(0,3).map((courseId,i) => ({ courseId, position: i+1 })) } } });
  f.packageIds.push(p.id); fs.writeFileSync(receipt,JSON.stringify(f),{mode:0o600}); console.log('Synthetic UI fixture ready: two accounts, four courses, one presale package; no media or DRM.');
})().catch(e => { console.error(e instanceof assert.AssertionError ? e.message : 'M8 fixture operation failed'); process.exitCode=1; }).finally(() => db.$disconnect());
