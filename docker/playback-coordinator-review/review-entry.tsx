// Standalone disposable UI fixture. No real auth, DRM, course or playback request.
import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { LanguageProvider } from './src/i18n';
import { learningApi } from './src/features/learning/api/client';
import { OwnSessionRecovery } from './src/features/learning/sessions/OwnSessionRecovery';
import './src/styles.css';

const now=new Date().toISOString();
learningApi.listOwnSessions=async()=>({sessions:[{referenceId:'00000000-0000-4000-8000-000000000001',courseSlug:'synthetic',courseTitleAr:'كورس تجريبي',courseTitleEn:'Synthetic course',lessonId:'00000000-0000-4000-8000-000000000002',lessonTitleAr:'جلسة تجريبية',lessonTitleEn:'Synthetic session',status:'ACTIVE',terminationStatus:null,pendingEndReason:null,createdAt:now,tokenExpiresAt:now,sessionExpiresAt:now,endedAt:null}]});
learningApi.endPlayback=async()=>({ended:true,closure:'NOOP'});
function Probe(): JSX.Element {
  const [recoveries,setRecoveries]=useState(0);
  return <LanguageProvider><main className="p-6"><h1>Coordinator NOOP reproduction</h1><OwnSessionRecovery onRecovered={()=>setRecoveries(n=>n+1)}/><output data-testid="recovered">{recoveries}</output></main></LanguageProvider>;
}
createRoot(document.getElementById('root')!).render(<Probe/>);
