/** Student learning dashboard (M5). Active and expired subscriptions. */
import { useMemo } from 'react';
import { Container } from '../../../components/ui/Card';
import { FormActions } from '../../../components/ui/FormActions';
import { PaginatedCollection } from '../../../components/ui/Pagination';
import { useDashboard } from '../hooks/useLearning';
import {
  ErrorBlock,
  LoadingBlock,
  SectionHeading,
  SignInRequired,
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
  const signInLost = [
    'TOKEN_MISSING',
    'TOKEN_INVALID',
    'SESSION_EXPIRED',
    'SESSION_REVOKED',
  ].includes(errorCode ?? '');

  return (
    <Container id="main">
      <main className="py-6 text-start md:py-8">
        <p className="text-xs font-extrabold text-primary-strong">
          {lang === 'ar' ? 'مساحة التعلّم' : 'Learning workspace'}
        </p>
        <h1 className="mt-1 page-title text-ink">{t('learningDashboardTitle')}</h1>
        <p className="mb-7 mt-1.5 text-sm text-muted sm:text-base">
          {t('learningDashboardSubtitle')}
        </p>

        {loading ? <LoadingBlock label={t('learningLoading')} /> : null}
        {!loading && errorCode !== null ? (
          signInLost ? (
            <SignInRequired lang={lang} />
          ) : (
            <ErrorBlock message={errorMessage} retryLabel={t('retry')} onRetry={reload} />
          )
        ) : null}

        {!loading && errorCode === null && data !== null ? (
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
                <PaginatedCollection
                  as="ul"
                  id="active-courses"
                  className="grid gap-4 md:grid-cols-2"
                >
                  {data.active.map((item) => (
                    <SubscriptionCard
                      key={item.courseId}
                      item={item}
                      labels={labels}
                      lang={lang}
                      onContinue={onContinue}
                    />
                  ))}
                </PaginatedCollection>
              )}
            </section>

            {data.expired.length > 0 ? (
              <section aria-labelledby="expired-heading">
                <SectionHeading>
                  <span id="expired-heading">{t('learningExpiredHeading')}</span>
                </SectionHeading>
                <PaginatedCollection
                  as="ul"
                  id="expired-courses"
                  className="grid gap-4 md:grid-cols-2"
                >
                  {data.expired.map((item) => (
                    <SubscriptionCard
                      key={item.courseId}
                      item={item}
                      labels={labels}
                      lang={lang}
                      onRenew={onRenew}
                    />
                  ))}
                </PaginatedCollection>
              </section>
            ) : null}

            {data.active.length === 0 && data.expired.length === 0 ? (
              <div
                data-testid="learning-empty"
                className="rounded-2xl border border-border bg-surface p-6 text-start shadow-rest"
              >
                <p className="text-muted">{labels.noSubscription}</p>
                <FormActions>
                  <button
                    type="button"
                    className="min-h-[44px] rounded-xl bg-primary px-5 py-2.5 font-extrabold text-primary-ink shadow-rest transition-colors hover:bg-primary-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus"
                    onClick={onBrowse}
                  >
                    {labels.browseCourses}
                  </button>
                </FormActions>
              </div>
            ) : null}
          </div>
        ) : null}
      </main>
    </Container>
  );
}
