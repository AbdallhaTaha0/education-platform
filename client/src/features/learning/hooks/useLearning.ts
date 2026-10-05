/** Learning hooks (M5). Each hook owns one responsibility and no globals. */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { learningApi, LearningApiError } from '../api/client';
import { deviceId } from './device';
import { clear as clearSession, renewSession } from '../player/session';
import { mergeProgress } from '../progress/merge';
import type {
  DashboardPayload,
  LessonProgressState,
  OutlinePayload,
  PlaybackGrant,
} from '../types/models';

export interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  errorCode: string | null;
  reload: () => void;
}

function useAsync<T>(load: () => Promise<T>, deps: unknown[]): AsyncState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  const loadRef = useRef(load);
  loadRef.current = load;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setErrorCode(null);
    loadRef
      .current()
      .then((value) => {
        if (cancelled) return;
        setData(value);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setErrorCode(err instanceof LearningApiError ? err.code : 'UNKNOWN');
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  return { data, loading, errorCode, reload };
}

export function useDashboard(): AsyncState<DashboardPayload> {
  const state = useAsync(() => learningApi.dashboard(), []);
  useEffect(() => {
    window.addEventListener('focus', state.reload);
    window.addEventListener('learning-progress-saved', state.reload);
    return () => {
      window.removeEventListener('focus', state.reload);
      window.removeEventListener('learning-progress-saved', state.reload);
    };
  }, [state.reload]);
  return state;
}

export function useOutline(courseRef: string): AsyncState<OutlinePayload> {
  return useAsync(() => learningApi.outline(courseRef), [courseRef]);
}

export function useLessonProgress(
  courseRef: string,
  lessonId: string | null,
): LessonProgressState | null {
  const [state, setState] = useState<LessonProgressState | null>(null);
  useEffect(() => {
    if (lessonId === null) {
      setState(null);
      return;
    }
    let cancelled = false;
    learningApi
      .progress(courseRef, lessonId)
      .then((value) => {
        if (!cancelled) setState(value);
      })
      .catch(() => {
        if (!cancelled) setState(null);
      });
    return () => {
      cancelled = true;
    };
  }, [courseRef, lessonId]);
  return state;
}

export interface PlaybackController {
  grant: PlaybackGrant | null;
  requesting: boolean;
  errorCode: string | null;
  start: (lessonId: string) => Promise<void>;
  end: (opts?: { keepalive?: boolean }) => Promise<void>;
  reportProgress: (
    lessonId: string,
    positionSeconds: number,
    durationSeconds: number | null,
    completed: boolean,
    keepalive?: boolean,
  ) => void;
  progressError: boolean;
  retryProgress: () => void;
  /** Locally merged progress, so a write never needs an outline reload. */
  progress: Record<string, LessonProgressState>;
  release: () => void;
  /** Ended externally without a local teardown: the reference is finished. */
  markSessionEnded: (referenceId: string) => void;
}

/**
 * Renew a token a little before it expires, so a viewer mid-lesson is not cut
 * off mid-segment. The margin leaves room for one retry-free request.
 */
const RENEW_MARGIN_MS = 20_000;
/** Never schedule further out than this; the timer is re-armed on each renewal. */
const MAX_TIMER_MS = 2_147_483_647;

export function usePlayback(courseRef: string): PlaybackController {
  const [grant, setGrant] = useState<PlaybackGrant | null>(null);
  const [requesting, setRequesting] = useState(false);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [progress, setProgress] = useState<Record<string, LessonProgressState>>({});
  const [progressError, setProgressError] = useState(false);
  const unsaved = useRef(new Map<string, LessonProgressState>());
  const pending = useRef<AbortController | null>(null);
  const renewTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // The lesson currently loaded, so throttled progress writes target the right
  // row. Never derived from the playback grant, which carries a DRM session id.
  const activeLesson = useRef<string | null>(null);
  // Mirrors of the live values, so the end/renew callbacks stay stable and do
  // not re-subscribe on every render.
  const grantRef = useRef<PlaybackGrant | null>(null);

  /**
   * End the external session. Always a best-effort keepalive: local credential
   * disposal happens first and never depends on the request succeeding, and the
   * durable server reference guarantees a retry if the external revocation
   * fails. Repeated calls are idempotent. Closing/unloading cannot guarantee
   * delivery; the durable retry is the guarantee.
   */
  const end = useCallback(async (opts: { keepalive?: boolean } = {}): Promise<void> => {
    if (renewTimer.current !== null) {
      clearTimeout(renewTimer.current);
      renewTimer.current = null;
    }
    const current = grantRef.current;
    // Drop the mirror immediately so no further write or renewal can act on a
    // dead grant; the captured value below still carries the end request.
    grantRef.current = null;
    // Local teardown first and unconditionally.
    clearSession();
    setGrant(null);
    if (current === null) return;
    try {
      await learningApi.endPlayback(current.referenceId, opts);
    } catch {
      // Best effort only: the durable reference owns the guaranteed closure.
    }
  }, []);

  const fail = useCallback((code: string) => {
    clearSession();
    setGrant(null);
    setErrorCode(code);
  }, []);

  /**
   * Renew before the token dies. On failure, playback stops and the session is
   * ended so the external session cannot outlive the entitlement.
   */
  const scheduleRenewal = useCallback(() => {
    if (renewTimer.current !== null) {
      clearTimeout(renewTimer.current);
      renewTimer.current = null;
    }
    const current = grantRef.current;
    if (current === null) return;

    const tokenExpiresAt = Date.parse(current.tokenExpiresAt);
    if (!Number.isFinite(tokenExpiresAt)) return;
    const wait = Math.min(
      Math.max(tokenExpiresAt - RENEW_MARGIN_MS - Date.now(), 1_000),
      MAX_TIMER_MS,
    );
    renewTimer.current = setTimeout(() => {
      void (async () => {
        const held = grantRef.current;
        if (held === null) return;
        try {
          const renewal = await learningApi.renewPlayback(held.referenceId);
          if (grantRef.current?.referenceId !== held.referenceId) return;
          const tokenExpiresAtMs = Date.parse(renewal.tokenExpiresAt);
          const sessionExpiresAtMs = Date.parse(renewal.sessionExpiresAt);
          if (!renewSession(renewal.playbackToken, tokenExpiresAtMs, sessionExpiresAtMs)) {
            throw new Error('no active session to renew');
          }
          // Update the in-memory credential only. No reload, no persistence, and
          // the DASH/EME instance is left completely untouched.
          // A late response must not resurrect an ended or switched session.
          if (grantRef.current?.referenceId !== held.referenceId) return;
          const next = {
            ...held,
            playbackToken: renewal.playbackToken,
            tokenExpiresAt: renewal.tokenExpiresAt,
            sessionExpiresAt: renewal.sessionExpiresAt,
          };
          grantRef.current = next;
          setGrant(next);
          setErrorCode(null);
          scheduleRenewal();
        } catch (err) {
          // Renewal refused or failed: stop playback, drop the credential, and
          // end the session so the DRM does not keep it alive.
          if (grantRef.current?.referenceId !== held.referenceId) return;
          const code = err instanceof LearningApiError ? err.code : 'UNKNOWN';
          await end();
          setErrorCode(code);
        }
      })();
    }, wait);
  }, [end]);

  useEffect(
    () => () => {
      pending.current?.abort();
      if (renewTimer.current !== null) clearTimeout(renewTimer.current);
      clearSession();
    },
    [],
  );

  const start = useCallback(
    async (lessonId: string) => {
      // A lesson change must close the previous external session first.
      if (grantRef.current !== null) await end();
      pending.current?.abort();
      const controller = new AbortController();
      pending.current = controller;
      activeLesson.current = lessonId;
      setRequesting(true);
      setErrorCode(null);
      try {
        const next = await learningApi.startPlayback(courseRef, lessonId, deviceId());
        if (controller.signal.aborted) {
          clearSession();
          return;
        }
        setGrant(next);
        grantRef.current = next;
        scheduleRenewal();
      } catch (err) {
        if (controller.signal.aborted) return;
        const code = err instanceof LearningApiError ? err.code : 'UNKNOWN';
        fail(code);
      } finally {
        setRequesting(false);
      }
    },
    [courseRef, end, fail, scheduleRenewal],
  );

  /**
   * Throttled progress write.
   *
   * It deliberately does NOT reload the outline: an outline reload used to put
   * the page into its loading state and unmount the player, so a routine ten
   * second write interrupted playback. The response is merged into local state
   * instead, and a failure leaves the player exactly as it was.
   */
  const saveProgress = useCallback(
    (value: LessonProgressState, keepalive = false) => {
      const { lessonId, positionSeconds, durationSeconds, completed } = value;
      void learningApi
        .recordProgress({ courseRef, lessonId, positionSeconds, durationSeconds, completed }, { keepalive })
        .then((saved) => {
          setProgress((prev) => ({ ...prev, [saved.lessonId]: mergeProgress(prev[saved.lessonId], saved) }));
          if (unsaved.current.get(lessonId) === value) unsaved.current.delete(lessonId);
          if (unsaved.current.size === 0) setProgressError(false);
          window.dispatchEvent(new Event('learning-progress-saved'));
        })
        .catch(() => {
          if (unsaved.current.get(lessonId) === value) setProgressError(true);
        });
    },
    [courseRef],
  );
  const reportProgress = useCallback((lessonId: string, positionSeconds: number, durationSeconds: number | null, completed: boolean, keepalive = false) => {
    const value = mergeProgress(unsaved.current.get(lessonId), { lessonId, positionSeconds, durationSeconds, completed });
    unsaved.current.set(lessonId, value);
    saveProgress(value, keepalive);
  }, [saveProgress]);
  const retryProgress = useCallback(() => {
    for (const value of unsaved.current.values()) saveProgress(value);
  }, [saveProgress]);

  const release = useCallback(() => {
    if (renewTimer.current !== null) {
      clearTimeout(renewTimer.current);
      renewTimer.current = null;
    }
    clearSession();
    activeLesson.current = null;
    setGrant(null);
    // Deliberately leaves grantRef.current intact: a lesson switch calls
    // release() and then start(), and start() ends the previous session by
    // reading that mirror. end() is the only path that clears it.
  }, []);

  /** Natural completion or an explicit stop: end the external session. */
  const markSessionEnded = useCallback(
    (referenceId: string) => {
      const current = grantRef.current;
      if (current === null || current.referenceId !== referenceId) return;
      void end();
    },
    [end],
  );

  return useMemo(
    () => ({
      grant,
      requesting,
      errorCode,
      start,
      end,
      reportProgress,
      progress,
      progressError,
      retryProgress,
      release,
      markSessionEnded,
    }),
    [grant, requesting, errorCode, start, end, reportProgress, progress, progressError, retryProgress, release, markSessionEnded],
  );
}

// Non-credential identity is shared across tabs so tabs do not consume devices.
