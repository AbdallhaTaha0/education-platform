# Ordered SEO audit coverage — 2026-10-06

Read the [final report](seo-audit-20261006.md), [baseline architecture](seo-architecture-20261006.md) and [page inventory](seo-page-inventory-20261006.md). This is an ordered coverage ledger, not a claim that production/search-engine checks ran. Source inspections, candidate repairs and test limitations are distinguished below. S IDs refer to the issue register; R IDs are remaining items.

| Phase | Subject | Inspection, result and limits |
|---|---|---|
| 1 | UNDERSTAND THE WEBSITE | Architecture recorded before edits: React/Vite hash SPA, one Express backend, external DRM, Railway preparation; no confirmed public origin. See architecture report. |
| 2 | PAGE INVENTORY | Every route category inventoried before edits. Public home/catalog/published offers/support; private accounts, finance, learning, IDE and ADMIN; policy placeholders and sign-in utilities excluded. See inventory. |
| 3 | INDEXABILITY | FIXED S01/S04: public HTML now contains content and metadata; default staging noindex remains intentional. Authenticated APIs retain cookie/role/entitlement guards. |
| 4 | ROBOTS.TXT | FIXED S04: generated robots uses production Allow plus API/internal exclusions, or staging Disallow:/; CSS/JS public when indexing enabled. Authentication remains separate. |
| 5 | XML SITEMAP | FIXED S05: live PUBLISHED/nondeleting courses and available packages only, both languages and valid catalog pages; absolute configured HTTPS URLs; no invented lastmod. Scale limit noted R04. |
| 6 | URL STRUCTURE | FIXED S01/S06: /ar and /en public paths; descriptive course slugs, stable existing package IDs, normalized language/trailing slash, clean canonicals for tracking parameters. Domain normalization requires launch verification. |
| 7 | TITLE TAGS | FIXED S02: translated topic-specific static titles and actual course/package names; pagination adds page number. Fixture titles unique across 34 URLs; owner duplicate names still require review. |
| 8 | META DESCRIPTIONS | FIXED S02: meaningful translated descriptions; actual offer title plus actual description distinguish similarly described courses. Fixture descriptions unique; no invented curriculum or keyword stuffing. |
| 9 | CANONICAL TAGS | FIXED S03: self-reference, reciprocal language alternatives, page-2 self-canonical; alternate sizes excluded; private/errors have no canonical. No unrelated home canonical. |
| 10 | HEADING STRUCTURE | Reviewed page hierarchy. One H1 per public fixture response; course names and support/catalog topics are visible. Home section H2 and card H3 preserved. |
| 11 | SEMANTIC HTML | FIXED S07: real anchors for public navigation/cards; native buttons for actions. Existing header/nav/main/footer/article landmarks retained and shared for SSR. |
| 12 | CONTENT QUALITY | Actual secondary-student programming purpose retained. No fake reviews/authors/certificates. ADMIN descriptions and unfinished policy texts require owner review R02; no automated editorial rewrite. |
| 13 | INTERNAL LINKING | FIXED S07: catalog, courses, package members, support, language and pagination paths discoverable with JavaScript disabled. Private lessons stay protected. |
| 14 | BROKEN LINKS | 34 synthetic sitemap URLs and 34 discovered public links return 200; favicon/manifest/images load. Real configured email/telephone and external availability require manual review. |
| 15 | REDIRECTS | FIXED S06: permanent 308 for root, index.html, language casing/trailing slash and course casing. Old public fragment bookmarks upgrade in browser. HTTP/domain redirects need live edge testing. |
| 16 | 404 PAGE | FIXED S06: useful not-found page returns 404 and noindex; missing/unpublished/deleting records excluded; service outage returns 503 rather than a home 200. |
| 17 | IMAGE SEO | Existing responsive 640/1280 WebP hero, explicit dimensions and decorative empty alt preserved; eager/high-priority hero. No public course thumbnail is fabricated. |
| 18 | PERFORMANCE SEO | FIXED S08: private route splitting, compressed HTML/CSS/JS and shared server bootstrap reduce startup work. Remaining font/main-bundle and catalog-scale opportunities R03/R04. |
| 19 | CORE WEB VITALS | LCP hero priority/early HTML improved; mobile lab LCP still requires follow-up. CLS breadcrumb/font wrapping defect S10 fixed and remeasured. TBT is measured; field INP is not claimed. |
| 20 | JAVASCRIPT BUNDLE OPTIMIZATION | FIXED S08: thirteen private route components lazy-loaded; IDE/learning remain lazy. Main entry falls from 572.67 kB baseline to measured final size in performance section. |
| 21 | LAZY LOADING | Protected video/IDE load on their own routes; public hero deliberately eager. No map, public autoplay video or third-party embed to defer. |
| 22 | FONT OPTIMIZATION | Self-hosted WOFF 2, swap and Latin/Arabic subsets already present. Brand families/weights preserved; no indiscriminate preload. Mobile font discovery cost remains R03. |
| 23 | MOBILE SEO | Browser tests: Arabic/English, 390/1440 widths, light/dark; no horizontal overflow or broken hero. Existing safe-area dock and responsive controls retained. Additional physical-device checks manual. |
| 24 | ACCESSIBILITY SEO | FIXED S09: accessible names include visible language labels; native responsive login/logout labels. Landmarks/skip link/form labels/focus/reduced motion retained. Lab accessibility results scoped to public fixtures. |
| 25 | OPEN GRAPH | FIXED S02: server-rendered page title/description/type/site/locale/url/image; image absolute from configured origin and existing asset. |
| 26 | TWITTER / X CARDS | FIXED S02: server-rendered Twitter card/title/description/image; suitable existing hero used. Social-service fetch and crop need real deployed URL. |
| 27 | STRUCTURED DATA | FIXED S11: parseable truthful WebPage/WebSite/Course/BreadcrumbList JSON-LD. No reviews, rating, address, author, fake prices or fabricated SearchAction. |
| 28 | WEBSITE SCHEMA | WebSite on real home templates uses FAYQ and configured origin; no functional site-wide search URL, so no SearchAction. |
| 29 | ORGANIZATION / PERSONAL BRAND SCHEMA | Course provider contains only visible FAYQ Organization name. No invented corporate address/contact entity, Person or LocalBusiness schema. |
| 30 | BREADCRUMBS | FIXED S11/S10: visible catalog/current-page breadcrumbs on course/package; matching structured list. Stable stacked layout avoids font-induced line collapse. |
| 31 | FAVICON / SITE IDENTITY | FIXED S12: existing FayqMark SVG reused as favicon, valid manifest and theme color. PNG/apple touch variants optional R05. |
| 32 | LANGUAGE ATTRIBUTES | FIXED S01: initial HTML and browser state use ar/rtl or en/ltr based on actual path. Preference is language/theme only, never authentication data. |
| 33 | INTERNATIONAL SEO | FIXED S01/S03: separate language URLs and metadata, direct links and self canonicals. Actual course content translations mandatory; quality requires owner review. |
| 34 | HREFLANG | FIXED S03: reciprocal self/alternate ar/en and Arabic x-default tested on all 34 synthetic public URLs. |
| 35 | SPA SEO | FIXED S01: public SSR within existing Express, shared React tree and public DTOs. Private application remains client driven. No bot-only rendering or framework migration. |
| 36 | SSR / SSG | FIXED S01/S10: initial content/head/status verified; same App hydrated for normal public paths, themes restored safely; no browser React/hydration errors in test matrix. |
| 37 | META TAG COMPONENT | FIXED S02: one pageMetadata implementation used by server head renderer and browser updates. Private navigation removes stale canonical/schema. |
| 38 | DYNAMIC PAGES | FIXED S02/S06: published dynamic course/package metadata and missing-record handling. No private course outline in bootstrap, sentinel verified. |
| 39 | PAGINATION | FIXED S03/S07: crawlable page URLs and prev/next anchors; page-2 title/description/canonical retained; out-of-bounds 404. Page sizes 20/50 noindex and no unrelated canonical. |
| 40 | FILTER / SEARCH PAGES | Filters/search remain bounded client controls, not endless indexable URLs. Unknown query variants noindex; tracking uses clean canonical; alternate sizes noindex. |
| 41 | DUPLICATE CONTENT | FIXED S03/S06: language alternatives, tracked URLs, normalized paths and page boundaries handled; no canonical to unrelated content. Live www/HTTP aliases manual. |
| 42 | HTML RESPONSE QUALITY | 34 no-JavaScript public responses have title/description/H1/body/links/schema; browser keeps content and metadata consistent. |
| 43 | HTTP STATUS CODES | 200 valid, 308 permanent, 404 missing/malformed, 503 dependency/renderer outage; authenticated API statuses unchanged. No invented 410 removal policy. |
| 44 | HTTPS | Configured SEO origin requires HTTPS. NEEDS MANUAL VERIFICATION: live certificate, HTTP redirect, preferred host, HSTS and mixed content; no deployment exists. |
| 45 | PAGE SPEED | FIXED S08: seed public React content directly from safe server data, skip redundant initial catalog/offer/package/support fetches; home bootstrap limited to three courses. Catalog still fetches full collection R04. |
| 46 | PRELOAD / PRECONNECT | No new third-party origin is needed. Avoid preloading all ten font files; confirm critical-resource waterfall on real origin before adding selected hints. |
| 47 | RESOURCE PRIORITY | FIXED S08: fetchpriority high and decoding async on actual eager hero; no above-fold lazy penalty. Existing worker/video route behavior unchanged. |
| 48 | VIDEO SEO | Protected recorded lessons/captions/materials belong to authorized learning flow. NOT APPLICABLE to public VideoObject indexing: no public watch page or open video. DRM never modified. |
| 49 | LINK ATTRIBUTES | No paid/UGC link program in public content. Existing external new-tab links reviewed for noopener/noreferrer; support mail/tel are normal native links. No blanket nofollow added. |
| 50 | NAVIGATION | FIXED S07: header, dock, footer, cards, language, course breadcrumbs and package-member discovery use anchor href paths; actions remain buttons. |
| 51 | ANCHOR TEXT | Course anchors retain visible offer label and add real course title to accessible name; package member titles are descriptive native anchors. No keyword stuffing. |
| 52 | CONTENT ABOVE THE FOLD | Home topic and CTA present in initial HTML; public offers visible immediately. Existing hero/brand copy preserved; no artificial loading screen for public seed. |
| 53 | CAROUSELS / ANIMATIONS | Existing reduced-motion handling and DOM-present home content retained. No crawl-critical carousel/hidden-text hack introduced. |
| 54 | CLIENT-SIDE ROUTING | FIXED S01/S06: public direct load/refresh through Express renderer; private fragments stay functional; bare unknown paths return real 404. |
| 55 | ANALYTICS | NOT APPLICABLE — no analytics/tracking package found in public entry or build. No analytics added; future consent/metrics choices remain owner decisions. |
| 56 | GOOGLE SEARCH CONSOLE READINESS | Sitemap/robots/canonical/HTML gates locally ready. NEEDS MANUAL VERIFICATION: configure domain, deploy approved images, URL Inspection rendered HTML, submit sitemap and inspect coverage. |
| 57 | BING / OTHER SEARCH ENGINES | Standards-based paths, HTML, robots, sitemap and schema; no engine-specific cloaking/hacks. Bing Webmaster Tools submission remains manual if chosen. |
| 58 | SITE MANIFEST | FIXED S12: browser-display manifest uses FAYQ, /ar start path, real SVG icon and brand colors; not a claim of offline/PWA installability. |
| 59 | CRAWL BUDGET | No infinite filter URL generation. Dynamic sitemap reflects public records; no small-site crawl-budget hacks. Catalog beyond 50 kURLs requires index R04. |
| 60 | SECURITY-RELATED SEO | Safe JSON escapes script terminators, Host cannot poison configured canonicals, API alias to internal renderer blocked, private DTO sentinel excluded; frame restrictions preserved. Live compromise/history cannot be inferred. |
| 61 | SEARCH SNIPPET QUALITY | Titles/descriptions make sense alone, favicon/site name set. Actual search snippets are search-engine choices; Search Console evidence/manual owner content review required. |
| 62 | SOCIAL SHARING | Server HTML has OG/Twitter without JS. NEEDS MANUAL VERIFICATION: Facebook debugger, LinkedIn inspector, real WhatsApp/X link after launch; check absolute image 200 and crop. |
| 63 | PROJECT / PORTFOLIO SEO | NOT APPLICABLE — recorded-course learning platform, no developer portfolio/project pages. No thin portfolio pages created. |
| 64 | LOCAL SEO | NOT APPLICABLE — no confirmed physical storefront/address or location-based service. No invented local-business listing/schema. |
| 65 | CONTENT DUPLICATION BETWEEN LANGUAGES | FIXED S03: actual translations treated as language alternatives, self canonicals plus reciprocal hreflang. Human translation quality remains manual. |
| 66 | BUILD OUTPUT | Docker browser/runtime/SSR production builds pass; hashed static assets, private SSR bundle, no browser source maps expected by config. Matching server/client release required. |
| 67 | SEO DEPENDENCIES | No SEO/head-manager dependency installed; ReactDOM SSR already exists. No conflicting head library, no new lockfile dependency change. |
| 68 | SEO TESTING | 18 metadata regressions, 28 actual-SSR unit checks, 3 real-PG publication checks plus browser crawler/status/image/language/privacy tests; arbitrary title lengths not tested. |
| 69 | LIGHTHOUSE / PERFORMANCE TESTING | Lighthouse 13.5.0 in Docker with system Chromium, mobile simulated throttling; representative pages measured sequentially. Lab data cannot certify p75 field CWV/INP or ranking. |
| 70 | FINAL PRODUCTION SEO AUDIT | Final source/local gates summarized below. NEEDS MANUAL VERIFICATION for production origin, HTTPS, indexing switch, Search Console, rich-results eligibility, social fetches and real-user performance. |
