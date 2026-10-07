/** M10 parent-report ADMIN API client.
 *
 * Calls the real agent-2 routes directly. There is deliberately NO fixture
 * fallback here: production must reach the implemented backend, and a silent
 * synthetic response would hide a contract defect.
 *
 * Every response is requested with `cache: 'no-store'` (the server is also
 * required to send no-store), so roster/report/contact bodies are never
 * retained in the browser HTTP cache. Request bodies and responses carry
 * report text and recipient numbers, so nothing is logged, stored or
 * persisted by this module.
 */
import { apiResponse, ApiError } from '../../auth';
import type {
  GeneratedReport,
  ReportContact,
  ReportCoursesPage,
  ReportLanguage,
  ReportType,
  RosterPage,
  StudentViewsPage,
} from './types';

export class ParentReportsApiError extends Error {
  status: number;
  code: string;
  details?: Record<string, unknown>;

  constructor(status: number, code: string, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'ParentReportsApiError';
    this.status = status;
    this.code = code;
    if (details !== undefined) this.details = details;
  }
}

function wrap(err: unknown): ParentReportsApiError {
  if (err instanceof ParentReportsApiError) return err;
  if (err instanceof ApiError) return new ParentReportsApiError(err.status, err.code, err.message, err.details);
  return new ParentReportsApiError(0, 'SERVICE_ERROR', 'Service unavailable.');
}

/** AbortSignal support so a superseded selection never applies its response. */
async function getJson<T>(path: string, signal?: AbortSignal): Promise<T> {
  try {
    const res = await apiResponse(path, {
      retryOnAuth: true,
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-store' },
      ...(signal ? { signal } : {}),
    });
    const body = (await res.json()) as T;
    return body;
  } catch (err) {
    throw wrap(err);
  }
}

async function postJson<T>(path: string, body: Record<string, unknown>, signal?: AbortSignal): Promise<T> {
  try {
    const res = await apiResponse(path, {
      method: 'POST',
      retryOnAuth: true,
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
      body: JSON.stringify(body),
      ...(signal ? { signal } : {}),
    });
    return (await res.json()) as T;
  } catch (err) {
    throw wrap(err);
  }
}

/** Keyset pagination. `cursor` is opaque and only ever echoed back. */
function pageQuery(limit: number, cursor: string | null | undefined): string {
  const params = new URLSearchParams();
  params.set('limit', String(limit));
  if (cursor) params.set('cursor', cursor);
  return params.toString();
}

export const parentReportsApi = {
  /** Enrolled students for one course, paginated server-side. */
  fetchCourseStudents(
    courseId: string,
    input: { limit?: number; cursor?: string | null; q?: string; signal?: AbortSignal } = {},
  ): Promise<{ data: RosterPage }> {
    const params = pageQuery(input.limit ?? 20, input.cursor);
    const search = input.q?.trim() ? `&q=${encodeURIComponent(input.q.trim())}` : '';
    return getJson<{ data: RosterPage }>(
      `/admin/courses/${encodeURIComponent(courseId)}/students?${params}${search}`,
      input.signal,
    );
  },

  /** ADMIN-only per-video counts for one student in this course. */
  fetchStudentViews(
    courseId: string,
    studentId: string,
    input: { limit?: number; cursor?: string | null; signal?: AbortSignal } = {},
  ): Promise<{ data: StudentViewsPage }> {
    const params = pageQuery(input.limit ?? 20, input.cursor);
    return getJson<{ data: StudentViewsPage }>(
      `/admin/courses/${encodeURIComponent(courseId)}/students/${encodeURIComponent(studentId)}/views?${params}`,
      input.signal,
    );
  },

  /** Current eligible memberships a combined report may cover. */
  fetchReportCourses(
    studentId: string,
    input: { limit?: number; cursor?: string | null; signal?: AbortSignal } = {},
  ): Promise<{ data: ReportCoursesPage }> {
    const params = pageQuery(input.limit ?? 20, input.cursor);
    return getJson<{ data: ReportCoursesPage }>(
      `/admin/students/${encodeURIComponent(studentId)}/report-courses?${params}`,
      input.signal,
    );
  },

  /** On-demand generation. One cutoff per request; nothing is persisted. */
  generateReport(
    input: { studentId: string; courseIds: string[]; reportType: ReportType; language: ReportLanguage; format?: 'SHORT' | 'DETAILED' },
    signal?: AbortSignal,
  ): Promise<{ data: GeneratedReport }> {
    return postJson<{ data: GeneratedReport }>(
      '/admin/parent-reports/generate',
      {
        studentId: input.studentId,
        courseIds: input.courseIds,
        reportType: input.reportType,
        language: input.language,
        ...(input.format ? { format: input.format } : {}),
      },
      signal,
    );
  },

  /** Recipient recheck immediately before a WhatsApp handoff. */
  fetchReportContact(studentId: string, signal?: AbortSignal): Promise<{ data: ReportContact }> {
    return getJson<{ data: ReportContact }>(
      `/admin/students/${encodeURIComponent(studentId)}/report-contact`,
      signal,
    );
  },
};
