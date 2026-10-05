/** Protected course learning page (M5): outline + player + expiry states. */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Container } from '../../../components/ui/Card';
import { useLang, useTranslate } from '../../../i18n';
import { useOutline, usePlayback } from '../hooks/useLearning';
import {
  ErrorBlock,
  LoadingBlock,
  RenewalRequired,
  formatDate,
} from '../components/Learning';
import { DashLessonPlayer } from '../player/Player';
import { clear as clearSession } from '../player/session';
import { LessonAssessments } from '../../assessments/LessonAssessments';
import { CoursePlan, useLearningLabels } from '../components/CoursePlan';
import { CaptionControls, ResourcesPanel } from '../materials/LessonMaterials';
import { useLessonMaterials } from '../materials/useLessonMaterials';
import { OwnSessionRecovery } from '../sessions/OwnSessionRecovery';
import { Button } from '../../../components/ui/Button';

export interface CourseLearningPageProps {
  courseSlug: string;
  onRenew: (courseSlug: string) => void;
  initialLessonId?: string | null;
  autoResume?: boolean;
}

export function CourseLearningPage({ courseSlug, onRenew, initialLessonId, autoResume = false }: CourseLearningPageProps): JSX.Element {
  const t = useTranslate();
  const { lang } = useLang();
  const { data, loading, errorCode, reload } = useOutline(courseSlug);
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(initialLessonId ?? null);
  // No outline reload on progress: a reload would put the page into its loading
  // state and unmount the player mid-lesson.
  const playback = usePlayback(courseSlug);
  const resumeRequested = useRef(false);

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

  const labels = useLearningLabels();

  // Default selection: the trusted "continue" target, never a guessed id.
  useEffect(() => {
    if (sections === null) return;
    const firstPlayable =
      sections.flatMap((s) => s.lessons).find((l) => l.playable && !l.completed && l.resumePositionSeconds > 0) ??
      sections.flatMap((s) => s.lessons).find((l) => l.playable && !l.completed) ??
      sections.flatMap((s) => s.lessons).find((l) => l.playable) ??
      null;
    setSelectedLessonId((current) =>
      sections.some((s) => s.lessons.some((l) => l.lessonId === current && l.playable))
        ? current
        : (firstPlayable?.lessonId ?? null),
    );
  }, [sections]);

  useEffect(() => {
    if (!autoResume || resumeRequested.current || !initialLessonId || loading || !sections) return;
    const lesson = sections.flatMap(section => section.lessons).find(lesson => lesson.lessonId === initialLessonId);
    if (!lesson?.playable) return;
    resumeRequested.current = true;
    setSelectedLessonId(lesson.lessonId);
    void playback.start(lesson.lessonId);
  }, [autoResume, initialLessonId, loading, sections, playback.start]);

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
   * Current-page exit closure only: the existing owner-checked end for THIS
   * page's own grant is sent best-effort with `keepalive:true` on pagehide
   * and unmount. Switching browser tabs/apps (visibility hidden) is NOT a
   * page exit and must not end playback; background/offline abandonment
   * remains a separate proposal, not an implemented policy. Local cleanup
   * never waits for the request, and the durable server reference guarantees
   * a retry. Closing/unloading cannot guarantee delivery.
   */
  const endRef = useRef(playback.end);
  useEffect(() => {
    endRef.current = playback.end;
  }, [playback.end]);
  useEffect(
    () => () => {
      void endRef.current({ keepalive: true });
    },
    [],
  );
  useEffect(() => {
    const onPageHide = () => {
      void endRef.current({ keepalive: true });
    };
    window.addEventListener('pagehide', onPageHide);
    return () => {
      window.removeEventListener('pagehide', onPageHide);
    };
  }, []);

  const selectLesson = useCallback(
    (lessonId: string) => {
      if (playback.requesting || (selectedLessonId === lessonId && playback.grant !== null)) return;
      setSelectedLessonId(lessonId);
      // start() closes the old session and requests the selected lesson.
      void playback.start(lessonId);
    },
    [playback, selectedLessonId],
  );

  // Lesson materials (captions/resources) for the currently selected lesson.
  // This hook is called unconditionally before every early return so the hook
  // order stays stable across loading/error/ready renders. It fetches only the
  // entitlement-checked materials payload and validates caption bytes; the
  // server re-checks access on every request.
  const accessLost =
    errorCode === 'LESSON_NOT_FOUND' ||
    errorCode === 'FORBIDDEN' ||
    playback.errorCode === 'LESSON_NOT_FOUND' ||
    playback.errorCode === 'SUBSCRIPTION_REQUIRED' ||
    playback.errorCode === 'FORBIDDEN' ||
    errorCode === 'SUBSCRIPTION_EXPIRED' ||
    errorCode === 'SUBSCRIPTION_REQUIRED' ||
    playback.errorCode === 'PLAYBACK_SESSION_EXPIRED' ||
    playback.errorCode === 'SUBSCRIPTION_EXPIRED';
  const preselectedLessonId =
    sections === null
      ? null
      : (sections
          .flatMap((section) => section.lessons)
          .find((lesson) => lesson.lessonId === selectedLessonId)?.lessonId ?? null);
  const lessonMaterials = useLessonMaterials(preselectedLessonId, accessLost);

  if (loading) {
    return (
      <Container id="main">
        <main className="py-8">
          <LoadingBlock label={t('learningLoading')} />
        </main>
      </Container>
    );
  }

  if (
    errorCode === 'SUBSCRIPTION_EXPIRED' ||
    errorCode === 'SUBSCRIPTION_REQUIRED' ||
    playback.errorCode === 'PLAYBACK_SESSION_EXPIRED' ||
    playback.errorCode === 'SUBSCRIPTION_EXPIRED'
  ) {
    return (
      <Container id="main">
        <main className="py-8">
          <h1 className="mb-4 text-3xl font-bold">{t('learningTitle')}</h1>
          <RenewalRequired
            message={
              errorCode === 'SUBSCRIPTION_EXPIRED'
                ? t('learningExpiredNotice')
                : t('learningRequiredNotice')
            }
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
  const lessons = (sections ?? data.sections).flatMap(section => section.lessons);
  const selectedIndex = lessons.findIndex(lesson => lesson.lessonId === selectedLessonId);
  const previousLesson = lessons[selectedIndex - 1];
  const nextLesson = lessons[selectedIndex + 1];

  return (
    <Container id="main">
      <main className="py-8">
        <a href="#/dashboard" className="mb-4 inline-flex min-h-[44px] items-center text-sm font-semibold text-muted underline">{lang === 'ar' ? 'العودة إلى كورساتي' : 'Back to my courses'}</a>
        <h1 className="mb-2 text-3xl font-bold">
          {lang === 'ar' ? course.titleAr : course.titleEn}
        </h1>
        <p className="mb-2 text-muted">
          {lang === 'ar' ? course.descriptionAr : course.descriptionEn}
        </p>
        {course.expiresAt !== null ? (
          <p data-testid="learning-expiry" className="mb-6 text-sm text-muted">
            {labels.expiresOn} {formatDate(course.expiresAt, lang)} (
            {lang === 'ar' ? 'القاهرة' : 'Cairo'})
          </p>
        ) : (
          <p data-testid="learning-expiry" className="mb-6 text-sm text-muted">
            {lang === 'ar'
              ? 'بدون انتهاء، حتى الحذف النهائي للكورس'
              : 'No expiry, until permanent course removal'}
          </p>
        )}

        {playback.progressError ? <div role="status" className="mb-4 rounded-card border border-border bg-surface p-4" data-testid="progress-save-error">
          <p>{lang === 'ar' ? 'تعذّر حفظ آخر تقدم. يمكنك متابعة المشاهدة وإعادة محاولة الحفظ.' : 'Your latest progress could not be saved. You can keep watching and retry saving.'}</p>
          <Button variant="secondary" onClick={playback.retryProgress}>{lang === 'ar' ? 'إعادة حفظ التقدم' : 'Retry saving progress'}</Button>
        </div> : null}

        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(300px,1fr)]">
          <div className="min-w-0">
            {selectedLesson !== null ? <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-card border border-border bg-surface p-4">
              <div className="min-w-0"><p className="text-xs font-semibold text-muted">{lang === 'ar' ? `الدرس ${selectedIndex + 1} من ${lessons.length}` : `Lesson ${selectedIndex + 1} of ${lessons.length}`}</p><h2 className="mt-1 break-words text-lg font-bold">{lang === 'ar' ? selectedLesson.titleAr : selectedLesson.titleEn}</h2></div>
              <button type="button" data-testid="course-plan-jump" onClick={() => {
                document.getElementById('course-plan')?.scrollIntoView({ behavior: 'auto', block: 'start' });
                document.querySelector<HTMLElement>('#course-plan summary')?.focus({ preventScroll: true });
              }} className="inline-flex min-h-[44px] items-center rounded-control border border-border px-3 text-sm font-semibold lg:hidden">{lang === 'ar' ? 'خطة الكورس' : 'Course plan'}</button>
            </div> : null}
            {playback.grant !== null && selectedLesson !== null ? (
              <DashLessonPlayer
                key={playback.grant.referenceId}
                grant={playback.grant}
                autoPlay={autoResume && selectedLessonId === initialLessonId}
                entitlementLost={entitlementLost}
                labels={playerLabels(t)}
                captionUrls={lessonMaterials.captionUrls}
                captionChoice={lessonMaterials.captionChoice}
                captionControls={
                  <CaptionControls
                    lang={lang}
                    choice={lessonMaterials.captionChoice}
                    onChoice={lessonMaterials.setCaptionChoice}
                    hasAr={(lessonMaterials.materials?.captions ?? []).some((c) => c.language === 'ar')}
                    hasEn={(lessonMaterials.materials?.captions ?? []).some((c) => c.language === 'en')}
                    loading={lessonMaterials.captionLoading}
                    errorCode={lessonMaterials.captionErrorCode}
                    onRetry={lessonMaterials.retryCaptions}
                  />
                }
                onRetry={() => void playback.start(selectedLesson.lessonId)}
                onProgress={(position, duration, completed, keepalive) =>
                  playback.reportProgress(selectedLesson.lessonId, position, duration, completed, keepalive)
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
                className="flex aspect-video w-full flex-col items-center justify-center gap-4 rounded-card border border-border learning-video-surface p-6 text-center text-white"
              >
                <span className="text-base font-semibold">{selectedLesson ? lang === 'ar' ? selectedLesson.titleAr : selectedLesson.titleEn : t('learningSelectLesson')}</span>
                {selectedLesson?.playable ? <Button data-testid="learning-start-playback" disabled={playback.requesting} onClick={() => void playback.start(selectedLesson.lessonId)}>{playback.requesting ? t('learningRequesting') : selectedLesson.resumePositionSeconds > 0 ? labels.resume : t('learningStartLesson')}</Button> : null}
              </div>
            )}
            {playback.errorCode !== null ? (
              <div className="mt-3">
                <ErrorBlock message={playback.errorCode === 'PLAYBACK_DEVICE_LIMIT'
                  ? (t('playerDeviceDetail') as string)
                  : playback.errorCode === 'PLAYBACK_DEVICE_REVOKED'
                    ? (t('playerRevokedDetail') as string)
                    : playback.errorCode === 'PLAYBACK_STREAM_LIMIT'
                      ? (t('playerStreamDetail') as string)
                      : playback.errorCode === 'PLAYBACK_SESSION_EXPIRED' || playback.errorCode === 'SUBSCRIPTION_EXPIRED'
                        ? (t('playerExpiredDetail') as string)
                        : playback.errorCode === 'DRM_DEPENDENCY_FAILED'
                          ? (t('playerNetworkDetail') as string)
                          : t('learningPlaybackError')} />
                {playback.errorCode === 'PLAYBACK_STREAM_LIMIT' && selectedLesson ? (
                  <OwnSessionRecovery
                    onRecovered={() => {
                      // Only offer starting again after confirmed closure.
                      void playback.start(selectedLesson.lessonId);
                    }}
                  />
                ) : null}
              </div>
            ) : null}
            {selectedLesson !== null ? <div className="mt-4 flex flex-wrap items-center justify-between gap-3" aria-label={lang === 'ar' ? 'التنقل بين الدروس' : 'Lesson navigation'}>
              <Button variant="secondary" data-testid="previous-lesson" disabled={!previousLesson?.playable || playback.requesting} disabledReason={playback.requesting ? undefined : !previousLesson ? { ar: "أنت في أول درس؛ لا يوجد درس سابق.", en: "You are at the first lesson; there is no previous lesson." } : previousLesson.locked ? { ar: "اجتز التقييمات المطلوبة لفتح هذا الدرس.", en: "Pass the required assessments to unlock this lesson." } : { ar: "فيديو هذا الدرس غير متاح حاليًا.", en: "This lessons video is currently unavailable." }} onClick={() => previousLesson && selectLesson(previousLesson.lessonId)}>{lang === 'ar' ? 'الدرس السابق' : 'Previous lesson'}</Button>
              <Button variant="secondary" data-testid="next-lesson" disabled={!nextLesson?.playable || playback.requesting} disabledReason={playback.requesting ? undefined : !nextLesson ? { ar: "أنت في آخر درس؛ لا يوجد درس تالٍ.", en: "You are at the last lesson; there is no next lesson." } : nextLesson.locked ? { ar: "اجتز التقييمات المطلوبة لفتح هذا الدرس.", en: "Pass the required assessments to unlock this lesson." } : { ar: "فيديو هذا الدرس غير متاح حاليًا.", en: "This lessons video is currently unavailable." }} onClick={() => nextLesson && selectLesson(nextLesson.lessonId)}>{lang === 'ar' ? 'الدرس التالي' : 'Next lesson'}</Button>
              {nextLesson?.locked ? <p className="w-full text-sm text-muted">{lang === 'ar' ? 'اجتز التقييمات المطلوبة أدناه قبل الانتقال للدرس التالي.' : 'Pass the required assessments below before moving to the next lesson.'}</p> : null}
            </div> : null}
            {selectedLesson !== null ? <LessonAssessments key={selectedLesson.lessonId} lessonId={selectedLesson.lessonId} /> : null}
            {selectedLesson !== null ? (
              <ResourcesPanel
                key={`resources-${preselectedLessonId}`}
                onAccessLost={lessonMaterials.clearAccess}
                lang={lang}
                loading={lessonMaterials.loading}
                errorCode={lessonMaterials.errorCode}
                resources={lessonMaterials.resources}
                onRetry={lessonMaterials.retry}
              />
            ) : null}
          </div>

          <div id="course-plan" className="course-plan-sidebar min-w-0 scroll-mt-24">
            <CoursePlan
              sections={sections ?? data.sections}
              selectedLessonId={selectedLessonId}
              onSelect={selectLesson}
              disabled={playback.requesting}
            />
          </div>
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
  needsGesture: string;
  unsupportedDetail: string;
  networkDetail: string;
  expiredDetail: string;
  deviceDetail: string;
  revokedDetail: string;
  streamDetail: string;
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
    needsGesture: t('playerNeedsGesture'),
    unsupportedDetail: t('playerUnsupportedDetail'),
    networkDetail: t('playerNetworkDetail'),
    expiredDetail: t('playerExpiredDetail'),
    deviceDetail: t('playerDeviceDetail'),
    revokedDetail: t('playerRevokedDetail'),
    streamDetail: t('playerStreamDetail'),
  };
}
