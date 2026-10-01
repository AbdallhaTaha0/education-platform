/** Synthetic fixtures: refused outside the disposable database. */
const { PrismaClient } = require('@prisma/client');
const argon2 = require('argon2');
async function main() {
  if (process.env.DATABASE_URL !== 'postgresql://postgres:postgres@postgres:5432/education_platform_test') throw Error('Fixture database refused');
  const db = new PrismaClient();
  try {
    const passwordHash = await argon2.hash('m9 fixture password twelve words', { type: argon2.argon2id, memoryCost: 8192, timeCost: 2, parallelism: 1 });
    const admin = await db.user.create({ data: { role: 'ADMIN', email: 'm9-admin@example.test', phone: '+201001234501', displayName: 'M9 Admin', passwordHash } });
    const student = await db.user.create({ data: { email: 'm9-student@example.test', phone: '+201001234502', displayName: 'M9 Student', passwordHash } });
    await db.user.create({ data: { email: 'm9-inactive@example.test', phone: '+201001234503', displayName: 'M9 Inactive', passwordHash } });
    const course = await db.course.create({ data: { slug: 'm9-ui-course', titleAr: 'برمجة الويب', titleEn: 'Web programming', descriptionAr: 'تدريب', descriptionEn: 'Practice', status: 'PUBLISHED', publishedAt: new Date(), firstPublicationAt: new Date() } });
    const section = await db.courseSection.create({ data: { courseId: course.id, titleAr: 'قسم', titleEn: 'Section', position: 1 } });
    const lessons = [];
    for (let i = 1; i <= 2; i++) {
      const lesson = await db.lesson.create({ data: { sectionId: section.id, titleAr: `الدرس ${i}`, titleEn: `Lesson ${i}`, position: i } }); lessons.push(lesson);
      await db.mediaMapping.create({ data: { lessonId: lesson.id, externalAssetId: `m9-ui-external-${i}`, assetId: `m9-ui-asset-${i}`, idempotencyKey: `m9-ui-key-${i}`, status: 'READY' } });
    }
    const plan = await db.subscriptionPlan.create({ data: { courseId: course.id, accessMode: 'UNTIL_REMOVAL', currentPricePiastres: 10000 } });
    const purchase = await db.purchase.create({ data: { studentId: student.id, planId: plan.id, courseId: course.id, pricePiastres: 10000, accessMode: 'UNTIL_REMOVAL', idempotencyKey: 'm9-ui-purchase' } });
    await db.subscription.create({ data: { studentId: student.id, courseId: course.id, purchaseId: purchase.id, startsAt: new Date(Date.now() - 1000), expiresAt: null } });
    const content = { titleAr: 'جمع رقمين', titleEn: 'Add two numbers', instructionsAr: 'اكتب دالة sum', instructionsEn: 'Write sum(a,b)', questions: [{ id: 'sum', type: 'CODING', titleAr: 'الدالة', titleEn: 'Function', starter: { html: '<p>Practice</p>', css: '', javascript: 'function sum(a,b) { return 0; }' }, checks: [{ type: 'function', name: 'sum', args: [2, 3], expected: 5 }, { type: 'function', name: 'sum', args: [-2, 4], expected: 2 }] }] };
    const assessment = await db.assessment.create({ data: { lessonId: lessons[0].id, kind: 'ASSIGNMENT', status: 'PUBLISHED', required: true, draftRequired: true, version: 1, content } });
    const version = await db.assessmentVersion.create({ data: { assessmentId: assessment.id, version: 1, content } });
    await db.assessmentSubmission.createMany({ data: Array.from({ length: 23 }, (_, i) => ({ studentId: student.id, assessmentId: assessment.id, versionId: version.id, idempotencyKey: `m9-ui-history-${i}`, inputHash: 'synthetic-history', state: 'INCORRECT', answers: [{ questionId: 'sum', source: { html: '', css: '', javascript: 'function sum(){return 0}' } }], result: { questions: [] } })) });
    const sharedContent = { titleAr: 'كود ابتدائي معلن', titleEn: 'Shared starter', instructionsAr: 'تجربة الاستعادة', instructionsEn: 'Reset exercise', questions: [{ id: 'starter', type: 'CODING', titleAr: 'الطباعة', titleEn: 'Print', shareStarter: true, starter: { html: '', css: '', javascript: '// Start here\nconsole.log("Starter");' }, checks: [{ type: 'console', expected: 'Starter' }] }] };
    const starterAssessment = await db.assessment.create({ data: { lessonId: lessons[0].id, kind: 'QUIZ', status: 'PUBLISHED', required: false, version: 1, content: sharedContent } });
    await db.assessmentVersion.create({ data: { assessmentId: starterAssessment.id, version: 1, content: sharedContent } });
    console.log(JSON.stringify({ adminId: admin.id, studentId: student.id, courseId: course.id, planId: plan.id, lessonId: lessons[0].id, nextLessonId: lessons[1].id, assessmentId: assessment.id, starterAssessmentId: starterAssessment.id }));
  } finally { await db.$disconnect(); }
}
main().catch(() => { console.error('M9 fixture failed'); process.exitCode = 1; });
