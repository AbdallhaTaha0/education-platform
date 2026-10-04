import type { StudentProfile } from '@prisma/client';
import type { IdentityContext } from './service.js';
import { ApiError } from './errors.js';
import { mapUniqueViolation } from './store.js';
import { protectNationalId, validateStudentDetails } from './student-data.js';

const selection = { parentPhone: true, schoolYear: true, governorate: true, schoolName: true, nationalIdLast4: true, version: true } as const;
type PublicProfile = Pick<StudentProfile, keyof typeof selection>;
function safeProfile(profile: PublicProfile | null) {
  return {
    parentPhone: profile?.parentPhone ?? '', schoolYear: profile?.schoolYear ?? '',
    governorate: profile?.governorate ?? '', schoolName: profile?.schoolName ?? '',
    nationalIdMasked: profile?.nationalIdLast4 ? `**********${profile.nationalIdLast4}` : null,
    version: profile?.version ?? 0,
    complete: Boolean(profile?.nationalIdLast4 && profile.parentPhone && profile.schoolYear && profile.governorate),
  };
}
function checkId(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new ApiError(404, 'NOT_FOUND', 'Student not found.');
}
export async function readStudentProfile(ctx: IdentityContext, userId: string, actorId?: string) {
  checkId(userId);
  return ctx.prisma.$transaction(async tx => {
    const user = await tx.user.findUnique({ where: { id: userId }, select: { role: true } });
    if (user?.role !== 'STUDENT') throw new ApiError(404, 'NOT_FOUND', 'Student not found.');
    const profile = await tx.studentProfile.findUnique({ where: { userId }, select: selection });
    if (actorId) await tx.auditEvent.create({ data: { actorUserId: actorId, action: 'STUDENT_PROFILE_VIEWED', entityType: 'User', entityId: userId } });
    return safeProfile(profile);
  });
}
export async function editStudentProfile(ctx: IdentityContext, userId: string, actorId: string, sessionId: string, raw: unknown, admin = false) {
  checkId(userId);
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid student details.');
  const body = raw as Record<string, unknown>;
  if (Object.keys(body).some(k => !['nationalId','parentPhone','schoolYear','governorate','schoolName','version'].includes(k))) throw new ApiError(400, 'INVALID_FIELD', 'Unsupported student detail.');
  if (!Number.isInteger(body.version) || (body.version as number) < 0) throw new ApiError(400, 'VALIDATION_ERROR', 'Profile version is required.', { field: 'version' });
  const details = validateStudentDetails(body, false);
  const protectedId = body.nationalId === undefined ? undefined : protectNationalId(body.nationalId, ctx.auth.studentDataKeys, userId);
  const fields = Object.keys(details).concat(protectedId ? ['nationalId'] : []);
  if (!fields.length) throw new ApiError(400, 'VALIDATION_ERROR', 'No changes supplied.');
  try {
    return await ctx.prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`;
      const user = await tx.user.findUnique({ where: { id: userId }, select: { role: true } });
      if (user?.role !== 'STUDENT') throw new ApiError(404, 'NOT_FOUND', 'Student not found.');
      const now = new Date(ctx.clock ? ctx.clock() : Date.now());
      const session = await tx.authSession.findUnique({ where: { id: sessionId }, include: { user: { select: { role: true } } } });
      if (!session || session.userId !== actorId || session.revokedAt || session.absoluteExpiresAt <= now || (admin ? session.user.role !== 'ADMIN' : actorId !== userId)) throw new ApiError(401, 'SESSION_REVOKED', 'Session is invalid.');
      const existing = await tx.studentProfile.findUnique({ where: { userId } });
      if ((existing?.version ?? 0) !== body.version) throw new ApiError(409, 'PROFILE_CHANGED', 'Profile changed. Reload before saving.');
      if (!admin && protectedId && existing?.nationalIdFingerprint) throw new ApiError(403, 'NATIONAL_ID_ADMIN_ONLY', 'Ask ADMIN to correct your national ID.');
      if (!admin && !existing?.nationalIdFingerprint) {
        if (!protectedId) throw new ApiError(400, 'VALIDATION_ERROR', 'National ID is required to complete your details.', { field: 'nationalId' });
        validateStudentDetails(body, true);
      }
      const profile = await tx.studentProfile.upsert({ where: { userId }, create: { userId, ...details, ...protectedId, version: 1 }, update: { ...details, ...protectedId, version: { increment: 1 } }, select: selection });
      await tx.auditEvent.create({ data: { actorUserId: actorId, action: admin ? 'STUDENT_PROFILE_ADMIN_UPDATED' : 'STUDENT_PROFILE_UPDATED', entityType: 'User', entityId: userId, metadata: { fields } } });
      return safeProfile(profile);
    });
  } catch (err) {
    if (err instanceof ApiError) throw err;
    const unique = mapUniqueViolation(err); if (unique) throw unique;
    // Prisma errors can include private query arguments; never log/rethrow them.
    throw new ApiError(500, 'STUDENT_PROFILE_UNAVAILABLE', 'Could not save student details.');
  }
}
