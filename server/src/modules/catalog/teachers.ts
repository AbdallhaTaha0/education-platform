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

const TEACHER_FIELDS = new Set(['slug', 'nameAr', 'nameEn', 'bioAr', 'bioEn', 'position', 'active']);

function parseOptionalBool(value: unknown, field: string): boolean {
  if (typeof value !== 'boolean') {
    throw new ApiError(400, 'VALIDATION_ERROR', `${field} must be a boolean.`, { field });
  }
  return value;
}

function parseOptionalBio(value: unknown, field: string): string | null {
  if (value === null) return null;
  if (typeof value !== 'string') {
    throw new ApiError(400, 'VALIDATION_ERROR', `${field} must be a string or null.`, { field });
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  if (trimmed.length > 2000) {
    throw new ApiError(400, 'VALIDATION_ERROR', `${field} is too long.`, { field });
  }
  return trimmed;
}

export async function listPublicTeachers(prisma: PrismaClient) {
  return prisma.teacher.findMany({
    where: { active: true },
    orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
    select: {
      id: true,
      slug: true,
      nameAr: true,
      nameEn: true,
      bioAr: true,
      bioEn: true,
      position: true,
    },
  });
}

export async function listAdminTeachers(prisma: PrismaClient) {
  return prisma.teacher.findMany({
    orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
    include: { _count: { select: { courses: true } } },
  });
}

export async function createTeacher(prisma: PrismaClient, actorId: string, raw: unknown) {
  rejectUnknownFields(raw, TEACHER_FIELDS);
  const body = raw as Record<string, unknown>;
  const slug = validateSlug(body['slug']);
  const nameAr = nonBlankString(body['nameAr'], 'nameAr', 120);
  const nameEn = nonBlankString(body['nameEn'], 'nameEn', 120);
  const bioAr = body['bioAr'] !== undefined ? parseOptionalBio(body['bioAr'], 'bioAr') : null;
  const bioEn = body['bioEn'] !== undefined ? parseOptionalBio(body['bioEn'], 'bioEn') : null;
  let position: number;
  if (body['position'] !== undefined) {
    position = validatePosition(body['position'], 'position');
  } else {
    const maxRow = await prisma.teacher.findFirst({
      orderBy: { position: 'desc' },
      select: { position: true },
    });
    position = (maxRow?.position ?? 0) + 1;
  }
  const active = body['active'] !== undefined ? parseOptionalBool(body['active'], 'active') : true;

  if ((await prisma.teacher.findUnique({ where: { slug } })) !== null) {
    throw new ApiError(409, 'SLUG_TAKEN', 'Teacher slug is already taken.');
  }

  try {
    const created = await prisma.teacher.create({
      data: { slug, nameAr, nameEn, bioAr, bioEn, position, active },
      include: { _count: { select: { courses: true } } },
    });
    await audit(prisma, {
      actorUserId: actorId,
      action: 'TEACHER_CREATED',
      entityType: 'Teacher',
      entityId: created.id,
      metadata: { slug },
    });
    return created;
  } catch (err) {
    if ((err as { code?: string }).code === 'P2002') {
      throw new ApiError(409, 'SLUG_TAKEN', 'Teacher slug is already taken.');
    }
    throw err;
  }
}

export async function updateTeacher(
  prisma: PrismaClient,
  actorId: string,
  teacherId: string,
  raw: unknown,
) {
  assertUuid(teacherId, 'id');
  rejectUnknownFields(raw, TEACHER_FIELDS);
  const body = raw as Record<string, unknown>;
  const data: {
    slug?: string;
    nameAr?: string;
    nameEn?: string;
    bioAr?: string | null;
    bioEn?: string | null;
    position?: number;
    active?: boolean;
  } = {};
  if (body['slug'] !== undefined) data.slug = validateSlug(body['slug']);
  if (body['nameAr'] !== undefined) data.nameAr = nonBlankString(body['nameAr'], 'nameAr', 120);
  if (body['nameEn'] !== undefined) data.nameEn = nonBlankString(body['nameEn'], 'nameEn', 120);
  if (body['bioAr'] !== undefined) data.bioAr = parseOptionalBio(body['bioAr'], 'bioAr');
  if (body['bioEn'] !== undefined) data.bioEn = parseOptionalBio(body['bioEn'], 'bioEn');
  if (body['position'] !== undefined) data.position = validatePosition(body['position'], 'position');
  if (body['active'] !== undefined) data.active = parseOptionalBool(body['active'], 'active');

  if (Object.keys(data).length === 0) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'No updatable fields.');
  }

  const existing = await prisma.teacher.findUnique({ where: { id: teacherId } });
  if (!existing) throw new ApiError(404, 'TEACHER_NOT_FOUND', 'Teacher not found.');

  try {
    const updated = await prisma.teacher.update({
      where: { id: teacherId },
      data,
      include: { _count: { select: { courses: true } } },
    });
    await audit(prisma, {
      actorUserId: actorId,
      action: 'TEACHER_UPDATED',
      entityType: 'Teacher',
      entityId: teacherId,
      metadata: { fields: Object.keys(data) },
    });
    return updated;
  } catch (err) {
    if ((err as { code?: string }).code === 'P2002') {
      throw new ApiError(409, 'SLUG_TAKEN', 'Teacher slug is already taken.');
    }
    throw err;
  }
}

export async function deleteTeacher(prisma: PrismaClient, actorId: string, teacherId: string) {
  assertUuid(teacherId, 'id');
  const existing = await prisma.teacher.findUnique({ where: { id: teacherId } });
  if (!existing) throw new ApiError(404, 'TEACHER_NOT_FOUND', 'Teacher not found.');

  const count = await prisma.course.count({ where: { teacherId } });
  if (count > 0) {
    throw new ApiError(
      409,
      'TEACHER_IN_USE',
      'Cannot delete a teacher assigned to courses. Deactivate the teacher instead.',
    );
  }

  await prisma.teacher.delete({ where: { id: teacherId } });
  await audit(prisma, {
    actorUserId: actorId,
    action: 'TEACHER_DELETED',
    entityType: 'Teacher',
    entityId: teacherId,
    metadata: { slug: existing.slug },
  });
  return { deleted: true as const };
}
