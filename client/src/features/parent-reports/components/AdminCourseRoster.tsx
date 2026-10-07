/** ADMIN course roster: enrolled students, contact availability, activity.
 *
 * Server-side keyset paging only. The registered population is never fetched
 * into the browser, and detailed counts stay inside this ADMIN surface.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLang } from '../../../i18n';
import { Button } from '../../../components/ui/Button';
import { Loading, Notice } from '../../../components/ui/Notice';
import { textInputClassName } from '../../../components/ui/Field';
import { parentReportsApi, ParentReportsApiError } from '../api';
import { tr } from '../copy';
import { formatCount } from '../format';
import type { RosterStudent } from '../types';

const PAGE_LIMIT = 20;
const SEARCH_DEBOUNCE_MS = 300;

export interface RosterSelection {
  studentId: string;
  name: string;
  guardianContactAvailable: boolean;
}

export function AdminCourseRoster({
  courseId,
  selectedStudentId,
  onSelect,
  openedReports,
}: {
  courseId: string;
  selectedStudentId: string | null;
  onSelect: (student: RosterSelection) => void;
  openedReports?: ReadonlySet<string>;
}): JSX.Element {
  const { lang } = useLang();
  const ar = lang === 'ar';
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const appliedQuery = useRef('');
  const [cursors, setCursors] = useState<(string | null)[]>([null]);
  const [rows, setRows] = useState<RosterStudent[] | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  const cursorIndex = cursors.length - 1;
  const cursor = cursors[cursorIndex] ?? null;

  useEffect(() => {
    const timer = setTimeout(() => {
      const nextQuery = search.trim();
      if (nextQuery === appliedQuery.current) return;
      appliedQuery.current = nextQuery;
      setQuery(nextQuery);
      setCursors([null]);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    setError(null);
    setRows(null);
    setNextCursor(null);
    parentReportsApi
      .fetchCourseStudents(courseId, { limit: PAGE_LIMIT, cursor, q: query, signal: controller.signal })
      .then(({ data }) => {
        if (!active) return;
        setRows(data.students);
        setNextCursor(data.nextCursor);
      })
      .catch((err: unknown) => {
        if (!active || controller.signal.aborted) return;
        if (err instanceof ParentReportsApiError && err.name === 'AbortError') return;
        // Drop anything previously loaded so a failed page cannot be mistaken
        // for current roster data.
        setRows(null);
        setNextCursor(null);
        setError(err instanceof ParentReportsApiError ? err.code : 'SERVICE_ERROR');
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [courseId, cursor, query, nonce]);

  const showEmpty = useMemo(
    () => rows !== null && rows.length === 0,
    [rows],
  );

  const goPrevious = useCallback(() => {
    setCursors(current => (current.length > 1 ? current.slice(0, -1) : current));
  }, []);
  const goNext = useCallback(() => {
    if (!nextCursor) return;
    setCursors(current => [...current, nextCursor]);
  }, [nextCursor]);

  return (
    <section aria-labelledby={`roster-heading-${courseId}`} data-testid="admin-course-roster" className="rounded-card border border-border bg-surface p-4">
      <h3 id={`roster-heading-${courseId}`} className="text-lg font-bold">{tr('panelTitle', lang)}</h3>

      <div className="mt-4">
        <label className="block text-sm font-semibold" htmlFor={`roster-search-${courseId}`}>{tr('search', lang)}</label>
        <input
          id={`roster-search-${courseId}`}
          data-testid="roster-search"
          type="search"
          dir="auto"
          maxLength={100}
          value={search}
          onChange={event => setSearch(event.target.value)}
          className={`${textInputClassName(false)} mt-2`}
        />
      </div>

      {error ? (
        <div className="mt-4">
          <Notice kind="error">{tr('rosterFailed', lang)}</Notice>
          <p className="text-sm text-muted" dir="ltr" data-testid="roster-error-code">{error}</p>
          <div className="mt-2">
            <Button variant="secondary" onClick={() => setNonce(value => value + 1)}>{tr('retry', lang)}</Button>
          </div>
        </div>
      ) : rows === null && error === null ? (
        <Loading text={tr('loading', lang)} />
      ) : showEmpty ? (
        <p className="mt-4" data-testid="roster-empty">
          {query ? tr('emptySearch', lang) : tr('emptyRoster', lang)}
        </p>
      ) : (
        <ul className="mt-3 max-h-80 divide-y divide-border overflow-y-auto rounded-control border border-border" data-testid="roster-list">
          {(rows ?? []).map(row => {
            const active = selectedStudentId === row.studentId;
            return (
              <li key={row.studentId}>
                <button type="button" aria-pressed={active}
                  data-testid={`select-student-${row.studentId}`}
                  onClick={() => onSelect({ studentId: row.studentId, name: row.name, guardianContactAvailable: row.guardianContactAvailable })}
                  className={`flex min-h-[64px] w-full items-center justify-between gap-3 px-3 py-2 text-start transition-colors hover:bg-interactive focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary focus-visible:-outline-offset-2 ${active ? 'bg-selected border-s-4 border-primary' : 'border-s-4 border-transparent'}`}>
                  <span className="min-w-0">
                    <span className="block break-words text-sm font-semibold">{row.name}</span>
                    {openedReports?.has(`${courseId}:${row.studentId}`) ? (
                      <span data-testid={`report-opened-${row.studentId}`} className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-success-fg">
                        <span aria-hidden="true">✓</span>{ar ? 'تم فتح التقرير' : 'Report opened'}
                      </span>
                    ) : null}
                    <span data-testid={`guardian-${row.studentId}`} className={`mt-1 block text-xs ${row.guardianContactAvailable ? 'text-muted' : 'text-error-fg'}`}>
                      {row.guardianContactAvailable ? (ar ? 'رقم ولي الأمر مسجل' : 'Guardian contact available') : (ar ? 'رقم ولي الأمر غير مسجل' : 'No guardian contact')}
                    </span>
                  </span>
                  <span className="shrink-0 text-end text-xs text-muted">
                    <span data-testid={`total-views-${row.studentId}`} className="block">
                      {row.totalViews === null ? tr('unknownCount', lang) : row.totalViews === 0 ? (ar ? 'بلا نشاط' : 'No activity') : formatCount(row.totalViews, lang) + (ar ? ' مشاهدة' : ' views')}
                    </span>
                    <span className="mt-1 block font-semibold text-ink">{active ? (ar ? 'محدد' : 'Selected') : (ar ? 'اختيار' : 'Select')}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {rows !== null && rows.length > 0 && (cursors.length > 1 || nextCursor !== null) ? (
        <nav aria-label={ar ? 'صفحات قائمة الطلاب' : 'Student roster pages'} className="mt-4 flex flex-wrap items-center gap-3" data-testid="roster-pagination">
          <p className="text-sm text-muted">
            {tr('rosterPageLabel', lang)} {new Intl.NumberFormat(ar ? 'ar-EG' : 'en-GB').format(cursors.length)}
          </p>
          <button type="button" className="min-h-[44px] rounded-control border border-border px-4 text-sm font-semibold disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary" data-testid="roster-previous" disabled={cursors.length <= 1} onClick={goPrevious}>
            {tr('previous', lang)}
          </button>
          <button type="button" className="min-h-[44px] rounded-control border border-border px-4 text-sm font-semibold disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary" data-testid="roster-next" disabled={nextCursor === null} onClick={goNext}>
            {tr('next', lang)}
          </button>
        </nav>
      ) : null}
    </section>
  );
}
