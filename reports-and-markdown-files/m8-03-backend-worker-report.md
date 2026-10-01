# M8-03 backend continuation — OpenCode worker report

Date: 2026-10-01. Assignment: `m8-03-open-code-continuation-prompt.md`.
Scope: **review and finish the existing academic catalog/access/package backend only**,
then stop for manager review. Same-agent verification; no independent review, no M8
completion, no production or load qualification is claimed. No commit, push or deploy.

## 1. Baseline preserved, not restarted

The stop handoff (`m8-03-codex-stop-handoff.md`) implementation was continued in place.
Preserved without modification or revert:

- M7-07 Prisma override: `server/package.json` version-qualified
  `@prisma/config@6.19.3 → deepmerge-ts 8.0.2` block intact; manifest SHA256
  `A62D2E0CDD252A0380F1DCED0C5D8882A26A00952DDF66B59B8891CD91EA149A` and lockfile
  SHA256 `6DCC73ACD2D0CEC30358FDE9C89C017DB87B56410138277AB18336AC2D34D828`
  re-verified byte-identical before and after this package. No dependency change.
- M7-03 serving-image CLI-chain omission and M7-04 Vitest 4.1.11/Vite 6.4.3 pins
  (`server/Dockerfile` diff matches the M7 hunks exactly; no drift).
- The existing M8 redesign: nullable academic columns on Course, discriminated
  SubscriptionPlan/Purchase access, separate PackagePurchase/PackagePurchaseItem
  snapshots, shared per-course Subscription grants (nullable unique legacy `purchaseId`,
  unique `packagePurchaseId`/`courseId`). The earlier generalized PurchaseItem proposal
  from `m8-03a-academic-data-and-purchase-design.md` was **not** substituted; actual
  storage is PackagePurchase/PackagePurchaseItem as recorded in the handoff.
- All M8-02 client shell/landing files, M7 reports, docs and assets untouched.
- Concurrent-session files that appeared during this run
  (`m7-07-verification-followup.md`, `compose.m7-07v-*.yml`) were not touched.
- `education-drm-service/` clean at `bad0c1df9f5d5844fe365c402fcccfee33ab6906`; no DRM
  change or persistence access. Client manifest/lockfile unchanged by this package.

## 2. Source-review verdict on the existing implementation

Reviewed every file listed in the stop handoff against the continuation prompt's
checklist. The implementation is sound; review findings:

1. **Academic metadata** (`catalog/academic.ts`, `courses/service.ts`): explicit
   admin-authored placement only; legacy `null` preserved; no title parsing; grade
   filter is catalog targeting, not a registration restriction. Agree.
2. **Validation vs DB CHECKs**: service and migration agree on grade/year/term/kind/
   month shape, exactly-one access shape, exactly-one subscription purchase source,
   price bounds, and 3-distinct-member/position rules. Two deliberate strictness
   notes, not defects: service additionally requires consecutive academic years
   (`second = first + 1`, 2000–2200) beyond the DB regex, and DRAFT packages must
   already carry three valid members (stricter than the design candidate's
   "incomplete draft" idea, consistent with the owner rule of exactly three
   specified courses). No cross-term/consecutive-month restriction was added.
3. **Cairo deadlines**: `cairoDeadline` requires explicit `+02:00`/`+03:00` input,
   round-trips through `Africa/Cairo` via `Intl` (host-timezone independent),
   rejects normalized invalid dates and wrong seasonal offsets; service UTC
   serialization; TERM_END/YEAR_END require applicable course metadata. Agree.
4. **Package membership**: three distinct monthly courses; published-only sale
   boundary retained (pre-sale NOT inferred — the unpublished-member question is
   still pending with the owner); archive bypasses member revalidation;
   `publicPackage` exposes only safe labels/prices/terms (no outlines, media IDs,
   or unpublished details). Agree.
5. **Locks**: package `FOR UPDATE` → member courses `FOR SHARE` (sorted) → wallet
   `FOR UPDATE`; standalone purchase course `FOR SHARE` → wallet; expiry producer
   course `FOR SHARE` → wallet. Deterministic and compatible with existing
   deletion/publication/plan-edit writers (`FOR UPDATE`). `SHARE`/`SHARE`
   compatibility plus wallet serialization means cross-kind races converge
   without deadlock. Agree.
6. **Atomicity/idempotency**: one `PACKAGE_PURCHASE` debit + three items + three
   grants in one transaction; pre/post-lock replay before affordability checks;
   cross-kind 409 in the shared `(studentId, idempotencyKey)` namespace; version
   conflict and expiry refusal before any debit; committed replay returns stored
   terms after edits/expiry/archive. Agree.
7. **Overlap**: warning only, purchase permitted, longer grant survives via
   entitlement union; `recordExpiry` uses `MAX(expiresAt)` so a shorter package
   deadline never triggers a premature notice. Agree.
8. **Authorization**: STUDENT-only package flows (`requireStudent`), ADMIN-only
   metadata/package writes (`writeGuard`), CSRF/origin/rate-limit on writes,
   own-history scoping. Agree.
9. **Compatibility gate**: the old numeric-duration client has no package UI and
   would read `durationDays: null` on fixed-date plans — fixed-date/package offers
   must not be enabled for it. Documented as a rollout prerequisite (§7); no
   preview (8082/8083/8084) was touched or advertised as updated.

## 3. Exact changed files (this continuation)

| File | Change |
| --- | --- |
| `server/tests/unit/academic.test.ts` | +1 test: winter `+03:00` rejected, fractional `.000` with correct offset accepted |
| `server/tests/integration/m8-academic.test.ts` | +2 tests: concurrent cross-kind race converges on one debit; HTTP role/guard enforcement plus expired/deletion-pending refusal without debit |
| `docker/verification/m8-03-upgrade.cjs` | Extended populated drill: seed/snapshot now cover `CourseSection`/`Lesson`/`LessonProgress` in addition to users/courses/plans/purchases/grants/wallets/ledger |
| `docker/verification/compose.m8-03-opencode.yml` | **New**, project-scoped override with fresh `-opencode` image tags (prior `compose.m8-03-test.yml` preserved) |
| This report + README index row | Reporting only |

No application source, schema, migration, Dockerfile, manifest or lockfile was
changed. No UI, role, gateway, dependency or DRM work.

## 4. D27 / R18 mapping

- D27 (configurable expiry, three-course packages, one common deadline, Cairo
  date/time snapshotted at purchase, overlap warning without blocking): covered by
  `academic.ts`/`packages.ts`/`wallet/purchase/packages.ts` plus the overlap,
  snapshot-preservation and Cairo unit tests.
- R18 (academic catalog/access): covered by academic metadata validation, public
  filters/projections, versioned package administration and the atomic
  three-grant purchase with immutable snapshots.
- Unresolved owner branch respected, not implemented: unpublished package-member
  eligibility stays published-only; no fixed-deadline renewal arithmetic, no
  discount/proration/refund, no second-secondary term assumption.

## 5. Docker verification (isolated project `m8-03-opencode`)

All work in Docker under disposable project `m8-03-opencode` (plus a TEMP-only
`m8-03-opencode-fail` gate); no host public ports; previews untouched. Prior
`0.8.0-m8-03` images/evidence treated as baseline only.

Commands (from the repo root; compose lines use both
`docker/compose.test.yml` and the new override):

- `docker compose -p m8-03-opencode -f docker/compose.test.yml
  -f docker/verification/compose.m8-03-opencode.yml build` → exit 0
  (frozen `npm ci` in Docker; a lockfile mismatch would fail the build).
- `docker run --rm edu-platform-server-test:0.8.0-m8-03-opencode npm run typecheck
  --silent` → exit 0 (production + test projects).
- `docker run --rm -e DATABASE_URL=postgresql://127.0.0.1:5432/prisma_validate
  … npx prisma validate` → exit 0 (dummy URL, same approach as M7-07; without it
  Prisma v6 errors P1012 on the missing env — first attempt, recorded as a
  procedural miss, not an application defect).
- `up -d --wait postgres redis` → exit 0; `up --wait migrate` on the fresh volume
  → exit 0 with **10/10 applied migrations** ending
  `20261001150000_m8_academic_access` (queried `_prisma_migrations`).
- Idempotent redeploy: migrate re-run → exit 0, `10 migrations found`,
  `No pending migrations to apply`.
- Full server suites: `run --rm -e NO_COLOR=1 test` → exit 0:
  **21 unit files / 172 tests** and **31 integration files / 265 tests**
  (**437 total** = 434 baseline + 1 unit + 2 integration; file counts unchanged,
  no skips/exclusions/weakened assertions). The `500/502/503` log lines are the
  suites' own intentional negative-path assertions.
- Populated 9→10 upgrade in a second database `m8_upgrade`: old image
  `edu-platform-migrate:0.7.0-m7-07-override` applied 9; seed recorded the
  historical snapshot; new image applied the 10th; verify `PASS: populated
  upgrade preserves all recorded IDs, terms, dates, balances, ledger rows,
  sections/lessons/progress; no guessed academic placement`, exit 0. Legacy rows
  keep `accessMode DURATION` with `null` placement and zero package rows.
- Serving image `docker build -f server/Dockerfile --target runtime` → exit 0;
  digest-verified smoke (CLI chain absent, Prisma constructible, argon2 loads)
  → `SMOKE_OK`, exit 0; compiled serving-image flow (`m8-03-runtime.cjs` inside
  the serving image against an isolated DB, synthetic data only) →
  `PASS … one 90000 debit, balance 110000, three common-expiry grants and
  idempotent replay`, exit 0, fixtures self-removed.
- Failure gate (TEMP overlay, owned project): unreachable migration DB →
  Compose exit 1, migrate exit 1, server stays `Created`/unstarted.

Fresh image identities (local tags):

- test: `edu-platform-server-test:0.8.0-m8-03-opencode`
  `sha256:12ba3d2358c497dea4202222c1131f10eed739020c0ccd276552c595e7039761`
- migrate: `edu-platform-migrate:0.8.0-m8-03-opencode`
  `sha256:2b94070de9666b74555287240cfb496eff11f926791430df2067325935046b8d`
- serving: `edu-platform-server:0.8.0-m8-03-opencode`
  `sha256:4e106867f9224f5c8d0ab35e132858df79d17d202b8f54435e8e4a5eae0b04c5`

Seed images used only as the *old-side* fixture:
`edu-platform-migrate:0.7.0-m7-07-override` and
`edu-platform-server-test:0.7.0-m7-07-override` (9-migration Prisma client).

Evidence (git-ignored, preserved): `docker/browser/evidence/m8-03/` —
`test-build-opencode.log`, `typecheck-opencode.log`, `prisma-validate-opencode.log`,
`stack-up-opencode.log`, `fresh-migrate-opencode.log`, `redeploy-opencode.log`,
`final-server-opencode.log`, `upgrade-old-migrate-opencode.log`,
`upgrade-seed-opencode.log`, `upgrade-new-migrate-opencode.log`,
`upgrade-before-opencode.json`, `upgrade-verify-opencode.log`,
`runtime-build-opencode.log`, `runtime-smoke-opencode.log`,
`runtime-flow-opencode.log`, `failure-gate-opencode.log`.

## 6. Failures and reruns

1. `prisma validate` without `DATABASE_URL` → P1012. Procedural; reran with a
   dummy URL (M7-07 precedent) → exit 0.
2. Upgrade seed with the NEW test image against the 9-migration DB → P2022
   (`Course.grade` missing), because the new client targets the new schema.
   Dropped/recreated `m8_upgrade`, re-applied the old migration, seeded with the
   OLD (9-migration) test image → success; new image applied migration 10 and
   verified. No tree change needed; this is the correct old-client/new-client
   drill shape.
3. Container-level smoke quoting: a PowerShell-inline `node -e` script was
   mangled by the shell (and `/tmp/*.cjs` cannot resolve modules without
   `NODE_PATH`). Reran via a mounted file with
   `NODE_PATH=/srv/server/node_modules` → `SMOKE_OK`. The Dockerfile's own
   build-time smoke already covered the same assertions.
4. No application test failures at any point; no reruns needed for the suites.

## 7. Cleanup

- `m8-03-opencode`: all containers/network/project volumes removed (`down -v`);
  fixture databases (including `m8_upgrade`) destroyed with their volumes.
- `m8-03-opencode-fail`: removed with its volumes.
- Only pre-existing volumes remain (`education-platform-rs256_pgdata`,
  `education-platform-rs256_redisdata`); previews 8082 (`/health/ready` 200),
  8084 (200) and 8083 (expected directory-index 403 on `/`, live at its page)
  verified untouched. No global prune.
- TEMP scratch dir removed. Images and ignored evidence preserved for review.
- Environment note: a foreign `m7-07v-test-postgres-1` container present at the
  start was removed by another session mid-run with its volume; none of this
  package's project-scoped commands can address another project's resources, and
  its disappearance is recorded here only for honesty.

## 8. Rollout / rollback limits

- Do **not** enable fixed-date plans or package offers for the old
  numeric-duration client (it assumes `durationDays` is numeric and has no
  package UI), and do **not** run old writer replicas once package writes exist
  (they assume one subscription per purchase). Coordinate client release and
  replica rollout; discovery should keep legacy records reachable until ADMIN
  classification.
- Rollback before any package purchase: restore this tree state and redeploy;
  the expanded schema stays readable. After package purchases exist, old code
  cannot safely read the new cardinality — disable new writes and roll forward;
  never drop package/financial data or truncate history for a down migration.

## 9. Remaining questions (for the owner/manager, not permission to invent)

1. Does warning-only overlap permission also cover packages containing an
   **unpublished** member, or only overlap on fully published members? (Code
   retains published-only sale.)
2. Fixed-deadline repeat purchase / extension semantics and second-secondary
   term organization remain unconfirmed; no arithmetic was implemented.
3. Notification/media populated-upgrade coverage was deliberately left out (no
   invented external assets); progress coverage was added.

## 10. Stop

Backend package complete to the extent above and verified by the implementing
agent. Stopping for manager review. Not started: student/admin academic
discovery, date forms, package checkout UI, saved/search/reporting, or any next
M8 package. No commits, pushes or deployment.
