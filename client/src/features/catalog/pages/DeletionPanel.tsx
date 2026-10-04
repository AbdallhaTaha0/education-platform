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

  async function request(): Promise<void> {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const op = await requestDeletion(kind, targetId, confirmation);
      setOperation(op);
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
