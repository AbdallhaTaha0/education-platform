const { PrismaClient } = require('@prisma/client');
const argon2 = require('argon2');
const { randomUUID } = require('node:crypto');
const prisma = new PrismaClient();
(async () => {
  if (new URL(process.env.DATABASE_URL).hostname !== 'postgres' || !process.env.DATABASE_URL.endsWith('/journey_test')) throw Error('Disposable journey database required');
  const passwordHash = await argon2.hash('synthetic journey password 20261009', {memoryCost:8192,timeCost:2,parallelism:1});
  for (const [role,email,phone] of [['ADMIN','journey-admin@example.test','+201000000091'],['STUDENT','journey-student@example.test','+201000000092']]) {
    const user = await prisma.user.upsert({where:{email},update:{},create:{role,email,phone,displayName:`Journey ${role}`,passwordHash}});
    if (role === 'STUDENT') {
      const { getOrCreateWallet } = await import('./dist/modules/wallet/ledger.js');
      await prisma.$transaction(tx => getOrCreateWallet(tx, user.id));
    }
  }
  const slug = 'journey-synthetic-20261009';
  if (!await prisma.course.findUnique({where:{slug}})) {
    const course = await prisma.course.create({data:{slug,titleAr:'كورس اختبار الرحلة',titleEn:'Journey synthetic course',descriptionAr:'بيانات مؤقتة للاختبار فقط؛ ليست فيديوهات حقيقية',descriptionEn:'Disposable journey fixture; no real video assets',status:'DRAFT',sections:{create:[{titleAr:'القسم الأول',titleEn:'First section',position:1,lessons:{create:[{titleAr:'الدرس الأول',titleEn:'First lesson',position:1},{titleAr:'الدرس الثاني',titleEn:'Second lesson',position:2}]}},{titleAr:'القسم الثاني',titleEn:'Second section',position:2,lessons:{create:{titleAr:'الدرس الثالث',titleEn:'Third lesson',position:1}}}]}},include:{sections:{include:{lessons:true}}}});
    for (const section of course.sections) for (const lesson of section.lessons) {
      await prisma.mediaMapping.create({data:{lessonId:lesson.id,externalAssetId:randomUUID(),assetId:randomUUID(),idempotencyKey:`journey-fixture-${lesson.id}`,status:'READY'}});
    }
    const plan = await prisma.subscriptionPlan.create({data:{courseId:course.id,currentPricePiastres:0,durationDays:90}});
    const student = await prisma.user.findUnique({where:{email:'journey-student@example.test'}});
    const purchase = await prisma.purchase.create({data:{studentId:student.id,courseId:course.id,planId:plan.id,pricePiastres:0,durationDays:90,idempotencyKey:'journey-synthetic-initial-access'}});
    await prisma.subscription.create({data:{studentId:student.id,courseId:course.id,purchaseId:purchase.id,startsAt:new Date(Date.now()-1000),expiresAt:new Date(Date.now()+90*86400000)}});
  }
  console.log('Disposable accounts and isolated authoring fixture seeded; synthetic media is not playback evidence.');
})().catch(e=>{console.error(e.message);process.exitCode=1;}).finally(()=>prisma.$disconnect());
