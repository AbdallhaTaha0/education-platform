/**
 * M10 view-session lifecycle manager (agent 1, platform-owned).
 *
 * Owns one logical viewing session per playback grant with injectable
 * transport, so the full lifecycle — refresh, same-grant remount, delayed
 * responses, teardown, bounded start retry — is unit-testable without a media
 * element or a browser. The React hook (`useViewTracking`) is a thin wiring
 * layer over this class.
 *
 * Rules enforced here:
 * - Playing time accumulates from the moment a grant attaches, even while the
 *   tracking-start request is still pending or retrying, so continued playback
 *   during a transient outage is not lost. The first heartbeat after a late
 *   start success reports the whole accumulated total for this grant.
 * - Tracking-start uses bounded retry for transient failures only
 *   (transport/network errors, 429, 5xx): at most VIEW_START_MAX_ATTEMPTS
 *   attempts with VIEW_START_RETRY_DELAYS_MS backoff, cancellable on
 *   grant/navigation change or teardown. Terminal failures (400/401/403/404/
 *   409: expired entitlement, foreign/terminated grant, wrong binding, unready
 *   media) stop immediately for this grant — retrying cannot succeed without a
 *   new grant or renewed access.
 * - One server row per playback grant: every attempt for an attached grant
 *   carries the same playbackReferenceId, and the server converges repeats via
 *   UNIQUE(playbackReferenceId).
 * - Stale-async protection: every attach/detach bumps a generation counter.
 *   Late start successes, late failures, retry timers and late heartbeat
 *   responses from a previous generation are ignored and can never write into
 *   a newer grant's local state.
 * - Memory only: no persistence. Detach drops all state.
 */
import {
  ElapsedPlayClock,
  isTransientViewStartFailure,
  type PlaybackActivitySample,
} from './viewTracking';

export const VIEW_START_MAX_ATTEMPTS = 5;
export const VIEW_START_RETRY_DELAYS_MS = [1_000, 2_000, 4_000, 8_000] as const;

export type ViewSessionStatus = 'inactive' | 'starting' | 'active' | 'failed';

export interface ViewSessionSnapshot {
  status: ViewSessionStatus;
  viewSessionId: string | null;
  playedMs: number;
  /** 1-based count of start attempts made for the current attachment. */
  attempt: number;
}

export interface ViewStartTransport {
  (courseRef: string, lessonId: string, playbackReferenceId: string): Promise<{
    viewSessionId: string;
  }>;
}

export interface ViewHeartbeatTransport {
  (
    viewSessionId: string,
    playedMilliseconds: number,
    options?: { keepalive?: boolean },
  ): Promise<{ playedMilliseconds: number }>;
}

export class ViewSessionManager {
  private readonly clock = new ElapsedPlayClock();
  private generation = 0;
  private attached = false;
  private params: { courseRef: string; lessonId: string; referenceId: string } | null = null;
  private viewId: string | null = null;
  private status: ViewSessionStatus = 'inactive';
  private attempt = 0;
  private lastSentMs = 0;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly startView: ViewStartTransport,
    private readonly heartbeat: ViewHeartbeatTransport,
  ) {}

  /** Attach a successfully minted playback grant; cancels any previous one. */
  attach(courseRef: string, lessonId: string, referenceId: string): void {
    this.generation += 1;
    this.clearRetryTimer();
    this.clock.reset();
    this.attached = true;
    this.params = { courseRef, lessonId, referenceId };
    this.viewId = null;
    this.status = 'starting';
    this.attempt = 0;
    this.lastSentMs = 0;
    void this.tryStart(this.generation);
  }

  /** Drop all state: grant gone, navigation away, teardown. Cancels retries. */
  detach(): void {
    this.generation += 1;
    this.clearRetryTimer();
    this.attached = false;
    this.params = null;
    this.viewId = null;
    this.status = 'inactive';
    this.attempt = 0;
    this.lastSentMs = 0;
    this.clock.reset();
  }

  /** Fold an activity sample; accumulates while attached, even start-pending. */
  observe(sample: PlaybackActivitySample): number {
    if (!this.attached) return 0;
    return this.clock.observe(sample);
  }

  get playedMs(): number {
    return this.clock.totalMs;
  }

  get viewSessionId(): string | null {
    return this.attached ? this.viewId : null;
  }

  snapshot(): ViewSessionSnapshot {
    return {
      status: this.attached ? this.status : 'inactive',
      viewSessionId: this.attached ? this.viewId : null,
      playedMs: this.clock.totalMs,
      attempt: this.attempt,
    };
  }

  /**
   * Best-effort heartbeat of the accumulated total. Never throws. Skips
   * redundant sends (same total already acknowledged) unless forced.
   */
  async heartbeatNow(options: { keepalive?: boolean; force?: boolean } = {}): Promise<{
    sent: boolean;
  }> {
    const generation = this.generation;
    const id = this.viewId;
    if (!this.attached || id === null) return { sent: false };
    const total = this.clock.totalMs;
    if (!options.force && !options.keepalive && total === this.lastSentMs) {
      return { sent: false };
    }
    try {
      await this.heartbeat(id, total, options.keepalive === true ? { keepalive: true } : undefined);
    } catch {
      // Best effort only: the next interval retries the same monotonic total.
      return { sent: false };
    }
    // A newer grant may have attached while the request was in flight; its
    // acknowledgement must not leak into the new session's bookkeeping.
    if (generation !== this.generation || !this.attached || this.viewId !== id) {
      return { sent: false };
    }
    this.lastSentMs = total;
    return { sent: true };
  }

  private clearRetryTimer(): void {
    if (this.retryTimer !== null) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
  }

  private async tryStart(generation: number): Promise<void> {
    const params = this.params;
    if (generation !== this.generation || !this.attached || params === null) return;
    this.attempt += 1;
    let viewSessionId: string;
    try {
      const result = await this.startView(params.courseRef, params.lessonId, params.referenceId);
      viewSessionId = result.viewSessionId;
    } catch (error) {
      // A newer grant (or teardown) superseded this attempt while it was in
      // flight: never touch the new session's state, never schedule retries.
      if (generation !== this.generation || !this.attached) return;
      if (!isTransientViewStartFailure(error) || this.attempt >= VIEW_START_MAX_ATTEMPTS) {
        this.status = 'failed';
        return;
      }
      const delays = VIEW_START_RETRY_DELAYS_MS;
      const delay = delays[Math.min(this.attempt - 1, delays.length - 1)] ?? 8_000;
      this.retryTimer = setTimeout(() => {
        this.retryTimer = null;
        void this.tryStart(generation);
      }, delay);
      return;
    }
    if (generation !== this.generation || !this.attached) return;
    this.viewId = viewSessionId;
    this.status = 'active';
  }
}
