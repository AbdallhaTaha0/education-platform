import { useEffect, useState } from 'react';
import { apiFetch, useAuth } from '../../auth';
import { useLang } from '../../i18n';
import { Card, Container } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { FormActions } from '../../components/ui/FormActions';
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
export function AdminSummaryPage({ accountOverview = false }: { accountOverview?: boolean } = {}): JSX.Element {
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
        <section className="py-10">
          <h1 className="section-title">{ar ? 'نظرة عامة على المنصة' : 'Platform overview'}</h1>
          {accountOverview && status === 'authenticated' && user?.role === 'ADMIN' ? (
            <p className="mt-3 text-muted">{user.displayName} · <a className="underline" href="#/account/profile">
              {ar ? 'الملف والأمان' : 'Profile & security'}</a></p>
          ) : null}
          {status === 'loading' ? (
            <Loading text={t.loading} />
          ) : status !== 'authenticated' ? (
            <Notice kind="info">{t.needLogin}</Notice>
          ) : user?.role !== 'ADMIN' ? (
            <Notice kind="error">{t.forbiddenBody}</Notice>
          ) : (
            <>
              <p className="my-5 text-sm leading-7 text-muted">{ar ? 'هذا الملخص للمتابعة فقط. اختر تبويبًا أعلى الصفحة لفتح القسم الذي تريد تعديله؛ كل نموذج له زر حفظ مستقل.' : 'This summary is for monitoring. Choose a tab above to open the section you want to edit; each form has its own Save action.'}</p>
              <FormActions className="mt-4">
                <Button variant="secondary" onClick={() => setRetry((v) => v + 1)} disabled={loading}>
                  {ar ? 'تحديث الملخص' : 'Refresh overview'}
                </Button>
              </FormActions>
              {loading ? (
                <Loading text={t.loading} />
              ) : failed ? (
                <Notice kind="error">
                  {ar
                    ? 'تعذّر تحميل الملخص. حاول مرة أخرى.'
                    : 'Could not load the overview. Please retry.'}
                </Notice>
              ) : data ? (
                <>
                  <p className="my-4 text-sm text-muted">
                    {ar ? 'آخر تحديث بتوقيت القاهرة:' : 'Last updated, Cairo:'}{' '}
                    {displayDeadline(data.asOf, lang)}
                  </p>
                  <a href="#/admin/recharge" className="mb-5 block rounded-card border border-primary bg-elevated p-5 font-bold">{ar?`${data.pendingRecharges} طلب شحن يحتاج المراجعة — افتح قائمة الطلبات`:`${data.pendingRecharges} recharge requests need review — open the queue`}</a>
                  <dl className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {metrics.map(([key, label]) => (
                      <Card key={key}>
                        <dt className="text-muted">{label}</dt>
                        <dd className="mt-3 text-3xl font-bold">
                          {key === 'walletBalancePiastres'
                            ? formatEgp(data[key], lang)
                            : data[key].toLocaleString(ar ? 'ar-EG' : 'en-GB')}
                        </dd>
                        {['students','publishedCourses','draftCourses','publishedPackages','pendingRecharges'].includes(key) ? <a className="mt-3 inline-block underline" href={key==='students'?'#/admin/students':key==='publishedPackages'?'#/admin/packages':key==='pendingRecharges'?'#/admin/recharge':'#/admin/catalog'}>{ar?'فتح الإدارة':'Open management'}</a>:null}
                      </Card>
                    ))}
                  </dl>
                  <p className="mt-5 text-sm text-muted">
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
