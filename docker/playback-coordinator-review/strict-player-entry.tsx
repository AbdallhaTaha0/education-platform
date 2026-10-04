// Isolated actual-component probe. Fake grant; no auth or playable media.
import React, { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { LanguageProvider } from './src/i18n';
import { DashLessonPlayer } from './src/features/learning/player/Player';
import type { PlaybackGrant } from './src/features/learning/types/models';
import './src/styles.css';
const future=new Date(Date.now()+3600000).toISOString();
const initial:PlaybackGrant={referenceId:'strict-one',playbackSessionId:'mock-session',playbackToken:'mock-token',tokenExpiresAt:future,sessionExpiresAt:future,manifestUrl:'http://localhost:5173/mock-media/manifest.mpd',licenseUrl:'http://localhost:5173/mock-media/license',drmProvider:'CLEAR_KEY',watermark:{type:'MASKED',maskedIdentity:'synthetic***',positions:[{x:50,y:50}],expiresAt:future},resumePositionSeconds:0};
const labels={loading:'Loading',ready:'Ready',playing:'Playing',paused:'Paused',ended:'Ended',error:'Error',expired:'Expired',play:'Play',pause:'Pause',resume:'Resume',retry:'Retry',playerLabel:'Synthetic player',unsupported:'Unsupported',fullscreen:'Fullscreen',exitFullscreen:'Exit fullscreen',needsGesture:'Gesture required',unsupportedDetail:'Unsupported media'};
function Probe(){
  const [grant,setGrant]=useState(initial);
  const [errors,setErrors]=useState<string[]>([]);
  (window as unknown as {changeGrant:(id:string)=>void}).changeGrant=id=>setGrant(g=>({...g,referenceId:id}));
  return <LanguageProvider><StrictMode><DashLessonPlayer grant={grant} labels={labels} onError={code=>setErrors(es=>[...es,code])}/></StrictMode><output data-testid="player-errors">{JSON.stringify(errors)}</output></LanguageProvider>;
}
createRoot(document.getElementById('root')!).render(<Probe/>);
