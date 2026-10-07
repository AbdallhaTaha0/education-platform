/**
 * M10 view-tracking clock unit tests (agent 1).
 *
 * The 30-second threshold lives server-side; these tests prove the client
 * credits ACTUAL elapsed playing time from a monotonic clock — never media
 * progress — and never advances on pause, seeking, buffering, duplicate or
 * stale samples.
 */
import { describe, expect, it } from 'vitest';
import {
  ElapsedPlayClock,
  isNewViewSession,
  isTransientViewStartFailure,
  MAX_CREDIT_PER_SAMPLE_MS,
  STALE_SAMPLE_GAP_MS,
  VIEW_THRESHOLD_MS,
  type PlaybackActivitySample,
} from './viewTracking.js';

function playing(nowMs: number, overrides: Partial<PlaybackActivitySample> = {}): PlaybackActivitySample {
  return { paused: false, seeking: false, ended: false, waiting: false, nowMs, ...overrides };
}

describe('view threshold constant', () => {
  it('keeps the owner-approved 30s threshold', () => {
    expect(VIEW_THRESHOLD_MS).toBe(30_000);
  });
});

describe('elapsed playing-time clock', () => {
  it('credits wall time while playing', () => {
    const clock = new ElapsedPlayClock();
    clock.observe(playing(0));
    expect(clock.observe(playing(500))).toBe(500);
    expect(clock.observe(playing(1000))).toBe(500);
    expect(clock.totalMs).toBe(1000);
  });

  it('does not count media progress: 15 elapsed seconds at 2x credit 15s', () => {
    // At 2x the media position advances 2s per elapsed second. The clock
    // never sees media position, so only the 15 elapsed seconds count —
    // below the 30s threshold.
    const clock = new ElapsedPlayClock();
    let now = 0;
    clock.observe(playing(now));
    for (let i = 0; i < 15; i += 1) {
      now += 1000;
      clock.observe(playing(now));
    }
    expect(clock.totalMs).toBe(15_000);
    expect(clock.totalMs).toBeLessThan(VIEW_THRESHOLD_MS);
  });

  it('credits full elapsed time at 0.5x: 30 playing seconds reach the threshold', () => {
    const clock = new ElapsedPlayClock();
    let now = 0;
    clock.observe(playing(now));
    for (let i = 0; i < 30; i += 1) {
      now += 1000;
      clock.observe(playing(now));
    }
    expect(clock.totalMs).toBe(30_000);
  });

  it('ignores pause without counting the gap', () => {
    const clock = new ElapsedPlayClock();
    clock.observe(playing(10_000));
    clock.observe(playing(11_000));
    expect(clock.totalMs).toBe(1000);
    // Paused for 40s: re-anchors, credits nothing.
    clock.observe(playing(51_000, { paused: true }));
    expect(clock.observe(playing(51_000))).toBe(0);
    expect(clock.observe(playing(51_500))).toBe(500);
    expect(clock.totalMs).toBe(1500);
  });

  it('ignores seeking and never counts skipped footage', () => {
    const clock = new ElapsedPlayClock();
    clock.observe(playing(20_000));
    clock.observe(playing(21_000));
    expect(clock.totalMs).toBe(1000);
    // A 30s forward seek while the seeking flag is set: no credit, re-anchor.
    clock.observe(playing(51_000, { seeking: true }));
    expect(clock.observe(playing(51_000))).toBe(0);
    expect(clock.observe(playing(51_500))).toBe(500);
    expect(clock.totalMs).toBe(1500);
  });

  it('ignores buffering stalls', () => {
    const clock = new ElapsedPlayClock();
    clock.observe(playing(100_000));
    clock.observe(playing(100_500));
    expect(clock.totalMs).toBe(500);
    clock.observe(playing(100_500, { waiting: true }));
    clock.observe(playing(105_000, { waiting: true }));
    expect(clock.totalMs).toBe(500);
    expect(clock.observe(playing(105_000))).toBe(0);
    expect(clock.observe(playing(105_500))).toBe(500);
    expect(clock.totalMs).toBe(1000);
  });

  it('closes ended playback once and ignores duplicate/backward readings', () => {
    const clock = new ElapsedPlayClock();
    clock.observe(playing(1000));
    clock.observe(playing(2000));
    expect(clock.totalMs).toBe(1000);
    clock.observe(playing(3000, { ended: true }));
    expect(clock.totalMs).toBe(2000);
    // Duplicate delivery (same reading) credits nothing.
    expect(clock.observe(playing(3000))).toBe(0);
    // Backward clock reading credits nothing and re-anchors.
    expect(clock.observe(playing(2500))).toBe(0);
    expect(clock.observe(playing(3500))).toBe(1000);
    expect(clock.totalMs).toBe(3000);
  });

  it('includes the final interval of an exactly 30-second video', () => {
    const clock = new ElapsedPlayClock();
    for (let now = 0; now < 30_000; now += 250) clock.observe(playing(now));
    expect(clock.observe(playing(30_000, { paused: true, ended: true }))).toBe(250);
    expect(clock.totalMs).toBe(VIEW_THRESHOLD_MS);
    expect(clock.observe(playing(31_000, { paused: true, ended: true }))).toBe(0);
    expect(clock.totalMs).toBe(VIEW_THRESHOLD_MS);
  });

  it('includes the pause tail once but excludes the paused gap on resume', () => {
    const clock = new ElapsedPlayClock();
    clock.observe(playing(0));
    clock.observe(playing(250));
    expect(clock.observe(playing(400, { paused: true }))).toBe(150);
    clock.observe(playing(900, { paused: true }));
    expect(clock.observe(playing(1000))).toBe(0);
    clock.observe(playing(1250));
    expect(clock.totalMs).toBe(650);
  });

  it('drops stale stop intervals and excludes seek/buffer transitions', () => {
    for (const flag of ['paused', 'ended', 'waiting', 'seeking'] as const) {
      const clock = new ElapsedPlayClock();
      clock.observe(playing(0));
      expect(clock.observe(playing(STALE_SAMPLE_GAP_MS + 1, { [flag]: true }))).toBe(0);
      expect(clock.totalMs).toBe(0);
    }
    for (const flag of ['waiting', 'seeking'] as const) {
      const clock = new ElapsedPlayClock();
      clock.observe(playing(0));
      expect(clock.observe(playing(250, { [flag]: true, paused: true }))).toBe(0);
    }
  });

  it.each(['paused', 'seeking', 'waiting', 'ended'] as const)(
    'does not credit a short %s gap when playback resumes', (flag) => {
      const clock = new ElapsedPlayClock();
      clock.observe(playing(0));
      clock.observe(playing(1000));
      clock.observe(playing(1000, { [flag]: true }));
      expect(clock.observe(playing(6000))).toBe(0);
      expect(clock.totalMs).toBe(1000);
      expect(clock.observe(playing(6500))).toBe(500);
      expect(clock.totalMs).toBe(1500);
    },
  );

  it('bounds delayed samples and drops stale background gaps', () => {
    const clock = new ElapsedPlayClock();
    clock.observe(playing(0));
    // A 6s delivery gap (suspended timers) credits at most the per-sample cap.
    expect(clock.observe(playing(6000))).toBe(MAX_CREDIT_PER_SAMPLE_MS);
    // A 60s background gap credits nothing instead of guessing.
    expect(clock.observe(playing(66_000 + STALE_SAMPLE_GAP_MS))).toBe(0);
    // Playback continues from the new anchor.
    expect(clock.observe(playing(66_000 + STALE_SAMPLE_GAP_MS + 500))).toBe(500);
  });

  it('rejects non-finite clock readings', () => {
    const clock = new ElapsedPlayClock();
    expect(clock.observe(playing(Number.NaN))).toBe(0);
    expect(clock.totalMs).toBe(0);
  });

  it('resets for a new logical session', () => {
    const clock = new ElapsedPlayClock();
    clock.observe(playing(0));
    clock.observe(playing(5000));
    clock.reset();
    expect(clock.totalMs).toBe(0);
    expect(clock.observe(playing(6000))).toBe(0);
    expect(clock.observe(playing(6500))).toBe(500);
  });
});

describe('successful-reconnect detection', () => {
  it('starts a new session only for a new grant reference', () => {
    expect(isNewViewSession(null, 'ref-a')).toBe(true);
    expect(isNewViewSession('ref-a', 'ref-a')).toBe(false);
    expect(isNewViewSession('ref-a', 'ref-b')).toBe(true);
    expect(isNewViewSession('ref-a', null)).toBe(false);
  });
});

describe('start-failure classification', () => {
  it('retries transport failures, 429 and 5xx', () => {
    expect(isTransientViewStartFailure(new Error('network down'))).toBe(true);
    expect(isTransientViewStartFailure(null)).toBe(true);
    expect(isTransientViewStartFailure({ status: 429 })).toBe(true);
    expect(isTransientViewStartFailure({ status: 500 })).toBe(true);
    expect(isTransientViewStartFailure({ status: 502 })).toBe(true);
    expect(isTransientViewStartFailure({ status: 503 })).toBe(true);
  });

  it('never retries authorization/access/binding failures', () => {
    for (const status of [400, 401, 403, 404, 409]) {
      expect(isTransientViewStartFailure({ status, code: 'X' })).toBe(false);
    }
  });
});
