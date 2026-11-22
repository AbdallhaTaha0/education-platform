import type { PrismaClient } from '@prisma/client';
import { ApiError } from '../identity/errors.js';
import { audit } from './audit.js';
import {
  assertUuid,
  nonBlankString,
  rejectUnknownFields,
  validatePosition,
  validateSlug,
} from './validation.js';

const SUBJECT_FIELDS = new Set(['slug', 'nameAr', 'nameEn', 'position', 'active']);

function parseOptionalBool(value: unknown, field: string): boolean {
  if (typeof value !== 'boolean') {
    throw new ApiError(400, 'VALIDATION_ERROR', `${field} must be a boolean.`, { field });
  }
  return value;
}

export async function listPublicSubjects(prisma: PrismaClient) {
  const rows = await prisma.subject.findMany({
    where: { active: true },
    orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
    select: { id: true, slug: true, nameAr: true, nameEn: true, position: true },
  });
  return rows;
}

export async function listAdminSubjects(prisma: PrismaClient) {
  return prisma.subject.findMany({
    orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
    include: { _count: { select: { courses: true } } },
  });
}

export async function createSubject(prisma: PrismaClient, actorId: string, raw: unknown) {
  rejectUnknownFields(raw, SUBJECT_FIELDS);
  const body = raw as Record<string, unknown>;
  const slug = validateSlug(body['slug']);
  const nameAr = nonBlankString(body['nameAr'], 'nameAr', 120);
  const nameEn = nonBlankString(body['nameEn'], 'nameEn', 120);
  let position: number;
  if (body['position'] !== undefined) {
    position = validatePosition(body['position'], 'position');
  } else {
    const maxRow = await prisma.subject.findFirst({
      orderBy: { position: 'desc' },
      select: { position: true },
    });
    position = (maxRow?.position ?? 0) + 1;
  }
  const active = body['active'] !== undefined ? parseOptionalBool(body['active'], 'active') : true;

  if ((await prisma.subject.findUnique({ where: { slug } })) !== null) {
    throw new ApiError(409, 'SLUG_TAKEN', 'Subject slug is already taken.');
  }

  try {
    const created = await prisma.subject.create({
      data: { slug, nameAr, nameEn, position, active },
      include: { _count: { select: { courses: true } } },
    });
    await audit(prisma, {
      actorUserId: actorId,
      action: 'SUBJECT_CREATED',
      entityType: 'Subject',
      entityId: created.id,
      metadata: { slug },
    });
    return created;
  } catch (err) {
    if ((err as { code?: string }).code === 'P2002') {
      throw new ApiError(409, 'SLUG_TAKEN', 'Subject slug is already taken.');
    }
    throw err;
  }
}

export async function updateSubject(
  prisma: PrismaClient,
  actorId: string,
  subjectId: string,
  raw: unknown,
) {
  assertUuid(subjectId, 'id');
  rejectUnknownFields(raw, SUBJECT_FIELDS);
  const body = raw as Record<string, unknown>;
  const data: {
    slug?: string;
    nameAr?: string;
    nameEn?: string;
    position?: number;
    active?: boolean;
  } = {};
  if (body['slug'] !== undefined) data.slug = validateSlug(body['slug']);
  if (body['nameAr'] !== undefined) data.nameAr = nonBlankString(body['nameAr'], 'nameAr', 120);
  if (body['nameEn'] !== undefined) data.nameEn = nonBlankString(body['nameEn'], 'nameEn', 120);
  if (body['position'] !== undefined) data.position = validatePosition(body['position'], 'position');
  if (body['active'] !== undefined) data.active = parseOptionalBool(body['active'], 'active');

  if (Object.keys(data).length === 0) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'No updatable fields.');
  }

  const existing = await prisma.subject.findUnique({ where: { id: subjectId } });
  if (!existing) throw new ApiError(404, 'SUBJECT_NOT_FOUND', 'Subject not found.');

  try {
    const updated = await prisma.subject.update({
      where: { id: subjectId },
      data,
      include: { _count: { select: { courses: true } } },
    });
    await audit(prisma, {
      actorUserId: actorId,
      action: 'SUBJECT_UPDATED',
      entityType: 'Subject',
      entityId: subjectId,
      metadata: { fields: Object.keys(data) },
    });
    return updated;
  } catch (err) {
    if ((err as { code?: string }).code === 'P2002') {
      throw new ApiError(409, 'SLUG_TAKEN', 'Subject slug is already taken.');
    }
    throw err;
  }
}

export async function deleteSubject(prisma: PrismaClient, actorId: string, subjectId: string) {
  assertUuid(subjectId, 'id');
  const existing = await prisma.subject.findUnique({ where: { id: subjectId } });
  if (!existing) throw new ApiError(404, 'SUBJECT_NOT_FOUND', 'Subject not found.');

  const count = await prisma.course.count({ where: { subjectId } });
  if (count > 0) {
    throw new ApiError(
      409,
      'SUBJECT_IN_USE',
      'Cannot delete a subject assigned to courses. Deactivate it instead.',
    );
  }

  await prisma.subject.delete({ where: { id: subjectId } });
  await audit(prisma, {
    actorUserId: actorId,
    action: 'SUBJECT_DELETED',
    entityType: 'Subject',
    entityId: subjectId,
    metadata: { slug: existing.slug },
  });
  return { deleted: true as const };
}
