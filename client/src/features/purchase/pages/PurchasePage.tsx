import { useEffect, useMemo, useState } from 'react';
import { ApiError, useAuth } from '../../../auth';
import { purchaseLoginHash } from '../loginRedirect';
import { localizeCode, useLang } from '../../../i18n';
import { Button } from '../../../components/ui/Button';
import { FormActions } from '../../../components/ui/FormActions';
import { Card, Container } from '../../../components/ui/Card';
import { Loading, Notice, EmptyState } from '../../../components/ui/Notice';
import { fetchPublicCourses } from '../../catalog/api/client';
import { fetchWallet } from '../../wallet/api/client';
import { Money } from '../../wallet/components/Money';
import { fetchMySubscriptions, newIdempotencyKey, purchaseCourse } from '../api/client';
import type { PurchaseReceipt } from '../types/models';
import { displayDeadline, type AccessMode } from '../../academic/model';

type Phase = 'loading' | 'review' | 'confirming' | 'receipt' | 'failed';

export function PurchasePage({
  planId,
  go,
}: {
  planId: string;
  go: (hash: string) => void;
}): JSX.Element {
  const { t, lang } = useLang();
  const ar = lang === 'ar';
  const { status } = useAuth();
  const [phase, setPhase] = useState<Phase>('loading');
  const [price, setPrice] = useState<number | null>(null);
  const [duration, setDuration] = useState<number | null>(null);
  const [mode, setMode] = useState<AccessMode>('DURATION');
  const [deadline, setDeadline] = useState<string | null>(null);
  const [courseTitle, setCourseTitle] = useState('');
  const [courseId, setCourseId] = useState('');
  const [balance, setBalance] = useState<number | null>(null);
  const [receipt, setReceipt] = useState<PurchaseReceipt | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const key = useMemo(() => newIdempotencyKey(), []);

  useEffect(() => {
    if (status === 'loading') return;
    if (status === 'anonymous') {
      go(purchaseLoginHash(planId));
      return;
    }
    let live = true;
    (async () => {
      try {
        const [courses, wallet, subscriptions] = await Promise.all([
          fetchPublicCourses(),
          fetchWallet(),
          fetchMySubscriptions(),
        ]);
        if (!live) return;
        for (const course of courses) {
          const plan = course.plans.find((p) => p.id === planId);
          if (plan) {
            setCourseId(course.id);
            setCourseTitle(ar ? course.titleAr : course.titleEn);
            if (
              subscriptions.some(
                (s) =>
                  s.courseId === course.id &&
                  (s.expiresAt === null || new Date(s.expiresAt).getTime() > Date.now()),
              )
            ) {
              setErrorCode('COURSE_ALREADY_SUBSCRIBED');
              setPhase('failed');
              return;
            }
            setPrice(plan.currentPricePiastres);
            setDuration(plan.durationDays);
            setMode(plan.accessMode ?? 'DURATION');
            setDeadline(plan.accessEndsAt ?? null);
            setCourseTitle(ar ? course.titleAr : course.titleEn);
            break;
          }
        }
        setBalance(wallet.balancePiastres);
        setPhase('review');
      } catch (err) {
        if (live) {
          if (err instanceof ApiError && err.status === 401) {
            go(purchaseLoginHash(planId));
            return;
          }
          setErrorCode(err instanceof ApiError ? err.code : 'SERVICE_ERROR');
          setPhase('failed');
        }
      }
    })();
    return () => {
      live = false;
    };
  }, [planId, ar, status, go]);

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
      if (err instanceof ApiError && err.status === 401) {
        go(purchaseLoginHash(planId));
        return;
      }
      setErrorCode(err instanceof ApiError ? err.code : 'SERVICE_ERROR');
      setPhase(err instanceof ApiError && err.code === 'INSUFFICIENT_FUNDS' ? 'review' : 'failed');
    }
  }

  if (status !== 'authenticated' || phase === 'loading') {
    return (
      <main id="main">
        <section className="py-8">
          <Container>
            <Loading text={t.loading} />
          </Container>
        </section>
      </main>
    );
  }

  if (phase === 'receipt' && receipt !== null) {
    return (
      <main id="main">
        <section className="py-8">
          <Container>
            <Card className="mx-auto max-w-[640px] rounded-2xl border-border-strong bg-surface !p-6 text-start shadow-lift tabular-nums">
              <p className="inline-flex rounded-full border border-success-fg/40 bg-success-bg px-3 py-1 text-xs font-extrabold text-success-fg">
                {ar ? 'تم الاشتراك بنجاح' : 'Enrollment confirmed'}
              </p>
              <h1 className="mt-3 text-2xl font-extrabold text-ink">{t.purchaseReceipt}</h1>
              <p className="mt-1.5 text-base font-bold text-ink">{courseTitle}</p>
              <dl className="mt-5 divide-y divide-border/70 rounded-xl border border-border bg-field/60 px-4">
                <div className="flex items-center justify-between gap-4 py-3">
                  <dt className="text-sm text-muted">{t.priceLabel}</dt>
                  <dd className="font-extrabold text-ink">
                    {receipt.pricePiastres === 0 ? (
                      ar ? (
                        'مجاني'
                      ) : (
                        'Free'
                      )
                    ) : (
                      <Money piastres={receipt.pricePiastres} />
                    )}
                  </dd>
                </div>
                {receipt.durationDays !== null ? (
                  <div className="flex items-center justify-between gap-4 py-3">
                    <dt className="text-sm text-muted">{t.durationLabel}</dt>
                    <dd className="font-bold text-ink">
                      {receipt.durationDays} {t.daysUnit}
                    </dd>
                  </div>
                ) : null}
                <div className="flex items-center justify-between gap-4 py-3">
                  <dt className="text-sm text-muted">{t.validUntil}</dt>
                  <dd className="text-end font-bold text-ink">
                    {receipt.subscription.expiresAt
                      ? `${displayDeadline(receipt.subscription.expiresAt, lang)} (${ar ? 'القاهرة' : 'Cairo'})`
                      : ar
                        ? 'بدون انتهاء، حتى الحذف النهائي للكورس'
                        : 'No expiry, until permanent course removal'}
                  </dd>
                </div>
              </dl>
              <FormActions>
                <Button onClick={() => go(`#/learn/${receipt.courseId}`)}>
                  {ar ? 'تابع التعلم' : 'Continue learning'}
                </Button>
                <Button variant="secondary" onClick={() => go('#/courses')}>
                  {t.backToCourses}
                </Button>
                <Button variant="secondary" onClick={() => go('#/wallet')}>
                  {t.backToWallet}
                </Button>
              </FormActions>
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
            <div className="mx-auto max-w-[640px] rounded-2xl border border-border bg-surface p-6 text-start shadow-rest">
              <h1 className="text-2xl font-extrabold text-ink">{t.purchaseTitle}</h1>
              {courseId && errorCode === 'COURSE_ALREADY_SUBSCRIBED' ? (
                <a
                  href={`#/learn/${courseId}`}
                  className="my-4 inline-flex min-h-[48px] items-center rounded-xl bg-primary px-5 py-3 font-bold text-primary-ink no-underline hover:bg-primary-hover"
                >
                  {ar ? 'تابع التعلم' : 'Continue learning'}
                </a>
              ) : null}
              <div className="mt-4">
                <Notice kind="error">
                  {errorCode === 'COURSE_ALREADY_SUBSCRIBED'
                    ? ar
                      ? 'أنت مشترك بالفعل في هذا الكورس. لم يتم خصم أي مبلغ. يمكنك التجديد بعد انتهاء الاشتراك.'
                      : 'You already have access to this course. No payment was taken. You can renew after access expires.'
                    : errorCode === 'NO_ACCESS_EXTENSION'
                      ? ar
                        ? 'عندك وصول يغطي هذا العرض بالفعل. لم يتم خصم أي مبلغ.'
                        : 'Your existing access already covers this offer. No payment was taken.'
                      : localizeCode(t, errorCode ?? 'SERVICE_ERROR')}
                </Notice>
              </div>
              <FormActions className="mt-4">
                <Button variant="secondary" onClick={() => go('#/courses')}>
                  {t.backToCourses}
                </Button>
              </FormActions>
            </div>
          </Container>
        </section>
      </main>
    );
  }

  if (price === null) {
    return (
      <main id="main">
        <section className="py-8">
          <Container>
            <h1 className="text-2xl font-extrabold text-ink">{t.purchaseTitle}</h1>
            <div className="mt-4">
              <EmptyState text={t.planUnavailable} />
            </div>
          </Container>
        </section>
      </main>
    );
  }

  const short = balance !== null && balance < price;
  const needsRecharge = short || errorCode === 'INSUFFICIENT_FUNDS';

  return (
    <main id="main">
      <section className="py-8">
        <Container>
          <Card className="mx-auto max-w-[640px] rounded-2xl border-border-strong bg-surface !p-6 text-start shadow-lift tabular-nums">
            <p className="text-xs font-extrabold text-primary-strong">
              {ar ? 'مراجعة الطلب قبل التأكيد' : 'Order review'}
            </p>
            <h1 className="mt-1 text-2xl font-extrabold text-ink">{t.purchaseTitle}</h1>
            <p className="mt-1.5 text-base font-bold text-ink">{courseTitle}</p>

            <dl className="mt-5 divide-y divide-border/70 rounded-xl border border-border bg-field/60 px-4">
              <div className="flex items-center justify-between gap-4 py-3">
                <dt className="text-sm text-muted">{t.priceLabel}</dt>
                <dd className="text-lg font-extrabold text-ink">
                  {price === 0 ? ar ? 'مجاني' : 'Free' : <Money piastres={price} />}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-4 py-3">
                <dt className="text-sm text-muted">{t.durationLabel}</dt>
                <dd className="text-end text-sm font-bold text-ink">
                  {mode === 'UNTIL_REMOVAL'
                    ? ar
                      ? 'بدون انتهاء، حتى الحذف النهائي للكورس'
                      : 'No expiry, until permanent course removal'
                    : duration !== null
                      ? `${duration} ${t.daysUnit}`
                      : deadline
                        ? `${displayDeadline(deadline, lang)} (${ar ? 'القاهرة' : 'Cairo'})`
                        : t.planUnavailable}
                </dd>
              </div>
              {price > 0 ? (
                <div className="flex items-center justify-between gap-4 py-3">
                  <dt className="text-sm text-muted">{t.walletBalance}</dt>
                  <dd className="font-bold text-ink">
                    {balance !== null ? <Money piastres={balance} /> : '…'}
                  </dd>
                </div>
              ) : null}
              {price > 0 && balance !== null && !short ? (
                <div className="flex items-center justify-between gap-4 py-3">
                  <dt className="text-sm text-muted">{t.balanceAfter}</dt>
                  <dd className="font-extrabold text-primary-strong">
                    <Money piastres={balance - price} />
                  </dd>
                </div>
              ) : null}
            </dl>

            {needsRecharge ? (
              <div className="mt-4">
                <Notice kind="info">{localizeCode(t, 'INSUFFICIENT_FUNDS')}</Notice>
                <FormActions className="mt-3">
                  <Button onClick={() => go('#/wallet')}>{t.goRecharge}</Button>
                  <Button variant="secondary" onClick={() => go('#/courses')}>
                    {t.cancel}
                  </Button>
                </FormActions>
              </div>
            ) : null}

            {errorCode !== null && errorCode !== 'INSUFFICIENT_FUNDS' ? (
              <div className="mt-4">
                <Notice kind="error">{localizeCode(t, errorCode)}</Notice>
              </div>
            ) : null}

            {!needsRecharge ? (
              <FormActions>
                <Button onClick={() => void confirm()} disabled={phase === 'confirming'}>
                  {phase === 'confirming' ? (
                    <Loading text={t.confirming} />
                  ) : price === 0 ? (
                    ar ? (
                      'اشترك مجانًا'
                    ) : (
                      'Enroll for free'
                    )
                  ) : (
                    t.confirmPurchase
                  )}
                </Button>
                <Button variant="secondary" onClick={() => go('#/courses')}>
                  {t.cancel}
                </Button>
              </FormActions>
            ) : null}
          </Card>
        </Container>
      </section>
    </main>
  );
}
