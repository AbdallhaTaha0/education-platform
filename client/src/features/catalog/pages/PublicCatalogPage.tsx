import { useState } from 'react';
import { useLang } from '../../../i18n';
import { PackageCards } from '../../academic/PackageCards';
import { gradeLabel } from '../../academic/model';
import { Field, textInputClassName } from '../../../components/ui/Field';
import { localizeCode } from '../../../i18n';
import { Button } from '../../../components/ui/Button';
import { Card, Container } from '../../../components/ui/Card';
import { EmptyState, Loading, Notice } from '../../../components/ui/Notice';
import { usePublicCourses } from '../hooks/usePublicCourses';
import { PriceDisplay } from '../components/PriceDisplay';

export function PublicCatalogSections({
  onSelect,
  compact = false,
}: {
  onSelect: (slug: string) => void;
  compact?: boolean;
}): JSX.Element {
  const { t, lang } = useLang();
  const { loading, courses, error, reload } = usePublicCourses();
  const [grade, setGrade] = useState('');
  const [term, setTerm] = useState('');
  const [year, setYear] = useState('');
  const [kind, setKind] = useState('');
  const [query, setQuery] = useState('');
  const filtered = compact
    ? courses
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
        className={compact ? 'py-14' : 'py-10'}
        aria-labelledby="catalog-title"
        aria-live="polite"
      >
        <Container>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-sm font-bold uppercase tracking-[.14em] text-primary-strong">
                {lang === 'ar' ? 'تعلّم بطريقتك' : 'Learn your way'}
              </p>
              <h2 id="catalog-title" className="section-title mt-1">
                {compact
                  ? lang === 'ar'
                    ? 'ابدأ بدورة تناسبك'
                    : 'Start with the right course'
                  : t.navCourses}
              </h2>
            </div>
            {compact ? (
              <a
                href="#/courses"
                className="font-bold text-primary-strong underline-offset-4 hover:underline"
              >
                {lang === 'ar' ? 'عرض كل الدورات' : 'View all courses'} →
              </a>
            ) : null}
          </div>
          {loading ? <Loading text={t.catalogLoading} /> : null}
          {error !== null ? (
            <div>
              <Notice kind="error">{localizeCode(t, error)}</Notice>
              <Button variant="secondary" onClick={reload}>
                {t.retryLabel}
              </Button>
            </div>
          ) : null}
          {!loading && error === null && filtered.length === 0 ? (
            <EmptyState text={t.catalogEmpty} />
          ) : null}
          <div className="mt-6 grid grid-cols-3 gap-6 max-lg:grid-cols-2 max-sm:grid-cols-1">
            {filtered.slice(0, compact ? 3 : filtered.length).map((c, index) => (
              <article key={c.id}>
                <Card className="group relative flex h-full flex-col gap-3 overflow-hidden border-border-strong transition-[border-color,transform,box-shadow] hover:-translate-y-1 hover:border-primary hover:shadow-lift">
                  <div className={`catalog-art catalog-art--${index % 3}`} aria-hidden="true">
                    <span>
                      {['{ }', '&lt;/&gt;', '( )'][index % 3]
                        .replace('&lt;', '<')
                        .replace('&gt;', '>')}
                    </span>
                    <b>FAYQ</b>
                  </div>
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
                  <Button
                    variant="primary"
                    className="mt-auto w-full"
                    onClick={() => onSelect(c.slug)}
                  >
                    {lang === 'ar' ? 'عرض العرض' : 'View offer'}
                  </Button>
                </Card>
              </article>
            ))}
          </div>
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
