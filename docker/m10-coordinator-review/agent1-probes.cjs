// Synthetic, network-disabled source probes. No application code is changed.
const fs = require('fs');
const vm = require('vm');
const ts = require('typescript');
function compile(path, imports, extras = {}) {
  const output = ts.transpileModule(fs.readFileSync(path, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText;
  const context = { exports: {}, require: (id) => imports[id], ...extras };
  vm.runInNewContext(output, context);
  return context.exports;
}
async function main() {
  const tracking = compile('/player/viewTracking.ts', {});
  let slots = [], position = 0, effects = [], timers = [], starts = 0;
  const React = {
    useRef(value) { const index = position++; return slots[index] ??= { current: value }; },
    useCallback(callback) { return callback; },
    useEffect(callback) { effects.push(callback); },
  };
  const hook = compile('/player/useViewTracking.ts', {
    react: React,
    './viewTracking': tracking,
    './viewApi': { viewApi: {
      startView: async () => { starts++; throw new Error('synthetic transient failure'); },
      heartbeat: async () => { throw new Error('should not heartbeat'); },
    } },
  }, {
    setInterval(callback) { timers.push(callback); return timers.length; },
    clearInterval() {},
    window: { addEventListener() {}, removeEventListener() {} },
  });
  const controller = hook.useViewTracking({ current: { paused: false, ended: false } },
    { referenceId: 'grant-a' }, 'course-a', 'lesson-a');
  effects.forEach(callback => callback());
  await new Promise(resolve => setImmediate(resolve));
  for (let step = 0; step <= 160; step++) {
    controller.observe({ currentTime: step / 4, paused: false, seeking: false, ended: false, waiting: false });
    timers.forEach(callback => callback());
  }
  await new Promise(resolve => setImmediate(resolve));
  console.log(JSON.stringify({ probe: 'start request fails once, same grant keeps playing',
    startRequests: starts, heartbeatTimers: timers.length, reportedPlayingMs: controller.playedMs,
    limitation: 'controlled hook callbacks, not a real React/browser journey' }));

  const service = compile('/server/tracking/service.ts', {
    'node:crypto': require('node:crypto'),
    '../errors.js': { LearningError: class extends Error {} },
    '../access/entitlement.js': { evaluateEntitlement: () => ({ allowed: true }) },
    './validation.js': { normalizePlayedMs: n => n, VIEW_THRESHOLD_MS: 30000 },
  });
  let reads = 0, release;
  const together = new Promise(resolve => { release = resolve; });
  let countedAt = null;
  const database = {
    m10VideoViewSession: { async findFirst() {
      const result = { id: 'view-a', studentId: 'student-a', courseId: 'course-a',
        lessonId: 'lesson-a', countedAt: null, playedMilliseconds: 0 };
      if (++reads === 2) release();
      await together;
      return result;
    } },
    subscription: { findMany: async () => [] },
    lesson: { findUnique: async () => ({ id: 'lesson-a', section: { courseId: 'course-a' } }) },
    m10ViewTrackingState: { upsert: async () => ({ id: 'global', startedAt: new Date(0) }) },
    async $queryRaw() {
      countedAt ??= new Date();
      return [{ id: 'view-a', countedAt, playedMilliseconds: 30000 }];
    },
    // No active playback-reference or current publication/media check is made.
  };
  const results = await Promise.all([1, 2].map(() => service.recordHeartbeat(database, {
    viewSessionId: 'view-a', studentId: 'student-a', playedMilliseconds: 30000, nowMs: Date.now(),
  })));
  console.log(JSON.stringify({ probe: 'concurrent threshold heartbeats share one counted row',
    newlyCountedResponses: results.map(result => result.newlyCounted),
    expectedNewlyCountedResponses: 'exactly one true',
    limitation: 'controlled database response ordering, not a PostgreSQL integration test' }));
}
main().catch(() => { console.error('synthetic probe failed'); process.exitCode = 1; });
