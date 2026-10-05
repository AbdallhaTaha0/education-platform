// Synthetic navigation stress fixtures; never connect to a retained database.
const { PrismaClient } = require('@prisma/client');
async function main() {
  if (process.env.DATABASE_URL !== 'postgresql://postgres:postgres@postgres:5432/education_platform_test') throw Error('Fixture database refused');
  const db = new PrismaClient();
  try {
    const course = await db.course.findUniqueOrThrow({ where: { slug: 'ide-modes-browser' }, include: { sections: true } });
    const sectionId = course.sections[0].id;
    for (let i = 2; i <= 12; i++) {
      await db.courseSection.create({ data: { courseId: course.id, titleAr: `قسم ${i}`, titleEn: `Section ${i}`, position: i } });
      await db.lesson.create({ data: { sectionId, titleAr: `درس ${i}`, titleEn: `Lesson ${i}`, position: i } });
    }
    const other = await db.course.create({ data: { slug: 'workspace-other', titleAr: 'كورس آخر', titleEn: 'Other workspace', descriptionAr: 'تجربة', descriptionEn: 'Synthetic navigation', status: 'DRAFT' } });
    console.log(JSON.stringify({ sectionId, otherCourseId: other.id }));
  } finally { await db.$disconnect(); }
}
main().catch(() => { console.error('Workspace fixtures failed'); process.exitCode = 1; });
