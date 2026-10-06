# SEO page inventory — baseline, 2026-10-06

All routes initially share pathname /, static Arabic home description/social tags, no canonical or schema, and a JavaScript title. The language toggle has no separate URLs. Initial response body has zero content words/headings/links; rendered content is API-backed. The table inventories every route category; published record counts and exact content lengths vary with ADMIN content and will be measured in an isolated fixture, not inferred from production.

| Existing hash | Purpose/topic/audience | Classification | Primary heading and content | Links/images/duplication |
|---|---|---|---|---|
| #/ | Recorded programming, secondary students | INDEX | One bilingual hero H1; steps, FAQ, catalog | Header/footer/catalog; responsive WebP hero; shared shell metadata |
| #/courses | Discover monthly/revision courses | INDEX | Catalog H1, filters, course/package cards | Card course navigation is button-only; pagination buttons; no content images |
| #/courses/:slug | Published course offer | INDEX | Translated course title H1 and description, real EGP/access terms | Back button; purchase/owned learning links; same generic catalog title |
| #/package/:id | Published three-course package | INDEX when available | Translated package title/description/member summaries and deadline | Catalog/member/purchase links; generic purchase title; UUID is stable |
| #/support | Help and configured support contacts | INDEX | Support H1 and real help sections | Contacts loaded by API; account help links; generic home title |
| #/terms, #/privacy, #/refunds | Unadopted policy placeholders | NOINDEX / UTILITY | One localized H1 and explicit pending-adoption notice | Help/footer links; thin placeholder content |
| #/login, #/register | Account entry/creation | NOINDEX / UTILITY | Localized form H1 and labelled inputs | Account/navigation links; no public search value |
| #/account, #/account/profile | Personal account | PRIVATE / AUTHENTICATED | Account headings, personal settings | Cookie/session protected; no indexing |
| #/wallet, #/wallet/recharge | Manual EGP funding | PRIVATE / AUTHENTICATED | Wallet/recharge headings and instructions | Payment details/forms; no indexing |
| #/purchases, #/purchase/:id | Receipts/purchase action | PRIVATE / UTILITY | Purchase history/review | Financial/account-dependent; no indexing |
| #/dashboard, #/notifications | Student learning/inbox | PRIVATE / AUTHENTICATED | Dashboard/inbox headings | Entitlement/recipient-specific |
| #/learn/:slug | Protected video/materials | PRIVATE / AUTHENTICATED | Course/lesson workspace | Outlines require subscription; never expose to SEO |
| #/practice, #/assessment/:id | Private execution/grading | PRIVATE / AUTHENTICATED | IDE/assessment workspace | No SEO content, protected APIs |
| #/admin; #/admin/catalog; #/admin/courses/:id; #/admin/packages; #/admin/summary; #/admin/recharge; #/admin/practice; #/admin/students; #/admin/policies; #/admin/support | Administration | PRIVATE / AUTHENTICATED | Localized ADMIN headings/workspaces | ADMIN APIs guarded; no indexing |
| Unknown hash/path | Missing page | ERROR PAGE / NOINDEX | Hash renders useful missing-page H1 | Path fallback wrongly returns home 200 |

No article/blog/contact-form/portfolio/location pages are implemented. Support is the actual public contact page; no location, review, author or business entity data is fabricated. Planned canonical public paths use /ar and /en language variants; legacy private/hash behavior remains compatible.

## Final implemented public inventory

Actual production record counts/content are unknown. Both /ar and /en expose home, catalog (?page=N at size10), PUBLISHED course /courses/:slug, available package /package/:id and support. All use translated topic/title, actual offer title + description, one visible H1, self canonical, OG/Twitter, WebPage; home adds WebSite, course adds Course and breadcrumb, package adds breadcrumb. Public navigation links are native; hero only on home. Policy/login utilities remain noindex; private account/financial/learning/ADMIN/IDE routes remain protected fragments. Unavailable published packages show availability with noindex; missing/draft/deleting course routes404.

The following is explicitly synthetic verification, not published business content. Full metadata/H1/canonical/hreflang/schema/links/character counts are retained in docker/browser/evidence/seo-audit-20261006/browser-audit-railway.json. All34 titles/descriptions are unique in that fixture. No arbitrary content-length threshold is imposed. Actual editorial duplicates require owner review.

| Synthetic URL path | Title / visible H1 | Body characters including navigation | Schema | Image usage | Duplication risk |
|---|---|---:|---|---|---|
| /ar | تعلم البرمجة لطلاب المرحلة الثانوية / FAYQ / افهم الفكرة.اكتب الكود.ابنِ حاجة ليك. | 1879 | WebPage, WebSite | Responsive decorative WebP hero | Canonical/hreflang verified; actual owner text review needed |
| /ar/courses | دورات البرمجة والمراجعات والباقات / FAYQ / الدورات البرمجية المسجلة | 2392 | WebPage | No content bitmap | Canonical/hreflang verified; actual owner text review needed |
| /ar/support | المساعدة والدعم / FAYQ / المساعدة والدعم | 742 | WebPage | No content bitmap | Canonical/hreflang verified; actual owner text review needed |
| /ar/courses/javascript-1 | أساسيات البرمجة 1 / FAYQ / أساسيات البرمجة 1 | 375 | WebPage, Course, BreadcrumbList | No content bitmap | Canonical/hreflang verified; actual owner text review needed |
| /ar/courses/javascript-2 | أساسيات البرمجة 2 / FAYQ / أساسيات البرمجة 2 | 375 | WebPage, Course, BreadcrumbList | No content bitmap | Canonical/hreflang verified; actual owner text review needed |
| /ar/courses/javascript-3 | أساسيات البرمجة 3 / FAYQ / أساسيات البرمجة 3 | 375 | WebPage, Course, BreadcrumbList | No content bitmap | Canonical/hreflang verified; actual owner text review needed |
| /ar/courses/javascript-4 | أساسيات البرمجة 4 / FAYQ / أساسيات البرمجة 4 | 375 | WebPage, Course, BreadcrumbList | No content bitmap | Canonical/hreflang verified; actual owner text review needed |
| /ar/courses/javascript-5 | أساسيات البرمجة 5 / FAYQ / أساسيات البرمجة 5 | 375 | WebPage, Course, BreadcrumbList | No content bitmap | Canonical/hreflang verified; actual owner text review needed |
| /ar/courses/javascript-6 | أساسيات البرمجة 6 / FAYQ / أساسيات البرمجة 6 | 375 | WebPage, Course, BreadcrumbList | No content bitmap | Canonical/hreflang verified; actual owner text review needed |
| /ar/courses/javascript-7 | أساسيات البرمجة 7 / FAYQ / أساسيات البرمجة 7 | 375 | WebPage, Course, BreadcrumbList | No content bitmap | Canonical/hreflang verified; actual owner text review needed |
| /ar/courses/javascript-8 | أساسيات البرمجة 8 / FAYQ / أساسيات البرمجة 8 | 375 | WebPage, Course, BreadcrumbList | No content bitmap | Canonical/hreflang verified; actual owner text review needed |
| /ar/courses/javascript-9 | أساسيات البرمجة 9 / FAYQ / أساسيات البرمجة 9 | 375 | WebPage, Course, BreadcrumbList | No content bitmap | Canonical/hreflang verified; actual owner text review needed |
| /ar/courses/javascript-10 | أساسيات البرمجة 10 / FAYQ / أساسيات البرمجة 10 | 377 | WebPage, Course, BreadcrumbList | No content bitmap | Canonical/hreflang verified; actual owner text review needed |
| /ar/courses/javascript-11 | أساسيات البرمجة 11 / FAYQ / أساسيات البرمجة 11 | 377 | WebPage, Course, BreadcrumbList | No content bitmap | Canonical/hreflang verified; actual owner text review needed |
| /ar/courses/javascript-12 | أساسيات البرمجة 12 / FAYQ / أساسيات البرمجة 12 | 377 | WebPage, Course, BreadcrumbList | No content bitmap | Canonical/hreflang verified; actual owner text review needed |
| /ar/package/30000000-0000-4000-8000-000000000001 | باقة كورسات البرمجة / FAYQ / باقة كورسات البرمجة | 467 | WebPage, BreadcrumbList | No content bitmap | Canonical/hreflang verified; actual owner text review needed |
| /ar/courses?page=2 | دورات البرمجة والمراجعات والباقات / FAYQ — صفحة 2 / الدورات البرمجية المسجلة | 1210 | WebPage | No content bitmap | Canonical/hreflang verified; actual owner text review needed |
| /en | Programming courses for secondary students / FAYQ / Understand it.Code it.Build something yours. | 2493 | WebPage, WebSite | Responsive decorative WebP hero | Canonical/hreflang verified; actual owner text review needed |
| /en/courses | Programming courses, revisions and packages / FAYQ / Recorded programming courses | 3001 | WebPage | No content bitmap | Canonical/hreflang verified; actual owner text review needed |
| /en/support | Help and support / FAYQ / Help and support | 849 | WebPage | No content bitmap | Canonical/hreflang verified; actual owner text review needed |
| /en/courses/javascript-1 | Programming fundamentals 1 / FAYQ / Programming fundamentals 1 | 462 | WebPage, Course, BreadcrumbList | No content bitmap | Canonical/hreflang verified; actual owner text review needed |
| /en/courses/javascript-2 | Programming fundamentals 2 / FAYQ / Programming fundamentals 2 | 462 | WebPage, Course, BreadcrumbList | No content bitmap | Canonical/hreflang verified; actual owner text review needed |
| /en/courses/javascript-3 | Programming fundamentals 3 / FAYQ / Programming fundamentals 3 | 462 | WebPage, Course, BreadcrumbList | No content bitmap | Canonical/hreflang verified; actual owner text review needed |
| /en/courses/javascript-4 | Programming fundamentals 4 / FAYQ / Programming fundamentals 4 | 462 | WebPage, Course, BreadcrumbList | No content bitmap | Canonical/hreflang verified; actual owner text review needed |
| /en/courses/javascript-5 | Programming fundamentals 5 / FAYQ / Programming fundamentals 5 | 462 | WebPage, Course, BreadcrumbList | No content bitmap | Canonical/hreflang verified; actual owner text review needed |
| /en/courses/javascript-6 | Programming fundamentals 6 / FAYQ / Programming fundamentals 6 | 462 | WebPage, Course, BreadcrumbList | No content bitmap | Canonical/hreflang verified; actual owner text review needed |
| /en/courses/javascript-7 | Programming fundamentals 7 / FAYQ / Programming fundamentals 7 | 462 | WebPage, Course, BreadcrumbList | No content bitmap | Canonical/hreflang verified; actual owner text review needed |
| /en/courses/javascript-8 | Programming fundamentals 8 / FAYQ / Programming fundamentals 8 | 462 | WebPage, Course, BreadcrumbList | No content bitmap | Canonical/hreflang verified; actual owner text review needed |
| /en/courses/javascript-9 | Programming fundamentals 9 / FAYQ / Programming fundamentals 9 | 462 | WebPage, Course, BreadcrumbList | No content bitmap | Canonical/hreflang verified; actual owner text review needed |
| /en/courses/javascript-10 | Programming fundamentals 10 / FAYQ / Programming fundamentals 10 | 464 | WebPage, Course, BreadcrumbList | No content bitmap | Canonical/hreflang verified; actual owner text review needed |
| /en/courses/javascript-11 | Programming fundamentals 11 / FAYQ / Programming fundamentals 11 | 464 | WebPage, Course, BreadcrumbList | No content bitmap | Canonical/hreflang verified; actual owner text review needed |
| /en/courses/javascript-12 | Programming fundamentals 12 / FAYQ / Programming fundamentals 12 | 464 | WebPage, Course, BreadcrumbList | No content bitmap | Canonical/hreflang verified; actual owner text review needed |
| /en/package/30000000-0000-4000-8000-000000000001 | Programming course package / FAYQ / Programming course package | 562 | WebPage, BreadcrumbList | No content bitmap | Canonical/hreflang verified; actual owner text review needed |
| /en/courses?page=2 | Programming courses, revisions and packages / FAYQ — Page 2 / Recorded programming courses | 1458 | WebPage | No content bitmap | Canonical/hreflang verified; actual owner text review needed |
