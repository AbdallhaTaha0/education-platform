import { AdminSummaryPage } from '../../academic/AdminSummaryPage';
import { useAuth } from '../../../auth';
import { useLang } from '../../../i18n';
import { Container } from '../../../components/ui/Card';
import { Loading, Notice } from '../../../components/ui/Notice';
import { FormActions } from '../../../components/ui/FormActions';
import { Button } from '../../../components/ui/Button';
import { useDashboard } from '../../learning/hooks/useLearning';
import { formatEgp } from '../../catalog/types/models';
import { displayDeadline } from '../../academic/model';

/**
 * Authenticated role-aware overview for #/account.
 * STUDENT reuses the existing learning dashboard payload (progress, expiry,
 * wallet availability). ADMIN reuses the existing catalog summary endpoint.
 * No protected fetch runs while authentication is unresolved; anonymous
 * access keeps the existing sign-in prompt.
 */
export function AccountOverview({ go }: { go: (hash: string) => void }): JSX.Element {
  const { status, user, lastAuthCode } = useAuth();
  const { t } = useLang();

  if (status === 'loading') {
    return (
      <main id="main">
        <Container>
          <p className="text-muted">{t.authChecking}</p>
        </Container>
      </main>
    );
  }

  if (status === 'anonymous' || !user) {
    return (
      <main id="main">
        <Container>
          <div className="mx-auto max-w-[640px] rounded-card border border-border bg-surface p-6 shadow-rest">
            <h1>{t.accountTitle}</h1>
            <Notice kind="info">
              {lastAuthCode === 'SESSION_EXPIRED' ? t.sessionExpiredNotice : t.needLogin}
            </Notice>
            <FormActions>
              <Button variant="secondary" onClick={() => go('#/login')}>
                {t.navLogin}
              </Button>
            </FormActions>
          </div>
        </Container>
      </main>
    );
  }

  if (user.role === 'ADMIN') {
    return <AdminSummaryPage accountOverview />;
  }
  return <StudentAccountOverview go={go} />;
}

function StudentAccountOverview({ go }: { go: (hash: string) => void }): JSX.Element {
  const { t, lang } = useLang();
  const ar = lang === 'ar';
  const { data, loading, errorCode, reload } = useDashboard();

  const activeCount = data?.active.length ?? 0;
  const expiredCount = data?.expired.length ?? 0;
  const wallet = data?.walletBalancePiastres ?? null;
  const resume = data?.active.filter((s) => s.availableForLearning !== false)
    .sort((a, b) => (b.lastAccessedAt ? Date.parse(b.lastAccessedAt) : 0)
      - (a.lastAccessedAt ? Date.parse(a.lastAccessedAt) : 0))[0] ?? null;

  return (
    <main id="main">
      <Container>
        <div className="mx-auto max-w-[720px] rounded-card border border-border bg-surface p-6 shadow-rest">
          <p className="text-sm font-bold text-muted">
            {ar ? 'حسابي — نظرة عامة' : 'My account — overview'}
          </p>
        <h1 className="mt-1 text-3xl font-bold">{ar ? 'أهلاً بك في حسابك' : 'Welcome to your account'}</h1>
        <p className="mt-2 text-muted">
          {ar
            ? 'تعلّمك ومحفظتك وإشعاراتك وملفك في مساحة واحدة.'
            : 'Your learning, wallet, notifications and profile in one workspace.'}
        </p>
        {loading ? <Loading text={t.loading} /> : null}
        {!loading && errorCode !== null ? (
          <>
            <Notice kind="error">{t.learningLoadError}</Notice>
            <FormActions>
              <Button variant="secondary" onClick={() => reload()}>
                {t.retry}
              </Button>
            </FormActions>
          </>
        ) : null}
        {!loading && errorCode === null && data !== null ? (
          <>
            <dl className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-card border border-border p-4">
                <dt className="text-sm text-muted">{ar ? 'كورسات نشطة' : 'Active courses'}</dt>
                <dd className="mt-1 text-3xl font-bold">{activeCount.toLocaleString(ar ? 'ar-EG' : 'en-GB')}</dd>
              </div>
              <div className="rounded-card border border-border p-4">
                <dt className="text-sm text-muted">{ar ? 'اشتراكات منتهية' : 'Expired'}</dt>
                <dd className="mt-1 text-3xl font-bold">{expiredCount.toLocaleString(ar ? 'ar-EG' : 'en-GB')}</dd>
              </div>
              <div className="rounded-card border border-border p-4">
                <dt className="text-sm text-muted">{t.walletBalance}</dt>
                <dd className="mt-1 text-3xl font-bold">
                  {wallet === null ? (ar ? 'غير متاح' : 'Unavailable') : formatEgp(wallet, lang)}
                </dd>
              </div>
            </dl>
            {resume ? (
              <div className="mt-4 rounded-card border border-border p-4">
                <p className="text-sm text-muted">{ar ? 'تابع من حيث توقفت' : 'Continue where you left off'}</p>
                <p className="mt-1 font-bold">{lang === 'ar' ? resume.titleAr : resume.titleEn}</p>
                <p className="mt-2 text-sm text-muted">
                  {ar ? 'الدروس المكتملة' : 'Completed lessons'}: {resume.completedLessons}/{resume.totalLessons}
                  {' · '}{resume.percentComplete}%
                </p>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-canvas" role="progressbar"
                  aria-valuemin={0} aria-valuemax={100} aria-valuenow={resume.percentComplete}
                  aria-label={ar ? 'تقدم الكورس' : 'Course progress'}>
                  <div className="h-full rounded-full bg-primary" style={{ width: `${resume.percentComplete}%` }} />
                </div>
                <p className="mt-2 text-sm text-muted">{resume.expiresAt
                  ? `${ar ? 'الوصول حتى' : 'Access until'}: ${displayDeadline(resume.expiresAt, lang)}`
                  : (ar ? 'بدون انتهاء، حتى الحذف النهائي للكورس' : 'No expiry, until permanent course removal')}</p>
                <FormActions>
                  <Button onClick={() => go(`#/learn/${encodeURIComponent(resume.slug)}`)}>
                    {t.learningContinue}
                  </Button>
                  <Button variant="secondary" onClick={() => go('#/dashboard')}>
                    {ar ? 'كل تعلّمي' : 'All my learning'}
                  </Button>
                </FormActions>
              </div>
            ) : (
              <div className="mt-4 rounded-card border border-border p-4">
                <p className="text-muted">{activeCount > 0
                  ? (ar ? 'كورساتك غير متاحة للمشاهدة بعد. راجع تفاصيل تعلّمك.' : 'Your courses are not available to watch yet. Check your learning details.')
                  : t.learningEmptyActive}</p>
                <FormActions>
                  <Button onClick={() => go(activeCount > 0 ? '#/dashboard' : '#/courses')}>
                    {activeCount > 0 ? (ar ? 'تعلّمي' : 'My learning') : t.learningBrowse}
                  </Button>
                </FormActions>
              </div>
            )}
            <nav
              className="account-shortcuts"
              aria-label={ar ? 'أقسام حسابك' : 'Your account sections'}
            >
              <a href="#/dashboard">{ar ? 'تعلّمي' : 'My learning'}</a>
              <a href="#/practice">{ar ? 'مختبر البرمجة' : 'Practice'}</a>
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
