import { publicHref } from '../../../seo/paths';
import { useState } from 'react';
import { useLang } from '../../../i18n';
import { PaginatedCollection } from '../../../components/ui/Pagination';
import { PackageCards } from '../../academic/PackageCards';
import { gradeLabel } from '../../academic/model';
import { Field, textInputClassName } from '../../../components/ui/Field';
import { localizeCode } from '../../../i18n';
import { Button } from '../../../components/ui/Button';
import { Card, Container } from '../../../components/ui/Card';
import { EmptyState, Loading, Notice } from '../../../components/ui/Notice';
import { usePublicCourses } from '../hooks/usePublicCourses';
import { PriceDisplay } from '../components/PriceDisplay';
import { CourseCover } from '../components/CourseCover';

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
  const [grade, setGrade] = useState('');
  const [term, setTerm] = useState('');
  const [year, setYear] = useState('');
  const [kind, setKind] = useState('');
  const [query, setQuery] = useState('');
  const filtered = compact
    ? courses.filter((course) => !compactGrade || course.academic?.grade === compactGrade)
    : courses.filter(
        (c) =>
          (!grade || c.academic?.grade === grade) &&
          (!term || c.academic?.term === Number(term)) &&
          (!year || c.academic?.academicYear === year) &&
          (!kind || c.academic?.courseKind === kind) &&
          (!query ||
            `${c.titleAr} ${c.titleEn} ${c.descriptionAr} ${c.descriptionEn}`
              .toLowerCase()
              .includes(query.toLowerCase())),
      );
  return (
    <>
      {!compact ? (
        <section className="brand-banner py-14 md:py-16">
          <Container>
            <p className="mb-4 inline-block rounded-full border border-primary/60 bg-primary/10 px-4 py-1 text-sm font-bold text-primary-strong">
              {t.brand}
            </p>
            <h1 className="page-title">{t.catalogTitle}</h1>
            <p className="mt-4 max-w-[68ch] text-lg text-muted">{t.catalogBody}</p>
            <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <Field id="catalog-grade" label={lang === 'ar' ? 'صفّك الدراسي' : 'Your grade'}>
                <select
                  id="catalog-grade"
                  className={textInputClassName(false)}
                  value={grade}
                  onChange={(e) => setGrade(e.target.value)}
                >
                  <option value="">{lang === 'ar' ? 'كل الصفوف' : 'All grades'}</option>
                  {['FIRST_SECONDARY', 'SECOND_SECONDARY'].map((g) => (
                    <option key={g} value={g}>
                      {gradeLabel(g, lang)}
                    </option>
                  ))}
                </select>
              </Field>
              <Field id="catalog-term" label={lang === 'ar' ? 'الترم' : 'Term'}>
                <select
                  id="catalog-term"
                  className={textInputClassName(false)}
                  value={term}
                  onChange={(e) => setTerm(e.target.value)}
                >
                  <option value="">{lang === 'ar' ? 'كل الترمات' : 'All terms'}</option>
                  <option value="1">{lang === 'ar' ? 'الترم الأول' : 'Term 1'}</option>
                  <option value="2">{lang === 'ar' ? 'الترم الثاني' : 'Term 2'}</option>
                </select>
              </Field>
              <Field id="catalog-year" label={lang === 'ar' ? 'السنة الدراسية' : 'Academic year'}>
                <select
                  id="catalog-year"
                  className={textInputClassName(false)}
                  value={year}
                  onChange={(e) => setYear(e.target.value)}
                >
                  <option value="">{lang === 'ar' ? 'كل السنوات' : 'All years'}</option>
                  {[
                    ...new Set(
                      courses.map((c) => c.academic?.academicYear).filter((v): v is string => !!v),
                    ),
                  ]
                    .sort()
                    .reverse()
                    .map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                </select>
              </Field>
              <Field id="catalog-kind" label={lang === 'ar' ? 'نوع الكورس' : 'Course type'}>
                <select
                  id="catalog-kind"
                  className={textInputClassName(false)}
                  value={kind}
                  onChange={(e) => setKind(e.target.value)}
                >
                  <option value="">
                    {lang === 'ar' ? 'الشرح والمراجعات' : 'Monthly and revision'}
                  </option>
                  <option value="MONTHLY_EXPLANATION">
                    {lang === 'ar' ? 'شرح شهري' : 'Monthly course'}
                  </option>
                  <option value="REVISION">{lang === 'ar' ? 'مراجعات' : 'Revision'}</option>
                </select>
              </Field>
              <Field
                id="catalog-search"
                label={lang === 'ar' ? 'ابحث عن كورسك' : 'Find your course'}
              >
                <input
                  id="catalog-search"
                  type="search"
                  className={textInputClassName(false)}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </Field>
            </div>
          </Container>
        </section>
      ) : null}
      <section
        className={compact ? 'py-12 max-sm:py-8' : 'py-10'}
        aria-labelledby="catalog-title"
        aria-live="polite"
      >
        <Container>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-sm font-bold text-primary-strong">
                {compact ? (lang === 'ar' ? 'اختار محتواك' : 'Find your content') : (lang === 'ar' ? 'تعلّم بطريقتك' : 'Learn your way')}
              </p>
              <h2 id="catalog-title" className="mt-1 scroll-mt-[100px] text-[clamp(24px,2.5vw,34px)] font-extrabold" tabIndex={compact ? -1 : undefined}>
                {compact
                  ? lang === 'ar'
                    ? 'الدورات المتاحة'
                    : 'Available courses'
                  : t.navCourses}
              </h2>
            </div>
            {compact ? (
              <a
                href={publicHref("#/courses", lang)}
                className="font-bold text-primary-strong underline-offset-4 hover:underline"
              >
                {lang === 'ar' ? 'عرض كل الدورات' : 'View all courses'} →
              </a>
            ) : null}
          </div>
          {compact && onCompactGradeChange ? <div className="mt-5 flex flex-wrap gap-2" role="group" aria-label={lang === 'ar' ? 'تصفية الدورات حسب الصف' : 'Filter courses by grade'}>{['', 'FIRST_SECONDARY', 'SECOND_SECONDARY'].map(value => <button key={value} className="min-h-[44px] rounded-[10px] border border-border-strong bg-surface px-4 py-2 text-sm font-bold hover:shadow-[inset_0_0_0_1px_var(--color-border-strong)] aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-primary-ink" type="button" aria-pressed={compactGrade === value} onClick={() => onCompactGradeChange(value)}>{value ? gradeLabel(value, lang) : (lang === 'ar' ? 'كل الدورات' : 'All courses')}</button>)}</div> : null}
          {loading ? <Loading text={t.catalogLoading} /> : null}
          {!compact && !loading ? <div className="my-4 flex flex-wrap items-center gap-3"><p role="status">{lang==='ar'?`${filtered.length} من ${courses.length} كورس`:`${filtered.length} of ${courses.length} courses`}</p><Button variant="secondary" onClick={()=>{setQuery('');setGrade('');setTerm('');setYear('');setKind('');}}>{lang==='ar'?'مسح البحث والتصفية':'Clear search and filters'}</Button></div>:null}
          {error !== null ? (
            <div>
              <Notice kind="error">{localizeCode(t, error)}</Notice>
              <Button variant="secondary" onClick={reload}>
                {t.retryLabel}
              </Button>
            </div>
          ) : null}
          {!loading && error === null && filtered.length === 0 ? (
            <EmptyState text={compact && compactGrade ? (lang === 'ar' ? 'لا توجد دورات متاحة لهذا الصف حاليًا. يمكنك عرض كل الدورات.' : 'No courses are available for this grade yet. You can view all courses.') : compact?t.catalogEmpty:lang==='ar'?'لا توجد كورسات مطابقة. غيّر البحث أو امسح التصفية.':'No matching courses. Change your search or clear the filters.'} />
          ) : null}
          <PaginatedCollection id="public-courses" resetKey={JSON.stringify([query,grade,term,year,compactGrade])} className="mt-6 grid grid-cols-3 gap-6 max-lg:grid-cols-2 max-sm:grid-cols-1">
            {filtered.slice(0, compact ? 3 : filtered.length).map((c) => (
              <article key={c.id}>
                <Card className={`group relative flex h-full flex-col gap-3 overflow-hidden border-border-strong transition-[border-color,transform,box-shadow] hover:border-primary ${compact ? '!p-5 !shadow-none' : 'hover:-translate-y-1 hover:shadow-lift'}`}>
                  <CourseCover path={c.coverUrl} title={lang === 'ar' ? c.titleAr : c.titleEn} />
                  {compact ? <div className="flex flex-wrap justify-between gap-2 rounded-control bg-selected px-3.5 py-2.5 text-sm font-bold text-ink"><span>{gradeLabel(c.academic?.grade, lang)}</span>{c.academic?.term ? <span>{lang === 'ar' ? 'الترم' : 'Term'} {c.academic.term}</span> : null}</div> : null}
                  <h3 className="m-0 text-xl font-bold">{lang === 'ar' ? c.titleAr : c.titleEn}</h3>
                  {c.academic?.grade ? (
                    <p className="text-sm font-bold text-primary-strong">
                      {gradeLabel(c.academic.grade, lang)} • {lang === 'ar' ? 'ترم' : 'Term'}{' '}
                      {c.academic.term} •{' '}
                      {c.academic.courseKind === 'REVISION'
                        ? lang === 'ar'
                          ? 'مراجعة'
                          : 'Revision'
                        : c.academic.teachingMonth}
                    </p>
                  ) : null}
                  <p className="line-clamp-3 text-muted">
                    {lang === 'ar' ? c.descriptionAr : c.descriptionEn}
                  </p>
                  {c.plans[0] !== undefined ? (
                    <PriceDisplay
                      current={c.plans[0].currentPricePiastres}
                      previous={c.plans[0].previousPricePiastres}
                      durationDays={c.plans[0].durationDays}
                      accessMode={c.plans[0].accessMode}
                      accessEndsAt={c.plans[0].accessEndsAt}
                    />
                  ) : null}
                  <a href={publicHref(`#/courses/${encodeURIComponent(c.slug)}`, lang)} aria-label={(lang === "ar" ? "عرض العرض: " : "View offer: ") + (lang === "ar" ? c.titleAr : c.titleEn)} className="mt-auto inline-flex min-h-[44px] w-full items-center justify-center rounded-control bg-primary px-6 py-2 font-bold text-primary-ink hover:bg-primary-hover">
                    {compact ? (lang === 'ar' ? 'تفاصيل الدورة' : 'Course details') : (lang === 'ar' ? 'عرض العرض' : 'View offer')}
                  </a>
                </Card>
              </article>
            ))}
          </PaginatedCollection>
          {!compact ? <PackageCards grade={grade} term={term} year={year} query={query} /> : null}
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
