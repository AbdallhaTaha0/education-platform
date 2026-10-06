# SEO architecture baseline — 2026-10-06

Phase 1 completed before implementation changes. React 18/TypeScript, Vite 6 and Tailwind 3 produce a client-rendered SPA served by unprivileged Nginx. A custom window.location.hash router exposes roughly 30 route categories. One Express backend serves same-origin /api JSON through Nginx; PostgreSQL/Prisma owns platform content. ADMIN acts as the course/support CMS. DRM remains an independent protected external API; no SEO work accesses its persistence.

Public content: landing, catalog, published course offers, published package offers and help/support. Login/register are utilities; terms/privacy/refunds remain unadopted policy placeholders. Accounts, wallet, purchase receipts, notifications, ADMIN, assessments, practice and learning are private/utility flows. There are no blog, portfolio, local-business or article routes. Arabic is default, English secondary; one browser language toggle currently changes the same hash URL.

Initial HTML contains static home metadata and an empty #root. Route titles change after JavaScript, but descriptions/social values remain static; dynamic offers share generic titles. No canonical, sitemap, robots, favicon/manifest or JSON-LD implementation was found. Hash fragments identify public pages; card navigation uses buttons. Unknown pathname requests receive the same 200 SPA fallback.

Existing strengths: real bilingual course translations, protected lesson outlines, semantic main/header/footer and skip link, self-hosted swap fonts, responsive WebP hero variants, lazy learning/IDE/assessment chunks, reduced-motion styles, cookie authentication and security headers. No SEO/head-manager or analytics dependency is present.

Hosting preparation targets Railway TLS ingress and Nginx routing; there is no production/staging deployment or confirmed domain. Production canonicalization, field Core Web Vitals, Search Console and social cache inspection require owner deployment/access. No public domain will be fabricated.

Priority: crawlable language-specific public paths with legacy hash compatibility; meaningful initial public HTML and unique metadata/statuses; truthful structured data and origin-gated sitemap/robots; link/pagination discovery and bundle review; verify existing visual/functional behavior in isolated Docker. Preserve one Express application, existing UI, private learning data and external DRM boundary.

## Implemented result

Public /ar and /en documents now use a bundled shared React App inside the existing Express application, with normal public-path hydration and public DTO bootstrap. Authenticated/private states remain the cookie-protected application. The local and Railway edges proxy HTML/robots/sitemap to this internal module and serve browser assets separately. See the [final report](seo-audit-20261006.md) for origin/indexing controls, verification, remaining limits and rollback. No new backend service, database migration, SEO package or nested DRM change.
