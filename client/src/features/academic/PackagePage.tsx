import { usePublicData } from '../../seo/publicData';
import { publicHref } from '../../seo/paths';
import { useCallback, useEffect, useState } from 'react';
import { apiFetch, ApiError, useAuth } from '../../auth';
import { useLang } from '../../i18n';
import { Card, Container } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { FormActions } from '../../components/ui/FormActions';
import { Loading, Notice } from '../../components/ui/Notice';
import { fetchWallet } from '../wallet/api/client';
import { formatEgp } from '../catalog/types/models';
import { newIdempotencyKey } from '../../utils';
import { buySchoolPackage, packageReview, type SchoolPackage, type PackageReceipt } from './api';
import { displayDeadline } from './model';

export function PackagePage({ id }: { id: string }): JSX.Element {
  const { lang, t } = useLang();
  const ar = lang === 'ar';
  const { status, user } = useAuth();
  const seed = usePublicData()?.pkg;
  const initial = seed?.id === id ? seed : undefined;
  const [pkg, setPkg] = useState<SchoolPackage | null>(initial ?? null);
  const [review, setReview] = useState<Awaited<ReturnType<typeof packageReview>> | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [receipt, setReceipt] = useState<PackageReceipt | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(initial === undefined);
  const [busy, setBusy] = useState(false);
  const [key] = useState(newIdempotencyKey);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    setReview(null);
    try {
      const row = (
        await apiFetch<{ data: { package: SchoolPackage } }>(
          `/catalog/packages/${encodeURIComponent(id)}`,
          { retryOnAuth: false },
        )
      ).data.package;
      setPkg(row);
      if (status === 'authenticated' && user?.role === 'STUDENT') {
        const [r, w] = await Promise.all([packageReview(id), fetchWallet()]);
        if (r.version !== row.version) throw new Error('OFFER_CHANGED');
        setReview(r);
        setBalance(w.balancePiastres);
      }
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.code
          : err instanceof Error && err.message === 'OFFER_CHANGED'
            ? 'OFFER_CHANGED'
            : 'SERVICE_ERROR',
      );
    } finally {
      setLoading(false);
    }
  }, [id, status, user?.role]);

  useEffect(() => {
    if (status !== 'loading') void load();
  }, [load, status]);

  async function buy(): Promise<void> {
    if (busy || !review || !pkg || !pkg.available) return;
    setBusy(true);
    setError('');
    try {
      setReceipt(await buySchoolPackage(pkg.id, review.version, key));
    } catch (err) {
      setError(err instanceof ApiError ? err.code : 'SERVICE_ERROR');
    } finally {
      setBusy(false);
    }
  }

  const message =
    error === 'OFFER_CHANGED'
      ? ar
        ? 'العرض اتغيّر. راجع السعر والشروط الجديدة قبل الشراء.'
        : 'The offer changed. Review the new price and terms before purchase.'
      : error === 'INSUFFICIENT_FUNDS'
        ? ar
          ? 'رصيدك غير كافٍ. اشحن المحفظة أولًا.'
          : 'Your balance is insufficient. Recharge your wallet first.'
        : error
          ? ar
            ? 'تعذّر إكمال الطلب. حاول مرة أخرى.'
            : 'Could not complete the request. Please retry.'
          : '';

  return (
    <main id="main">
      <Container>
        <section className="py-7 md:py-10">
          <nav
            aria-label={ar ? 'مسار الصفحة' : 'Breadcrumb'}
            className="mb-5 flex flex-wrap items-center gap-2 text-sm text-muted"
          >
            <a href={publicHref('#/courses', lang)} className="footer-discovery">
              ← {t.navCourses}
            </a>
            {pkg ? (
              <span aria-current="page" className="font-semibold text-ink">
                / {ar ? pkg.titleAr : pkg.titleEn}
              </span>
            ) : null}
          </nav>

          {loading ? <Loading text={t.loading} /> : null}
          {error ? (
            <div className="mb-4">
              <Notice kind="error">{message}</Notice>
              {error === 'OFFER_CHANGED' ? (
                <Button variant="secondary" onClick={() => void load()}>
                  {t.retryLabel}
                </Button>
              ) : null}
            </div>
          ) : null}

          {receipt ? (
            <Card className="mx-auto mt-6 max-w-2xl rounded-2xl border-border-strong bg-surface !p-6 text-start shadow-lift">
              <p className="inline-flex rounded-full border border-success-fg/40 bg-success-bg px-3 py-1 text-xs font-extrabold text-success-fg">
                {ar ? 'تم الاشتراك بنجاح' : 'Purchase complete'}
              </p>
              <h1 className="mt-3 text-2xl font-extrabold text-ink sm:text-3xl">
                {ar ? 'الباقة بقت في حسابك' : 'Your package is ready'}
              </h1>
              <p className="mt-2 text-base font-semibold text-ink">
                {ar ? receipt.titleAr : receipt.titleEn}
              </p>
              <div className="mt-4 flex flex-wrap gap-4 rounded-xl border border-border bg-field p-4 tabular-nums">
                <div>
                  <span className="block text-xs text-muted">{t.priceLabel}</span>
                  <strong className="text-lg font-extrabold text-ink">
                    {formatEgp(receipt.pricePiastres, lang)}
                  </strong>
                </div>
                <div>
                  <span className="block text-xs text-muted">{t.validUntil}</span>
                  <strong className="text-sm font-bold text-ink">
                    {displayDeadline(receipt.endsAt, lang)} ({ar ? 'القاهرة' : 'Cairo'})
                  </strong>
                </div>
              </div>
              <ul className="my-5 list-inside list-disc space-y-2 text-sm text-ink">
                {receipt.items.map((c) => (
                  <li key={c.courseId}>{ar ? c.titleAr : c.titleEn}</li>
                ))}
              </ul>
              <a
                href="#/dashboard"
                className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-primary px-6 py-2.5 text-base font-extrabold text-primary-ink no-underline transition-colors hover:bg-primary-hover"
              >
                <span>{ar ? 'اذهب إلى تعلّمي' : 'Go to My learning'}</span>
                <span className="inline-block rtl:rotate-180" aria-hidden="true">→</span>
              </a>
            </Card>
          ) : !loading && pkg ? (
            <div className="grid items-start gap-7 lg:grid-cols-[1.35fr_0.85fr] lg:gap-8">
              <Card className="rounded-2xl border-border bg-surface !p-5 text-start sm:!p-6">
                <p className="text-sm font-bold text-primary-strong">
                  {ar ? 'ثلاثة كورسات. عملية شراء واحدة.' : 'Three courses. One purchase.'}
                </p>
                {pkg.subject || pkg.teacher ? (
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                    {pkg.subject ? (
                      <span className="rounded-full border border-primary/40 bg-primary/15 px-3 py-1 font-bold text-primary-strong">
                        {t.subject}: {ar ? pkg.subject.nameAr : pkg.subject.nameEn}
                      </span>
                    ) : null}
                    {pkg.teacher ? (
                      <span className="rounded-full border border-border-strong bg-elevated px-3 py-1 font-semibold text-ink">
                        {t.teacher}: {ar ? pkg.teacher.nameAr : pkg.teacher.nameEn}
                      </span>
                    ) : null}
                  </div>
                ) : null}
                <h1 className="mt-3 text-balance text-2xl font-extrabold text-ink sm:text-3xl">
                  {ar ? pkg.titleAr : pkg.titleEn}
                </h1>
                <p className="mt-3 text-base leading-relaxed text-muted">
                  {ar ? pkg.descriptionAr : pkg.descriptionEn}
                </p>
                {pkg.teacher && (ar ? pkg.teacher.bioAr : pkg.teacher.bioEn) ? (
                  <div className="mt-4 rounded-xl border border-border bg-elevated/60 px-4 py-3 text-sm leading-relaxed text-muted">
                    <strong className="mb-1 block text-ink">{t.teacherBio}</strong>
                    {ar ? pkg.teacher.bioAr : pkg.teacher.bioEn}
                  </div>
                ) : null}

                <div className="mt-6 border-t border-border/70 pt-5">
                  <h2 className="text-base font-extrabold text-ink">
                    {ar ? 'الكورسات المشمولة في الباقة' : 'Included courses in this package'}
                  </h2>
                  <ol className="mt-3 space-y-3">
                    {pkg.courses.map((c, idx) => (
                      <li
                        key={c.id}
                        className="rounded-xl border border-border bg-field/80 p-3.5 text-sm"
                      >
                        <div className="flex items-start gap-3">
                          <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-xs font-extrabold text-primary-strong">
                            {ar ? ['١', '٢', '٣'][idx] ?? idx + 1 : idx + 1}
                          </span>
                          <div className="min-w-0 flex-1">
                            {c.published ? (
                              <a
                                className="font-bold text-ink underline underline-offset-4 hover:text-primary-strong"
                                href={publicHref('#/courses/' + encodeURIComponent(c.slug), lang)}
                              >
                                {ar ? c.titleAr : c.titleEn}
                              </a>
                            ) : (
                              <span className="font-bold text-ink">
                                {ar ? c.titleAr : c.titleEn}
                              </span>
                            )}
                            {!c.published ? (
                              <div className="mt-2">
                                <Notice kind="info">
                                  {ar
                                    ? 'الكورس لم يُنشر بعد ولن يكون متاحًا للمشاهدة حتى نشره. موعد انتهاء الباقة لا يتغيّر.'
                                    : 'This course is not published and cannot be watched until publication. The package end date stays the same.'}
                                </Notice>
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ol>
                </div>

                {review?.warnings.length ? (
                  <div className="mt-5">
                    <Notice kind="info">
                      {ar
                        ? 'عندك وصول ساري لبعض كورسات الباقة. تقدر تشتريها بالسعر الموضّح؛ اشتراكك السابق لن يتقصّر.'
                        : 'You already have access to some included courses. You may buy at the displayed price; existing longer access is preserved.'}
                    </Notice>
                  </div>
                ) : null}
              </Card>

              <aside className="min-w-0 lg:sticky lg:top-24">
                <Card className="rounded-2xl border-border-strong bg-surface !p-5 text-start shadow-lift tabular-nums sm:!p-6">
                  <p className="text-xs font-extrabold uppercase tracking-wide text-primary-strong">
                    {ar ? 'ملخص الباقة والاشتراك' : 'Package summary'}
                  </p>
                  <dl className="mt-4 divide-y divide-border/70">
                    <div className="pb-3">
                      <dt className="text-xs font-semibold text-muted">{t.priceLabel}</dt>
                      <dd className="mt-1 text-2xl font-extrabold text-ink">
                        {formatEgp(pkg.pricePiastres, lang)}
                      </dd>
                    </div>
                    <div className="py-3">
                      <dt className="text-xs font-semibold text-muted">
                        {ar ? 'كل الكورسات تنتهي معًا' : 'All included courses end together'}
                      </dt>
                      <dd className="mt-1 text-sm font-bold text-ink">
                        {displayDeadline(pkg.endsAt, lang)} ({ar ? 'القاهرة' : 'Cairo'})
                      </dd>
                    </div>
                    {balance !== null ? (
                      <div className="pt-3">
                        <dt className="text-xs font-semibold text-muted">{t.walletBalance}</dt>
                        <dd className="mt-1 text-base font-extrabold text-ink">
                          {formatEgp(balance, lang)}
                        </dd>
                      </div>
                    ) : null}
                  </dl>

                  <div className="mt-5">
                    {status === 'anonymous' ? (
                      <a
                        className="inline-flex min-h-[48px] w-full items-center justify-center rounded-xl bg-primary px-6 py-2.5 text-base font-extrabold text-primary-ink no-underline transition-colors hover:bg-primary-hover"
                        href="#/login"
                      >
                        {t.needLogin}
                      </a>
                    ) : user?.role === 'ADMIN' ? (
                      <Notice kind="info">
                        {ar
                          ? 'شراء الباقات متاح لحسابات الطلاب.'
                          : 'Package purchases are available to student accounts.'}
                      </Notice>
                    ) : !pkg.available ? (
                      <Notice kind="info">
                        {ar
                          ? 'الباقة غير متاحة للشراء حاليًا.'
                          : 'This package cannot currently be purchased.'}
                      </Notice>
                    ) : balance !== null && balance < pkg.pricePiastres ? (
                      <a
                        href="#/wallet/recharge"
                        className="inline-flex min-h-[48px] w-full items-center justify-center rounded-xl bg-primary px-6 py-2.5 text-base font-extrabold text-primary-ink no-underline transition-colors hover:bg-primary-hover"
                      >
                        {t.goRecharge}
                      </a>
                    ) : (
                      <FormActions className="!mt-2">
                        <Button
                          className="w-full"
                          disabled={busy || !review}
                          disabledReason={
                            busy
                              ? undefined
                              : {
                                  ar: 'انتظر تحميل مراجعة الباقة قبل تأكيد الشراء.',
                                  en: 'Wait for the package review to load before confirming purchase.',
                                }
                          }
                          onClick={() => void buy()}
                        >
                          {busy
                            ? t.loading
                            : ar
                              ? 'تأكيد شراء الباقة'
                              : 'Confirm package purchase'}
                        </Button>
                      </FormActions>
                    )}
                  </div>
                </Card>
              </aside>
            </div>
          ) : null}
        </section>
      </Container>
    </main>
  );
}
