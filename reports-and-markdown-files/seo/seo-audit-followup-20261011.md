# Technical SEO and frontend performance follow-up — 2026-10-11

This current-source follow-up extends the [complete 70-phase SEO review](seo-audit-20261006.md), its [phase ledger](seo-phase-ledger-20261006.md), [page inventory](seo-page-inventory-20261006.md), and [issue register](seo-issue-register-20261006.md). It records the responsive hero-priority defect, social-image coverage for current course covers, refreshed package/build results, and a fresh synthetic browser/Lighthouse run. No production deployment, Search Console access, or ranking claim is implied.

## Overall SEO condition

**Needs improvement.** Public Arabic/English pages, source-rendered content, metadata, sitemap, canonicals, hreflang, status codes and private-route exclusion are locally verified. The updated build now emits a browser-recognized preload for the actual responsive homepage hero. Mobile Lighthouse scores 92 for performance, but simulated mobile LCP is **2.9 seconds**, above Google's 2.5-second “good” threshold. Desktop performance is 100 with 0.7-second LCP. There is no real origin, Search Console property or field CrUX sample to verify indexing or Core Web Vitals.

## Findings and changes

### Responsive homepage hero priority

React 18 server rendering silently omitted the JSX `fetchPriority` attribute on the hero image. As a result, the eager hero had no corresponding high-priority hint in the initial HTML even though the image component requested priority. The server head renderer now inserts a properly escaped `<link rel="preload" as="image">` with the same responsive `href`, `imagesrcset` and `imagesizes` as the home hero. It is home-only; founder-story images remain lazy. SSR tests assert the link is emitted for the home route and absent from non-home pages.

### Social image and course-cover selection

The shared metadata helper now uses the founders hero as the default Open Graph/Twitter image. A course social image is selected only when its input is a same-origin, exact course-cover URL, the route course ID matches the page's course ID, and the version is a valid UUID; it is rewritten through the public `/api/catalog/courses/:id/cover` endpoint. External, mismatched, malformed, draft or unsafe cover URLs fall back to the existing founders hero. No remote image or new face/artwork was generated.

### Browser audit correctness

The previous browser checker could call below-fold `loading="lazy"` images broken before the browser requested them. It now records that lazy images exist, switches them to eager for the final image check, waits for decode, and reports only actual failures. The refreshed crawl reports zero broken images.

### Dependency and build result

Client and server locks use compatible Vite 6.4.4 and a patched `source-map-js` 1.2.2 override. The client production build and SSR bundle succeed. Vite still warns that `AdminSummaryPage` is both statically and dynamically imported; large learning/IDE bundles are private, on-demand route chunks rather than public initial-render code. This is a maintainability/build-splitting follow-up, not evidence of a public LCP regression.

## Current local verification

| Check | Result |
|---|---|
| Synthetic sitemap crawl | 34 unique public URLs; 34 crawlable links; all discovered fixture pages return expected public status |
| Browser matrix | 16 Arabic/English × desktop/mobile × light/dark scenarios; no horizontal overflow, console errors or broken images |
| Responsive image behavior | Home preload `href`/`srcset`/`sizes` matches the hero; lazy founder images remain lazy in page markup |
| Metadata/SSR | Page-specific titles/descriptions, canonical/hreflang and social metadata remain server rendered; regression tests cover default and course-cover image choices |
| Mobile Lighthouse (synthetic Arabic home) | Performance 92, Accessibility 100, Best Practices 74, SEO 100; LCP 2.9 s, CLS 0.008, TBT 0 ms |
| Desktop Lighthouse (synthetic Arabic home) | Performance 100, Accessibility 100, Best Practices 74, SEO 100; LCP 0.7 s, CLS 0.005, TBT 0 ms |
| Build and tests | Client production build, SSR build, client test suite and server metadata tests passed |

Lighthouse 13.5.0 ran in Docker against the synthetic local edge using system Chromium and default simulated mobile throttling. The Best Practices score of 74 is caused by the fixture using local HTTP and the expected anonymous `401` responses from `/api/auth/me` and `/api/features`; it is not a measurement of an HTTPS production origin. Mobile lab measurements do not equal field p75 metrics.

The mobile image-delivery audit estimates **213 KiB** of possible savings across the current 1280-pixel founder images. Treat this as a follow-up candidate: the current responsive `srcset` includes 640/1280 widths (plus 1920 for the hero), and browser device-pixel ratio affects the selected source. Measure the selected candidate at actual mobile sizes before adding an intermediate derivative. Do not lower image quality or misstate `sizes` to improve a synthetic score. Mobile LCP remains the main measured opportunity.

Ignored evidence is in `docker/browser/evidence/seo-audit-20261011/` (`browser-audit-local.json`, Lighthouse JSON/HTML and screenshots). The synthetic fixture contains no real customer content or production configuration.

## Severity and remaining work

| Priority | Item | State |
|---|---|---|
| Critical | Public content missing from initial HTML / unbounded private exposure | No current critical issue established; prior SSR and privacy fixes remain verified. |
| High | HTTPS origin, indexing switch, canonical-host redirects, Search Console and social-preview fetchability | **NEEDS MANUAL VERIFICATION**; there is no production domain or Search Console session. |
| Medium | Mobile LCP at 2.9 s and Lighthouse-estimated 213 KiB image savings | Open performance follow-up; inspect responsive candidate selection and font/image waterfall on real device/origin. |
| Medium | Editorial accuracy/quality and duplicate owner-authored course/package names | Needs owner review of real published content; automated tooling does not invent curriculum or translations. |
| Low | `AdminSummaryPage` mixed static/dynamic import warning; optional raster/app-icon/share variants | Clean up only with a bounded build change and owner-approved assets. |

## Manual verification required

**NEEDS MANUAL VERIFICATION — there is no production host.** Before indexing a future release, choose and verify its HTTPS origin; confirm TLS, preferred host redirects, HSTS and mixed content; inspect raw and rendered `/ar`, `/en`, catalog, page two, actual course/package/support, missing page, robots and sitemap responses. Confirm title/description, canonical, reciprocal hreflang, status, image response and structured data at the live edge. Keep staging noindex. Then verify the production property in Google Search Console, inspect representative URLs, submit the sitemap and review coverage. Validate structured data with current search-engine tools; test Facebook/LinkedIn/WhatsApp/X preview fetch and crop; inspect support contacts and human translation quality. Check p75 LCP/INP/CLS from field data when available and complete physical mobile, keyboard and screen-reader checks. Local fixture results do not establish search ranking or production performance.

## Files changed

- Homepage and metadata: `client/src/features/home/pages/HomePage.tsx`, `client/src/seo/entry-server.tsx`, `client/src/seo/metadata.ts`.
- Regression checks: `client/src/seo/metadata.test.ts`, `server/tests/unit/seo-public.test.ts`.
- Browser audit: `docker/seo/browser-audit.mjs`.
- Build dependencies/locks: `client/package.json`, `client/package-lock.json`, `server/package.json`, `server/package-lock.json`.
- Test harness fixes needed to keep full Docker suites meaningful: server integration tests for free-plan prices and M10 heartbeat ordering, the dedicated lesson-material test setup, and the caption migration runner's failure diagnostics.

The complete earlier technical SEO analysis and its 70 phases remain in the linked 2026-10-06 records. This follow-up does not deploy or enable search indexing.
