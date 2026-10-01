import { useCallback, useEffect, useState } from 'react';
import { ApiError } from '../../../auth';
import { localizeCode, useLang } from '../../../i18n';
import { Button } from '../../../components/ui/Button';
import { Card, Container } from '../../../components/ui/Card';
import { Dialog } from '../../../components/ui/Dialog';
import { Field } from '../../../components/ui/Field';
import { Loading, Notice, EmptyState } from '../../../components/ui/Notice';
import { fetchAdminQueue, proofUrl, reviewRequest } from '../api/client';
import { Money } from '../components/Money';
import { RequestStatus } from '../components/RequestStatus';
import type { AdminRechargeRow, RechargeStatus } from '../types/models';

type Filter = '' | RechargeStatus;

export function AdminRechargePage(): JSX.Element {
  const { t } = useLang();
  const [filter, setFilter] = useState<Filter>('PENDING');
  const [rows, setRows] = useState<AdminRechargeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<AdminRechargeRow | null>(null);
  const [decision, setDecision] = useState<'APPROVE' | 'REJECT'>('APPROVE');
  const [verified, setVerified] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [dialogDone, setDialogDone] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRows(await fetchAdminQueue(filter === '' ? undefined : filter));
    } catch (err) {
      setError(err instanceof ApiError ? err.code : 'SERVICE_ERROR');
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    void reload();
  }, [reload]);

  function open(row: AdminRechargeRow): void {
    setSelected(row);
    setDecision('APPROVE');
    setVerified(false);
    setReason('');
    setDialogError(null);
    setDialogDone(null);
  }

  async function submitReview(): Promise<void> {
    if (selected === null || busy) return;
    if (decision === 'REJECT' && reason.trim().length === 0) {
      setDialogError('VALIDATION_ERROR');
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

  return (
    <main id="main">
      <section className="py-8">
        <Container>
          <h1 className="text-3xl font-bold">{t.adminRechargeTitle}</h1>
          <p className="mt-2 text-muted">{t.adminRechargeBody}</p>
          <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label={t.filterStatus}>
            {(['PENDING', 'APPROVED', 'REJECTED', ''] as Filter[]).map((value) => (
              <Button
                key={value === '' ? 'all' : value}
                variant={filter === value ? 'primary' : 'secondary'}
                onClick={() => setFilter(value)}
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
            {rows.map((row) => (
              <li key={row.id}>
                <Card className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-bold">
                      <Money piastres={row.amountPiastres} />{' '}
                      <span className="font-normal text-muted">{row.senderName}</span>
                    </p>
                    <p className="text-sm text-muted" dir="ltr">
                      {row.referenceNorm} · {row.proofFilename}
                    </p>
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
          <Dialog open={selected !== null} title={t.reviewTitle} onClose={() => setSelected(null)}>
            {selected !== null ? (
              <div>
                <p>
                  <Money piastres={selected.amountPiastres} /> · {selected.senderName}
                </p>
                <p className="mt-1 text-sm text-muted" dir="ltr">
                  {selected.referenceNorm}
                </p>
                <a
                  className="mt-2 inline-block underline"
                  href={proofUrl(selected.id)}
                  target="_blank"
                  rel="noreferrer"
                >
                  {t.proofOpen} ({selected.proofFilename})
                </a>
                {dialogDone !== null ? (
                  <div className="mt-3">
                    <Notice kind="success">
                      {dialogDone === 'APPROVE' ? t.reviewApproved : t.reviewRejected}
                    </Notice>
                  </div>
                ) : null}
                {dialogError !== null ? (
                  <div className="mt-3">
                    <Notice kind="error">{localizeCode(t, dialogError)}</Notice>
                  </div>
                ) : null}
                <div className="mt-4 flex gap-4" role="radiogroup" aria-label={t.reviewDecision}>
                  <label className="inline-flex min-h-[44px] items-center gap-2">
                    <input
                      type="radio"
                      name="decision"
                      checked={decision === 'APPROVE'}
                      onChange={() => setDecision('APPROVE')}
                    />
                    {t.approveAction}
                  </label>
                  <label className="inline-flex min-h-[44px] items-center gap-2">
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
                  <Field id="review-reason" label={t.rejectReason}>
                    <textarea
                      id="review-reason"
                      rows={3}
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      className="w-full rounded-control border border-border bg-surface px-3 py-2"
                    />
                  </Field>
                ) : null}
                {decision === 'APPROVE' ? (
                  <label className="mt-3 flex min-h-[44px] items-start gap-2">
                    <input
                      type="checkbox"
                      checked={verified}
                      onChange={(e) => setVerified(e.target.checked)}
                      className="mt-1"
                    />
                    <span className="text-sm">{t.receiptVerified}</span>
                  </label>
                ) : null}
                <p className="mt-1 text-sm text-muted">
                  {decision === 'APPROVE' ? t.approveEffect : t.rejectEffect}
                </p>
                <div className="mt-4 flex flex-wrap gap-3">
                  <Button
                    onClick={() => void submitReview()}
                    disabled={busy || dialogDone !== null}
                  >
                    {t.confirmReview}
                  </Button>
                  <Button variant="secondary" onClick={() => setSelected(null)}>
                    {t.close}
                  </Button>
                </div>
              </div>
            ) : null}
          </Dialog>
        </Container>
      </section>
    </main>
  );
}
