import type { PrismaClient } from '@prisma/client';
import { ApiError } from '../identity/errors.js';
import { audit } from './audit.js';
import { cairoDeadline, invalid } from './academic.js';
import { lockCourseRowShared } from './locks.js';
import { assertUuid, nonBlankString, rejectUnknownFields, validatePrice } from './validation.js';
import type { TxClient } from './types.js';

const fields = new Set(['titleAr', 'titleEn', 'descriptionAr', 'descriptionEn', 'pricePiastres', 'endsAt', 'courseIds', 'status', 'expectedVersion']);
export const memberInclude = { members: { orderBy: { position: 'asc' as const }, include: { course: true } } };

export async function lockPackage(tx: TxClient, id: string) {
  await tx.$executeRaw`SELECT id FROM "CoursePackage" WHERE id = ${id} FOR UPDATE`;
  const row = await tx.coursePackage.findUnique({ where: { id }, include: memberInclude });
  if (!row) throw new ApiError(404, 'NOT_FOUND', 'Package not found.');
  return row;
}

export function memberIds(raw: unknown): string[] {
  if (!Array.isArray(raw) || raw.length !== 3) invalid('courseIds');
  const ids = raw.map(id => assertUuid(id, 'courseIds'));
  if (new Set(ids).size !== 3) invalid('courseIds');
  return ids;
}

export async function lockedMembers(tx: TxClient, ids: string[], published: boolean) {
  for (const id of [...ids].sort()) await lockCourseRowShared(tx, id);
  const rows = await tx.course.findMany({ where: { id: { in: ids } } });
  if (rows.length !== 3 || rows.some(c => c.courseKind !== 'MONTHLY_EXPLANATION' || !c.grade || !c.academicYear || !c.teachingMonth || c.deletionRequestedAt !== null || c.status === 'ARCHIVED')) {
    throw new ApiError(409, 'PACKAGE_UNAVAILABLE', 'Three available monthly courses are required.');
  }
  // Callers may permit presales under D27; this never releases protected content.
  if (published && rows.some(c => c.status !== 'PUBLISHED')) throw new ApiError(409, 'PACKAGE_UNAVAILABLE', 'All package members must be published.');
  return ids.map(id => rows.find(c => c.id === id)!);
}

export async function savePackage(prisma: PrismaClient, actorId: string, id: string | null, raw: unknown) {
  rejectUnknownFields(raw, fields);
  const body = raw as Record<string, unknown>;
  if (id) assertUuid(id);
  return prisma.$transaction(async tx => {
    const prior = id ? await lockPackage(tx, id) : null;
    if (prior && body.expectedVersion !== prior.version) throw new ApiError(409, 'OFFER_CHANGED', 'Review the latest package version.');
    if (!prior && body.expectedVersion !== undefined) invalid('expectedVersion');
    const value = (key: string) => body[key] === undefined ? (prior as unknown as Record<string, unknown> | null)?.[key] : body[key];
    const status = value('status') ?? 'DRAFT';
    if (!['DRAFT', 'PUBLISHED', 'ARCHIVED'].includes(String(status))) invalid('status');
    const ids = body.courseIds === undefined && prior ? prior.members.map(m => m.courseId) : memberIds(body.courseIds);
    const archiveOnly = prior !== null && status === 'ARCHIVED' && body.courseIds === undefined;
    if (!archiveOnly) {
      if (ids.length !== 3) invalid('courseIds');
      await lockedMembers(tx, ids, false);
    }
    const endsAt = body.endsAt === undefined && prior ? prior.endsAt : cairoDeadline(body.endsAt);
    if (status === 'PUBLISHED' && endsAt <= new Date()) throw new ApiError(409, 'OFFER_EXPIRED', 'The package deadline has passed.');
    const data = { titleAr: nonBlankString(value('titleAr'), 'titleAr', 300), titleEn: nonBlankString(value('titleEn'), 'titleEn', 300),
      descriptionAr: nonBlankString(value('descriptionAr'), 'descriptionAr', 5000), descriptionEn: nonBlankString(value('descriptionEn'), 'descriptionEn', 5000),
      pricePiastres: validatePrice(value('pricePiastres'), 'pricePiastres'), endsAt, status: String(status) };
    const saved = prior ? await tx.coursePackage.update({ where: { id: prior.id }, data: { ...data, version: { increment: 1 } } }) : await tx.coursePackage.create({ data });
    if (!prior || body.courseIds !== undefined) {
      if (prior) await tx.packageMember.deleteMany({ where: { packageId: prior.id } });
      await tx.packageMember.createMany({ data: ids.map((courseId, i) => ({ packageId: saved.id, courseId, position: i + 1 })) });
    }
    await audit(tx, { actorUserId: actorId, action: prior ? 'PACKAGE_UPDATED' : 'PACKAGE_CREATED', entityType: 'CoursePackage', entityId: saved.id, metadata: { version: saved.version, courseIds: ids, status: saved.status } });
    return tx.coursePackage.findUniqueOrThrow({ where: { id: saved.id }, include: memberInclude });
  });
}

export function publicPackage(row: Awaited<ReturnType<typeof lockPackage>>) {
  return { id: row.id, titleAr: row.titleAr, titleEn: row.titleEn, descriptionAr: row.descriptionAr, descriptionEn: row.descriptionEn,
    pricePiastres: row.pricePiastres, endsAt: row.endsAt.toISOString(), version: row.version,
    available: row.status === 'PUBLISHED' && row.endsAt > new Date() && row.members.length === 3 && row.members.every(m => m.course.status !== 'ARCHIVED' && m.course.courseKind === 'MONTHLY_EXPLANATION' && m.course.deletionRequestedAt === null),
    courses: row.members.filter(m => m.course.status !== 'ARCHIVED' && m.course.deletionRequestedAt === null).map(m => ({ id: m.course.id, slug: m.course.slug, titleAr: m.course.titleAr, titleEn: m.course.titleEn, position: m.position, published: m.course.status === 'PUBLISHED',
      grade: m.course.grade, academicYear: m.course.academicYear, term: m.course.term, teachingMonth: m.course.teachingMonth })) };
}

export async function listPackages(prisma: PrismaClient, admin = false) {
  const rows = await prisma.coursePackage.findMany({ where: admin ? {} : { status: 'PUBLISHED' }, include: memberInclude, orderBy: { createdAt: 'desc' }, take: 100 });
  return admin ? rows : rows.map(publicPackage);
}
