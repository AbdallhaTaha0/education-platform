import { useEffect, useRef, useState, type MutableRefObject } from 'react';
import { assessmentApi, errorLabel } from './api';

/** Serialize saves and reschedule edits made during an in-flight request. */
export function useDraftSave<T>({ value, dirty, enabled, endpoint, revision, extra, ar, clearDirty }: { value: T; dirty: boolean; enabled: boolean; endpoint: string; revision: MutableRefObject<number>; extra?: Record<string, unknown>; ar: boolean; clearDirty: () => void }): string {
  const [status, setStatus] = useState(''); const [cycle, setCycle] = useState(0);
  const busy = useRef(false); const latest = useRef({ value, extra, clearDirty });
  const mounted = useRef(true); const generation = useRef(endpoint);
  generation.current = endpoint;
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  latest.current = { value, extra, clearDirty };
  const serialized = JSON.stringify(value);
  useEffect(() => {
    if (!dirty || !enabled) return;
    const timer = setTimeout(() => {
      if (busy.current) return;
      busy.current = true; const snapshot = latest.current; const sent = JSON.stringify(snapshot.value);
      setStatus(ar ? 'جارٍ الحفظ…' : 'Saving…');
      void assessmentApi<{ revision: number }>(endpoint, 'PUT', { ...snapshot.extra, content: snapshot.value, revision: revision.current }).then((saved) => {
        if (!mounted.current || generation.current !== endpoint) return;
        revision.current = saved.revision;
        if (JSON.stringify(latest.current.value) === sent) latest.current.clearDirty();
        setStatus(ar ? 'تم الحفظ' : 'Saved');
        // The request may finish after its effect was replaced by a newer edit.
        setCycle((n) => n + 1);
      }).catch((error) => { if (mounted.current && generation.current === endpoint) setStatus(errorLabel(error, ar)); }).finally(() => { busy.current = false; });
    }, 1800 + Math.random() * 300);
    return () => { clearTimeout(timer); };
  }, [serialized, dirty, enabled, endpoint, revision, ar, cycle]);
  if (['Saved', 'تم الحفظ'].includes(status)) return ar ? 'تم الحفظ' : 'Saved';
  if (['Saving…', 'جارٍ الحفظ…'].includes(status)) return ar ? 'جارٍ الحفظ…' : 'Saving…';
  return status;
}
