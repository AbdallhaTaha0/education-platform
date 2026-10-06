import {useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {LanguageProvider} from './src/i18n';
import {PlayerControls} from './src/features/learning/player/PlayerControls';
import {usePlayerFullscreen} from './src/features/learning/player/fullscreen';
import './src/styles.css';
const labels={loading:'Loading',ready:'Ready',playing:'Playing',paused:'Paused',ended:'Ended',error:'Error',expired:'Expired',play:'Play',pause:'Pause',resume:'Resume',retry:'Retry',playerLabel:'Synthetic player',unsupported:'Unsupported',fullscreen:'Fullscreen',exitFullscreen:'Exit fullscreen'};
function Probe(){const frame=useRef<HTMLDivElement>(null),video=useRef<HTMLVideoElement>(null);const {fullscreen,expanded,toggle}=usePlayerFullscreen(frame);const [disabled,setDisabled]=useState(false);return <LanguageProvider><button data-testid="disable" onClick={()=>setDisabled(true)}>Disable</button><div ref={frame} className={`learning-video-frame ${expanded?'learning-video-frame--expanded':''}`} style={{position:'relative',width:'min(100%, 720px)',height:400,background:'black'}}><video ref={video}/><span data-testid="retained-watermark">Synthetic watermark</span><PlayerControls videoRef={video} labels={labels} disabled={disabled} fullscreen={fullscreen} onTogglePlayback={()=>{const v=video.current!;Object.defineProperty(v,'paused',{value:!v.paused,configurable:true});v.dispatchEvent(new Event(v.paused?'pause':'play'));}} onToggleFullscreen={()=>void toggle()}/></div></LanguageProvider>}
createRoot(document.getElementById('root')!).render(<Probe/>);
