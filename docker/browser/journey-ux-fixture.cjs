// Synthetic fixture preparation only, never browser evidence or owner data.
const { PrismaClient } = require('@prisma/client');
const { createHash } = require('node:crypto');
const fs = require('node:fs');
const db = new PrismaClient();
const saved = '/tmp/journey-ux-subscription.json';
(async () => {
  const url = new URL(process.env.DATABASE_URL);
  if (url.hostname !== 'postgres' || url.pathname !== '/journey_test') throw Error('Disposable journey_test required');
  const student = await db.user.findUniqueOrThrow({ where: { email: 'journey-student@example.test' } });
  const course = await db.course.findUniqueOrThrow({ where: { slug: 'journey-synthetic-20261009' } });
  const mode = process.argv[2];
  if (mode === 'expire') {
    if (fs.existsSync(saved)) throw Error('Saved expiry already exists; restore it first');
    const rows = await db.subscription.findMany({ where: { studentId: student.id, courseId: course.id } });
    fs.writeFileSync(saved, JSON.stringify(rows.map(row => ({ id: row.id, expiresAt: row.expiresAt }))));
    await db.subscription.updateMany({ where: { id: { in: rows.map(row => row.id) } }, data: { expiresAt: new Date(Date.now() - 60000) } });
  } else if (mode === 'restore') {
    const rows = JSON.parse(fs.readFileSync(saved, 'utf8'));
    await db.$transaction(rows.map(row => db.subscription.update({ where: { id: row.id }, data: { expiresAt: row.expiresAt ? new Date(row.expiresAt) : null } })));
    fs.unlinkSync(saved);
  } else if (mode === 'session') {
    await db.authSession.updateMany({ where: { userId: student.id, revokedAt: null }, data: { absoluteExpiresAt: new Date(Date.now() - 60000) } });
  } else if (mode === 'prepare') {
    const bytes = Buffer.from('Synthetic placeholder only. No transfer occurred.');
    const hash = createHash('sha256').update(bytes).digest('hex');
    const idempotencyKey = 'journey-ux-placeholder-20261010';
    if (!await db.rechargeRequest.findUnique({ where: { studentId_idempotencyKey: { studentId: student.id, idempotencyKey } } })) {
      await db.rechargeRequest.create({ data: { studentId: student.id, amountPiastres: 5000, channel: 'INSTAPAY', referenceNorm: 'JOURNEYUX20261010', senderName: 'Synthetic journey — no transfer', senderPhone: '+201000000092', transferDate: new Date(), proofFilename: 'synthetic-no-transfer.txt', proofMime: 'application/pdf', proofSize: bytes.length, proofHash: hash, idempotencyKey, proof: { create: { bytes, mime: 'application/pdf', size: bytes.length, hash } } } });
    }
    for (let month = 1; month <= 3; month++) {
      await db.course.upsert({ where: { slug: `journey-ux-month-${month}` }, update: {}, create: { slug: `journey-ux-month-${month}`, titleAr: `كورس اصطناعي للشهر ${month}`, titleEn: `Synthetic month ${month}`, descriptionAr: 'بيانات للاختبار فقط؛ بلا فيديو حقيقي.', descriptionEn: 'Disposable package authoring prerequisite; no real video.', status: 'DRAFT', grade: 'FIRST_SECONDARY', academicYear: '2026/2027', term: 1, courseKind: 'MONTHLY_EXPLANATION', teachingMonth: `2026-${String(month + 8).padStart(2, '0')}` } });
    }
  } else throw Error('Choose prepare, expire, restore or session');
  console.log(`Synthetic fixture ${mode} completed; no owner data or wallet credit.`);
})().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(() => db.$disconnect());
