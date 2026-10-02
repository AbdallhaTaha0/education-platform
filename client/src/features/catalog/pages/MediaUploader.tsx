import { useRef, useState } from 'react';
import { ApiError } from '../../../auth';
import { localizeCode, useLang } from '../../../i18n';
import { Button } from '../../../components/ui/Button';
import { Field } from '../../../components/ui/Field';
import { Notice } from '../../../components/ui/Notice';
import { completeMedia, registerMedia, syncLessonMedia } from '../api/client';
import { isSupportedVideoMime } from '../types/models';
import { businessState } from '../../../components/ui/AdminNavigation';

function mimeFor(file: File): string {
  if (file.type === 'video/quicktime' || file.name.toLowerCase().endsWith('.mov'))
    return 'video/quicktime';
  return file.type;
}

/** Real-file upload flow: no dummy fallback; completion only after 2xx PUT. */
export function MediaUploader({
  lessonId,
  mediaStatus,
  onChanged,
}: {
  lessonId: string;
  mediaStatus: string | null;
  onChanged: () => Promise<void>;
}): JSX.Element {
  const { t,lang } = useLang();
  const fileRef = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function selectedFile(): File | null {
    return fileRef.current?.files?.[0] ?? null;
  }

  async function run(): Promise<void> {
    if (busy) return;
    const file = selectedFile();
    if (file === null) {
      setError('VALIDATION_ERROR');
      return;
    }
    const mime = mimeFor(file);
    if (!isSupportedVideoMime(mime)) {
      setError('VALIDATION_ERROR');
      return;
    }
    setBusy(true);
    setError(null);
    setProgress(0);
    try {
      setPhase('registering');
      const { uploadUrl } = await registerMedia(lessonId, {
        contentType: mime,
        securityTier: 'STANDARD',
        title: file.name.slice(0, 120),
      });
      setPhase('uploading');
      const put = await fetch(uploadUrl, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': mime },
      });
      if (!put.ok) {
        setPhase('failed');
        setError('SERVICE_ERROR');
        return;
      }
      setProgress(100);
      setPhase('completing');
      await completeMedia(lessonId);
      setPhase('syncing');
      for (let poll = 0; poll < 10; poll += 1) {
        const status = await syncLessonMedia(lessonId);
        if (status === 'READY' || status === 'FAILED' || status === 'DELETION_FAILED') break;
        await new Promise((r) => setTimeout(r, 1500));
      }
      setPhase('done');
      await onChanged();
    } catch (err) {
      setPhase('failed');
      setError(err instanceof ApiError ? err.code : 'SERVICE_ERROR');
    } finally {
      setBusy(false);
    }
  }

  async function sync(): Promise<void> {
    setError(null);
    try {
      await syncLessonMedia(lessonId);
      await onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.code : 'SERVICE_ERROR');
    }
  }

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2" data-testid={`uploader-${lessonId}`}>
      <Field id={`file-${lessonId}`} label={t.fieldVideoFile}>
        <input
          ref={fileRef}
          id={`file-${lessonId}`}
          type="file"
          accept="video/mp4,video/webm,video/quicktime,.mov"
          className="min-h-[44px]"
        />
      </Field>
      <Button variant="secondary" disabled={busy} onClick={() => void run()}>
        {t.actionRegister}
      </Button>
      <Button variant="secondary" disabled={busy} onClick={() => void sync()}>
        {t.actionSync}
      </Button>
      {phase !== null ? (
        <span role="status" aria-live="polite" className="text-sm text-muted">
          {({registering:lang==='ar'?'تسجيل الفيديو':'Registering video',uploading:lang==='ar'?'رفع الفيديو':'Uploading video',completing:lang==='ar'?'تأكيد الرفع':'Confirming upload',syncing:lang==='ar'?'تحديث الحالة':'Updating status',done:lang==='ar'?'اكتمل الرفع':'Upload completed',failed:lang==='ar'?'فشل الرفع':'Upload failed'} as Record<string,string>)[phase] ?? (lang==='ar'?'تحديث الفيديو':'Updating video')}
          {progress !== null ? ` ${progress}%` : ''}
          {mediaStatus !== null ? ` (${businessState(mediaStatus,lang==='ar')})` : ''}
        </span>
      ) : (
        <span className="text-sm text-muted">
          {t.mediaStatusLabel}: ({mediaStatus ? businessState(mediaStatus,lang==='ar') : '—'})
        </span>
      )}
      {error !== null ? <Notice kind="error">{localizeCode(t, error)}</Notice> : null}
    </div>
  );
}
