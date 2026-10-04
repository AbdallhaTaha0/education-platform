import { createHash, randomUUID } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import { ApiError } from '../identity/errors.js';
import { object, key, type Content } from './contracts.js';
import { practiceEligible, quotaLocked, quotaView } from './quota.js';
import { assessmentAccess } from './service.js';
import { runPython } from './python.js';

export async function requestPythonRun(db: PrismaClient, userId: string, role: string, value: unknown, now: number) {
  const b = object(value); const idempotencyKey = key(b.idempotencyKey);
  if (typeof b.source !== 'string' || b.source.length > 32768 || typeof b.input !== 'string' || b.input.length > 8192) throw new ApiError(400, 'VALIDATION_ERROR', 'Python source or input is invalid.');
  const source = b.source, input = b.input;
  const assessmentId = b.assessmentId === undefined ? null : String(b.assessmentId);
  if (assessmentId && !/^[\da-f]{8}(-[\da-f]{4}){3}-[\da-f]{12}$/i.test(assessmentId)) throw new ApiError(400, 'VALIDATION_ERROR', 'Assessment id is invalid.');
  if (role === 'STUDENT') {
    if (assessmentId) {
      const a = await assessmentAccess(db, userId, assessmentId, now);
      const v = await db.assessmentVersion.findUniqueOrThrow({ where: { assessmentId_version: { assessmentId, version: a.version } } });
      if ((v.content as unknown as Content).ide !== 'python') throw new ApiError(400, 'VALIDATION_ERROR', 'This assessment does not use Python.');
    } else await practiceEligible(db, userId, now);
  } else if (role !== 'ADMIN') throw new ApiError(403, 'FORBIDDEN', 'IDE access required.');
  // Admin reference previews have no course/quota requirement; never award a pass.
  if (role === 'ADMIN' && assessmentId) throw new ApiError(400, 'VALIDATION_ERROR', 'Admin previews do not bind student assessments.');
  const hash = createHash('sha256').update(JSON.stringify({ assessmentId, source, input })).digest('hex');
  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "User" WHERE id=${userId} FOR UPDATE`;
    const prior = await tx.pythonRun.findUnique({ where: { userId_idempotencyKey: { userId, idempotencyKey } } });
    if (prior) {
      if (prior.inputHash !== hash) throw new ApiError(409, 'IDEMPOTENCY_CONFLICT', 'Run key belongs to different code.');
      return { id: prior.id, state: prior.state, ...(role === 'STUDENT' && !assessmentId ? { quota: quotaView(await quotaLocked(tx, userId, now)) } : {}) };
    }
    if (await tx.pythonRun.findFirst({ where: { userId, state: { in: ['PENDING', 'RUNNING'] } }, select: { id: true } })) throw new ApiError(429, 'CHECKING_IN_PROGRESS', 'Wait for your current Python run.');
    let quota;
    if (role === 'STUDENT' && !assessmentId) {
      const q = await quotaLocked(tx, userId, now);
      if (q.used >= (q.limit ?? 50)) throw new ApiError(429, 'PRACTICE_LIMIT_REACHED', 'Practice allowance is exhausted.');
      if (await tx.practiceRun.findUnique({ where: { studentId_idempotencyKey: { studentId: userId, idempotencyKey } } })) throw new ApiError(409, 'IDEMPOTENCY_CONFLICT', 'Run key already used in another IDE.');
      await tx.practiceRun.create({ data: { studentId: userId, idempotencyKey, epoch: q.epoch } });
      quota = quotaView(await tx.practiceQuota.update({ where: { studentId: userId }, data: { used: { increment: 1 } } }));
    }
    const job = await tx.pythonRun.create({ data: { userId, assessmentId, idempotencyKey, inputHash: hash, source, input } });
    return { id: job.id, state: job.state, ...(quota ? { quota } : {}) };
  }).catch((error: unknown) => {
    if (String((error as Error).message).includes('M9_QUEUE_BUSY')) throw new ApiError(503, 'CHECKING_BUSY', 'Execution queue is full. No run was charged.');
    throw error;
  });
}
export async function processPythonRun(db: PrismaClient, id: string, execute = runPython) {
  const token = randomUUID(); const now = new Date();
  const won = await db.pythonRun.updateMany({ where: { id, OR: [{ state: 'PENDING' }, { state: 'RUNNING', leasedUntil: { lt: now } }] }, data: { state: 'RUNNING', leaseToken: token, leasedUntil: new Date(now.getTime() + 60000) } });
  if (!won.count) return;
  const job = await db.pythonRun.findUnique({ where: { id } }); if (!job) return;
  let output = '', error: string | null = 'CHECKING_UNAVAILABLE';
  try { const result = await execute(job.source!, job.input!); output = result.output; error = result.error; } catch { /* Fail closed; never log executable source. */ }
  await db.pythonRun.updateMany({ where: { id, state: 'RUNNING', leaseToken: token }, data: { state: error ? 'ERROR' : 'COMPLETED', output: output.slice(0, 8192), error, source: null, input: null, leaseToken: null, leasedUntil: null } });
}
