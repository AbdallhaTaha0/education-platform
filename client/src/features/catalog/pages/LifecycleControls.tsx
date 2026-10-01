import { useEffect, useState } from 'react';
import { ApiError } from '../../../auth';
import { localizeCode, useLang } from '../../../i18n';
import { Button } from '../../../components/ui/Button';
import { Notice } from '../../../components/ui/Notice';
import {
  archiveCourse,
  fetchLifecycleActions,
  transitionCourse,
  unarchiveCourse,
} from '../api/client';
import type { LifecycleAction } from '../types/models';

const TO_MAP: Record<string, string> = {
  PROCESSING: 'PROCESSING',
  READY: 'READY',
  PUBLISHED: 'PUBLISHED',
};

export function LifecycleControls({
  courseId,
  status,
  onChanged,
}: {
  courseId: string;
  status: string;
  onChanged: () => Promise<void>;
}): JSX.Element {
  const { t } = useLang();
  const [actions, setActions] = useState<LifecycleAction[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const list = await fetchLifecycleActions(courseId);
        if (live) setActions(list);
      } catch {
        if (live) setActions([]);
      }
    })();
    return () => {
      live = false;
    };
  }, [courseId, status]);

  async function run(fn: () => Promise<void>): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      await fn();
      await onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.code : 'SERVICE_ERROR');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-4" aria-label={t.actionTransition}>
      {error !== null ? <Notice kind="error">{localizeCode(t, error)}</Notice> : null}
      <div className="flex flex-wrap gap-2">
        {actions
          .filter((a) => a.action in TO_MAP)
          .map((a) => (
            <span key={a.action} title={a.reason ?? undefined}>
              <Button
                variant={a.action === 'PUBLISHED' ? 'primary' : 'secondary'}
                disabled={busy || !a.enabled}
                onClick={() => void run(() => transitionCourse(courseId, a.action))}
              >
                {a.action === 'PROCESSING'
                  ? 'DRAFT → PROCESSING'
                  : a.action === 'READY'
                    ? 'PROCESSING → READY'
                    : 'READY → PUBLISHED'}
              </Button>
              {!a.enabled && a.reason !== null ? <span className="sr-only">{a.reason}</span> : null}
            </span>
          ))}
        {actions.some((a) => a.action === 'ARCHIVE') ? (
          <Button
            variant="secondary"
            disabled={busy}
            onClick={() => void run(() => archiveCourse(courseId))}
          >
            {t.actionArchive}
          </Button>
        ) : null}
        {actions.some((a) => a.action === 'UNARCHIVE') ? (
          <Button
            variant="secondary"
            disabled={busy}
            onClick={() => void run(() => unarchiveCourse(courseId))}
          >
            {t.actionUnarchive}
          </Button>
        ) : null}
        {actions.length === 0 ? (
          <>
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => void run(() => transitionCourse(courseId, 'PROCESSING'))}
            >
              DRAFT → PROCESSING
            </Button>
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => void run(() => transitionCourse(courseId, 'READY'))}
            >
              PROCESSING → READY
            </Button>
            <Button
              variant="primary"
              disabled={busy}
              onClick={() => void run(() => transitionCourse(courseId, 'PUBLISHED'))}
            >
              READY → PUBLISHED
            </Button>
          </>
        ) : null}
      </div>
      <p className="mt-2 text-sm text-muted">{t.lifecycleBlocked}</p>
    </div>
  );
}
