/** Typed course-learning materials API clients (frozen contract v1).
 *
 * Student routes are entitlement-checked on the server for every request.
 * ADMIN routes require the ADMIN role and existing course-management context.
 * Auth is cookies (`credentials: include`); mutations carry the readable
 * CSRF synchronizer. No provider credentials are ever embedded in the client.
 */
import { apiFetch as authApiFetch, readCsrfCookie } from '../../../auth';
import { LearningApiError } from '../api/client';
import type { AdminLessonMaterials, LessonMaterials, MaterialResource } from './types';

const API_BASE: string = (import.meta.env['VITE_API_BASE'] as string | undefined) || '/api';

async function apiFetch<T>(...args: Parameters<typeof authApiFetch<T>>): Promise<T> {
  try { return await authApiFetch<T>(...args); }
  catch (err) {
    const error = err as { code?: string; status?: number };
    throw new LearningApiError(error.code ?? 'UNKNOWN', error.status ?? 0);
  }
}

async function parseJsonError(response: Response): Promise<never> {
  let code = 'UNKNOWN';
  try {
    const payload = (await response.json()) as { error?: { code?: unknown } };
    if (typeof payload.error?.code === 'string' && payload.error.code.length > 0) {
      code = payload.error.code;
    }
  } catch {
    // Keep the safe fallback code.
  }
  throw new LearningApiError(code, response.status);
}

function csrfHeaders(): Record<string, string> {
  const token = readCsrfCookie() ?? '';
  return token ? { 'x-csrf-token': token } : {};
}

export const lessonMaterialsApi = {
  /** Authorized student view: validated available captions/resources only. */
  async getLessonMaterials(lessonId: string): Promise<LessonMaterials> {
    const body = await apiFetch<{ data: LessonMaterials }>(
      `/learning/lessons/${encodeURIComponent(lessonId)}/materials`,
      { retryOnAuth: true },
    );
    return body.data;
  },

  /** Authenticated WebVTT bytes; caller validates and creates a Blob URL. */
  async fetchCaptionText(captionId: string): Promise<string> {
    const response = await fetch(
      `${API_BASE}/learning/captions/${encodeURIComponent(captionId)}`,
      { credentials: 'include', headers: { Accept: 'text/vtt' } },
    );
    if (!response.ok) await parseJsonError(response);
    return response.text();
  },

  /** Authenticated resource download through a short-lived Blob URL. */
  async downloadResource(resourceId: string): Promise<{ blob: Blob; fileName: string; mimeType: string }> {
    const response = await fetch(
      `${API_BASE}/learning/resources/${encodeURIComponent(resourceId)}/download`,
      { credentials: 'include', headers: { Accept: '*/*' } },
    );
    if (!response.ok) await parseJsonError(response);
    const blob = await response.blob();
    const disposition = response.headers.get('content-disposition') ?? '';
    const match = /filename\*=UTF-8''([^;\n]+)/i.exec(disposition) ?? /filename="([^"\n]+)"/i.exec(disposition);
    let fileName = `resource-${resourceId}`;
    try { if (match?.[1]) fileName = decodeURIComponent(match[1].trim()); } catch { /* safe fallback */ }
    const mimeType = response.headers.get('content-type')?.split(';')[0]?.trim() || blob.type || 'application/octet-stream';
    return { blob, fileName, mimeType };
  },
};

export const adminLessonMaterialsApi = {
  /** ADMIN inspection may include unavailable items with lifecycle state. */
  async getLessonMaterials(lessonId: string): Promise<AdminLessonMaterials> {
    const body = await apiFetch<{ data: AdminLessonMaterials }>(
      `/admin/learning/lessons/${encodeURIComponent(lessonId)}/materials`,
      { retryOnAuth: true },
    );
    return body.data;
  },

  /** Atomically replaces the validated Arabic+English pair. Both files required. */
  async uploadCaptionPair(lessonId: string, ar: File, en: File): Promise<AdminLessonMaterials> {
    const form = new FormData();
    form.append('ar', ar, ar.name);
    form.append('en', en, en.name);
    const response = await fetch(
      `${API_BASE}/admin/learning/lessons/${encodeURIComponent(lessonId)}/captions`,
      { method: 'POST', credentials: 'include', headers: { ...csrfHeaders() }, body: form },
    );
    if (!response.ok) await parseJsonError(response);
    const payload = (await response.json()) as { data: AdminLessonMaterials };
    return payload.data;
  },

  async deleteCaptions(lessonId: string): Promise<{ removed: boolean }> {
    const body = await apiFetch<{ data: { removed: boolean } }>(
      `/admin/learning/lessons/${encodeURIComponent(lessonId)}/captions`,
      { method: 'DELETE', retryOnAuth: false },
    );
    return body.data;
  },

  async uploadResource(
    lessonId: string,
    input: { labelAr: string; labelEn: string },
    file: File,
  ): Promise<{ resource: MaterialResource }> {
    const form = new FormData();
    form.append('metadata', JSON.stringify({ labelAr: input.labelAr, labelEn: input.labelEn }));
    form.append('file', file, file.name);
    const response = await fetch(
      `${API_BASE}/admin/learning/lessons/${encodeURIComponent(lessonId)}/resources`,
      { method: 'POST', credentials: 'include', headers: { ...csrfHeaders() }, body: form },
    );
    if (!response.ok) await parseJsonError(response);
    const payload = (await response.json()) as { data: { resource: MaterialResource } };
    return payload.data;
  },

  async deleteResource(resourceId: string): Promise<{ removed: boolean }> {
    const body = await apiFetch<{ data: { removed: boolean } }>(
      `/admin/learning/resources/${encodeURIComponent(resourceId)}`,
      { method: 'DELETE', retryOnAuth: false },
    );
    return body.data;
  },
};
