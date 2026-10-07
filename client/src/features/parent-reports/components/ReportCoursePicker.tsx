/** Course selection for a combined or single-course parent report.
 *
 * The list is the student's CURRENT eligible canonical memberships from the
 * report-courses contract (including package grants), paged on the server
 * with the returned opaque cursor. Nothing here invents a membership or
 * extends an expired grant.
 */
import { useEffect, useState } from 'react';
import { useLang } from '../../../i18n';
import { Button } from '../../../components/ui/Button';
import { Loading, Notice } from '../../../components/ui/Notice';
import { parentReportsApi, ParentReportsApiError } from '../api';
import { copy, tr } from '../copy';
import type { ReportCourse } from '../types';

const PAGE_LIMIT = 20;

export interface CoursePickerProps {
  studentId: string;
  /** The course this workspace belongs to; preselected for course-only reports. */
  currentCourseId: string;
  selected: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
}

export function ReportCoursePicker({
  studentId,
  currentCourseId,
  selected,
  onChange,
  disabled = false,
}: CoursePickerProps): JSX.Element {
  const { lang } = useLang();
  const ar = lang === 'ar';
  const [courses, setCourses] = useState<ReportCourse[] | null>(null);
  const [cursors, setCursors] = useState<(string | null)[]>([null]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  const cursor = cursors[cursors.length - 1] ?? null;

  // A different student restarts paging from the first page.
  useEffect(() => {
    setCursors([null]);
    setNonce((value) => value + 1);
  }, [studentId]);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    setError(null);
    setCourses(null);
    setNextCursor(null);
    parentReportsApi
      .fetchReportCourses(studentId, { limit: PAGE_LIMIT, cursor, signal: controller.signal })
      .then(({ data }) => {
        if (!active) return;
        setCourses(data.courses);
        setNextCursor(data.nextCursor);
      })
      .catch((err: unknown) => {
        if (!active || controller.signal.aborted) return;
        setCourses(null);
        setNextCursor(null);
        setError(err instanceof ParentReportsApiError ? err.code : 'SERVICE_ERROR');
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [studentId, cursor, nonce]);

  const toggle = (courseId: string): void => {
    onChange(
      selected.includes(courseId)
        ? selected.filter((id) => id !== courseId)
        : selected.length < 50 ? [...selected, courseId] : selected,
    );
  };

  return (
    <fieldset
      data-testid="report-course-picker"
      disabled={disabled}
      className="rounded-control border border-border p-4"
    >
      <legend className="px-2 text-sm font-bold">{tr('reportCoursesLabel', lang)}</legend>
      <p className="text-sm text-muted">{tr('scopeHint', lang)}</p>

      {error ? (
        <div className="mt-3">
          <Notice kind="error">{tr('coursesFailed', lang)}</Notice>
          <p className="text-sm text-muted" dir="ltr" data-testid="report-courses-error-code">
            {error}
          </p>
          <Button variant="secondary" onClick={() => setNonce((value) => value + 1)}>
            {tr('retry', lang)}
          </Button>
        </div>
      ) : courses === null ? (
        <Loading text={tr('loading', lang)} />
      ) : courses.length === 0 ? (
        <p data-testid="report-courses-empty">
          {ar
            ? 'لا توجد اشتراكات حالية يمكن إعداد تقرير عنها.'
            : 'No current memberships are eligible for a report.'}
        </p>
      ) : (
        <>
          <ul className="mt-3 grid gap-2">
            {courses.map((course) => {
              const checked = selected.includes(course.courseId);
              return (
                <li key={course.courseId}>
                  <label className="flex min-h-[44px] items-center gap-3 text-sm">
                    <input
                      type="checkbox"
                      data-testid={`report-course-${course.courseId}`}
                      checked={checked}
                      disabled={!checked && selected.length >= 50}
                      onChange={() => toggle(course.courseId)}
                      className="h-5 w-5"
                    />
                    <span>{course.title[lang]}</span>
                    {course.courseId === currentCourseId ? (
                      <span className="text-xs text-muted">
                        {ar ? 'كورس الصفحة' : 'this course'}
                      </span>
                    ) : null}
                  </label>
                </li>
              );
            })}
          </ul>
          <nav
            aria-label={ar ? 'صفحات كورسات التقرير' : 'Report course pages'}
            className="mt-3 flex flex-wrap items-center gap-3"
          >
            <p className="text-sm text-muted">
              {tr('coursesPageLabel', lang)}{' '}
              {new Intl.NumberFormat(ar ? 'ar-EG' : 'en-GB').format(cursors.length)}
            </p>
            <Button
              type="button"
              variant="secondary"
              data-testid="report-courses-previous"
              disabled={cursors.length <= 1}
              disabledReason={tr('firstPage', lang)}
              onClick={() =>
                setCursors((current) => (current.length > 1 ? current.slice(0, -1) : current))
              }
            >
              {tr('previous', lang)}
            </Button>
            <Button
              type="button"
              variant="secondary"
              data-testid="report-courses-next"
              disabled={nextCursor === null}
              disabledReason={tr('lastPage', lang)}
              onClick={() => {
                if (nextCursor !== null) setCursors((current) => [...current, nextCursor]);
              }}
            >
              {tr('next', lang)}
            </Button>
          </nav>
        </>
      )}
      <p className="mt-2 text-xs text-muted">{tr('paginationNote', lang)}</p>
      {selected.length >= 50 ? <p className="mt-2 text-sm" role="status">{ar ? 'يمكن اختيار ٥٠ كورسًا لكل تقرير. أعد تقريرًا آخر للكورسات المتبقية.' : 'Choose up to 50 courses per report. Generate another report for the remaining courses.'}</p> : null}
      <p className="mt-2 text-xs text-muted">
        {tr('scopeCourseOnly', lang)} · {tr('scopeCombined', lang)}
      </p>
      <p className="mt-2 text-xs text-muted">{copy.adminOnly[lang]}</p>
    </fieldset>
  );
}
