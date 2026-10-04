/**
 * Explicit own-session recovery (playback-recovery improvements).
 *
 * Truthfulness contract, enforced here and covered by browser checks:
 * - Restart is offered ONLY after a CONFIRMED closure, through an explicit
 *   "Start playback again" action that invokes `onRecovered`. CONFIRMED is
 *   the only proof the external stream slot was freed.
 * - QUEUED means the platform accepted the end and will retry it; the slot
 *   is NOT proven free. No restart is offered until a refresh shows the
 *   reference durably closed (termination COMPLETED / TERMINATED).
 * - NOOP means nothing was ended (already closed, foreign, or ineligible):
 *   it is reconciled with a refresh and an honest message, never a Closed
 *   message and never a restart.
 * - The selected reference is validated against the currently loaded list;
 *   stale selections are discarded with an explanation. Stale list responses
 *   never overwrite a newer refresh, and only one end request runs at a time.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useLang } from '../../../i18n';
import { learningApi } from '../api/client';
import type { OwnSession } from '../types/models';
import { Button } from '../../../components/ui/Button';
import { Loading, Notice } from '../../../components/ui/Notice';

function formatDateTime(value: string, lang: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return value;
  return date.toLocaleString(lang === 'ar' ? 'ar-EG' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' });
}

/**
 * Confirmed external closure evidence — the only states that may offer a
 * restart. The platform marks a reference ENDED before the external
 * acknowledgement arrives, so ENDED with any other termination status (null,
 * PENDING, FAILED) is NOT acknowledgement evidence and stays pending or
 * uncertain. Missing references are uncertain, never confirmed.
 */
function isConfirmedClosed(session: OwnSession): boolean {
  return session.status === 'TERMINATED' || session.terminationStatus === 'COMPLETED';
}

type Outcome = 'ended' | 'queued' | 'noop' | null;

export function OwnSessionRecovery({ onRecovered }: { onRecovered: () => void }): JSX.Element {
  const { lang } = useLang();
  const ar = lang === 'ar';
  const [sessions, setSessions] = useState<OwnSession[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [ending, setEnding] = useState(false);
  const [checking, setChecking] = useState(false);
  const [outcome, setOutcome] = useState<Outcome>(null);
  const [staleNote, setStaleNote] = useState(false);
  // Monotonic list sequence: a slower earlier response must never overwrite
  // a newer refresh.
  const listSeq = useRef(0);
  // The reference whose QUEUED closure is being tracked.
  const trackedRef = useRef<string | null>(null);
  const endingRef = useRef(false);

  const applySessions = useCallback(
    (seq: number, list: OwnSession[]) => {
      if (seq !== listSeq.current) return;
      setSessions(list);
      setLoading(false);
      // Discard a selection that is no longer listed.
      if (selected !== null && !list.some((s) => s.referenceId === selected)) {
        setSelected(null);
        setStaleNote(true);
      }
    },
    [selected],
  );

  const reload = useCallback(() => {
    const seq = listSeq.current + 1;
    listSeq.current = seq;
    setLoading(true);
    setError(false);
    learningApi
      .listOwnSessions()
      .then((body) => {
        if (seq !== listSeq.current) return;
        applySessions(seq, body.sessions);
        // A tracked QUEUED closure promotes to ended ONLY on confirmed
        // external closure evidence (TERMINATED or COMPLETED). ENDED with
        // null/PENDING/FAILED, or a missing reference, stays pending and
        // keeps the restart withheld.
        if (trackedRef.current !== null) {
          const tracked = body.sessions.find((s) => s.referenceId === trackedRef.current);
          if (tracked && isConfirmedClosed(tracked)) {
            trackedRef.current = null;
            setOutcome('ended');
          }
        }
      })
      .catch(() => {
        if (seq !== listSeq.current) return;
        setError(true);
        setLoading(false);
      });
  }, [applySessions]);

  useEffect(() => {
    reload();
  }, [reload]);

  const endSelected = useCallback(async () => {
    if (endingRef.current) return;
    // Validate against the currently loaded list; never end a stale id.
    const current = sessions?.find((s) => s.referenceId === selected) ?? null;
    if (!selected || !current) {
      setStaleNote(true);
      setSelected(null);
      reload();
      return;
    }
    endingRef.current = true;
    setEnding(true);
    setOutcome(null);
    setStaleNote(false);
    try {
      const res = await learningApi.endPlayback(selected);
      if (res.closure === 'CONFIRMED') {
        trackedRef.current = null;
        setOutcome('ended');
      } else if (res.closure === 'QUEUED') {
        trackedRef.current = selected;
        setOutcome('queued');
      } else {
        // NOOP: nothing was ended. Reconcile and explain; never offer restart.
        trackedRef.current = null;
        setOutcome('noop');
        setSelected(null);
      }
      // Reconcile state before any further action.
      reload();
    } catch {
      setError(true);
    } finally {
      endingRef.current = false;
      setEnding(false);
    }
  }, [selected, sessions, reload]);

  const checkStatus = useCallback(() => {
    setChecking(true);
    reload();
    // `reload` is synchronous in dispatching; clear the spinner on next tick
    // once the fresh list has been applied.
    window.setTimeout(() => setChecking(false), 0);
  }, [reload]);

  return (
    <section aria-label={ar ? 'استعادة جلسة سابقة' : 'Recover a previous session'} className="mt-4 rounded-card border border-border bg-surface p-4">
      <h3 className="text-lg font-bold">{ar ? 'استعادة جلسة سابقة' : 'Recover a previous session'}</h3>
      <p className="mt-1 text-sm text-muted">
        {ar
          ? 'أوقف تشغيل الفيديو على جهاز آخر ثم حاول مجددًا. يمكنك مراجعة جلساتك السابقة وإنهاء الجلسة التي اخترتها فقط. حالة ACTIVE وحدها لا تثبت أن شخصًا يشاهد الآن.'
          : 'Stop playback on the other device, then try again. You can review your own previous sessions and end only the session you select. ACTIVE state alone does not prove someone is watching.'}
      </p>
      {loading ? <Loading text={ar ? 'جارٍ التحميل…' : 'Loading…'} /> : null}
      {error ? (
        <div className="mt-2">
          <Notice kind="error">{ar ? 'تعذّر تحميل الجلسات. حاول مرة أخرى.' : 'Could not load sessions. Please retry.'}</Notice>
          <div className="mt-2"><Button variant="secondary" onClick={reload}>{ar ? 'إعادة المحاولة' : 'Retry'}</Button></div>
        </div>
      ) : null}
      {staleNote ? (
        <div className="mt-2" role="status">
          <Notice kind="info">{ar ? 'الجلسة المحددة لم تعد في القائمة. تم تحديث القائمة — اختر مجددًا من الجلسات الحالية.' : 'The selected session is no longer in the list. The list was refreshed — choose again from the current sessions.'}</Notice>
        </div>
      ) : null}
      {sessions && sessions.length === 0 ? (
        <p className="mt-2 text-sm text-muted">{ar ? 'لا توجد جلسات سابقة قابلة للاستعادة.' : 'No previous sessions available for recovery.'}</p>
      ) : null}
      {sessions && sessions.length > 0 ? (
        <div className="mt-3">
          <p className="text-sm font-semibold">{ar ? 'جلساتك السابقة' : 'Your previous sessions'}</p>
          <ul className="mt-2 grid gap-2" role="radiogroup" aria-label={ar ? 'جلساتك السابقة' : 'Your previous sessions'}>
            {sessions.map((s) => (
              <li key={s.referenceId} className="rounded-control border border-border p-3">
                <label className="flex cursor-pointer items-start gap-2">
                  <input
                    type="radio"
                    name="own-session"
                    checked={selected === s.referenceId}
                    onChange={() => {
                      setSelected(s.referenceId);
                      setOutcome(null);
                      setStaleNote(false);
                    }}
                  />
                  <span className="text-sm">
                    <strong>{ar ? s.lessonTitleAr || s.lessonTitleEn : s.lessonTitleEn || s.lessonTitleAr}</strong>
                    <br />
                    <span className="text-muted">{ar ? s.courseTitleAr || s.courseTitleEn : s.courseTitleEn || s.courseTitleAr}</span>
                    <br />
                    <span className="text-muted">{formatDateTime(s.createdAt, lang)} · {s.status}{s.terminationStatus ? ` / ${s.terminationStatus}` : ''}</span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-sm text-muted">
            {ar
              ? 'إنهاء الجلسة قد يقطع تشغيلها في مكان آخر. لن يؤثر على تقدمك أو نجاحاتك.'
              : 'Ending the session may interrupt its playback elsewhere. Your progress and passes are preserved.'}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button variant="secondary" disabled={!selected || ending} disabledReason={ending ? undefined : { ar: "اختر جلسة من القائمة لإنهائها.", en: "Choose a session from the list to end it." }} onClick={() => void endSelected()}>
              {ending ? (ar ? 'جارٍ الإنهاء…' : 'Ending…') : (ar ? 'إنهاء الجلسة المحددة' : 'End selected session')}
            </Button>
            {outcome === 'queued' ? (
              <Button variant="secondary" disabled={checking || loading} onClick={checkStatus}>
                {checking || loading ? (ar ? 'جارٍ التحقق…' : 'Checking…') : (ar ? 'التحقق من الحالة' : 'Check status')}
              </Button>
            ) : null}
          </div>
          {outcome === 'ended' ? (
            <div className="mt-2">
              <Notice kind="success">{ar ? 'تم الإغلاق والتأكيد. يمكنك بدء التشغيل مجددًا.' : 'Closed and confirmed. You can start playback again.'}</Notice>
              <div className="mt-2">
                <Button variant="secondary" onClick={onRecovered}>{ar ? 'بدء التشغيل مجددًا' : 'Start playback again'}</Button>
              </div>
            </div>
          ) : null}
          {outcome === 'queued' ? (
            <div className="mt-2"><Notice kind="info">{ar ? 'تم إرسال طلب الإغلاق وستتم إعادة المحاولة تلقائيًا. لا تبدأ التشغيل حتى يتم التأكيد.' : 'Closure requested and will be retried automatically. Do not start playback until confirmed.'}</Notice></div>
          ) : null}
          {outcome === 'noop' ? (
            <div className="mt-2"><Notice kind="info">{ar ? 'لم يتم إنهاء شيء: الجلسة مغلقة بالفعل أو تعذّر تأكيدها. تم تحديث القائمة — اختر جلسة لا تزال ACTIVE.' : 'Nothing was ended: the session was already closed or could not be confirmed. The list was refreshed — select a session that still shows ACTIVE.'}</Notice></div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
