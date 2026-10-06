import { useLang } from '../../i18n';
import { Container } from '../ui/Card';
import { publicHref } from '../../seo/paths';
export function Footer(): JSX.Element {
  const { lang, t } = useLang();
  return (
      <footer className="mt-auto border-t border-border bg-surface py-8 text-sm text-muted">
        <Container>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="font-semibold text-ink">{t.footer}</p>
            <a className="footer-discovery" href={publicHref("#/courses", lang)}>
              {t.navCourses} ↗
            </a>
            <p>{t.slogan}</p>
            <nav className="flex flex-wrap gap-4" aria-label={lang==='ar'?'المساعدة والسياسات':'Help and policies'}>{[['support','المساعدة','Help'],['terms','الشروط','Terms'],['privacy','الخصوصية','Privacy'],['refunds','الاسترداد','Refunds']].map(([id,a,e])=><a key={id} href={publicHref(`#/${id}`, lang)} className="underline">{lang==='ar'?a:e}</a>)}</nav>
          </div>
        </Container>
      </footer>
  );
}
