/** M10 parent-report DTOs consumed from the ADMIN API (agent 2 contract).
 *
 * Frozen shape from reports-and-markdown-files/milestones/m10/
 * m10-parallel-contract.md. Every field is read-only presentation data:
 * the platform never stores a generated report, and the browser holds the
 * text only in component state until the owner-approved disposal boundary.
 */

export type ReportType = 'WEEK' | 'TWO_WEEKS' | 'FOUR_WEEKS';

export type ReportLanguage = 'ar' | 'en';

/** Admin-only view-count coverage. Parent text never carries counts. */
export type Coverage = 'KNOWN' | 'PARTIAL' | 'UNAVAILABLE';

export interface RosterStudent {
  studentId: string;
  name: string;
  /** True when a guardian number is registered. The number itself is absent. */
  guardianContactAvailable: boolean;
  lastViewedAt: string | null;
  /** ADMIN tracking detail; never part of the parent message. */
  totalViews: number | null;
}

export interface RosterPage {
  students: RosterStudent[];
  nextCursor: string | null;
}

export interface LessonViews {
  lessonId: string;
  title: { ar: string; en: string };
  mediaAssetId: string | null;
  totalViews: number | null;
  lastViewedAt: string | null;
  coverage: Coverage;
  currentMediaViews?: number | null;
  currentMediaLastViewedAt?: string | null;
  mediaVersions?: { mediaAssetId: string; totalViews: number; lastViewedAt: string | null }[];
}

export interface StudentViewsPage {
  studentId: string;
  courseId: string;
  /** When M10 tracking started; earlier activity is not recorded, not zero. */
  trackingStartedAt: string | null;
  lessons: LessonViews[];
  nextCursor: string | null;
}

export interface ReportCourse {
  courseId: string;
  title: { ar: string; en: string };
}

export interface ReportCoursesPage {
  courses: ReportCourse[];
  nextCursor: string | null;
}

export interface ReportPeriod {
  /** ISO, inclusive. */
  start: string;
  /** ISO, exclusive. */
  end: string;
  timeZone: string;
}

export interface GeneratedReportPart {
  index: number;
  total: number;
  text: string;
}

export interface GeneratedReport {
  studentId: string;
  courseIds: string[];
  reportType: ReportType;
  generatedAt: string;
  period: ReportPeriod;
  guardian: { phone: string | null };
  parts: GeneratedReportPart[];
}

export interface ReportContact {
  phone: string | null;
}

export const REPORT_TYPES: readonly ReportType[] = ['WEEK', 'TWO_WEEKS', 'FOUR_WEEKS'];

/** Weekly sections implied by each report type (M10-04 canonical composition). */
export const REPORT_WEEKS: Record<ReportType, number> = {
  WEEK: 1,
  TWO_WEEKS: 2,
  FOUR_WEEKS: 4,
};

export function reportTypeWeeks(type: ReportType): number {
  return REPORT_WEEKS[type];
}

export function isReportType(value: unknown): value is ReportType {
  return typeof value === 'string' && (REPORT_TYPES as readonly string[]).includes(value);
}
