import { AdminSummaryPage } from '../../academic/AdminSummaryPage';
import { useAuth } from '../../../auth';
import { useCodingIde } from '../../../features';
import { useLang } from '../../../i18n';
import { Container } from '../../../components/ui/Card';
import { Loading, Notice } from '../../../components/ui/Notice';
import { FormActions } from '../../../components/ui/FormActions';
import { Button } from '../../../components/ui/Button';
import { useDashboard } from '../../learning/hooks/useLearning';
import { formatEgp } from '../../catalog/types/models';
import { displayDeadline } from '../../academic/model';
import { ProgressBar } from '../../../components/ui/ProgressBar';

/**
 * Authenticated role-aware overview for #/account.
 * STUDENT reuses the existing learning dashboard payload (progress, expiry,
 * wallet availability). ADMIN reuses the existing catalog summary endpoint.
 * No protected fetch runs while authentication is unresolved; anonymous
 * access keeps the existing sign-in prompt.
 */
export function AccountOverview({ go }: { go: (hash: string) => void }): JSX.Element {
  const { status, user, lastAuthCode } = useAuth();
  const { t, lang } = useLang();
  const ar = lang === 'ar';

  if (status === 'loading') {
    return (
      <main id="main">
        <section className="py-10">
          <Container>
            <p className="text-muted">{t.authChecking}</p>
          </Container>
        </section>
      </main>
    );
  }

  if (status === 'anonymous' || !user) {
    return (
      <main id="main">
        <section className="py-10 sm:py-14">
          <Container>
            <div className="mx-auto max-w-[560px] rounded-2xl border border-border bg-surface p-6 text-start shadow-rest sm:p-8">
              <p className="text-xs font-extrabold text-primary-strong">
                {ar ? 'مساحة الطالب' : 'Student workspace'}
              </p>
              <h1 className="mt-1 text-2xl font-extrabold text-ink sm:text-3xl">{t.accountTitle}</h1>
              <div className="mt-4">
                <Notice kind="info">
                  {lastAuthCode === 'SESSION_EXPIRED' ? t.sessionExpiredNotice : t.needLogin}
                </Notice>
              </div>
              <FormActions className="mt-5">
                <Button variant="primary" onClick={() => go('#/login')}>
                  {t.navLogin}
                </Button>
                <Button variant="secondary" onClick={() => go('#/register')}>
                  {ar ? 'إنشاء حساب جديد' : 'Create an account'}
                </Button>
              </FormActions>
            </div>
          </Container>
        </section>
      </main>
    );
  }

  if (user.role === 'ADMIN') {
    return <AdminSummaryPage accountOverview />;
  }
  return <StudentAccountOverview go={go} />;
}

function StudentAccountOverview({ go }: { go: (hash: string) => void }): JSX.Element {
  const codingEnabled = useCodingIde();
  const { t, lang } = useLang();
  const ar = lang === 'ar';
  const { data, loading, errorCode, reload } = useDashboard();

  const activeCount = data?.active.length ?? 0;
  const expiredCount = data?.expired.length ?? 0;
  const wallet = data?.walletBalancePiastres ?? null;
  const resume =
    data?.active
      .filter((s) => s.availableForLearning !== false)
      .sort(
        (a, b) =>
          (b.lastAccessedAt ? Date.parse(b.lastAccessedAt) : 0) -
          (a.lastAccessedAt ? Date.parse(a.lastAccessedAt) : 0),
      )[0] ?? null;

  return (
    <main id="main">
      <Container>
        <div className="mx-auto max-w-3xl rounded-2xl border border-border bg-surface p-5 text-start shadow-rest sm:p-6">
          <p className="text-xs font-extrabold text-primary-strong">
            {ar ? 'حسابي — نظرة عامة' : 'My account — overview'}
          </p>
          <h1 className="mt-1 text-2xl font-extrabold text-ink sm:text-3xl">
            {ar ? 'أهلاً بك في حسابك' : 'Welcome to your account'}
          </h1>
          <p className="mt-1.5 text-sm text-muted sm:text-base">
            {ar
              ? 'تعلّمك ومحفظتك وإشعاراتك وملفك في مساحة واحدة.'
              : 'Your learning, wallet, notifications and profile in one workspace.'}
          </p>

          {loading ? (
            <div className="mt-5">
              <Loading text={t.loading} />
            </div>
          ) : null}

          {!loading && errorCode !== null ? (
            <div className="mt-5">
              <Notice kind="error">{t.learningLoadError}</Notice>
              <FormActions>
                <Button variant="secondary" onClick={() => reload()}>
                  {t.retry}
                </Button>
              </FormActions>
            </div>
          ) : null}

          {!loading && errorCode === null && data !== null ? (
            <>
              {/* Elevated Resume Learning Hero Card at the very top for 1-tap teen ergonomics */}
              {resume ? (
                <div className="mt-5 rounded-2xl border border-primary/45 bg-elevated/65 p-5 shadow-rest">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs font-extrabold text-primary-strong">
                      {ar ? 'تابع من حيث توقفت' : 'Continue where you left off'}
                    </p>
                    <span className="inline-flex rounded-full border border-border bg-surface px-2.5 py-0.5 text-xs font-bold tabular-nums text-ink">
                      {resume.percentComplete}%
                    </span>
                  </div>
                  <p className="mt-1.5 text-xl font-extrabold text-ink">
                    {ar ? resume.titleAr : resume.titleEn}
                  </p>
                  <p className="mt-2 text-sm text-muted tabular-nums">
                    {ar ? 'الدروس المكتملة' : 'Completed lessons'}: {resume.completedLessons}/
                    {resume.totalLessons}
                  </p>
                  <ProgressBar
                    value={resume.percentComplete}
                    label={ar ? 'تقدم الكورس' : 'Course progress'}
                    className="mt-2.5"
                  />
                  <p className="mt-2.5 text-xs text-muted sm:text-sm">
                    {resume.expiresAt
                      ? `${ar ? 'الوصول حتى' : 'Access until'}: ${displayDeadline(resume.expiresAt, lang)}`
                      : ar
                        ? 'بدون انتهاء، حتى الحذف النهائي للكورس'
                        : 'No expiry, until permanent course removal'}
                  </p>
                  <FormActions className="mt-4">
                    <Button onClick={() => go(`#/learn/${encodeURIComponent(resume.slug)}`)}>
                      {t.learningContinue}
                    </Button>
                    <Button variant="secondary" onClick={() => go('#/dashboard')}>
                      {ar ? 'كل تعلّمي' : 'All my learning'}
                    </Button>
                  </FormActions>
                </div>
              ) : (
                <div className="mt-5 rounded-2xl border border-border bg-elevated/40 p-5">
                  <p className="text-sm leading-relaxed text-muted">
                    {activeCount > 0
                      ? ar
                        ? 'كورساتك غير متاحة للمشاهدة بعد. راجع تفاصيل تعلّمك.'
                        : 'Your courses are not available to watch yet. Check your learning details.'
                      : t.learningEmptyActive}
                  </p>
                  <FormActions className="mt-4">
                    <Button onClick={() => go(activeCount > 0 ? '#/dashboard' : '#/courses')}>
                      {activeCount > 0 ? (ar ? 'تعلّمي' : 'My learning') : t.learningBrowse}
                    </Button>
                  </FormActions>
                </div>
              )}

              <dl className="mt-5 grid gap-3 sm:grid-cols-3 tabular-nums">
                <div className="rounded-2xl border border-border bg-field/80 p-4">
                  <dt className="text-xs font-semibold text-muted">
                    {ar ? 'كورسات نشطة' : 'Active courses'}
                  </dt>
                  <dd className="mt-1 text-2xl font-extrabold text-ink sm:text-3xl">
                    {activeCount.toLocaleString(ar ? 'ar-EG' : 'en-GB')}
                  </dd>
                </div>
                <div className="rounded-2xl border border-border bg-field/80 p-4">
                  <dt className="text-xs font-semibold text-muted">
                    {ar ? 'اشتراكات منتهية' : 'Expired'}
                  </dt>
                  <dd className="mt-1 text-2xl font-extrabold text-ink sm:text-3xl">
                    {expiredCount.toLocaleString(ar ? 'ar-EG' : 'en-GB')}
                  </dd>
                </div>
                <div className="rounded-2xl border border-border bg-field/80 p-4">
                  <dt className="text-xs font-semibold text-muted">{t.walletBalance}</dt>
                  <dd className="mt-1 text-2xl font-extrabold text-primary-strong sm:text-3xl">
                    {formatEgp(wallet ?? 0, lang)}
                  </dd>
                </div>
              </dl>

              <nav
                className="account-shortcuts"
                aria-label={ar ? 'أقسام حسابك' : 'Your account sections'}
              >
                <a href="#/dashboard">{ar ? 'تعلّمي' : 'My learning'}</a>
                {codingEnabled ? <a href="#/practice">IDE</a> : null}
                <a href="#/wallet">{t.navWallet}</a>
                <a href="#/purchases">{ar ? 'مشترياتي' : 'My purchases'}</a>
                <a href="#/notifications">{t.navNotifications}</a>
                <a href="#/account/profile">{ar ? 'الملف والأمان' : 'Profile & security'}</a>
              </nav>
            </>
          ) : null}
        </div>
      </Container>
    </main>
  );
}
