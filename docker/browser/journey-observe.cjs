const {PrismaClient} = require('@prisma/client');
const db = new PrismaClient();
(async () => {
  if (new URL(process.env.DATABASE_URL).hostname !== 'postgres' || !process.env.DATABASE_URL.endsWith('/journey_test')) throw Error('Disposable journey database required');
  const student = await db.user.findUnique({where:{email:'journey-student@example.test'}});
  console.log(JSON.stringify({submissions:await db.assessmentSubmission.count({where:{studentId:student.id}}),passes:await db.assessmentPass.count({where:{studentId:student.id}}),drafts:await db.assessmentDraft.count({where:{studentId:student.id}}),courses:await db.course.findMany({select:{slug:true,status:true,titleEn:true}})},null,2));
})().catch(e=>{console.error(e.message);process.exitCode=1;}).finally(()=>db.$disconnect());
