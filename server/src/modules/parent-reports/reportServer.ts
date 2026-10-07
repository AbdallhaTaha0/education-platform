/**
 * Parent-report generation service. One server-authoritative cutoff per
 * request; everything is read consistently at that cutoff; nothing is
 * persisted. Transient text only.
 */
import { Prisma, type PrismaClient } from '@prisma/client';
import { ApiError } from '../identity/errors.js';
import { postgresViewFactsReader, type ViewFactsReader } from './viewFacts.js';
import {
  REPORT_DAYS,
  cairoDate,
  renderParentReport,
  renderShortParentReport,
  toParts,
  weekSections,
  type ParentReportModel,
  type ReportLanguage,
  type ReportType,
} from './text.js';
import { canonicalCourseWhere } from './reportService.js';

export const MAX_GENERATE_COURSES = 50;

export interface GenerateInput {
  studentId: string;
  courseIds: string[];
  reportType: ReportType;
  language: ReportLanguage;
  format?: 'SHORT' | 'DETAILED';
  nowMs?: number;
}

export interface GenerateOutput {
  studentId: string;
  courseIds: string[];
  reportType: ReportType;
  generatedAt: string;
  period: { start: string; end: string; timeZone: 'Africa/Cairo' };
  guardian: { phone: string | null };
  parts: Array<{ index: number; total: number; text: string }>;
}

interface SubscriptionWindow {
  startsAt: Date;
  expiresAt: Date | null;
}

function overlaps(w: SubscriptionWindow, start: Date, end: Date): boolean {
  return w.startsAt < end && (w.expiresAt === null || w.expiresAt > start);
}

const SERVICE_ERROR_CODES = new Set(['CHECKING_UNAVAILABLE']);

interface SubmissionRow {
  id: string;
  assessmentId: string;
  createdAt: Date;
  state: string;
  result: unknown;
}

function latestAtCutoff(subs: SubmissionRow[], cutoff: Date): SubmissionRow | null {
  let latest: SubmissionRow | null = null;
  for (const s of subs) {
    if (s.createdAt > cutoff) continue;
    if (!latest || s.createdAt > latest.createdAt) latest = s;
  }
  return latest;
}

function submissionErrorCode(result: unknown): string | null {
  if (result && typeof result === 'object' && 'error' in result) {
    const code = (result as { error?: unknown }).error;
    if (typeof code === 'string') return code;
  }
  return null;
}

export async function generateParentReport(
  prisma: PrismaClient,
  reader: ViewFactsReader | undefined,
  input: GenerateInput,
): Promise<GenerateOutput> {
  // Bind production fact reads to the same MVCC snapshot as membership,
  // curriculum and grading. The injected reader remains a test-only seam.
  return prisma.$transaction(async (db) => generateSnapshot(
    db, reader ?? postgresViewFactsReader(db), input,
  ), { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, timeout: 30000 });
}

async function generateSnapshot(
  prisma: Prisma.TransactionClient,
  reader: ViewFactsReader,
  input: GenerateInput,
): Promise<GenerateOutput> {
  const nowMs = input.nowMs ?? Date.now();
  const cutoff = new Date(nowMs);

  const student = await prisma.user.findUnique({ where: { id: input.studentId } });
  if (!student || student.role !== 'STUDENT') throw new ApiError(404, 'NOT_FOUND', 'Student is not available.');

  if (!Array.isArray(input.courseIds) || input.courseIds.length === 0 || input.courseIds.length > MAX_GENERATE_COURSES) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Select between 1 and 50 courses.');
  }
  if (input.reportType !== 'WEEK' && input.reportType !== 'TWO_WEEKS' && input.reportType !== 'FOUR_WEEKS') {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid report type.');
  }
  if (input.language !== 'ar' && input.language !== 'en') {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid language.');
  }
  const uniqueCourseIds = [...new Set(input.courseIds)];

  // Every selected course must currently be eligible: canonical, PUBLISHED,
  // not deletion-pending, and entitlement allowed at cutoff.
  const rawMemberships = await prisma.subscription.findMany({
    where: {
      studentId: input.studentId,
      courseId: { in: uniqueCourseIds },
    },
    select: { courseId: true, startsAt: true, expiresAt: true },
  });
  const memberCourses = await prisma.course.findMany({
    where: { id: { in: uniqueCourseIds }, ...canonicalCourseWhere() },
    select: { id: true, status: true },
  });
  const courseStatus = new Map(memberCourses.map((c) => [c.id, c.status]));
  const eligible = new Set<string>();
  for (const m of rawMemberships) {
    const okWindow = m.expiresAt === null || m.expiresAt > cutoff;
    if (courseStatus.get(m.courseId) === 'PUBLISHED' && okWindow) eligible.add(m.courseId);
  }
  for (const id of uniqueCourseIds) {
    if (!eligible.has(id)) throw new ApiError(404, 'NOT_FOUND', 'Membership is not available.');
  }

  const days = REPORT_DAYS[input.reportType];
  const start = new Date(cutoff.getTime() - days * 86400000);
  const weeks = weekSections(start, cutoff);

  const tracking = await reader.trackingStartedAt();
  const sessions = await reader.sessionsInWindow(input.studentId, uniqueCourseIds, start, cutoff);
  const sessionsByLesson = new Map<string, typeof sessions>();
  for (const s of sessions) {
    const key = `${s.courseId}|${s.lessonId}`;
    const arr = sessionsByLesson.get(key) ?? [];
    arr.push(s);
    sessionsByLesson.set(key, arr);
  }

  const assessments = await prisma.assessment.findMany({
    where: { lesson: { section: { courseId: { in: uniqueCourseIds } } }, status: 'PUBLISHED' },
    include: { lesson: { select: { titleAr: true, titleEn: true, position: true, section: { select: { position: true, courseId: true } } } } },
    orderBy: [{ lesson: { section: { position: 'asc' } } }, { lesson: { position: 'asc' } }, { createdAt: 'asc' }],
  });
  const assessmentIds = assessments.map((a) => a.id);
  const [submissions, passes] = await Promise.all([
    prisma.assessmentSubmission.findMany({
      where: { studentId: input.studentId, assessmentId: { in: assessmentIds }, createdAt: { lt: cutoff } },
      select: { id: true, assessmentId: true, createdAt: true, state: true, result: true },
    }),
    prisma.assessmentPass.findMany({
      where: { studentId: input.studentId, assessmentId: { in: assessmentIds }, passedAt: { lt: cutoff } },
      select: { assessmentId: true, passedAt: true },
    }),
  ]);
  const subsByAssessment = new Map<string, SubmissionRow[]>();
  for (const s of submissions) {
    const arr = subsByAssessment.get(s.assessmentId) ?? [];
    arr.push(s);
    subsByAssessment.set(s.assessmentId, arr);
  }
  const passByAssessment = new Map(passes.map((p) => [p.assessmentId, p.passedAt]));

  const courses = [];
  for (const courseId of uniqueCourseIds) {
    const [course, windows, lessons] = await Promise.all([
      prisma.course.findUniqueOrThrow({ where: { id: courseId }, select: { titleAr: true, titleEn: true } }),
      prisma.subscription.findMany({ where: { studentId: input.studentId, courseId }, select: { startsAt: true, expiresAt: true } }),
      prisma.lesson.findMany({
        where: { section: { courseId } },
        orderBy: [{ section: { position: 'asc' } }, { position: 'asc' }],
        include: { media: true },
      }),
    ]);
    const notes: string[] = [];
    const earliestStart = windows.reduce<Date | null>((acc, w) => (!acc || w.startsAt < acc ? w.startsAt : acc), null);
    const anyIndefinite = windows.some((w) => w.expiresAt === null);
    const latestExpiry = windows.reduce<Date | null>(
      (acc, w) => (w.expiresAt !== null && (!acc || w.expiresAt > acc) ? w.expiresAt : acc),
      null,
    );
    const endedBeforeCutoff = !anyIndefinite && latestExpiry !== null && latestExpiry <= cutoff;
    if (earliestStart && start < earliestStart) {
      notes.push(
        input.language === 'ar'
          ? `يبدأ الاشتراك في ${cairoDate(earliestStart)}؛ الفترة السابقة له خارج التغطية ولا تُحتسب نشاطًا`
          : `Membership starts ${cairoDate(earliestStart)}; the earlier period is outside coverage and is not counted as activity`,
      );
    }
    if (endedBeforeCutoff && latestExpiry !== null) {
      notes.push(
        input.language === 'ar'
          ? `انتهى الاشتراك في ${cairoDate(latestExpiry)}؛ ما بعد الانتهاء خارج التغطية`
          : `Membership ended ${cairoDate(latestExpiry)}; the post-expiry period is outside coverage`,
      );
    }
    if (tracking === null) {
      notes.push(input.language === 'ar' ? 'لم تُفعَّل متابعة المشاهدات؛ حالة المشاهدة لهذه الفترة غير متاحة' : 'View tracking was never activated; viewing status for this period is unavailable');
    } else if (start < tracking) {
      notes.push(
        input.language === 'ar'
          ? `بدأت تغطية متابعة المشاهدات في ${cairoDate(tracking)}؛ ما قبلها غير معروف وليس صفرًا`
          : `View-tracking coverage begins ${cairoDate(tracking)}; earlier time is unknown, not zero`,
      );
    }
    const sections = weeks.map((w) => {
      const lessonsOut = lessons.map((lesson) => {
        let status: 'viewed' | 'notViewed' | 'trackingUnavailable';
        const lessonSessions = sessionsByLesson.get(`${courseId}|${lesson.id}`) ?? [];
        const viewed = lessonSessions.some((s) => s.countedAt >= w.start && s.countedAt < w.end
          && s.mediaAssetId === lesson.media?.id);
        const complete = tracking !== null && tracking <= w.start
          && fullyCovered(windows, w.start, w.end)
          && lesson.createdAt <= w.start && lesson.media !== null
          && lesson.media.status === 'READY' && lesson.media.retiredAt === null
          && lesson.media.createdAt <= w.start && lesson.media.updatedAt <= w.start
          && !lessonSessions.some((s) => s.mediaAssetId !== lesson.media?.id);
        status = viewed ? 'viewed' : complete ? 'notViewed' : 'trackingUnavailable';
        return { title: input.language === 'ar' ? lesson.titleAr : lesson.titleEn, status };
      });
      const courseAssessments = assessments.filter((a) => a.lesson.section.courseId === courseId);
      const assessmentsOut = courseAssessments.map((a, ordinal) => {
        const subs = subsByAssessment.get(a.id) ?? [];
        const attemptsInSection = subs.filter((s) => s.createdAt >= w.start && s.createdAt < w.end).length;
        const passedAt = passByAssessment.get(a.id);
        // A mutable submission state cannot reconstruct its historical state.
        // Weekly sections therefore report immutable attempts and pass events.
        const status = passedAt && passedAt >= w.start && passedAt < w.end ? 'passed' as const : 'noPassEvent' as const;
        return {
          label: assessmentLabel(a, ordinal, input.language),
          status,
          attemptsInSection,
        };
      });
      const coverageNote = sectionCoverageNote(input.language, w, tracking, windows);
      return { index: w.index, total: w.total, start: w.start, end: w.end, lessons: lessonsOut, assessments: assessmentsOut, coverageNote };
    });
    const summaryAssessments = assessments.filter((a) => a.lesson.section.courseId === courseId).map((a, ordinal) => {
      const subs = subsByAssessment.get(a.id) ?? [];
      const latest = latestAtCutoff(subs, cutoff);
      const status = passByAssessment.has(a.id) ? 'passed' as const
        : latest && ['PENDING', 'RUNNING'].includes(latest.state) ? 'checking' as const
        : latest && SERVICE_ERROR_CODES.has(submissionErrorCode(latest.result) ?? '') ? 'serviceError' as const
        : latest ? 'notYetPassed' as const : 'notSubmitted' as const;
      return { label: assessmentLabel(a, ordinal, input.language), status,
        attemptsInSection: subs.filter((s) => s.createdAt >= start && s.createdAt < cutoff).length };
    });
    const summaryLessons = lessons.map((lesson, lessonIndex) => {
      const states = sections.map((s) => s.lessons[lessonIndex]!.status);
      return { title: input.language === 'ar' ? lesson.titleAr : lesson.titleEn,
        status: states.includes('viewed') ? 'viewed' as const : states.every((s) => s === 'notViewed') ? 'notViewed' as const : 'trackingUnavailable' as const };
    });
    courses.push({ courseId, titleAr: course.titleAr, titleEn: course.titleEn, sections, notes,
      summary: { lessons: summaryLessons, assessments: summaryAssessments } });
  }

  const guardian = await prisma.studentProfile.findUnique({ where: { userId: input.studentId }, select: { parentPhone: true } });
  const phone = guardian?.parentPhone?.trim() || null;

  const model: ParentReportModel = {
    studentName: student.displayName,
    reportType: input.reportType,
    language: input.language,
    start,
    end: cutoff,
    courses,
  };
  const text = renderParentReport(model);
  return {
    studentId: input.studentId,
    courseIds: uniqueCourseIds,
    reportType: input.reportType,
    generatedAt: cutoff.toISOString(),
    period: { start: start.toISOString(), end: cutoff.toISOString(), timeZone: 'Africa/Cairo' },
    guardian: { phone },
    parts: input.format === 'SHORT'
      ? [{ index: 1, total: 1, text: renderShortParentReport(model) }]
      : toParts(text),
  };
}

function fullyCovered(windows: SubscriptionWindow[], start: Date, end: Date): boolean {
  let covered = start.getTime();
  for (const w of [...windows].sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())) {
    if (w.startsAt.getTime() > covered) break;
    covered = Math.max(covered, w.expiresAt?.getTime() ?? Infinity);
    if (covered >= end.getTime()) return true;
  }
  return false;
}

function assessmentLabel(a: { kind: string; content: unknown; lesson: { titleAr: string; titleEn: string } }, ordinal: number, lang: ReportLanguage): string {
  const content = a.content as { titleAr?: unknown; titleEn?: unknown };
  const title = lang === 'ar' ? content?.titleAr : content?.titleEn;
  const kind = a.kind === 'QUIZ' ? (lang === 'ar' ? 'اختبار' : 'Quiz') : lang === 'ar' ? 'واجب' : 'Assignment';
  return `${kind} ${ordinal + 1} — ${typeof title === 'string' ? title : ''} — ${lang === 'ar' ? a.lesson.titleAr : a.lesson.titleEn}`;
}

/** Per-section coverage label; never silently zero. */
function sectionCoverageNote(
  language: ReportLanguage,
  w: { start: Date; end: Date },
  tracking: Date | null,
  windows: SubscriptionWindow[],
): string | null {
  const inAnyMembership = windows.some((win) => overlaps(win, w.start, w.end));
  if (!inAnyMembership) {
    return language === 'ar'
      ? 'هذا الأسبوع خارج فترة الاشتراك؛ لا تُصنَّف نتائجه كعدم مشاهدة'
      : 'This week is outside the subscription period; its results are not labeled as not-viewed';
  }
  if (tracking === null) {
    return language === 'ar'
      ? 'المتابعة غير مفعّلة لهذه الفترة'
      : 'Tracking is not activated for this period';
  }
  if (w.end <= tracking) {
    return language === 'ar'
      ? 'هذا الأسبوع بالكامل قبل تفعيل المتابعة؛ المشاهدة فيه غير معروفة'
      : 'This week falls entirely before tracking began; viewing is unknown';
  }
  if (w.start < tracking) {
    return language === 'ar'
      ? `بدأت المتابعة في ${cairoDate(tracking)}؛ الجزء الأسبق من الأسبوع غير معروف`
      : `Tracking began ${cairoDate(tracking)}; the earlier part of the week is unknown`;
  }
  return null;
}
