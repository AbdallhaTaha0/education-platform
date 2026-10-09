import { useEffect, useRef, useState } from 'react';
import { ApiError } from '../../../auth';
import { localizeCode, useLang } from '../../../i18n';
import { Button } from '../../../components/ui/Button';
import { Field } from '../../../components/ui/Field';
import { Notice } from '../../../components/ui/Notice';
import { completeMedia, registerMedia, syncLessonMedia, removeLessonVideo } from '../api/client';
import { ConfirmDialog } from '../../../components/ui/Dialog';
import { isSupportedVideoMime } from '../types/models';
import { businessState } from '../../../components/ui/AdminNavigation';
import { ProgressBar } from '../../../components/ui/ProgressBar';
import { uploadVideo } from '../api/upload';
import { useUnsavedChanges } from '../../../components/ui/UnsavedChanges';

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
  canReplace = false,
}: {
  lessonId: string;
  mediaStatus: string | null;
  onChanged: () => Promise<void>;
  blockedReason?: string;
  canReplace?: boolean;
}): JSX.Element {
  const { t,lang } = useLang();
  const fileRef = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(false);
  const syncInFlight = useRef(false);
  const changed = useRef(onChanged);
  useEffect(() => { changed.current = onChanged; }, [onChanged]);
  const [confirmRemove, setConfirmRemove] = useState(false);
  async function remove(): Promise<void> {
    if (busy || syncInFlight.current || !canReplace) return;
    setBusy(true); setError(null);
    try { await removeLessonVideo(lessonId); setPhase(null); setConfirmRemove(false); if (fileRef.current) fileRef.current.value = ''; await onChanged(); }
    catch (e) { setError(e instanceof ApiError ? e.code : 'SERVICE_ERROR'); }
    finally { setBusy(false); }
  }
  useUnsavedChanges(busy, lang === 'ar' ? 'رفع الفيديو قيد التنفيذ. ترك الدرس سيوقف الرفع. هل تريد المتابعة؟' : 'Video upload is in progress. Leaving this lesson will stop the upload. Continue?');
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

  useEffect(() => {
    if (busy || phase === 'ready' || phase === 'failed' ||
      (phase !== 'syncing' && mediaStatus !== 'PROCESSING' && mediaStatus !== 'UPLOADED')) return;
    let live = true;
    let timer: ReturnType<typeof setTimeout>;
    let failures = 0;
    const schedule = (delay: number) => { if (live) timer = setTimeout(() => void poll(), delay); };
    async function poll(): Promise<void> {
      if (!live) return;
      if (document.hidden || syncInFlight.current) { schedule(3000); return; }
      syncInFlight.current = true;
      setChecking(true);
      try {
        const status = await syncLessonMedia(lessonId);
        if (!live) return;
        failures = 0;
        setError(null);
        if (status === 'READY' || status === 'FAILED' || status === 'DELETION_FAILED') {
          setPhase(status === 'READY' ? 'ready' : 'failed');
          await changed.current();
          return;
        }
        setPhase('syncing');
      } catch (err) {
        if (!live) return;
        failures += 1;
        setError(err instanceof ApiError ? err.code : 'SERVICE_ERROR');
        if (err instanceof ApiError && [401, 403, 404].includes(err.status)) return;
      } finally {
        syncInFlight.current = false;
        if (live) setChecking(false);
      }
      schedule(failures ? Math.min(3000 * 2 ** failures, 30000) : 3000);
    }
    schedule(0);
    return () => { live = false; clearTimeout(timer); setChecking(false); };
  }, [lessonId, mediaStatus, phase, busy]);

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
    if (busy || syncInFlight.current) return;
    syncInFlight.current = true;
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
      syncInFlight.current = false;
      setBusy(false);
    }
  }

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2 [&>div]:min-w-0 [&>div]:max-w-full" data-testid={`uploader-${lessonId}`}>
      <Field id={`file-${lessonId}`} label={t.fieldVideoFile}>
        <input
          ref={fileRef}
          id={`file-${lessonId}`}
          type="file"
          disabled={busy || !!blockedReason || (mediaStatus !== null && mediaStatus !== 'UPLOAD_PENDING')}
          accept="video/mp4,video/webm,video/quicktime,.mov"
          className="min-h-[44px] max-w-full"
        />
      </Field>
      <Button variant="secondary" disabled={busy || !!blockedReason || (mediaStatus !== null && mediaStatus !== 'UPLOAD_PENDING')} disabledReason={blockedReason} onClick={() => void run()}>
        {t.actionRegister}
      </Button>
      {mediaStatus && canReplace ? <Button variant="secondary" disabled={busy || checking} data-testid="remove-draft-video" onClick={() => setConfirmRemove(true)}>{lang === 'ar' ? 'إزالة / استبدال الفيديو' : 'Remove / replace video'}</Button> : null}
      <ConfirmDialog open={confirmRemove} title={lang === 'ar' ? 'إزالة فيديو المسودة' : 'Remove draft video'} body={lang === 'ar' ? 'يبقى فيديو الإصدار المنشور متاحًا. يجب رفع بديل جاهز قبل نشر المسودة. ستُحذف الفيديوهات القديمة غير المستخدمة بأمان.' : 'The published video stays available. Upload a ready replacement before publishing this draft. Unused old videos will be cleaned up safely.'} confirmLabel={lang === 'ar' ? 'إزالة من المسودة' : 'Remove from draft'} cancelLabel={t.actionCancel} onConfirm={() => void remove()} onCancel={() => { if (!busy) setConfirmRemove(false); }} />
      <Button variant="secondary" disabled={busy || checking} onClick={() => void sync()}>
        {t.actionSync}
      </Button>
      {phase !== null ? (
        <span role="status" aria-live="polite" className="text-sm text-muted">
          {({registering:lang==='ar'?'تسجيل الفيديو':'Registering video',uploading:lang==='ar'?'رفع الفيديو':'Uploading video',completing:lang==='ar'?'تأكيد الرفع':'Confirming upload',syncing:lang==='ar'?'اكتمل الرفع؛ الفيديو قيد التجهيز. نتابع الحالة تلقائيًا.':'Upload complete; video processing. Status updates automatically.',ready:lang==='ar'?'الفيديو جاهز':'Video ready',failed:lang==='ar'?'فشل الرفع أو التجهيز':'Upload or processing failed'} as Record<string,string>)[phase] ?? (lang==='ar'?'تحديث الفيديو':'Updating video')}
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
