// TEST ONLY: DASH setup fixture. Tests real React Player event wiring, not DRM.
export const MediaPlayer = Object.assign(() => ({ create: () => ({
  setProtectionData() {}, updateSettings() {}, addRequestInterceptor() {},
  removeRequestInterceptor() {}, on() {}, initialize() {}, reset() {}, destroy() {},
}) }), { events: { STREAM_INITIALIZED: 'init', QUALITY_CHANGE_RENDERED: 'quality', PLAYBACK_ERROR: 'play-error', ERROR: 'error' } });
