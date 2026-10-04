/** Trusted owner-local demo provisioning; uses platform services + external API only. */
const {PrismaClient}=require('@prisma/client');
(async()=>{
 if(process.env.OWNER_PREVIEW!=='1')throw Error('Owner preview required');
 const db=new PrismaClient(),config=require('./dist/config.js').loadConfig(process.env);
 const storage=require('./dist/infra/storage.js').createStorageClient(config);
 await storage.putObject('',new Uint8Array(),'application/octet-stream');
 const admin=await db.user.findFirst({where:{role:'ADMIN'}});
 const course=await db.course.findUnique({where:{slug:'fayq-learning-demo-20261004'},include:{sections:{orderBy:{position:'asc'},include:{lessons:{orderBy:{position:'asc'},include:{media:true,captions:true,resources:true}}}}}});
 if(!admin||!course)throw Error('Existing demo/admin missing');
 const protectedTables=['Wallet','Purchase','Subscription','LessonProgress','AssessmentPass','AssessmentSubmission','PreservedLessonUnlock'];
 async function snapshot(){return JSON.stringify(await db.$queryRawUnsafe(protectedTables.map(t=>`SELECT '${t}' name,count(*)::text count,md5(coalesce(string_agg(to_jsonb(t)::text,',' ORDER BY to_jsonb(t)::text),'')) hash FROM "${t}" t`).join(' UNION ALL ')));}
 const before=await snapshot();
 const {syncCourseMedia}=require('./dist/modules/catalog/media/syncService.js');
 await syncCourseMedia(db,config,require('./dist/modules/catalog/drmClient.js').createDrmClient,admin.id,course.id);
 const deps={prisma:db,storage,now:Date.now},materials=require('./dist/modules/learning/materials/service.js');
 const lesson=course.sections.flatMap(s=>s.lessons).find(l=>l.media?.status==='READY');
 if(!lesson)throw Error('Existing processed demo recording missing');
 if(!lesson.captions.length){
 const ar='WEBVTT\r\n\r\n00:00:00.000 --> 00:00:08.000\r\nفيديو تجريبي — هذه ترجمة اختبار وليست نص درس\r\n\r\n00:00:08.000 --> 00:00:19.000\r\nجرّب العربية والإنجليزية وملء الشاشة\r\n';
 const en='WEBVTT\n\n00:00:00.000 --> 00:00:08.000\nDemo video — test captions, not a lesson transcript\n\n00:00:08.000 --> 00:00:19.000\nTry Arabic, English and fullscreen\n';
 await materials.uploadCaptionPair(deps,lesson.id,{language:'ar',labelAr:'ترجمة تجريبية',labelEn:'Demo captions',content:Buffer.from(ar)},{language:'en',labelAr:'ترجمة تجريبية',labelEn:'Demo captions',content:Buffer.from(en)},admin.id);
 }
 if(!lesson.resources.some(r=>r.fileName==='demo-notes.txt'))await materials.uploadResource(deps,lesson.id,{labelAr:'ملاحظات التجربة',labelEn:'Demo notes',fileName:'demo-notes.txt',mimeType:'text/plain',content:Buffer.from('Demo notes / ملاحظات التجربة\nTry captions, fullscreen, quiz and assignments.\nThese are demo resources, not teaching content.\n')},admin.id);
 if(await snapshot()!==before)throw Error('Existing wallet/access/progress/assessment preservation failed');
 const durations=await db.mediaMapping.findMany({where:{lesson:{section:{courseId:course.id}}},select:{durationSeconds:true}});
 if(!durations.length||durations.some(x=>x.durationSeconds!==20))throw Error('Demo actual duration verification failed');
 console.log('Existing demo ready: real 20-second durations, bilingual test captions, protected notes; balances, subscriptions and learning records preserved');
 await db.$disconnect();
})().catch(()=>{console.error('Owner-local demo provisioning failed; private diagnostics suppressed');process.exit(1)});
