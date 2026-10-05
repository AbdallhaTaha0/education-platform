/**
 * Player presentation components (M5).
 *
 * Split out of Player.tsx so the player keeps to a single responsibility and
 * both files stay small enough to review.
 */
import { useAuth } from '../../../auth';
import { isWatermarkVisible, watermarkLabels, watermarkText } from './watermark';
import type { PlaybackGrant, PlayerPhase } from '../types/models';

export interface PlayerLabels {
  loading: string;
  ready: string;
  playing: string;
  paused: string;
  ended: string;
  error: string;
  expired: string;
  play: string;
  pause: string;
  resume: string;
  retry: string;
  playerLabel: string;
  unsupported: string;
  fullscreen: string;
  exitFullscreen: string;
  needsGesture?: string;
  unsupportedDetail?: string;
  networkDetail?: string;
  expiredDetail?: string;
  deviceDetail?: string;
  revokedDetail?: string;
  streamDetail?: string;
}

export function errorDetail(code: string | null, labels: PlayerLabels): string | null {
  if (!code) return null;
  if (code === 'UNSUPPORTED_PROVIDER') return labels.unsupportedDetail ?? labels.unsupported;
  if (code === 'PLAYBACK_GESTURE_REQUIRED') return labels.needsGesture ?? null;
  if (code === 'PLAYBACK_ERROR' || code.startsWith('DASH_') || code === 'STREAM_SETUP_ERROR' || code === 'PLAYER_INIT_FAILED')
    return labels.networkDetail ?? null;
  return null;
}

export function phaseLabel(phase: PlayerPhase, labels: PlayerLabels): string {
  switch (phase) {
    case 'requesting':
    case 'loading':
      return labels.loading;
    case 'ready':
      return labels.ready;
    case 'playing':
      return labels.playing;
    case 'paused':
      return labels.paused;
    case 'ended':
      return labels.ended;
    case 'expired':
      return labels.expired;
    case 'error':
      return labels.error;
    default:
      return '';
  }
}

/**
 * Visible watermark overlay.
 *
 * Renders the authenticated student phone at the DRM-supplied positions, per
 * the owner instruction on 2026-10-05. The trace code and the
 * signature are never sent to the client, so nothing here is attributable on its
 * own; this is a visible account label, not a claim that
 * screen capture is prevented.
 *
 * The layer is rendered AFTER the state overlay by the player, and its CSS
 * carries a stacking order above it, so the watermark stays visible in every
 * player state — loading, error, ended and expired — and across responsive
 * resizing and a fullscreen transition. It is `aria-hidden`, takes no pointer
 * events and is not selectable, so it neither blocks the native controls nor
 * reaches assistive technology.
 */
export function WatermarkOverlay({ grant }: { grant: PlaybackGrant }): JSX.Element | null {
  const { user } = useAuth();
  const watermark = grant.watermark;
  if (!isWatermarkVisible(watermark)) return null;
  const text = watermarkText(watermark, user?.phone) ?? '';
  const labels = watermarkLabels(watermark);
  return (
    <div
      aria-hidden="true"
      data-testid="watermark-overlay"
      data-watermark-labels={labels.length}
      className="learning-watermark"
    >
      {labels.map((label) => (
        <span
          key={label.key}
          data-testid="watermark-label"
          // `dir="auto"` keeps a mixed-direction masked identity from being
          // reordered inside the Arabic (RTL) and English (LTR) layouts.
          dir="auto"
          className="learning-watermark__label"
          style={{ left: `${label.x}%`, top: `${label.y}%` }}
        >
          {text}
        </span>
      ))}
    </div>
  );
}

export function PlayerOverlay({
  phase,
  labels,
  code,
  canPlay,
}: {
  phase: PlayerPhase;
  labels: PlayerLabels;
  code: string | null;
  canPlay: boolean;
}): JSX.Element | null {
  if (phase === 'ended' || phase === 'expired') {
    return (
      <div
        data-testid="player-state"
        data-phase={phase}
        className="absolute inset-0 flex items-center justify-center learning-video-overlay px-4 text-center text-sm font-bold text-white"
      >
        {phase === 'ended' ? labels.ended : labels.expired}
      </div>
    );
  }
  if (phase === 'error') {
    const detail = errorDetail(code, labels);
    return (
      <div
        data-testid="player-state"
        data-phase="error"
        data-code={code ?? 'UNKNOWN'}
        className="absolute inset-0 flex flex-col items-center justify-center gap-2 learning-video-overlay px-4 text-center text-sm font-bold text-white"
      >
        <span>{code === 'UNSUPPORTED_PROVIDER' ? labels.unsupported : labels.error}</span>
        {detail ? <span className="max-w-md text-xs font-normal opacity-90">{detail}</span> : null}
      </div>
    );
  }
  if (phase === 'loading' || phase === 'requesting') {
    return (
      <div
        data-testid="player-state"
        data-phase="loading"
        className="absolute inset-0 flex items-center justify-center learning-video-overlay px-4 text-center text-sm text-white"
      >
        {labels.loading}
      </div>
    );
  }
  if (phase === 'ready' && !canPlay) {
    return (
      <div
        data-testid="player-state"
        data-phase="ready"
        className="absolute inset-0 flex items-center justify-center learning-video-overlay px-4 text-center text-sm text-white"
      >
        {labels.ready}
      </div>
    );
  }
  return null;
}
