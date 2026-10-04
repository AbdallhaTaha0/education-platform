const { PrismaClient } = require('@prisma/client');
(async () => {
const db = new PrismaClient();
const user = await db.user.create({ data: { id: 'materials-legacy-user', email: 'migration-materials@example.test', phone: '+201099999991', displayName: 'Migration fixture', passwordHash: 'synthetic-unusable', wallet: { create: { balancePiastres: 12345 } } } });
const course = await db.course.create({ data: { id: 'materials-legacy-course', slug: 'materials-legacy', titleAr: 'Arabic', titleEn: 'English', descriptionAr: 'Arabic', descriptionEn: 'English', sections: { create: { id: 'materials-legacy-section', titleAr: 'Arabic', titleEn: 'English', position: 1, lessons: { create: { id: 'materials-legacy-lesson', titleAr: 'Arabic', titleEn: 'English', position: 1, media: { create: { externalAssetId: 'materials-legacy-asset', idempotencyKey: 'materials-legacy-key', status: 'READY' } } } } } } } });
await db.lessonProgress.create({ data: { studentId: user.id, courseId: course.id, lessonId: 'materials-legacy-lesson', positionSeconds: 12, durationSeconds: 20 } });
await db.assessment.create({ data: { id: 'materials-legacy-assessment', lessonId: 'materials-legacy-lesson', kind: 'QUIZ', required: true, content: {} } });
await db.$disconnect(); console.log('Populated legacy string IDs, wallet, catalog, media, progress and assessment fixture.');
})().catch(e => { console.error(e.message); process.exit(1); });
