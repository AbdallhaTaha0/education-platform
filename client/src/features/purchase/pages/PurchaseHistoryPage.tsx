import { useEffect, useState } from 'react';
import { useLang } from '../../../i18n';
import { Card, Container } from '../../../components/ui/Card';
import { EmptyState, Loading } from '../../../components/ui/Notice';
import { Money } from '../../wallet/components/Money';
import { fetchMyPurchases } from '../api/client';

export function PurchaseHistoryPage(): JSX.Element {
  const { t, lang } = useLang();
  const [rows, setRows] = useState<Awaited<ReturnType<typeof fetchMyPurchases>>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let live = true;
    fetchMyPurchases()
      .then((data) => {
        if (live) setRows(data);
      })
      .catch(() => {})
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, []);

  return (
    <main id="main">
      <section className="py-8">
        <Container>
          <h1 className="text-2xl font-bold">{t.purchaseHistory}</h1>
          {loading ? <Loading text={t.loading} /> : null}
          {!loading && rows.length === 0 ? <div className="mt-4"><EmptyState text={t.purchaseEmpty} /></div> : null}
          <ul className="mt-4 space-y-3">
            {rows.map((row) => (
              <li key={row.id}>
                <Card className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-bold"><Money piastres={row.pricePiastres} /></p>
                    <p className="text-sm text-muted">{row.durationDays} {t.daysUnit}</p>
                  </div>
                  <p className="text-sm text-muted">{new Date(row.createdAt).toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-US')}</p>
                </Card>
              </li>
            ))}
          </ul>
        </Container>
      </section>
    </main>
  );
}
