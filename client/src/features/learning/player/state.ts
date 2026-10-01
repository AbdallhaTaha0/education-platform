/**
 * Player state reduction (M5).
 *
 * Pure so the transitions, the expiry behaviour and the credential-clearing
 * rule can be unit tested without a media element or a DRM dependency.
 */
import type { PlayerPhase, PlayerState } from '../types/models.js';

export const INITIAL_PLAYER_STATE: PlayerState = {
  phase: 'idle',
  grant: null,
  errorCode: null,
  message: null,
};

export type PlayerEvent =
  | { type: 'REQUEST' }
  | { type: 'GRANTED'; expiresAt: number; now: number }
  | { type: 'DENIED'; code: string }
  | { type: 'LOADING' }
  | { type: 'READY' }
  | { type: 'PLAYING' }
  | { type: 'PAUSED' }
  | { type: 'ENDED' }
  | { type: 'FAILED'; code: string }
  | { type: 'EXPIRED' }
  | { type: 'RESET' };

/** Phases from which the transient credential must be discarded. */
const TERMINAL: ReadonlySet<PlayerPhase> = new Set<PlayerPhase>(['ended', 'error', 'expired']);

export interface ReduceResult {
  state: PlayerState;
  /** The caller must clear transient credentials when true. */
  clearCredentials: boolean;
}

export function reducePlayerState(state: PlayerState, event: PlayerEvent): ReduceResult {
  switch (event.type) {
    case 'REQUEST':
      return {
        state: { phase: 'requesting', grant: null, errorCode: null, message: null },
        clearCredentials: true,
      };
    case 'GRANTED':
      // A grant whose token is already expired is never adopted.
      if (event.expiresAt <= event.now) {
        return { state: { ...INITIAL_PLAYER_STATE, phase: 'expired' }, clearCredentials: true };
      }
      return {
        state: { ...state, phase: 'loading', errorCode: null, message: null },
        clearCredentials: false,
      };
    case 'DENIED':
      return {
        state: { phase: 'error', grant: null, errorCode: event.code, message: null },
        clearCredentials: true,
      };
    case 'LOADING':
      return { state: { ...state, phase: 'loading' }, clearCredentials: false };
    case 'READY':
      return state.phase === 'loading' || state.phase === 'requesting'
        ? { state: { ...state, phase: 'ready' }, clearCredentials: false }
        : { state, clearCredentials: false };
    case 'PLAYING':
      return { state: { ...state, phase: 'playing', errorCode: null }, clearCredentials: false };
    case 'PAUSED':
      return state.phase === 'playing'
        ? { state: { ...state, phase: 'paused' }, clearCredentials: false }
        : { state, clearCredentials: false };
    case 'ENDED':
      return { state: { ...state, phase: 'ended' }, clearCredentials: true };
    case 'FAILED':
      return {
        state: { phase: 'error', grant: null, errorCode: event.code, message: null },
        clearCredentials: true,
      };
    case 'EXPIRED':
      return {
        state: { phase: 'expired', grant: null, errorCode: null, message: null },
        clearCredentials: true,
      };
    case 'RESET':
      return { state: { ...INITIAL_PLAYER_STATE }, clearCredentials: true };
    default:
      return { state, clearCredentials: false };
  }
}

export function isTerminalPhase(phase: PlayerPhase): boolean {
  return TERMINAL.has(phase);
}

/** Throttle policy: at most one write per interval, plus a forced final flush. */
export function shouldFlushProgress(
  lastFlushMs: number,
  nowMs: number,
  intervalMs = 10_000,
  force = false,
): boolean {
  if (force) return true;
  return nowMs - lastFlushMs >= intervalMs;
}
