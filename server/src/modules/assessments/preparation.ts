import { randomUUID } from 'node:crypto';
import type { PrismaClient, Prisma } from '@prisma/client';
import { ApiError } from '../identity/errors.js';
import { content, type Content } from './contracts.js';
import { preparationHash, freezePrograms } from './program-contracts.js';
import { executeIsolated } from './launcher.js';

export async function requestPreparation(db: PrismaClient, actor: string, assessmentId: string) {
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(174923)`;
    await tx.$queryRaw`SELECT id FROM "Assessment" WHERE id=${assessmentId} FOR UPDATE`;
    const a = await tx.assessment.findUnique({ where: { id: assessmentId } });
    if (!a) throw new ApiError(404, 'NOT_FOUND', 'Assessment not found.');
    const c = content(a.content);
    if (!c.questions.some((q) => q.type === 'PROGRAM')) throw new ApiError(409, 'NO_PROGRAM_PROBLEMS', 'This assessment has no input/output problems.');
    const hash = preparationHash(c);
    const old = await tx.assessmentPreparation.findUnique({ where: { assessmentId_contentHash: { assessmentId, contentHash: hash } } });
    if (old && old.state !== 'FAILED') return { id: old.id, state: old.state };
    if (await tx.assessmentPreparation.count({ where: { state: { in: ['PENDING', 'RUNNING'] } } }) >= 32) throw new ApiError(429, 'PREPARATION_BUSY', 'Test preparation queue is full. Try later.');
    const job = old ? await tx.assessmentPreparation.update({ where: { id: old.id }, data: { state: 'PENDING', error: null, leaseToken: null, leasedUntil: null } }) : await tx.assessmentPreparation.create({ data: { assessmentId, contentHash: hash, content: c as unknown as Prisma.InputJsonValue } });
    await tx.auditEvent.create({ data: { actorUserId: actor, action: 'ASSESSMENT_PREPARE', entityType: 'Assessment', entityId: assessmentId } });
    return { id: job.id, state: job.state };
  });
}

export async function preparationStatus(db: PrismaClient, assessmentId: string) {
  const a = await db.assessment.findUnique({ where: { id: assessmentId } });
  if (!a) throw new ApiError(404, 'NOT_FOUND', 'Assessment not found.');
  const job = await db.assessmentPreparation.findUnique({ where: { assessmentId_contentHash: { assessmentId, contentHash: preparationHash(content(a.content)) } }, select: { id: true, state: true, error: true, result: true } });
  return job ?? { state: 'UNPREPARED', error: null, result: null };
}

export async function processPreparation(db: PrismaClient, id: string, execute = executeIsolated): Promise<void> {
  const token = randomUUID(); const now = new Date();
  const won = await db.assessmentPreparation.updateMany({ where: { id, OR: [{ state: 'PENDING' }, { state: 'RUNNING', leasedUntil: { lt: now } }] }, data: { state: 'RUNNING', leaseToken: token, leasedUntil: new Date(now.getTime() + 60000) } });
  if (!won.count) return;
  const job = await db.assessmentPreparation.findUnique({ where: { id } }); if (!job) return;
  let state = 'FAILED', error: string | null = 'CHECKING_UNAVAILABLE', result: Prisma.InputJsonValue | undefined;
  try {
    const c = content(job.content);
    const output = await execute({ mode: 'prepare', seed: id, questions: c.questions.filter((q) => q.type === 'PROGRAM'), answers: [] });
    if (!output.correct) {
      const reported = (output.results[0] as { error?: string } | undefined)?.error;
      error = ['REFERENCE_FAILED', 'SAMPLE_MISMATCH', 'UNSTABLE_REFERENCE', 'GENERATOR_FAILED', 'PREPARATION_LIMIT'].includes(reported ?? '') ? reported! : 'REFERENCE_FAILED';
    } else {
      freezePrograms(c, output.results);
      state = 'READY'; error = null; result = output.results as Prisma.InputJsonValue;
    }
  } catch { /* Only a stable safe category is persisted, never source/URLs/errors. */ }
  await db.assessmentPreparation.updateMany({ where: { id, state: 'RUNNING', leaseToken: token }, data: { state, error, ...(result ? { result } : {}), leaseToken: null, leasedUntil: null } });
}
