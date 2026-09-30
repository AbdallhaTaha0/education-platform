/** Student learning dashboard (M5). Active and expired subscriptions. */
import { useMemo } from 'react';
import { Container } from '../../../components/ui/Card';
import { useDashboard } from '../hooks/useLearning';
import {
  ErrorBlock,
  LoadingBlock,
  SectionHeading,
  SubscriptionCard,
} from '../components/Learning';
import { useLang, useTranslate } from '../../../i18n';
import type { LearningLabels } from '../components/Learning';

export interface DashboardPageProps {
  onContinue: (courseSlug: string) => void;
  onRenew: (courseSlug: string) => void;
  onBrowse: () => void;
}

export function DashboardPage({ onContinue, onRenew, onBrowse }: DashboardPageProps): JSX.Element {
  const { data, loading, errorCode, reload } = useDashboard();
  const t = useTranslate();
  const { lang } = useLang();

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

  const errorMessage = errorCode === null ? '' : t('learningLoadError');

  return (
    <Container id="main">
      <main className="py-8">
        <h1 className="mb-2 text-3xl font-bold">{t('learningDashboardTitle')}</h1>
        <p className="mb-8 text-muted">{t('learningDashboardSubtitle')}</p>

        {loading ? <LoadingBlock label={t('learningLoading')} /> : null}
        {!loading && errorCode !== null ? (
          <ErrorBlock message={errorMessage} retryLabel={t('retry')} onRetry={reload} />
        ) : null}

        {!loading && data !== null ? (
          <div className="space-y-8">
            <section aria-labelledby="active-heading">
              <SectionHeading>
                <span id="active-heading">{t('learningActiveHeading')}</span>
              </SectionHeading>
              {data.active.length === 0 ? (
                <p data-testid="learning-empty-active" className="text-muted">
                  {labels.emptyActive}
                </p>
              ) : (
                <ul className="grid gap-4 md:grid-cols-2">
                  {data.active.map((item) => (
                    <SubscriptionCard
                      key={item.courseId}
                      item={item}
                      labels={labels}
                      lang={lang}
                      onContinue={onContinue}
                    />
                  ))}
                </ul>
              )}
            </section>

            {data.expired.length > 0 ? (
              <section aria-labelledby="expired-heading">
                <SectionHeading>
                  <span id="expired-heading">{t('learningExpiredHeading')}</span>
                </SectionHeading>
                <ul className="grid gap-4 md:grid-cols-2">
                  {data.expired.map((item) => (
                    <SubscriptionCard
                      key={item.courseId}
                      item={item}
                      labels={labels}
                      lang={lang}
                      onRenew={onRenew}
                    />
                  ))}
                </ul>
              </section>
            ) : null}

            {data.active.length === 0 && data.expired.length === 0 ? (
              <div data-testid="learning-empty" className="rounded-card border border-border bg-surface p-6">
                <p className="text-muted">{labels.noSubscription}</p>
                <button
                  type="button"
                  className="mt-4 min-h-[44px] rounded-control bg-primary px-4 py-2 font-bold text-canvas focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus"
                  onClick={onBrowse}
                >
                  {labels.browseCourses}
                </button>
              </div>
            ) : null}
          </div>
        ) : null}
      </main>
    </Container>
  );
}
