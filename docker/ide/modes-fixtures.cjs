// Synthetic fixtures only, in the disposable verification database.
const { PrismaClient } = require('@prisma/client');
const argon2 = require('argon2');
async function main() {
  if (process.env.DATABASE_URL !== 'postgresql://postgres:postgres@postgres:5432/education_platform_test') throw Error('Fixture database refused');
  const db = new PrismaClient();
  try {
    const passwordHash = await argon2.hash('synthetic modes password only', { type: argon2.argon2id, memoryCost: 8192, timeCost: 2, parallelism: 1 });
    await db.user.create({ data: { role: 'ADMIN', email: 'modes-admin@example.test', phone: '+201001239901', displayName: 'Modes Admin', passwordHash } });
    const student = await db.user.create({ data: { email: 'modes-student@example.test', phone: '01001239902', displayName: 'Modes Student', passwordHash } });
    const course = await db.course.create({ data: { slug: 'ide-modes-browser', titleAr: 'محررات', titleEn: 'IDE modes', descriptionAr: 'تجربة', descriptionEn: 'Synthetic verification', status: 'PUBLISHED', publishedAt: new Date(), firstPublicationAt: new Date() } });
    const section = await db.courseSection.create({ data: { courseId: course.id, titleAr: 'قسم', titleEn: 'Section', position: 1 } });
    const lesson = await db.lesson.create({ data: { sectionId: section.id, titleAr: 'درس', titleEn: 'Lesson', position: 1 } });
    await db.mediaMapping.create({ data: { lessonId: lesson.id, externalAssetId: 'synthetic-only', assetId: 'synthetic-only', idempotencyKey: 'ide-modes-synthetic', status: 'READY' } });
    const plan = await db.subscriptionPlan.create({ data: { courseId: course.id, accessMode: 'UNTIL_REMOVAL', currentPricePiastres: 10000 } });
    const purchase = await db.purchase.create({ data: { studentId: student.id, planId: plan.id, courseId: course.id, pricePiastres: 10000, accessMode: 'UNTIL_REMOVAL', idempotencyKey: 'ide-modes-synthetic' } });
    await db.subscription.create({ data: { studentId: student.id, courseId: course.id, purchaseId: purchase.id, startsAt: new Date(Date.now() - 1000), expiresAt: null } });
    console.log(JSON.stringify({ courseId: course.id, lessonId: lesson.id }));
  } finally { await db.$disconnect(); }
}
main().catch(() => { console.error('Synthetic mode fixtures failed'); process.exitCode = 1; });
