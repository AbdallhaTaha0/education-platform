import type { PrismaClient } from '@prisma/client';
import { ApiError } from '../../identity/errors.js';
import { audit } from '../audit.js';
import { withCourseLock } from '../courseTx.js';
import { nonBlankString, rejectUnknownFields, validateSlug, assertUuid } from '../validation.js';
import type { PublicCourse } from '../types.js';
import { academicPlacement, type AcademicPlacement } from '../academic.js';
import { effectiveHierarchy } from './revisions.js';
import { validateCourseCover } from './cover.js';

const CREATE_FIELDS = new Set([
  'slug',
  'titleAr',
  'titleEn',
  'descriptionAr',
  'descriptionEn',
  'academic',
  'coverImage',
]);
const UPDATE_FIELDS = new Set([
  'slug',
  'titleAr',
  'titleEn',
  'descriptionAr',
  'descriptionEn',
  'academic',
  'coverImage',
]);

function toPublicCourse(row: {
  id: string;
  slug: string;
  titleAr: string;
  titleEn: string;
  descriptionAr: string;
  descriptionEn: string;
  coverId: string | null;
  publishedAt: Date | null;
  grade: string | null;
  academicYear: string | null;
  term: number | null;
  courseKind: string | null;
  teachingMonth: string | null;
  plans: {
    id: string;
    currentPricePiastres: number;
    previousPricePiastres: number | null;
    durationDays: number | null;
    accessMode: 'DURATION' | 'TERM_END' | 'YEAR_END' | 'UNTIL_REMOVAL';
    accessEndsAt: Date | null;
  }[];
}): PublicCourse {
  return {
    id: row.id,
    slug: row.slug,
    titleAr: row.titleAr,
    titleEn: row.titleEn,
    descriptionAr: row.descriptionAr,
    descriptionEn: row.descriptionEn,
    coverUrl: row.coverId ? `/catalog/courses/${row.id}/cover?v=${row.coverId}` : null,
    publishedAt: row.publishedAt?.toISOString() ?? null,
    academic: {
      grade: row.grade,
      academicYear: row.academicYear,
      term: row.term,
      courseKind: row.courseKind,
      teachingMonth: row.teachingMonth,
    },
    plans: row.plans.map((p) => ({
      id: p.id,
      currentPricePiastres: p.currentPricePiastres,
      previousPricePiastres: p.previousPricePiastres,
      durationDays: p.durationDays,
      accessMode: p.accessMode,
      accessEndsAt: p.accessEndsAt?.toISOString() ?? null,
    })),
  };
}

export async function listPublishedCourses(
  prisma: PrismaClient,
  filters: Record<string, unknown> = {},
): Promise<PublicCourse[]> {
  rejectUnknownFields(
    filters,
    new Set(['grade', 'academicYear', 'term', 'courseKind', 'teachingMonth']),
  );
  const where: {
    grade?: string;
    academicYear?: string;
    term?: number;
    courseKind?: string;
    teachingMonth?: string;
  } = {};
  for (const field of ['grade', 'academicYear', 'courseKind', 'teachingMonth'] as const) {
    if (filters[field] !== undefined) {
      const value = filters[field];
      if (typeof value !== 'string' || value.length > 20)
        throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid catalog filter.');
      if (field === 'grade' && !['FIRST_SECONDARY', 'SECOND_SECONDARY'].includes(value))
        throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid grade.');
      if (field === 'courseKind' && !['MONTHLY_EXPLANATION', 'REVISION'].includes(value))
        throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid course kind.');
      if (field === 'academicYear' && !/^\d{4}\/\d{4}$/.test(value))
        throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid academic year.');
      if (field === 'teachingMonth' && !/^\d{4}-(0[1-9]|1[0-2])$/.test(value))
        throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid teaching month.');
      where[field] = value;
    }
  }
  if (filters.term !== undefined) {
    if (filters.term !== '1' && filters.term !== '2')
      throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid term.');
    where.term = Number(filters.term);
  }
  const rows = await prisma.course.findMany({
    where: { status: 'PUBLISHED', deletionRequestedAt: null, ...where },
    orderBy: { createdAt: 'desc' },
    include: { plans: true },
  });
  return rows.map(toPublicCourse);
}

export async function getPublishedCourseBySlug(
  prisma: PrismaClient,
  slug: string,
): Promise<PublicCourse> {
  const clean = slug.trim().toLowerCase();
  const row = await prisma.course.findUnique({ where: { slug: clean }, include: { plans: true } });
  if (row === null || row.status !== 'PUBLISHED' || row.deletionRequestedAt !== null) {
    throw new ApiError(404, 'NOT_FOUND', 'Course not found.');
  }
  return toPublicCourse(row);
}

export async function listCoursesAdmin(prisma: PrismaClient) {
  return prisma.course.findMany({
    where: { revisionOwnerId: null },
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
      sections: {
        orderBy: { position: 'asc' },
        include: { lessons: { orderBy: { position: 'asc' }, include: { media: true } } },
      },
    },
  });
  if (course === null) throw new ApiError(404, 'NOT_FOUND', 'Course not found.');
  if (course.historical) throw new ApiError(404, 'NOT_FOUND', 'Course not found.');
  return effectiveHierarchy(prisma, courseId);
}

export function ensureMutable(
  course: { status: string; deletionRequestedAt: Date | null; workingCopyId?: string | null; historical?: boolean },
  op: string,
): void {
  if (course.workingCopyId || course.historical) throw new ApiError(409, 'COURSE_NOT_DRAFT', 'Open the working draft to edit this course.');
  if (course.deletionRequestedAt !== null) {
    throw new ApiError(409, 'DELETION_PENDING', `${op} is blocked while deletion is pending.`);
  }
  if (course.status === 'ARCHIVED') {
    throw new ApiError(409, 'COURSE_ARCHIVED', `${op} is blocked while archived. Use unarchive.`);
  }
}

export function ensureStructuralAllowed(course: {
  status: string;
  deletionRequestedAt: Date | null;
}): void {
  ensureMutable(course, 'Structural change');
  if (course.status !== 'DRAFT') {
    throw new ApiError(
      409,
      'COURSE_NOT_DRAFT',
      'Structural and media changes are allowed only in DRAFT.',
    );
  }
}

/** Owner-approved additions to live courses; existing structural edits stay draft-only. */
export function ensureLessonAdditionAllowed(course: {
  status: string;
  deletionRequestedAt: Date | null;
}): void {
  ensureMutable(course, 'Lesson addition');
  if (course.status !== 'DRAFT' && course.status !== 'PUBLISHED') {
    throw new ApiError(409, 'COURSE_NOT_DRAFT', 'Lesson addition and initial media upload require DRAFT or PUBLISHED.');
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
    data: {
      slug,
      titleAr,
      titleEn,
      descriptionAr,
      descriptionEn,
      status: 'DRAFT',
      ...(body.coverImage === undefined ? {} : { cover: { create: validateCourseCover(body.coverImage) } }),
      ...(body.academic === undefined ? {} : academicPlacement(body.academic)),
    },
  });
  await audit(prisma, {
    actorUserId: actorId,
    action: 'COURSE_CREATED',
    entityType: 'Course',
    entityId: created.id,
    metadata: { slug },
  });
  return created;
}

export async function updateCourse(
  prisma: PrismaClient,
  actorId: string,
  courseId: string,
  raw: unknown,
) {
  assertUuid(courseId, 'courseId');
  rejectUnknownFields(raw, UPDATE_FIELDS);
  const body = raw as Record<string, unknown>;
  const data: Partial<AcademicPlacement> & {
    slug?: string;
    titleAr?: string;
    titleEn?: string;
    descriptionAr?: string;
    descriptionEn?: string;
    cover?: { create: ReturnType<typeof validateCourseCover> };
  } = {};
  if (body.academic !== undefined) Object.assign(data, academicPlacement(body.academic));
  if (body.coverImage !== undefined) data.cover = { create: validateCourseCover(body.coverImage) };
  if (body['slug'] !== undefined) data.slug = validateSlug(body['slug']);
  if (body['titleAr'] !== undefined) data.titleAr = nonBlankString(body['titleAr'], 'titleAr', 300);
  if (body['titleEn'] !== undefined) data.titleEn = nonBlankString(body['titleEn'], 'titleEn', 300);
  if (body['descriptionAr'] !== undefined)
    data.descriptionAr = nonBlankString(body['descriptionAr'], 'descriptionAr', 5000);
  if (body['descriptionEn'] !== undefined)
    data.descriptionEn = nonBlankString(body['descriptionEn'], 'descriptionEn', 5000);
  if (Object.keys(data).length === 0)
    throw new ApiError(400, 'VALIDATION_ERROR', 'No updatable fields.');
  return withCourseLock(prisma, courseId, async (tx) => {
    const course = await tx.course.findUnique({ where: { id: courseId } });
    if (course === null) throw new ApiError(404, 'NOT_FOUND', 'Course not found.');
    ensureMutable(course, 'Course update');
    if (body.academic !== undefined) {
      const effective = { ...course, ...data };
      const plans = await tx.subscriptionPlan.findMany({ where: { courseId } });
      if (
        plans.some(
          (p) =>
            ['TERM_END', 'YEAR_END'].includes(p.accessMode) &&
            (!effective.academicYear || (p.accessMode === 'TERM_END' && !effective.term)),
        )
      ) {
        throw new ApiError(
          409,
          'VALIDATION_ERROR',
          'Academic placement is required by an existing access plan.',
        );
      }
    }
    try {
      if (data.slug && course.revisionOwnerId) {
        const taken = await tx.course.findUnique({ where: { slug: data.slug } });
        if (taken && taken.id !== course.revisionOwnerId) throw new ApiError(409, 'SLUG_TAKEN', 'Slug is already taken.');
      }
      const updated = await tx.course.update({ where: { id: courseId }, data: course.revisionOwnerId && data.slug ? { ...data, slug: course.slug, requestedSlug: data.slug } : data });
      await audit(tx, {
        actorUserId: actorId,
        action: 'COURSE_UPDATED',
        entityType: 'Course',
        entityId: courseId,
        metadata: { fields: Object.keys(data) },
      });
      return updated;
    } catch (err) {
      if ((err as { code?: string }).code === 'P2002')
        throw new ApiError(409, 'SLUG_TAKEN', 'Slug is already taken.');
      throw err;
    }
  });
}
