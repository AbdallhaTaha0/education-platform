/** Typed course-learning materials API clients (frozen contract v1).
 *
 * Student routes are entitlement-checked on the server for every request.
 * ADMIN routes require the ADMIN role and existing course-management context.
 * Auth is cookies (`credentials: include`); mutations carry the readable
 * CSRF synchronizer. No provider credentials are ever embedded in the client.
 */
import {
  apiFetch as authApiFetch,
  apiResponse as authApiResponse,
} from "../../../auth";
import { LearningApiError } from "../api/client";
import type {
  AdminLessonMaterials,
  LessonMaterials,
  MaterialResource,
} from "./types";

async function apiFetch<T>(
  ...args: Parameters<typeof authApiFetch<T>>
): Promise<T> {
  try {
    return await authApiFetch<T>(...args);
  } catch (err) {
    const error = err as { code?: string; status?: number };
    throw new LearningApiError(error.code ?? "UNKNOWN", error.status ?? 0);
  }
}

async function apiResponse(
  ...args: Parameters<typeof authApiResponse>
): Promise<Response> {
  try {
    return await authApiResponse(...args);
  } catch (err) {
    const error = err as { code?: string; status?: number };
    throw new LearningApiError(error.code ?? "UNKNOWN", error.status ?? 0);
  }
}

export const lessonMaterialsApi = {
  /** Authorized student view: protected resources only. */
  async getLessonMaterials(lessonId: string): Promise<LessonMaterials> {
    const body = await apiFetch<{ data: LessonMaterials }>(
      `/learning/lessons/${encodeURIComponent(lessonId)}/materials`,
      { retryOnAuth: true },
    );
    return body.data;
  },

  /** Authenticated resource download through a short-lived Blob URL. */
  async downloadResource(
    resourceId: string,
  ): Promise<{ blob: Blob; fileName: string; mimeType: string }> {
    const response = await apiResponse(
      `/learning/resources/${encodeURIComponent(resourceId)}/download`,
      { headers: { Accept: "*/*" } },
    );
    const blob = await response.blob();
    const disposition = response.headers.get("content-disposition") ?? "";
    const match =
      /filename\*=UTF-8''([^;\n]+)/i.exec(disposition) ??
      /filename="([^"\n]+)"/i.exec(disposition);
    let fileName = `resource-${resourceId}`;
    try {
      if (match?.[1]) fileName = decodeURIComponent(match[1].trim());
    } catch {
      /* safe fallback */
    }
    const mimeType =
      response.headers.get("content-type")?.split(";")[0]?.trim() ||
      blob.type ||
      "application/octet-stream";
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

  async uploadResource(
    lessonId: string,
    input: { labelAr: string; labelEn: string },
    file: File,
  ): Promise<{ resource: MaterialResource }> {
    const form = new FormData();
    form.append(
      "metadata",
      JSON.stringify({ labelAr: input.labelAr, labelEn: input.labelEn }),
    );
    form.append("file", file, file.name);
    const response = await apiResponse(
      `/admin/learning/lessons/${encodeURIComponent(lessonId)}/resources`,
      { method: "POST", retryOnAuth: true, body: form },
    );
    const payload = (await response.json()) as {
      data: { resource: MaterialResource };
    };
    return payload.data;
  },

  async deleteResource(resourceId: string): Promise<{ removed: boolean }> {
    const body = await apiFetch<{ data: { removed: boolean } }>(
      `/admin/learning/resources/${encodeURIComponent(resourceId)}`,
      { method: "DELETE", retryOnAuth: true },
    );
    return body.data;
  },
};
