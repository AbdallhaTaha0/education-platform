const { PrismaClient } = require('@prisma/client');
async function main() {
  if(process.env.DATABASE_URL !== 'postgresql://postgres:postgres@postgres:5432/education_platform_test') throw Error('Fixture scope refused');
  const db = new PrismaClient();
  try {
    const student=await db.user.findUniqueOrThrow({where:{email:'modes-student@example.test'}});
    const admin=await db.user.findUniqueOrThrow({where:{email:'modes-admin@example.test'}});
    const course=await db.course.findUniqueOrThrow({where:{slug:'ide-modes-browser'},include:{plans:true,sections:true}});
    await db.rechargeRequest.createMany({data:Array.from({length:153},(_,i)=>({studentId:student.id,amountPiastres:10000,channel:'INSTAPAY',referenceNorm:`PAGEFIXTURE${String(i).padStart(3,'0')}`,senderName:`Pagination ${i}`,senderPhone:'+201000000001',transferDate:new Date('2026-10-01T12:00:00Z'),proofFilename:'synthetic.png',proofMime:'image/png',proofSize:1,proofHash:'a'.repeat(64),reviewerId:i<130?admin.id:null,reviewedAt:i<130?new Date('2026-10-01T12:00:00Z'):null,status:i<105?'REJECTED':i<130?'APPROVED':'PENDING',rejectReason:i<105?'Synthetic display fixture':null,idempotencyKey:`page-fixture-${i}`,createdAt:new Date('2026-10-01T12:00:00Z')}))});
    await db.purchase.createMany({data:Array.from({length:105},(_,i)=>({studentId:student.id,planId:course.plans[0].id,courseId:course.id,pricePiastres:10000,accessMode:'UNTIL_REMOVAL',idempotencyKey:`pagination-receipt-${i}`}))});
    await db.user.createMany({data:Array.from({length:25},(_,i)=>({email:`pagination-student-${i}@example.test`,phone:`+20100124${String(i).padStart(4,'0')}`,displayName:`Pagination student ${i}`,passwordHash:student.passwordHash}))});
    for(let i=0;i<24;i++) await db.course.create({data:{slug:`pagination-course-${i}`,titleAr:`كورس اختبار ${i}`,titleEn:`Pagination course ${i}`,descriptionAr:'اختبار عرض',descriptionEn:'Synthetic display',status:'PUBLISHED',publishedAt:new Date(),firstPublicationAt:new Date(),plans:{create:{currentPricePiastres:10000,accessMode:'UNTIL_REMOVAL'}}}});
    await db.courseSection.createMany({data:Array.from({length:22},(_,i)=>({courseId:course.id,position:i+2,titleAr:`قسم ${i+2}`,titleEn:`Section ${i+2}`}))});
    await db.lesson.createMany({data:Array.from({length:22},(_,i)=>({sectionId:course.sections[0].id,position:i+2,titleAr:`درس ${i+2}`,titleEn:`Lesson ${i+2}`}))});
  } finally {await db.$disconnect();}
}
main().catch(()=>{console.error('Synthetic pagination fixtures failed');process.exitCode=1;});
