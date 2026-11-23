import { useMemo, useRef, useState, type FormEvent } from 'react';
import { ApiError } from '../../../auth';
import { localizeCode, useLang } from '../../../i18n';
import { Button } from '../../../components/ui/Button';
import { FormActions } from '../../../components/ui/FormActions';
import { Card, Container } from '../../../components/ui/Card';
import { Field, textInputClassName } from '../../../components/ui/Field';
import { Notice, Loading } from '../../../components/ui/Notice';
import { submitRecharge } from '../api/client';
import { newIdempotencyKey } from '../../../utils';
import { useWallet } from '../hooks/useWallet';
import { Money } from '../components/Money';
import type { RechargeChannel } from '../types/models';
import { PaymentDetails } from '../components/PaymentDetails';

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
  const ar = lang === 'ar';
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
  const receiving =
    instructions?.find((c) => c.channel === channel) ??
    (instructions?.length === 1 ? instructions[0] : undefined);

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
            <Card className="mx-auto max-w-[640px] rounded-2xl border-border-strong bg-surface !p-6 text-start shadow-lift">
              <p className="inline-flex rounded-full border border-pending-fg/40 bg-pending-bg px-3 py-1 text-xs font-extrabold text-pending-fg">
                {ar ? 'قيد مراجعة الإدارة' : 'Pending admin review'}
              </p>
              <h1 className="mt-3 text-2xl font-extrabold text-ink">{t.rechargeSubmitted}</h1>
              <p className="mt-2 text-sm leading-relaxed text-muted">{t.rechargeSubmittedBody}</p>
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
      <section className="py-6 text-start md:py-8">
        <Container>
          <div className="mx-auto max-w-4xl">
            <div className="mb-5">
              <p className="text-xs font-extrabold text-primary-strong">
                {ar ? 'شحن المحفظة يدويًا' : 'Manual wallet recharge'}
              </p>
              <h1 className="mt-1 page-title text-ink">{t.rechargeTitle}</h1>
            </div>

            {instructions === null ? (
              <div className="mb-4">
                <Notice kind={instructionsError ? 'error' : 'info'}>
                  {instructionsError
                    ? ar
                      ? 'تعذر تحميل طرق التحويل. أعد المحاولة.'
                      : 'Could not load transfer methods. Please retry.'
                    : t.loading}
                </Notice>
                {instructionsError ? (
                  <Button variant="secondary" onClick={() => void reload()}>
                    {t.retry}
                  </Button>
                ) : null}
              </div>
            ) : !channelOptions.length ? (
              <Notice kind="info">
                {ar
                  ? 'الشحن غير متاح مؤقتًا. تواصل مع الدعم.'
                  : 'Recharge is temporarily unavailable. Contact support.'}
              </Notice>
            ) : null}

            {errorCode !== null ? <Notice kind="error">{localizeCode(t, errorCode)}</Notice> : null}

            <div
              className={
                receiving
                  ? 'grid items-start gap-6 lg:grid-cols-[0.9fr_1.15fr]'
                  : 'mx-auto max-w-2xl'
              }
            >
              {receiving ? (
                <aside className="min-w-0 lg:sticky lg:top-24" data-testid="recharge-receiving">
                  <PaymentDetails receiving={receiving} stacked />
                </aside>
              ) : null}

              <div className="form-card min-w-0 rounded-2xl border border-border bg-surface p-5 shadow-rest sm:p-6">
                <form onSubmit={(e) => void onSubmit(e)} noValidate>
                  <fieldset disabled={busy || !channelOptions.length} className="space-y-6">
                    {/* Step 1: Amount & Channel */}
                    <section className="rounded-xl border border-border/80 bg-field/40 p-4">
                      <h2 className="mb-3.5 flex items-center gap-2.5 text-base font-extrabold text-ink">
                        <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary text-xs font-extrabold text-primary-ink">
                          {ar ? '١' : '1'}
                        </span>
                        <span>{ar ? 'المبلغ وطريقة التحويل' : 'Amount & transfer method'}</span>
                      </h2>
                      <div className="grid gap-x-4 gap-y-1 sm:grid-cols-2">
                        <Field
                          id="rch-amount"
                          label={t.fieldAmount}
                        >
                          <input
                            id="rch-amount"
                            name="amount"
                            inputMode="decimal"
                            required
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            placeholder="600"
                            dir="ltr"
                            className={textInputClassName(false)}
                          />
                          {piastres !== null ? (
                            <p className="mt-1 text-xs font-bold tabular-nums text-primary-strong">
                              <Money piastres={piastres} />
                            </p>
                          ) : null}
                        </Field>

                        <Field
                          id="rch-channel"
                          label={t.fieldChannel}
                        >
                          <select
                            id="rch-channel"
                            name="channel"
                            required
                            value={channel}
                            onChange={(e) => setChannel(e.target.value as RechargeChannel | '')}
                            className={textInputClassName(false)}
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
                      </div>
                    </section>

                    {/* Step 2: Transfer Details */}
                    <section className="rounded-xl border border-border/80 bg-field/40 p-4">
                      <h2 className="mb-3.5 flex items-center gap-2.5 text-base font-extrabold text-ink">
                        <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary text-xs font-extrabold text-primary-ink">
                          {ar ? '٢' : '2'}
                        </span>
                        <span>{ar ? 'بيانات عملية التحويل' : 'Transfer details'}</span>
                      </h2>
                      <div className="grid gap-x-4 gap-y-1 sm:grid-cols-2">
                        <Field
                          id="rch-reference"
                          label={
                            ar
                              ? 'مرجع التحويل (رقم العملية)'
                              : 'Transfer reference (transaction ID)'
                          }
                        >
                          <input
                            id="rch-reference"
                            name="reference"
                            required
                            dir="ltr"
                            value={reference}
                            onChange={(e) => setReference(e.target.value)}
                            className={textInputClassName(false)}
                          />
                        </Field>

                        <Field
                          id="rch-date"
                          label={t.fieldTransferDate}
                        >
                          <input
                            id="rch-date"
                            name="transferDate"
                            type="date"
                            required
                            value={transferDate}
                            onChange={(e) => setTransferDate(e.target.value)}
                            className={textInputClassName(false)}
                          />
                        </Field>

                        <Field
                          id="rch-sender"
                          label={t.fieldSenderName}
                        >
                          <input
                            id="rch-sender"
                            name="senderName"
                            required
                            value={senderName}
                            onChange={(e) => setSenderName(e.target.value)}
                            className={textInputClassName(false)}
                          />
                        </Field>

                        <Field
                          id="rch-phone"
                          label={t.fieldSenderPhone}
                        >
                          <input
                            id="rch-phone"
                            name="senderPhone"
                            type="tel"
                            required
                            dir="ltr"
                            placeholder="+2010…"
                            value={senderPhone}
                            onChange={(e) => setSenderPhone(e.target.value)}
                            className={textInputClassName(false)}
                          />
                        </Field>
                      </div>
                    </section>

                    {/* Step 3: Receipt Proof Upload */}
                    <section className="rounded-xl border border-border/80 bg-field/40 p-4">
                      <h2 className="mb-3.5 flex items-center gap-2.5 text-base font-extrabold text-ink">
                        <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary text-xs font-extrabold text-primary-ink">
                          {ar ? '٣' : '3'}
                        </span>
                        <span>{ar ? 'إرفاق صورة الإيصال' : 'Attach receipt proof'}</span>
                      </h2>
                      <Field
                        id="rch-proof"
                        label={t.fieldProof}
                        error={fileError ?? undefined}
                        className="!mb-0"
                      >
                        <input
                          id="rch-proof"
                          aria-describedby={fileError ? 'rch-proof-error' : undefined}
                          aria-invalid={fileError ? true : undefined}
                          name="proof"
                          type="file"
                          required
                          accept=".jpg,.jpeg,.png,.pdf"
                          onChange={(e) => {
                            setFile(e.target.files?.[0] ?? null);
                            setFileError(null);
                          }}
                          className="w-full cursor-pointer rounded-xl border border-dashed border-border-strong bg-surface px-4 py-3 text-sm text-ink file:me-3 file:rounded-lg file:border-0 file:bg-elevated file:px-3 file:py-1.5 file:text-xs file:font-bold file:text-ink"
                        />
                      </Field>
                      {file ? (
                        <p
                          role="status"
                          className="mt-3 rounded-xl border border-success-fg/40 bg-success-bg/60 px-3.5 py-2.5 text-xs font-semibold text-success-fg sm:text-sm"
                        >
                          {ar ? 'الإثبات المحدد' : 'Selected proof'}: {file.name} ·{' '}
                          {Math.ceil(file.size / 1024)} KB.{' '}
                          {ar
                            ? 'يُرفق عند إرسال الطلب؛ الرصيد يتغير بعد المراجعة فقط.'
                            : 'Attached when you submit; credit follows admin verification only.'}
                        </p>
                      ) : null}
                    </section>
                  </fieldset>

                  <FormActions>
                    <Button
                      type="submit"
                      disabled={busy || !channelOptions.length}
                      disabledReason={
                        busy
                          ? undefined
                          : {
                              ar: 'لا توجد طريقة تحويل متاحة. تواصل مع الدعم قبل إرسال طلب شحن.',
                              en: 'No transfer method is available. Contact support before sending a recharge request.',
                            }
                      }
                    >
                      {busy ? <Loading text={t.submitting} /> : t.submitRecharge}
                    </Button>
                    <Button variant="secondary" disabled={busy} onClick={() => go('#/wallet')}>
                      {t.cancel}
                    </Button>
                  </FormActions>
                </form>
              </div>
            </div>
          </div>
        </Container>
      </section>
    </main>
  );
}
