import { useEffect, useState, type RefObject } from 'react';
import { useLang } from '../../../i18n';
import type { PlayerLabels } from './PlayerChrome';

const clock = (seconds: number) => {
  const whole = Math.floor(Number.isFinite(seconds) ? Math.max(0, seconds) : 0);
  return Math.floor(whole / 60) + ':' + String(whole % 60).padStart(2, '0');
};

/** One bottom bar. Fullscreen targets the frame, including its watermark. */
export function PlayerControls({
  videoRef,
  labels,
  disabled,
  fullscreen,
  onTogglePlayback,
  onToggleFullscreen,
}: {
  videoRef: RefObject<HTMLVideoElement>;
  labels: PlayerLabels;
  disabled: boolean;
  fullscreen: boolean;
  onTogglePlayback: () => void;
  onToggleFullscreen: () => void;
}) {
  const { lang } = useLang();
  const [media, setMedia] = useState({ paused: true, time: 0, duration: 0, muted: false });
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const sync = () =>
      setMedia({
        paused: video.paused,
        time: Number.isFinite(video.currentTime) ? video.currentTime : 0,
        duration: Number.isFinite(video.duration) ? video.duration : 0,
        muted: video.muted || video.volume === 0,
      });
    const events = [
      'play',
      'pause',
      'ended',
      'timeupdate',
      'loadedmetadata',
      'durationchange',
      'volumechange',
      'emptied',
    ];
    events.forEach((event) => video.addEventListener(event, sync));
    sync();
    return () => events.forEach((event) => video.removeEventListener(event, sync));
  }, [videoRef]);
  const playLabel = media.paused ? labels.play : labels.pause;
  const muteLabel = media.muted
    ? lang === 'ar'
      ? 'تشغيل الصوت'
      : 'Unmute'
    : lang === 'ar'
      ? 'كتم الصوت'
      : 'Mute';
  const fullscreenLabel = fullscreen ? labels.exitFullscreen : labels.fullscreen;
  return (
    <div className="learning-player-controls" dir="ltr" data-testid="player-controls">
      <div className="learning-player-controls__row">
        <button
          type="button"
          data-testid="player-toggle-playback"
          aria-label={playLabel}
          title={playLabel}
          disabled={disabled}
          onClick={onTogglePlayback}
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
            {media.paused ? <path d="m7 4 14 8-14 8z" /> : <path d="M6 4h4v16H6zm8 0h4v16h-4z" />}
          </svg>
        </button>
        <span className="learning-player-controls__time">
          {clock(media.time)} / {clock(media.duration)}
        </span>
        <div className="learning-player-controls__spacer" />
        <button
          type="button"
          aria-label={muteLabel}
          title={muteLabel}
          onClick={() => {
            const video = videoRef.current;
            if (!video) return;
            if (video.volume === 0) video.volume = 1;
            video.muted = !media.muted;
          }}
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            width="22"
            height="22"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M11 5 6 9H3v6h3l5 4z" />
            <path
              d={media.muted ? 'm16 9 6 6m0-6-6 6' : 'M15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14'}
            />
          </svg>
        </button>
        <button
          type="button"
          data-testid="player-fullscreen"
          aria-label={fullscreenLabel}
          title={fullscreenLabel}
          aria-pressed={fullscreen}
          onClick={onToggleFullscreen}
        >
          <svg
            aria-hidden="true"
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path
              d={
                fullscreen
                  ? 'M9 3v6H3m18 0h-6V3M3 15h6v6m6 0v-6h6'
                  : 'M9 3H3v6m12-6h6v6M3 15v6h6m6 0h6v-6'
              }
            />
          </svg>
        </button>
      </div>
      <input
        type="range"
        data-testid="player-seek"
        aria-label={lang === 'ar' ? 'موضع التشغيل' : 'Playback position'}
        aria-valuetext={clock(media.time) + ' / ' + clock(media.duration)}
        min="0"
        max={media.duration || 0}
        step="0.1"
        value={Math.min(media.time, media.duration)}
        disabled={disabled || media.duration <= 0}
        onChange={(event) => {
          const video = videoRef.current;
          if (video) {
          const time = Number(event.currentTarget.value);
          video.currentTime = time;
          setMedia(current => ({ ...current, time }));
        }
        }}
      />
    </div>
  );
}
