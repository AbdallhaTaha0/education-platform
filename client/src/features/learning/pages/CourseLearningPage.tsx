/** Protected course learning page (M5): outline + player + expiry states. */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Container } from '../../../components/ui/Card';
import { useLang, useTranslate } from '../../../i18n';
import { useOutline, usePlayback } from '../hooks/useLearning';
import {
  CourseOutline,
  ErrorBlock,
  LearningLabels,
  LoadingBlock,
  RenewalRequired,
  formatDate,
} from '../components/Learning';
import { DashLessonPlayer } from '../player/Player';
import { clear as clearSession } from '../player/session';

export interface CourseLearningPageProps {
  courseSlug: string;
  onRenew: (courseSlug: string) => void;
}

export function CourseLearningPage({ courseSlug, onRenew }: CourseLearningPageProps): JSX.Element {
  const t = useTranslate();
  const { lang } = useLang();
  const { data, loading, errorCode, reload } = useOutline(courseSlug);
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null);
  // No outline reload on progress: a reload would put the page into its loading
  // state and unmount the player mid-lesson.
  const playback = usePlayback(courseSlug);

  // Progress written during this visit is merged over the fetched outline, so
  // the row ticks over without a refetch.
  const sections = useMemo(() => {
    if (data === null) return null;
    const live = playback.progress;
    if (Object.keys(live).length === 0) return data.sections;
    return data.sections.map((section) => ({
      ...section,
      lessons: section.lessons.map((lesson) => {
        const saved = live[lesson.lessonId];
        if (saved === undefined) return lesson;
        return {
          ...lesson,
          completed: saved.completed,
          resumePositionSeconds: saved.completed ? 0 : saved.positionSeconds,
        };
      }),
    }));
  }, [data, playback.progress]);

  const labels = useMemo<LearningLabels>(
    () => ({
      active: t('learningActive'),
      expired: t('learningExpired'),
      continueLearning: t('learningContinue'),
      renew: t('learningRenew'),
      expiresOn: t('learningExpiresOn'),
      progress: t('learningProgress'),
      completed: t('learningCompleted'),
      notStarted: t('learningNotStarted'),
      resume: t('learningResume'),
      lessonCount: t('learningLessonCount'),
      emptyActive: t('learningEmptyActive'),
      emptyExpired: t('learningEmptyExpired'),
      noSubscription: t('learningNoSubscription'),
      browseCourses: t('learningBrowse'),
    }),
    [t],
  );

  // Default selection: the trusted "continue" target, never a guessed id.
  useEffect(() => {
    if (sections === null) return;
    const firstPlayable =
      sections.flatMap((s) => s.lessons).find((l) => l.playable && !l.completed) ??
      sections.flatMap((s) => s.lessons).find((l) => l.playable) ??
      null;
    setSelectedLessonId((current) => sections.some(s => s.lessons.some(l => l.lessonId === current && l.playable))
      ? current : firstPlayable?.lessonId ?? null);
  }, [sections]);

  // Losing entitlement must tear the player down and drop the credential. The
  // release callback is held in a ref so this cleanup runs on unmount only:
  // depending on the controller object directly would re-run it on every state
  // change and immediately discard a freshly issued grant.
  const releaseRef = useRef(playback.release);
  useEffect(() => {
    releaseRef.current = playback.release;
  }, [playback.release]);
  useEffect(
    () => () => {
      releaseRef.current();
      clearSession();
    },
    [],
  );

  /**
   * Normal navigation away (hash change or unmount) performs a best-effort
   * keepalive end so the external session does not outlive the page. Local
   * cleanup never waits for it, and the durable reference guarantees a retry.
   */
  const endRef = useRef(playback.end);
  useEffect(() => {
    endRef.current = playback.end;
  }, [playback.end]);
  useEffect(
    () => () => {
      void endRef.current();
    },
    [],
  );

  const selectLesson = useCallback(
    (lessonId: string) => {
      setSelectedLessonId(lessonId);
      // The previous session is closed as part of switching lessons.
      playback.release();
    },
    [playback],
  );

  if (loading) {
    return (
      <Container id="main">
        <main className="py-8">
          <LoadingBlock label={t('learningLoading')} />
        </main>
      </Container>
    );
  }

  if (errorCode === 'SUBSCRIPTION_EXPIRED' || errorCode === 'SUBSCRIPTION_REQUIRED' ||
      playback.errorCode === 'PLAYBACK_SESSION_EXPIRED' || playback.errorCode === 'SUBSCRIPTION_EXPIRED') {
    return (
      <Container id="main">
        <main className="py-8">
          <h1 className="mb-4 text-3xl font-bold">{t('learningTitle')}</h1>
          <RenewalRequired
            message={errorCode === 'SUBSCRIPTION_EXPIRED' ? t('learningExpiredNotice') : t('learningRequiredNotice')}
            actionLabel={t('learningRenew')}
            action={() => onRenew(courseSlug)}
          />
        </main>
      </Container>
    );
  }

  if (errorCode !== null || data === null) {
    return (
      <Container id="main">
        <main className="py-8">
          <h1 className="mb-4 text-3xl font-bold">{t('learningTitle')}</h1>
          <ErrorBlock message={t('learningLoadError')} retryLabel={t('retry')} onRetry={reload} />
        </main>
      </Container>
    );
  }

  const course = data.course;
  const selectedLesson =
    sections === null
      ? null
      : (sections
          .flatMap((section) => section.lessons)
          .find((lesson) => lesson.lessonId === selectedLessonId) ?? null);
  const entitlementLost = errorCode === 'SUBSCRIPTION_EXPIRED';

  return (
    <Container id="main">
      <main className="py-8">
        <h1 className="mb-2 text-3xl font-bold">{lang === 'ar' ? course.titleAr : course.titleEn}</h1>
        <p className="mb-2 text-muted">{lang === 'ar' ? course.descriptionAr : course.descriptionEn}</p>
        {course.expiresAt !== null ? (
          <p data-testid="learning-expiry" className="mb-6 text-sm text-muted">
            {labels.expiresOn} {formatDate(course.expiresAt, lang)} ({lang === 'ar' ? 'القاهرة' : 'Cairo'})
          </p>
        ) : <p data-testid="learning-expiry" className="mb-6 text-sm text-muted">{lang === 'ar' ? 'بدون انتهاء، حتى الحذف النهائي للكورس' : 'No expiry, until permanent course removal'}</p>}

        <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
          <div>
            {playback.grant !== null && selectedLesson !== null ? (
              <DashLessonPlayer
                grant={playback.grant}
                entitlementLost={entitlementLost}
                labels={playerLabels(t)}
                onRetry={() => void playback.start(selectedLesson.lessonId)}
                onProgress={(position, duration, completed) =>
                  playback.reportProgress(position, duration, completed)
                }
                onEnded={() => {
                  // Natural completion ends the external session.
                  playback.markSessionEnded(playback.grant?.referenceId ?? '');
                }}
                onExpire={() => {
                  // Token expiry or a failed renewal genuinely ends the session.
                  playback.end().catch(() => undefined);
                }}
                onError={() => {
                  // Deliberately NOT a release: the grant is kept so the player
                  // can keep showing its error state and the viewer can retry.
                  // The player already discards the transient credential itself.
                }}
              />
            ) : (
              <div
                data-testid="player-placeholder"
                className="flex aspect-video w-full items-center justify-center rounded-card border border-border learning-video-surface text-sm text-white"
              >
                {t('learningSelectLesson')}
              </div>
            )}
            {playback.errorCode !== null ? (
              <div className="mt-3">
                <ErrorBlock message={t('learningPlaybackError')} />
              </div>
            ) : null}
          </div>

          <nav aria-label={t('learningOutline')}>
            <h2 className="mb-3 text-lg font-bold">{t('learningOutline')}</h2>
            <CourseOutline
              sections={sections ?? data.sections}
              selectedLessonId={selectedLessonId}
              onSelect={selectLesson}
              labels={labels}
              lang={lang}
            />
            {selectedLesson !== null && playback.grant === null ? (
              <button
                type="button"
                data-testid="learning-start-playback"
                className="mt-4 min-h-[44px] w-full rounded-control bg-primary px-4 py-2 font-bold text-canvas focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus"
                disabled={!selectedLesson.playable || playback.requesting}
                onClick={() => void playback.start(selectedLesson.lessonId)}
              >
                {playback.requesting ? t('learningRequesting') : t('learningStartLesson')}
              </button>
            ) : null}
          </nav>
        </div>
      </main>
    </Container>
  );
}

type Translate = ReturnType<typeof useTranslate>;

function playerLabels(t: Translate): {
  loading: string;
  ready: string;
  playing: string;
  paused: string;
  ended: string;
  error: string;
  expired: string;
  play: string;
  pause: string;
  resume: string;
  retry: string;
  playerLabel: string;
  unsupported: string;
  fullscreen: string;
  exitFullscreen: string;
} {
  return {
    loading: t('playerLoading'),
    ready: t('playerReady'),
    playing: t('playerPlaying'),
    paused: t('playerPaused'),
    ended: t('playerEnded'),
    error: t('playerError'),
    expired: t('playerExpired'),
    play: t('playerPlay'),
    pause: t('playerPause'),
    resume: t('playerResume'),
    retry: t('retry'),
    playerLabel: t('playerLabel'),
    unsupported: t('playerUnsupported'),
    fullscreen: t('playerFullscreen'),
    exitFullscreen: t('playerExitFullscreen'),
  };
}
