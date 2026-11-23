import { useEffect, useState } from 'react';
import { useAuth } from '../../../auth';
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
  const { status, user } = useAuth();
  const [coursePage, setCoursePage] = useState(1);
  const [packagePage, setPackagePage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [coursePaging, setCoursePaging] = useState<PageInfo>({ page: 1, pageSize: 10, total: 0 });
  const [packagePaging, setPackagePaging] = useState<PageInfo>({ page: 1, pageSize: 10, total: 0 });

  function changeSize(value: number): void {
    setPageSize(value);
    setCoursePage(1);
    setPackagePage(1);
  }

  const { t, lang } = useLang();
  const ar = lang === 'ar';
  const [rows, setRows] = useState<Awaited<ReturnType<typeof fetchMyPurchases>>>([]);
  const [packages, setPackages] = useState<PackageReceipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  const [courseNames, setCourseNames] = useState<
    Record<string, { titleAr: string; titleEn: string }>
  >({});

  useEffect(() => {
    if (status !== 'authenticated' || !user) {
      setLoading(status === 'loading');
      return;
    }
    let live = true;
    setLoading(true);
    setFailed(false);
    void learningApi
      .dashboard()
      .then((d) => {
        if (live) {
          setCourseNames(Object.fromEntries([...d.active, ...d.expired].map((c) => [c.courseId, c])));
        }
      })
      .catch(() => undefined);
    Promise.all([fetchPurchasePage(coursePage, pageSize), packageHistoryPage(packagePage, pageSize)])
      .then(([c, p]) => {
        if (live) {
          setRows(c.purchases);
          setCoursePaging(c.pagination);
          setCoursePage(c.pagination.page);
          setPackages(p.purchases);
          setPackagePaging(p.pagination);
          setPackagePage(p.pagination.page);
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
  }, [status, user, retry, coursePage, packagePage, pageSize]);

  if (status === 'anonymous' || (status !== 'loading' && !user)) {
    return (
      <main id="main">
        <section className="py-10">
          <Container>
            <div className="mx-auto max-w-[560px] rounded-2xl border border-border bg-surface p-6 text-start shadow-rest">
              <h1 className="section-title text-ink">{t.purchaseHistory}</h1>
              <div className="mt-4">
                <Notice kind="info">{t.needLogin}</Notice>
                <FormActions className="mt-3">
                  <Button
                    variant="primary"
                    onClick={() => {
                      window.location.hash = '#/login';
                    }}
                  >
                    {t.navLogin}
                  </Button>
                </FormActions>
              </div>
            </div>
          </Container>
        </section>
      </main>
    );
  }

  return (
    <main id="main">
      <section className="py-6 text-start md:py-8">
        <Container>
          <p className="text-xs font-extrabold text-primary-strong">
            {ar ? 'إيصالاتي واشتراكاتي' : 'Receipts & orders'}
          </p>
          <h1 className="mt-1 section-title text-ink">{t.purchaseHistory}</h1>
          {loading ? (
            <div className="mt-4">
              <Loading text={t.loading} />
            </div>
          ) : failed ? (
            <div className="mt-4">
              <Notice kind="error">
                {ar ? 'تعذّر تحميل المشتريات.' : 'Could not load purchases.'}
              </Notice>
              <FormActions>
                <Button variant="secondary" onClick={() => setRetry((v) => v + 1)}>
                  {t.retryLabel}
                </Button>
              </FormActions>
            </div>
          ) : (
            <>
              {!rows.length && !packages.length ? (
                <div className="mt-4">
                  <EmptyState text={t.purchaseEmpty} />
                </div>
              ) : null}

              <h2 className="mt-6 text-lg font-extrabold text-ink">
                {ar ? 'إيصالات الباقات' : 'Package receipts'}
              </h2>
              <ul className="mt-3 space-y-4">
                {packages.map((p) => (
                  <li key={`package-${p.id}`}>
                    <Card className="rounded-2xl border-border bg-surface !p-5 tabular-nums">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <span className="inline-flex rounded-full border border-border-strong bg-field px-2.5 py-0.5 text-xs font-bold text-ink">
                            {ar ? 'عملية شراء واحدة للباقة' : 'Single package payment'}
                          </span>
                          <h3 className="mt-2 text-lg font-extrabold text-ink">
                            {ar ? p.titleAr : p.titleEn}
                          </h3>
                        </div>
                        <p className="text-xl font-extrabold text-primary-strong">
                          <Money piastres={p.pricePiastres} />
                        </p>
                      </div>
                      <p className="mt-2 text-xs text-muted">
                        {ar
                          ? 'عملية شراء واحدة للباقة، وليست ٣ خصومات.'
                          : 'One package payment, not three charges.'}
                      </p>
                      <ul className="my-3 list-inside list-disc space-y-1 rounded-xl border border-border/70 bg-field/60 p-3 text-sm text-ink">
                        {p.items.map((c) => (
                          <li key={c.courseId}>{ar ? c.titleAr : c.titleEn}</li>
                        ))}
                      </ul>
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted sm:text-sm">
                        <p className="font-semibold text-ink">
                          {t.validUntil}: {displayDeadline(p.endsAt, lang)} ({ar ? 'القاهرة' : 'Cairo'})
                        </p>
                        <p>{displayDeadline(p.createdAt, lang)}</p>
                      </div>
                    </Card>
                  </li>
                ))}
              </ul>
              <Pagination
                {...packagePaging}
                id="package-receipts"
                onPage={setPackagePage}
                onSize={changeSize}
                disabled={loading}
              />

              <h2 className="mt-8 text-lg font-extrabold text-ink">
                {ar ? 'إيصالات الكورسات' : 'Course receipts'}
              </h2>
              <ul className="mt-3 space-y-4">
                {rows.map((row) => {
                  const subjectName = ar ? row.subjectNameAr : row.subjectNameEn;
                  const teacherName = ar ? row.teacherNameAr : row.teacherNameEn;
                  return (
                    <li key={`course-${row.id}`}>
                      <Card className="rounded-2xl border-border bg-surface !p-5 tabular-nums">
                        <div className="flex flex-wrap items-start justify-between gap-4">
                          <div className="min-w-0 flex-1">
                            {subjectName || teacherName ? (
                              <div className="mb-2 flex flex-wrap items-center gap-1.5">
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
                              </div>
                            ) : null}
                            <h3 className="text-lg font-extrabold text-ink">
                              {courseNames[row.courseId]
                                ? ar
                                  ? courseNames[row.courseId].titleAr
                                  : courseNames[row.courseId].titleEn
                                : ar
                                  ? 'كورس غير متاح حاليًا'
                                  : 'Course currently unavailable'}
                            </h3>
                            <p className="mt-1 text-xs text-muted">
                              {ar
                                ? 'اسم الكورس الحالي؛ السعر والشروط أدناه من إيصال الشراء.'
                                : 'Current course name; the price and terms below are from your receipt.'}
                            </p>
                            <p className="mt-1.5 break-all font-mono text-xs text-muted" dir="ltr">
                              {ar ? 'مرجع الإيصال' : 'Receipt reference'}: {row.id}
                            </p>
                          </div>
                          <div className="text-end">
                            <p className="text-xl font-extrabold text-primary-strong">
                              <Money piastres={row.pricePiastres} />
                            </p>
                            <p className="mt-1 text-xs text-muted">
                              {displayDeadline(row.createdAt, lang)}
                            </p>
                          </div>
                        </div>

                        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border/70 pt-3.5">
                          <p className="text-sm font-semibold text-ink">
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
                          {courseNames[row.courseId] ? (
                            <a
                              href={`#/learn/${row.courseId}`}
                              className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-ink no-underline transition-colors hover:bg-primary-hover"
                            >
                              {ar ? 'فتح مساحة التعلم' : 'Open learning space'}
                            </a>
                          ) : null}
                        </div>
                      </Card>
                    </li>
                  );
                })}
              </ul>
              <Pagination
                {...coursePaging}
                id="course-receipts"
                onPage={setCoursePage}
                onSize={changeSize}
                disabled={loading}
              />
            </>
          )}
        </Container>
      </section>
    </main>
  );
}
