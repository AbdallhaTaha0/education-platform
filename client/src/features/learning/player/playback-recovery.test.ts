import { describe, expect, it } from 'vitest';
import { errorDetail } from './PlayerChrome';
import { classifyPlayRejection, isStalePlayResult } from './playRejection';

const labels = {
  loading: 'loading',
  ready: 'ready',
  playing: 'playing',
  paused: 'paused',
  ended: 'ended',
  error: 'error',
  expired: 'expired',
  play: 'play',
  pause: 'pause',
  resume: 'resume',
  retry: 'retry',
  playerLabel: 'player',
  unsupported: 'unsupported',
  fullscreen: 'fs',
  exitFullscreen: 'exit',
  needsGesture: 'press play',
  unsupportedDetail: 'supported browser',
  networkDetail: 'network retry',
  expiredDetail: 'renew',
  deviceDetail: 'device support',
  revokedDetail: 'revoked support',
  streamDetail: 'recover session',
};

describe('player error categories', () => {
  it('distinguishes gesture, unsupported and network failures without provider internals', () => {
    expect(errorDetail('PLAYBACK_GESTURE_REQUIRED', labels)).toBe('press play');
    expect(errorDetail('UNSUPPORTED_PROVIDER', labels)).toBe('supported browser');
    expect(errorDetail('PLAYBACK_ERROR', labels)).toBe('network retry');
    expect(errorDetail('DASH_123', labels)).toBe('network retry');
    expect(errorDetail('PLAYER_INIT_FAILED', labels)).toBe('network retry');
    expect(errorDetail(null, labels)).toBeNull();
  });

  it('never leaks raw provider diagnostics through the detail', () => {
    const detail = errorDetail('PLAYBACK_ERROR', labels) ?? '';
    expect(detail).not.toContain('token');
    expect(detail).not.toContain('http');
    expect(detail).not.toContain(' drm ');
  });
});

describe('play() rejection path (the exact classifier the toggle executes)', () => {
  it('requires a gesture for NotAllowedError while preserving the grant', () => {
    // Gesture outcome carries no failure code: the toggle sets the hint and
    // never dispatches FAILED, so the grant survives.
    expect(classifyPlayRejection('NotAllowedError')).toEqual({ action: 'gesture' });
  });

  it('routes NotSupportedError to unsupported-media guidance, not gesture', () => {
    // Regression: the old toggle swallowed NotSupportedError into the gesture
    // branch, showing the wrong next action. It must surface
    // UNSUPPORTED_PROVIDER instead.
    expect(classifyPlayRejection('NotSupportedError')).toEqual({
      action: 'failed',
      code: 'UNSUPPORTED_PROVIDER',
    });
  });

  it('treats abort and unknown rejections as generic playback failure', () => {
    expect(classifyPlayRejection('AbortError')).toEqual({ action: 'failed', code: 'PLAYBACK_ERROR' });
    expect(classifyPlayRejection('')).toEqual({ action: 'failed', code: 'PLAYBACK_ERROR' });
    expect(classifyPlayRejection('SomeFutureError')).toEqual({
      action: 'failed',
      code: 'PLAYBACK_ERROR',
    });
  });

  it('ignores stale results after teardown or a lesson/grant switch', () => {
    expect(isStalePlayResult('grant-a', 'grant-a', true)).toBe(false);
    expect(isStalePlayResult('grant-a', 'grant-b', true)).toBe(true);
    expect(isStalePlayResult('grant-a', 'grant-a', false)).toBe(true);
    expect(isStalePlayResult(null, 'grant-a', true)).toBe(true);
  });
});
