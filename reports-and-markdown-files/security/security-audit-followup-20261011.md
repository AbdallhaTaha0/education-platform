# Security audit follow-up — 2026-10-11

This is the current-source follow-up to the complete 70-phase review in [the 2026-10-05 audit](security-audit-summary-20261005.md), its [ordered phase ledger](security-audit-phases-20261005.md), the [2026-10-06 security delivery](security-delivery-20261006.md), and the [current attack-surface delta](security-attack-surface-followup-20261011.md). It carries forward earlier source findings and limitations, then reviews the later M10 reporting/view routes, course-cover paths, current dependency locks, and this turn's fixes. It does not claim a deployed penetration test or ASVS certification.

## Scope and architecture

The platform remains a React/Vite TypeScript frontend and one modular Express/TypeScript application using PostgreSQL/Prisma and Redis. Authenticated sessions use host-only cookies; authorization has exactly `STUDENT` and `ADMIN` roles. Manual recharge is paid and reviewed in EGP. Lesson files use platform-owned private object storage. Video processing, DRM, playback security and watermarking remain owned by the independently deployed external DRM service, which the platform consumes through its API only. Grading runs in isolated execution jobs; only the trusted grading controller may access the Docker socket. Nginx is the edge/reverse proxy. No production deployment or confirmed public origin exists.

The principal trust boundaries are browser to edge, edge to the single Express backend, backend to PostgreSQL/Redis/private object storage, backend to the external DRM API, and the trusted grading controller to isolated execution jobs. The current application has no payment processor webhook, OAuth callback, email sender, GraphQL endpoint or public video page. See the historical architecture map for the detailed assets, configuration variables and boundaries.

The full endpoint inventory is 132 route-method registrations by delta from the reviewed 125-row baseline: seven M10 reporting/view routes added, two course-cover reads added, and two retired caption routes removed. The two new cover routes and all seven M10 routes are listed in the [route follow-up](security-attack-surface-followup-20261011.md); all unchanged rows and their source-level trace notes remain in the baseline inventory. The protected-route matrix now includes the private ADMIN cover read.

## Overall risk

**HIGH — unresolved high-severity client build-tool dependency advisories remain.** This label reflects the unresolved development/build dependency chain; it is not evidence of a high-severity remotely reachable production vulnerability. No critical platform vulnerability was established in this review. Server dependencies report zero advisories in the current lockfile, including its development/test tree; the server runtime image and client production-only dependency tree also report zero. The browser test-tool image reports zero.

As of 2026-10-12, the full client dependency tree reports **five high advisories**, all in the Tailwind 3 development/build `braces` chain; the production-only dependency tree is clean. The moderate selector-parser advisory was removed by pinning `postcss-selector-parser` 7.1.6 and verifying the Tailwind 3 production build and client suite. The `braces` advisory has no fixed upstream version in the compatible Tailwind 3 chain; the pinned local guard caps nested/recursive processing at 100 and fails closed if upstream source changes, but npm still reports the upstream advisory and the guard is not a complete upstream fix. A Tailwind 4 trial cleared the full audit in Docker; on 2026-10-12 the owner chose to preserve current browser support rather than adopt Tailwind 4's Chrome 111+, Safari 16.4+, and Firefox 128+ minimums. The team therefore retains the audited build-only exception with the tested local guard and clean shipped dependency tree. Eight focused guard tests and dependency details remain documented in the 2026-10-06 delivery.

The Vite/source-map dependency advisories found during this follow-up were addressed with a compatible Vite 6.4.4 update and `source-map-js` 1.2.2 lockfile override. Server and browser audits are clean after the refresh; no audit suppression was added. Runtime exposure and build-tool exposure are reported separately.

## Findings and disposition

| Severity | Finding | Current disposition |
|---|---|---|
| Critical | None established | No critical platform issue confirmed from inspected source, tests or dependency output. |
| High | Client build chain: five high advisories and two moderate advisories | Open upstream; locally mitigated only for bounded brace nesting. Keep under review. |
| Medium | Live TLS, ingress/proxy trust, deployed secret/credential inventory, DB grants/backups, object-store policy, grading isolation and security monitoring | **NEEDS MANUAL VERIFICATION** because no production/staging origin or deployment inventory was supplied. |
| Low / informational | Existing production build warning for `AdminSummaryPage` being both statically and dynamically imported; large private learning/IDE chunks | Admin-only/lazy-route impact is not evidence of public initial-load exposure; consider cleanup during a bounded build optimization. |

Previously fixed platform findings—safe logging, no-store private responses, bounded login input, bounded external response reads, redirect rejection and anti-framing headers—remain covered by the earlier delivery. The current route review found no new authorization bypass. The public course-cover endpoint exposes bytes only for a currently published, non-deleting course; the ADMIN cover endpoint requires ADMIN and is private/no-store. M10 report generation is transient, role-guarded, bounded to at most 50 selected courses and rate-limited; it does not persist report bodies or log recipient-bearing data. The report-contact route reveals only the requested student's parent phone to ADMIN. These are source/test conclusions, not evidence of safe production configuration.

The independent DRM package was inspected read-only. No nested DRM implementation or persistence boundary was changed. Its last explicitly authorized bounded security repair and evidence remain in [the DRM repair report](../drm/drm-security-repair-20261006.md).

## Verification

- Server Docker unit suite: **615 checks** after adding the ADMIN course-cover route to the protected surface matrix (36 files; 615 passed).
- Server Docker integration suite: **457 checks** passed, including course cover validation/access tests and M10 report/view regressions.
- Dedicated course-material Docker gate: populated caption-removal/repeat-migration and cleanup-trigger check passed; **23 unit and 20 real PostgreSQL/Redis/MinIO integration checks** passed. Its named disposable volumes and containers were inspected and removed by the guarded runner.
- Client Docker suite: **400 checks** passed (8 braces-guard checks, 2 DASH checks and 390 Vitest checks).
- Server production/test builds, server/client typechecks, client production build and SSR tests passed. Current server dependency audit is clean; the client production-only audit is clean. The complete client build dependency audit remains nonzero as described above.
- Local SEO/browser crawl also exercises the public-page boundary: 34 synthetic sitemap pages, 34 discoverable links and 16 Arabic/English, desktop/mobile, light/dark scenarios; no console errors, horizontal overflow or broken images. See [SEO follow-up](../seo/seo-audit-followup-20261011.md).
- `git diff --check` passed before documentation finalization. No live deployment, real accounts or production data were used.

The general server integration run passed **457 checks**; the dedicated course-material run added 20 distinct integration checks. The dedicated 23 material unit checks are included in the 615-unit total above, not counted twice.

## NEEDS MANUAL VERIFICATION

Before any future production release, verify the real host's TLS/certificate renewal, HTTP-to-HTTPS and canonical-host redirects, HSTS, proxy header handling, direct-backend isolation, secure cookie behavior, request limits and rate-limit identity. Verify production secret rotation/source and all remote/deleted Git refs, provider settings and backups; least-privilege database roles, PostgreSQL/Redis/object-store network policy, private bucket behavior, backup restoration, CDN cache handling, monitoring and alert delivery. Qualify grading-controller Docker-socket isolation and `runsc` on the actual execution host. Run end-to-end abuse, tenant/object ownership, expiry and concurrency checks against a disposable deployment. Search logs and remote history only with owner-approved private procedures. No production host exists to perform these checks here.

## Files changed in this follow-up

- Dependency inputs/locks: `client/package.json`, `client/package-lock.json`, `server/package.json`, `server/package-lock.json`.
- SEO and landing page source/tests: `client/src/features/home/pages/HomePage.tsx`, `client/src/seo/entry-server.tsx`, `client/src/seo/metadata.ts`, `client/src/seo/metadata.test.ts`, `server/tests/unit/seo-public.test.ts`.
- Browser and test harness: `docker/seo/browser-audit.mjs`, `docker/course-learning-backend/caption-removal-upgrade.mjs`.
- Server regression tests: `server/tests/integration/catalog-ordering.test.ts`, `server/tests/integration/learning-materials.test.ts`, `server/tests/integration/m10-view-tracking.test.ts`, `server/tests/unit/security-route-surface.test.ts`.
- Audit records: this report, [route delta](security-attack-surface-followup-20261011.md), [phase follow-up](security-audit-phases-followup-20261011.md), and the linked SEO reports.

The current source remains on the existing `dev` branch. The owner authorized commit/push for this delivery; no production deployment is authorized or performed. The PC shutdown is deferred until after the verified push and cleanup.
