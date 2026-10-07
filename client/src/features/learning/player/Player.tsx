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
import { useLang } from '../../../i18n';
import { INITIAL_PLAYER_STATE, reducePlayerState, shouldFlushProgress } from './state';
import { authHeaders, clear as clearSession, isExpired, setSession } from './session';
import { emeKeyForProvider, isUnsupportedProvider } from './eme';
import { PlayerOverlay, WatermarkOverlay, phaseLabel, type PlayerLabels } from './PlayerChrome';
import { protectedRequestUrl } from './requests';
import { classifyPlayRejection } from './playRejection';
import { awaitsEncryptionInitData } from './errors';
import { usePlayerFullscreen } from './fullscreen';
import { PlayerControls } from './PlayerControls';
import { useViewTracking } from './useViewTracking';
import { finishAfterViewFlush } from './finalViewFlush';
import { videoQualityOptions, type VideoQualityOption } from './playbackOptions';
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
  autoPlay?: boolean;
  /**
   * M10 view-tracking binding. When both are present the player reports
   * actual playing time for this grant; when absent tracking stays disabled
   * and all existing resume/completion behavior is unchanged.
   */
  courseRef?: string | null;
  lessonId?: string | null;
  onProgress?: (
    positionSeconds: number,
    durationSeconds: number | null,
    completed: boolean,
    keepalive?: boolean,
  ) => void;
  onEnded?: () => void;
  onError?: (code: string) => void;
  onExpire?: () => void;
  onRetry?: () => void;
}

const PROGRESS_INTERVAL_MS = 10_000;
/** setTimeout saturates above this, so a long wait is re-scheduled instead. */
const MAX_TIMER_MS = 2_147_483_647;

export function DashLessonPlayer({
  grant,
  labels,
  entitlementLost = false,
  autoPlay = false,
  courseRef = null,
  lessonId = null,
  onProgress,
  onEnded,
  onError,
  onExpire,
  onRetry,
}: PlayerProps): JSX.Element {
  const { lang } = useLang();
  const frameRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const playerRef = useRef<MediaPlayerClass | null>(null);
  const lastFlush = useRef(0);
  const resumeApplied = useRef(false);
  const endingGeneration = useRef(0);
  useEffect(() => {
    endingGeneration.current += 1;
    return () => { endingGeneration.current += 1; };
  }, [grant.referenceId]);
  const [state, setState] = useState<PlayerState>(INITIAL_PLAYER_STATE);
  const [canPlay, setCanPlay] = useState(false);
  const [qualities, setQualities] = useState<VideoQualityOption[]>([]);
  const [quality, setQuality] = useState('auto');
  const [qualityFailed, setQualityFailed] = useState(false);
  const { fullscreen, expanded, toggle: toggleFullscreen } = usePlayerFullscreen(frameRef);

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
  const lastPosition = useRef<{
    position: number;
    duration: number | null;
    completed: boolean;
  } | null>(null);
  const captureProgress = useCallback((video: HTMLVideoElement, completed = false) => {
    if (!Number.isFinite(video.currentTime) || video.currentTime < 0) return;
    const duration = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : null;
    if (video.currentTime === 0 && !completed && lastPosition.current === null) return;
    lastPosition.current = {
      position: video.currentTime,
      duration,
      completed: completed || lastPosition.current?.completed === true,
    };
  }, []);
  const reportProgress = useCallback(
    (completed: boolean, keepalive = false) => {
      if (videoRef.current) captureProgress(videoRef.current, completed);
      const snapshot = lastPosition.current;
      if (snapshot)
        onProgressRef.current?.(
          snapshot.position,
          snapshot.duration,
          snapshot.completed,
          keepalive,
        );
    },
    [captureProgress],
  );

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
    const timer = setTimeout(
      () => {
        if (isExpired()) {
          playerRef.current?.reset();
          videoRef.current?.pause();
          dispatch({ type: 'EXPIRED' });
          onExpireRef.current?.();
        }
      },
      Math.max(wait, 0),
    );
    return () => clearTimeout(timer);
  }, [grant.tokenExpiresAt, dispatch]);

  // A license request made after renewal must use the rotated bearer too.
  // Updating protection data leaves the existing DASH/EME instance intact.
  useEffect(() => {
    const keySystem = emeKeyForProvider(grant.drmProvider);
    if (keySystem && playerRef.current) {
      playerRef.current.setProtectionData({
        [keySystem]: {
          serverURL: grant.licenseUrl,
          httpRequestHeaders: { 'Content-Type': 'application/octet-stream', ...authHeaders() },
        },
      });
    }
  }, [grant.playbackToken, grant.licenseUrl, grant.drmProvider]);

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
    setCanPlay(false); setQualities([]); setQuality('auto'); setQualityFailed(false);
    video.playbackRate = 1;
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
      const url = protectedRequestUrl(request.url, grant.manifestUrl, grant.licenseUrl);
      const headers = authHeaders();
      if (Object.keys(headers).length === 0) return { ...request, url };
      return { ...request, url, headers: { ...(request.headers ?? {}), ...headers } };
    };
    // A player that cannot initialise (no EME support, an unusable manifest, a
    // browser-specific dash.js failure) must degrade to an error state. Letting
    // the exception escape would unmount the whole page.
    //
    // Order is contractual: dash.js throws "MediaPlayer not initialized" for
    // attachSource/attachView/settings touched before initialize(). Protection
    // data is set before initialize (the one legal pre-initialization spot);
    // initialize(video, url, autoplay=false) then performs attachView and
    // attachSource internally. Autoplay stays off: the bottom control bar drives playback.
    try {
      player = dashjs.MediaPlayer().create();
      playerRef.current = player;
      player.setProtectionData({
        [keySystem]: {
          serverURL: grant.licenseUrl,
          // The license request is authorized with the same transient token.
          // It is read at call time, never captured into storage.
          httpRequestHeaders: { 'Content-Type': 'application/octet-stream', ...authHeaders() },
        },
      });
      player.updateSettings({
        debug: { logLevel: 0 },
        streaming: {
          // Keep player preferences in memory; browser storage is reserved for
          // the site's language/theme and the non-credential tab device id.
          lastBitrateCachingInfo: { enabled: false },
          lastMediaSettingsCachingInfo: { enabled: false },
          retryAttempts: { MPD: 2, MediaSegment: 2 },
          buffer: { fastSwitchEnabled: true },
        },
      });
      // Every manifest, segment and license request carries the transient bearer
      // token, read from memory at request time so a refreshed grant is used.
      player.addRequestInterceptor(interceptor);
      player.on(dashjs.MediaPlayer.events.STREAM_INITIALIZED, () => {
        if (playerRef.current !== player || !player) return;
        try { setQualities(videoQualityOptions(player.getRepresentationsByType('video'))); } catch { setQualities([]); }
        setCanPlay(true);
        dispatch({ type: 'LOADING' });
      });
      player.on(dashjs.MediaPlayer.events.QUALITY_CHANGE_RENDERED, () => {
        dispatch({ type: 'READY' });
      });
      player.on(dashjs.MediaPlayer.events.STREAM_ACTIVATED, () => {
        if (playerRef.current !== player || !player) return;
        try {
          setQualities(videoQualityOptions(player.getRepresentationsByType('video')));
        } catch { setQualities([]); }
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
      player.on(dashjs.MediaPlayer.events.ERROR, (event: { error?: unknown }) => {
        const detail = event.error;
        if (awaitsEncryptionInitData(detail)) return;
        const numeric =
          detail && typeof detail === 'object' && 'code' in detail ? detail.code : null;
        // Keep diagnostics useful without forwarding raw URLs or license data.
        const code =
          typeof numeric === 'number' && Number.isSafeInteger(numeric)
            ? `DASH_${numeric}`
            : 'STREAM_SETUP_ERROR';
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
      // Capture before DASH reset or React detaches the video ref.
      captureProgress(video);
      reportProgress(false, true);
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
  }, [
    grant.manifestUrl,
    grant.licenseUrl,
    grant.drmProvider,
    dispatch,
    captureProgress,
    reportProgress,
  ]);

  // M10 view tracking: one in-memory session per successful grant. Disabled
  // when the parent does not supply courseRef/lessonId; existing progress,
  // DRM recovery, watermark, fullscreen and entitlement behavior unchanged.
  // Token renewal keeps the same referenceId and therefore the same view row.
  const waitingRef = useRef(false);
  const tracking = useViewTracking(videoRef, grant, courseRef ?? null, lessonId ?? null);
  const trackingRef = useRef(tracking);
  trackingRef.current = tracking;

  // Sample state transitions as well as timeupdates. Idle elements need not
  // emit timeupdates, so a pause/buffer/seek event must close the clock itself.
  const observePlayback = useCallback(() => {
    const video = videoRef.current;
    if (video) {
      // Elapsed playing time only: the clock credits monotonic wall time while
      // actually playing. Rate changes, seeks and buffering never inflate it;
      // media position is never used as duration.
      trackingRef.current.observe({
        paused: video.paused,
        seeking: video.seeking,
        ended: video.ended,
        waiting: waitingRef.current || video.readyState < 2,
        nowMs: performance.now(),
      });
    }
  }, []);

  // Throttled progress; a final flush happens on pause/end/unmount.
  const handleTimeUpdate = useCallback(() => {
    const video = videoRef.current;
    if (video) captureProgress(video);
    observePlayback();
    const now = Date.now();
    if (!shouldFlushProgress(lastFlush.current, now, PROGRESS_INTERVAL_MS)) return;
    lastFlush.current = now;
    reportProgress(false);
  }, [reportProgress, captureProgress, observePlayback]);

  const handlePause = useCallback(() => {
    observePlayback();
    dispatch({ type: 'PAUSED' });
    reportProgress(false);
    // Pause stays in the same session; flush the monotonic total best-effort.
    void trackingRef.current.flush();
  }, [dispatch, reportProgress, observePlayback]);

  const handleReady = useCallback(() => dispatch({ type: 'READY' }), [dispatch]);
  const handleWaiting = useCallback(() => {
    waitingRef.current = true;
    observePlayback();
  }, [observePlayback]);
  const handlePlaying = useCallback(() => {
    waitingRef.current = false;
    observePlayback();
    dispatch({ type: 'PLAYING' });
  }, [dispatch, observePlayback]);

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
    observePlayback();
    dispatch({ type: 'ENDED' });
    reportProgress(true);
    // Prefer flush-before-end, with a bounded wait so tracking cannot block
    // playback. A delayed keepalive flush remains eligible under the server's
    // 120s fresh-ENDED grace. Superseded/unmounted grants never fire a late end.
    const generation = endingGeneration.current;
    const flush = trackingRef.current.flush;
    const finish = onEndedRef.current;
    void finishAfterViewFlush(
      () => flush({ keepalive: true }),
      () => finish?.(),
      () => generation === endingGeneration.current,
    );
  }, [dispatch, reportProgress, observePlayback]);

  // Save on page exit as well as component teardown. Background tabs keep playback.
  useEffect(() => {
    const flush = () => reportProgress(false, true);
    window.addEventListener('pagehide', flush);
    return () => window.removeEventListener('pagehide', flush);
  }, [reportProgress]);

  const [needsGesture, setNeedsGesture] = useState(false);
  const [playFailure, setPlayFailure] = useState<string | null>(null);
  // Guards stale play-promise results after teardown or a lesson change: the
  // captured grant reference must still be current when the promise settles.
  const grantIdRef = useRef<string | null>(null);
  const mountedRef = useRef(true);
  useEffect(() => {
    grantIdRef.current = grant.referenceId;
    setNeedsGesture(false);
    setPlayFailure(null);
  }, [grant.referenceId]);
  useEffect(() => {
    // React StrictMode replays setup/cleanup in development. A replayed
    // setup must restore the flag so rejection handling remains active.
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const play = useCallback(() => {
    const video = videoRef.current;
    if (video === null) return;
    if (!video.paused) return;
    setNeedsGesture(false);
    setPlayFailure(null);
    const capturedGrantId = grantIdRef.current;
    const attempt = video.play();
    if (attempt && typeof (attempt as Promise<void>).catch === 'function') {
      (attempt as Promise<void>).catch((err: unknown) => {
        // Ignore results that arrive after teardown or a lesson/grant switch.
        if (!mountedRef.current || grantIdRef.current !== capturedGrantId) return;
        const outcome = classifyPlayRejection((err as { name?: string })?.name ?? '');
        if (outcome.action === 'gesture') {
          // Browser gesture/autoplay refusal is not a media failure: the
          // grant is preserved and the viewer is asked for an explicit
          // gesture. No uncaught rejection.
          setNeedsGesture(true);
          return;
        }
        // Unsupported media vs generic playback failure carry different next
        // actions (supported-browser guidance vs bounded retry).
        setPlayFailure(outcome.code);
        dispatch({ type: 'FAILED', code: outcome.code });
        onErrorRef.current?.(outcome.code);
      });
    }
  }, [dispatch]);

  const toggle = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) play();
    else video.pause();
  }, [play]);

  const changeQuality = useCallback((value: string) => {
    const player = playerRef.current;
    if (!player || !canPlay || entitlementLost || phaseRef.current === 'expired' || phaseRef.current === 'error') return;
    const id = value.startsWith('representation:') ? value.slice('representation:'.length) : null;
    if (value !== 'auto' && !qualities.some(option => option.id === id)) return;
    try {
      player.updateSettings({ streaming: { abr: { autoSwitchBitrate: { video: value === 'auto' } } } });
      if (id !== null) player.setRepresentationForTypeById('video', id, true);
      setQuality(value); setQualityFailed(false);
    } catch {
      try { player.updateSettings({ streaming: { abr: { autoSwitchBitrate: { video: true } } } }); setQuality('auto'); } catch { /* preserve existing media-error handling */ }
      setQualityFailed(true);
    }
  }, [canPlay, entitlementLost, qualities]);

  const autoPlayAttempt = useRef<string | null>(null);
  useEffect(() => {
    if (!autoPlay || !canPlay || entitlementLost || autoPlayAttempt.current === grant.referenceId)
      return;
    autoPlayAttempt.current = grant.referenceId;
    play();
  }, [autoPlay, canPlay, entitlementLost, grant.referenceId, play]);

  return (
    <div className="w-full">
      <div
        ref={frameRef}
        className={`relative aspect-video w-full overflow-hidden rounded-card border border-border learning-video-surface learning-video-frame ${expanded ? 'learning-video-frame--expanded' : ''}`}
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
          playsInline
          preload="metadata"
          aria-label={labels.playerLabel}
          onTimeUpdate={handleTimeUpdate}
          onPause={handlePause}
          onCanPlay={handleReady}
          onLoadedMetadata={handleLoadedMetadata}
          onWaiting={handleWaiting}
          onSeeking={observePlayback}
          onSeeked={observePlayback}
          onPlaying={handlePlaying}
          onEnded={handleEnded}
          onDoubleClick={() => void toggleFullscreen()}
        ></video>
        <PlayerOverlay
          phase={state.phase}
          labels={labels}
          code={state.errorCode ?? playFailure}
          canPlay={canPlay}
        />
        <PlayerControls
          videoRef={videoRef}
          labels={labels}
          disabled={state.phase === 'expired' || state.phase === 'error'}
          fullscreen={fullscreen}
          qualities={qualities}
          quality={quality}
          onQualityChange={changeQuality}
          onTogglePlayback={toggle}
          onToggleFullscreen={() => void toggleFullscreen()}
        />
        {/* Watermark last: it must stay visible over every state overlay. */}
        <WatermarkOverlay grant={grant} />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        {state.phase === 'error' && onRetry ? (
          <button
            type="button"
            data-testid="player-retry"
            onClick={onRetry}
            className="min-h-[44px] rounded-control border border-border px-4 py-2 font-bold focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus"
          >
            {labels.retry}
          </button>
        ) : null}
        <span aria-live="polite" className="text-sm text-muted">
          {needsGesture && labels.needsGesture
            ? labels.needsGesture
            : phaseLabel(state.phase, labels)}
        </span>
        {qualityFailed ? <span role="status" className="text-sm text-error-fg">{lang === 'ar' ? 'تعذّر تغيير الجودة. حاول مجددًا.' : 'Could not change quality. Try again.'}</span> : null}
      </div>
    </div>
  );
}
