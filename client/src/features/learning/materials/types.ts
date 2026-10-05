/** Shared course-learning materials contract (frozen API v1, frontend view).
 *
 * Paths include the browser `/api` prefix. All JSON success responses use
 * `{data: ...}`; errors use the existing safe `{error:{code,message}}`.
 * Auth is cookies + Origin/session CSRF; ADMIN/subscription/lesson checks are
 * server-side. Durations are nullable and never guessed on the client.
 */

export type CaptionLanguage = 'ar' | 'en';

export interface MaterialCaption {
  id: string;
  language: CaptionLanguage;
  labelAr: string;
  labelEn: string;
  byteSize: number;
}

export interface MaterialResource {
  id: string;
  labelAr: string;
  labelEn: string;
  fileName: string;
  mimeType: string;
  byteSize: number;
}

export interface LessonMaterials {
  lessonId: string;
  durationSeconds: number | null;
  captions: MaterialCaption[];
  resources: MaterialResource[];
}

export type MaterialState =
  | 'AVAILABLE'
  | 'PENDING'
  | 'INVALID'
  | 'REMOVED';

export interface AdminMaterialCaption extends MaterialCaption {
  inherited?: boolean;
  state: MaterialState;
}

export interface AdminMaterialResource extends MaterialResource {
  inherited?: boolean;
  state: MaterialState;
}

export interface AdminLessonMaterials {
  lessonId: string;
  durationSeconds: number | null;
  captions: AdminMaterialCaption[];
  resources: AdminMaterialResource[];
}

export const MATERIAL_ERROR_CODES = [
  'MATERIAL_INVALID',
  'MATERIAL_TOO_LARGE',
  'MATERIAL_NOT_FOUND',
  'MATERIAL_STORAGE_UNAVAILABLE',
] as const;

export const ALLOWED_RESOURCE_MIMES = [
  'application/pdf',
  'application/zip',
  'application/x-zip-compressed',
  'text/plain',
  'text/javascript',
  'application/javascript',
  'application/json',
] as const;

export const MAX_RESOURCE_BYTES = 10 * 1024 * 1024;
export const MAX_CAPTION_BYTES = 1 * 1024 * 1024;
export const MAX_LABEL_CHARS = 200;

export function captionLabel(caption: Pick<MaterialCaption, 'labelAr' | 'labelEn'>, lang: 'ar' | 'en'): string {
  return lang === 'ar' ? caption.labelAr : caption.labelEn;
}

export function resourceLabel(resource: Pick<MaterialResource, 'labelAr' | 'labelEn'>, lang: 'ar' | 'en'): string {
  return lang === 'ar' ? resource.labelAr : resource.labelEn;
}

export function formatByteSize(bytes: number, lang: 'ar' | 'en'): string {
  if (!Number.isFinite(bytes) || bytes < 0) return lang === 'ar' ? 'الحجم غير معروف' : 'Size unknown';
  if (bytes < 1024) return lang === 'ar' ? `${bytes} بايت` : `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return lang === 'ar' ? `${kb.toFixed(1)} ك.ب` : `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  return lang === 'ar' ? `${mb.toFixed(1)} م.ب` : `${mb.toFixed(1)} MB`;
}
