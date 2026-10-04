import { useMemo, useRef, useState, type FormEvent } from 'react';
import { ApiError } from '../../../auth';
import { localizeCode, useLang } from '../../../i18n';
import { Button } from '../../../components/ui/Button';
import { FormActions } from '../../../components/ui/FormActions';
import { Card, Container } from '../../../components/ui/Card';
import { Field } from '../../../components/ui/Field';
import { Notice, Loading } from '../../../components/ui/Notice';
import { submitRecharge } from '../api/client';
import { newIdempotencyKey } from '../../../utils';
import { useWallet } from '../hooks/useWallet';
import { Money } from '../components/Money';
import type { RechargeChannel } from '../types/models';

function egpToPiastres(raw: string): number | null {
  if (!/^\d+(\.\d{1,2})?$/.test(raw.trim())) return null;
  const [pounds, frac = ''] = raw.trim().split('.');
  return Number(pounds) * 100 + Number((frac + '00').slice(0, 2));
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const url = String(reader.result ?? '');
      const comma = url.indexOf(',');
      if (comma < 0) reject(new Error('unreadable'));
      else resolve(url.slice(comma + 1));
    };
    reader.onerror = () => reject(new Error('unreadable'));
    reader.readAsDataURL(file);
  });
}

export function RechargePage({ go }: { go: (hash: string) => void }): JSX.Element {
  const { t, lang } = useLang();
  const { instructions, instructionsError, reload } = useWallet();
  const [amount, setAmount] = useState('');
  const [channel, setChannel] = useState<RechargeChannel | ''>('');
  const [reference, setReference] = useState('');
  const [senderName, setSenderName] = useState('');
  const [senderPhone, setSenderPhone] = useState('');
  const [transferDate, setTransferDate] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [doneId, setDoneId] = useState<string | null>(null);
  const keyRef = useRef<string | null>(null);

  const piastres = useMemo(() => egpToPiastres(amount), [amount]);
  const channelOptions = useMemo(() => (instructions ?? []).map((c) => c.channel), [instructions]);

  async function onSubmit(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (busy || !channelOptions.length) return;
    setErrorCode(null);
    if (file === null) {
      setFileError(t.proofRequired);
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setFileError(t.proofTooLarge);
      return;
    }
    if (piastres === null || channel === '') {
      setErrorCode('VALIDATION_ERROR');
      return;
    }
    setBusy(true);
    try {
      const proofBase64 = await fileToBase64(file).catch(() => {
        throw new ApiError(400, 'VALIDATION_ERROR', 'Unreadable proof file.');
      });
      if (keyRef.current === null) {
        keyRef.current = newIdempotencyKey();
      }
      const created = await submitRecharge({
        amountPiastres: piastres,
        channel,
        reference,
        senderName,
        senderPhone,
        transferDate,
        proofFilename: file.name,
        proofMime: file.type || 'application/octet-stream',
        proofBase64,
        idempotencyKey: keyRef.current,
      });
      setDoneId(created.id);
    } catch (err) {
      setErrorCode(err instanceof ApiError ? err.code : 'SERVICE_ERROR');
    } finally {
      setBusy(false);
    }
  }

  if (doneId !== null) {
    return (
      <main id="main">
        <section className="py-8">
          <Container>
            <Card className="mx-auto max-w-[640px]">
              <h1 className="text-2xl font-bold">{t.rechargeSubmitted}</h1>
              <p className="mt-2 text-muted">{t.rechargeSubmittedBody}</p>
              <FormActions>
                <Button onClick={() => go('#/wallet')}>{t.backToWallet}</Button>
              </FormActions>
            </Card>
          </Container>
        </section>
      </main>
    );
  }

  return (
    <main id="main">
      <section className="py-8">
        <Container>
          <div className="form-card mx-auto max-w-[640px] rounded-card border border-border bg-surface p-6 shadow-rest">
            <h1 className="text-2xl font-bold">{t.rechargeTitle}</h1>
            <p className="mt-2 text-muted">{t.rechargeNoAutoCredit}</p>
            {instructions===null ? <><Notice kind={instructionsError?'error':'info'}>{instructionsError?(lang==='ar'?'تعذر تحميل طرق التحويل. أعد المحاولة.':'Could not load transfer methods. Please retry.') : t.loading}</Notice>{instructionsError?<Button variant="secondary" onClick={()=>void reload()}>{t.retry}</Button>:null}</>:!channelOptions.length?<Notice kind="info">{lang==='ar'?'الشحن غير متاح حاليًا؛ لم تُضف الإدارة طريقة تحويل. لا تحول أي مبلغ حتى تظهر التعليمات.':'Recharge is temporarily unavailable because no transfer method is configured. Wait for transfer instructions before sending money.'}</Notice>:null}
            {errorCode !== null ? <Notice kind="error">{localizeCode(t, errorCode)}</Notice> : null}
            <form onSubmit={(e) => void onSubmit(e)} noValidate><fieldset disabled={busy || !channelOptions.length}>
              <Field id="rch-amount" label={t.fieldAmount}>
                <input
                  id="rch-amount"
                  name="amount"
                  inputMode="decimal"
                  required
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="600"
                  dir="ltr"
                  className="w-full rounded-control border border-border bg-surface px-3 py-2"
                />
              </Field>
              {piastres !== null ? (
                <p className="mt-1 text-sm text-muted">
                  <Money piastres={piastres} />
                </p>
              ) : null}
              <Field id="rch-channel" label={t.fieldChannel}>
                <select
                  id="rch-channel"
                  name="channel"
                  required
                  value={channel}
                  onChange={(e) => setChannel(e.target.value as RechargeChannel | '')}
                  className="w-full rounded-control border border-border bg-surface px-3 py-2"
                >
                  <option value="">{t.selectChannel}</option>
                  {channelOptions.map((c) => (
                    <option key={c} value={c}>
                      {c === 'INSTAPAY'
                        ? t.channelInstapay
                        : c === 'BANK_TRANSFER'
                          ? t.channelBank
                          : t.channelMobile}
                    </option>
                  ))}
                </select>
              </Field>
              <Field id="rch-reference" label={t.fieldReference}>
                <input
                  id="rch-reference"
                  name="reference"
                  required
                  dir="ltr"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  className="w-full rounded-control border border-border bg-surface px-3 py-2"
                />
              </Field>
              <Field id="rch-sender" label={t.fieldSenderName}>
                <input
                  id="rch-sender"
                  name="senderName"
                  required
                  value={senderName}
                  onChange={(e) => setSenderName(e.target.value)}
                  className="w-full rounded-control border border-border bg-surface px-3 py-2"
                />
              </Field>
              <Field id="rch-phone" label={t.fieldSenderPhone}>
                <input
                  id="rch-phone"
                  name="senderPhone"
                  type="tel"
                  required
                  dir="ltr"
                  value={senderPhone}
                  onChange={(e) => setSenderPhone(e.target.value)}
                  className="w-full rounded-control border border-border bg-surface px-3 py-2"
                />
              </Field>
              <Field id="rch-date" label={t.fieldTransferDate}>
                <input
                  id="rch-date"
                  name="transferDate"
                  type="date"
                  required
                  value={transferDate}
                  onChange={(e) => setTransferDate(e.target.value)}
                  className="w-full rounded-control border border-border bg-surface px-3 py-2"
                />
              </Field>
              <Field id="rch-proof" label={t.fieldProof} error={fileError ?? undefined}>
                <input
                  id="rch-proof"
                  name="proof"
                  type="file"
                  required
                  accept=".jpg,.jpeg,.png,.pdf"
                  onChange={(e) => {
                    setFile(e.target.files?.[0] ?? null);
                    setFileError(null);
                  }}
                  className="w-full rounded-control border border-border bg-surface px-3 py-2"
                />
              </Field>
              {file ? <p role="status" className="w-full text-sm">{lang==='ar'?'الإثبات المحدد':'Selected proof'}: {file.name} · {Math.ceil(file.size/1024)} KB. {lang==='ar'?'يُرفق عند إرسال الطلب؛ الرصيد يتغير بعد المراجعة فقط.':'Attached when you submit; credit follows admin verification only.'}</p>:null}
              <FormActions>
                <Button type="submit" disabled={busy || !channelOptions.length} disabledReason={busy ? undefined : { ar: "لا توجد طريقة تحويل متاحة. تواصل مع الدعم قبل إرسال طلب شحن.", en: "No transfer method is available. Contact support before sending a recharge request." }}>
                  {busy ? <Loading text={t.submitting} /> : t.submitRecharge}
                </Button>
                <Button variant="secondary" onClick={() => go('#/wallet')}>
                  {t.cancel}
                </Button>
              </FormActions>
            </fieldset></form>
          </div>
        </Container>
      </section>
    </main>
  );
}
