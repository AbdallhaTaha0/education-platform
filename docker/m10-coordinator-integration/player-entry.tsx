import { createRoot } from 'react-dom/client';
import { DashLessonPlayer } from '/srv/client/src/features/learning/player/Player';
import type { PlaybackGrant } from '/srv/client/src/features/learning/types/models';
const root = createRoot(document.getElementById('player-root')!);
const labels = Object.fromEntries(['loading','ready','playing','paused','ended','error','expired','play','pause','resume','retry','playerLabel','unsupported','fullscreen','exitFullscreen'].map(k => [k, k])) as any;
(window as any).__mountIntegrationPlayer = (grant: PlaybackGrant, courseRef: string, lessonId: string) => root.render(<DashLessonPlayer grant={grant} labels={labels} courseRef={courseRef} lessonId={lessonId} />);
(window as any).__unmountIntegrationPlayer = () => root.unmount();
