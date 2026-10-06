import type { Lang } from '../i18n';
import type { Route } from '../routes';
import type { PublicPageData } from './publicData';
import { routeDocumentTitle } from '../pageTitles';
import { ar } from '../locales/ar';
import { en } from '../locales/en';
import hero from '../assets/fayq-learning-1280.webp';

const copy = {
  ar: {
    home: [
      'تعلم البرمجة لطلاب المرحلة الثانوية | FAYQ',
      'دورات برمجة مسجلة لطلاب المرحلة الثانوية. اكتشف الشرح الشهري والمراجعات والباقات، وراجع السعر وشروط الوصول قبل الاشتراك.',
    ],
    courses: [
      'دورات البرمجة والمراجعات والباقات | FAYQ',
      'تصفح دورات البرمجة حسب الصف والترم والسنة الدراسية. قارن الشرح الشهري والمراجعات والباقات وشروط الوصول المعروضة.',
    ],
    support: [
      'المساعدة والدعم | FAYQ',
      'تعرّف على تسجيل الدخول، الشحن اليدوي، الاشتراك، الدروس والتقييمات، وطرق التواصل مع دعم FAYQ عند توفرها.',
    ],
    'not-found': ['الصفحة غير موجودة | FAYQ', 'تحقق من الرابط أو تصفح دورات البرمجة على FAYQ.'],
    terms: [
      'شروط الاستخدام — بانتظار الاعتماد | FAYQ',
      'صفحة الشروط بانتظار مراجعة المالك واعتماد النص.',
    ],
    privacy: [
      'الخصوصية — بانتظار الاعتماد | FAYQ',
      'صفحة الخصوصية بانتظار مراجعة المالك واعتماد النص.',
    ],
    refunds: [
      'الاسترداد — بانتظار الاعتماد | FAYQ',
      'صفحة الاسترداد بانتظار مراجعة المالك واعتماد النص.',
    ],
  },
  en: {
    home: [
      'Programming courses for secondary students | FAYQ',
      'Recorded programming courses for secondary students. Explore monthly courses, revisions and packages, and review prices and access terms before subscribing.',
    ],
    courses: [
      'Programming courses, revisions and packages | FAYQ',
      'Browse programming courses by grade, term and academic year. Compare monthly courses, revisions, packages and their displayed access terms.',
    ],
    support: [
      'Help and support | FAYQ',
      'Find help with sign-in, manual recharge, subscriptions, lessons and assessments, and contact FAYQ support when contact details are available.',
    ],
    'not-found': ['Page not found | FAYQ', 'Check the link or browse programming courses on FAYQ.'],
    terms: [
      'Terms of use — pending adoption | FAYQ',
      'Terms are pending owner review and adoption.',
    ],
    privacy: [
      'Privacy — pending adoption | FAYQ',
      'The privacy policy is pending owner review and adoption.',
    ],
    refunds: [
      'Refunds — pending adoption | FAYQ',
      'The refund policy is pending owner review and adoption.',
    ],
  },
};
export function pageMetadata(lang: Lang, route: Route, data: PublicPageData | null) {
  const localized = copy[lang];
  const base = localized[route as keyof typeof localized];
  const course = route === 'course-detail' ? data?.course : undefined;
  const pkg = route === 'package' ? data?.pkg : undefined;
  const item = course ?? pkg;
  const title = item
    ? (lang === 'ar' ? item.titleAr : item.titleEn) + ' | FAYQ'
    : (base?.[0] ?? routeDocumentTitle(lang, route, lang === 'ar' ? ar : en));
  const description = item
    ? (lang === 'ar' ? item.titleAr + ' — ' + item.descriptionAr : item.titleEn + ' — ' + item.descriptionEn)
    : (base?.[1] ?? (lang === 'ar' ? 'مساحة حسابك على FAYQ.' : 'Your account workspace on FAYQ.'));
  const publicPage = ['home', 'courses', 'course-detail', 'package', 'support'].includes(route);
  const valid =
    data?.page === route &&
    (route !== 'course-detail' || !!course) &&
    (route !== 'package' || !!pkg?.available);
  const indexable = publicPage && valid && data?.pageSize === 10 && !!data?.indexing && !!data.origin;
  const path = data?.path ?? '/' + lang;
  const canonical =
    publicPage && valid && data?.pageSize === 10 && data?.origin ? data.origin + path : undefined;
  const alternatives = canonical
    ? ['ar', 'en'].map((language) => ({
        lang: language,
        url: data!.origin + '/' + language + path.slice(3),
      }))
    : [];
  const image = data?.origin ? new URL(hero, data.origin).href : undefined;
  const schema: Record<string, unknown>[] = [];
  if (canonical && publicPage && valid) {
    schema.push({
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: title,
      description,
      url: canonical,
      inLanguage: lang,
    });
    if (route === 'home')
      schema.push({
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: 'FAYQ',
        url: data!.origin + '/',
        inLanguage: ['ar', 'en'],
      });
    if (course)
      schema.push({
        '@context': 'https://schema.org',
        '@type': 'Course',
        name: lang === 'ar' ? course.titleAr : course.titleEn,
        description,
        url: canonical,
        inLanguage: lang,
        provider: { '@type': 'Organization', name: 'FAYQ' },
      });
    if (course || pkg)
      schema.push({
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          {
            '@type': 'ListItem',
            position: 1,
            name: lang === 'ar' ? 'الدورات' : 'Courses',
            item: data!.origin + '/' + lang + '/courses',
          },
          {
            '@type': 'ListItem',
            position: 2,
            name: lang === 'ar' ? item!.titleAr : item!.titleEn,
            item: canonical,
          },
        ],
      });
  }
  return {
    title:
      route === 'courses' && data && data.pageNumber > 1
        ? title + (lang === 'ar' ? ' — صفحة ' : ' — Page ') + data.pageNumber
        : title,
    description:
      route === 'courses' && data && data.pageNumber > 1
        ? description + (lang === 'ar' ? ' صفحة ' : ' Page ') + data.pageNumber + '.'
        : description,
    robots: indexable ? 'index, follow' : 'noindex, follow',
    canonical,
    alternatives,
    image,
    schema,
    lang,
  };
}
export function safeJson(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}
export function updateDocumentMetadata(
  lang: Lang,
  route: Route,
  data: PublicPageData | null,
): void {
  const meta = pageMetadata(lang, route, data);
  document.title = meta.title;
  const values: Record<string, string | undefined> = {
    description: meta.description,
    robots: meta.robots,
    'og:title': meta.title,
    'og:description': meta.description,
    'og:url': meta.canonical,
    'og:image': meta.image,
    'og:type': 'website',
    'og:site_name': 'FAYQ',
    'og:locale': lang === 'ar' ? 'ar_EG' : 'en_US',
    'og:locale:alternate': lang === 'ar' ? 'en_US' : 'ar_EG',
    'twitter:card': meta.image ? 'summary_large_image' : 'summary',
    'twitter:title': meta.title,
    'twitter:description': meta.description,
    'twitter:image': meta.image,
  };
  for (const [key, value] of Object.entries(values)) {
    const attribute = key.startsWith('og:') ? 'property' : 'name';
    let node = document.head.querySelector<HTMLMetaElement>(
      'meta[' + attribute + '="' + key + '"]',
    );
    if (value === undefined) {
      node?.remove();
      continue;
    }
    if (!node) {
      node = document.createElement('meta');
      node.setAttribute(attribute, key);
      document.head.append(node);
    }
    node.content = value;
  }
  document.head
    .querySelectorAll('link[rel="canonical"],link[hreflang],script[data-seo-schema]')
    .forEach((node) => node.remove());
  if (meta.canonical) {
    const link = document.createElement('link');
    link.rel = 'canonical';
    link.href = meta.canonical;
    document.head.append(link);
  }
  for (const alternate of [
    ...meta.alternatives,
    ...(meta.alternatives.length ? [{ lang: 'x-default', url: meta.alternatives[0]!.url }] : []),
  ]) {
    const link = document.createElement('link');
    link.rel = 'alternate';
    link.hreflang = alternate.lang;
    link.href = alternate.url;
    document.head.append(link);
  }
  if (meta.schema.length) {
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.dataset['seoSchema'] = '';
    script.textContent = safeJson(meta.schema);
    document.head.append(script);
  }
}
