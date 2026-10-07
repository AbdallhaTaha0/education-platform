/**
 * M10 player view-tracking hook (agent 1).
 *
 * Thin React wiring over ViewSessionManager (see viewSessionManager.ts, the
 * unit-tested lifecycle owner): one logical viewing session per playback
 * grant, bounded retry for transient start failures, accumulation while start
 * is pending, generation-guarded stale-async protection. Memory-only: the view
 * session id is held in the manager and never persisted, so a page refresh
 * starts a new countable session by design. Tracking failure never breaks
 * playback: every network call is best-effort and failures leave the player
 * untouched. Retries never inflate counts: the server accumulates via GREATEST
 * and transitions countedAt at most once per row.
 *
 * Session rules (owner-approved):
 * - start once per successful playback grant (new referenceId), retried on a
 *   bounded schedule for transient failures only;
 * - heartbeat at most every 5s while actually playing + final flush on
 *   pause/end/unmount/pagehide;
 * - pause/resume and token renewal (same referenceId) reuse the row;
 * - failed reconnect (no grant) starts nothing;
 * - seeking/buffering never advance the total (elapsed clock, see
 *   viewTracking.ts).
 */
import { useCallback, useEffect, useRef } from 'react';
import { VIEW_HEARTBEAT_INTERVAL_MS, type PlaybackActivitySample } from './viewTracking';
import { ViewSessionManager } from './viewSessionManager';
import { viewApi } from './viewApi';
import type { PlaybackGrant } from '../types/models';

export interface ViewTracking {
  /** Current in-memory view session id, null when tracking is inactive. */
  viewSessionId: string | null;
  /** Accumulated actual playing time for the current session. */
  playedMs: number;
  /** Fold an activity sample (called from the player's timeupdate path). */
  observe: (sample: PlaybackActivitySample) => void;
  /** Best-effort final flush; never rejects (called on pause/end/unmount). */
  flush: (options?: { keepalive?: boolean }) => Promise<void>;
}

export function useViewTracking(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  grant: PlaybackGrant | null,
  courseRef: string | null,
  lessonId: string | null,
): ViewTracking {
  const managerRef = useRef<ViewSessionManager | null>(null);
  if (managerRef.current === null) {
    managerRef.current = new ViewSessionManager(
      (course, lesson, referenceId) =>
        viewApi.startView(course, lesson, referenceId).then((body) => ({
          viewSessionId: body.view.viewSessionId,
        })),
      (viewSessionId, playedMs, options) =>
        viewApi.heartbeat(viewSessionId, playedMs, options).then((body) => ({
          playedMilliseconds: body.view.playedMilliseconds,
        })),
    );
  }

  const heartbeatCurrent = useCallback(async (keepalive: boolean): Promise<void> => {
    await managerRef.current?.heartbeatNow({ keepalive });
  }, []);

  const flush = useCallback(
    async (options: { keepalive?: boolean } = {}): Promise<void> => {
      await heartbeatCurrent(options.keepalive ?? false);
    },
    [heartbeatCurrent],
  );

  const observe = useCallback((sample: PlaybackActivitySample) => {
    managerRef.current?.observe(sample);
  }, []);

  // One logical session per successful grant. Keyed on referenceId only: token
  // renewal swaps the credential with the same referenceId and re-attaching
  // the same id is idempotent server-side (UNIQUE fence returns the same row).
  // A null grant (error/expired/teardown) detaches and drops all state.
  useEffect(() => {
    const manager = managerRef.current;
    if (manager === null) return;
    const nextRef = grant?.referenceId ?? null;
    if (nextRef === null || courseRef === null || lessonId === null) {
      manager.detach();
      return;
    }
    manager.attach(courseRef, lessonId, nextRef);
    // Bounded telemetry: at most one heartbeat per interval while the element
    // reports actual playback; the elapsed clock gates on paused/seeking/
    // buffering so idle intervals send nothing new.
    const timer = setInterval(() => {
      const video = videoRef.current;
      if (video === null) return;
      if (video.paused || video.ended) return;
      void manager.heartbeatNow({});
    }, VIEW_HEARTBEAT_INTERVAL_MS);
    return () => {
      clearInterval(timer);
      // Best-effort keepalive flush for the detaching grant, then drop all
      // local state. heartbeatNow captures the old session id synchronously,
      // so the in-flight request still targets the correct (old) row even
      // though detach bumps the generation before it settles.
      void manager.heartbeatNow({ keepalive: true });
      manager.detach();
    };
  }, [grant?.referenceId, courseRef, lessonId, videoRef]);

  // Final flush on page exit. Background tabs keep playback; pagehide is the
  // contractual page-exit signal (visibility hidden is not). Component
  // teardown flushes through the effect cleanup above via detach ordering:
  // detach drops the id, so capture the flush before it where needed.
  useEffect(() => {
    const onPageHide = () => {
      void managerRef.current?.heartbeatNow({ keepalive: true });
    };
    window.addEventListener('pagehide', onPageHide);
    return () => {
      window.removeEventListener('pagehide', onPageHide);
    };
  }, []);

  const manager = managerRef.current;
  return {
    get viewSessionId() {
      return manager?.viewSessionId ?? null;
    },
    get playedMs() {
      return manager?.playedMs ?? 0;
    },
    observe,
    flush,
  };
}
