/**
 * M10 view-tracking clock (agent 1, platform-owned).
 *
 * A logical viewing session counts ONCE after 30 seconds of ACTUAL elapsed
 * playing time. Continued playback at 60/90s adds nothing. A page refresh,
 * successful playback reconnect (new playback grant) or later new viewing
 * session starts a NEW session with a fresh threshold. Failed reconnects create
 * no session. Pause/resume and token renewal without a restart stay in the same
 * session. Seeking and buffering never advance playing time.
 *
 * Elapsed basis (not media progress): accumulation uses a monotonic clock
 * reading supplied with every sample (`performance.now()` in the player,
 * injected fakes in tests) and counts wall-clock time only while the element
 * reports actual playback. Playback rate therefore cannot fast-forward the
 * threshold: 15 elapsed seconds at 2x credit 15 seconds, never 30; 30 elapsed
 * seconds at 0.5x credit the full 30. Skipped footage is never counted, because
 * media position is never used as duration. `currentTime` is not consulted.
 *
 * Client measurements represent reported playback activity, not proof of human
 * attention; this module never claims fraud-proof tracking. The view session
 * id lives in memory only (never localStorage/sessionStorage/cookies/URL) so
 * a refresh starts a new countable session by design. No login or playback
 * credential is stored here; only non-secret row ids cross the wire.
 */

export const VIEW_THRESHOLD_MS = 30_000;
/** Bounded telemetry: at most one heartbeat per interval while playing. */
export const VIEW_HEARTBEAT_INTERVAL_MS = 5_000;
/**
 * Maximum playing time credited from a single sample. Normal samples arrive
 * several times per second; this cap only binds delayed/jittered delivery.
 */
export const MAX_CREDIT_PER_SAMPLE_MS = 4_000;
/**
 * Sampling gaps longer than this are treated as unknown (backgrounded tab,
 * suspended timers, detached element): nothing is credited and the anchor is
 * reset. The safe direction is undercounting, never inflation.
 */
export const STALE_SAMPLE_GAP_MS = 10_000;

export interface PlaybackActivitySample {
  /** True while the media element reports actual forward playback. */
  paused: boolean;
  seeking: boolean;
  ended: boolean;
  /** True while the element is stalled waiting for data (buffering). */
  waiting: boolean;
  /**
   * Monotonic clock reading in milliseconds (player: `performance.now()`).
   * Wall-clock sources that can jump (NTP adjustments) must not be used.
   */
  nowMs: number;
}

/**
 * Pure elapsed playing-time clock for one logical session.
 *
 * Only `nowMs` differences observed while actually playing advance the total.
 * Pause/end close the preceding playing interval once; seeking and buffering
 * re-anchor without credit. Duplicate/backward readings credit nothing; implausible and
 * stale gaps are bounded or dropped. Rate changes need no handling: rate is
 * never an input.
 */
export class ElapsedPlayClock {
  private playedMs = 0;
  private lastTickMs: number | null = null;

  get totalMs(): number {
    return this.playedMs;
  }

  reset(): void {
    this.playedMs = 0;
    this.lastTickMs = null;
  }

  /**
   * Fold one activity sample into the total. Returns the ms credited (0 when
   * the sample is not actual playing time or the gap is not credible).
   */
  observe(sample: PlaybackActivitySample): number {
    if (!Number.isFinite(sample.nowMs)) return 0;
    if (sample.seeking || sample.waiting) {
      // Re-anchor so resuming does not count the non-playing gap.
      // The next playing sample establishes a fresh anchor. Anchoring at the
      // idle sample would credit the pause/seek/buffer gap on resume.
      this.lastTickMs = null;
      return 0;
    }
    const stopped = sample.paused || sample.ended;
    if (this.lastTickMs === null) {
      if (!stopped) this.lastTickMs = sample.nowMs;
      return 0;
    }
    const elapsed = sample.nowMs - this.lastTickMs;
    // Close the preceding playing interval once. Idle/resume samples never
    // credit the paused gap; the same bounded/stale rules apply to this tail.
    this.lastTickMs = stopped ? null : sample.nowMs;
    if (!Number.isFinite(elapsed) || elapsed <= 0) return 0;
    // Delayed/background sampling: a suspended tab can deliver one sample
    // after minutes of silence while the video element kept its last state.
    // Never credit more than the per-sample cap, and drop stale gaps
    // entirely instead of guessing.
    if (elapsed > STALE_SAMPLE_GAP_MS) return 0;
    const credited = Math.min(elapsed, MAX_CREDIT_PER_SAMPLE_MS);
    this.playedMs += credited;
    return credited;
  }
}

/**
 * Successful-reconnect detection from the real player lifecycle.
 *
 * A NEW countable session starts only when usePlayback.start() succeeds and
 * yields a NEW playback grant (new referenceId) followed by actual playback
 * (STREAM_INITIALIZED/PLAYING). The following do NOT start a new session:
 * dash.js MPD/MediaSegment retries (retryAttempts 2), license retries,
 * platform-mediated token renewal (same referenceId, DASH/EME untouched),
 * pause/resume, seeking/buffering, React StrictMode remount effects (same
 * referenceId, server dedupes via UNIQUE(playbackReferenceId)) and transport
 * retries of the same heartbeat (server GREATEST converges).
 *
 * A FAILED reconnect (playback.start() rejects, grant null, player phase
 * error/expired) mints no grant, so no view start is attempted and nothing
 * counts. A page refresh loses both the transient playback token and the
 * in-memory view session id by design, so the next successful grant starts a
 * new row after authorization.
 */
export function isNewViewSession(previousReferenceId: string | null, nextReferenceId: string | null): boolean {
  if (nextReferenceId === null) return false;
  return previousReferenceId !== nextReferenceId;
}

/**
 * Classify a tracking-start failure as transient (bounded retry allowed) or
 * terminal (stop for this grant; never retry authorization/access failures).
 *
 * Transient: transport/network failures (non-HTTP error), 429 rate limiting
 * and 5xx dependency failures. Terminal: every 400/401/403/404/409 answer —
 * expired entitlement, foreign/terminated grant, wrong binding, unready media
 * — retrying those cannot succeed without a new grant or renewed access.
 */
export function isTransientViewStartFailure(error: unknown): boolean {
  if (error === null || typeof error !== 'object') return true;
  const status = (error as { status?: unknown }).status;
  if (typeof status !== 'number' || !Number.isFinite(status)) return true;
  if (status === 429) return true;
  if (status >= 500) return true;
  return false;
}
