import { useEffect, useState } from 'react';
import { useLang } from '../../../i18n';
import { Card, Container } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { FormActions } from '../../../components/ui/FormActions';
import { EmptyState, Loading, Notice } from '../../../components/ui/Notice';
import { Money } from '../../wallet/components/Money';
import { fetchMyPurchases, fetchPurchasePage } from '../api/client';
import { packageHistoryPage, type PackageReceipt } from '../../academic/api';
import { Pagination, type PageInfo } from '../../../components/ui/Pagination';
import { displayDeadline } from '../../academic/model';
import { learningApi } from '../../learning/api/client';

export function PurchaseHistoryPage(): JSX.Element {
  const [coursePage, setCoursePage] = useState(1), [packagePage, setPackagePage] = useState(1), [pageSize, setPageSize] = useState(10);
  const [coursePaging, setCoursePaging] = useState<PageInfo>({ page: 1, pageSize: 10, total: 0 }), [packagePaging, setPackagePaging] = useState<PageInfo>({ page: 1, pageSize: 10, total: 0 });
  function changeSize(value: number) { setPageSize(value); setCoursePage(1); setPackagePage(1); }
  const { t, lang } = useLang();
  const ar = lang === 'ar';
  const [rows, setRows] = useState<Awaited<ReturnType<typeof fetchMyPurchases>>>([]);
  const [packages, setPackages] = useState<PackageReceipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  const [courseNames,setCourseNames]=useState<Record<string,{titleAr:string;titleEn:string}>>({});
  useEffect(() => {
    let live = true;
    setLoading(true);
    setFailed(false);
    void learningApi.dashboard().then(d=>{if(live)setCourseNames(Object.fromEntries([...d.active,...d.expired].map(c=>[c.courseId,c])));}).catch(()=>undefined);
    Promise.all([fetchPurchasePage(coursePage, pageSize), packageHistoryPage(packagePage, pageSize)])
      .then(([c, p]) => {
        if (live) {
          setRows(c.purchases); setCoursePaging(c.pagination); setCoursePage(c.pagination.page);
          setPackages(p.purchases); setPackagePaging(p.pagination); setPackagePage(p.pagination.page);
        }
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
  }, [retry, coursePage, packagePage, pageSize]);
  return (
    <main id="main">
      <section className="py-10">
        <Container>
          <h1 className="section-title">{t.purchaseHistory}</h1>
          {loading ? (
            <Loading text={t.loading} />
          ) : failed ? (
            <>
              <Notice kind="error">
                {ar ? 'تعذّر تحميل المشتريات.' : 'Could not load purchases.'}
              </Notice>
              <FormActions>
                <Button variant="secondary" onClick={() => setRetry((v) => v + 1)}>
                  {t.retryLabel}
                </Button>
              </FormActions>
            </>
          ) : (
            <>
              {!rows.length && !packages.length ? <EmptyState text={t.purchaseEmpty} /> : null}
              <h2 className="mt-6 text-xl font-bold">{ar ? 'إيصالات الباقات' : 'Package receipts'}</h2><ul className="mt-6 space-y-4">
                {packages.map((p) => (
                  <li key={`package-${p.id}`}>
                    <Card>
                      <h2 className="text-xl font-bold">{ar ? p.titleAr : p.titleEn}</h2>
                      <p className="my-2 font-bold">
                        <Money piastres={p.pricePiastres} />
                      </p>
                      <p className="text-sm">
                        {ar
                          ? 'عملية شراء واحدة للباقة، وليست ٣ خصومات.'
                          : 'One package payment, not three charges.'}
                      </p>
                      <ul className="my-3 list-inside list-disc">
                        {p.items.map((c) => (
                          <li key={c.courseId}>{ar ? c.titleAr : c.titleEn}</li>
                        ))}
                      </ul>
                      <p>
                        {t.validUntil}: {displayDeadline(p.endsAt, lang)} (
                        {ar ? 'القاهرة' : 'Cairo'})
                      </p>
                      <p className="mt-2 text-sm text-muted">
                        {displayDeadline(p.createdAt, lang)}
                      </p>
                    </Card>
                  </li>
                ))}
              </ul><Pagination {...packagePaging} id="package-receipts" onPage={setPackagePage} onSize={changeSize} disabled={loading} />
              <h2 className="mt-6 text-xl font-bold">{ar ? 'إيصالات الكورسات' : 'Course receipts'}</h2><ul className="mt-6 space-y-4">
                {rows.map((row) => (
                  <li key={`course-${row.id}`}>
                    <Card className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h2 className="mb-2 text-xl font-bold">{courseNames[row.courseId] ? ar?courseNames[row.courseId].titleAr:courseNames[row.courseId].titleEn : ar?'كورس غير متاح حاليًا':'Course currently unavailable'}</h2>
                        <p className="text-xs text-muted">{ar?'اسم الكورس الحالي؛ السعر والشروط أدناه من إيصال الشراء.':'Current course name; the price and terms below are from your receipt.'}</p>
                        <p className="my-2 break-all text-xs" dir="ltr">{ar?'مرجع الإيصال':'Receipt reference'}: {row.id}</p>
                        <h2 className="font-bold">
                          <Money piastres={row.pricePiastres} />
                        </h2>
                        <p className="mt-2 text-sm">
                          {row.accessMode === 'UNTIL_REMOVAL'
                            ? ar
                              ? 'بدون انتهاء، حتى الحذف النهائي للكورس'
                              : 'No expiry, until permanent course removal'
                            : row.durationDays !== null
                              ? `${row.durationDays} ${t.daysUnit}`
                              : row.accessEndsAt
                                ? `${t.validUntil}: ${displayDeadline(row.accessEndsAt, lang)}`
                                : t.planUnavailable}
                        </p>
                      </div>
                      <p className="text-sm text-muted">{displayDeadline(row.createdAt, lang)}</p>
                      {courseNames[row.courseId] ? <a href={`#/learn/${row.courseId}`} className="inline-block min-h-[44px] py-2 underline">{ar?'فتح مساحة التعلم':'Open learning space'}</a>:null}
                    </Card>
                  </li>
                ))}
              </ul>
              <Pagination {...coursePaging} id="course-receipts" onPage={setCoursePage} onSize={changeSize} disabled={loading} />
            </>
          )}
        </Container>
      </section>
    </main>
  );
}
