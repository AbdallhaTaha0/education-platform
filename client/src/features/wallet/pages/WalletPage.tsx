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
  const { t, lang } = useLang();
  const { loading, wallet, requests, instructions, instructionsError, error, reload, pagination, setPage, setPageSize } = useWallet();

  return (
    <main id="main">
      <section className="py-8">
        <Container>
          <h1 className="text-3xl font-bold">{t.walletTitle}</h1>
          <p className="mt-2 text-muted">{t.walletBody}</p>
          {loading ? <Loading text={t.loading} /> : null}
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
            <Card className="mt-4">
              <p className="text-sm text-muted">{t.walletBalance}</p>
              <p className="mt-1 text-4xl font-bold text-accent">
                <Money piastres={wallet.balancePiastres} />
              </p>
              <FormActions className="mt-4">
                <Button disabled={!instructions?.length} disabledReason={instructionsError ? { ar: "تعذر تحميل طرق الشحن. أعد المحاولة من رسالة الخطأ.", en: "Transfer methods could not load. Retry using the error message." } : instructions === null ? { ar: "جارٍ تحميل طرق الشحن.", en: "Loading transfer methods." } : { ar: "لم تضف الإدارة طرق تحويل بعد. تواصل مع الدعم.", en: "Transfer methods have not been configured. Contact support." }} onClick={() => go('#/wallet/recharge')}>{t.rechargeNew}</Button>
                <Button variant="secondary" onClick={()=>go('#/courses')}>{lang==='ar'?'اختَر كورسك بعد الشحن':'Choose your course after recharge'}</Button>
                <Button variant="secondary" onClick={() => go('#/purchases')}>
                  {t.purchaseHistory}
                </Button>
              </FormActions>
            </Card>
          ) : null}
          <h2 className="mt-8 text-2xl font-bold">{t.instructionsTitle}</h2>
          {instructions?.length===0 ? <Notice kind="info">{lang==='ar'?'الشحن غير متاح مؤقتًا؛ لم تُضف طرق التحويل بعد.':'Recharge is temporarily unavailable; transfer methods have not been configured.'}</Notice>:null}
          {instructionsError !== null ? (
            <div className="mt-2">
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
          <h2 className="mt-8 text-2xl font-bold">{t.rechargeHistory}</h2>
          {requests.length === 0 && !loading ? (
            <div className="mt-2">
              <EmptyState text={t.rechargeEmpty} />
            </div>
          ) : null}
          <ul className="mt-2 space-y-3">
            {requests.map((request) => (
              <li key={request.id}>
                <Card className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-bold">
                      <Money piastres={request.amountPiastres} />
                    </p>
                    <p className="text-sm text-muted">{request.proofFilename}</p>
                  </div>
                  <RequestStatus status={request.status} />
                </Card>
              </li>
            ))}
          </ul>
          <Pagination {...pagination} id="wallet-requests" onPage={setPage} onSize={setPageSize} disabled={loading} />
        </Container>
      </section>
    </main>
  );
}
