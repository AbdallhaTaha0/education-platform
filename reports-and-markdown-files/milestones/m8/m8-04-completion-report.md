# M8 approved academic and UI scope — implementation and verification

Date: 2026-10-01. Executor: Codex, direct owner-authorized continuation. **Implemented and verified locally; ready for owner review.** This is same-agent M8 verification, not independent milestone acceptance. No commit, push or production deployment.

## Result and approved policy

The approved FAYQ shell/landing now connects to an academic catalog for first and second secondary, each with terms 1 and 2, monthly explanation courses and revisions. The mobile navigation retains four labeled destinations. Public filters cover grade, term, academic year, course type and text search over public offers. Legacy unclassified courses remain visible when no grade filter is selected.

ADMIN can select four standalone access modes: duration from purchase, an explicit Cairo term/year deadline, or **UNTIL_REMOVAL**, with no expiry until permanent course removal. The owner's latest clarification supersedes mandatory duration. Null expiry represents the explicit indefinite mode; an omitted duration never silently grants it. Offer edits affect new purchases only. Indefinite ownership dominates finite grants; repeat standalone payments that add no access are refused. Fixed-deadline repurchase is allowed when it extends access.

Packages contain three specified monthly courses, one price and one shared ADMIN-set Cairo deadline. Unpublished members are allowed, clearly labeled, and cannot be viewed until published. Existing ownership warns without blocking package purchase or reducing longer access. One transaction creates one debit, one immutable package receipt and three grants. Package expiry remains finite under the previously approved common-deadline policy.

Student screens show truthful fixed/indefinite access in offers, checkout, receipts, history and learning. History includes package purchases with one total payment. Unpublished grants appear in My learning with a notice and no viewing action. ADMIN screens support academic placement, editable access terms, package creation/edit/archive and a summary overview. CSV remains deferred.

The existing FAYQ vector wordmark, self-hosted bilingual fonts, forest/lime/amber/cream themes and youth landing remain the visual foundation. Landing text and FAQ now reflect school grades and optional expiry. The video player loads on the lesson route: initial JS is **364.71 kB / 108.24 kB gzip**, versus the earlier 1,322.72 kB / 387.90 kB gzip. The separate player chunk is 953.77 kB; its build-size warning remains visible and was not suppressed.

## Implementation and boundaries

- Platform only: one modular Express application, two roles, cookie/session-CSRF controls, PostgreSQL/Prisma/Redis/Nginx and external DRM API boundary preserved. Nested DRM remains clean at `bad0c1df9f5d5844fe365c402fcccfee33ab6906`.
- Course academic metadata and package persistence use migration 10. New migration `20261001160000_m8_until_removal` adds the explicit enum mode and nullable subscription expiry while preserving all finite records and snapshot checks. Previously applied migrations were not rewritten.
- Entitlement, dashboard, expiry discovery/production and playback reconciliation account for indefinite access. Short-lived playback tokens and fresh publication/entitlement checks remain enforced.
- Learning now refuses a course with pending deletion, in addition to unpublished/archived/missing courses. Permanent removal denies viewing and removes the course from the current dashboard while retaining purchase/grant history.
- Summary endpoint `/admin/catalog/summary` returns aggregate numbers only, in a repeatable-read snapshot. Definitions: current STUDENT accounts; current published/draft courses excluding pending removal; published package records; pending recharge requests; retained all-time course/package purchase counts; current wallet-balance sum; distinct student/course grants with finite-future or indefinite validity and an existing course. Unpublished ownership is included; viewing still requires publication. Removed courses are excluded. Wallet balances are not revenue. No identities, proofs or CSV are returned.
- No saved-course, quizzes/practice, AI/chat, automatic payments, discounts/refunds, new communications channels or inferred school deadlines were introduced. Earlier proposals for those remain proposals.

## Final Docker evidence

All builds, installations and checks ran in Docker. Owned projects: `m8-final-test`, `m8-final-ui`, `m8-final-failure`; no public test ports or shared data volumes. Evidence is ignored under `docker/browser/evidence/m8-final/`.

| Check | Final result |
| --- | --- |
| Server typechecks and full suite | Exit 0; 21 unit files / **174 tests**, 32 integration files / **270 tests**, total **444** |
| Client typecheck, frozen install, production build and tests | Exit 0; **76 Vitest tests + 2 dash.js compatibility checks**; 9 Vitest files |
| Browser against real serving API | **81/81**, exit 0; Arabic/English × dark/light × 390/1280 widths; language/theme, grade/term filtering, empty state, ≥4.5 text contrast, overflow, presale labels, login, real purchases, overlap warning, history/dashboard, role denial, package creation/archive, saved indefinite offer, no page errors or auth material in storage |
| Final serving-image reconciliation | Exit 0; CLI chain and tests absent; native Prisma engine present; real Argon2 hash/verify; user `app`; exact **10000 + 25000** piastre debits, **465000** wallet/ledger balance, one indefinite standalone purchase and one package receipt with three common-deadline grants |
| Fresh schema | **11 migrations**, serving/test flows pass; idempotent redeploy exits 0 |
| Populated upgrade | **9 → 11**, PASS; IDs, purchased prices/durations/dates, wallet/ledger, sections, lessons and progress unchanged; no guessed academic classification |
| Negative migration gate | Migration exit **1**, Compose exit **1**, server remains **Created** |
| Dependency checks | Server full / omit-dev / serving scopes **0 findings**; client **0 findings**; unchanged M7 override merge check **14/14**; genuine temporary Prisma config loaded and schema validated |

Browser screenshots were visually inspected for Arabic dark mobile, English light desktop, student package review and learning, and admin summary. Screenshots contain labeled synthetic data, not real students or media. The browser fixture's direct synthetic catalog states test storefront/UI behavior; they are not evidence of legitimate DRM publication or real video delivery. Protected playback/renewal/removal regressions use the platform's isolated DRM API fixture; live external DRM qualification is unchanged.

Final image identities (`docker image inspect .Id`, tags `0.8.0-m8-final`):

| Image | Identity |
| --- | --- |
| Client | `sha256:ce7672c60d4a81b230ca272400ee7f041b21a81534a1f86cb1c3d351bc24600f` |
| Client test | `sha256:4db7423941101b360e02a4f0d2d215721b46b5772a5b4db7c614bc300fbdf044` |
| Server | `sha256:c5d083ff27d23c259aeab967ca38f668c4fdedccb6430855a83fadeeaacb8f74` |
| Server test | `sha256:a9deb6e26821cc91cc835e9b24b8b132eca97bd08092e20d3171a81e23161d12` |
| Migrate | `sha256:6eef5ea6f2e350012e66aa820a0de04c24f8c43a340d713ccf02f4ff77822547` |

The serving container's identity and `app` user matched the final server image. M7-07 manifest/lockfile hashes remain `A62D2E0CDD252A0380F1DCED0C5D8882A26A00952DDF66B59B8891CD91EA149A` / `6DCC73ACD2D0CEC30358FDE9C89C017DB87B56410138277AB18336AC2D34D828`.

## Failures and corrections

The first full backend pass exposed pending-deletion viewing (200 where 404 was required). The source guard was corrected; final full regression passes. An extended removal test initially expected grant history to be deleted, contrary to the existing historical-record design; it now checks denied viewing, absence from the current dashboard and preserved snapshots. This also prompted exclusion of removed courses from the summary's effective-access count. The count assertion uses a measured before/after delta, not an assumption that other suite fixtures do not exist.

The first browser invocation mounted the harness outside the image's Node-module directory and failed before any checks. Correcting the mount to `/srv/browser` resolved it. Recreating the serving container removed its temporary fixture helper/receipt; restoring those from the owned copy, then restoring `app` ownership to allow unlink in the sticky `/tmp` directory, resolved cleanup. Retries used scoped, idempotent cleanup; no production or unrelated data was touched. A final disposable frozen-install check initially failed because the image default npm cache was not writable by `app`; setting the cache to `/tmp/npm-cache` resolved it without changing the image or dependencies. Stock npm installation, the exact overridden chain, 14 merge checks and genuine Prisma config validation then passed. A cleanup command initially failed PowerShell parsing before executing any actions; corrected variable interpolation allowed the scoped cleanup to complete. Failed logs remain in ignored evidence; final results above come from successful runs.

## Preview, cleanup and release limits

The explicitly retained read-only design preview is `http://localhost:8084/#/`, container `m8-ui-preview`, label `codex.scope=m8-final-readonly-preview`, bound to **127.0.0.1**. It serves the actual final client and `academic-demo-content.json`: five illustrative published offers plus one three-course package containing an unpublished member. The bilingual sample banner is visible; sign-in/payments are disabled; no database/accounts/payment credentials are attached. Refresh an already-open tab to load the new client. Existing 8082 platform and 8083 prototype previews are preserved.

Cleanup completed: the UI fixture helper removed its owned rows, with zero remaining users/courses/packages verified in the disposable database. All containers, networks and volumes for `m8-final-test`, `m8-final-ui` and `m8-final-failure` are removed; the populated upgrade database was removed with its owned volume. The private host fixture receipt is deleted. The frozen-install container auto-removed. Evidence and built images remain. The 8082 platform and 8084 updated preview return HTTP 200; the unchanged 8083 prototype container remains running (its root URL returns its existing Nginx 403). No global Docker prune was used.

Rollout requires migration 11 plus the new backend on every replica before ADMIN enables indefinite offers; older runtimes cannot handle null expiry. New frontend must accompany the access/presale contract. Once indefinite purchases exist, rollback to the old non-null application is unsafe: use a forward-compatible repair or a separately approved coordinated restore, never silently rewrite purchased access or discard new payments. Production hosting/TLS/secrets, commercial DRM, backups/RPO/RTO, capacity, formal M5 acceptance and explicit M8 owner acceptance remain separate gates. This report does not certify them.

## Changed source groups

Backend: academic/course/plan/package modules and routes; aggregate summary; wallet purchases/package purchases; entitlement/dashboard/reconciler; expiry producers; Prisma schema and migration 11. Client: academic fields/access controls, package cards/review/editor/summary; catalog/forms/price/offer; checkout/history/learning labels; routes/titles/navigation/account/landing/locales and lazy player loading. Tests: academic/entitlement/wallet nullability, M8 academic integration and new indefinite learning/removal integration. Tools: `compose.m8-final-*.yml`, final UI/runtime/fixture/config checks, browser harness and academic read-only preview generator/data. Documentation: current D27/R18/schema/design/contract/plan/brief and this report. All pre-existing M7 and other work remains uncommitted and preserved.
