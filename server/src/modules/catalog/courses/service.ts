import type { PrismaClient } from '@prisma/client';
import { ApiError } from '../../identity/errors.js';
import { audit } from '../audit.js';
import { withCourseLock } from '../courseTx.js';
import { nonBlankString, rejectUnknownFields, validateSlug, assertUuid } from '../validation.js';
import type { PublicCourse } from '../types.js';

const CREATE_FIELDS = new Set(['slug', 'titleAr', 'titleEn', 'descriptionAr', 'descriptionEn']);
const UPDATE_FIELDS = new Set(['slug', 'titleAr', 'titleEn', 'descriptionAr', 'descriptionEn']);

function toPublicCourse(row: {
  id: string;
  slug: string;
  titleAr: string;
  titleEn: string;
  descriptionAr: string;
  descriptionEn: string;
  publishedAt: Date | null;
  plans: { id: string; currentPricePiastres: number; previousPricePiastres: number | null; durationDays: number }[];
}): PublicCourse {
  return {
    id: row.id,
    slug: row.slug,
    titleAr: row.titleAr,
    titleEn: row.titleEn,
    descriptionAr: row.descriptionAr,
    descriptionEn: row.descriptionEn,
    publishedAt: row.publishedAt?.toISOString() ?? null,
    plans: row.plans.map((p) => ({
      id: p.id,
      currentPricePiastres: p.currentPricePiastres,
      previousPricePiastres: p.previousPricePiastres,
      durationDays: p.durationDays,
    })),
  };
}

export async function listPublishedCourses(prisma: PrismaClient): Promise<PublicCourse[]> {
  const rows = await prisma.course.findMany({
    where: { status: 'PUBLISHED', deletionRequestedAt: null },
    orderBy: { createdAt: 'desc' },
    include: { plans: true },
  });
  return rows.map(toPublicCourse);
}

export async function getPublishedCourseBySlug(prisma: PrismaClient, slug: string): Promise<PublicCourse> {
  const clean = slug.trim().toLowerCase();
  const row = await prisma.course.findUnique({ where: { slug: clean }, include: { plans: true } });
  if (row === null || row.status !== 'PUBLISHED' || row.deletionRequestedAt !== null) {
    throw new ApiError(404, 'NOT_FOUND', 'Course not found.');
  }
  return toPublicCourse(row);
}

export async function listCoursesAdmin(prisma: PrismaClient) {
  return prisma.course.findMany({
    orderBy: { createdAt: 'desc' },
    include: { plans: true, _count: { select: { sections: true } } },
  });
}

export async function getCourseAdmin(prisma: PrismaClient, courseId: string) {
  assertUuid(courseId, 'courseId');
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    include: {
      plans: { orderBy: { createdAt: 'asc' } },
      sections: { orderBy: { position: 'asc' }, include: { lessons: { orderBy: { position: 'asc' }, include: { media: true } } } },
    },
  });
  if (course === null) throw new ApiError(404, 'NOT_FOUND', 'Course not found.');
  return course;
}

export function ensureMutable(course: { status: string; deletionRequestedAt: Date | null }, op: string): void {
  if (course.deletionRequestedAt !== null) {
    throw new ApiError(409, 'DELETION_PENDING', `${op} is blocked while deletion is pending.`);
  }
  if (course.status === 'ARCHIVED') {
    throw new ApiError(409, 'COURSE_ARCHIVED', `${op} is blocked while archived. Use unarchive.`);
  }
}

export function ensureStructuralAllowed(course: { status: string; deletionRequestedAt: Date | null }): void {
  ensureMutable(course, 'Structural change');
  if (course.status !== 'DRAFT') {
    throw new ApiError(409, 'COURSE_NOT_DRAFT', 'Structural and media changes are allowed only in DRAFT.');
  }
}

export async function createCourse(prisma: PrismaClient, actorId: string, raw: unknown) {
  rejectUnknownFields(raw, CREATE_FIELDS);
  const body = raw as Record<string, unknown>;
  const slug = validateSlug(body['slug']);
  const titleAr = nonBlankString(body['titleAr'], 'titleAr', 300);
  const titleEn = nonBlankString(body['titleEn'], 'titleEn', 300);
  const descriptionAr = nonBlankString(body['descriptionAr'], 'descriptionAr', 5000);
  const descriptionEn = nonBlankString(body['descriptionEn'], 'descriptionEn', 5000);
  if ((await prisma.course.findUnique({ where: { slug } })) !== null) {
    throw new ApiError(409, 'SLUG_TAKEN', 'Slug is already taken.');
  }
  const created = await prisma.course.create({
    data: { slug, titleAr, titleEn, descriptionAr, descriptionEn, status: 'DRAFT' },
  });
  await audit(prisma, { actorUserId: actorId, action: 'COURSE_CREATED', entityType: 'Course', entityId: created.id, metadata: { slug } });
  return created;
}

export async function updateCourse(prisma: PrismaClient, actorId: string, courseId: string, raw: unknown) {
  assertUuid(courseId, 'courseId');
  rejectUnknownFields(raw, UPDATE_FIELDS);
  const body = raw as Record<string, unknown>;
  const data: { slug?: string; titleAr?: string; titleEn?: string; descriptionAr?: string; descriptionEn?: string } = {};
  if (body['slug'] !== undefined) data.slug = validateSlug(body['slug']);
  if (body['titleAr'] !== undefined) data.titleAr = nonBlankString(body['titleAr'], 'titleAr', 300);
  if (body['titleEn'] !== undefined) data.titleEn = nonBlankString(body['titleEn'], 'titleEn', 300);
  if (body['descriptionAr'] !== undefined) data.descriptionAr = nonBlankString(body['descriptionAr'], 'descriptionAr', 5000);
  if (body['descriptionEn'] !== undefined) data.descriptionEn = nonBlankString(body['descriptionEn'], 'descriptionEn', 5000);
  if (Object.keys(data).length === 0) throw new ApiError(400, 'VALIDATION_ERROR', 'No updatable fields.');
  return withCourseLock(prisma, courseId, async (tx) => {
    const course = await tx.course.findUnique({ where: { id: courseId } });
    if (course === null) throw new ApiError(404, 'NOT_FOUND', 'Course not found.');
    ensureMutable(course, 'Course update');
    try {
      const updated = await tx.course.update({ where: { id: courseId }, data });
      await audit(tx, { actorUserId: actorId, action: 'COURSE_UPDATED', entityType: 'Course', entityId: courseId, metadata: { fields: Object.keys(data) } });
      return updated;
    } catch (err) {
      if ((err as { code?: string }).code === 'P2002') throw new ApiError(409, 'SLUG_TAKEN', 'Slug is already taken.');
      throw err;
    }
  });
}
