/**
 * Learning API client (M5).
 *
 * Same-origin `/api` calls with credentials included, exactly like the M2-M4
 * clients. The returned playback token is handed straight to the player and is
 * never written to storage.
 */

const BASE = import.meta.env.VITE_API_BASE ?? '/api';

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${BASE}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      ...(init.body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(init.headers ?? {}),
    },
  });
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
    throw new LearningApiError(code, response.status);
  }
  const data = (payload as { data?: T } | null)?.data;
  return (data ?? (payload as T)) as T;
}

export class LearningApiError extends Error {
  readonly code: string;
  readonly status: number;
  constructor(code: string, status: number) {
    super(code);
    this.name = 'LearningApiError';
    this.code = code;
    this.status = status;
  }
}

function csrfHeader(): string {
  // The CSRF cookie is readable by design (double-submit); it is not a secret.
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

import type {
  DashboardPayload,
  OutlinePayload,
  PlaybackEnd,
  PlaybackGrant,
  PlaybackRenewal,
  LessonProgressState,
} from '../types/models.js';

export const learningApi = {
  dashboard(): Promise<DashboardPayload> {
    return request<DashboardPayload>('/learning/dashboard');
  },
  outline(courseRef: string): Promise<OutlinePayload> {
    return request<OutlinePayload>(`/learning/courses/${encodeURIComponent(courseRef)}/outline`);
  },
  progress(courseRef: string, lessonId: string): Promise<LessonProgressState> {
    return request<LessonProgressState>(
      `/learning/courses/${encodeURIComponent(courseRef)}/lessons/${encodeURIComponent(lessonId)}/progress`,
    );
  },
  startPlayback(courseRef: string, lessonId: string, deviceId: string): Promise<PlaybackGrant> {
    return request<{ playback: PlaybackGrant }>(
      `/learning/courses/${encodeURIComponent(courseRef)}/lessons/${encodeURIComponent(lessonId)}/playback`,
      mutationInit({ deviceId }),
    ).then((body) => body.playback);
  },
  recordProgress(input: {
    courseRef: string;
    lessonId: string;
    positionSeconds: number;
    durationSeconds: number | null;
    completed: boolean;
  }): Promise<LessonProgressState> {
    return request<{ progress: LessonProgressState }>('/learning/progress', mutationInit(input)).then(
      (body) => body.progress,
    );
  },
  endPlayback(referenceId: string): Promise<PlaybackEnd> {
    return request<PlaybackEnd>(
      `/learning/playback/${encodeURIComponent(referenceId)}/end`,
      mutationInit({}),
    );
  },
  /**
   * Platform-mediated token renewal. Entitlement is re-checked on backend time,
   * so a lapsed subscription is refused with 401 PLAYBACK_SESSION_EXPIRED and
   * the caller must end the session.
   */
  renewPlayback(referenceId: string): Promise<PlaybackRenewal> {
    return request<{ renewal: PlaybackRenewal }>(
      `/learning/playback/${encodeURIComponent(referenceId)}/renew`,
      mutationInit({}),
    ).then((body) => body.renewal);
  },
};
