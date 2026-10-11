// Isolated presentation fixture: real components, synthetic catalog and media clock.
import { useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { LanguageProvider } from '/srv/client/src/i18n';
import { UnsavedChangesProvider } from '/srv/client/src/components/ui/UnsavedChanges';
import { CourseForm } from '/srv/client/src/features/catalog/pages/CourseForm';
import { PublicCatalogSections } from '/srv/client/src/features/catalog/pages/PublicCatalogPage';
import { PlayerControls } from '/srv/client/src/features/learning/player/PlayerControls';
import { FeedbackProvider, useSuccessFeedback } from '/srv/client/src/components/ui/ErrorFeedback';
import { Notice } from '/srv/client/src/components/ui/Notice';

const fixture = window as any;
const mode = new URLSearchParams(location.search).get('mode');
const initial = mode?.startsWith('edit') ? { slug: 'existing-course', titleAr: 'دورة', titleEn: 'Course', descriptionAr: 'وصف', descriptionEn: 'Description', coverPath: mode === 'edit-existing' ? '/catalog/courses/synthetic-course/cover' : null } : undefined;
function Review() {
  const [feedback, setFeedback] = useState(false);
  const showSuccess = useSuccessFeedback();
  const videoRef = useRef<HTMLVideoElement>(null);
  const labels = { play: 'Play', pause: 'Pause', fullscreen: 'Fullscreen', exitFullscreen: 'Exit fullscreen' } as any;
  return <main>
    <button id="show-feedback" onClick={() => setFeedback(true)}>Show action feedback</button>
    <button id="hide-feedback" onClick={() => setFeedback(false)}>Hide action feedback</button>
    <button id="repeat-success" onClick={() => showSuccess('Action completed successfully.')}>Repeat success</button>
    {feedback ? <><Notice kind="success">Saved successfully.</Notice><Notice kind="error">Synthetic error.</Notice><Notice kind="success" inline>Persistent course status.</Notice></> : null}
    <div className="learning-video-frame relative" style={{ margin: '16px auto', width: 'min(100% - 24px, 900px)', height: 260, containerType: 'inline-size' }}>
      <video ref={video => {
        if (!video || videoRef.current === video) return;
        (videoRef as any).current = video;
        let time = 15;
        Object.defineProperty(video, 'duration', { configurable: true, get: () => 35 });
        Object.defineProperty(video, 'currentTime', { configurable: true, get: () => time, set: value => { time = value; video.dispatchEvent(new Event('timeupdate')); } });
      }} />
      <PlayerControls videoRef={videoRef} labels={labels} disabled={false} fullscreen={false} onTogglePlayback={() => {}} onToggleFullscreen={() => {}} qualities={[]} quality="auto" onQualityChange={() => {}} />
    </div>
    <PublicCatalogSections compact onSelect={() => {}} />
    <CourseForm initial={initial} busy={false} onSubmit={async values => { fixture.__submitted = values; return true; }} />
  </main>;
}
const lang = new URLSearchParams(location.search).get('lang') === 'ar' ? 'ar' : 'en';
createRoot(document.getElementById('root')!).render(<LanguageProvider initialLang={lang}><FeedbackProvider><UnsavedChangesProvider><Review /></UnsavedChangesProvider></FeedbackProvider></LanguageProvider>);
