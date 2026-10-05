import { Button } from '../../../components/ui/Button';
import { PaginatedCollection } from '../../../components/ui/Pagination';
/** ADMIN caption-pair/resource authoring (course-learning UI).
 *
 * Uses only the frozen contract endpoints with the existing course-management
 * cookie/CSRF session. Explains the Arabic+English pair rule and file limits,
 * preserves form values on failure, and reports validation/upload/removal
 * status accessibly. The ADMIN explicitly chooses every file; this panel never
 * provisions storage or embeds provider credentials.
 */
import { useCallback, useEffect, useState } from 'react';
import { LearningApiError } from '../api/client';
import { adminLessonMaterialsApi } from './api';
import {
  MAX_CAPTION_BYTES,
  MAX_LABEL_CHARS,
  MAX_RESOURCE_BYTES,
  captionLabel,
  formatByteSize,
  resourceLabel,
  type AdminLessonMaterials,
} from './types';
import { useLang } from '../../../i18n';

function friendlyAdminError(code: string | null, lang: 'ar' | 'en'): string {
  switch (code) {
    case 'MATERIAL_INVALID':
      return lang === 'ar' ? 'الملف أو التسمية غير صالح. تحقق من النوع والمحتوى.' : 'Invalid file or label. Check the type and content.';
    case 'MATERIAL_TOO_LARGE':
      return lang === 'ar' ? 'الملف أكبر من الحد المسموح.' : 'The file exceeds the allowed size.';
    case 'MATERIAL_NOT_FOUND':
      return lang === 'ar' ? 'العنصر غير موجود.' : 'The item was not found.';
    case 'MATERIAL_STORAGE_UNAVAILABLE':
      return lang === 'ar' ? 'التخزين غير متاح حاليًا. حاول مرة أخرى.' : 'Storage is currently unavailable. Please retry.';
    default:
      return lang === 'ar' ? 'تعذّر الحفظ. تحقق من الملفات والتسميات وحاول مرة أخرى.' : 'Could not save. Check the files and labels and retry.';
  }
}

const VTT_ACCEPT = '.vtt,text/vtt';
const RESOURCE_ACCEPT = '.pdf,.zip,.txt,.js,.json,application/pdf,application/zip,text/plain,text/javascript,application/json';

function isVttFile(file: File): boolean {
  return file.name.toLowerCase().endsWith('.vtt');
}

export function AdminLessonMaterials({ lessonId }: { lessonId: string }): JSX.Element {
  const { lang } = useLang();
  const ar = lang === 'ar';
  const [materials, setMaterials] = useState<AdminLessonMaterials | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Caption pair form (values preserved on failure by keeping File objects in state).
  const [arFile, setArFile] = useState<File | null>(null);
  const [enFile, setEnFile] = useState<File | null>(null);
  const [captionBusy, setCaptionBusy] = useState(false);
  const [captionError, setCaptionError] = useState<string | null>(null);
  const [captionNotice, setCaptionNotice] = useState<string | null>(null);

  // Resource form values are preserved on failure (never cleared except on success).
  const [labelAr, setLabelAr] = useState('');
  const [labelEn, setLabelEn] = useState('');
  const [resourceFile, setResourceFile] = useState<File | null>(null);
  const [resourceBusy, setResourceBusy] = useState(false);
  const [resourceError, setResourceError] = useState<string | null>(null);
  const [resourceNotice, setResourceNotice] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const value = await adminLessonMaterialsApi.getLessonMaterials(lessonId);
      setMaterials(value);
    } catch (err) {
      setLoadError(err instanceof LearningApiError ? err.code : 'UNKNOWN');
    } finally {
      setLoading(false);
    }
  }, [lessonId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function uploadCaptions(): Promise<void> {
    if (captionBusy) return;
    setCaptionError(null);
    setCaptionNotice(null);
    if (!arFile || !enFile) {
      setCaptionError(ar ? 'اختر ملفي الترجمة العربي والإنجليزي معًا.' : 'Choose both Arabic and English caption files.');
      return;
    }
    if (!isVttFile(arFile) || !isVttFile(enFile)) {
      setCaptionError(ar ? 'يجب أن يكون الملفان بصيغة .vtt.' : 'Both files must be .vtt.');
      return;
    }
    if (arFile.size > MAX_CAPTION_BYTES || enFile.size > MAX_CAPTION_BYTES) {
      setCaptionError('MATERIAL_TOO_LARGE');
      return;
    }
    setCaptionBusy(true);
    try {
      const value = await adminLessonMaterialsApi.uploadCaptionPair(lessonId, arFile, enFile);
      setMaterials(value);
      setCaptionNotice(ar ? 'تم حفظ زوج الترجمة.' : 'Caption pair saved.');
      // Clear file pickers only on success; failures keep the chosen files.
      setArFile(null);
      setEnFile(null);
    } catch (err) {
      setCaptionError(err instanceof LearningApiError ? err.code : 'UNKNOWN');
    } finally {
      setCaptionBusy(false);
    }
  }

  async function removeCaptions(): Promise<void> {
    if (captionBusy) return;
    setCaptionBusy(true);
    setCaptionError(null);
    setCaptionNotice(null);
    try {
      await adminLessonMaterialsApi.deleteCaptions(lessonId);
      setCaptionNotice(ar ? 'تمت إزالة الترجمة.' : 'Captions removed.');
      await load();
    } catch (err) {
      setCaptionError(err instanceof LearningApiError ? err.code : 'UNKNOWN');
    } finally {
      setCaptionBusy(false);
    }
  }

  async function uploadResource(): Promise<void> {
    if (resourceBusy) return;
    setResourceError(null);
    setResourceNotice(null);
    const trimmedAr = labelAr.trim();
    const trimmedEn = labelEn.trim();
    if (!trimmedAr || !trimmedEn) {
      setResourceError(ar ? 'التسمية بالعربية والإنجليزية مطلوبة.' : 'Both Arabic and English labels are required.');
      return;
    }
    if (trimmedAr.length > MAX_LABEL_CHARS || trimmedEn.length > 200) {
      setResourceError('MATERIAL_INVALID');
      return;
    }
    if (!resourceFile) {
      setResourceError(ar ? 'اختر ملفًا أولًا.' : 'Choose a file first.');
      return;
    }
    if (resourceFile.size > MAX_RESOURCE_BYTES) {
      setResourceError('MATERIAL_TOO_LARGE');
      return;
    }
    setResourceBusy(true);
    try {
      await adminLessonMaterialsApi.uploadResource(
        lessonId,
        { labelAr: trimmedAr, labelEn: trimmedEn },
        resourceFile,
      );
      setResourceNotice(ar ? 'تم حفظ الملف.' : 'File saved.');
      // Clear only on success; failures preserve all three values.
      setLabelAr('');
      setLabelEn('');
      setResourceFile(null);
      await load();
    } catch (err) {
      setResourceError(err instanceof LearningApiError ? err.code : 'UNKNOWN');
    } finally {
      setResourceBusy(false);
    }
  }

  async function removeResource(resourceId: string): Promise<void> {
    setRemovingId(resourceId);
    setResourceError(null);
    setResourceNotice(null);
    try {
      await adminLessonMaterialsApi.deleteResource(resourceId);
      setResourceNotice(ar ? 'تمت الإزالة.' : 'Removed.');
      await load();
    } catch (err) {
      setResourceError(err instanceof LearningApiError ? err.code : 'UNKNOWN');
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <section aria-label={ar ? 'ترجمة وملفات الدرس' : 'Lesson captions and files'} data-testid={`admin-materials-${lessonId}`} className="mt-3 rounded-control border border-border p-3">
      <h4 className="font-bold">{ar ? 'ترجمة وملفات الدرس' : 'Lesson captions and files'}</h4>

      {loading ? (
        <p role="status" className="mt-2 text-sm text-muted">{ar ? 'جارٍ التحميل…' : 'Loading…'}</p>
      ) : null}
      {loadError !== null && !loading ? (
        <div className="mt-2">
          <p role="alert" className="text-sm font-semibold text-error-fg">{friendlyAdminError(loadError, lang)}</p>
          <button type="button" onClick={() => void load()} className="mt-2 inline-flex min-h-[44px] items-center rounded-control border border-border px-3 text-sm font-bold">
            {ar ? 'إعادة المحاولة' : 'Retry'}
          </button>
        </div>
      ) : null}

      {!loading && loadError === null ? (
        <>
          <div className="mt-3">
            <h5 className="text-sm font-bold">{ar ? 'ترجمة الدرس (عربي + إنجليزي)' : 'Lesson captions (Arabic + English)'}</h5>
            <p className="mt-1 text-xs text-muted">
              {ar
                ? 'ارفع ملفي WebVTT معًا؛ العربي والإنجليزي مطلوبان معًا قبل الإتاحة. الحد 1 م.ب لكل ملف.'
                : 'Upload both WebVTT files together; Arabic and English are required jointly before availability. Limit 1 MB per file.'}
            </p>
            {materials && materials.captions.length > 0 ? (
              <ul className="mt-2 space-y-1">
                {materials.captions.map((caption) => (
                  <li key={caption.id} data-testid="admin-caption-row" className="text-xs text-muted" dir="auto">
                    {caption.language === 'ar' ? (ar ? 'العربية' : 'Arabic') : (ar ? 'الإنجليزية' : 'English')}
                    {' · '}{captionLabel(caption, lang)}{' · '}{formatByteSize(caption.byteSize, lang)}{' · '}{caption.state}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-xs text-muted">{ar ? 'لا توجد ترجمة بعد.' : 'No captions yet.'}</p>
            )}
            <div className="mt-2 grid gap-2">
              <label className="text-xs font-semibold">
                {ar ? 'ملف الترجمة العربي (.vtt)' : 'Arabic caption file (.vtt)'}
                <input
                  type="file"
                  accept={VTT_ACCEPT}
                  data-testid={`admin-caption-ar-${lessonId}`}
                  onChange={(e) => setArFile(e.target.files?.[0] ?? null)}
                  className="mt-1 block min-h-[44px] w-full text-xs"
                />
                {arFile ? <span className="font-normal text-muted" dir="auto">{arFile.name} · {formatByteSize(arFile.size, lang)}</span> : null}
              </label>
              <label className="text-xs font-semibold">
                {ar ? 'ملف الترجمة الإنجليزي (.vtt)' : 'English caption file (.vtt)'}
                <input
                  type="file"
                  accept={VTT_ACCEPT}
                  data-testid={`admin-caption-en-${lessonId}`}
                  onChange={(e) => setEnFile(e.target.files?.[0] ?? null)}
                  className="mt-1 block min-h-[44px] w-full text-xs"
                />
                {enFile ? <span className="font-normal text-muted" dir="auto">{enFile.name} · {formatByteSize(enFile.size, lang)}</span> : null}
              </label>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              <Button unstyled type="button" disabled={captionBusy} onClick={() => void uploadCaptions()} data-testid={`admin-caption-upload-${lessonId}`} className="inline-flex min-h-[44px] items-center rounded-control bg-primary px-3 text-sm font-bold text-primary-ink disabled:opacity-60">
                {ar ? 'رفع الزوج' : 'Upload pair'}
              </Button>
              <Button unstyled type="button" disabled={captionBusy || materials?.captions.some(c => c.inherited)} onClick={() => void removeCaptions()} data-testid={`admin-caption-remove-${lessonId}`} className="inline-flex min-h-[44px] items-center rounded-control border border-border px-3 text-sm font-bold">
                {ar ? 'إزالة الترجمة' : 'Remove captions'}
              </Button>
            </div>
            {materials?.captions.some(c => c.inherited) ? <p className="mt-2 text-xs text-muted">{ar ? 'ترجمة الإصدار المنشور محفوظة. رفع زوج جديد هنا يستبدلها عند نشر المسودة.' : 'Published captions are retained. Uploading a new pair here replaces them when the draft is published.'}</p> : null}
            {captionBusy ? <p role="status" className="mt-1 text-xs text-muted">{ar ? 'جارٍ الحفظ…' : 'Saving…'}</p> : null}
            {captionNotice ? <p role="status" className="mt-1 text-xs font-semibold">{captionNotice}</p> : null}
            {captionError ? <p role="alert" data-testid={`admin-caption-error-${lessonId}`} className="mt-1 text-xs font-semibold text-error-fg">{captionError.startsWith('MATERIAL_') ? friendlyAdminError(captionError, lang) : captionError}</p> : null}
          </div>

          <div className="mt-4">
            <h5 className="text-sm font-bold">{ar ? 'ملفات الدرس المحمية' : 'Protected lesson files'}</h5>
            <p className="mt-1 text-xs text-muted">
              {ar
                ? 'أضف تسمية بالعربية والإنجليزية (حتى 200 حرف) واختر ملفًا: PDF أو ZIP أو TXT أو JS أو JSON حتى 10 م.ب. ملف ZIP للتحميل فقط ولا يُفك أو يُشغَّل.'
                : 'Add Arabic and English labels (up to 200 characters) and choose a file: PDF, ZIP, TXT, JS or JSON up to 10 MB. ZIP is download-only and never extracted or executed.'}
            </p>
            {materials && materials.resources.length > 0 ? (
              <PaginatedCollection as="ul" id={`admin-resources-${lessonId}`} className="mt-2 space-y-1" disabled={removingId !== null}>
                {materials.resources.map((resource) => (
                  <li key={resource.id} data-testid="admin-resource-row" className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="min-w-0 flex-1" dir="auto">
                      {resourceLabel(resource, lang)}{' · '}{resource.inherited ? (ar ? 'محفوظ من الإصدار المنشور' : 'Retained from published version') : resource.state}
                      <span dir="ltr" className="block text-muted">{resource.fileName} · {resource.mimeType} · {formatByteSize(resource.byteSize, lang)}</span>
                    </span>
                    <Button unstyled type="button" disabled={removingId !== null || resource.inherited} onClick={() => void removeResource(resource.id)} data-testid={`admin-resource-remove-${resource.id}`} className="inline-flex min-h-[44px] items-center rounded-control border border-border px-2 font-bold">
                      {removingId === resource.id ? (ar ? 'جارٍ الإزالة…' : 'Removing…') : (ar ? 'إزالة' : 'Remove')}
                    </Button>
                  </li>
                ))}
              </PaginatedCollection>
            ) : (
              <p className="mt-2 text-xs text-muted">{ar ? 'لا توجد ملفات بعد.' : 'No files yet.'}</p>
            )}
            <div className="mt-2 grid gap-2">
              <label className="text-xs font-semibold">
                {ar ? 'التسمية بالعربية' : 'Arabic label'}
                <input type="text" value={labelAr} maxLength={MAX_LABEL_CHARS} onChange={(e) => setLabelAr(e.target.value)} data-testid={`admin-resource-label-ar-${lessonId}`} className="mt-1 block min-h-[44px] w-full rounded-control border border-border bg-surface px-2" />
              </label>
              <label className="text-xs font-semibold" dir="ltr">
                {ar ? 'التسمية بالإنجليزية' : 'English label'}
                <input type="text" value={labelEn} maxLength={200} onChange={(e) => setLabelEn(e.target.value)} data-testid={`admin-resource-label-en-${lessonId}`} dir="ltr" className="mt-1 block min-h-[44px] w-full rounded-control border border-border bg-surface px-2" />
              </label>
              <label className="text-xs font-semibold">
                {ar ? 'الملف' : 'File'}
                <input type="file" accept={RESOURCE_ACCEPT} onChange={(e) => setResourceFile(e.target.files?.[0] ?? null)} data-testid={`admin-resource-file-${lessonId}`} className="mt-1 block min-h-[44px] w-full text-xs" />
                {resourceFile ? <span className="font-normal text-muted" dir="auto">{resourceFile.name} · {formatByteSize(resourceFile.size, lang)}</span> : null}
              </label>
            </div>
            <Button unstyled type="button" disabled={resourceBusy} onClick={() => void uploadResource()} data-testid={`admin-resource-upload-${lessonId}`} className="mt-2 inline-flex min-h-[44px] items-center rounded-control bg-primary px-3 text-sm font-bold text-primary-ink disabled:opacity-60">
              {ar ? 'إضافة الملف' : 'Add file'}
            </Button>
            {resourceBusy ? <p role="status" className="mt-1 text-xs text-muted">{ar ? 'جارٍ الحفظ…' : 'Saving…'}</p> : null}
            {resourceNotice ? <p role="status" className="mt-1 text-xs font-semibold">{resourceNotice}</p> : null}
            {resourceError ? <p role="alert" data-testid={`admin-resource-error-${lessonId}`} className="mt-1 text-xs font-semibold text-error-fg">{resourceError.startsWith('MATERIAL_') ? friendlyAdminError(resourceError, lang) : resourceError}</p> : null}
          </div>
        </>
      ) : null}
    </section>
  );
}
