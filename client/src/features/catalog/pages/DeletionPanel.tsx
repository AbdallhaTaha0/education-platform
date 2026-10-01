import { useEffect, useState } from 'react';
import { ApiError } from '../../../auth';
import { localizeCode, useLang } from '../../../i18n';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { Field, textInputClassName } from '../../../components/ui/Field';
import { Notice } from '../../../components/ui/Notice';
import { fetchDeletion, requestDeletion, retryDeletion } from '../api/client';
import type { DeletionOperation } from '../types/models';

interface DeletionPanelProps {
  kind: 'courses' | 'sections' | 'lessons';
  targetId: string;
  expectedConfirmation: string;
  onChanged: () => Promise<void>;
}

export function DeletionPanel({
  kind,
  targetId,
  expectedConfirmation,
  onChanged,
}: DeletionPanelProps): JSX.Element {
  const { t } = useLang();
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
    <Card className="mt-4" data-testid={`deletion-${targetId}`}>
      <h2 className="text-xl font-bold">{t.actionDelete}</h2>
      <p className="mt-1 text-muted">{t.confirmDelete}</p>
      {error !== null ? <Notice kind="error">{localizeCode(t, error)}</Notice> : null}
      <Field id={`del-${targetId}`} label={t.fieldSlug} dir="ltr">
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
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="danger"
          disabled={busy}
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
          <span role="status" aria-live="polite" className="text-sm font-semibold">
            {operation.status === 'COMPLETED'
              ? t.deleteCompleted
              : operation.status === 'FAILED'
                ? t.deleteFailed
                : t.deleteProgress}{' '}
            ({operation.status})
          </span>
        ) : null}
      </div>
    </Card>
  );
}
