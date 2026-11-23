import { useEffect, useState } from 'react';
import { apiFetch, useAuth } from '../../auth';
import { useLang } from '../../i18n';
import { Card, Container } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Loading, Notice } from '../../components/ui/Notice';
import { formatEgp } from '../catalog/types/models';
import { displayDeadline } from './model';

type Summary = {
  asOf: string;
  students: number;
  publishedCourses: number;
  draftCourses: number;
  publishedPackages: number;
  pendingRecharges: number;
  coursePurchases: number;
  packagePurchases: number;
  walletBalancePiastres: number;
  activeCourseAccess: number;
};

export function AdminSummaryPage({
  accountOverview = false,
}: { accountOverview?: boolean } = {}): JSX.Element {
  const { t, lang } = useLang();
  const ar = lang === 'ar';
  const { status, user } = useAuth();
  const [data, setData] = useState<Summary | null>(null);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    if (status !== 'authenticated' || user?.role !== 'ADMIN') return;
    let live = true;
    setLoading(true);
    setFailed(false);
    apiFetch<{ data: Summary }>('/admin/catalog/summary', { retryOnAuth: true })
      .then((r) => {
        if (live) setData(r.data);
      })
      .catch(() => {
        if (live) setFailed(true);
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [status, user?.role, retry]);

  const metrics: [keyof Omit<Summary, 'asOf'>, string][] = [
    ['students', ar ? 'حسابات الطلاب' : 'Student accounts'],
    ['publishedCourses', ar ? 'كورسات منشورة' : 'Published courses'],
    ['draftCourses', ar ? 'مسودات الكورسات' : 'Draft courses'],
    ['publishedPackages', ar ? 'باقات منشورة' : 'Published packages'],
    ['pendingRecharges', ar ? 'طلبات شحن تنتظر المراجعة' : 'Pending recharge requests'],
    ['coursePurchases', ar ? 'عمليات شراء كورس منذ البداية' : 'All-time course purchases'],
    ['packagePurchases', ar ? 'عمليات شراء باقة منذ البداية' : 'All-time package purchases'],
    [
      'activeCourseAccess',
      ar ? 'وصول ساري: طالب وكورس، بدون تكرار' : 'Active student-course access, deduplicated',
    ],
    [
      'walletBalancePiastres',
      ar ? 'إجمالي أرصدة المحافظ الحالية' : 'Total current wallet balances',
    ],
  ];

  return (
    <main id="main">
      <Container>
        <section className="py-6 text-start md:py-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="section-title text-balance text-ink">
                {status === 'authenticated' && user?.role !== 'ADMIN'
                  ? ar
                    ? 'غير مسموح'
                    : 'Access denied'
                  : ar
                    ? 'نظرة عامة على المنصة'
                    : 'Platform overview'}
              </h1>
              {accountOverview && status === 'authenticated' && user?.role === 'ADMIN' ? (
                <p className="mt-1.5 text-sm text-muted">
                  {user.displayName} ·{' '}
                  <a className="font-bold text-primary-strong underline underline-offset-4" href="#/account/profile">
                    {ar ? 'الملف والأمان' : 'Profile & security'}
                  </a>
                </p>
              ) : null}
            </div>
            {status === 'authenticated' && user?.role === 'ADMIN' ? (
              <Button variant="secondary" onClick={() => setRetry((v) => v + 1)} disabled={loading}>
                {ar ? 'تحديث الملخص' : 'Refresh overview'}
              </Button>
            ) : null}
          </div>

          {status === 'loading' ? (
            <div className="mt-4">
              <Loading text={t.loading} />
            </div>
          ) : status !== 'authenticated' ? (
            <div className="mt-4">
              <Notice kind="info">{t.needLogin}</Notice>
            </div>
          ) : user?.role !== 'ADMIN' ? (
            <div className="mt-4">
              <Notice kind="error">{t.forbiddenBody}</Notice>
            </div>
          ) : (
            <>
              <p className="mt-3 text-sm leading-relaxed text-muted">
                {ar
                  ? 'هذا الملخص للمتابعة فقط. اختر تبويبًا أعلى الصفحة لفتح القسم الذي تريد تعديله؛ كل نموذج له زر حفظ مستقل.'
                  : 'This summary is for monitoring. Choose a tab above to open the section you want to edit; each form has its own Save action.'}
              </p>

              {loading ? (
                <div className="mt-4">
                  <Loading text={t.loading} />
                </div>
              ) : failed ? (
                <div className="mt-4">
                  <Notice kind="error">
                    {ar
                      ? 'تعذّر تحميل الملخص. حاول مرة أخرى.'
                      : 'Could not load the overview. Please retry.'}
                  </Notice>
                </div>
              ) : data ? (
                <>
                  <p className="my-4 text-xs font-semibold text-muted">
                    {ar ? 'آخر تحديث بتوقيت القاهرة:' : 'Last updated, Cairo:'}{' '}
                    {displayDeadline(data.asOf, lang)}
                  </p>
                  <a
                    href="#/admin/recharge"
                    className={`mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border p-4 font-extrabold no-underline transition-colors ${
                      data.pendingRecharges > 0
                        ? 'border-pending-fg bg-pending-bg text-pending-fg shadow-rest'
                        : 'border-border bg-surface text-ink hover:border-border-strong'
                    }`}
                  >
                    <span>
                      {ar
                        ? `${data.pendingRecharges} طلب شحن يحتاج المراجعة — افتح قائمة الطلبات`
                        : `${data.pendingRecharges} recharge requests need review — open the queue`}
                    </span>
                    <span className="inline-block rtl:rotate-180" aria-hidden="true">→</span>
                  </a>
                  <dl className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 tabular-nums">
                    {metrics.map(([key, label]) => (
                      <Card
                        key={key}
                        className="flex flex-col rounded-2xl border-border bg-surface !p-5 transition-colors hover:border-border-strong"
                      >
                        <dt className="text-xs font-bold text-muted sm:text-sm">{label}</dt>
                        <dd className="mt-2.5 text-2xl font-extrabold text-ink sm:text-3xl">
                          {key === 'walletBalancePiastres'
                            ? formatEgp(data[key], lang)
                            : data[key].toLocaleString(ar ? 'ar-EG' : 'en-GB')}
                        </dd>
                        {[
                          'students',
                          'publishedCourses',
                          'draftCourses',
                          'publishedPackages',
                          'pendingRecharges',
                        ].includes(key) ? (
                          <a
                            className="mt-auto inline-flex min-h-[36px] items-center pt-3 text-sm font-bold text-primary-strong underline underline-offset-4"
                            href={
                              key === 'students'
                                ? '#/admin/students'
                                : key === 'publishedPackages'
                                  ? '#/admin/packages'
                                  : key === 'pendingRecharges'
                                    ? '#/admin/recharge'
                                    : '#/admin/catalog'
                            }
                          >
                            {ar ? 'فتح الإدارة' : 'Open management'}
                          </a>
                        ) : null}
                      </Card>
                    ))}
                  </dl>
                  <p className="mt-5 text-xs leading-relaxed text-muted sm:text-sm">
                    {ar
                      ? 'الوصول الساري يشمل غير المنشور؛ المشاهدة تحتاج نشر الكورس. أرصدة المحافظ ليست إيرادًا. الأرقام من سجلات المنصة الحالية.'
                      : 'Active access includes unpublished courses; viewing requires publication. Wallet balances are not revenue. Counts reflect current platform records.'}
                  </p>
                </>
              ) : null}
            </>
          )}
        </section>
      </Container>
    </main>
  );
}
