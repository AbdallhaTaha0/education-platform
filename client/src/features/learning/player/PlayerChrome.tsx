/**
 * Player presentation components (M5).
 *
 * Split out of Player.tsx so the player keeps to a single responsibility and
 * both files stay small enough to review.
 */
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../../auth';
import { isWatermarkVisible, randomWatermarkPosition, WATERMARK_MOVE_INTERVAL_MS, watermarkText } from './watermark';
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
 * Renders one authenticated student phone label, randomly relocated inside
 * measured video-frame bounds (owner instruction, 2026-10-07). The trace code and the
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
  const visible = isWatermarkVisible(watermark);
  const text = watermarkText(watermark, user?.phone) ?? '';
  const areaRef = useRef<HTMLDivElement>(null);
  const labelRef = useRef<HTMLSpanElement>(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  useEffect(() => {
    if (!visible) return;
    const relocate = () => {
      const area = areaRef.current, label = labelRef.current;
      if (!area || !label) return;
      const controls = area.parentElement?.querySelector('[data-testid="player-controls"]');
      if (controls) area.style.bottom = `${controls.getBoundingClientRect().height + 8}px`;
      setPosition(previous => randomWatermarkPosition(area.clientWidth, area.clientHeight, label.offsetWidth, label.offsetHeight, previous));
    };
    relocate();
    const timer = setInterval(relocate, WATERMARK_MOVE_INTERVAL_MS);
    const observer = new ResizeObserver(relocate);
    if (areaRef.current) observer.observe(areaRef.current);
    if (labelRef.current) observer.observe(labelRef.current);
    const controls = areaRef.current?.parentElement?.querySelector('[data-testid="player-controls"]');
    if (controls) observer.observe(controls);
    return () => { clearInterval(timer); observer.disconnect(); };
  }, [visible, text, grant.referenceId]);
  if (!visible) return null;
  return (
    <div
      aria-hidden="true"
      data-testid="watermark-overlay"
      ref={areaRef}
      data-watermark-labels={1}
      className="learning-watermark"
    >
        <span
          ref={labelRef}
          data-testid="watermark-label"
          // `dir="auto"` keeps a mixed-direction masked identity from being
          // reordered inside the Arabic (RTL) and English (LTR) layouts.
          dir="auto"
          className="learning-watermark__label"
          style={{ left: position.x, top: position.y }}
        >
          {text}
        </span>
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
