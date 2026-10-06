// Isolated synthetic verification only. Never a deployment entry point.
const express = require('/srv/server/node_modules/express');
const { createSeoRouter } = require('/srv/server/dist/modules/seo/router.js');
const { listPublishedCourses } = require('/srv/server/dist/modules/catalog/courses/service.js');
const rows = Array.from({length: 12}, (_, i) => ({
  id: '10000000-0000-4000-8000-' + String(i + 1).padStart(12, '0'), slug: 'javascript-' + (i + 1),
  titleAr: 'أساسيات البرمجة ' + (i + 1), titleEn: 'Programming fundamentals ' + (i + 1),
  descriptionAr: 'تعلم المتغيرات والدوال في دروس برمجة مسجلة مع تمارين عملية.', descriptionEn: 'Learn variables and functions in recorded programming lessons with practical exercises.',
  publishedAt: new Date('2026-01-01'), status: 'PUBLISHED', deletionRequestedAt: null,
  grade: 'FIRST_SECONDARY', academicYear: '2026/2027', term: 1, courseKind: 'MONTHLY_EXPLANATION', teachingMonth: '2026-10',
  plans: [{id: '20000000-0000-4000-8000-' + String(i + 1).padStart(12, '0'), currentPricePiastres: 25000, previousPricePiastres: null, durationDays: 30, accessMode: 'DURATION', accessEndsAt: null}],
  sections: [{titleEn: 'PRIVATE LESSON SENTINEL'}],
}));
const pkg = { id: '30000000-0000-4000-8000-000000000001', titleAr: 'باقة كورسات البرمجة', titleEn: 'Programming course package', descriptionAr: 'ثلاثة كورسات محددة بموعد انتهاء واحد.', descriptionEn: 'Three specified courses with one shared end date.', pricePiastres: 60000, endsAt: new Date('2030-01-01'), status: 'PUBLISHED', version: 1,
  members: rows.slice(0, 3).map((course, i) => ({position:i + 1, course})) };
const prisma = {
  course: { findMany: async () => rows, findUnique: async ({where}) => rows.find(row => row.slug === where.slug) ?? null },
  coursePackage: { findMany: async () => [pkg], findUnique: async ({where}) => where.id === pkg.id ? pkg : null },
  supportContact: { findUnique: async () => ({email:'support@example.test', phone:'+201000000000', version:1}) },
};
const app = express();
app.get('/auth/me', (_req, res) => res.status(401).set('X-Robots-Tag','noindex').json({error:{code:'UNAUTHENTICATED',message:'Sign in required.'}}));
app.get('/catalog/courses', async (_req,res) => res.json({data:{courses:await listPublishedCourses(prisma)}}));
app.get('/health/live', (_req,res) => res.json({status:'ok'}));
app.use('/seo', createSeoRouter(prisma, {origin:'https://seo.example.test',indexing:true}));
app.use((_req,res) => res.status(401).set('X-Robots-Tag','noindex').json({error:{code:'UNAUTHENTICATED',message:'Sign in required.'}}));
app.listen(3000, '0.0.0.0');
