# Technical SEO phase follow-up — 2026-10-11

This follow-up accounts for all phases in the [2026-10-06 ordered SEO ledger](seo-phase-ledger-20261006.md). Findings and source traces that did not change remain in that detailed ledger. The table records the current change impact and current manual-verification boundary; it is not evidence of a live search-engine crawl.

| Phase | Topic | Current disposition |
|---:|---|---|
| 1 | Understand the website | Carry forward: React/Vite public SSR lives in the same Express application; no production origin is configured. |
| 2 | Page inventory | Carry forward: public home/catalog/course/package/support pages and private application areas remain as inventoried. |
| 3 | Indexability | Carry forward: safe public SSR; staging stays noindex and private routes remain excluded. |
| 4 | robots.txt | Carry forward: generated policy remains origin/indexing-configured; live host behavior is manual. |
| 5 | XML sitemap | Refreshed crawl: 34 synthetic public URLs; publication and availability filters remain in source. |
| 6 | URL structure | Carry forward: `/ar` and `/en` paths and normalized public route handling unchanged. |
| 7 | Title tags | Browser crawl reports 34 unique titles on the synthetic fixture; actual content names need owner review. |
| 8 | Meta descriptions | Browser crawl reports 34 unique descriptions on the synthetic fixture; editorial accuracy needs owner review. |
| 9 | Canonical tags | Carry forward: self-reference, clean tracking URLs and language alternatives remain tested. |
| 10 | Heading structure | Carry forward: public template hierarchy and one H1 per fixture page remain in browser crawl. |
| 11 | Semantic HTML | Carry forward: native links/actions and page landmarks remain; no semantic rewrite. |
| 12 | Content quality | Needs owner review for real course/package copy and human Arabic/English quality. |
| 13 | Internal linking | Refreshed crawl discovers 34 public links; all 34 synthetic sitemap pages remain discoverable. |
| 14 | Broken links | Browser crawl reports zero broken images and 34 accessible fixture documents; real external contacts remain manual. |
| 15 | Redirects | Carry forward: root, language and route redirects unchanged; live edge redirects are manual. |
| 16 | 404 page | Carry forward: prior valid/missing/upstream status regressions remain applicable. |
| 17 | Image SEO | Updated: responsive hero preload is emitted in raw SSR; course cover social URLs are same-origin and validated. |
| 18 | Performance SEO | Updated: current Lighthouse mobile 92/desktop 100; mobile LCP 2.9 s remains open. |
| 19 | Core Web Vitals | Updated: synthetic CLS 0.008 mobile/0.005 desktop, TBT 0 ms, mobile LCP over 2.5 s. Field p75/INP remain manual. |
| 20 | JavaScript bundle optimization | Build passes; `AdminSummaryPage` static+dynamic import warning remains. Large private learning/IDE chunks stay lazy. |
| 21 | Lazy loading | Page markup preserves lazy founder images; audit now waits for decode before declaring an image broken. |
| 22 | Font optimization | Carry forward: self-hosted WOFF2/fallback behavior unchanged; real-device waterfall needs measurement. |
| 23 | Mobile SEO | 16 synthetic browser scenarios have no horizontal overflow; physical devices and screen readers remain manual. |
| 24 | Accessibility SEO | Lighthouse accessibility 100 in the synthetic public home; this is not complete assistive-technology qualification. |
| 25 | Open Graph | Updated default image is the existing founders hero; exact course-cover URLs are mapped to the published public endpoint. |
| 26 | Twitter / X cards | Same responsive source metadata update as Open Graph; actual social fetch/crop is manual. |
| 27 | Structured data | Carry forward: truthful WebPage/WebSite/Course/BreadcrumbList data; search-engine eligibility remains manual. |
| 28 | Website schema | Carry forward: no fabricated SearchAction; real configured domain is unavailable. |
| 29 | Organization / personal brand schema | Carry forward: visible FAYQ identity only; no invented business/address/person fields. |
| 30 | Breadcrumbs | Carry forward: visible and structured breadcrumbs; no current regression found. |
| 31 | Favicon / site identity | Carry forward: approved SVG/favicon/manifest remain; iOS display remains manual. |
| 32 | Language attributes | Carry forward: Arabic RTL and English LTR remain selected by public path. |
| 33 | International SEO | Carry forward: separate Arabic/English paths; human translation review remains manual. |
| 34 | Hreflang | Carry forward: reciprocal `ar`, `en`, and `x-default` alternatives remain covered across fixture pages. |
| 35 | SPA SEO | Carry forward: public SSR uses the application renderer, not bot-specific content; private hashes remain private states. |
| 36 | SSR / SSG | Updated: server-rendered home preload is inserted safely because React 18 omitted JSX `fetchPriority`; tests verify. |
| 37 | Meta tag component | Updated: one metadata helper supplies server/browser metadata and handles same-origin validated cover image URLs. |
| 38 | Dynamic pages | Carry forward: actual course/package DTOs, published-state gates and missing record behavior unchanged. |
| 39 | Pagination | Carry forward: crawlable, bounded page links and page-specific canonical/title behavior remain tested. |
| 40 | Filter / search pages | Carry forward: bounded filters; unknown query variants do not become indexable landing pages. |
| 41 | Duplicate content | Carry forward: language paths and normalized tracking variants remain addressed; live host aliases are manual. |
| 42 | HTML response quality | Refreshed fixture confirms initial metadata/links and responsive image preload; browser hydration had no console errors. |
| 43 | HTTP status codes | Carry forward: valid/missing/unavailable status behavior remains; 7 synthetic status/redirect assertions pass. |
| 44 | HTTPS | **NEEDS MANUAL VERIFICATION**: Lighthouse uses local HTTP fixture; no deployed TLS endpoint exists. |
| 45 | Page speed | Updated: desktop lab result is strong; mobile LCP and image delivery estimates remain open. |
| 46 | Preload / preconnect | Updated: one responsive home hero preload; no broad font or third-party preconnect was added. Verify real waterfall before expanding. |
| 47 | Resource priority | Updated: actual `<link fetchpriority="high">` plus matching `imagesrcset`/`imagesizes` now reaches SSR HTML. |
| 48 | Video SEO | Not applicable: no public video-watch page; protected lesson videos remain behind entitlement and DRM. |
| 49 | Link attributes | Carry forward: no paid-link program; external new-tab protections remain. |
| 50 | Navigation | Carry forward: native public links and private utility navigation unchanged. |
| 51 | Anchor text | Carry forward: visible, descriptive course/package anchor names remain; no keyword stuffing. |
| 52 | Content above the fold | Carry forward: home topic/CTA remain SSR-visible; hero fetch priority fixed. |
| 53 | Carousels / animations | Carry forward: no SEO-critical hidden carousel/text introduced; reduced-motion behavior unchanged. |
| 54 | Client-side routing | Carry forward: public paths load/refresh through SSR; private fragment application behavior unchanged. |
| 55 | Analytics | Not applicable: no analytics package added or found in the public entry. |
| 56 | Google Search Console readiness | **NEEDS MANUAL VERIFICATION**: domain ownership, URL inspection, indexing and sitemap submission need owner access. |
| 57 | Bing / other search engines | Standards paths remain; optional webmaster registration is manual. |
| 58 | Site manifest | Carry forward: brand manifest unchanged; no offline/PWA claim. |
| 59 | Crawl budget | Carry forward: no endless filter URLs. The 50k sitemap boundary requires an index before reaching scale. |
| 60 | Security-related SEO | Updated cover URLs are origin/path/version checked; private API and metadata exclusions remain. |
| 61 | Search snippet quality | Fixture titles/descriptions are unique; actual engine snippets and content quality remain unknown. |
| 62 | Social sharing | **NEEDS MANUAL VERIFICATION**: Facebook/LinkedIn/WhatsApp/X cannot fetch a local fixture. |
| 63 | Project / portfolio SEO | Not applicable: the site is a recorded-course learning platform, not a project portfolio. |
| 64 | Local SEO | Not applicable: no verified physical storefront/address or local business is represented. |
| 65 | Language duplication | Carry forward: distinct translated URLs, self canonicals and hreflang remain. Human translation review remains manual. |
| 66 | Build output | Updated client/server build passes using current locks; large private chunks and one import warning remain. |
| 67 | SEO dependencies | No SEO/head-manager dependency added; Vite/source-map toolchain patch is documented in security follow-up. |
| 68 | SEO testing | Refreshed 34-page crawl, 34 links, 16 view scenarios, metadata/SSR regressions and status checks pass. |
| 69 | Lighthouse / performance testing | Current two synthetic reports are retained; scores are lab-only and not field CWV or ranking evidence. |
| 70 | Final production SEO audit | **NEEDS MANUAL VERIFICATION** until there is an approved HTTPS host, indexing decision, real content, Search Console and field data. |
