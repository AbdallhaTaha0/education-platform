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
    await db.user.createMany({data:Array.from({length:23},(_,i)=>({email:`ux-directory-${i}@example.test`,phone:`+20101234${String(i).padStart(4,'0')}`,displayName:`Synthetic Student ${i}`,passwordHash,role:'STUDENT'}))});
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
    await db.course.update({where:{id:course.id},data:{grade:'FIRST_SECONDARY',academicYear:'2026/2027',term:1,courseKind:'MONTHLY_EXPLANATION',teachingMonth:'2026-10'}});
    const monthly=[];
    for(let i=1;i<=2;i++)monthly.push(await db.course.create({data:{slug:`ux-month-${i}`,titleAr:`شرح الشهر ${i}`,titleEn:`Monthly lesson ${i}`,descriptionAr:'محتوى تجريبي لم يُنشر بعد',descriptionEn:'Synthetic content not published yet',grade:'FIRST_SECONDARY',academicYear:'2026/2027',term:1,courseKind:'MONTHLY_EXPLANATION',teachingMonth:`2026-${10+i}`}}));
    for(let s=1;s<=2;s++){const section=await db.courseSection.create({data:{courseId:monthly[0].id,titleAr:'قسم تجريبي '+s,titleEn:'Synthetic section '+s,position:s}});for(let l=1;l<=2;l++)await db.lesson.create({data:{sectionId:section.id,titleAr:'درس تجريبي '+l,titleEn:'Synthetic lesson '+l,position:l}});}
    const pkg=await db.coursePackage.create({data:{titleAr:'باقة الشرح التجريبية',titleEn:'Synthetic monthly package',descriptionAr:'ثلاثة كورسات محددة',descriptionEn:'Three specific courses',status:'PUBLISHED',pricePiastres:15000,endsAt:new Date(Date.now()+30*86400000),members:{create:[course,...monthly].map((c,i)=>({courseId:c.id,position:i+1}))}}});
    const proof=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64');const proofHash=require('node:crypto').createHash('sha256').update(proof).digest('hex');
    const recharge=await db.rechargeRequest.create({data:{studentId:student.id,amountPiastres:5000,channel:'INSTAPAY',referenceNorm:'UXSYNTHETICTRANSFER',senderName:'Synthetic Student',senderPhone:'+201001234502',transferDate:new Date(),proofFilename:'synthetic-proof.png',proofMime:'image/png',proofSize:proof.length,proofHash,idempotencyKey:'ux-synthetic-recharge',proof:{create:{bytes:proof,mime:'image/png',size:proof.length,hash:proofHash}}}});
    console.log(JSON.stringify({ adminId: admin.id, studentId: student.id, courseId: course.id, planId: plan.id, lessonId: lessons[0].id, nextLessonId: lessons[1].id, assessmentId: assessment.id, starterAssessmentId: starterAssessment.id, secondCourseId:monthly[0].id, packageId:pkg.id, rechargeId:recharge.id }));
  } finally { await db.$disconnect(); }
}
main().catch((error) => { console.error('Synthetic fixture failed:', error.message); process.exitCode = 1; });
