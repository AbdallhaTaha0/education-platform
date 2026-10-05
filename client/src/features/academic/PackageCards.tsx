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
  term = '',
  year = '',
  query = '',
}: {
  grade?: string;
  term?: string;
  year?: string;
  query?: string;
}): JSX.Element {
  const { lang, t } = useLang();
  const ar = lang === 'ar';
  const [rows, setRows] = useState<SchoolPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
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
  }, [retry]);
  const visible = rows.filter(
    (p) =>
      (!query || `${p.titleAr} ${p.titleEn}`.toLowerCase().includes(query.toLowerCase())) &&
      (!grade || p.courses.some((c) => c.grade === grade)) &&
      (!term || p.courses.some((c) => c.term === Number(term))) &&
      (!year || p.courses.some((c) => c.academicYear === year)),
  );
  return (
    <section className="mt-10" aria-labelledby="package-heading">
      <h2 id="package-heading" className="section-title">
        {ar ? 'باقة واحدة. ٣ كورسات شهور محددة.' : 'One package. Three specified monthly courses.'}
      </h2>
      <p className="mt-2 text-muted">
        {ar
          ? 'كل باقة تضم ٣ كورسات محددة وتنتهي في موعد واحد واضح.'
          : 'Each package includes three specified courses with one clear end date.'}
      </p>
      {loading ? (
        <Loading text={t.loading} />
      ) : failed ? (
        <>
          <Notice kind="error">{ar ? 'تعذّر تحميل الباقات.' : 'Could not load packages.'}</Notice>
          <Button variant="secondary" onClick={() => setRetry((v) => v + 1)}>
            {t.retryLabel}
          </Button>
        </>
      ) : visible.length === 0 ? (
        <EmptyState
          text={ar ? 'لا توجد باقات مناسبة حاليًا.' : 'No matching packages available yet.'}
        />
      ) : null}
      <PaginatedCollection id="public-packages" resetKey={JSON.stringify([query,grade,term,year])} className="mt-5 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {!failed &&
          !loading &&
          visible.map((p) => (
            <Card key={p.id} className="flex flex-col gap-4 border-primary/50">
              <span className="text-sm font-bold text-primary-strong">
                {ar ? '٣ كورسات • دفعة واحدة' : '3 courses • One payment'}
              </span>
              <h3 className="text-2xl font-bold">{ar ? p.titleAr : p.titleEn}</h3>
              <p className="text-muted">{ar ? p.descriptionAr : p.descriptionEn}</p>
              <ol className="list-inside list-decimal space-y-2">
                {p.courses.map((c) => (
                  <li key={c.id}>
                    {ar ? c.titleAr : c.titleEn}
                    {!c.published ? (
                      <span className="block text-sm text-muted">
                        {ar
                          ? 'لم يُنشر بعد — غير متاح للمشاهدة حاليًا'
                          : 'Not published yet — unavailable to watch'}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ol>
              <p className="font-bold">{formatEgp(p.pricePiastres, lang)}</p>
              <p className="text-sm">
                {t.validUntil}: {displayDeadline(p.endsAt, lang)} ({ar ? 'القاهرة' : 'Cairo'})
              </p>
              {p.available ? (
                <a className="footer-discovery mt-auto" href={`#/package/${p.id}`}>
                  {ar ? 'عرض الباقة والاشتراك' : 'Review package and subscribe'} →
                </a>
              ) : (
                <Notice kind="info">
                  {ar
                    ? 'هذه الباقة غير متاحة للشراء حاليًا.'
                    : 'This package is currently unavailable for purchase.'}
                </Notice>
              )}
            </Card>
          ))}
      </PaginatedCollection>
    </section>
  );
}
