import { localizeCode, useLang } from '../../../i18n';
import { Button } from '../../../components/ui/Button';
import { Card, Container } from '../../../components/ui/Card';
import { Loading, Notice, EmptyState } from '../../../components/ui/Notice';
import { useWallet } from '../hooks/useWallet';
import { Money } from '../components/Money';
import { RequestStatus } from '../components/RequestStatus';

export function WalletPage({ go }: { go: (hash: string) => void }): JSX.Element {
  const { t, lang } = useLang();
  const { loading, wallet, requests, instructions, instructionsError, error, reload } = useWallet();

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
              <div className="mt-3">
                <Button variant="secondary" onClick={() => void reload()}>
                  {t.retry}
                </Button>
              </div>
            </div>
          ) : null}
          {wallet !== null ? (
            <Card className="mt-4">
              <p className="text-sm text-muted">{t.walletBalance}</p>
              <p className="mt-1 text-4xl font-bold text-accent">
                <Money piastres={wallet.balancePiastres} />
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <Button onClick={() => go('#/wallet/recharge')}>{t.rechargeNew}</Button>
                <Button variant="secondary" onClick={() => go('#/purchases')}>
                  {t.purchaseHistory}
                </Button>
              </div>
            </Card>
          ) : null}
          <h2 className="mt-8 text-2xl font-bold">{t.instructionsTitle}</h2>
          {instructionsError !== null ? (
            <div className="mt-2">
              <Notice kind="error">{localizeCode(t, instructionsError)}</Notice>
            </div>
          ) : null}
          {instructions !== null && instructions.length > 0 ? (
            <div className="mt-2 grid gap-4 md:grid-cols-3">
              {instructions.map((channel) => (
                <Card key={channel.channel}>
                  <h3 className="text-lg font-bold">
                    {channel.channel === 'INSTAPAY'
                      ? t.channelInstapay
                      : channel.channel === 'BANK_TRANSFER'
                        ? t.channelBank
                        : t.channelMobile}
                  </h3>
                  <p className="mt-1 text-sm text-muted" dir="ltr">
                    {channel.accountLabel}
                  </p>
                  <p className="mt-2 text-sm">
                    {lang === 'ar' ? channel.instructionsAr : channel.instructionsEn}
                  </p>
                </Card>
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
        </Container>
      </section>
    </main>
  );
}
