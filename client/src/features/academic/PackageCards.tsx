import { usePublicData } from '../../seo/publicData';
import { publicHref } from '../../seo/paths';
import { useEffect, useState } from 'react';
import { useLang } from '../../i18n';
import { Card } from '../../components/ui/Card';
import { Loading, Notice, EmptyState } from '../../components/ui/Notice';
import { Button } from '../../components/ui/Button';
import { PaginatedCollection } from '../../components/ui/Pagination';
import { formatEgp } from '../catalog/types/models';
import { displayDeadline } from './model';
import { publicPackages, type SchoolPackage } from './api';

export function PackageCards({
  grade = '',
  subjectId = '',
  teacherId = '',
  term = '',
  year = '',
  query = '',
}: {
  grade?: string;
  subjectId?: string;
  teacherId?: string;
  term?: string;
  year?: string;
  query?: string;
}): JSX.Element {
  const { lang, t } = useLang();
  const ar = lang === 'ar';
  const initial = usePublicData()?.packages;
  const [rows, setRows] = useState<SchoolPackage[]>(initial ?? []);
  const [loading, setLoading] = useState(initial === undefined);
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    if (initial !== undefined && retry === 0) return;
    let live = true;
    setLoading(true);
    setFailed(false);
    publicPackages()
      .then((data) => {
        if (live) setRows(data);
      })
      .catch(() => {
        if (live) setFailed(true);
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [retry, initial]);

  const visible = rows.filter(
    (p) =>
      (!query || `${p.titleAr} ${p.titleEn}`.toLowerCase().includes(query.toLowerCase())) &&
      (!grade || p.courses.some((c) => c.grade === grade)) &&
      (!subjectId ||
        p.subject?.id === subjectId ||
        p.courses.some((c) => c.subject?.id === subjectId)) &&
      (!teacherId ||
        p.teacher?.id === teacherId ||
        p.courses.some((c) => c.teacher?.id === teacherId)) &&
      (!term || p.courses.some((c) => c.term === Number(term))) &&
      (!year || p.courses.some((c) => c.academicYear === year)),
  );

  return (
    <section className="mt-12 border-t border-border/70 pt-10 text-start" aria-labelledby="package-heading">
      <h2 id="package-heading" className="section-title text-ink">
        {ar ? 'باقة واحدة. ٣ كورسات شهور محددة.' : 'One package. Three specified monthly courses.'}
      </h2>
      <p className="mt-2 text-sm text-muted sm:text-base">
        {ar
          ? 'كل باقة تضم ٣ كورسات محددة وتنتهي في موعد واحد واضح.'
          : 'Each package includes three specified courses with one clear end date.'}
      </p>
      {loading ? (
        <div className="mt-4">
          <Loading text={t.loading} />
        </div>
      ) : failed ? (
        <div className="mt-4">
          <Notice kind="error">{ar ? 'تعذّر تحميل الباقات.' : 'Could not load packages.'}</Notice>
          <Button variant="secondary" onClick={() => setRetry((v) => v + 1)}>
            {t.retryLabel}
          </Button>
        </div>
      ) : visible.length === 0 ? (
        <div className="mt-4">
          <EmptyState
            text={ar ? 'لا توجد باقات مناسبة حاليًا.' : 'No matching packages available yet.'}
          />
        </div>
      ) : null}
      <PaginatedCollection
        id="public-packages"
        resetKey={JSON.stringify([query, grade, subjectId, teacherId, term, year])}
        className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3"
      >
        {!failed &&
          !loading &&
          visible.map((p) => (
            <Card
              key={p.id}
              className="flex h-full flex-col gap-3 rounded-2xl border-border bg-surface !p-5 text-start transition-[border-color,transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:border-primary/70 hover:shadow-lift"
            >
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="inline-flex items-center rounded-full border border-border-strong bg-field px-2.5 py-0.5 text-xs font-bold text-ink">
                  {ar ? '٣ كورسات · دفعة واحدة' : '3 courses · One payment'}
                </span>
                {p.subject ? (
                  <span className="inline-flex items-center rounded-full border border-primary/30 bg-primary/15 px-2.5 py-0.5 text-xs font-bold text-primary-strong">
                    {ar ? p.subject.nameAr : p.subject.nameEn}
                  </span>
                ) : null}
                {p.teacher ? (
                  <span className="inline-flex items-center rounded-full border border-border bg-elevated px-2.5 py-0.5 text-xs font-semibold text-ink">
                    {ar ? p.teacher.nameAr : p.teacher.nameEn}
                  </span>
                ) : null}
              </div>
              <h3 className="text-balance text-xl font-extrabold leading-snug text-ink">
                {ar ? p.titleAr : p.titleEn}
              </h3>
              <p className="text-pretty text-sm leading-relaxed text-muted">
                {ar ? p.descriptionAr : p.descriptionEn}
              </p>
              <ol className="list-inside list-decimal space-y-1.5 rounded-xl border border-border/70 bg-field/70 p-3.5 text-sm text-ink">
                {p.courses.map((c) => (
                  <li key={c.id} className="leading-snug">
                    <span className="font-semibold">{ar ? c.titleAr : c.titleEn}</span>
                    {!c.published ? (
                      <span className="mt-0.5 block text-xs text-muted">
                        {ar
                          ? 'لم يُنشر بعد — غير متاح للمشاهدة حاليًا'
                          : 'Not published yet — unavailable to watch'}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ol>
              <div className="mt-auto space-y-2.5 border-t border-border/60 pt-3.5 tabular-nums">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-xl font-extrabold text-ink">
                    {formatEgp(p.pricePiastres, lang)}
                  </p>
                  <p className="text-xs font-semibold text-muted">
                    {t.validUntil}: {displayDeadline(p.endsAt, lang)} ({ar ? 'القاهرة' : 'Cairo'})
                  </p>
                </div>
                {p.available ? (
                  <a
                    className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2 text-sm font-bold text-primary-ink no-underline transition-colors hover:bg-primary-hover"
                    href={publicHref(`#/package/${p.id}`, lang)}
                  >
                    <span>{ar ? 'عرض الباقة والاشتراك' : 'Review package and subscribe'}</span>
                    <span className="inline-block rtl:rotate-180" aria-hidden="true">→</span>
                  </a>
                ) : (
                  <Notice kind="info">
                    {ar
                      ? 'هذه الباقة غير متاحة للشراء حاليًا.'
                      : 'This package is currently unavailable for purchase.'}
                  </Notice>
                )}
              </div>
            </Card>
          ))}
      </PaginatedCollection>
    </section>
  );
}
