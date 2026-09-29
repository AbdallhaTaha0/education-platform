import { useEffect, useMemo, useState } from 'react';
import { ApiError } from '../../../auth';
import { localizeCode, useLang } from '../../../i18n';
import { Button } from '../../../components/ui/Button';
import { Card, Container } from '../../../components/ui/Card';
import { Loading, Notice, EmptyState } from '../../../components/ui/Notice';
import { fetchPublicCourses } from '../../catalog/api/client';
import { fetchWallet } from '../../wallet/api/client';
import { Money } from '../../wallet/components/Money';
import { newIdempotencyKey, purchaseCourse } from '../api/client';
import type { PurchaseReceipt } from '../types/models';

type Phase = 'loading' | 'review' | 'confirming' | 'receipt' | 'failed';

export function PurchasePage({ planId, go }: { planId: string; go: (hash: string) => void }): JSX.Element {
  const { t, lang } = useLang();
  const [phase, setPhase] = useState<Phase>('loading');
  const [price, setPrice] = useState<number | null>(null);
  const [duration, setDuration] = useState<number | null>(null);
  const [courseTitle, setCourseTitle] = useState('');
  const [balance, setBalance] = useState<number | null>(null);
  const [receipt, setReceipt] = useState<PurchaseReceipt | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const key = useMemo(() => newIdempotencyKey(), []);

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const [courses, wallet] = await Promise.all([fetchPublicCourses(), fetchWallet()]);
        if (!live) return;
        for (const course of courses) {
          const plan = course.plans.find((p) => p.id === planId);
          if (plan) {
            setPrice(plan.currentPricePiastres);
            setDuration(plan.durationDays);
            setCourseTitle(lang === 'ar' ? course.titleAr : course.titleEn);
            break;
          }
        }
        setBalance(wallet.balancePiastres);
        setPhase('review');
      } catch (err) {
        if (live) {
          setErrorCode(err instanceof ApiError ? err.code : 'SERVICE_ERROR');
          setPhase('failed');
        }
      }
    })();
    return () => {
      live = false;
    };
  }, [planId, lang]);

  async function confirm(): Promise<void> {
    if (phase === 'confirming' || phase === 'receipt') return;
    setPhase('confirming');
    setErrorCode(null);
    try {
      const created = await purchaseCourse(planId, key);
      setReceipt(created);
      setPhase('receipt');
      const wallet = await fetchWallet().catch(() => null);
      if (wallet) setBalance(wallet.balancePiastres);
    } catch (err) {
      setErrorCode(err instanceof ApiError ? err.code : 'SERVICE_ERROR');
      setPhase(err instanceof ApiError && err.code === 'INSUFFICIENT_FUNDS' ? 'review' : 'failed');
    }
  }

  if (phase === 'loading') {
    return (
      <main id="main">
        <section className="py-8"><Container><Loading text={t.loading} /></Container></section>
      </main>
    );
  }

  if (phase === 'receipt' && receipt !== null) {
    return (
      <main id="main">
        <section className="py-8">
          <Container>
            <Card className="mx-auto max-w-[640px]">
              <h1 className="text-2xl font-bold">{t.purchaseReceipt}</h1>
              <p className="mt-2">{courseTitle}</p>
              <dl className="mt-4 space-y-2">
                <div className="flex justify-between gap-4"><dt className="text-muted">{t.priceLabel}</dt><dd className="font-bold"><Money piastres={receipt.pricePiastres} /></dd></div>
                <div className="flex justify-between gap-4"><dt className="text-muted">{t.durationLabel}</dt><dd className="font-bold">{receipt.durationDays} {t.daysUnit}</dd></div>
                <div className="flex justify-between gap-4"><dt className="text-muted">{t.validUntil}</dt><dd className="font-bold">{new Date(receipt.subscription.expiresAt).toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-US')}</dd></div>
              </dl>
              <div className="mt-6 flex flex-wrap gap-3">
                <Button onClick={() => go('#/courses')}>{t.backToCourses}</Button>
                <Button variant="secondary" onClick={() => go('#/wallet')}>{t.backToWallet}</Button>
              </div>
            </Card>
          </Container>
        </section>
      </main>
    );
  }

  if (phase === 'failed') {
    return (
      <main id="main">
        <section className="py-8">
          <Container>
            <h1 className="text-2xl font-bold">{t.purchaseTitle}</h1>
            <div className="mt-4"><Notice kind="error">{localizeCode(t, errorCode ?? 'SERVICE_ERROR')}</Notice></div>
            <div className="mt-4 flex flex-wrap gap-3">
              <Button variant="secondary" onClick={() => go('#/courses')}>{t.backToCourses}</Button>
            </div>
          </Container>
        </section>
      </main>
    );
  }

  if (price === null || duration === null) {
    return (
      <main id="main">
        <section className="py-8">
          <Container>
            <h1 className="text-2xl font-bold">{t.purchaseTitle}</h1>
            <div className="mt-4"><EmptyState text={t.planUnavailable} /></div>
          </Container>
        </section>
      </main>
    );
  }

  const short = balance !== null && balance < price;

  return (
    <main id="main">
      <section className="py-8">
        <Container>
          <Card className="mx-auto max-w-[640px]">
            <h1 className="text-2xl font-bold">{t.purchaseTitle}</h1>
            <p className="mt-2">{courseTitle}</p>
            <dl className="mt-4 space-y-2">
              <div className="flex justify-between gap-4"><dt className="text-muted">{t.priceLabel}</dt><dd className="font-bold"><Money piastres={price} /></dd></div>
              <div className="flex justify-between gap-4"><dt className="text-muted">{t.durationLabel}</dt><dd className="font-bold">{duration} {t.daysUnit}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-muted">{t.walletBalance}</dt><dd className="font-bold">{balance !== null ? <Money piastres={balance} /> : '…'}</dd></div>
              {balance !== null && !short ? (
                <div className="flex justify-between gap-4"><dt className="text-muted">{t.balanceAfter}</dt><dd className="font-bold"><Money piastres={balance - price} /></dd></div>
              ) : null}
            </dl>
            {errorCode === 'INSUFFICIENT_FUNDS' ? (
              <div className="mt-4">
                <Notice kind="error">{localizeCode(t, 'INSUFFICIENT_FUNDS')}</Notice>
                <div className="mt-3">
                  <Button variant="secondary" onClick={() => go('#/wallet/recharge')}>{t.goRecharge}</Button>
                </div>
              </div>
            ) : null}
            {errorCode !== null && errorCode !== 'INSUFFICIENT_FUNDS' ? (
              <div className="mt-4"><Notice kind="error">{localizeCode(t, errorCode)}</Notice></div>
            ) : null}
            {!short ? (
              <div className="mt-6 flex flex-wrap gap-3">
                <Button onClick={() => void confirm()} disabled={phase === 'confirming'}>
                  {phase === 'confirming' ? <Loading text={t.confirming} /> : t.confirmPurchase}
                </Button>
                <Button variant="secondary" onClick={() => go('#/courses')}>{t.cancel}</Button>
              </div>
            ) : null}
          </Card>
        </Container>
      </section>
    </main>
  );
}
