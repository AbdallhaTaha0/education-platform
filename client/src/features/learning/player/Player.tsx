/**
 * DASH/EME lesson player (M5).
 *
 * Uses dashjs, a maintained DASH player with EME support, rather than a CDN
 * script or a hand-rolled DRM implementation. All manifest, segment and license
 * requests carry the transient bearer token that lives in player/session.ts.
 *
 * What this component does NOT claim: it does not prove Widevine is
 * provisioned, and it does not claim any watermark prevents screen capture. The
 * key system the DRM reports is configured explicitly; an unrecognised provider
 * surfaces an error state instead of silently downgrading.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import * as dashjs from 'dashjs';
import { INITIAL_PLAYER_STATE, reducePlayerState, shouldFlushProgress } from './state';
import { authHeaders, clear as clearSession, isExpired, setSession } from './session';
import { emeKeyForProvider, isUnsupportedProvider } from './eme';
import { PlayerOverlay, WatermarkOverlay, phaseLabel, type PlayerLabels } from './PlayerChrome';
import type { PlaybackGrant, PlayerState } from '../types/models';

type MediaPlayerClass = ReturnType<ReturnType<typeof dashjs.MediaPlayer>['create']>;
type Interceptor = Parameters<MediaPlayerClass['addRequestInterceptor']>[0];
type InterceptedRequest = Parameters<Interceptor>[0];

export type { PlayerLabels };

export interface PlayerProps {
  grant: PlaybackGrant;
  labels: PlayerLabels;
  /** True when entitlement is known to have lapsed; forces the expired state. */
  entitlementLost?: boolean;
  onProgress?: (positionSeconds: number, durationSeconds: number | null, completed: boolean) => void;
  onEnded?: () => void;
  onError?: (code: string) => void;
  onExpire?: () => void;
}

const PROGRESS_INTERVAL_MS = 10_000;
/** setTimeout saturates above this, so a long wait is re-scheduled instead. */
const MAX_TIMER_MS = 2_147_483_647;

export function DashLessonPlayer({
  grant,
  labels,
  entitlementLost = false,
  onProgress,
  onEnded,
  onError,
  onExpire,
}: PlayerProps): JSX.Element {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const playerRef = useRef<MediaPlayerClass | null>(null);
  const lastFlush = useRef(0);
  const resumeApplied = useRef(false);
  const [state, setState] = useState<PlayerState>(INITIAL_PLAYER_STATE);
  const [canPlay, setCanPlay] = useState(false);

  // The reducer needs the current phase, so it is read through a ref to keep
  // every effect stable instead of re-subscribing on each state change.
  const phaseRef = useRef(state.phase);
  const dispatch = useCallback((event: Parameters<typeof reducePlayerState>[1]) => {
    const result = reducePlayerState({ ...INITIAL_PLAYER_STATE, phase: phaseRef.current }, event);
    phaseRef.current = result.state.phase;
    setState(result.state);
    if (result.clearCredentials) clearSession();
  }, []);

  /**
   * Parent callbacks are held in refs. The page re-renders on every progress
   * write, and an inline callback would get a new identity each time; if any
   * effect depended on it, the whole DASH/EME instance would be torn down and
   * rebuilt on every ten-second write. The refs keep every effect inert to
   * parent renders.
   */
  const onErrorRef = useRef(onError);
  const onExpireRef = useRef(onExpire);
  const onEndedRef = useRef(onEnded);
  const onProgressRef = useRef(onProgress);
  onErrorRef.current = onError;
  onExpireRef.current = onExpire;
  onEndedRef.current = onEnded;
  onProgressRef.current = onProgress;

  // Keep the transient session in memory only, for the lifetime of the grant.
  // A renewal replaces the token on the SAME external session, so the resume
  // guard is keyed on the reference id: renewing must not re-seek the video.
  const lastReference = useRef<string | null>(null);
  const grantRefPosition = useRef(0);
  useEffect(() => {
    setSession({
      referenceId: grant.referenceId,
      playbackSessionId: grant.playbackSessionId,
      playbackToken: grant.playbackToken,
      manifestUrl: grant.manifestUrl,
      licenseUrl: grant.licenseUrl,
      drmProvider: grant.drmProvider,
      tokenExpiresAt: Date.parse(grant.tokenExpiresAt),
      sessionExpiresAt: Date.parse(grant.sessionExpiresAt),
    });
    if (lastReference.current !== grant.referenceId) {
      lastReference.current = grant.referenceId;
      resumeApplied.current = false;
      grantRefPosition.current = grant.resumePositionSeconds;
    }
    if (isExpired()) {
      dispatch({ type: 'EXPIRED' });
      onExpireRef.current?.();
    }
  }, [grant, dispatch]);

  // Stop playback and discard credentials the moment the token lapses. The DRM
  // already refuses the token, so this closes the media element rather than
  // relying on the next failed segment request.
  useEffect(() => {
    const expiresAtMs = Date.parse(grant.tokenExpiresAt);
    if (!Number.isFinite(expiresAtMs) || phaseRef.current === 'expired') return;
    const wait = Math.min(expiresAtMs - Date.now(), MAX_TIMER_MS);
    const timer = setTimeout(() => {
      if (isExpired()) {
        playerRef.current?.reset();
        videoRef.current?.pause();
        dispatch({ type: 'EXPIRED' });
        onExpireRef.current?.();
      }
    }, Math.max(wait, 0));
    return () => clearTimeout(timer);
  }, [grant.tokenExpiresAt, dispatch]);

  // Entitlement loss stops playback and discards credentials immediately.
  useEffect(() => {
    if (!entitlementLost) return;
    playerRef.current?.reset();
    videoRef.current?.pause();
    dispatch({ type: 'EXPIRED' });
    onExpireRef.current?.();
  }, [entitlementLost, dispatch]);

  useEffect(() => {
    const video = videoRef.current;
    if (video === null) return;
    const keySystem = emeKeyForProvider(grant.drmProvider);
    if (keySystem === null || isUnsupportedProvider(grant)) {
      dispatch({ type: 'FAILED', code: 'UNSUPPORTED_PROVIDER' });
      onErrorRef.current?.('UNSUPPORTED_PROVIDER');
      return;
    }

    let player: MediaPlayerClass | null = null;
    // Every manifest, segment and license request carries the transient bearer
    // token, read from memory at request time so a refreshed grant is used.
    const interceptor: Interceptor = async (request: InterceptedRequest) => {
      const headers = authHeaders();
      if (Object.keys(headers).length === 0) return request;
      return { ...request, headers: { ...(request.headers ?? {}), ...headers } };
    };
    // A player that cannot initialise (no EME support, an unusable manifest, a
    // browser-specific dash.js failure) must degrade to an error state. Letting
    // the exception escape would unmount the whole page.
    //
    // Order is contractual: dash.js throws "MediaPlayer not initialized" for
    // attachSource/attachView/settings touched before initialize(). Protection
    // data is set before initialize (the one legal pre-initialization spot);
    // initialize(video, url, autoplay=false) then performs attachView and
    // attachSource internally. Autoplay stays off: the native controls and the
    // explicit play control drive playback.
    try {
      player = dashjs.MediaPlayer().create();
      playerRef.current = player;
      player.setProtectionData({
        [keySystem]: {
          serverURL: grant.licenseUrl,
          // The license request is authorized with the same transient token.
          // It is read at call time, never captured into storage.
          httpRequestHeaders: authHeaders(),
        },
      });
      player.updateSettings({
        streaming: {
          retryAttempts: { MPD: 2, MediaSegment: 2 },
          buffer: { fastSwitchEnabled: true },
        },
      });
      // Every manifest, segment and license request carries the transient bearer
      // token, read from memory at request time so a refreshed grant is used.
      player.addRequestInterceptor(interceptor);
      player.on(dashjs.MediaPlayer.events.STREAM_INITIALIZED, () => {
        setCanPlay(true);
        dispatch({ type: 'LOADING' });
      });
      player.on(dashjs.MediaPlayer.events.QUALITY_CHANGE_RENDERED, () => {
        dispatch({ type: 'READY' });
      });
      player.on(dashjs.MediaPlayer.events.PLAYBACK_ERROR, () => {
        dispatch({ type: 'FAILED', code: 'PLAYBACK_ERROR' });
        onErrorRef.current?.('PLAYBACK_ERROR');
      });
      // A fatal manifest/stream setup failure (MPD unavailable, unparseable, or
      // otherwise unusable) never reaches PLAYBACK_ERROR — that event is for
      // media element errors. Without this the viewer is left staring at a blank
      // player with no explanation and no way forward, so both the fatal and the
      // media error paths settle in the same visible error state.
      player.on(dashjs.MediaPlayer.events.ERROR, (event: { error?: string }) => {
        const code = typeof event?.error === 'string' && event.error !== '' ? 'STREAM_SETUP_ERROR' : 'PLAYBACK_ERROR';
        dispatch({ type: 'FAILED', code });
        onErrorRef.current?.(code);
      });
      player.initialize(video, grant.manifestUrl, false);
    } catch {
      playerRef.current = null;
      dispatch({ type: 'FAILED', code: 'PLAYER_INIT_FAILED' });
      onErrorRef.current?.('PLAYER_INIT_FAILED');
    }

    return () => {
      // Abort in-flight requests and release the EME session on unmount.
      try {
        player?.removeRequestInterceptor(interceptor);
        player?.reset();
        player?.destroy();
      } catch {
        // A teardown failure must never break navigation.
      }
      playerRef.current = null;
      clearSession();
    };
  }, [grant.manifestUrl, grant.licenseUrl, grant.drmProvider, dispatch]);

  const reportProgress = useCallback((completed: boolean) => {
    const video = videoRef.current;
    if (video === null) return;
    const duration = Number.isFinite(video.duration) ? video.duration : null;
    onProgressRef.current?.(video.currentTime, duration, completed);
  }, []);

  // Throttled progress; a final flush happens on pause/end/unmount.
  const handleTimeUpdate = useCallback(() => {
    const now = Date.now();
    if (!shouldFlushProgress(lastFlush.current, now, PROGRESS_INTERVAL_MS)) return;
    lastFlush.current = now;
    reportProgress(false);
  }, [reportProgress]);

  const handlePause = useCallback(() => {
    dispatch({ type: 'PAUSED' });
    reportProgress(false);
  }, [dispatch, reportProgress]);

  const handlePlay = useCallback(() => dispatch({ type: 'PLAYING' }), [dispatch]);
  const handleReady = useCallback(() => dispatch({ type: 'READY' }), [dispatch]);

  // Resume exactly once, after the media element knows its own duration.
  const handleLoadedMetadata = useCallback(() => {
    const video = videoRef.current;
    if (video === null || resumeApplied.current) return;
    resumeApplied.current = true;
    // A renewal must not re-seek: the target belongs to the original grant.
    const target = grantRefPosition.current;
    if (target > 0 && Number.isFinite(video.duration) && target < video.duration) {
      video.currentTime = target;
    }
  }, []);

  const handleEnded = useCallback(() => {
    dispatch({ type: 'ENDED' });
    reportProgress(true);
    onEndedRef.current?.();
  }, [dispatch, reportProgress]);

  // Final flush on unmount without tearing the tree down twice.
  useEffect(() => {
    return () => {
      reportProgress(false);
    };
  }, [reportProgress]);

  const toggle = useCallback(() => {
    const video = videoRef.current;
    if (video === null) return;
    if (video.paused) void video.play();
    else video.pause();
  }, []);

  return (
    <div className="w-full">
      <div
        className="relative aspect-video w-full overflow-hidden rounded-card border border-border bg-ink"
        // The platform-side reference id is a non-secret row identifier, already
        // visible in the API response the browser received. The playback bearer
        // token is NEVER placed in the DOM.
        data-reference-id={grant.referenceId}
      >
        <video
          ref={(element: HTMLVideoElement | null) => {
            videoRef.current = element;
          }}
          className="h-full w-full"
          controls
          playsInline
          preload="metadata"
          aria-label={labels.playerLabel}
          onTimeUpdate={handleTimeUpdate}
          onPlay={handlePlay}
          onPause={handlePause}
          onCanPlay={handleReady}
          onLoadedMetadata={handleLoadedMetadata}
          onEnded={handleEnded}
        />
        <PlayerOverlay phase={state.phase} labels={labels} code={state.errorCode} canPlay={canPlay} />
        {/* Watermark last: it must stay visible over every state overlay. */}
        <WatermarkOverlay grant={grant} />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          className="min-h-[44px] rounded-control border border-border px-4 py-2 font-bold focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus"
          onClick={toggle}
          disabled={state.phase === 'expired' || state.phase === 'error'}
        >
          {state.phase === 'playing' ? labels.pause : state.phase === 'paused' ? labels.resume : labels.play}
        </button>
        <span aria-live="polite" className="text-sm text-muted">
          {phaseLabel(state.phase, labels)}
        </span>
      </div>
    </div>
  );
}
