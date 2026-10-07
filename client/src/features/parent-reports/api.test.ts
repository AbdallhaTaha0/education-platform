import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { parentReportsApi, ParentReportsApiError } from './api';

const envelope = (data: unknown) =>
  new Response(JSON.stringify({ data }), { headers: { 'Content-Type': 'application/json' } });

beforeEach(() => vi.stubGlobal('document', { cookie: 'edu_csrf=before' }));
afterEach(() => vi.unstubAllGlobals());

interface Call {
  url: string;
  method: string;
  cache: string | undefined;
  signal: AbortSignal | null | undefined;
  headers: Record<string, string>;
  body: string | undefined;
}

function recorder(
  handler: (call: Call) => Response | Promise<Response>,
  signal?: AbortSignal,
): { calls: Call[] } {
  const calls: Call[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit) => {
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
      const headers: Record<string, string> = {};
      new Headers(init.headers).forEach((value, key) => {
        headers[key.toLowerCase()] = value;
      });
      const call: Call = {
        url,
        method: (init.method ?? 'GET').toUpperCase(),
        cache: init.cache,
        signal: init.signal,
        headers,
        body: typeof init.body === 'string' ? init.body : undefined,
      };
      calls.push(call);
      if (init.signal?.aborted) throw new DOMException('Aborted', 'AbortError');
      const result = await handler(call);
      if (init.signal?.aborted) throw new DOMException('Aborted', 'AbortError');
      return result;
    }),
  );
  return { calls };
}

describe('ADMIN report routes', () => {
  it('requests the roster with server-side paging, bounded search and no-store', async () => {
    const { calls } = recorder(() =>
      envelope({ students: [{ studentId: 's1', name: 'طالب', guardianContactAvailable: true, lastViewedAt: null, totalViews: 0 }], nextCursor: 'c2' }),
    );
    const page = await parentReportsApi.fetchCourseStudents('course 1', { limit: 20, cursor: 'c1', q: '  Ahmed  ' });
    expect(page.data.nextCursor).toBe('c2');
    const call = calls[0]!;
    expect(call.url).toBe('/api/admin/courses/course%201/students?limit=20&cursor=c1&q=Ahmed');
    expect(call.cache).toBe('no-store');
    expect(call.headers['cache-control']).toBe('no-store');
    // No plaintext guardian number is ever requested in the roster body.
    expect(call.body).toBeUndefined();
  });

  it('requests per-video counts for the selected student only', async () => {
    const { calls } = recorder(() =>
      envelope({
        studentId: 's1',
        courseId: 'course-1',
        trackingStartedAt: null,
        lessons: [{ lessonId: 'l1', title: { ar: 'درس', en: 'Lesson' }, mediaAssetId: 'm1', totalViews: 2, lastViewedAt: null, coverage: 'PARTIAL' }],
        nextCursor: null,
      }),
    );
    const views = await parentReportsApi.fetchStudentViews('course-1', 's1');
    expect(views.data.lessons[0]?.coverage).toBe('PARTIAL');
    expect(calls[0]!.url).toBe('/api/admin/courses/course-1/students/s1/views?limit=20');
  });

  it('posts the exact generation contract with the CSRF header', async () => {
    const { calls } = recorder(() =>
      envelope({
        studentId: 's1',
        courseIds: ['course-1'],
        reportType: 'FOUR_WEEKS',
        generatedAt: '2026-10-07T09:00:00.000Z',
        period: { start: 'a', end: 'b', timeZone: 'Africa/Cairo' },
        guardian: { phone: '+201001234567' },
        parts: [{ index: 1, total: 4, text: 'x' }],
      }),
    );
    await parentReportsApi.generateReport({
      studentId: 's1',
      courseIds: ['course-1', 'course-2'],
      reportType: 'FOUR_WEEKS',
      language: 'ar',
    });
    const call = calls[0]!;
    expect(call.method).toBe('POST');
    expect(call.url).toBe('/api/admin/parent-reports/generate');
    expect(call.cache).toBe('no-store');
    expect(call.headers['x-csrf-token']).toBe('before');
    expect(JSON.parse(call.body!)).toEqual({
      studentId: 's1',
      courseIds: ['course-1', 'course-2'],
      reportType: 'FOUR_WEEKS',
      language: 'ar',
    });
  });

  it('reads the contact recheck route with no-store', async () => {
    const { calls } = recorder(() => envelope({ phone: null }));
    const contact = await parentReportsApi.fetchReportContact('s1');
    expect(contact.data.phone).toBeNull();
    expect(calls[0]!.url).toBe('/api/admin/students/s1/report-contact');
    expect(calls[0]!.cache).toBe('no-store');
  });

  it('surfaces the server error code instead of inventing a fallback body', async () => {
    recorder(() => new Response(JSON.stringify({ error: { code: 'CONTACT_MISSING', message: 'No contact' } }), { status: 400 }));
    await expect(parentReportsApi.generateReport({
      studentId: 's1',
      courseIds: [],
      reportType: 'WEEK',
      language: 'ar',
    })).rejects.toMatchObject({ code: 'CONTACT_MISSING', status: 400 });
  });

  it('passes the caller abort signal so a stale selection cannot apply', async () => {
    const controller = new AbortController();
    const { calls } = recorder(
      async () => {
        await new Promise(resolve => setTimeout(resolve, 5));
        return envelope({ phone: null });
      },
      controller.signal,
    );
    const pending = parentReportsApi.fetchReportContact('s1', controller.signal);
    controller.abort();
    await expect(pending).rejects.toMatchObject({ name: 'ParentReportsApiError' });
    // The aborted request really carried the caller's signal.
    expect(calls[0]?.signal).toBe(controller.signal);
  });

  it('wraps a network failure as a typed report error', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('network down'); }));
    await expect(parentReportsApi.fetchReportContact('s1')).rejects.toBeInstanceOf(ParentReportsApiError);
  });
});