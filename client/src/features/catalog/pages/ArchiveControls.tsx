import { useState } from 'react';
import { ApiError } from '../../../auth';
import { localizeCode, useLang } from '../../../i18n';
import { Button } from '../../../components/ui/Button';
import { ConfirmDialog } from '../../../components/ui/Dialog';
import { Notice } from '../../../components/ui/Notice';
import { archiveCourse, unarchiveCourse } from '../api/client';

export function ArchiveControls({
  courseId,
  archived,
  onChanged,
}: {
  courseId: string;
  archived: boolean;
  onChanged: () => Promise<void>;
}): JSX.Element {
  const { t } = useLang();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(fn: () => Promise<void>): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      await fn();
      setConfirming(false);
      await onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.code : 'SERVICE_ERROR');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-4">
      {error !== null ? <Notice kind="error">{localizeCode(t, error)}</Notice> : null}
      {!archived ? (
        <Button variant="secondary" disabled={busy} onClick={() => setConfirming(true)}>
          {t.actionArchive}
        </Button>
      ) : (
        <Button
          variant="secondary"
          disabled={busy}
          onClick={() => void run(() => unarchiveCourse(courseId))}
        >
          {t.actionUnarchive}
        </Button>
      )}
      <ConfirmDialog
        open={confirming}
        title={t.actionArchive}
        body={t.confirmArchive}
        confirmLabel={t.actionArchive}
        cancelLabel={t.actionCancel}
        onConfirm={() => void run(() => archiveCourse(courseId))}
        onCancel={() => setConfirming(false)}
      />
    </div>
  );
}
