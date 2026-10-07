import React from 'react';
import { createRoot } from 'react-dom/client';
import { DashLessonPlayer as Player } from '/srv/client/src/features/learning/player/Player';

const fixture = window as any;
fixture.__totals = [];
fixture.__ends = 0;
fixture.__clock = 0;
Object.defineProperty(performance, 'now', { value: () => fixture.__clock });
const root = createRoot(document.getElementById('root')!);
const grant = { referenceId: 'fixture-reference', playbackSessionId: 'fixture-session', playbackToken: 'synthetic',
  tokenExpiresAt: new Date(Date.now() + 3600000).toISOString(), sessionExpiresAt: new Date(Date.now() + 3600000).toISOString(),
  manifestUrl: 'https://fixture.invalid/manifest', licenseUrl: 'https://fixture.invalid/license', drmProvider: 'WIDEVINE', watermark: null, resumePositionSeconds: 0 };
const labels = Object.fromEntries(['loading','ready','playing','paused','ended','error','expired','play','pause','resume','retry','playerLabel','unsupported','fullscreen','exitFullscreen'].map(k => [k,k])) as any;
fixture.__mount = (referenceId: string) => root.render(<Player grant={{ ...grant, referenceId }} labels={labels} courseRef="fixture-course" lessonId="fixture-lesson" onEnded={() => fixture.__ends++} />);
fixture.__mount(grant.referenceId);
