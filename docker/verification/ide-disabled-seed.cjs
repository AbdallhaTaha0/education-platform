// Synthetic records only, in the disposable verification database.
const { PrismaClient } = require('@prisma/client');
const argon2 = require('argon2');
const db = new PrismaClient();
const ids = { course: '11000000-0000-4000-8000-000000000001', lesson: '11000000-0000-4000-8000-000000000002', next: '11000000-0000-4000-8000-000000000003', quiz: '11000000-0000-4000-8000-000000000004', coding: '11000000-0000-4000-8000-000000000005', draft: '11000000-0000-4000-8000-000000000006', draftLesson: '11000000-0000-4000-8000-000000000007' };
async function main() {
  if (!process.env.DATABASE_URL?.endsWith('/education_platform_test')) throw Error('Disposable database required');
  const passwordHash = await argon2.hash('synthetic IDE disabled password', { type: argon2.argon2id, memoryCost: 8192, timeCost: 2, parallelism: 1 });
  for (const [role, phone] of [['ADMIN', '+201010100001'], ['STUDENT', '+201010100002']]) await db.user.upsert({ where: { email: `ide-off-${role.toLowerCase()}@example.test` }, create: { role, email: `ide-off-${role.toLowerCase()}@example.test`, phone, displayName: `IDE off ${role}`, passwordHash }, update: { passwordHash } });
  const student = await db.user.findUniqueOrThrow({ where: { email: 'ide-off-student@example.test' } });
  const courseData = { titleAr: 'اختبار', titleEn: 'IDE disabled verification', descriptionAr: 'وصف', descriptionEn: 'Synthetic test only' };
  await db.course.deleteMany({ where: { id: { in: [ids.course, ids.draft] } } });
  const course = await db.course.create({ data: { ...courseData, id: ids.course, slug: 'ide-off-browser', status: 'PUBLISHED', publishedAt: new Date(), firstPublicationAt: new Date(), sections: { create: { titleAr: 'قسم', titleEn: 'Section', position: 1, lessons: { create: [{ id: ids.lesson, titleAr: 'درس', titleEn: 'First lesson', position: 1 }, { id: ids.next, titleAr: 'التالي', titleEn: 'Next lesson', position: 2 }] } } } } });
  await db.course.create({ data: { ...courseData, id: ids.draft, slug: 'ide-off-admin', sections: { create: { titleAr: 'قسم', titleEn: 'Section', position: 1, lessons: { create: { id: ids.draftLesson, titleAr: 'درس', titleEn: 'Draft lesson', position: 1 } } } } } });
  const plan = await db.subscriptionPlan.create({ data: { courseId: course.id, currentPricePiastres: 10000, durationDays: 1 } });
  const purchase = await db.purchase.create({ data: { studentId: student.id, planId: plan.id, courseId: course.id, pricePiastres: 10000, durationDays: 1, idempotencyKey: require('node:crypto').randomUUID() } });
  await db.subscription.create({ data: { studentId: student.id, courseId: course.id, purchaseId: purchase.id, startsAt: new Date(Date.now() - 1000), expiresAt: new Date(Date.now() + 86400000) } });
  const base = { titleAr: 'اختبار اختيارات', titleEn: 'Choice quiz', instructionsAr: 'اختر الإجابة', instructionsEn: 'Select the answer' };
  const questions = [{ id: 'choice', type: 'CHOICE', titleAr: 'اختيار', titleEn: 'Choose B', choices: [{ id: 'a', textAr: 'أ', textEn: 'A' }, { id: 'b', textAr: 'ب', textEn: 'B' }], correctChoiceId: 'b' }];
  for (const [id, q] of [[ids.quiz, questions], [ids.coding, [{ id: 'code', type: 'CODING', titleAr: 'برمجة', titleEn: 'Code', starter: { html: '', css: '', javascript: '' }, checks: [{ type: 'console', expected: '2' }] }]]]) {
    const content = { ...base, ide: 'python', questions: q };
    await db.assessment.create({ data: { id, lessonId: ids.lesson, kind: 'QUIZ', required: true, status: 'PUBLISHED', version: 1, content, versions: { create: { version: 1, content } } } });
  }
  console.log('Synthetic browser fixtures ready');
}
main().catch((e) => { console.error('Browser fixture setup failed', e.code ?? e.name, String(e.message).match(/constraint [\\"]+([A-Za-z_]+)/)?.[1] ?? 'unknown-constraint'); process.exitCode = 1; }).finally(() => db.$disconnect());
