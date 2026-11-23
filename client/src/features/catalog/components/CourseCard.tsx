import { publicHref } from '../../../seo/paths';
import { Card } from '../../../components/ui/Card';
import { gradeLabel } from '../../academic/model';
import type { Lang } from '../../../i18n';
import type { PublicCourse } from '../types/models';
import { CourseCover } from './CourseCover';
import { PriceDisplay } from './PriceDisplay';

export function CourseCard({
  course,
  lang,
  compact = false,
}: {
  course: PublicCourse;
  lang: Lang;
  compact?: boolean;
}): JSX.Element {
  const title = lang === 'ar' ? course.titleAr : course.titleEn;
  const description = lang === 'ar' ? course.descriptionAr : course.descriptionEn;
  const subjectName = course.subject ? (lang === 'ar' ? course.subject.nameAr : course.subject.nameEn) : null;
  const teacherName = course.teacher ? (lang === 'ar' ? course.teacher.nameAr : course.teacher.nameEn) : null;
  const kindOrMonth =
    course.academic?.courseKind === 'REVISION'
      ? lang === 'ar'
        ? 'مراجعة'
        : 'Revision'
      : course.academic?.teachingMonth ?? null;

  return (
    <article className="h-full">
      <Card className="group relative flex h-full flex-col gap-3 overflow-hidden rounded-2xl border-border bg-surface !p-3.5 text-start transition-[border-color,transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:border-primary/70 hover:shadow-lift">
        <div className="relative overflow-hidden rounded-xl">
          <CourseCover path={course.coverUrl} title={title} />
          {course.academic?.grade ? (
            <span className="pointer-events-none absolute start-2.5 top-2.5 inline-flex items-center gap-1.5 rounded-lg border border-border-strong bg-canvas/95 px-2.5 py-1 text-xs font-bold text-ink shadow-rest backdrop-blur-md">
              {gradeLabel(course.academic.grade, lang)}
              {course.academic.term ? ` · ${lang === 'ar' ? 'ترم' : 'Term'} ${course.academic.term}` : ''}
            </span>
          ) : null}
        </div>
        <div className="flex flex-1 flex-col gap-2.5 px-1 pt-0.5">
          {subjectName || teacherName || kindOrMonth ? (
            <div className="flex flex-wrap items-center gap-1.5">
              {subjectName ? (
                <span className="inline-flex items-center rounded-full border border-primary/30 bg-primary/15 px-2.5 py-0.5 text-xs font-bold text-primary-strong">
                  {subjectName}
                </span>
              ) : null}
              {teacherName ? (
                <span className="inline-flex items-center rounded-full border border-border bg-elevated px-2.5 py-0.5 text-xs font-semibold text-ink">
                  {teacherName}
                </span>
              ) : null}
              {kindOrMonth ? (
                <span className="inline-flex items-center rounded-full border border-border/80 bg-field px-2.5 py-0.5 text-xs font-semibold text-muted">
                  {kindOrMonth}
                </span>
              ) : null}
            </div>
          ) : null}
          <h3 className="m-0 text-balance text-lg font-extrabold leading-snug text-ink">{title}</h3>
          <p className="line-clamp-2 text-pretty text-sm leading-relaxed text-muted">{description}</p>
          <div className="mt-auto flex flex-col gap-3 border-t border-border/60 pt-3 tabular-nums">
            {course.plans[0] !== undefined ? (
              <PriceDisplay
                current={course.plans[0].currentPricePiastres}
                previous={course.plans[0].previousPricePiastres}
                durationDays={course.plans[0].durationDays}
                accessMode={course.plans[0].accessMode}
                accessEndsAt={course.plans[0].accessEndsAt}
              />
            ) : null}
            <a
              href={publicHref(`#/courses/${encodeURIComponent(course.slug)}`, lang)}
              aria-label={(lang === 'ar' ? 'عرض العرض: ' : 'View offer: ') + title}
              className="inline-flex min-h-[44px] w-full items-center justify-center rounded-xl bg-primary px-5 py-2 text-sm font-bold text-primary-ink no-underline transition-colors duration-150 hover:bg-primary-hover"
            >
              {compact
                ? lang === 'ar'
                  ? 'تفاصيل الدورة'
                  : 'Course details'
                : lang === 'ar'
                  ? 'عرض العرض'
                  : 'View offer'}
            </a>
          </div>
        </div>
      </Card>
    </article>
  );
}
