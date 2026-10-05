import { useEffect, useRef, useState } from 'react';
import { ApiError } from '../../../auth';
import { localizeCode, useLang } from '../../../i18n';
import { Button } from '../../../components/ui/Button';
import { Field } from '../../../components/ui/Field';
import { Notice } from '../../../components/ui/Notice';
import { completeMedia, registerMedia, syncLessonMedia } from '../api/client';
import { isSupportedVideoMime } from '../types/models';
import { businessState } from '../../../components/ui/AdminNavigation';
import { ProgressBar } from '../../../components/ui/ProgressBar';
import { uploadVideo } from '../api/upload';

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
  blockedReason,
}: {
  lessonId: string;
  mediaStatus: string | null;
  onChanged: () => Promise<void>;
  blockedReason?: string;
}): JSX.Element {
  const { t,lang } = useLang();
  const fileRef = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const operation = useRef<AbortController | null>(null);
  const lastMediaStatus = useRef(mediaStatus);
  useEffect(() => () => operation.current?.abort(), []);
  useEffect(() => {
    if (lastMediaStatus.current === mediaStatus) return;
    lastMediaStatus.current = mediaStatus;
    if (phase !== 'syncing') return;
    if (mediaStatus === 'READY') setPhase('ready');
    else if (mediaStatus === 'FAILED' || mediaStatus === 'DELETION_FAILED') setPhase('failed');
  }, [mediaStatus, phase]);

  function selectedFile(): File | null {
    return fileRef.current?.files?.[0] ?? null;
  }

  async function run(): Promise<void> {
    if (busy || blockedReason) return;
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
    setProgress(undefined);
    const controller = new AbortController();
    operation.current = controller;
    try {
      setPhase('registering');
      const { uploadUrl } = await registerMedia(lessonId, {
        contentType: mime,
        securityTier: 'STANDARD',
        title: file.name.slice(0, 120),
      });
      if (controller.signal.aborted) return;
      setPhase('uploading');
      setProgress(0);
      await uploadVideo(uploadUrl, file, mime, setProgress, controller.signal);
      setProgress(100);
      setPhase('completing');
      await completeMedia(lessonId);
      if (controller.signal.aborted) return;
      setPhase('syncing');
      for (let poll = 0; poll < 10; poll += 1) {
        if (controller.signal.aborted) return;
        const status = await syncLessonMedia(lessonId);
        if (controller.signal.aborted) return;
        if (status === 'FAILED' || status === 'DELETION_FAILED') throw new Error('PROCESSING_FAILED');
        if (status === 'READY') { setPhase('ready'); break; }
        await new Promise((r) => setTimeout(r, 1500));
      }
      if (controller.signal.aborted) return;
      // 100% bytes transferred does not mean DRM processing has finished.
      await onChanged();
    } catch (err) {
      if (controller.signal.aborted) return;
      setPhase('failed');
      setError(err instanceof ApiError ? err.code : 'SERVICE_ERROR');
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  }

  async function sync(): Promise<void> {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const status = await syncLessonMedia(lessonId);
      if (status === 'READY') setPhase('ready');
      else if (status === 'FAILED' || status === 'DELETION_FAILED') setPhase('failed');
      else if (status === 'PROCESSING' || status === 'UPLOADED') setPhase('syncing');
      await onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.code : 'SERVICE_ERROR');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2" data-testid={`uploader-${lessonId}`}>
      <Field id={`file-${lessonId}`} label={t.fieldVideoFile}>
        <input
          ref={fileRef}
          id={`file-${lessonId}`}
          type="file"
          disabled={busy || !!blockedReason}
          accept="video/mp4,video/webm,video/quicktime,.mov"
          className="min-h-[44px]"
        />
      </Field>
      <Button variant="secondary" disabled={busy || !!blockedReason} disabledReason={blockedReason} onClick={() => void run()}>
        {t.actionRegister}
      </Button>
      <Button variant="secondary" disabled={busy} onClick={() => void sync()}>
        {t.actionSync}
      </Button>
      {phase !== null ? (
        <span role="status" aria-live="polite" className="text-sm text-muted">
          {({registering:lang==='ar'?'تسجيل الفيديو':'Registering video',uploading:lang==='ar'?'رفع الفيديو':'Uploading video',completing:lang==='ar'?'تأكيد الرفع':'Confirming upload',syncing:lang==='ar'?'اكتمل الرفع؛ الفيديو قيد التجهيز. حدّث الحالة للتحقق.':'Upload complete; video processing. Refresh status to check.',ready:lang==='ar'?'الفيديو جاهز':'Video ready',failed:lang==='ar'?'فشل الرفع أو التجهيز':'Upload or processing failed'} as Record<string,string>)[phase] ?? (lang==='ar'?'تحديث الفيديو':'Updating video')}
          {phase === 'uploading' && progress !== undefined ? ` ${progress}%` : ''}
          {mediaStatus !== null ? ` (${businessState(mediaStatus,lang==='ar')})` : ''}
        </span>
      ) : (
        <span className="text-sm text-muted">
          {t.mediaStatusLabel}: ({mediaStatus ? businessState(mediaStatus,lang==='ar') : '—'})
        </span>
      )}
      {phase && phase !== 'failed' ? <ProgressBar value={phase === 'uploading' ? progress : phase === 'ready' ? 100 : undefined}
        label={phase === 'uploading' ? (lang === 'ar' ? 'تقدم رفع الفيديو' : 'Video upload progress') : (lang === 'ar' ? 'تجهيز الفيديو' : 'Video preparation')} className="basis-full" /> : null}
      {error !== null ? <Notice kind="error">{localizeCode(t, error)}</Notice> : null}
    </div>
  );
}
