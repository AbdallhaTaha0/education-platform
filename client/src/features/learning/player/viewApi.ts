/**
 * M10 view-tracking API client (agent 1).
 *
 * Owned telemetry transport for the player integration only. Same-origin
 * `/api` calls with credentials included, exactly like the M5 learning
 * client. The view session id is a non-secret row identifier held in memory
 * only; it is never written to storage. The playback bearer token never
 * crosses these endpoints.
 */

import { apiResponse, ApiError } from '../../../auth';

export interface ViewPayload {
  viewSessionId: string;
  studentId: string;
  courseId: string;
  lessonId: string;
  mediaAssetId: string;
  startedAt: string;
  countedAt: string | null;
  playedMilliseconds: number;
  counted: boolean;
  thresholdMs: number;
  trackingStartedAt: string;
}

export class ViewApiError extends Error {
  readonly code: string;
  readonly status: number;
  constructor(code: string, status: number) {
    super(code);
    this.name = 'ViewApiError';
    this.code = code;
    this.status = status;
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await apiResponse(path, {
      ...init,
      retryOnAuth: true,
      headers: {
        Accept: 'application/json',
        ...(init.body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(init.headers ?? {}),
      },
    });
  } catch (error) {
    if (error instanceof ApiError) throw new ViewApiError(error.code, error.status);
    throw error;
  }
  const text = await response.text();
  let payload: unknown = null;
  if (text.length > 0) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = null;
    }
  }
  if (!response.ok) {
    const code =
      typeof payload === 'object' && payload !== null && 'error' in payload
        ? String((payload as { error?: { code?: unknown } }).error?.code ?? 'UNKNOWN')
        : 'UNKNOWN';
    throw new ViewApiError(code, response.status);
  }
  const data = (payload as { data?: T } | null)?.data;
  return (data ?? (payload as T)) as T;
}

function csrfHeader(): string {
  const match = document.cookie.match(/(?:^|;\s*)edu_csrf=([^;]+)/);
  return match?.[1] ? decodeURIComponent(match[1]) : '';
}

function mutationInit(body: unknown): RequestInit {
  return {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'X-Csrf-Token': csrfHeader() },
  };
}

export const viewApi = {
  startView(
    courseRef: string,
    lessonId: string,
    playbackReferenceId: string,
  ): Promise<{ view: ViewPayload }> {
    return request<{ view: ViewPayload }>(
      `/learning/courses/${encodeURIComponent(courseRef)}/lessons/${encodeURIComponent(lessonId)}/views/start`,
      mutationInit({ playbackReferenceId }),
    );
  },
  heartbeat(
    viewSessionId: string,
    playedMilliseconds: number,
    options: { keepalive?: boolean } = {},
  ): Promise<{ view: ViewPayload; newlyCounted: boolean }> {
    const init = mutationInit({ playedMilliseconds });
    return request<{ view: ViewPayload; newlyCounted: boolean }>(
      `/learning/views/${encodeURIComponent(viewSessionId)}/heartbeat`,
      options.keepalive ? { ...init, keepalive: true } : init,
    );
  },
};
