import { useEffect, useState } from 'react';
import { useLang } from '../../../i18n';
import { Card, Container } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { EmptyState, Loading, Notice } from '../../../components/ui/Notice';
import { Money } from '../../wallet/components/Money';
import { fetchMyPurchases } from '../api/client';
import { packageHistory, type PackageReceipt } from '../../academic/api';
import { displayDeadline } from '../../academic/model';

export function PurchaseHistoryPage(): JSX.Element {
  const { t, lang } = useLang(); const ar = lang === 'ar';
  const [rows, setRows] = useState<Awaited<ReturnType<typeof fetchMyPurchases>>>([]);
  const [packages, setPackages] = useState<PackageReceipt[]>([]);
  const [loading, setLoading] = useState(true); const [failed, setFailed] = useState(false); const [retry, setRetry] = useState(0);
  useEffect(() => { let live = true; setLoading(true); setFailed(false); Promise.all([fetchMyPurchases(), packageHistory()]).then(([c,p]) => { if (live) { setRows(c); setPackages(p); } }).catch(() => { if (live) setFailed(true); }).finally(() => { if (live) setLoading(false); }); return () => { live = false; }; }, [retry]);
  return <main id="main"><section className="py-10"><Container><h1 className="section-title">{t.purchaseHistory}</h1>
    {loading ? <Loading text={t.loading} /> : failed ? <><Notice kind="error">{ar ? 'تعذّر تحميل المشتريات.' : 'Could not load purchases.'}</Notice><Button variant="secondary" onClick={() => setRetry(v => v+1)}>{t.retryLabel}</Button></> : <>
      {!rows.length && !packages.length ? <EmptyState text={t.purchaseEmpty} /> : null}
      <ul className="mt-6 space-y-4">{packages.map(p => <li key={`package-${p.id}`}><Card><h2 className="text-xl font-bold">{ar ? p.titleAr : p.titleEn}</h2><p className="my-2 font-bold"><Money piastres={p.pricePiastres} /></p><p className="text-sm">{ar ? 'عملية شراء واحدة للباقة، وليست ٣ خصومات.' : 'One package payment, not three charges.'}</p><ul className="my-3 list-inside list-disc">{p.items.map(c => <li key={c.courseId}>{ar ? c.titleAr : c.titleEn}</li>)}</ul><p>{t.validUntil}: {displayDeadline(p.endsAt, lang)} ({ar ? 'القاهرة' : 'Cairo'})</p><p className="mt-2 text-sm text-muted">{displayDeadline(p.createdAt, lang)}</p></Card></li>)}{rows.map(row => <li key={`course-${row.id}`}><Card className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-bold"><Money piastres={row.pricePiastres} /></h2><p className="mt-2 text-sm">{row.accessMode === 'UNTIL_REMOVAL' ? (ar ? 'بدون انتهاء، حتى الحذف النهائي للكورس' : 'No expiry, until permanent course removal') : row.durationDays !== null ? `${row.durationDays} ${t.daysUnit}` : row.accessEndsAt ? `${t.validUntil}: ${displayDeadline(row.accessEndsAt,lang)}` : t.planUnavailable}</p></div><p className="text-sm text-muted">{displayDeadline(row.createdAt, lang)}</p></Card></li>)}</ul>
    </>}
  </Container></section></main>;
}
