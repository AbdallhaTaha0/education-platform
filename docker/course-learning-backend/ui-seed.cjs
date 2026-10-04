/** Disposable UI fixtures use an existing uploaded asset through its API binding. */
const {PrismaClient}=require('@prisma/client'); const argon2=require('argon2');
(async()=>{
 if(!process.env.DATABASE_URL.endsWith('/course_learning_test'))throw Error('Disposable DB refused');
 const storage=require('./dist/infra/storage.js').createStorageClient(require('./dist/config.js').loadConfig(process.env));
 try { await storage.putObject('',new Uint8Array(),'application/octet-stream'); } catch {}
 const db=new PrismaClient(); const binding=JSON.parse(require('fs').readFileSync(0,'utf8'));
 const password='materials fixture password twelve words'; const hash=await argon2.hash(password,{memoryCost:8192,timeCost:2,parallelism:1});
 const admin=await db.user.create({data:{role:'ADMIN',email:'materials-admin@example.test',phone:'+201010009901',displayName:'Materials Admin',passwordHash:hash}});
 const student=await db.user.create({data:{email:'materials-student@example.test',phone:'+201010009902',displayName:'Materials Student',passwordHash:hash}});
 const course=await db.course.create({data:{slug:'materials-real-browser',titleAr:'تجربة الملفات والترجمة',titleEn:'Materials and captions demo',descriptionAr:'تجربة محلية',descriptionEn:'Local demonstration',status:'PUBLISHED',publishedAt:new Date(),firstPublicationAt:new Date(),sections:{create:{titleAr:'قسم التجربة',titleEn:'Demo section',position:1,lessons:{create:{titleAr:'فيديو الاختبار',titleEn:'Test video',position:1,media:{create:{externalAssetId:binding.externalAssetId,assetId:binding.assetId,idempotencyKey:'materials-browser-existing-binding',status:'READY'}}}}}}},include:{sections:{include:{lessons:true}}}});
 const plan=await db.subscriptionPlan.create({data:{courseId:course.id,currentPricePiastres:100,durationDays:1}});
 const purchase=await db.purchase.create({data:{studentId:student.id,courseId:course.id,planId:plan.id,pricePiastres:100,durationDays:1,idempotencyKey:'materials-browser-purchase'}});
 await db.subscription.create({data:{studentId:student.id,courseId:course.id,purchaseId:purchase.id,startsAt:new Date(Date.now()-1000),expiresAt:new Date(Date.now()+86400000)}});
 console.log(JSON.stringify({adminId:admin.id,studentId:student.id,courseId:course.id,lessonId:course.sections[0].lessons[0].id,slug:course.slug,password})); await db.$disconnect();
})().catch(()=>{console.error('Disposable UI seed failed');process.exit(1)});
