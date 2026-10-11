import { useEffect, useState } from 'react';
import { ApiError } from '../../../auth';
import { localizeCode, useLang } from '../../../i18n';
import { Button } from '../../../components/ui/Button';
import { FormActions } from '../../../components/ui/FormActions';
import { Field, textInputClassName } from '../../../components/ui/Field';
import { Notice } from '../../../components/ui/Notice';
import { fetchDeletion, requestDeletion, retryDeletion } from '../api/client';
import type { DeletionOperation } from '../types/models';
import { businessState } from '../../../components/ui/AdminNavigation';
import { Dialog } from '../../../components/ui/Dialog';

interface DeletionPanelProps {
  kind: 'courses' | 'sections' | 'lessons';
  targetId: string;
  expectedConfirmation: string;
  entityName?: string;
  onChanged: () => Promise<void>;
}

export function DeletionPanel({
  kind,
  targetId,
  expectedConfirmation,
  entityName,
  onChanged,
}: DeletionPanelProps): JSX.Element {
  const { t, lang } = useLang(); const ar = lang === 'ar';
  const [confirmation, setConfirmation] = useState('');
  const [operation, setOperation] = useState<DeletionOperation | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmLesson, setConfirmLesson] = useState(false);

  useEffect(() => {
    if (operation === null || operation.status === 'COMPLETED') return;
    const timer = setTimeout(() => {
      void (async () => {
        try {
          setOperation(await fetchDeletion(operation.id));
        } catch {
          // Poll failures keep the last truthful state.
        }
      })();
    }, 4000);
    return () => clearTimeout(timer);
  }, [operation]);

  async function request(value = confirmation): Promise<void> {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const op = await requestDeletion(kind, targetId, value);
      setOperation(op);
      setConfirmLesson(false);
      await onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.code : 'SERVICE_ERROR');
    } finally {
      setBusy(false);
    }
  }

  async function retry(): Promise<void> {
    if (operation === null || busy) return;
    setBusy(true);
    setError(null);
    try {
      setOperation(await retryDeletion(operation.id));
      await onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.code : 'SERVICE_ERROR');
    } finally {
      setBusy(false);
    }
  }

  if (kind === 'lessons') return <div className="mt-4" data-testid={`deletion-${targetId}`}>
    {error !== null ? <Notice kind="error">{localizeCode(t, error)}</Notice> : null}
    <Button variant="danger" disabled={busy || operation !== null} onClick={() => { setError(null); setConfirmLesson(true); }} data-testid="lesson-delete-open">
      {ar ? 'حذف الدرس' : 'Delete lesson'}
    </Button>
    <Dialog open={confirmLesson} title={`${ar ? 'حذف الدرس' : 'Delete lesson'}: ${entityName ?? targetId}`} onClose={() => { if (!busy) setConfirmLesson(false); }}>
      <p className="my-4 text-muted">{ar ? 'سيُحذف هذا الدرس وفيديوه نهائيًا. لا يمكن التراجع عن الحذف.' : 'This lesson and its video will be permanently deleted. This cannot be undone.'}</p>
      {error !== null ? <p role="alert" className="text-error-fg">{localizeCode(t, error)}</p> : null}
      <FormActions>
        <Button variant="secondary" disabled={busy} onClick={() => setConfirmLesson(false)}>{t.actionCancel}</Button>
        <Button variant="danger" disabled={busy} onClick={() => void request(expectedConfirmation)} data-testid="deletion-submit">{ar ? 'حذف نهائي' : 'Delete permanently'}</Button>
      </FormActions>
    </Dialog>
    {operation !== null ? <p role="status" className="mt-3 text-sm">{operation.status === 'COMPLETED' ? t.deleteCompleted : operation.status === 'FAILED' ? t.deleteFailed : t.deleteProgress}</p> : null}
    {operation?.status === 'FAILED' ? <Button variant="secondary" disabled={busy} onClick={() => void retry()}>{t.actionRetry}</Button> : null}
  </div>;

  return (
    <details className="mt-4 rounded-control border border-border p-3" data-testid={`deletion-${targetId}`}>
      <summary className="cursor-pointer font-bold text-error-fg">{ar?'حذف':'Delete'} {kind==='courses'?(ar?'الكورس':'course'):kind==='sections'?(ar?'القسم':'section'):(ar?'الدرس':'lesson')}: {entityName ?? targetId}</summary>
      <p className="my-3 text-muted">{ar ? (kind==='courses'?'سيُمنع الوصول إلى الكورس وتُحذف دروسه وفيديوهاته نهائيًا. تبقى السجلات المالية.':kind==='sections'?'سيُحذف هذا القسم وكل دروسه وفيديوهاته نهائيًا.':'سيُحذف هذا الدرس وفيديوه نهائيًا.') : (kind==='courses'?'Access stops and the course, lessons and videos are permanently removed. Financial records remain.':kind==='sections'?'This section and all its lessons/videos are permanently removed.':'This lesson and its video are permanently removed.')} {t.confirmDelete}</p>
      {error !== null ? <Notice kind="error">{localizeCode(t, error)}</Notice> : null}
      <Field id={`del-${targetId}`} label={kind==='courses'?t.fieldSlug:(ar?'معرّف التأكيد (UUID)':'Confirmation ID (UUID)')} dir="ltr">
        <input
          id={`del-${targetId}`}
          dir="ltr"
          data-testid="deletion-confirm"
          className={textInputClassName(false)}
          value={confirmation}
          onChange={(e) => setConfirmation(e.target.value)}
          placeholder={expectedConfirmation}
        />
      </Field>
      <FormActions className="mt-4">
        <Button
          variant="danger"
          disabled={busy || confirmation !== expectedConfirmation} disabledReason={busy ? undefined : { ar: `اكتب نص التأكيد بالضبط: ${expectedConfirmation}`, en: `Type the confirmation exactly: ${expectedConfirmation}` }}
          onClick={() => void request()}
          data-testid="deletion-submit"
        >
          {t.actionDelete}
        </Button>
        {operation !== null && operation.status !== 'COMPLETED' ? (
          <Button
            variant="secondary"
            disabled={busy}
            onClick={() => void retry()}
            data-testid="deletion-retry"
          >
            {t.actionRetry}
          </Button>
        ) : null}
        {operation !== null ? (
          <span role="status" aria-live="polite" className="w-full text-sm font-semibold">
            {operation.status === 'COMPLETED'
              ? t.deleteCompleted
              : operation.status === 'FAILED'
                ? t.deleteFailed
                : t.deleteProgress}{' '}
            ({businessState(operation.status,ar)})
          </span>
        ) : null}
      </FormActions>
    </details>
  );
}
