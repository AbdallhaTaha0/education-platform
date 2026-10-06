import { renderToString, renderToStaticMarkup } from 'react-dom/server';
import { PublicDataProvider, type PublicPageData } from './publicData';
import App from '../App';
import { pageMetadata, safeJson } from './metadata';

/** Same public React components and DTOs for users and bots; no crawler detection. */
export function renderPublicPage(data: PublicPageData): { body: string; head: string } {
  const meta = pageMetadata(data.lang, data.page, data);
  const head = renderToStaticMarkup(
    <>
      <title>{meta.title}</title>
      <meta name="description" content={meta.description} />
      <meta name="robots" content={meta.robots} />
      <meta property="og:type" content="website" />
      <meta property="og:site_name" content="FAYQ" />
      <meta property="og:title" content={meta.title} />
      <meta property="og:description" content={meta.description} />
      <meta property="og:locale" content={data.lang === 'ar' ? 'ar_EG' : 'en_US'} />
      <meta property="og:locale:alternate" content={data.lang === 'ar' ? 'en_US' : 'ar_EG'} />
      <meta name="twitter:card" content={meta.image ? 'summary_large_image' : 'summary'} />
      <meta name="twitter:title" content={meta.title} />
      <meta name="twitter:description" content={meta.description} />
      {meta.canonical ? (
        <>
          <link rel="canonical" href={meta.canonical} />
          <meta property="og:url" content={meta.canonical} />
        </>
      ) : null}
      {meta.image ? (
        <>
          <meta property="og:image" content={meta.image} />
          <meta name="twitter:image" content={meta.image} />
        </>
      ) : null}
      {meta.alternatives.map((alternate) => (
        <link key={alternate.lang} rel="alternate" hrefLang={alternate.lang} href={alternate.url} />
      ))}
      {meta.alternatives[0] ? (
        <link rel="alternate" hrefLang="x-default" href={meta.alternatives[0].url} />
      ) : null}
      {meta.schema.length ? (
        <script
          type="application/ld+json"
          data-seo-schema=""
          dangerouslySetInnerHTML={{ __html: safeJson(meta.schema) }}
        />
      ) : null}
    </>,
  );
  const body = renderToString(<PublicDataProvider data={data}><App /></PublicDataProvider>);
  return { body, head };
}
