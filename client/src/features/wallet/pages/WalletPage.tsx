import { useAuth } from '../../../auth';
import { localizeCode, useLang } from '../../../i18n';
import { Button } from '../../../components/ui/Button';
import { FormActions } from '../../../components/ui/FormActions';
import { Card, Container } from '../../../components/ui/Card';
import { Loading, Notice, EmptyState } from '../../../components/ui/Notice';
import { useWallet } from '../hooks/useWallet';
import { Money } from '../components/Money';
import { RequestStatus } from '../components/RequestStatus';
import { PaymentDetails } from '../components/PaymentDetails';
import { Pagination } from '../../../components/ui/Pagination';

export function WalletPage({ go }: { go: (hash: string) => void }): JSX.Element {
  const { status, user } = useAuth();
  const { t, lang } = useLang();
  const ar = lang === 'ar';
  const {
    loading,
    wallet,
    requests,
    instructions,
    instructionsError,
    error,
    reload,
    pagination,
    setPage,
    setPageSize,
  } = useWallet();

  if (status === 'anonymous' || (status !== 'loading' && !user)) {
    return (
      <main id="main">
        <section className="py-8">
          <Container>
            <div className="mx-auto max-w-[560px] rounded-2xl border border-border bg-surface p-6 text-start shadow-rest">
              <h1 className="text-2xl font-extrabold text-ink sm:text-3xl">{t.walletTitle}</h1>
              <div className="mt-4">
                <Notice kind="info">{t.needLogin}</Notice>
                <FormActions className="mt-3">
                  <Button variant="primary" onClick={() => go('#/login')}>
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

  const rechargeSteps = [
    [
      ar ? '١' : '1',
      ar ? 'حوّل المبلغ' : 'Transfer funds',
      ar
        ? 'اختر طريقة التحويل المناسبة بالأسفل وأرسل المبلغ المطلوب.'
        : 'Pick a configured transfer method below and send the amount.',
    ],
    [
      ar ? '٢' : '2',
      ar ? 'ارفع صورة الإيصال' : 'Upload receipt proof',
      ar
        ? 'أرسل طلب الشحن برقم العملية وصورة واضحة للإيصال.'
        : 'Submit the recharge form with the reference and receipt screenshot.',
    ],
    [
      ar ? '٣' : '3',
      ar ? 'تفعيل رصيدك' : 'Admin verifies & credits',
      ar
        ? 'تراجع الإدارة الإيصال وتضيف الرصيد لمحفظتك، ثم تختار دورتك.'
        : 'An admin verifies your receipt and credits your wallet so you can enroll.',
    ],
  ] as const;

  return (
    <main id="main">
      <section className="py-6 text-start md:py-8">
        <Container>
          <p className="text-xs font-extrabold text-primary-strong">
            {ar ? 'المحفظة والرصيد' : 'Wallet & balance'}
          </p>
          <h1 className="mt-1 page-title text-ink">{t.walletTitle}</h1>
          <p className="mt-2 max-w-[65ch] text-sm text-muted sm:text-base">{t.walletBody}</p>

          {loading ? (
            <div className="mt-4">
              <Loading text={t.loading} />
            </div>
          ) : null}

          {error !== null ? (
            <div className="mt-4">
              <Notice kind="error">{localizeCode(t, error)}</Notice>
              <FormActions className="mt-3">
                <Button variant="secondary" onClick={() => void reload()}>
                  {t.retry}
                </Button>
              </FormActions>
            </div>
          ) : null}

          {wallet !== null ? (
            <Card className="mt-5 rounded-2xl border-border-strong bg-surface !p-6 shadow-lift">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-extrabold uppercase tracking-wide text-muted">
                    {t.walletBalance}
                  </p>
                  <p className="mt-1 select-none text-4xl font-extrabold tabular-nums text-primary-strong">
                    <Money piastres={wallet.balancePiastres} />
                  </p>
                </div>
                <span className="inline-flex items-center rounded-full border border-border bg-field px-3 py-1 text-xs font-bold text-muted">
                  {ar ? 'الشحن يدوي بمراجعة الإدارة' : 'Manual EGP recharge · Admin verified'}
                </span>
              </div>
              <FormActions className="mt-5">
                <Button
                  disabled={!instructions?.length}
                  disabledReason={
                    instructionsError
                      ? {
                          ar: 'تعذر تحميل طرق الشحن. أعد المحاولة من رسالة الخطأ.',
                          en: 'Transfer methods could not load. Retry using the error message.',
                        }
                      : instructions === null
                        ? { ar: 'جارٍ تحميل طرق الشحن.', en: 'Loading transfer methods.' }
                        : {
                            ar: 'لم تضف الإدارة طرق تحويل بعد. تواصل مع الدعم.',
                            en: 'Transfer methods have not been configured. Contact support.',
                          }
                  }
                  onClick={() => go('#/wallet/recharge')}
                >
                  {t.rechargeNew}
                </Button>
                <Button variant="secondary" onClick={() => go('#/courses')}>
                  {ar ? 'اختَر كورسك بعد الشحن' : 'Choose your course after recharge'}
                </Button>
                <Button variant="secondary" onClick={() => go('#/purchases')}>
                  {t.purchaseHistory}
                </Button>
              </FormActions>
            </Card>
          ) : null}

          {/* Visual 3-step explanation strip for manual EGP recharge */}
          <div
            className="mt-5 grid gap-3 md:grid-cols-3"
            aria-label={ar ? 'خطوات شحن المحفظة' : 'How manual recharge works'}
          >
            {rechargeSteps.map(([num, title, desc]) => (
              <div
                key={num}
                className="flex items-start gap-3 rounded-2xl border border-border bg-surface/90 p-4"
              >
                <span
                  aria-hidden="true"
                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-sm font-extrabold text-primary-ink"
                >
                  {num}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-extrabold text-ink">{title}</p>
                  <p className="mt-1 text-xs leading-relaxed text-muted">{desc}</p>
                </div>
              </div>
            ))}
          </div>

          <h2 className="mt-8 section-title text-ink">{t.instructionsTitle}</h2>
          {instructions?.length === 0 ? (
            <div className="mt-3">
              <Notice kind="info">
                {ar
                  ? 'الشحن غير متاح مؤقتًا؛ لم تُضف طرق التحويل بعد.'
                  : 'Recharge is temporarily unavailable; transfer methods have not been configured.'}
              </Notice>
            </div>
          ) : null}
          {instructionsError !== null ? (
            <div className="mt-3">
              <Notice kind="error">{localizeCode(t, instructionsError)}</Notice>
            </div>
          ) : null}
          {instructions !== null && instructions.length > 0 ? (
            <div className="mt-3 grid gap-4 lg:grid-cols-2" data-testid="payment-methods">
              {instructions.map((channel) => (
                <PaymentDetails key={channel.channel} receiving={channel} stacked />
              ))}
            </div>
          ) : null}

          <h2 className="mt-8 section-title text-ink">{t.rechargeHistory}</h2>
          {requests.length === 0 && !loading ? (
            <div className="mt-3">
              <EmptyState text={t.rechargeEmpty} />
            </div>
          ) : null}
          <ul className="mt-3 space-y-3">
            {requests.map((request) => (
              <li key={request.id}>
                <Card className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border-border bg-surface !p-4">
                  <div className="min-w-0">
                    <p className="text-lg font-extrabold tabular-nums text-ink">
                      <Money piastres={request.amountPiastres} />
                    </p>
                    <p className="mt-0.5 truncate text-xs text-muted sm:text-sm">
                      {request.proofFilename}
                    </p>
                  </div>
                  <RequestStatus status={request.status} />
                </Card>
              </li>
            ))}
          </ul>
          <Pagination
            {...pagination}
            id="wallet-requests"
            onPage={setPage}
            onSize={setPageSize}
            disabled={loading}
          />
        </Container>
      </section>
    </main>
  );
}
