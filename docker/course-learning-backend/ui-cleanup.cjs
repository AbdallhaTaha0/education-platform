/** API-only closure of the exact disposable student's grants and registration. */
const {PrismaClient}=require('@prisma/client');
const {loadConfig}=require('./dist/config.js');
const {createDrmClient}=require('./dist/modules/catalog/drmClient.js');
const {endPlaybackSession}=require('./dist/modules/learning/playback/service.js');
const {inspectStudentDevices,releaseStudentDevice}=require('./dist/modules/learning/devices/service.js');
(async()=>{
 if(!process.env.DATABASE_URL.endsWith('/course_learning_test'))throw Error('Disposable DB refused');
 const f=JSON.parse(require('fs').readFileSync(0,'utf8')); const db=new PrismaClient();
 const drm=createDrmClient(loadConfig(process.env));
 try {
  const rows=await db.playbackReference.findMany({where:{studentId:f.studentId}});
  for(const row of rows)if(row.status==='ACTIVE'||row.pendingEndReason)await endPlaybackSession(db,drm,row.id,f.studentId,Date.now());
  const remaining=await db.playbackReference.count({where:{studentId:f.studentId,OR:[{status:'ACTIVE'},{pendingEndReason:{not:null}}]}});
  if(remaining)throw Error('Owned termination still pending; preserve disposable DB');
  const list=await inspectStudentDevices(db,drm,f.studentId);
  if(list.truncated||list.unavailable)throw Error('Incomplete owned inspection; preserve disposable DB');
  for(const row of list.devices)if(row.releasable){const result=await releaseStudentDevice(db,drm,f.adminId,f.studentId,row.reference,Date.now());if(result.auditPending)throw Error('Owned audit still pending');}
  const after=await inspectStudentDevices(db,drm,f.studentId);
  if(after.devices.length||after.truncated||after.unavailable)throw Error('Owned external registrations remain');
  console.log('Exact disposable student external obligations confirmed closed.');
 }finally{await db.$disconnect();}
})().catch(e=>{console.error(e.message);process.exit(1)});
