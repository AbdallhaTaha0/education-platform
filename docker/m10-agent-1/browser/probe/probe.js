/**
 * M10 browser probe scenario (agent 1, test-only, real Chromium).
 *
 * Drives the REAL compiled viewTracking.js + viewSessionManager.js modules
 * (same files as the player integration) against the REAL platform API with
 * genuine browser cookies, CSRF, performance.now() and a REAL playing
 * <video> element (canvas-captured stream). Exposes window.__phase(name, args)
 * for the puppeteer driver. Every phase returns JSON-serializable evidence.
 */
import { VIEW_THRESHOLD_MS } from './viewTracking.js';
import { ViewSessionManager } from './viewSessionManager.js';

const logEl = document.getElementById('log');
function log(line) {
  logEl.textContent += `${line}\n`;
}

function csrfCookie() {
  const m = document.cookie.match(/(?:^|;\s*)edu_csrf=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : '';
}

async function api(path, { method = 'GET', body } = {}) {
  const headers = { Accept: 'application/json' };
  let init = { method, credentials: 'include', headers };
  if (body !== undefined || method === 'POST') {
    headers['Content-Type'] = 'application/json';
    const token = csrfCookie();
    if (token) headers['X-Csrf-Token'] = token;
    if (body !== undefined) init = { ...init, body: JSON.stringify(body) };
    else init = { ...init, body: '{}' };
  }
  const res = await fetch(`/api${path}`, init);
  const text = await res.text();
  let payload = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch { payload = null; }
  if (!res.ok) {
    const err = new Error(`HTTP ${res.status}`);
    err.status = res.status;
    err.code = payload?.error?.code ?? 'UNKNOWN';
    throw err;
  }
  return payload?.data ?? payload;
}

async function login(identifier, password) {
  await fetch('/api/auth/csrf', { credentials: 'include' });
  return api('/auth/login', { method: 'POST', body: { identifier, password } });
}

function transport() {
  return {
    start: async (courseRef, lessonId, referenceId) => {
      if (window.__failNextStart === true) {
        window.__failNextStart = false;
        throw new TypeError('injected transient start failure');
      }
      const body = await api(
        `/learning/courses/${encodeURIComponent(courseRef)}/lessons/${encodeURIComponent(lessonId)}/views/start`,
        { method: 'POST', body: { playbackReferenceId: referenceId } },
      );
      return { viewSessionId: body.view.viewSessionId };
    },
    heartbeat: async (viewSessionId, playedMs, options) => {
      const body = await api(`/learning/views/${encodeURIComponent(viewSessionId)}/heartbeat`, {
        method: 'POST',
        body: { playedMilliseconds: playedMs },
      });
      void options;
      return { playedMilliseconds: body.view.playedMilliseconds, counted: body.view.counted };
    },
  };
}

const canvas = document.getElementById('src');
const video = document.getElementById('vid');
const ctx = canvas.getContext('2d');
let drawTimer = null;
let waitingFlag = false;
video.addEventListener('waiting', () => { waitingFlag = true; });
video.addEventListener('playing', () => { waitingFlag = false; });

function startCanvasStream() {
  let frame = 0;
  if (drawTimer !== null) clearInterval(drawTimer);
  drawTimer = setInterval(() => {
    frame += 1;
    ctx.fillStyle = frame % 2 === 0 ? '#0F1F12' : '#C9F24D';
    ctx.fillRect(0, 0, 160, 90);
    ctx.fillStyle = '#F8F7EE';
    ctx.fillText(String(frame), 8, 16);
  }, 100);
  const stream = canvas.captureStream(10);
  video.srcObject = stream;
}

const managerOf = () => window.__manager ?? null;

const phases = {
  async setup({ adminEmail, adminPassword, studentEmail, studentPassword, lessonId }) {
    window.__seed = { adminEmail, adminPassword, studentEmail, studentPassword, lessonId };
    // Admin: media lifecycle through the real API (fixture-backed).
    await login(adminEmail, adminPassword);
    const reg = await api(`/admin/catalog/lessons/${lessonId}/media`, {
      method: 'POST',
      body: { contentType: 'video/mp4', securityTier: 'STANDARD' },
    });
    await api(`/admin/catalog/lessons/${lessonId}/media/complete`, { method: 'POST' });
    let ready = false;
    for (let i = 0; i < 10 && !ready; i += 1) {
      const sync = await api(`/admin/catalog/lessons/${lessonId}/media/sync`, { method: 'POST' });
      ready = JSON.stringify(sync).includes('READY');
      if (!ready) await new Promise((r) => setTimeout(r, 1000));
    }
    // Course DRAFT -> PROCESSING -> READY -> PUBLISHED via real transitions.
    const courseId = window.__courseId;
    for (const to of ['PROCESSING', 'READY', 'PUBLISHED']) {
      await api(`/admin/catalog/courses/${courseId}/transitions`, { method: 'POST', body: { to } });
    }
    await login(studentEmail, studentPassword);
    return { mediaReady: ready, regStatus: reg?.media?.status ?? reg?.status ?? 'unknown' };
  },

  async session({ courseSlug, lessonId, deviceId }) {
    if (!managerOf()) {
      const t = transport();
      window.__manager = new ViewSessionManager(t.start, t.heartbeat);
    }
    const grant = await api(
      `/learning/courses/${encodeURIComponent(courseSlug)}/lessons/${encodeURIComponent(lessonId)}/playback`,
      { method: 'POST', body: { deviceId } },
    );
    const referenceId = grant.playback.referenceId;
    window.__manager.attach(window.__courseSlug, lessonId, referenceId);
    window.__referenceId = referenceId;
    startCanvasStream();
    try {
      await video.play();
    } catch (e) {
      return { playRejected: String(e?.name ?? e), referenceId };
    }
    if (window.__observeTimer) clearInterval(window.__observeTimer);
    window.__observeTimer = setInterval(() => {
      window.__manager?.observe({
        paused: video.paused,
        seeking: video.seeking,
        ended: video.ended,
        waiting: waitingFlag || video.readyState < 2,
        nowMs: performance.now(),
      });
    }, 250);
    if (window.__beatTimer) clearInterval(window.__beatTimer);
    window.__beatTimer = setInterval(() => {
      if (!video.paused && !video.ended) void window.__manager?.heartbeatNow({});
    }, 5000);
    return { referenceId, playing: !video.paused, readyState: video.readyState };
  },

  async setRate({ rate }) {
    video.playbackRate = rate;
    return { requested: rate, effective: video.playbackRate };
  },

  async heartbeatNow() {
    const before = window.__manager?.playedMs ?? 0;
    await window.__manager?.heartbeatNow({ force: true });
    // Read back the server truth with a zero-delta heartbeat echo.
    return { clientPlayedMs: before };
  },

  async serverView() {
    // Cheap server truth: heartbeat with the current total echoes stored state.
    const total = window.__manager?.playedMs ?? 0;
    const t = transport().heartbeat;
    const id = window.__manager?.viewSessionId;
    if (!id) return { attached: false };
    const body = await api(`/learning/views/${encodeURIComponent(id)}/heartbeat`, {
      method: 'POST',
      body: { playedMilliseconds: Math.round(total) },
    });
    return {
      attached: true,
      playedMilliseconds: body.view.playedMilliseconds,
      counted: body.view.counted,
      countedAt: body.view.countedAt,
      newlyCounted: body.newlyCounted,
    };
  },

  async pauseVideo() {
    video.pause();
    return { paused: video.paused };
  },

  async playVideo() {
    await video.play();
    return { paused: video.paused };
  },

  async managerState() {
    return {
      ...(window.__manager?.snapshot() ?? { status: 'none' }),
      videoPaused: video.paused,
      videoRate: video.playbackRate,
      thresholdMs: VIEW_THRESHOLD_MS,
    };
  },

  async endPlayback() {
    const out = await api(`/learning/playback/${window.__referenceId}/end`, { method: 'POST' });
    return out;
  },

  async storageAudit() {
    return {
      localStorageEntries: window.localStorage.length,
      sessionStorageEntries: window.sessionStorage.length,
      cookies: document.cookie.split(';').map((c) => c.trim().split('=')[0]),
    };
  },
};

window.__runPhase = async (name, args = {}) => {
  try {
    const result = await phases[name](args);
    log(`${name}: ${JSON.stringify(result)}`);
    return { ok: true, result };
  } catch (error) {
    const detail = { message: String(error?.message ?? error), status: error?.status, code: error?.code };
    log(`${name} FAILED: ${JSON.stringify(detail)}`);
    return { ok: false, error: detail };
  }
};

window.__ready = true;
