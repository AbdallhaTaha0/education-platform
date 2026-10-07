import React from 'react';
import { createRoot } from 'react-dom/client';
import { DashLessonPlayer } from '/srv/client/src/features/learning/player/Player';
const fixture=window as any;
const root=createRoot(document.getElementById('root')!);
const labels=Object.fromEntries(['loading','ready','playing','paused','ended','error','expired','play','pause','resume','retry','playerLabel','unsupported','fullscreen','exitFullscreen'].map(key=>[key,key])) as any;
const grant={referenceId:'synthetic-reference',playbackSessionId:'synthetic-session',playbackToken:'synthetic-test-only',
  tokenExpiresAt:new Date(Date.now()+3600000).toISOString(),sessionExpiresAt:new Date(Date.now()+3600000).toISOString(),
  manifestUrl:'https://fixture.invalid/manifest',licenseUrl:'https://fixture.invalid/license',drmProvider:'WIDEVINE',resumePositionSeconds:0,
  watermark:{type:'VISIBLE',maskedIdentity:'synthetic***',positions:[{x:20,y:20},{x:80,y:80}],expiresAt:null}} as any;
fixture.__mount=(expired=false,referenceId='synthetic-reference')=>root.render(<main style={{maxWidth:1000,margin:'24px auto',padding:'0 12px'}}><DashLessonPlayer grant={{...grant,referenceId,manifestUrl:`https://fixture.invalid/${referenceId}`}} labels={labels} entitlementLost={expired}/></main>);
fixture.__mount();
