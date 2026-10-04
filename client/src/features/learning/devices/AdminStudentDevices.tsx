/** ADMIN device management section (playback-recovery improvements). */
import { useCallback, useEffect, useState } from 'react';
import { useLang } from '../../../i18n';
import { learningApi, LearningApiError } from '../api/client';
import type { DeviceInspection } from '../types/models';
import { Button } from '../../../components/ui/Button';
import { Loading, Notice } from '../../../components/ui/Notice';

function formatDateTime(value: string, lang: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return value;
  return date.toLocaleString(lang === 'ar' ? 'ar-EG' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' });
}

export function AdminStudentDevices({ studentId }: { studentId: string }): JSX.Element {
  const { lang } = useLang();
  const ar = lang === 'ar';
  const [data, setData] = useState<DeviceInspection | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  const [releasing, setReleasing] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  // Reference whose release outcome is uncertain (timeout/error that may
  // follow an external success). Reconciled against the refreshed inspection
  // before any definitive feedback or resubmission.
  const [pendingRef, setPendingRef] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    learningApi
      .adminDevices(studentId)
      .then((body) => {
        if (!active) return;
        setData(body.devices);
        setLoading(false);
        // Reconcile an uncertain outcome against the fresh inspection.
        if (pendingRef !== null) {
          const stillListed = body.devices.devices.some((d) => d.reference === pendingRef);
          setMessage(stillListed ? 'stillListed' : 'likelyReleased');
          setPendingRef(null);
        }
      })
      .catch((err: unknown) => {
        if (!active) return;
        setError(err instanceof LearningApiError ? err.code : 'UNKNOWN');
        setLoading(false);
        // Inspection itself is unavailable: an uncertain release stays
        // unconfirmed rather than becoming a blind success or retry prompt.
        if (pendingRef !== null) {
          setMessage('unconfirmedNoInspection');
          setPendingRef(null);
        }
      });
    return () => {
      active = false;
    };
  }, [studentId, nonce, pendingRef]);

  const release = useCallback(
    async (reference: string) => {
      setReleasing(reference);
      setMessage(null);
      try {
        const body = await learningApi.adminReleaseDevice(studentId, reference);
        if (body.release.released) {
          setMessage(body.release.auditPending ? 'auditPending' : 'released');
        } else {
          setMessage('repeat');
        }
        // Refresh/reconcile before showing success or resubmitting.
        setNonce((n) => n + 1);
      } catch (err) {
        const code = err instanceof LearningApiError ? err.code : 'UNKNOWN';
        if (code === 'DEVICE_RELEASE_ACTIVE') setMessage('activeRefused');
        else if (code === 'DEVICE_RELEASE_REVOKED') setMessage('revokedRefused');
        else {
          // Uncertain: a timeout/error can follow an external success.
          // Reconcile the inspection before any definitive feedback or
          // resubmission; controls stay disabled while refreshing.
          setMessage('unconfirmed');
          setPendingRef(reference);
          setNonce((n) => n + 1);
        }
      } finally {
        setReleasing(null);
      }
    },
    [studentId],
  );

  // Release controls stay disabled while a release or its reconciling
  // refresh is in flight, so a stale list can never accept a resubmission.
  // pendingRef clears only after the fresh inspection reconciles the outcome.
  const busy = releasing !== null || pendingRef !== null;

  return (
    <section aria-label={ar ? 'أجهزة الطالب' : 'Student devices'} className="mt-4 rounded-card border border-border bg-surface p-4">
      <h3 className="text-lg font-bold">{ar ? 'أجهزة الطالب' : 'Student devices'}</h3>
      <p className="mt-1 text-sm text-muted">
        {ar
          ? 'تعرض التسجيلات النشطة فقط ضمن الحد. المدخلات الملغاة تظل ظاهرة كمحظورة ولا يمكن تحريرها.'
          : 'Shows ACTIVE registrations only within the limit. REVOKED rows stay visible as banned and cannot be released.'}
      </p>
      {loading ? <Loading text={ar ? 'جارٍ التحميل…' : 'Loading…'} /> : null}
      {error ? (
        <div className="mt-3">
          <Notice kind="error">{ar ? 'تعذّر تحميل الأجهزة. حاول مرة أخرى.' : 'Could not load devices. Please retry.'}</Notice>
          <div className="mt-2">
            <Button variant="secondary" onClick={() => setNonce((n) => n + 1)}>{ar ? 'إعادة المحاولة' : 'Retry'}</Button>
          </div>
        </div>
      ) : null}
      {data ? (
        <div className="mt-3">
          <dl className="grid gap-2 text-sm md:grid-cols-3">
            <div><dt className="text-muted">{ar ? 'الحد الأقصى' : 'Maximum'}</dt><dd className="font-bold">{data.maxDevices}</dd></div>
            <div><dt className="text-muted">{ar ? 'التسجيلات النشطة' : 'ACTIVE registrations'}</dt><dd className="font-bold">{data.activeCount ?? (ar ? 'غير معروف (قائمة غير مكتملة)' : 'Unknown (incomplete list)')}</dd></div>
            <div><dt className="text-muted">{ar ? 'الخانات الحرة' : 'Free slots'}</dt><dd className="font-bold">{data.freeSlots ?? (ar ? 'غير معروف (قائمة غير مكتملة)' : 'Unknown (incomplete list)')}</dd></div>
          </dl>
          {data.truncated ? (
            <p className="mt-2 text-sm text-muted" role="status">
              {ar ? 'القائمة غير مكتملة؛ لا يمكن حساب العدد الكامل.' : 'The list is truncated; a complete slot count cannot be calculated.'}
            </p>
          ) : null}
          {message === 'released' ? <div className="mt-2"><Notice kind="success">{ar ? 'تم التحرير. حدّث القائمة قبل أي إجراء آخر.' : 'Released. Refresh the list before any further action.'}</Notice></div> : null}
          {message === 'repeat' ? <div className="mt-2"><Notice kind="info">{ar ? 'تم التحرير مسبقًا (لا يوجد تغيير).' : 'Already released (no change).'}</Notice></div> : null}
          {message === 'auditPending' ? <div className="mt-2"><Notice kind="error">{ar ? 'تم التحرير خارجيًا، وتعذّر حفظ التدقيق المحلي. راجع السجل قبل المتابعة.' : 'Released externally, but the local audit write failed. Review the log before continuing.'}</Notice></div> : null}
          {message === 'activeRefused' ? <div className="mt-2"><Notice kind="error">{ar ? 'تعذّر التحرير: الجهاز لديه تشغيل نشط.' : 'Cannot release: the device has active playback.'}</Notice></div> : null}
          {message === 'revokedRefused' ? <div className="mt-2"><Notice kind="error">{ar ? 'تعذّر التحرير: الجهاز محظور.' : 'Cannot release: the device is banned.'}</Notice></div> : null}
          {message === 'unavailable' ? <div className="mt-2"><Notice kind="error">{ar ? 'تعذّر التحرير. حاول مرة أخرى.' : 'Could not release. Please retry.'}</Notice></div> : null}
          {message === 'unconfirmed' ? <div className="mt-2" role="status"><Notice kind="info">{ar ? 'لم يصل رد واضح لطلب التحرير. تتم إعادة فحص القائمة — انتظر التحديث قبل اتخاذ قرار.' : 'The release request did not return a clear answer. The list is being rechecked — wait for the refresh before deciding.'}</Notice></div> : null}
          {message === 'unconfirmedNoInspection' ? <div className="mt-2"><Notice kind="error">{ar ? 'نتيجة التحرير غير مؤكدة وتعذّرت إعادة فحص القائمة. لا تعِد الإرسال دون تحقق؛ راجع سجل التدقيق أولًا.' : 'The release outcome is unconfirmed and the list could not be rechecked. Do not resubmit blindly; verify in the audit log first.'}</Notice></div> : null}
          {message === 'likelyReleased' ? <div className="mt-2"><Notice kind="info">{ar ? 'انتهت مهلة طلب التحرير، والجهاز لم يعد ظاهرًا في القائمة، مما يشير إلى نجاح التحرير — لكن هذا غير مؤكد. تحقق في سجل التدقيق قبل أي إجراء آخر.' : 'The release request timed out, and the device is no longer listed, which suggests the release succeeded — but this is not confirmed. Verify in the audit log before any further action.'}</Notice></div> : null}
          {message === 'stillListed' ? <div className="mt-2"><Notice kind="info">{ar ? 'كانت نتيجة التحرير غير مؤكدة، لكن الجهاز لا يزال ظاهرًا، فلم تُحرَّر أي خانة. يمكن إعادة المحاولة بأمان.' : 'The release outcome was uncertain, but the device is still listed, so no slot was freed. It is safe to retry.'}</Notice></div> : null}
          <ul className="mt-3 grid gap-3">
            {data.devices.map((d) => (
              <li key={d.reference} className="rounded-control border border-border p-3">
                <p className="text-sm"><span className="text-muted">{ar ? 'الحالة' : 'Status'}: </span><strong>{d.status === 'REVOKED' ? (ar ? 'محظور' : 'Banned') : d.status}</strong></p>
                <p className="text-sm"><span className="text-muted">{ar ? 'آخر ظهور' : 'Last seen'}: </span>{formatDateTime(d.lastSeenAt, lang)}</p>
                <p className="text-sm"><span className="text-muted">{ar ? 'تشغيل نشط' : 'Active playback'}: </span>{d.activePlayback ? (ar ? 'نعم — لا يمكن التحرير' : 'Yes — cannot release') : (ar ? 'لا' : 'No')}</p>
                {d.releasable ? (
                  <div className="mt-2">
                    <p className="text-sm text-muted">
                      {ar
                        ? 'يحرر خانة تسجيل، ويحفظ السجل، ويسمح لهذا المتصفح بالتسجيل مجددًا ضمن الحد. لا يلغي الحظر ولا يوقف تشغيلًا نشطًا.'
                        : 'Frees a registration slot, preserves history, and lets that browser register again within the limit. It does not unban or stop active playback.'}
                    </p>
                    <div className="mt-2">
                      <Button
                        variant="secondary"
                        disabled={releasing === d.reference || busy}
                        onClick={() => {
                          const confirmed = window.confirm(ar ? 'تأكيد تحرير هذا التسجيل غير النشط؟' : 'Confirm releasing this inactive registration?');
                          if (confirmed) void release(d.reference);
                        }}
                      >
                        {releasing === d.reference ? (ar ? 'جارٍ التحرير…' : 'Releasing…') : (ar ? 'تحرير جهاز غير نشط' : 'Release inactive device')}
                      </Button>
                    </div>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
          {data.devices.length === 0 ? <p className="mt-2 text-sm text-muted">{ar ? 'لا توجد تسجيلات.' : 'No registrations.'}</p> : null}
        </div>
      ) : null}
    </section>
  );
}
