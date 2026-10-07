// TEST ONLY: protected DASH boundary replaced; actual React player remains real.
export const MediaPlayer = Object.assign(() => ({ create: () => {
  const callbacks = new Map<string, (() => void)[]>();
  let stream: MediaStream | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let draw: ReturnType<typeof setInterval> | undefined;
  let recorder: MediaRecorder | null = null;
  let retired = false;
  let objectUrl: string | null = null;
  return {
    setProtectionData() {}, addRequestInterceptor() {}, removeRequestInterceptor() {},
    updateSettings(settings: unknown) { ((window as any).__settings ??= []).push(settings); },
    getRepresentationsByType() { return [{id:'sd',height:360,bitrateInKbit:600},{id:'hd',height:720,bitrateInKbit:1600},{id:'full',height:1080,bitrateInKbit:3000}]; },
    setRepresentationForTypeById(type: string, id: string) {
      if ((window as any).__failQuality) throw new Error('Synthetic rendition failure');
      ((window as any).__qualityChanges ??= []).push({type,id});
      callbacks.get('quality')?.forEach(fn=>fn());
    },
    on(name: string, fn: () => void) { callbacks.set(name, [...(callbacks.get(name) ?? []),fn]); },
    initialize(video: HTMLVideoElement) {
      const canvas = document.createElement('canvas'); canvas.width=960;canvas.height=540;
      const context=canvas.getContext('2d')!;
      const paint=()=>{context.fillStyle='#172b42';context.fillRect(0,0,960,540);context.fillStyle='#c9f24d';context.font='32px sans-serif';context.fillText('FAYQ — synthetic player verification',60,180);};
      paint(); draw=setInterval(paint,100); stream=canvas.captureStream(10);
      // Record a short local WebM: MediaStream deliberately ignores rate changes,
      // whereas course playback uses recorded media. No fixture network needed.
      const chunks: Blob[]=[];recorder=new MediaRecorder(stream,{mimeType:'video/webm'});
      recorder.ondataavailable=event=>chunks.push(event.data);
      recorder.onstop=()=>{
        if(retired)return;
        objectUrl=URL.createObjectURL(new Blob(chunks,{type:'video/webm'}));
        video.addEventListener('loadedmetadata',()=>callbacks.get('init')?.forEach(fn=>fn()),{once:true});
        video.src=objectUrl;
      };
      recorder.start();timer=setTimeout(()=>recorder?.stop(),700);
      (window as any).__activate=()=>callbacks.get('activate')?.forEach(fn=>fn());
    },
    reset() { retired=true;clearTimeout(timer);clearInterval(draw);if(recorder?.state==='recording')recorder.stop();stream?.getTracks().forEach(track=>track.stop());if(objectUrl)URL.revokeObjectURL(objectUrl); },
    destroy() {},
  };
}}),{events:{STREAM_INITIALIZED:'init',STREAM_ACTIVATED:'activate',QUALITY_CHANGE_RENDERED:'quality',PLAYBACK_ERROR:'play-error',ERROR:'error'}});
