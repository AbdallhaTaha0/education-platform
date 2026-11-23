import { useCallback, useEffect, useState, useRef } from 'react';
import { ApiError } from '../../../auth';
import { localizeCode, useLang } from '../../../i18n';
import { Button } from '../../../components/ui/Button';
import { FormActions } from '../../../components/ui/FormActions';
import { Card, Container } from '../../../components/ui/Card';
import { Dialog } from '../../../components/ui/Dialog';
import { Field, textInputClassName } from '../../../components/ui/Field';
import { Loading, Notice, EmptyState } from '../../../components/ui/Notice';
import { fetchReviewPage, proofUrl, reviewRequest } from '../api/client';
import { Pagination, type PageInfo } from '../../../components/ui/Pagination';
import { Money } from '../components/Money';
import { RequestStatus } from '../components/RequestStatus';
import type { AdminRechargeRow, RechargeStatus } from '../types/models';
import { InstaPaySettings } from '../components/InstaPaySettings';
import { SectionPanel, SectionTabs, type SectionTab } from '../../../components/ui/SectionTabs';

const paymentTabs: SectionTab[] = [
  {
    id: 'review',
    ar: 'مراجعة طلبات الشحن',
    en: 'Review recharge requests',
    descriptionAr: 'راجع الطلب وإثبات التحويل قبل اعتماد الرصيد. إرسال الطلب لا يضيف رصيدًا.',
    descriptionEn: 'Check the request and transfer receipt before approving credit. Submission alone never adds credit.',
  },
  {
    id: 'instapay',
    ar: 'بيانات استقبال InstaPay',
    en: 'InstaPay receiving details',
    descriptionAr: 'عدّل رقم أو عنوان الاستقبال واسم المستلم والتعليمات باللغتين، ثم احفظ التغييرات.',
    descriptionEn: 'Edit the receiving number/address, recipient and bilingual instructions, then save your changes.',
  },
  {
    id: 'vodafone',
    ar: 'بيانات استقبال فودافون كاش',
    en: 'Vodafone Cash receiving details',
    descriptionAr: 'عدّل بيانات فودافون كاش مستقلة عن InstaPay. تعطيل الطريقة يمنع الطلبات الجديدة فقط.',
    descriptionEn: 'Edit Vodafone Cash independently of InstaPay. Disabling it prevents only new requests.',
  },
];

type Filter = '' | RechargeStatus;

export function AdminRechargePage(): JSX.Element {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [pagination, setPagination] = useState<PageInfo>({ page: 1, pageSize: 10, total: 0 });
  const request = useRef(0);
  const [paymentTab, setPaymentTab] = useState('review');
  const { t, lang } = useLang();
  const ar = lang === 'ar';
  const [filter, setFilter] = useState<Filter>('PENDING');
  const [rows, setRows] = useState<AdminRechargeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<AdminRechargeRow | null>(null);
  const [decision, setDecision] = useState<'APPROVE' | 'REJECT'>('APPROVE');
  const [verified, setVerified] = useState(false);
  const [reason, setReason] = useState('');
  const [reasonMissing, setReasonMissing] = useState(false);
  const reasonRef = useRef<HTMLTextAreaElement>(null);
  const [busy, setBusy] = useState(false);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [dialogDone, setDialogDone] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [date, setDate] = useState('');
  const shown = rows;

  const reload = useCallback(async () => {
    const current = ++request.current;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchReviewPage(filter, page, pageSize, search, date);
      if (current !== request.current) return;
      setRows(data.requests);
      setPagination(data.pagination);
      setPage(data.pagination.page);
    } catch (err) {
      if (current === request.current) setError(err instanceof ApiError ? err.code : 'SERVICE_ERROR');
    } finally {
      if (current === request.current) setLoading(false);
    }
  }, [filter, page, pageSize, search, date]);

  useEffect(() => {
    void reload();
  }, [reload]);

  function open(row: AdminRechargeRow): void {
    setSelected(row);
    setDecision('APPROVE');
    setVerified(false);
    setReason('');
    setReasonMissing(false);
    setDialogError(null);
    setDialogDone(null);
  }

  async function submitReview(): Promise<void> {
    if (selected === null || selected.status !== 'PENDING' || busy || dialogDone !== null) return;
    if (decision === 'REJECT' && reason.trim().length === 0) {
      setReasonMissing(true);
      reasonRef.current?.focus();
      return;
    }
    setBusy(true);
    setDialogError(null);
    try {
      await reviewRequest(selected.id, {
        decision,
        ...(decision === 'REJECT' ? { reason: reason.trim() } : {}),
        receiptVerified: decision === 'APPROVE' ? verified : false,
      });
      setDialogDone(decision);
      await reload();
    } catch (err) {
      setDialogError(err instanceof ApiError ? err.code : 'SERVICE_ERROR');
    } finally {
      setBusy(false);
    }
  }

  function channelBadgeLabel(ch: AdminRechargeRow['channel']): string {
    return ch === 'INSTAPAY'
      ? t.channelInstapay
      : ch === 'BANK_TRANSFER'
        ? t.channelBank
        : t.channelMobile;
  }

  const isPreviewableImage = selected
    ? /\.(png|jpe?g|webp)$/i.test(selected.proofFilename)
    : false;

  return (
    <main id="main">
      <section className="py-6 text-start md:py-8">
        <Container>
          <h1 className="page-title text-ink">{t.adminRechargeTitle}</h1>
          <SectionTabs
            tabs={paymentTabs}
            value={paymentTab}
            prefix="admin-payments"
            label={ar ? 'إدارة الشحن وطرق الدفع' : 'Recharge and payment management'}
            disabled={busy || selected !== null}
            onChange={setPaymentTab}
          />
          <SectionPanel tab={paymentTabs[1]} prefix="admin-payments" active={paymentTab === 'instapay'}>
            <InstaPaySettings expanded />
          </SectionPanel>
          <SectionPanel tab={paymentTabs[2]} prefix="admin-payments" active={paymentTab === 'vodafone'}>
            <InstaPaySettings method="vodafone-cash" expanded />
          </SectionPanel>
          <SectionPanel tab={paymentTabs[0]} prefix="admin-payments" active={paymentTab === 'review'}>
            <p className="mt-2 text-sm text-muted sm:text-base">{t.adminRechargeBody}</p>

            <div className="my-4 rounded-2xl border border-border bg-surface p-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1.5 block text-sm font-semibold text-ink">
                    {ar ? 'البحث في جميع الطلبات بالاسم أو المرجع' : 'Search all requests by name/reference'}
                  </span>
                  <input
                    id="recharge-request-search"
                    maxLength={100}
                    className={textInputClassName(false)}
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      setPage(1);
                    }}
                  />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-sm font-semibold text-ink">
                    {ar ? 'تاريخ التحويل' : 'Transfer date'}
                  </span>
                  <input
                    type="date"
                    className={textInputClassName(false)}
                    value={date}
                    onChange={(e) => {
                      setDate(e.target.value);
                      setPage(1);
                    }}
                  />
                </label>
              </div>
              <div className="mt-3.5 flex flex-wrap items-center justify-between gap-3 border-t border-border/70 pt-3.5">
                <div className="flex flex-wrap gap-2" role="group" aria-label={t.filterStatus}>
                  {(['PENDING', 'APPROVED', 'REJECTED', ''] as Filter[]).map((value) => (
                    <Button
                      key={value === '' ? 'all' : value}
                      variant={filter === value ? 'primary' : 'secondary'}
                      onClick={() => {
                        setFilter(value);
                        setPage(1);
                      }}
                    >
                      {value === ''
                        ? t.filterAll
                        : value === 'PENDING'
                          ? t.rechargePending
                          : value === 'APPROVED'
                            ? t.rechargeApproved
                            : t.rechargeRejected}
                    </Button>
                  ))}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setSearch('');
                      setDate('');
                      setPage(1);
                    }}
                  >
                    {ar ? 'مسح التصفية' : 'Clear filters'}
                  </Button>
                  <Button variant="secondary" disabled={loading || busy} onClick={() => void reload()}>
                    {ar ? 'تحديث الطلبات' : 'Refresh requests'}
                  </Button>
                </div>
              </div>
            </div>

            {loading ? <Loading text={t.loading} /> : null}
            {error !== null ? (
              <div className="mt-4">
                <Notice kind="error">{localizeCode(t, error)}</Notice>
              </div>
            ) : null}
            {!loading && rows.length === 0 ? (
              <div className="mt-4">
                <EmptyState text={t.queueEmpty} />
              </div>
            ) : null}

            <ul className="mt-4 space-y-3">
              {rows.length > 0 && !shown.length ? (
                <li>
                  {ar
                    ? 'لا توجد طلبات مطابقة بين الطلبات المحملة. امسح البحث أو التاريخ.'
                    : 'No matching loaded requests. Clear search or date.'}
                </li>
              ) : null}
              {shown.map((row) => (
                <li key={row.id}>
                  <Card className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border-border bg-surface !p-4 transition-colors hover:border-border-strong">
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-lg font-extrabold tabular-nums text-ink">
                          <Money piastres={row.amountPiastres} />
                        </span>
                        <span className="inline-flex rounded-full border border-border bg-elevated px-2.5 py-0.5 text-xs font-bold text-ink">
                          {channelBadgeLabel(row.channel)}
                        </span>
                        <span className="text-sm font-semibold text-ink">{row.senderName}</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                        <span className="font-mono" dir="ltr">
                          {row.referenceNorm}
                        </span>
                        <span>·</span>
                        <span>
                          {new Date(row.transferDate).toLocaleDateString(ar ? 'ar-EG' : 'en-GB', {
                            timeZone: 'Africa/Cairo',
                          })}
                        </span>
                        <span>·</span>
                        <span className="truncate">{row.proofFilename}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <RequestStatus status={row.status} />
                      <Button variant="secondary" onClick={() => open(row)}>
                        {t.reviewAction}
                      </Button>
                    </div>
                  </Card>
                </li>
              ))}
            </ul>

            <Pagination
              {...pagination}
              id="admin-requests"
              disabled={loading || busy || selected !== null}
              onPage={setPage}
              onSize={(size) => {
                setPageSize(size);
                setPage(1);
              }}
            />

            <Dialog open={selected !== null} title={t.reviewTitle} onClose={() => setSelected(null)}>
              {selected !== null ? (
                <div className="text-start">
                  <div className={`grid gap-4 ${isPreviewableImage ? 'sm:grid-cols-2' : ''}`}>
                    <div className="space-y-3">
                      <div className="rounded-xl border border-border bg-field/60 p-3.5">
                        <p className="text-lg font-extrabold tabular-nums text-ink">
                          <Money piastres={selected.amountPiastres} />
                        </p>
                        <p className="mt-0.5 text-sm font-semibold text-muted">
                          {selected.senderName} · {channelBadgeLabel(selected.channel)}
                        </p>
                        <p className="mt-1 break-all font-mono text-xs text-muted" dir="ltr">
                          {selected.referenceNorm}
                        </p>
                      </div>
                      <dl className="divide-y divide-border/70 rounded-xl border border-border bg-field/40 px-3.5 text-xs sm:text-sm">
                        <div className="py-2">
                          <dt className="text-muted">{ar ? 'تاريخ التحويل' : 'Transfer date'}</dt>
                          <dd className="mt-0.5 font-semibold text-ink">
                            {new Date(selected.transferDate).toLocaleString(ar ? 'ar-EG' : 'en-GB', {
                              timeZone: 'Africa/Cairo',
                            })}
                          </dd>
                        </div>
                        <div className="py-2">
                          <dt className="text-muted">{ar ? 'رقم الطلب' : 'Request reference'}</dt>
                          <dd dir="ltr" className="mt-0.5 break-all font-mono text-xs text-ink">
                            {selected.id}
                          </dd>
                        </div>
                        <div className="py-2">
                          <dt className="text-muted">{ar ? 'حجم الإثبات' : 'Proof size'}</dt>
                          <dd className="mt-0.5 font-semibold text-ink">
                            {Math.ceil(selected.proofSize / 1024)} KB
                          </dd>
                        </div>
                      </dl>
                      <a
                        className="inline-flex min-h-[40px] max-w-full items-center break-all text-sm font-bold text-primary-strong underline underline-offset-4"
                        href={proofUrl(selected.id)}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {t.proofOpen} ({selected.proofFilename})
                      </a>
                    </div>
                    {isPreviewableImage ? (
                      <div className="flex items-center justify-center rounded-xl border border-border bg-field p-2">
                        <img
                          src={proofUrl(selected.id)}
                          alt={
                            ar
                              ? 'إثبات التحويل المرسل؛ تحقق من الاستلام بشكل مستقل'
                              : 'Submitted transfer proof; verify receipt independently'
                          }
                          className="max-h-72 w-full rounded-lg object-contain"
                        />
                      </div>
                    ) : null}
                  </div>

                  {dialogDone !== null ? (
                    <div className="mt-4">
                      <Notice kind="success">
                        {dialogDone === 'APPROVE' ? t.reviewApproved : t.reviewRejected}
                      </Notice>
                    </div>
                  ) : null}
                  {dialogError !== null ? (
                    <div className="mt-4">
                      <Notice kind="error">{localizeCode(t, dialogError)}</Notice>
                    </div>
                  ) : null}
                  {selected.status !== 'PENDING' ? (
                    <div className="mt-4 space-y-2 rounded-xl border border-border bg-field/50 p-3.5">
                      <RequestStatus status={selected.status} />
                      <p className="text-sm text-muted">
                        {ar
                          ? 'تمت مراجعة هذا الطلب بالفعل. القرار محفوظ ولا يمكن تغييره.'
                          : 'This request has already been reviewed. Its decision is saved and cannot be changed.'}
                      </p>
                    </div>
                  ) : null}
                  {selected.status === 'PENDING' && dialogDone === null ? (
                    <div className="mt-4 border-t border-border/70 pt-4">
                      <div className="flex flex-wrap gap-4" role="radiogroup" aria-label={t.reviewDecision}>
                        <label className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 font-semibold">
                          <input
                            type="radio"
                            name="decision"
                            checked={decision === 'APPROVE'}
                            onChange={() => {
                              setDecision('APPROVE');
                              setReasonMissing(false);
                            }}
                          />
                          {t.approveAction}
                        </label>
                        <label className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 font-semibold">
                          <input
                            type="radio"
                            name="decision"
                            checked={decision === 'REJECT'}
                            onChange={() => setDecision('REJECT')}
                          />
                          {t.rejectAction}
                        </label>
                      </div>
                      {decision === 'REJECT' ? (
                        <Field id="review-reason" label={t.rejectReason} className="mt-2">
                          <textarea
                            id="review-reason"
                            ref={reasonRef}
                            aria-invalid={reasonMissing || undefined}
                            aria-describedby={reasonMissing ? 'review-reason-error' : undefined}
                            rows={3}
                            value={reason}
                            onChange={(e) => {
                              setReason(e.target.value);
                              if (e.target.value.trim()) setReasonMissing(false);
                            }}
                            className={textInputClassName(reasonMissing)}
                          />
                          {reasonMissing ? (
                            <p id="review-reason-error" role="alert" className="mt-2 text-sm text-error-fg">
                              {ar
                                ? 'اكتب سبب الرفض قبل تأكيد القرار.'
                                : 'Enter a rejection reason before confirming the decision.'}
                            </p>
                          ) : null}
                        </Field>
                      ) : null}
                      {decision === 'APPROVE' ? (
                        <label className="mt-3 flex min-h-[44px] cursor-pointer items-start gap-2.5">
                          <input
                            type="checkbox"
                            checked={verified}
                            onChange={(e) => setVerified(e.target.checked)}
                            className="mt-1"
                          />
                          <span className="text-sm">{t.receiptVerified}</span>
                        </label>
                      ) : null}
                      <p className="mt-1 text-xs text-muted sm:text-sm">
                        {decision === 'APPROVE' ? t.approveEffect : t.rejectEffect}
                      </p>
                    </div>
                  ) : null}
                  <FormActions className="mt-4">
                    {selected.status === 'PENDING' && dialogDone === null ? (
                      <Button
                        onClick={() => void submitReview()}
                        disabled={busy || dialogDone !== null || (decision === 'APPROVE' && !verified)}
                        disabledReason={
                          busy
                            ? undefined
                            : dialogDone !== null
                              ? {
                                  ar: 'تمت معالجة هذا الطلب. أغلق النافذة للاطلاع على النتيجة.',
                                  en: 'This request has been processed. Close this dialog to view the result.',
                                }
                              : {
                                  ar: 'تحقق من استلام التحويل وحدد مربع التأكيد قبل الموافقة.',
                                  en: 'Verify the transfer was received and check the confirmation box before approving.',
                                }
                        }
                      >
                        {t.confirmReview}
                      </Button>
                    ) : null}
                    <Button variant="secondary" onClick={() => setSelected(null)}>
                      {t.close}
                    </Button>
                  </FormActions>
                </div>
              ) : null}
            </Dialog>
          </SectionPanel>
        </Container>
      </section>
    </main>
  );
}
