import { publicHref } from '../../../seo/paths';
import { useEffect, useState } from 'react';
import { useLang, localizeCode } from '../../../i18n';
import { PaginatedCollection } from '../../../components/ui/Pagination';
import { PackageCards } from '../../academic/PackageCards';
import { gradeLabel } from '../../academic/model';
import { Button } from '../../../components/ui/Button';
import { Container } from '../../../components/ui/Card';
import { EmptyState, Notice } from '../../../components/ui/Notice';
import { usePublicCourses } from '../hooks/usePublicCourses';
import { fetchPublicSubjects, fetchPublicTeachers } from '../api/client';
import type { PublicSubject, PublicTeacher } from '../types/models';
import { CourseCard } from '../components/CourseCard';
import { CatalogFilterBar } from '../components/CatalogFilterBar';

export function PublicCatalogSections({
  compact = false,
  compactGrade = '',
  onCompactGradeChange,
}: {
  onSelect: (slug: string) => void;
  compact?: boolean;
  compactGrade?: string;
  onCompactGradeChange?: (grade: string) => void;
}): JSX.Element {
  const { t, lang } = useLang();
  const { loading, courses, error, reload } = usePublicCourses();
  const [subjects, setSubjects] = useState<PublicSubject[]>([]);
  const [teachers, setTeachers] = useState<PublicTeacher[]>([]);
  const [grade, setGrade] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [teacherId, setTeacherId] = useState('');
  const [term, setTerm] = useState('');
  const [year, setYear] = useState('');
  const [kind, setKind] = useState('');
  const [query, setQuery] = useState('');

  useEffect(() => {
    let live = true;
    void Promise.all([fetchPublicSubjects(), fetchPublicTeachers()])
      .then(([s, te]) => {
        if (live) {
          setSubjects(s);
          setTeachers(te);
        }
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, []);

  const availableYears = [
    ...new Set(courses.map((c) => c.academic?.academicYear).filter((v): v is string => !!v)),
  ]
    .sort()
    .reverse();

  const hasActiveFilters = Boolean(query || grade || subjectId || teacherId || term || year || kind);

  const filtered = compact
    ? courses.filter(
        (course) =>
          (!compactGrade || course.academic?.grade === compactGrade) &&
          (!subjectId || course.subject?.id === subjectId) &&
          (!teacherId || course.teacher?.id === teacherId),
      )
    : courses.filter(
        (c) =>
          (!grade || c.academic?.grade === grade) &&
          (!subjectId || c.subject?.id === subjectId) &&
          (!teacherId || c.teacher?.id === teacherId) &&
          (!term || c.academic?.term === Number(term)) &&
          (!year || c.academic?.academicYear === year) &&
          (!kind || c.academic?.courseKind === kind) &&
          (!query ||
            `${c.titleAr} ${c.titleEn} ${c.descriptionAr} ${c.descriptionEn}`
              .toLowerCase()
              .includes(query.toLowerCase())),
      );

  function clearAllFilters(): void {
    setQuery('');
    setGrade('');
    setSubjectId('');
    setTeacherId('');
    setTerm('');
    setYear('');
    setKind('');
  }

  return (
    <>
      {!compact ? (
        <CatalogFilterBar
          subjects={subjects}
          teachers={teachers}
          years={availableYears}
          grade={grade}
          subjectId={subjectId}
          teacherId={teacherId}
          term={term}
          year={year}
          kind={kind}
          query={query}
          onGradeChange={setGrade}
          onSubjectChange={setSubjectId}
          onTeacherChange={setTeacherId}
          onTermChange={setTerm}
          onYearChange={setYear}
          onKindChange={setKind}
          onQueryChange={setQuery}
        />
      ) : null}
      <section
        className={compact ? 'pb-12 pt-10 md:pt-14' : 'py-8 md:py-10'}
        aria-labelledby="catalog-title"
        aria-live="polite"
      >
        <Container>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="text-start">
              <p className="text-sm font-bold text-primary-strong">
                {compact
                  ? lang === 'ar'
                    ? 'اختار محتواك'
                    : 'Find your content'
                  : lang === 'ar'
                    ? 'تعلّم بطريقتك'
                    : 'Learn your way'}
              </p>
              <h2
                id="catalog-title"
                className="mt-1 scroll-mt-[100px] text-balance text-[clamp(24px,2.5vw,34px)] font-extrabold text-ink"
                tabIndex={compact ? -1 : undefined}
              >
                {compact
                  ? lang === 'ar'
                    ? 'الدورات المتاحة'
                    : 'Available courses'
                  : t.navCourses}
              </h2>
            </div>
            {compact ? (
              <a
                href={publicHref('#/courses', lang)}
                className="inline-flex min-h-[44px] items-center gap-1.5 font-bold text-primary-strong underline-offset-4 hover:underline"
              >
                <span>{lang === 'ar' ? 'عرض كل الدورات' : 'View all courses'}</span>
                <span className="inline-block rtl:rotate-180" aria-hidden="true">→</span>
              </a>
            ) : null}
          </div>

          {compact && onCompactGradeChange ? (
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-surface/90 p-3">
              <div
                className="inline-flex flex-wrap items-center gap-1 rounded-xl bg-elevated p-1"
                role="group"
                aria-label={lang === 'ar' ? 'تصفية الدورات حسب الصف' : 'Filter courses by grade'}
              >
                {['', 'FIRST_SECONDARY', 'SECOND_SECONDARY'].map((value) => (
                  <button
                    key={value || 'all'}
                    className="min-h-[40px] rounded-lg px-4 py-1.5 text-sm font-bold text-muted transition-[background-color,color] duration-150 hover:text-ink aria-pressed:bg-primary aria-pressed:text-primary-ink"
                    type="button"
                    aria-pressed={compactGrade === value}
                    onClick={() => onCompactGradeChange(value)}
                  >
                    {value
                      ? gradeLabel(value, lang)
                      : lang === 'ar'
                        ? 'كل الدورات'
                        : 'All courses'}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-2.5">
                {subjects.length > 0 ? (
                  <select
                    aria-label={t.subject}
                    value={subjectId}
                    onChange={(e) => setSubjectId(e.target.value)}
                    className="min-h-[44px] rounded-xl border border-border-strong bg-elevated px-3.5 py-2 text-sm font-semibold text-ink transition-colors hover:border-primary/60 focus:border-primary"
                  >
                    <option value="">{t.allSubjects}</option>
                    {subjects.map((s) => (
                      <option key={s.id} value={s.id}>
                        {lang === 'ar' ? s.nameAr : s.nameEn}
                      </option>
                    ))}
                  </select>
                ) : null}
                {teachers.length > 0 ? (
                  <select
                    aria-label={t.teacher}
                    value={teacherId}
                    onChange={(e) => setTeacherId(e.target.value)}
                    className="min-h-[44px] rounded-xl border border-border-strong bg-elevated px-3.5 py-2 text-sm font-semibold text-ink transition-colors hover:border-primary/60 focus:border-primary"
                  >
                    <option value="">{t.allTeachers}</option>
                    {teachers.map((te) => (
                      <option key={te.id} value={te.id}>
                        {lang === 'ar' ? te.nameAr : te.nameEn}
                      </option>
                    ))}
                  </select>
                ) : null}
                {compactGrade || subjectId || teacherId ? (
                  <button
                    type="button"
                    onClick={() => {
                      onCompactGradeChange('');
                      setSubjectId('');
                      setTeacherId('');
                    }}
                    className="min-h-[44px] rounded-xl border border-border px-3.5 py-2 text-sm font-semibold text-muted transition-colors hover:border-border-strong hover:text-ink"
                  >
                    {lang === 'ar' ? 'مسح' : 'Clear'}
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}

          {loading ? (
            <div
              className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3 lg:gap-6"
              aria-busy="true"
            >
              {[0, 1, 2].map((i) => (
                <div key={i} className="rounded-2xl border border-border bg-surface p-3.5">
                  <div className="aspect-video w-full animate-pulse rounded-xl bg-elevated" />
                  <div className="mt-4 h-3 w-1/3 animate-pulse rounded bg-elevated" />
                  <div className="mt-2 h-5 w-3/4 animate-pulse rounded bg-elevated" />
                  <div className="mt-3 h-4 w-full animate-pulse rounded bg-elevated" />
                  <div className="mt-5 h-11 w-full animate-pulse rounded-xl bg-elevated" />
                </div>
              ))}
            </div>
          ) : null}

          {!compact && !loading ? (
            <div className="my-4 flex flex-wrap items-center justify-between gap-3">
              <p role="status" className="tabular-nums text-sm font-semibold text-muted">
                {lang === 'ar'
                  ? `${filtered.length} من ${courses.length} كورس`
                  : `${filtered.length} of ${courses.length} courses`}
              </p>
              {hasActiveFilters ? (
                <Button variant="secondary" onClick={clearAllFilters}>
                  {lang === 'ar' ? 'مسح البحث والتصفية' : 'Clear search and filters'}
                </Button>
              ) : null}
            </div>
          ) : null}

          {error !== null ? (
            <div>
              <Notice kind="error">{localizeCode(t, error)}</Notice>
              <Button variant="secondary" onClick={reload}>
                {t.retryLabel}
              </Button>
            </div>
          ) : null}

          {!loading && error === null && filtered.length === 0 ? (
            <EmptyState
              text={
                compact && compactGrade
                  ? lang === 'ar'
                    ? 'لا توجد دورات متاحة لهذا الصف حاليًا. يمكنك عرض كل الدورات.'
                    : 'No courses are available for this grade yet. You can view all courses.'
                  : compact
                    ? t.catalogEmpty
                    : lang === 'ar'
                      ? 'لا توجد كورسات مطابقة. غيّر البحث أو امسح التصفية.'
                      : 'No matching courses. Change your search or clear the filters.'
              }
            />
          ) : null}

          <PaginatedCollection
            id="public-courses"
            resetKey={JSON.stringify([query, grade, subjectId, teacherId, term, year, kind, compactGrade])}
            className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3 lg:gap-6"
          >
            {filtered.slice(0, compact ? 3 : filtered.length).map((c) => (
              <CourseCard key={c.id} course={c} lang={lang} compact={compact} />
            ))}
          </PaginatedCollection>

          {!compact ? (
            <PackageCards
              grade={grade}
              subjectId={subjectId}
              teacherId={teacherId}
              term={term}
              year={year}
              query={query}
            />
          ) : null}
        </Container>
      </section>
    </>
  );
}

export function PublicCatalogPage({ onSelect }: { onSelect: (slug: string) => void }): JSX.Element {
  return (
    <main id="main">
      <PublicCatalogSections onSelect={onSelect} />
    </main>
  );
}
