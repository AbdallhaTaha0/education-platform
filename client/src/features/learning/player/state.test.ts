/**
 * Unit tests for the M5 player state machine: phase transitions, refusal of
 * an already-expired grant, and the credential-clearing rule.
 */
import { describe, expect, it } from 'vitest';
import {
  INITIAL_PLAYER_STATE,
  isTerminalPhase,
  reducePlayerState,
  shouldFlushProgress,
} from './state.js';
import type { PlayerState } from '../types/models.js';

function playing(): PlayerState {
  return { ...INITIAL_PLAYER_STATE, phase: 'playing' };
}

function loading(): PlayerState {
  return { ...INITIAL_PLAYER_STATE, phase: 'loading' };
}

describe('grant adoption', () => {
  it('moves to requesting then loading on a valid grant', () => {
    const requested = reducePlayerState(INITIAL_PLAYER_STATE, { type: 'REQUEST' });
    expect(requested.state.phase).toBe('requesting');
    expect(requested.clearCredentials).toBe(true);

    const granted = reducePlayerState(requested.state, {
      type: 'GRANTED',
      expiresAt: 1_000,
      now: 500,
    });
    expect(granted.state.phase).toBe('loading');
    expect(granted.clearCredentials).toBe(false);
  });

  it('refuses a grant whose token is already expired', () => {
    const out = reducePlayerState(INITIAL_PLAYER_STATE, {
      type: 'GRANTED',
      expiresAt: 100,
      now: 500,
    });
    expect(out.state.phase).toBe('expired');
    expect(out.state.grant).toBeNull();
    expect(out.clearCredentials).toBe(true);
  });

  it('refuses a grant expiring at exactly now', () => {
    const out = reducePlayerState(INITIAL_PLAYER_STATE, {
      type: 'GRANTED',
      expiresAt: 500,
      now: 500,
    });
    expect(out.state.phase).toBe('expired');
  });
});

describe('credential clearing', () => {
  it('clears on denial, error, end, expiry and reset', () => {
    const events = [
      { type: 'DENIED', code: 'SUBSCRIPTION_EXPIRED' },
      { type: 'FAILED', code: 'MEDIA_NOT_READY' },
      { type: 'ENDED' },
      { type: 'EXPIRED' },
      { type: 'RESET' },
    ] as const;
    for (const event of events) {
      expect(reducePlayerState(playing(), event).clearCredentials).toBe(true);
    }
  });

  it('drops the grant on denial, error and expiry', () => {
    for (const event of [
      { type: 'DENIED', code: 'SUBSCRIPTION_EXPIRED' },
      { type: 'FAILED', code: 'X' },
      { type: 'EXPIRED' },
    ] as const) {
      expect(reducePlayerState(playing(), event).state.grant).toBeNull();
    }
  });

  it('keeps the grant for ordinary playback transitions', () => {
    expect(reducePlayerState(loading(), { type: 'READY' }).clearCredentials).toBe(false);
    expect(reducePlayerState(loading(), { type: 'PLAYING' }).clearCredentials).toBe(false);
    expect(reducePlayerState(playing(), { type: 'PAUSED' }).state.phase).toBe('paused');
  });

  it('marks denial and error phases terminal', () => {
    expect(isTerminalPhase('error')).toBe(true);
    expect(isTerminalPhase('ended')).toBe(true);
    expect(isTerminalPhase('expired')).toBe(true);
    expect(isTerminalPhase('playing')).toBe(false);
    expect(isTerminalPhase('loading')).toBe(false);
  });
});

describe('entitlement loss wins over any playback phase', () => {
  it('reaches the error phase carrying the denial code', () => {
    const out = reducePlayerState(playing(), { type: 'DENIED', code: 'SUBSCRIPTION_EXPIRED' });
    expect(out.state.phase).toBe('error');
    expect(out.state.errorCode).toBe('SUBSCRIPTION_EXPIRED');
  });
});

describe('progress flush throttle', () => {
  it('suppresses writes inside the interval', () => {
    expect(shouldFlushProgress(0, 9_999)).toBe(false);
  });

  it('allows a write at the interval boundary', () => {
    expect(shouldFlushProgress(0, 10_000)).toBe(true);
  });

  it('always allows a forced final flush', () => {
    expect(shouldFlushProgress(0, 1, 10_000, true)).toBe(true);
  });
});
