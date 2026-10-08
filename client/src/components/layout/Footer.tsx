import { useLang } from '../../i18n';
import { Container } from '../ui/Card';
import { publicHref } from '../../seo/paths';
import { Wordmark } from '../ui/Wordmark';

export function Footer(): JSX.Element {
  const { lang, t } = useLang();
  const label = (ar: string, en: string): string => lang === 'ar' ? ar : en;
  return (
    <footer className="mt-auto border-t border-border bg-surface pb-5 pt-8 text-sm text-muted">
      <Container>
        <div className="grid grid-cols-2 gap-6 md:grid-cols-[2fr_1fr_1fr]">
          <div className="col-span-full md:col-auto [&_p]:mt-2 [&_p]:max-w-[32ch]">
            <a className="inline-flex min-h-[44px] items-center text-ink" href={publicHref('#/', lang)} aria-label={label('FAYQ — الرئيسية', 'FAYQ — Home')}>
              <Wordmark markSize={32} />
            </a>
            <p>{label('دروس برمجة مسجّلة لطلاب المرحلة الثانوية.', 'Recorded programming lessons for secondary students.')}</p>
          </div>
          <nav aria-label={label('اكتشف FAYQ', 'Explore FAYQ')}>
            <h2 className="mb-1 text-sm font-bold text-ink">{label('روابط سريعة', 'Quick links')}</h2>
            <ul className="[&_a]:flex [&_a]:min-h-[44px] [&_a]:w-fit [&_a]:items-center [&_a]:underline [&_a]:decoration-transparent [&_a]:underline-offset-4 [&_a:hover]:text-primary-strong [&_a:hover]:decoration-current [&_a:focus-visible]:text-primary-strong [&_a:focus-visible]:decoration-current">
              <li><a href={publicHref('#/courses', lang)}>{t.navCourses}</a></li>
              <li><a href={publicHref('#/support', lang)}>{label('المساعدة', 'Help')}</a></li>
            </ul>
          </nav>
          <nav aria-label={label('سياسات FAYQ', 'FAYQ policies')}>
            <h2 className="mb-1 text-sm font-bold text-ink">{label('السياسات', 'Policies')}</h2>
            <ul className="[&_a]:flex [&_a]:min-h-[44px] [&_a]:w-fit [&_a]:items-center [&_a]:underline [&_a]:decoration-transparent [&_a]:underline-offset-4 [&_a:hover]:text-primary-strong [&_a:hover]:decoration-current [&_a:focus-visible]:text-primary-strong [&_a:focus-visible]:decoration-current">
              {([['terms', 'الشروط', 'Terms'], ['privacy', 'الخصوصية', 'Privacy'], ['refunds', 'الاسترداد', 'Refunds']] as const).map(([id, ar, en]) => (
                <li key={id}><a href={publicHref(`#/${id}`, lang)}>{label(ar, en)}</a></li>
              ))}
            </ul>
          </nav>
        </div>
        <div className="mt-6 flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-t border-border pt-4">
          <p>{t.slogan}</p>
          <p dir="ltr">© {new Date().getFullYear()} FAYQ</p>
        </div>
      </Container>
    </footer>
  );
}
