/**
 * Student dashboard aggregation (M5).
 *
 * Returns only courses the student actually owns a subscription for. Active
 * and expired are separated on backend time, never on browser time. "Continue
 * learning" points at the most recently accessed incomplete lesson that is
 * still playable, so the UI never offers a lesson the API would refuse.
 */
import type { PrismaClient } from '@prisma/client';
import { evaluateEntitlement } from '../access/entitlement.js';
import { aggregateProgress } from '../progress/validation.js';
import type { EntitlementDecision } from '../types.js';

export interface DashboardSubscription {
  courseId: string;
  slug: string;
  titleAr: string;
  titleEn: string;
  expiresAt: string | null;
  availableForLearning: boolean;
  academic?: { grade: string | null; academicYear: string | null; term: number | null; courseKind: string | null; teachingMonth: string | null };
  state: 'ACTIVE' | 'EXPIRED';
  percentComplete: number;
  totalLessons: number;
  completedLessons: number;
  lastLessonId: string | null;
  lastAccessedAt: string | null;
}

export interface DashboardPayload {
  active: DashboardSubscription[];
  expired: DashboardSubscription[];
  walletBalancePiastres: number | null;
}

export async function loadDashboard(
  prisma: PrismaClient,
  studentId: string,
  nowMs: number,
): Promise<DashboardPayload> {
  const subscriptions = await prisma.subscription.findMany({
    where: { studentId },
    orderBy: { expiresAt: 'desc' },
    select: { courseId: true, startsAt: true, expiresAt: true },
  });
  const wallet = await prisma.wallet.findUnique({
    where: { userId: studentId },
    select: { balancePiastres: true },
  });
  const courseIds = [...new Set(subscriptions.map((s) => s.courseId))];
  const courses = await prisma.course.findMany({
    where: { id: { in: courseIds } },
    select: { id: true, slug: true, titleAr: true, titleEn: true, grade: true, academicYear: true, term: true, courseKind: true, teachingMonth: true, status: true, deletionRequestedAt: true },
  });
  const courseById = new Map(courses.map((c) => [c.id, c]));

  // One row per course; union of purchases decides the effective expiry.
  const byCourse = new Map<string, typeof subscriptions>();
  for (const sub of subscriptions) {
    const list = byCourse.get(sub.courseId) ?? [];
    list.push(sub);
    byCourse.set(sub.courseId, list);
  }

  const active: DashboardSubscription[] = [];
  const expired: DashboardSubscription[] = [];

  for (const [courseId, rows] of byCourse) {
    const decision = evaluateEntitlement(rows, courseId, nowMs);
    const head = rows[0];
    const course = courseById.get(courseId);
    if (head === undefined || course === undefined) continue;
    const progress = await courseProgress(prisma, studentId, courseId);
    const entry: DashboardSubscription = {
      courseId,
      slug: course.slug,
      titleAr: course.titleAr,
      titleEn: course.titleEn,
      expiresAt: decision.expiresAt?.toISOString() ?? null,
      availableForLearning: course.status === 'PUBLISHED' && course.deletionRequestedAt === null,
      academic: { grade: course.grade, academicYear: course.academicYear, term: course.term, courseKind: course.courseKind, teachingMonth: course.teachingMonth },
      state: decision.allowed ? 'ACTIVE' : 'EXPIRED',
      percentComplete: progress.percentComplete,
      totalLessons: progress.totalLessons,
      completedLessons: progress.completedLessons,
      lastLessonId: progress.lastLessonId,
      lastAccessedAt: progress.lastAccessedAt,
    };
    (decision.allowed ? active : expired).push(entry);
  }

  active.sort((a, b) => (a.lastAccessedAt ?? a.expiresAt ?? '').localeCompare(b.lastAccessedAt ?? b.expiresAt ?? ''));
  expired.sort((a, b) => (b.expiresAt ?? '').localeCompare(a.expiresAt ?? ''));

  return {
    active,
    expired,
    walletBalancePiastres: wallet?.balancePiastres ?? null,
  };
}

async function courseProgress(prisma: PrismaClient, studentId: string, courseId: string) {
  const [totalLessons, progressRows, playableLessonIds] = await Promise.all([
    prisma.lesson.count({ where: { section: { courseId } } }),
    prisma.lessonProgress.findMany({
      where: { studentId, courseId },
      select: { lessonId: true, completedAt: true, lastAccessedAt: true },
      orderBy: { lastAccessedAt: 'desc' },
    }),
    prisma.lesson.findMany({
      where: {
        section: { courseId },
        media: { status: 'READY', externalAssetId: { not: '' } },
      },
      select: { id: true },
    }),
  ]);
  const playable = new Set(playableLessonIds.map((l) => l.id));
  const completedIds = progressRows.filter((r) => r.completedAt !== null).map((r) => r.lessonId);
  // Continue-learning target: the most recent incomplete lesson that the API
  // would actually allow to play.
  const resume = progressRows.find((r) => r.completedAt === null && playable.has(r.lessonId));
  const aggregate = aggregateProgress({
    totalLessons,
    completedLessonIds: completedIds,
    lastAccessedLessonId: resume?.lessonId ?? null,
  });
  return {
    ...aggregate,
    lastAccessedAt: progressRows[0]?.lastAccessedAt?.toISOString() ?? null,
  };
}

export type { EntitlementDecision };
