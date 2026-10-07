import { useEffect, useRef, useState, type RefObject } from 'react';
import { useLang } from '../../../i18n';
import type { PlayerLabels } from './PlayerChrome';
import { PLAYBACK_SPEEDS, type VideoQualityOption } from './playbackOptions';

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
  qualities,
  quality,
  onQualityChange,
}: {
  videoRef: RefObject<HTMLVideoElement>;
  labels: PlayerLabels;
  disabled: boolean;
  fullscreen: boolean;
  onTogglePlayback: () => void;
  onToggleFullscreen: () => void;
  qualities: VideoQualityOption[];
  quality: string;
  onQualityChange: (value: string) => void;
}) {
  const { lang } = useLang();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsPage, setSettingsPage] = useState<'main' | 'speed' | 'quality'>('main');
  const settingsRef = useRef<HTMLDivElement>(null);
  const settingsButtonRef = useRef<HTMLButtonElement>(null);
  useEffect(() => { if (disabled) setSettingsOpen(false); }, [disabled]);
  useEffect(() => {
    if (!settingsOpen) return;
    const panel = settingsRef.current;
    (panel?.querySelector<HTMLButtonElement>('[aria-pressed="true"]') ?? panel?.querySelector<HTMLButtonElement>('button:not(:disabled)'))?.focus();
    const dismiss = (event: PointerEvent) => {
      if (!settingsRef.current?.contains(event.target as Node) && !settingsButtonRef.current?.contains(event.target as Node)) setSettingsOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setSettingsOpen(false); settingsButtonRef.current?.focus(); }
    };
    document.addEventListener('pointerdown', dismiss);
    document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', dismiss); document.removeEventListener('keydown', escape); };
  }, [settingsOpen, settingsPage]);
  const [media, setMedia] = useState({ paused: true, time: 0, duration: 0, muted: false, volume: 1, rate: 1 });
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const sync = () =>
      setMedia({
        paused: video.paused,
        time: Number.isFinite(video.currentTime) ? video.currentTime : 0,
        duration: Number.isFinite(video.duration) ? video.duration : 0,
        muted: video.muted || video.volume === 0,
        volume: video.volume,
        rate: video.playbackRate,
      });
    const events = [
      'play',
      'pause',
      'ended',
      'timeupdate',
      'loadedmetadata',
      'durationchange',
      'volumechange',
      'ratechange',
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
        <button type="button" ref={settingsButtonRef} data-testid="player-settings" disabled={disabled}
          aria-label={lang === 'ar' ? 'إعدادات التشغيل' : 'Playback settings'} aria-expanded={settingsOpen}
          title={lang === 'ar' ? 'إعدادات التشغيل' : 'Playback settings'}
          onClick={() => { setSettingsPage('main'); setSettingsOpen(open => !open); }}>
          <svg aria-hidden="true" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 7h5m6 0h5M4 17h9m6 0h1" /><circle cx="12" cy="7" r="3" /><circle cx="16" cy="17" r="3" />
          </svg>
        </button>
        {settingsOpen && <div ref={settingsRef} className="learning-player-settings" data-testid="player-settings-panel" dir={lang === 'ar' ? 'rtl' : 'ltr'} role="group" aria-label={lang === 'ar' ? 'إعدادات التشغيل' : 'Playback settings'}
          onBlur={event => { const next = event.relatedTarget; if (next && !event.currentTarget.contains(next) && !settingsButtonRef.current?.contains(next)) setSettingsOpen(false); }}>
        {settingsPage === 'main' ? <>
          <button type="button" className="learning-player-settings__row" data-testid="player-speed" onClick={() => setSettingsPage('speed')}>
            <span>{lang === 'ar' ? 'السرعة' : 'Speed'}</span><span className="learning-player-settings__value" dir="ltr">{media.rate}x <span aria-hidden="true">›</span></span>
          </button>
          <button type="button" className="learning-player-settings__row" data-testid="player-quality" disabled={qualities.length === 0} onClick={() => setSettingsPage('quality')}>
            <span>{lang === 'ar' ? 'الجودة' : 'Quality'}</span><span className="learning-player-settings__value">{quality === 'auto' ? (lang === 'ar' ? 'تلقائي' : 'Auto') : qualities.find(option => `representation:${option.id}` === quality)?.label}<span aria-hidden="true"> ›</span></span>
          </button>
        </> : <>
          <button type="button" className="learning-player-settings__back" data-testid="player-settings-back" onClick={() => setSettingsPage('main')}>
            <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m14 6-6 6 6 6" /></svg>
            {settingsPage === 'speed' ? (lang === 'ar' ? 'السرعة' : 'Speed') : (lang === 'ar' ? 'الجودة' : 'Quality')}
          </button>
          <div className={`learning-player-settings__options learning-player-settings__options--${settingsPage}`}>
            {settingsPage === 'speed' ? PLAYBACK_SPEEDS.map(rate => <button key={rate} type="button" data-testid={`player-speed-${rate}`} aria-pressed={media.rate === rate}
              onClick={() => { const video = videoRef.current; if (video) video.playbackRate = rate; setSettingsPage('main'); }}><span dir="ltr">{rate}x</span></button>) :
              [{ id: 'auto', label: lang === 'ar' ? 'تلقائي' : 'Auto' }, ...qualities.map(option => ({ id: `representation:${option.id}`, label: option.label }))].map(option =>
                <button key={option.id} type="button" data-testid={`player-quality-${option.id}`} aria-pressed={quality === option.id}
                  onClick={() => { onQualityChange(option.id); setSettingsPage('main'); }}>{option.label}</button>)}
          </div>
        </>}
        </div>}
        <button
          type="button"
          data-testid="player-mute"
          aria-label={muteLabel}
          title={muteLabel}
          disabled={disabled}
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
        <label className="learning-player-controls__volume">
          <span className="sr-only">{lang === 'ar' ? 'مستوى الصوت' : 'Volume'}</span>
          <input type="range" data-testid="player-volume" min="0" max="1" step="0.05" value={media.muted ? 0 : media.volume}
            aria-valuetext={`${Math.round((media.muted ? 0 : media.volume) * 100)}%`} disabled={disabled}
            onChange={event => { const video = videoRef.current; if (!video) return; video.volume = Number(event.currentTarget.value); video.muted = video.volume === 0; }} />
        </label>
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
