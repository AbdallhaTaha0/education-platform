/**
 * Parent-report text building. Pure functions over a frozen aggregation so the
 * SAME canonical weekly-section contract serves ar/en and every report type.
 * No persisted model, archive, or sending log is created anywhere in this
 * module: text is built transiently per request and dropped by the caller.
 *
 * Period semantics (documented for the coordinator):
 *  - One server-authoritative cutoff `end`; interval is [end - days, end),
 *    half-open: start inclusive, end exclusive.
 *  - Weekly sections are exact 7*24h absolute intervals, consecutive, ending
 *    at the cutoff. Section labels print exact YYYY-MM-DD dates in
 *    Africa/Cairo; Egypt DST shifts only the wall-clock label of section
 *    boundaries, never the 168h interval length. (October 2026 DST ends
 *    2026-10-29.)
 *  - Time before M10 tracking activation or before membership is clipped and
 *    labeled; zero activity is never fabricated for unknown coverage.
 */

export type ReportLanguage = 'ar' | 'en';
export type ReportType = 'WEEK' | 'TWO_WEEKS' | 'FOUR_WEEKS';

export const REPORT_DAYS: Record<ReportType, number> = {
  WEEK: 7,
  TWO_WEEKS: 14,
  FOUR_WEEKS: 28,
};

export interface WeekSection {
  index: number;
  total: number;
  start: Date;
  end: Date;
}

/** Consecutive seven-day sections covering [start, end), oldest first. */
export function weekSections(start: Date, end: Date): WeekSection[] {
  const total = Math.round((end.getTime() - start.getTime()) / (7 * 24 * 60 * 60 * 1000));
  const out: WeekSection[] = [];
  for (let i = 0; i < total; i += 1) {
    out.push({
      index: i + 1,
      total,
      start: new Date(start.getTime() + i * 7 * 24 * 60 * 60 * 1000),
      end: new Date(start.getTime() + (i + 1) * 7 * 24 * 60 * 60 * 1000),
    });
  }
  return out;
}

const CAIRO_DATE = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Africa/Cairo',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** Exact Cairo calendar date, YYYY-MM-DD. */
export function cairoDate(d: Date): string {
  const parts = CAIRO_DATE.formatToParts(d);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

export interface LessonViewStatus {
  title: string;
  status: 'viewed' | 'notViewed' | 'trackingUnavailable';
}

export interface AssessmentStatus {
  label: string;
  status: 'passed' | 'notYetPassed' | 'notSubmitted' | 'checking' | 'serviceError' | 'noPassEvent';
  attemptsInSection: number;
}

export interface SectionReport {
  index: number;
  total: number;
  start: Date;
  end: Date;
  /** One entry per lesson of the course, in canonical order (zero activity included). */
  lessons: LessonViewStatus[];
  assessments: AssessmentStatus[];
  /** Per-section coverage labels, never silently empty. */
  coverageNote: string | null;
}

export interface CourseReport {
  courseId: string;
  titleAr: string;
  titleEn: string;
  sections: SectionReport[];
  /** Human-readable notes about clipped memberships/coverage for the whole course. */
  notes: string[];
  summary?: { lessons: LessonViewStatus[]; assessments: AssessmentStatus[] };
}

export interface ParentReportModel {
  studentName: string;
  reportType: ReportType;
  language: ReportLanguage;
  start: Date;
  end: Date;
  courses: CourseReport[];
}

const STATUS_AR: Record<LessonViewStatus['status'], string> = {
  viewed: 'تمت المشاهدة',
  notViewed: 'لم تتم المشاهدة',
  trackingUnavailable: 'بيانات المتابعة غير متاحة',
};

const STATUS_EN: Record<LessonViewStatus['status'], string> = {
  viewed: 'viewed',
  notViewed: 'not viewed',
  trackingUnavailable: 'tracking unavailable',
};

const ASSESSMENT_STATUS_AR: Record<AssessmentStatus['status'], string> = {
  passed: 'اجتياز',
  notYetPassed: 'لم يجتز بعد',
  notSubmitted: 'لم يُسلَّم بعد',
  checking: 'جارٍ التصحيح',
  serviceError: 'خطأ في الخدمة — لا تُسجَّل كإجابة خاطئة',
  noPassEvent: 'لا يوجد اجتياز مسجل في هذا الأسبوع',
};

const ASSESSMENT_STATUS_EN: Record<AssessmentStatus['status'], string> = {
  passed: 'passed',
  notYetPassed: 'not yet passed',
  notSubmitted: 'not submitted',
  checking: 'checking',
  serviceError: 'service error — not scored as an answer',
  noPassEvent: 'no pass recorded this week',
};

const TYPE_LABEL_AR: Record<ReportType, string> = {
  WEEK: 'آخر 7 أيام',
  TWO_WEEKS: 'آخر 14 يومًا',
  FOUR_WEEKS: 'آخر 28 يومًا',
};

const TYPE_LABEL_EN: Record<ReportType, string> = {
  WEEK: 'Last 7 days',
  TWO_WEEKS: 'Last 14 days',
  FOUR_WEEKS: 'Last 28 days',
};

function courseTitle(c: CourseReport, lang: ReportLanguage): string {
  return lang === 'ar' ? c.titleAr : c.titleEn;
}

export function renderParentReport(model: ParentReportModel): string {
  const ar = model.language === 'ar';
  const lines: string[] = [];
  lines.push(ar ? '*FAYQ | تقرير ولي الأمر*' : '*FAYQ | Parent Report*');
  lines.push(ar ? `الطالب: ${model.studentName}` : `Student: ${model.studentName}`);
  lines.push(
    ar
      ? `الفترة: ${TYPE_LABEL_AR[model.reportType]} (من ${cairoDate(model.start)} إلى ${cairoDate(model.end)}، بتوقيت القاهرة)`
      : `Period: ${TYPE_LABEL_EN[model.reportType]} (${cairoDate(model.start)} to ${cairoDate(model.end)}, Africa/Cairo)`,
  );
  lines.push('');
  for (const course of model.courses) {
    lines.push(ar ? `■ ${courseTitle(course, 'ar')}` : `■ ${courseTitle(course, 'en')}`);
    for (const note of course.notes) lines.push(ar ? `— ${note}` : `— ${note}`);
    if (course.summary) {
      lines.push(ar ? '*ملخص الفترة — حالة التقييمات الحالية عند إنشاء التقرير*' : '*Period summary — current assessment status at generation*');
      for (const lesson of course.summary.lessons) lines.push(`  • ${lesson.title}: ${ar ? STATUS_AR[lesson.status] : STATUS_EN[lesson.status]}`);
      for (const a of course.summary.assessments) lines.push(`  • ${a.label}: ${ar ? ASSESSMENT_STATUS_AR[a.status] : ASSESSMENT_STATUS_EN[a.status]} — ${ar ? 'محاولات الفترة' : 'attempts in period'}: ${a.attemptsInSection}`);
      lines.push('');
    }
    for (const section of course.sections) {
      lines.push(
        ar
          ? `الأسبوع ${section.index}/${section.total} (${cairoDate(section.start)} إلى ${cairoDate(section.end)})`
          : `Week ${section.index}/${section.total} (${cairoDate(section.start)} to ${cairoDate(section.end)})`,
      );
      if (section.coverageNote) lines.push(ar ? `تنبيه: ${section.coverageNote}` : `Note: ${section.coverageNote}`);
      for (const lesson of section.lessons) {
        lines.push(`  • ${lesson.title}: ${ar ? STATUS_AR[lesson.status] : STATUS_EN[lesson.status]}`);
      }
      for (const a of section.assessments) {
        const attempts = a.attemptsInSection > 0 ? (ar ? ` — محاولات هذا الأسبوع: ${a.attemptsInSection}` : ` — attempts this week: ${a.attemptsInSection}`) : '';
        lines.push(`  • ${a.label}: ${ar ? ASSESSMENT_STATUS_AR[a.status] : ASSESSMENT_STATUS_EN[a.status]}${attempts}`);
      }
      lines.push('');
    }
  }
  lines.push(
    ar
      ? 'تمت المشاهدة تعني أن الفيديو شُغِّل، ولا تعني إتمام المشاهدة.'
      : '“viewed” means the video played; it does not mean it was completed.',
  );
  return lines.join('\n').trim();
}

/** One parent-friendly message; counts describe lessons/results, never replay views. */
export function renderShortParentReport(model: ParentReportModel): string {
  const ar = model.language === 'ar';
  const videos = (lessons: LessonViewStatus[]) => {
    const viewed = lessons.filter(l => l.status === 'viewed').length;
    const unviewed = lessons.filter(l => l.status === 'notViewed').length;
    const unknown = lessons.filter(l => l.status === 'trackingUnavailable').length;
    return [ar ? `شاهد ${viewed} من ${lessons.length} فيديو` : `${viewed}/${lessons.length} videos viewed`,
      unviewed ? (ar ? `${unviewed} لم يشاهد` : `${unviewed} not viewed`) : '',
      unknown ? (ar ? `المشاهدة غير مؤكدة: ${unknown}` : `Viewing unconfirmed: ${unknown}`) : ''].filter(Boolean).join(' · ');
  };
  const results = (items: AssessmentStatus[], title: string) => {
    if (!items.length) return '';
    const count = (status: AssessmentStatus['status']) => items.filter(a => a.status === status).length;
    const labels: Array<[AssessmentStatus['status'], string]> = [
      ['notYetPassed', ar ? 'لم يجتز' : 'not passed'], ['notSubmitted', ar ? 'لم يُسلّم' : 'not submitted'],
      ['checking', ar ? 'جارٍ التصحيح' : 'checking'], ['serviceError', ar ? 'تعذّر التصحيح' : 'checking unavailable'],
    ];
    return `${title}: ` + [ar ? `اجتاز ${count('passed')} من ${items.length}` : `${count('passed')}/${items.length} passed`,
      ...labels.filter(([status]) => count(status) > 0).map(([status, label]) => ar ? `  ${label}: ${count(status)}` : `${count(status)} ${label}`)].join(ar ? '\n' : ' · ');
  };
  const readableDate = (date: Date) => new Intl.DateTimeFormat('ar-EG', { timeZone: 'Africa/Cairo', day: 'numeric', month: 'short', year: 'numeric' }).format(date);
  const lines = [ar ? '*تقرير ولي الأمر | FAYQ*' : '*FAYQ | Parent Report*',
    ar ? `الطالب: ${model.studentName}` : `Student: ${model.studentName}`,
    `${ar ? TYPE_LABEL_AR[model.reportType] : TYPE_LABEL_EN[model.reportType]}`,
    ar ? `من ${readableDate(model.start)} إلى ${readableDate(model.end)}` : `${cairoDate(model.start)} to ${cairoDate(model.end)}`];
  for (const course of model.courses) {
    const summary = course.summary;
    lines.push('', `*${courseTitle(course, model.language)}*`);
    if (summary) {
      lines.push(videos(summary.lessons));
      for (const [kind, title] of [['QUIZ', ar ? 'الاختبارات' : 'Quizzes'], ['ASSIGNMENT', ar ? 'الواجبات' : 'Assignments']] as const) {
        const items = summary.assessments.filter(a => kind === 'QUIZ' ? /^(Quiz |اختبار )/.test(a.label) : !/^(Quiz |اختبار )/.test(a.label));
        const line = results(items, title); if (line) lines.push(line);
      }
    }
    for (const section of course.sections) {
      const passes = section.assessments.filter(a => a.status === 'passed').length;
      if (course.sections.length === 1) {
        lines.push(ar ? `اجتيازات هذا الأسبوع: ${passes}` : `This week: ${passes} passes`);
      } else lines.push(ar ? `الأسبوع ${section.index}: ${videos(section.lessons)} · اجتياز ${passes}`
        : `Week ${section.index}: ${videos(section.lessons)}; ${passes} passes`);
    }
  }
  // Arabic-first headings/lines and words instead of slash fractions avoid
  // mixed-direction collisions in WhatsApp. Numeric dates remain in API data.
  const text = lines.join('\n');
  return wellFormed(ar ? text.replace(/\d/g, digit => '٠١٢٣٤٥٦٧٨٩'[Number(digit)]!).split('\n').map(line => line ? `\u200f${line}` : line).join('\n') : text);
}

export const MAX_PART_CHARS = 1000;
// Leaves room for wa.me prefix, a 15-digit recipient and the text query.
export const MAX_PART_ENCODED_CHARS = 3800;

/** Bounded numbered parts for click-to-chat handoff; never truncate silently. */
export function splitParts(text: string, maxChars = MAX_PART_CHARS): Array<{ text: string }> {
  text = wellFormed(text);
  const parts: string[] = [];
  let current = '';
  for (const point of text) {
    if ((current + point).length > maxChars || encodeURIComponent(current + point).length > MAX_PART_ENCODED_CHARS) {
      if (!current) throw new Error('Part budget is too small.');
      parts.push(current);
      current = '';
    }
    current += point;
  }
  if (current) parts.push(current);
  return parts.map((t) => ({ text: t }));
}

/** Attach the part index/total protocol onto split text (pure; no state kept). */
export function toParts(text: string, maxChars = MAX_PART_CHARS): Array<{ index: number; total: number; text: string }> {
  text = wellFormed(text);
  // Small repeated context keeps every handoff recognizable; the complete
  // original headings remain in the payload, including exceptionally long ones.
  const lines = text.split('\n');
  const short = (s: string) => [...s].slice(0, 45).join('');
  const heading = short(lines[0] ?? 'FAYQ');
  const student = short(lines[1] ?? '');
  let course = '';
  let week = '';
  let payload = '';
  const raw: Array<{ text: string; context: string }> = [];
  const context = () => [heading, student, short(course), short(week)].filter(Boolean).join('\n') + '\n\n';
  // The original payload already starts with the title/student. Repeat context
  // only on subsequent detailed parts, never above the first heading.
  let prefix = '';
  const fits = (value: string) => value.length <= maxChars - 32 && encodeURIComponent(value).length <= MAX_PART_ENCODED_CHARS - 96;
  for (const line of lines) {
    if (line.startsWith('■ ')) { course = line; week = ''; }
    if (/^(Week |الأسبوع )/.test(line)) week = line;
    if (payload && fits(context() + line + '\n') && !fits(prefix + payload + line + '\n')) {
      raw.push({ text: payload, context: prefix });
      payload = '';
      prefix = context();
    }
    for (const point of `${line}\n`) {
      if (!fits(prefix + payload + point) && payload) {
        raw.push({ text: payload, context: prefix });
        payload = '';
        prefix = context();
      }
      if (!fits(prefix + point)) throw new Error('Part budget is too small.');
      payload += point;
    }
  }
  if (payload) raw.push({ text: payload, context: prefix });
  return raw.map((p, i) => ({
    index: i + 1,
    total: raw.length,
    text: `${p.context}${p.text}\n${REPORT_PART_LABEL(i + 1, raw.length)}`,
  }));
}

function REPORT_PART_LABEL(index: number, total: number): string {
  return `— ${index}/${total} —`;
}

/** PostgreSQL normally supplies valid Unicode. Replace invalid isolated UTF-16
 * surrogates with the standard replacement character so encoding stays safe. */
function wellFormed(text: string): string {
  return text.replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, '\uFFFD');
}
