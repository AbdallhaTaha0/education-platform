import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { ApiError, useAuth } from '../../../auth';
import { localizeCode, useLang } from '../../../i18n';
import { Button } from '../../../components/ui/Button';
import { Card, Container } from '../../../components/ui/Card';
import { Field, textInputClassName } from '../../../components/ui/Field';
import { EmptyState, Loading, Notice } from '../../../components/ui/Notice';
import { StatusBadge } from '../../../components/ui/Dialog';
import { createAdminCourse, fetchAdminCourses } from '../api/client';
import type { AdminCourseSummary } from '../types/models';
import { CourseForm } from './CourseForm';
import { businessState } from '../../../components/ui/AdminNavigation';
import { PaginatedCollection } from '../../../components/ui/Pagination';
import { AdminCourseTabs } from '../components/AdminCourseTabs';
import { AdminTaxonomyPanels } from '../components/AdminTaxonomyPanels';
import { gradeLabel } from '../../academic/model';

export function AdminListPage({ go }: { go: (h: string) => void }): JSX.Element {
  const { t, lang } = useLang();
  const ar = lang === 'ar';
  const { status, user } = useAuth();
  const [courses, setCourses] = useState<AdminCourseSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [creating, setCreating] = useState(false);
  const [query, setQuery] = useState('');
  const [state, setState] = useState('');
  const [grade, setGrade] = useState('');
  const [term, setTerm] = useState('');

  const filtered = courses.filter(
    (c) =>
      (!query || `${c.titleAr} ${c.titleEn} ${c.slug}`.toLowerCase().includes(query.toLowerCase())) &&
      (!state || c.status === state) &&
      (!grade || c.grade === grade) &&
      (!term || c.term === Number(term)),
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setCourses(await fetchAdminCourses());
    } catch (err) {
      setError(err instanceof ApiError ? err.code : 'SERVICE_ERROR');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === 'authenticated' && user?.role === 'ADMIN') void load();
  }, [status, user, load]);

  if (status === 'loading') {
    return (
      <Container>
        <Loading text={t.authChecking} />
      </Container>
    );
  }
  if (status === 'anonymous' || user === null) {
    return (
      <Container>
        <Card>
          <h1 className="text-2xl font-bold">{t.adminCatalogTitle}</h1>
          <Notice kind="info">{t.needLogin}</Notice>
        </Card>
      </Container>
    );
  }
  if (user.role !== 'ADMIN') {
    return (
      <Container>
        <Card>
          <h1 className="text-2xl font-bold">{t.forbiddenTitle}</h1>
          <Notice kind="error">{t.forbiddenBody}</Notice>
        </Card>
      </Container>
    );
  }

  async function submit(input: {
    slug: string;
    titleAr: string;
    titleEn: string;
    descriptionAr: string;
    descriptionEn: string;
  }): Promise<boolean> {
    setBusy(true);
    setError(null);
    try {
      await createAdminCourse(input);
      await load();
      setCreating(false);
      return true;
    } catch (err) {
      setError(err instanceof ApiError ? err.code : 'SERVICE_ERROR');
      return false;
    } finally {
      setBusy(false);
    }
  }

  const hasFilters = Boolean(query || state || grade || term);

  return (
    <main id="main">
      <section className="py-6 text-start md:py-8">
        <Container>
          {/* Structured Admin Catalog Header Toolbar */}
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border/70 pb-5">
            <div>
              <h1 className="page-title text-ink">{t.adminCatalogTitle}</h1>
              <p className="mt-1.5 text-sm text-muted sm:text-base">{t.adminCatalogBody}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2.5">
              <a
                href="#/admin/packages"
                className="inline-flex min-h-[44px] items-center rounded-xl border border-border-strong bg-elevated px-4 py-2 text-sm font-bold text-ink no-underline transition-colors hover:border-primary hover:bg-interactive"
              >
                {ar ? 'إدارة باقات الشهور' : 'Manage monthly packages'}
              </a>
              <a
                href="#/admin/summary"
                className="inline-flex min-h-[44px] items-center rounded-xl border border-border bg-surface px-4 py-2 text-sm font-bold text-muted no-underline transition-colors hover:border-border-strong hover:text-ink"
              >
                {ar ? 'ملخص المنصة' : 'Platform overview'}
              </a>
              <Button onClick={() => setCreating((v) => !v)}>
                {creating ? t.cancel : t.courseCreateTitle}
              </Button>
            </div>
          </div>

          <div className="mt-5">
            <AdminCourseTabs courses={courses} />
            <AdminTaxonomyPanels onChanged={() => void load()} />
          </div>

          {error !== null ? (
            <div className="mt-4">
              <Notice kind="error">{localizeCode(t, error)}</Notice>
            </div>
          ) : null}

          {creating ? <CourseForm busy={busy} onSubmit={submit} /> : null}

          <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
            <h2 className="section-title text-ink tabular-nums">
              {t.navCourses} ({filtered.length}/{courses.length})
            </h2>
            {hasFilters ? (
              <Button
                variant="secondary"
                onClick={() => {
                  setQuery('');
                  setState('');
                  setGrade('');
                  setTerm('');
                }}
              >
                {ar ? 'مسح البحث والتصفية' : 'Clear search and filters'}
              </Button>
            ) : null}
          </div>

          <div className="my-4 grid gap-3 rounded-2xl border border-border bg-surface p-4 sm:grid-cols-2 lg:grid-cols-4">
            <AdminSearchField value={query} onChange={setQuery} />
            {[
              [
                ar ? 'الحالة' : 'Status',
                state,
                setState,
                ['DRAFT', 'PROCESSING', 'READY', 'PUBLISHED', 'ARCHIVED'],
              ],
              [ar ? 'الصف' : 'Grade', grade, setGrade, ['FIRST_SECONDARY', 'SECOND_SECONDARY']],
              [ar ? 'الترم' : 'Term', term, setTerm, ['1', '2']],
            ].map(([labelText, value, setter, options], i) => (
              <label key={i} className="block text-start">
                <span className="mb-2 block text-sm font-semibold text-ink">
                  {labelText as string}
                </span>
                <select
                  aria-label={labelText as string}
                  className={textInputClassName(false)}
                  value={value as string}
                  onChange={(e) => (setter as (s: string) => void)(e.target.value)}
                >
                  <option value="">{ar ? 'الكل' : 'All'}</option>
                  {(options as string[]).map((s) => (
                    <option key={s} value={s}>
                      {i === 0
                        ? businessState(s, ar)
                        : i === 1
                          ? s === 'FIRST_SECONDARY'
                            ? ar
                              ? 'الأول الثانوي'
                              : 'First secondary'
                            : ar
                              ? 'الثاني الثانوي'
                              : 'Second secondary'
                          : s}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>

          {loading ? <Loading text={t.loading} /> : null}
          {!loading && filtered.length === 0 ? (
            <EmptyState
              text={
                ar
                  ? 'لا توجد نتائج. غيّر البحث أو امسح التصفية.'
                  : 'No matching courses. Change your search or clear the filters.'
              }
            />
          ) : null}

          <PaginatedCollection
            id="admin-courses"
            resetKey={JSON.stringify([query, state, grade, term])}
            className="mt-4 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3"
          >
            {filtered.map((c) => {
              const subjectName = c.subject ? (ar ? c.subject.nameAr : c.subject.nameEn) : null;
              const teacherName = c.teacher ? (ar ? c.teacher.nameAr : c.teacher.nameEn) : null;
              return (
                <Card
                  key={c.id}
                  className="flex flex-col gap-3 rounded-2xl border-border bg-surface !p-5 text-start transition-colors hover:border-border-strong"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <h3 className="m-0 min-w-0 flex-1 text-lg font-extrabold leading-snug text-ink">
                      {ar ? c.titleAr : c.titleEn}
                    </h3>
                    <StatusBadge
                      text={businessState(c.status, ar)}
                      tone={c.status === 'PUBLISHED' ? 'success' : 'info'}
                    />
                  </div>

                  {subjectName || teacherName || c.grade ? (
                    <div className="flex flex-wrap items-center gap-1.5">
                      {subjectName ? (
                        <span className="inline-flex rounded-full border border-primary/35 bg-primary/15 px-2.5 py-0.5 text-xs font-bold text-primary-strong">
                          {subjectName}
                        </span>
                      ) : null}
                      {teacherName ? (
                        <span className="inline-flex rounded-full border border-border bg-elevated px-2.5 py-0.5 text-xs font-semibold text-ink">
                          {teacherName}
                        </span>
                      ) : null}
                      {c.grade ? (
                        <span className="inline-flex rounded-full border border-border bg-field px-2.5 py-0.5 text-xs font-semibold text-muted">
                          {gradeLabel(c.grade, lang)}
                          {c.term ? ` · ${ar ? 'ترم' : 'Term'} ${c.term}` : ''}
                        </span>
                      ) : null}
                    </div>
                  ) : null}

                  <p className="font-mono text-xs text-muted" dir="ltr">
                    {c.slug}
                  </p>

                  <div className="mt-auto border-t border-border/60 pt-3">
                    <Button
                      variant="secondary"
                      className="w-full"
                      onClick={() => go(`#/admin/courses/${c.id}`)}
                    >
                      {t.actionEdit}
                    </Button>
                  </div>
                </Card>
              );
            })}
          </PaginatedCollection>
        </Container>
      </section>
    </main>
  );
}

export function AdminSearchField({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}): JSX.Element {
  const { lang } = useLang();
  return (
    <form onSubmit={(e: FormEvent) => e.preventDefault()} noValidate>
      <Field
        id="admin-search"
        label={lang === 'ar' ? 'البحث بالاسم أو المعرّف' : 'Search by name or slug'}
        className="!mb-0"
      >
        <input
          id="admin-search"
          dir="ltr"
          className={textInputClassName(false)}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      </Field>
    </form>
  );
}
