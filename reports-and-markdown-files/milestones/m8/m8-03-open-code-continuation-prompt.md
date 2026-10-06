# OpenCode — M8 package 03 backend continuation, then stop for manager review

You are the implementation worker in `A:\Projects\Work Projects\education-platform`. The owner stopped direct Codex implementation and is assigning you to continue the existing M8 work. Work one package at a time. This assignment is **complete and verify the existing academic catalog/access/package backend**, not a restart or the entire M8 roadmap.

## Read first

Read root AGENTS.md, the documentation index, agent.md, rules.md and decisions.md. Then read:

- m8-school-catalog-contract.md;
- m8-03a-academic-data-and-purchase-design.md (candidate proposal, not binding schema names);
- m8-03-codex-stop-handoff.md (actual implementation/evidence/cleanup state);
- m8-product-and-ui-plan.md and design.md;
- ../m7/m7-07-prisma-override-report.md to identify preserved dependency work, not to claim its independent acceptance.

Inspect git status/diff and existing untracked files before editing. The tree deliberately contains multiple packages. Preserve all unrelated M7 files, client redesign, docs, assets and reports. Do not reset, clean, stash everything, discard files or revert dependencies. Do not commit, push or deploy.

## Confirmed business rules

1. Recorded courses, initially first and second secondary grades. Monthly explanation course per teaching month, plus revision courses. First secondary has term 1 and term 2; second-secondary term organization is not confirmed.
2. Exactly three specifically identified monthly courses per package, not grade-wide three-month access and not automatic 90-day expiry.
3. ADMIN chooses standalone course access by bounded duration from purchase, term-end or academic-year-end. An omitted duration is not lifetime access.
4. A package grants all three members until one common ADMIN-selected deadline, independent of their standalone rules.
5. ADMIN date/time entry is explicitly Africa/Cairo; store an absolute UTC instant and snapshot it at purchase. Later offer/deadline edits affect new purchases only.
6. Active overlap requires a visible warning, **not prohibition**. Existing longer access must survive. No automatic discount/proration/refund or invented course-price allocation.
7. Unpublished package-member eligibility remains pending. Current source preserves published-only purchase eligibility. Ask the owner only if you need that unresolved branch; do not infer pre-sale authority or silently treat the overlap answer as pre-sale permission. Continue independent verification while awaiting a response.
8. Manual recharge approval credits the wallet only. Explicit purchase debits integer piastres once and atomically creates all access. Exactly STUDENT/ADMIN, cookie/CSRF security and mandatory bilingual content remain.

## Actual code to continue

Review all files listed in the stop handoff. The implementation differs deliberately from the earlier generalized PurchaseItem proposal: nullable validated academic columns on Course; discriminated SubscriptionPlan/Purchase access; separate PackagePurchase/PackagePurchaseItem snapshots; shared per-course Subscription grants with nullable unique legacy purchaseId and unique packagePurchaseId/courseId. Do not replace this with a larger redesign solely to follow candidate model names.

Existing endpoints:

- ADMIN course create/patch accepts academic placement; existing plan endpoints accept accessMode/durationDays/accessEndsAt.
- ADMIN `/admin/catalog/packages` GET/POST and PATCH by ID; optimistic expectedVersion.
- Public `/catalog/courses` academic filters, `/catalog/packages` list/detail with safe projection and unavailable state.
- STUDENT `/wallet/packages/:id/review` warnings, `/wallet/package-purchases` POST/GET, plus existing course purchase/history.

Read the exact mounts and payload validators rather than guessing prefix paths. Keep package history separate from legacy receipts unless a reviewed client contract changes that later. Do not manufacture three independent purchases for one package.

## Required source review and bounded fixes

Check and fix evidenced issues within this backend scope:

- No guessed academic fields for legacy records, no title parsing, no automatic grade registration restriction.
- Validation and database CHECKs agree: valid grade/year/term/type/month; bounded prices/durations; one explicit access shape; exactly one subscription purchase source.
- Cairo conversion rejects invalid dates, incorrect seasonal offsets and DST gaps/ambiguities; accept explicitly documented API input and serialize UTC. Do not depend on machine timezone. Both term-end/year-end require applicable course metadata. Do not invent calendar dates.
- Package membership validation uses three distinct monthly courses. Verify draft/edit/publish/archive behavior, unavailable/removed members and public privacy. Do not leak private outlines, media IDs or unpublished course details.
- Course/package edit and purchase transactions use fresh trusted state under deterministic package/course/wallet locks. Inspect lock interactions with existing deletion, publication, plan edit, expiry producers and wallet operations.
- One package debit, three grants/items and immutable snapshots commit together. All failures roll back; stored replay wins before affordability/availability decisions; conflicting kind/offer keys return conflict. Verify same-student cross-kind races, not just sequential conflicts.
- Overlap warning does not block payment or overwrite old grants. Longer effective course access suppresses premature expiry notifications and continues through existing learning/playback/session expiry APIs.
- Purchase version conflict prevents selling changed terms. Expired deadlines refuse new charges, while committed replay still returns original history after changes/expiry/archive.
- STUDENT-only package flows; ADMIN-only metadata/package writes; CSRF/origin/rate-limit protections. Own history never returns another student's data.
- Publication/API limits must be truthful. Do not add arbitrary cross-term/consecutive-month restrictions or unapproved fixed-date renewal arithmetic.
- Client/mixed-replica compatibility remains a release gate: no enabling fixed-date/package offers for the old numeric-duration client/old writer replicas. Document any rollout prerequisite. Do not deploy or silently update preview 8084.

Use one modular Express application, platform Prisma/PostgreSQL and Redis. No DRM package changes or persistence access. No new features, roles, communications, payment gateways, dependency upgrades or M7-08 work.

## Docker verification

All install/build/test/runtime work must use Docker. Rebuild images from your final source; prior image tags/evidence are a baseline, not your fresh verification. Use a fresh unique disposable project, for example `m8-03-opencode`; never use preview volumes or recreate existing stacks.

Inspect Compose resolution, ports, project labels and volume mounts before starting. `docker/compose.test.yml` + `docker/verification/compose.m8-03-test.yml` are available, but update override comments/names and tags if required for your ownership. Redis needs a project-scoped named volume to avoid forgotten anonymous volumes. No host public ports are needed for backend suites.

Minimum final checks:

1. Production/test typechecks and frozen Docker builds; Prisma generate/validate; serving native Prisma/argon2 and CLI-chain omission smoke.
2. Full server unit/integration suites. Previous final evidence was 171 unit + 263 integration = 434 tests, all passing. Preserve existing assertions and report any legitimate count changes; do not skip/exclude/weaken tests.
3. Meaningful new regression cases for found gaps, especially cross-kind concurrency and archive/version/expiry races; failure injection proves no partial debit/grants. Use supported HTTP guards for financial/authorization checks.
4. Fresh ten-migration install and idempotent redeploy. Reproduce populated old-nine → new-ten upgrade using the guarded helper or an improved drill. Compare historical IDs, balances, ledger rows, purchase/expiry terms and legacy classification. Add populated progress/notification/media metadata checks if needed without invented external assets.
5. Compiled final serving-image flow via m8-03-runtime.cjs or equivalent. Label its synthetic data and scope honestly; service/native checks are not real-video/browser/production qualification.
6. Failure of a required migration must still block application startup. Any disposable failure-gate experiment must own its network/volumes and preserve previews.

No forged DRM READY assets or bypasses. Unit/integration fixtures and catalog-only synthetic test records belong only in the isolated test database and must be identified as such. Do not call external media APIs unnecessarily or write real user/payment data. Do not print secrets or cookie tokens.

Complete cleanup after verifying ownership. Remove only your fixtures/containers/network/project volumes. Preserve images/evidence needed for review and all existing previews. No global prune.

## Report and stop

Write `reports-and-markdown-files/milestones/m8/m8-03-backend-worker-report.md` and one index row. Reconcile contract/schema design docs with the final implementation so proposed generalized PurchaseItem tables are not confused with actual PackagePurchaseItem storage. Preserve owner decisions separately from technical choices.

Report: bounded behavior, exact changed files, D27/R18 mapping, discovered/fixed issues, migration/API changes, manifest/lockfile preservation, Docker commands/image digests, checks/counts/exits, failures and reruns, evidence paths, cleanup, rollout/rollback limitations and pending owner decisions. State same-agent verification; do not claim independent acceptance, M8 completion, production or load qualification.

Then stop for manager review. Do not start student/admin academic discovery, date forms, package checkout UI, saved/search/reporting or the next M8 package. Those will be assigned after backend review. No commits, pushes or deployment.
## Owner-required Docker test cleanup (2026-10-01)

After completing the assigned work, or after failure/interruption/stop, clean up the Docker test environment you created. Before removal, verify the exact project labels, resolved container/network/volume names and every mount; target only this assignment's owned disposable test resources and fixtures. Remove owned test containers, networks and volumes, including any owned anonymous volumes identified from container mounts. Never use global prune or delete unrelated data, the existing previews, reusable images needed for review, or saved reports/evidence. If a test resource must remain temporarily for an active check, record its owner and reason, then clean it when that check ends. Report the final cleanup verification and any resources that could not safely be removed. Every future prompt must include this requirement.
