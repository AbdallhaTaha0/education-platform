import { useState } from 'react';
import { Container } from '../../../components/ui/Card';
import { Field, adornedInputClassName, textInputClassName } from '../../../components/ui/Field';
import { gradeLabel } from '../../academic/model';
import { useLang } from '../../../i18n';
import type { PublicSubject, PublicTeacher } from '../types/models';

export interface CatalogFilterBarProps {
  subjects: PublicSubject[];
  teachers: PublicTeacher[];
  years: string[];
  grade: string;
  subjectId: string;
  teacherId: string;
  term: string;
  year: string;
  kind: string;
  query: string;
  onGradeChange: (value: string) => void;
  onSubjectChange: (value: string) => void;
  onTeacherChange: (value: string) => void;
  onTermChange: (value: string) => void;
  onYearChange: (value: string) => void;
  onKindChange: (value: string) => void;
  onQueryChange: (value: string) => void;
}

export function CatalogFilterBar({
  subjects,
  teachers,
  years,
  grade,
  subjectId,
  teacherId,
  term,
  year,
  kind,
  query,
  onGradeChange,
  onSubjectChange,
  onTeacherChange,
  onTermChange,
  onYearChange,
  onKindChange,
  onQueryChange,
}: CatalogFilterBarProps): JSX.Element {
  const { t, lang } = useLang();
  const ar = lang === 'ar';
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const activeAdvancedCount = [grade, subjectId, teacherId, term, year, kind].filter(Boolean).length;

  return (
    <section className="brand-banner py-8 md:py-10">
      <Container>
        <div className="text-start">
          <p className="mb-3 inline-block rounded-full border border-primary/50 bg-primary/10 px-3.5 py-1 text-xs font-extrabold text-primary-strong">
            {t.brand}
          </p>
          <h1 className="page-title text-ink">{t.catalogTitle}</h1>
          <p className="mt-2.5 max-w-[66ch] text-base text-muted md:text-lg">{t.catalogBody}</p>
        </div>

        {/* 1-tap teen discovery row: search + instant Grade pills + Subject chips */}
        <div className="mt-6 rounded-2xl border border-border bg-surface/95 p-4 shadow-rest sm:p-5">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_auto] lg:items-end">
            <Field
              id="catalog-search"
              label={ar ? 'ابحث عن كورسك' : 'Find your course'}
              className="!mb-0"
              startAdornment={
                <svg
                  className="h-4 w-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <circle cx="11" cy="11" r="8" />
                  <path d="m21 21-4.3-4.3" />
                </svg>
              }
            >
              <input
                id="catalog-search"
                type="search"
                placeholder={ar ? 'ابحث باسم الكورس أو الوصف…' : 'Search by course title or topic…'}
                className={adornedInputClassName()}
                value={query}
                onChange={(e) => onQueryChange(e.target.value)}
              />
            </Field>

            <div className="flex flex-wrap items-center gap-2">
              <div
                className="inline-flex flex-wrap items-center gap-1.5 rounded-xl bg-elevated p-1"
                role="group"
                aria-label={ar ? 'تصفية سريعة حسب الصف' : 'Quick filter by grade'}
              >
                {(['', 'FIRST_SECONDARY', 'SECOND_SECONDARY'] as const).map((value) => (
                  <button
                    key={value || 'all'}
                    type="button"
                    aria-pressed={grade === value}
                    onClick={() => onGradeChange(value)}
                    className="min-h-[42px] rounded-lg px-3.5 py-1.5 text-sm font-bold text-muted transition-colors hover:text-ink aria-pressed:bg-primary aria-pressed:text-primary-ink aria-pressed:shadow-rest"
                  >
                    {value ? gradeLabel(value, lang) : ar ? 'كل الصفوف' : 'All grades'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {subjects.length > 0 ? (
            <div
              className="mt-3.5 flex items-center gap-2 overflow-x-auto pb-1"
              role="group"
              aria-label={ar ? 'تصفية سريعة حسب المادة' : 'Quick filter by subject'}
            >
              <button
                type="button"
                aria-pressed={subjectId === ''}
                onClick={() => onSubjectChange('')}
                className="min-h-[38px] shrink-0 rounded-full border border-border bg-field px-3.5 py-1 text-xs font-bold text-muted transition-colors hover:border-border-strong hover:text-ink aria-pressed:border-primary aria-pressed:bg-selected aria-pressed:text-primary-strong"
              >
                {t.allSubjects}
              </button>
              {subjects.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  aria-pressed={subjectId === s.id}
                  onClick={() => onSubjectChange(subjectId === s.id ? '' : s.id)}
                  className="min-h-[38px] shrink-0 rounded-full border border-border bg-field px-3.5 py-1 text-xs font-bold text-muted transition-colors hover:border-border-strong hover:text-ink aria-pressed:border-primary aria-pressed:bg-selected aria-pressed:text-primary-strong"
                >
                  {ar ? s.nameAr : s.nameEn}
                </button>
              ))}
            </div>
          ) : null}

          {/* Mobile disclosure toggle so mobile students see course cards above the fold */}
          <div className="mt-3.5 border-t border-border/70 pt-3 md:hidden">
            <button
              type="button"
              aria-expanded={mobileFiltersOpen}
              aria-controls="catalog-advanced-filters"
              onClick={() => setMobileFiltersOpen((v) => !v)}
              className="flex min-h-[44px] w-full items-center justify-between gap-3 rounded-xl border border-border-strong bg-elevated px-4 py-2 text-sm font-bold text-ink"
            >
              <span className="inline-flex items-center gap-2">
                <span>{ar ? 'تصفية إضافية' : 'More filters'}</span>
                {activeAdvancedCount > 0 ? (
                  <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-primary px-1.5 text-xs font-extrabold tabular-nums text-primary-ink">
                    {activeAdvancedCount}
                  </span>
                ) : null}
              </span>
              <span aria-hidden="true" className="text-muted">
                {mobileFiltersOpen ? '▲' : '▼'}
              </span>
            </button>
          </div>

          {/* Detailed select filters: always mounted in DOM; collapsed on <768px unless opened */}
          <div
            id="catalog-advanced-filters"
            className={`${
              mobileFiltersOpen ? 'grid' : 'hidden md:grid'
            } mt-4 gap-3 border-t border-border/60 pt-4 sm:grid-cols-2 lg:grid-cols-3`}
          >
            <Field id="catalog-grade" label={ar ? 'صفّك الدراسي' : 'Your grade'} className="!mb-0">
              <select
                id="catalog-grade"
                className={textInputClassName(false)}
                value={grade}
                onChange={(e) => onGradeChange(e.target.value)}
              >
                <option value="">{ar ? 'كل الصفوف' : 'All grades'}</option>
                {['FIRST_SECONDARY', 'SECOND_SECONDARY'].map((g) => (
                  <option key={g} value={g}>
                    {gradeLabel(g, lang)}
                  </option>
                ))}
              </select>
            </Field>
            <Field id="catalog-subject" label={t.subject} className="!mb-0">
              <select
                id="catalog-subject"
                className={textInputClassName(false)}
                value={subjectId}
                onChange={(e) => onSubjectChange(e.target.value)}
              >
                <option value="">{t.allSubjects}</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {ar ? s.nameAr : s.nameEn}
                  </option>
                ))}
              </select>
            </Field>
            <Field id="catalog-teacher" label={t.teacher} className="!mb-0">
              <select
                id="catalog-teacher"
                className={textInputClassName(false)}
                value={teacherId}
                onChange={(e) => onTeacherChange(e.target.value)}
              >
                <option value="">{t.allTeachers}</option>
                {teachers.map((te) => (
                  <option key={te.id} value={te.id}>
                    {ar ? te.nameAr : te.nameEn}
                  </option>
                ))}
              </select>
            </Field>
            <Field id="catalog-term" label={ar ? 'الترم' : 'Term'} className="!mb-0">
              <select
                id="catalog-term"
                className={textInputClassName(false)}
                value={term}
                onChange={(e) => onTermChange(e.target.value)}
              >
                <option value="">{ar ? 'كل الترمات' : 'All terms'}</option>
                <option value="1">{ar ? 'الترم الأول' : 'Term 1'}</option>
                <option value="2">{ar ? 'الترم الثاني' : 'Term 2'}</option>
              </select>
            </Field>
            <Field id="catalog-year" label={ar ? 'السنة الدراسية' : 'Academic year'} className="!mb-0">
              <select
                id="catalog-year"
                className={textInputClassName(false)}
                value={year}
                onChange={(e) => onYearChange(e.target.value)}
              >
                <option value="">{ar ? 'كل السنوات' : 'All years'}</option>
                {years.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </Field>
            <Field id="catalog-kind" label={ar ? 'نوع الكورس' : 'Course type'} className="!mb-0">
              <select
                id="catalog-kind"
                className={textInputClassName(false)}
                value={kind}
                onChange={(e) => onKindChange(e.target.value)}
              >
                <option value="">{ar ? 'الشرح والمراجعات' : 'Monthly and revision'}</option>
                <option value="MONTHLY_EXPLANATION">
                  {ar ? 'شرح شهري' : 'Monthly course'}
                </option>
                <option value="REVISION">{ar ? 'مراجعات' : 'Revision'}</option>
              </select>
            </Field>
          </div>
        </div>
      </Container>
    </section>
  );
}
