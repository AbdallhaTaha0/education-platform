import { randomUUID } from 'node:crypto';
import { writeFileSync, rmSync } from 'node:fs';
import { Queue, Worker } from 'bullmq';
import Redis from 'ioredis';
import { PrismaClient, type Prisma } from '@prisma/client';
import { executeIsolated, cleanupExpiredExecutions } from './launcher.js';
import type { Content, Answer } from './contracts.js';
import { processPreparation } from './preparation.js';
import { processPythonRun } from './python-runs.js';

export async function processSubmission(db: PrismaClient, id: string, execute = executeIsolated): Promise<void> {
  const token = randomUUID(); const now = new Date();
  const claimed = await db.assessmentSubmission.updateMany({ where: { id, OR: [{ state: 'PENDING' }, { state: 'RUNNING', leasedUntil: { lt: now } }] }, data: { state: 'RUNNING', leaseToken: token, leasedUntil: new Date(now.getTime() + 60000), attempts: { increment: 1 } } });
  if (!claimed.count) return;
  const s = await db.assessmentSubmission.findUnique({ where: { id }, include: { version: true } });
  if (!s) return;
  const c = s.version.content as unknown as Content; const submitted = s.answers as unknown as Answer[];
  let state: string; let result: unknown;
  try {
    // Choice-only assessments never launch a browser/container.
    const graded = c.questions.every((q) => q.type === 'CHOICE') ? {
      results: c.questions.map((q) => { const correct = submitted.find((a) => a.questionId === q.id)?.choiceId === q.correctChoiceId; return { questionId: q.id, correct, checksPassed: correct ? 1 : 0, checksTotal: 1 }; }),
      correct: c.questions.every((q) => submitted.find((a) => a.questionId === q.id)?.choiceId === q.correctChoiceId),
    } : await execute({ questions: c.questions, answers: submitted });
    // Validate the exact question/result binding, not just a "correct" flag.
    const records = graded.results as Array<{ questionId?: unknown; correct?: unknown; checksPassed?: unknown; checksTotal?: unknown }>;
    if (records.length !== c.questions.length || c.questions.some((q) => {
      const matches = records.filter((r) => r.questionId === q.id && typeof r.correct === 'boolean');
      if (matches.length !== 1) return true;
      const r = matches[0]!; const total = q.type === 'CHOICE' ? 1 : q.type === 'PROGRAM' ? q.program!.tests!.length : q.checks!.length;
      return r.checksTotal !== total || !Number.isInteger(r.checksPassed) || (r.checksPassed as number) < 0 || (r.checksPassed as number) > total || (r.correct === true && r.checksPassed !== total);
    }) || graded.correct !== records.every((r) => r.correct === true)) throw new Error('GRADING_RESULT_INVALID');
    state = graded.correct ? 'CORRECT' : 'INCORRECT'; result = { correct: graded.correct, questions: records.map((r) => ({ questionId: r.questionId, correct: r.correct, checksPassed: r.checksPassed, checksTotal: r.checksTotal })) };
  } catch (error) {
    state = (error as Error).message === 'CODE_LIMIT' ? 'INCORRECT' : 'ERROR';
    result = { correct: false, error: state === 'INCORRECT' ? 'CODE_LIMIT' : 'CHECKING_UNAVAILABLE' };
  }
  await db.$transaction(async (tx) => {
    const won = await tx.assessmentSubmission.updateMany({ where: { id, state: 'RUNNING', leaseToken: token }, data: { state, result: result as Prisma.InputJsonValue, leasedUntil: null, leaseToken: null } });
    if (won.count && state === 'CORRECT') await tx.assessmentPass.upsert({ where: { studentId_assessmentId: { studentId: s.studentId, assessmentId: s.assessmentId } }, create: { studentId: s.studentId, assessmentId: s.assessmentId, passedVersion: s.version.version }, update: {} });
  });
}

/** Durable DB outbox delivery; queue loss cannot lose an accepted submission. */
export async function reconcileGrading(db: PrismaClient, queue: Queue, now = new Date()): Promise<void> {
  const due = await db.assessmentSubmission.findMany({ where: { OR: [{ state: 'PENDING' }, { state: 'RUNNING', leasedUntil: { lt: now } }] }, orderBy: { createdAt: 'asc' }, take: 500, select: { id: true } });
  for (const s of due) {
    const existing = await queue.getJob(s.id);
    if (existing) { const state = await existing.getState(); if (state === 'completed' || state === 'failed') await existing.remove(); else continue; }
    await queue.add('check', { submissionId: s.id }, { jobId: s.id, attempts: 3, backoff: { type: 'exponential', delay: 2000 }, removeOnComplete: true, removeOnFail: 100 });
  }
}

export async function reconcilePreparations(db: PrismaClient, queue: Queue, now = new Date()): Promise<void> {
  const due = await db.assessmentPreparation.findMany({ where: { OR: [{ state: 'PENDING' }, { state: 'RUNNING', leasedUntil: { lt: now } }] }, orderBy: { createdAt: 'asc' }, take: 32, select: { id: true } });
  for (const item of due) {
    const existing = await queue.getJob(item.id);
    if (existing) { const state = await existing.getState(); if (state === 'completed' || state === 'failed') await existing.remove(); else continue; }
    await queue.add('prepare', { id: item.id }, { jobId: item.id, removeOnComplete: true, removeOnFail: 32 });
  }
}

/** Bounded retention; earned passes and progression snapshots are independent. */
export async function retainGradingHistory(db: PrismaClient, now = Date.now()): Promise<boolean> {
  const cutoff = new Date(now - 180 * 86400000);
  // Preview code/input is cleared on completion; short-lived output is not a submission.
  const previews = await db.pythonRun.findMany({ where: { createdAt: { lt: new Date(now - 86400000) }, state: { notIn: ['PENDING', 'RUNNING'] } }, select: { id: true }, take: 1000 });
  await db.pythonRun.deleteMany({ where: { id: { in: previews.map((p) => p.id) } } });
  const history = await db.assessmentSubmission.findMany({ where: { createdAt: { lt: cutoff }, state: { notIn: ['PENDING', 'RUNNING'] } }, select: { id: true }, take: 1000 });
  await db.assessmentSubmission.deleteMany({ where: { id: { in: history.map((s) => s.id) } } });
  const preparations = await db.assessmentPreparation.findMany({ where: { createdAt: { lt: cutoff }, state: { in: ['READY', 'FAILED'] } }, select: { id: true }, take: 1000 });
  await db.assessmentPreparation.deleteMany({ where: { id: { in: preparations.map((p) => p.id) } } });
  const runs = await db.practiceRun.findMany({ where: { createdAt: { lt: cutoff } }, select: { studentId: true, idempotencyKey: true }, take: 1000 });
  if (runs.length) await db.practiceRun.deleteMany({ where: { OR: runs } });
  return previews.length < 1000 && history.length < 1000 && preparations.length < 1000 && runs.length < 1000;
}

export async function startGradingWorker() {
  if (process.env.NODE_ENV === 'production' && process.env.GRADING_RUNTIME !== 'runsc') throw new Error('GRADING_ISOLATION_UNQUALIFIED');
  await cleanupExpiredExecutions();
  const db = new PrismaClient(); const connection = new Redis(process.env.REDIS_URL!, { maxRetriesPerRequest: null });
  const queue = new Queue('fayq-assessment-grading', { connection: connection as never });
  const preparationQueue = new Queue('fayq-assessment-preparation', { connection: connection as never });
  const pythonQueue = new Queue('fayq-python-preview', { connection: connection as never });
  const pythonWorker = new Worker('fayq-python-preview', async (job) => { await processPythonRun(db, job.id!); }, { connection: connection as never, concurrency: 1 });
  pythonWorker.on('error', () => { process.stderr.write('PYTHON_QUEUE_UNAVAILABLE\n'); });
  const preparer = new Worker('fayq-assessment-preparation', async (job) => { await processPreparation(db, job.id!); }, { connection: connection as never, concurrency: 1 });
  preparer.on('error', () => { process.stderr.write('PREPARATION_QUEUE_UNAVAILABLE\n'); });
  const worker = new Worker('fayq-assessment-grading', async (job) => {
    await processSubmission(db, job.id!);
    const done = await db.assessmentSubmission.findUnique({ where: { id: job.id! }, select: { id: true, studentId: true, state: true } });
    if (done && !['PENDING', 'RUNNING'].includes(done.state)) {
      // Hint only, after durable commit. Lost delivery is repaired by HTTP;
      // private checks, answers and result bodies never enter pub/sub.
      await connection.publish('education-platform:m9:completed', JSON.stringify({ studentId: done.studentId, submissionId: done.id })).catch(() => undefined);
    }
  }, { connection: connection as never, concurrency: 1 });
  worker.on('error', () => { process.stderr.write('GRADING_QUEUE_UNAVAILABLE\n'); });
  let lastCleanup = Date.now(), lastRetention = 0;
  const reconcile = async (): Promise<void> => {
    if (Date.now() - lastCleanup > 30000) { await cleanupExpiredExecutions(); lastCleanup = Date.now(); }
    await reconcileGrading(db, queue);
    await reconcilePreparations(db, preparationQueue);
    const previews = await db.pythonRun.findMany({ where: { OR: [{ state: 'PENDING' }, { state: 'RUNNING', leasedUntil: { lt: new Date() } }] }, orderBy: { createdAt: 'asc' }, take: 100, select: { id: true } });
    for (const preview of previews) {
      const existing = await pythonQueue.getJob(preview.id);
      if (existing) { const state = await existing.getState(); if (state === 'completed' || state === 'failed') await existing.remove(); else continue; }
      await pythonQueue.add('run', { id: preview.id }, { jobId: preview.id, removeOnComplete: true, removeOnFail: 100 });
    }
    if (Date.now() - lastRetention > 3600000 && await retainGradingHistory(db)) lastRetention = Date.now();
  };
  let pending: Promise<void> | null = null, stopped = false;
  const healthFile = '/tmp/fayq-grading-ready';
  rmSync(healthFile, { force: true });
  const tick = (): Promise<void> => {
    if (stopped) return Promise.resolve();
    if (pending) return pending;
    pending = reconcile().then(() => { writeFileSync(healthFile, '', { mode: 0o600 }); }).catch(() => { process.stderr.write('GRADING_RECONCILE_UNAVAILABLE\n'); }).finally(() => { pending = null; });
    return pending;
  };
  await tick(); const timer = setInterval(() => { void tick(); }, 2000);
  return { stop: async (): Promise<void> => { if (stopped) return; stopped = true; clearInterval(timer); await pending; rmSync(healthFile, { force: true }); await Promise.all([worker.close(), preparer.close(), pythonWorker.close()]); await Promise.all([queue.close(), preparationQueue.close(), pythonQueue.close()]); await connection.quit(); await db.$disconnect(); } };
}
