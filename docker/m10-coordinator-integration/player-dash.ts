// TEST ONLY: native playing video source, no external DRM security claim.
export const MediaPlayer = Object.assign(() => ({ create: () => {
  let timer: ReturnType<typeof setInterval> | undefined;
  let video: HTMLVideoElement | undefined;
  const callbacks = new Map<string, () => void>();
  return {
    setProtectionData() {}, updateSettings() {}, addRequestInterceptor() {}, removeRequestInterceptor() {},
    on(event: string, callback: () => void) { callbacks.set(event, callback); },
    initialize(element: HTMLVideoElement) {
      video = element;
      const canvas = document.createElement('canvas'); canvas.width = 160; canvas.height = 90;
      const ctx = canvas.getContext('2d')!;
      let frame = 0;
      timer = setInterval(() => { ctx.fillStyle = frame++ % 2 ? '#C9F24D' : '#0F1F12'; ctx.fillRect(0, 0, 160, 90); }, 100);
      video.srcObject = canvas.captureStream(10);
      callbacks.get('init')?.();
      void video.play();
    },
    reset() { clearInterval(timer); video?.pause(); if (video) video.srcObject = null; },
    destroy() { clearInterval(timer); },
  };
} }), { events: { STREAM_INITIALIZED: 'init', QUALITY_CHANGE_RENDERED: 'quality', PLAYBACK_ERROR: 'play-error', ERROR: 'error' } });
