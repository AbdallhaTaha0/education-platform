# SEO issue register — 2026-10-06

S01–S12 describe verified baseline/candidate problems repaired locally. R01–R05 remain open or optional. No ranking or production certification is implied. Each entry contains the requested nine details.

## S01 — Public course URLs depended on fragments and empty SPA HTML

**1. Issue:** Public course URLs depended on fragments and empty SPA HTML

**2. Severity:** CRITICAL

**3. Affected file/page:** client/src/routes.ts, main.tsx; server/src/modules/seo; Nginx configs; SSR entry

**4. Current/baseline behavior:** Baseline public course/language views shared / and # fragments; HTML root empty.

**5. Why it affects SEO:** Separate public offers could not be discovered reliably as independent documents; most public content depended on JS.

**6. Recommended fix:** Give public content normal URLs and initial HTML while retaining the existing backend.

**7. Exact code/configuration change:** Added /ar and /en public paths; shared React SSR within Express; same App hydrates; private views retain fragments.

**8. Expected result:** Public content and metadata available before JS; no bot-specific output.

**9. How to verify:** 28 actual-SSR tests; no-JS crawl of 34 synthetic URLs; browser template checks.

## S02 — Static home metadata and generic dynamic titles

**1. Issue:** Static home metadata and generic dynamic titles

**2. Severity:** HIGH

**3. Affected file/page:** client/src/seo/metadata.ts, entry-server.tsx, App.tsx

**4. Current/baseline behavior:** Baseline shell used one home description/social profile and generic offer titles.

**5. Why it affects SEO:** Poor topic signals and indistinguishable previews.

**6. Recommended fix:** Centralize translated per-page metadata using actual content.

**7. Exact code/configuration change:** Static topic copy; actual offer title + description; page-number suffixes; OG/Twitter from configured origin; stale private tags removed.

**8. Expected result:** Meaningful titles, descriptions and previews for each public document.

**9. How to verify:** Metadata unit tests and crawl uniqueness checks; owner content still needs human review.

## S03 — Missing canonical/language alternatives and JS-only pagination

**1. Issue:** Missing canonical/language alternatives and JS-only pagination

**2. Severity:** HIGH

**3. Affected file/page:** metadata.ts; Pagination.tsx; seo/router.ts

**4. Current/baseline behavior:** No canonical/hreflang; language toggle and pagination had no independent crawlable URL.

**5. Why it affects SEO:** Duplicate variants and English discoverability risk.

**6. Recommended fix:** Self canonicals, reciprocal language alternatives and bounded real pagination.

**7. Exact code/configuration change:** ar/en/x-default; page-N self-reference; size 20/50 noindex without canonical; unknown queries noindex; clean tracking canonical.

**8. Expected result:** Useful pages remain distinct; variants and languages are identified accurately.

**9. How to verify:** 34 reciprocal pairs; page 2 browser check; bounds 404 and page-size regression.

## S04 — Missing discovery/indexing configuration and private noindex

**1. Issue:** Missing discovery/indexing configuration and private noindex

**2. Severity:** HIGH

**3. Affected file/page:** seo/config.ts; seo/router.ts; server/src/app.ts; .env.example

**4. Current/baseline behavior:** No robots file or deliberate indexing policy.

**5. Why it affects SEO:** Unlaunched staging/private utility content could acquire search visibility; an origin could be guessed incorrectly.

**6. Recommended fix:** Explicit validated origin and indexing configuration, private API noindex, guarded public DTOs.

**7. Exact code/configuration change:** HTTPS-origin validation; indexingfalse by default; stage Disallow:/; public allow/resources and API exclusions on approved launch; noindex errors/private browser states.

**8. Expected result:** A controlled launch gate and no private content exposed by SSR.

**9. How to verify:** Config/noindex tests, safe-DTO sentinel, private-navigation browser test; launch steps remain manual.

## S05 — No XML sitemap

**1. Issue:** No XML sitemap

**2. Severity:** HIGH

**3. Affected file/page:** server/src/modules/seo/router.ts

**4. Current/baseline behavior:** No public URL inventory for search engines.

**5. Why it affects SEO:** Published offers lacked a reliable discovery feed.

**6. Recommended fix:** Generate canonical public-only sitemap from existing platform persistence.

**7. Exact code/configuration change:** PUBLISHED/nondeleting course slugs, available packages, languages, valid catalog pages; configured absolute origin; no fake lastmod;503 while disabled.

**8. Expected result:** Current public catalog discoverable; draft/deleting/private content excluded.

**9. How to verify:** Real-PG publication tests and sitemap crawler; launch submit/manual validation.

## S06 — Unknown paths returned generic home 200

**1. Issue:** Unknown paths returned generic home 200

**2. Severity:** HIGH

**3. Affected file/page:** routes.ts; seo/router.ts; local/Railway Nginx

**4. Current/baseline behavior:** Static SPA fallback gave nonexistent documents home HTML 200.

**5. Why it affects SEO:** Soft 404s and URL duplication.

**6. Recommended fix:** Return real statuses and permanent normalizations.

**7. Exact code/configuration change:** Missing/unpublished/malformed 404; failure 503; root/index/case/slash 308; utility hashes preserved.

**8. Expected result:** Search engines distinguish missing content and stable preferred paths.

**9. How to verify:** Status test matrix through both Nginx configurations.

## S07 — Public discovery relied on buttons/fragments

**1. Issue:** Public discovery relied on buttons/fragments

**2. Severity:** HIGH

**3. Affected file/page:** Header/Footer, PublicCatalogPage, HomePage, OfferPage, PackagePage, Pagination

**4. Current/baseline behavior:** Course card navigation buttons; public fragments and no package-member discovery anchors.

**5. Why it affects SEO:** Bots and users without JS could not follow useful paths.

**6. Recommended fix:** Use normal anchors for navigation and keep actions as buttons.

**7. Exact code/configuration change:** Real public links, descriptive course names, member links only when published, native language links and pagination.

**8. Expected result:** Discoverable offers and bilingual navigation without exposing protected lessons.

**9. How to verify:** No-JS crawl:34 discovered public links 200; keyboard/native-link behavior reviewed.

## S08 — Large initial bundle and redundant public API loading

**1. Issue:** Large initial bundle and redundant public API loading

**2. Severity:** MEDIUM

**3. Affected file/page:** App.tsx; publicData.tsx; public hooks/pages; all Nginx configs

**4. Current/baseline behavior:** 572.67 kB initial entry; public content fetched after browser startup; no response compression.

**5. Why it affects SEO:** More startup work and longer meaningful-content delay.

**6. Recommended fix:** Split heavy private routes and reuse safe server content; compress text/static assets.

**7. Exact code/configuration change:** Thirteen private route imports lazy; seed catalog/offers/packages/support; three-course home seed; HTML/CSS/JS gzip; eager high-priority WebP hero.

**8. Expected result:** Smaller entry and fewer public API waterfalls.

**9. How to verify:** Docker output sizes, network/browser checks and Lighthouse; no baseline Lighthouse gain claimed.

## S09 — Header names differed from visible labels

**1. Issue:** Header names differed from visible labels

**2. Severity:** MEDIUM

**3. Affected file/page:** client/src/components/layout/Header.tsx

**4. Current/baseline behavior:** Arabic login abbreviation and EN switch label were not included in accessible names.

**5. Why it affects SEO:** Speech/assistive navigation could target a name different from the screen.

**6. Recommended fix:** Let native login/logout text name the link; include visible language text.

**7. Exact code/configuration change:** Removed redundant login/logout aria-label; EN/ع prefix on language labels, preserving native lang/hreflang and visual layout.

**8. Expected result:** Visible and accessible names agree.

**9. How to verify:** Lighthouse label-content-name-mismatch nowpasses; keyboard/manual devices remain to verify.

## S10 — Course breadcrumb moved after font load; browser remounted initial HTML

**1. Issue:** Course breadcrumb moved after font load; browser remounted initial HTML

**2. Severity:** MEDIUM

**3. Affected file/page:** OfferPage, PackagePage, main.tsx, App.tsx, theme.tsx, entry-server.tsx

**4. Current/baseline behavior:** Candidate course CLS 0.312; breadcrumb shifted from two lines to one after Inter loaded. Public HTML initially replaced by createRoot.

**5. Why it affects SEO:** Visible movement disrupts reading and contributes to poor CLS.

**6. Recommended fix:** Stabilize breadcrumb rows and hydrate the same server/browser tree.

**7. Exact code/configuration change:** Stacked catalog/current breadcrumb; same App SSR/hydration; deterministic language/dark initial state with saved theme restored after hydration.

**8. Expected result:** Stable content while fonts and browser behavior initialize.

**9. How to verify:** Course lab CLS 0.053 after repair vs 0.312 candidate; Arabic/English/light/dark browser errors checked.

## S11 — No truthful structured data or visible breadcrumb hierarchy

**1. Issue:** No truthful structured data or visible breadcrumb hierarchy

**2. Severity:** MEDIUM

**3. Affected file/page:** metadata.ts; OfferPage; PackagePage

**4. Current/baseline behavior:** No schema; flat back action without structured hierarchy.

**5. Why it affects SEO:** Course/topic relationship harder to interpret.

**6. Recommended fix:** Add only visible facts and matching breadcrumbs.

**7. Exact code/configuration change:** WebPage, home WebSite, actual Course with visible FAYQ provider name, BreadcrumbList; no SearchAction/reviews/addresses/ratings.

**8. Expected result:** Machine-readable description consistent with visible content.

**9. How to verify:** All JSON-LD parses; safeJson and actual-SSR regressions; external validators/manual eligibility.

## S12 — Missing favicon/manifest identity

**1. Issue:** Missing favicon/manifest identity

**2. Severity:** LOW

**3. Affected file/page:** client/public/favicon.svg, site.webmanifest; index.html

**4. Current/baseline behavior:** No configured icon/manifest/theme-color.

**5. Why it affects SEO:** Weak browser/share/bookmark identity.

**6. Recommended fix:** Reuse approved logo and brand tokens.

**7. Exact code/configuration change:** Existing FayqMark geometry as SVG icon; FAYQ browser-display manifest and theme color; no new art or PWA promise.

**8. Expected result:** Consistent site identity on supported browsers.

**9. How to verify:** Icon/manifest 200 through both edges; iOS/PNG fallback is optionalR 05.

## R01 — Production/search-engine readiness unverified

**1. Issue:** Production/search-engine readiness unverified

**2. Severity:** HIGH

**3. Affected file/page:** Deployment environment, DNS/TLS and Search Console

**4. Current/baseline behavior:** No production deployment/domain exists; default indexing deliberatelydisabled.

**5. Why it affects SEO:** No production crawl/index claim can be established.

**6. Recommended fix:** Complete launch checks after owner selects/deploys a real HTTPS origin.

**7. Exact code/configuration change:** No deployment performed; .env.example documents SEO_PUBLIC_ORIGIN and SEO_INDEXING_ENABLED. Set server variables only on approved public release.

**8. Expected result:** Preferred host, HTTPS and index controls proven on real site.

**9. How to verify:** Manual steps below; source validation rejects enabling indexing without HTTPS origin.

## R02 — Actual editorial and translation quality requires review

**1. Issue:** Actual editorial and translation quality requires review

**2. Severity:** MEDIUM

**3. Affected file/page:** ADMIN-authored public course/package titles/descriptions; policy placeholders

**4. Current/baseline behavior:** Source enforces translations; fixture uses synthetic text; actual content length/uniqueness and adopted policies unknown.

**5. Why it affects SEO:** Thin/repeated or inaccurate copy can reduce search usefulness.

**6. Recommended fix:** Owner reviews descriptions against actual curriculum, audience and access terms; writes policies before adoption.

**7. Exact code/configuration change:** No fake course curriculum, authors/reviews or adopted policy inserted. Existing placeholders remain noindex.

**8. Expected result:** Useful accurate bilingual landing content.

**9. How to verify:** Review every real published record; compare translated meaning and duplicate titles/descriptions; re-crawl deployed inventory.

## R03 — Mobile LCP and remaining font/entry cost

**1. Issue:** Mobile LCP and remaining font/entry cost

**2. Severity:** MEDIUM

**3. Affected file/page:** main.tsx fonts; public entry assets; deployment performance

**4. Current/baseline behavior:** Final local mobile home/catalog LCP around 3s; ten font weight files defined; one shared public/application entry retains unused code.

**5. Why it affects SEO:** Slower content on constrained phones; lab improvement does not establish field CWV.

**6. Recommended fix:** Profile real traffic/devices; consider measured critical font hints/fallback metrics and bounded further splitting.

**7. Exact code/configuration change:** Implemented lazy private routes, SSR/hydration, gzip, hero priority and stable breadcrumb; no speculative removal of brand fonts.

**8. Expected result:** Lower render delay without dropping user functionality.

**9. How to verify:** Repeat deployed PageSpeed/DevTools waterfall; evaluate p75 LCP/INP/CLS when field data exists. TBT is not INP.

## R04 — Catalog/sitemap scale boundaries

**1. Issue:** Catalog/sitemap scale boundaries

**2. Severity:** OPPORTUNITY

**3. Affected file/page:** seo/router.ts; existing listPublishedCourses/listPackages

**4. Current/baseline behavior:** Catalog DTO still loads all published courses and existing 100 package window; sitemap refuses more than 50 kURLs. No such production size is evidenced.

**5. Why it affects SEO:** Large future catalogs could increase TTFB/JSON or require multiple sitemaps.

**6. Recommended fix:** At demonstrated scale add bounded server pagination/filter metadata and sitemap index; preserve API/publication contracts.

**7. Exact code/configuration change:** Current guard returns 503 rather than invalid oversized sitemap; no invented index URLs. No schema migration.

**8. Expected result:** Predictable growth without invalid discovery feeds.

**9. How to verify:** Load realistic catalog fixtures and enforce 50 kURL/50 MB sitemap constraints before expanding catalog.

## R05 — Optional icon/share-image variants

**1. Issue:** Optional icon/share-image variants

**2. Severity:** LOW

**3. Affected file/page:** client/public; metadata.ts existing hero image

**4. Current/baseline behavior:** SVG icon supported; no PNG/apple touch icon; social image reuses real 1280x720 hero for all topics.

**5. Why it affects SEO:** Some clients may crop or use a generic icon.

**6. Recommended fix:** Create reviewed raster variants from existing identity only if required by target devices; consider real course artwork when supplied.

**7. Exact code/configuration change:** Current SVG, manifest and absolute real hero delivered; no fake course thumbnails created.

**8. Expected result:** Improved device-specific identity/share crop.

**9. How to verify:** Physical iOS test and deployed Facebook/LinkedIn/WhatsApp/X previews.
