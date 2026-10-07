// Synthetic source probes. Only an owned disposable PostgreSQL database is used.
const fs = require('fs');
const vm = require('vm');
const ts = require('typescript');
const { PrismaClient, Prisma } = require('@prisma/client');
function compile(file, imports) {
  const output = ts.transpileModule(fs.readFileSync('/reports/' + file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const context = { exports: {}, require: id => imports[id], Buffer, Intl };
  vm.runInNewContext(output, context);
  return context.exports;
}
class ApiError extends Error {}
const identity = { ApiError };
const text = compile('text.ts', {});
const reportService = compile('reportService.ts', { '../identity/errors.js': identity, './text.js': text });
const report = compile('reportServer.ts', {
  '../identity/errors.js': identity, './text.js': text, './reportService.js': reportService,
});
const facts = compile('viewFacts.ts', { '@prisma/client': { Prisma } });
const cutoff = new Date('2026-10-30T12:00:00Z');
const day = 86400000;
const membership = { courseId: 'course-a', startsAt: new Date(cutoff - 60 * day), expiresAt: null };
const lesson = { id: 'lesson-a', titleAr: 'درس', titleEn: 'Lesson A', position: 1 };
const assessment = { id: 'assessment-a', kind: 'QUIZ', lesson: {
  titleAr: 'درس', titleEn: 'Lesson A', section: { courseId: 'course-a' },
} };
function fakePrisma() {
  return {
    user: { findUnique: async () => ({ role: 'STUDENT', displayName: 'Synthetic Student' }) },
    subscription: { findMany: async () => [membership] },
    course: {
      findMany: async () => [{ id: 'course-a', status: 'PUBLISHED' }],
      findUniqueOrThrow: async () => ({ titleAr: 'كورس', titleEn: 'Course A' }),
    },
    lesson: { findMany: async () => [lesson] },
    assessment: { findMany: async () => [assessment] },
    assessmentSubmission: { findMany: async () => [{ id: 'attempt-a', assessmentId: assessment.id,
      createdAt: new Date(cutoff - day), state: 'CORRECT', result: { correct: true } }] },
    assessmentPass: { findMany: async () => [{ assessmentId: assessment.id, passedAt: new Date(cutoff - day) }] },
    studentProfile: { findUnique: async () => ({ parentPhone: null }) },
  };
}
async function main() {
  const output = await report.generateParentReport(fakePrisma(), {
    trackingStartedAt: async () => new Date(cutoff - 3 * day),
    sessionsInWindow: async () => [],
  }, { studentId: 'student-a', courseIds: ['course-a'], reportType: 'FOUR_WEEKS',
    language: 'en', nowMs: cutoff.getTime() });
  const full = output.parts.map(p => p.text).join('\n');
  const firstWeek = full.slice(full.indexOf('Week 1'), full.indexOf('Week 2'));
  console.log(JSON.stringify({ probe: 'first week predates tracking and last-week pass',
    firstWeek, preview: full.slice(0, 850), includesNotViewed: firstWeek.includes('not viewed'),
    includesLaterPass: firstWeek.includes('passed'),
    limitation: 'controlled generation inputs; not full API test' }));
  console.log(JSON.stringify({ probe: 'oversized authored line',
    maximumPartLength: Math.max(...text.toParts('X'.repeat(2500)).map(p => p.text.length)),
    configuredMax: text.MAX_PART_CHARS }));

  const prisma = new PrismaClient();
  try {
    const old = await prisma.m10VideoViewSession.findFirst();
    if (!old) throw new Error('no synthetic session fixture');
    const start = new Date(cutoff - 7 * day);
    await prisma.m10VideoViewSession.update({ where: { id: old.id }, data: {
      startedAt: new Date(cutoff - 1000), countedAt: new Date(cutoff.getTime() + 1000),
    } });
    const rows = await facts.postgresViewFactsReader(prisma).sessionsInWindow(
      old.studentId, [old.courseId], start, cutoff);
    console.log(JSON.stringify({ probe: 'real PostgreSQL reader cutoff',
      sessionsCountedAfterCutoffReturned: rows.filter(r => r.countedAt > cutoff).length,
      expected: 0 }));
  } finally { await prisma.$disconnect(); }
}
main().catch(() => { console.error('synthetic agent2 probe failed'); process.exitCode = 1; });
