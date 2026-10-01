import { useCallback, useEffect, useState } from 'react';
import { apiFetch, ApiError, useAuth } from '../../auth';
import { useLang } from '../../i18n';
import { Card, Container } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
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
  const [pkg, setPkg] = useState<SchoolPackage | null>(null);
  const [review, setReview] = useState<Awaited<ReturnType<typeof packageReview>> | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [receipt, setReceipt] = useState<PackageReceipt | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
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
  async function buy() {
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
        <section className="py-10">
          <a href="#/courses" className="footer-discovery">
            ← {t.navCourses}
          </a>
          {loading ? <Loading text={t.loading} /> : null}
          {error ? (
            <>
              <Notice kind="error">{message}</Notice>
              {error === 'OFFER_CHANGED' ? (
                <Button variant="secondary" onClick={() => void load()}>
                  {t.retryLabel}
                </Button>
              ) : null}
            </>
          ) : null}
          {receipt ? (
            <Card className="mx-auto mt-6 max-w-[760px]">
              <h1 className="text-3xl font-bold">
                {ar ? 'الباقة بقت في حسابك' : 'Your package is ready'}
              </h1>
              <p className="mt-3">{ar ? receipt.titleAr : receipt.titleEn}</p>
              <p className="mt-2 font-bold">{formatEgp(receipt.pricePiastres, lang)}</p>
              <p className="mt-2">
                {t.validUntil}: {displayDeadline(receipt.endsAt, lang)} ({ar ? 'القاهرة' : 'Cairo'})
              </p>
              <ul className="my-5 list-inside list-disc">
                {receipt.items.map((c) => (
                  <li key={c.courseId}>{ar ? c.titleAr : c.titleEn}</li>
                ))}
              </ul>
              <a href="#/dashboard" className="footer-discovery">
                {ar ? 'اذهب إلى تعلّمي' : 'Go to My learning'} →
              </a>
            </Card>
          ) : !loading && pkg ? (
            <Card className="mx-auto mt-6 max-w-[760px]">
              <p className="text-sm font-bold text-primary-strong">
                {ar ? 'ثلاثة كورسات. عملية شراء واحدة.' : 'Three courses. One purchase.'}
              </p>
              <h1 className="mt-3 text-3xl font-bold">{ar ? pkg.titleAr : pkg.titleEn}</h1>
              <p className="mt-3 text-muted">{ar ? pkg.descriptionAr : pkg.descriptionEn}</p>
              <ol className="my-5 list-inside list-decimal space-y-3">
                {pkg.courses.map((c) => (
                  <li key={c.id}>
                    {ar ? c.titleAr : c.titleEn}
                    {!c.published ? (
                      <Notice kind="info">
                        {ar
                          ? 'الكورس لم يُنشر بعد ولن يكون متاحًا للمشاهدة حتى نشره. موعد انتهاء الباقة لا يتغيّر.'
                          : 'This course is not published and cannot be watched until publication. The package end date stays the same.'}
                      </Notice>
                    ) : null}
                  </li>
                ))}
              </ol>
              {review?.warnings.length ? (
                <Notice kind="info">
                  {ar
                    ? 'عندك وصول ساري لبعض كورسات الباقة. تقدر تشتريها بالسعر الموضّح؛ اشتراكك السابق لن يتقصّر.'
                    : 'You already have access to some included courses. You may buy at the displayed price; existing longer access is preserved.'}
                </Notice>
              ) : null}
              <dl className="my-5 space-y-3">
                <div>
                  <dt className="text-muted">{t.priceLabel}</dt>
                  <dd className="text-2xl font-bold">{formatEgp(pkg.pricePiastres, lang)}</dd>
                </div>
                <div>
                  <dt className="text-muted">
                    {ar ? 'كل الكورسات تنتهي معًا' : 'All included courses end together'}
                  </dt>
                  <dd>
                    {displayDeadline(pkg.endsAt, lang)} ({ar ? 'القاهرة' : 'Cairo'})
                  </dd>
                </div>
                {balance !== null ? (
                  <div>
                    <dt className="text-muted">{t.walletBalance}</dt>
                    <dd>{formatEgp(balance, lang)}</dd>
                  </div>
                ) : null}
              </dl>
              {status === 'anonymous' ? (
                <a className="footer-discovery" href="#/login">
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
                <a href="#/wallet/recharge" className="footer-discovery">
                  {t.goRecharge}
                </a>
              ) : (
                <Button disabled={busy || !review} onClick={() => void buy()}>
                  {busy ? t.loading : ar ? 'تأكيد شراء الباقة' : 'Confirm package purchase'}
                </Button>
              )}
            </Card>
          ) : null}
        </section>
      </Container>
    </main>
  );
}
