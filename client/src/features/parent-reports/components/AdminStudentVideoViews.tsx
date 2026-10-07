/** ADMIN-only per-video view counts for the selected student.
 *
 * Counts are tracking detail for the course workspace; they are never part of
 * the parent message text. Paging stays on the server.
 */
import { useEffect, useState } from 'react';
import { useLang } from '../../../i18n';
import { Button } from '../../../components/ui/Button';
import { Loading, Notice } from '../../../components/ui/Notice';
import { parentReportsApi, ParentReportsApiError } from '../api';
import { copy, tr } from '../copy';
import { coverageCopy, formatCount, formatDateTime, lessonTitle } from '../format';
import type { StudentViewsPage } from '../types';

const PAGE_LIMIT = 20;

export function AdminStudentVideoViews({
  courseId,
  studentId,
}: {
  courseId: string;
  studentId: string;
}): JSX.Element {
  const { lang } = useLang();
  const ar = lang === 'ar';
  const [data, setData] = useState<StudentViewsPage | null>(null);
  const [cursors, setCursors] = useState<(string | null)[]>([null]);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  const cursor = cursors[cursors.length - 1] ?? null;

  // A different student/course restarts paging from the first page.
  useEffect(() => {
    setCursors([null]);
    setNonce((value) => value + 1);
  }, [courseId, studentId]);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    setError(null);
    setData(null);
    parentReportsApi
      .fetchStudentViews(courseId, studentId, {
        limit: PAGE_LIMIT,
        cursor,
        signal: controller.signal,
      })
      .then(({ data: page }) => {
        if (!active) return;
        setData(page);
      })
      .catch((err: unknown) => {
        if (!active || controller.signal.aborted) return;
        // Never keep a previous page visible as if it were current.
        setData(null);
        setError(err instanceof ParentReportsApiError ? err.code : 'SERVICE_ERROR');
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [courseId, studentId, cursor, nonce]);

  return (
    <section
      aria-labelledby={`views-heading-${studentId}`}
      data-testid="admin-student-views"
      className="rounded-card border border-border bg-surface p-4"
    >
      <h3 id={`views-heading-${studentId}`} className="text-lg font-bold">
        {tr('perVideoTitle', lang)}
      </h3>
      <p className="mt-1 text-sm text-muted">{tr('perVideoIntro', lang)}</p>
      {data === null ? null : (
        <p className="mt-1 text-sm text-muted" data-testid="views-tracking-start">
          {data.trackingStartedAt
            ? `${tr('trackingStarted', lang)} ${formatDateTime(data.trackingStartedAt, lang)}`
            : tr('trackingNotStarted', lang)}
        </p>
      )}

      {error ? (
        <div className="mt-4">
          <Notice kind="error">{tr('viewsFailed', lang)}</Notice>
          <p className="text-sm text-muted" dir="ltr" data-testid="views-error-code">
            {error}
          </p>
          <div className="mt-2">
            <Button variant="secondary" onClick={() => setNonce((value) => value + 1)}>
              {tr('retry', lang)}
            </Button>
          </div>
        </div>
      ) : data === null ? (
        <Loading text={tr('loading', lang)} />
      ) : (
        <>
          {data.lessons.length === 0 ? (
            <p className="mt-4" data-testid="views-empty">
              {ar ? 'لا توجد دروس في هذا الكورس بعد.' : 'This course has no lessons yet.'}
            </p>
          ) : (
            <ul className="mt-4 grid gap-3 md:grid-cols-2" data-testid="views-list">
              {data.lessons.map((lesson) => (
                <li
                  key={lesson.lessonId}
                  className="rounded-control border border-border p-3"
                  data-testid={`lesson-views-${lesson.lessonId}`}
                >
                  <h4 className="text-base font-bold">{lessonTitle(lesson.title, lang)}</h4>
                  <p
                    className="mt-1 text-xs text-muted"
                    dir="ltr"
                    data-testid={`media-asset-${lesson.lessonId}`}
                  >
                    {lesson.mediaAssetId ?? (ar ? 'بدون فيديو' : 'No video')}
                  </p>
                  <dl className="mt-2 grid gap-1 text-sm">
                    <div className="flex flex-wrap gap-2">
                      <dt className="text-muted">{ar ? 'المشاهدات لكل نسخ الفيديو' : 'Views across all video versions'}: </dt>
                      <dd className="font-bold" data-testid={`lesson-count-${lesson.lessonId}`}>
                        {formatCount(lesson.totalViews, lang)}
                      </dd>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <dt className="text-muted">{tr('lastViewed', lang)}: </dt>
                      <dd dir="auto">
                        {lesson.lastViewedAt === null
                          ? (lesson.totalViews === null ? tr('unknownCount', lang) : tr('noActivity', lang))
                          : formatDateTime(lesson.lastViewedAt, lang)}
                      </dd>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <dt className="text-muted">{ar ? 'التغطية' : 'Coverage'}: </dt>
                      <dd data-testid={`lesson-coverage-${lesson.lessonId}`}>
                        {coverageCopy[lesson.coverage][lang]}
                      </dd>
                    </div>
                  </dl>
                  {lesson.currentMediaViews !== undefined ? (
                    <p className="mt-2 text-sm" data-testid={`current-media-count-${lesson.lessonId}`}>
                      {ar ? 'مشاهدات الفيديو الحالي' : 'Current video views'}: {formatCount(lesson.currentMediaViews, lang)}
                    </p>
                  ) : null}
                  {lesson.mediaVersions?.length ? (
                    <details className="mt-2 text-sm">
                      <summary>{ar ? 'المشاهدات حسب نسخة الفيديو' : 'Views by video version'}</summary>
                      <ul className="mt-2 grid gap-2">
                        {lesson.mediaVersions.map(version => (
                          <li key={version.mediaAssetId} className="break-all" data-testid={`version-${version.mediaAssetId}`}>
                            <span dir="ltr">{version.mediaAssetId}</span>{' '}
                            {version.mediaAssetId === lesson.mediaAssetId ? (ar ? '(الحالي)' : '(current)') : (ar ? '(سابق)' : '(previous)')}
                            : {formatCount(version.totalViews, lang)} · {formatDateTime(version.lastViewedAt, lang)}
                          </li>
                        ))}
                      </ul>
                    </details>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
          {data.lessons.length > 0 ? (
            <nav
              aria-label={ar ? 'صفحات الدروس' : 'Lesson pages'}
              className="mt-4 flex flex-wrap items-center gap-3"
              data-testid="views-pagination"
            >
              <p className="text-sm text-muted">
                {tr('viewsPageLabel', lang)}{' '}
                {new Intl.NumberFormat(ar ? 'ar-EG' : 'en-GB').format(cursors.length)} ·{' '}
                {tr('paginationNote', lang)}
              </p>
              <Button
                type="button"
                variant="secondary"
                data-testid="views-previous"
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
                data-testid="views-next"
                disabled={data.nextCursor === null}
                disabledReason={tr('lastPage', lang)}
                onClick={() => {
                  if (data.nextCursor !== null)
                    setCursors((current) => [...current, data.nextCursor]);
                }}
              >
                {tr('next', lang)}
              </Button>
            </nav>
          ) : null}
        </>
      )}
      <p className="mt-3 text-xs text-muted">{copy.viewedStatusNote[lang]}</p>
    </section>
  );
}
