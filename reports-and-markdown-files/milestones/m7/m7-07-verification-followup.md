# M7-07 verification followup (same-agent)

Date: 2026-10-01. Scope: bounded verification of the completed M7-07 Prisma override
(`reports-and-markdown-files/milestones/m7/m7-07-prisma-override-report.md`) in isolated Docker
resources. **This verification was performed by the original M7-07 implementer, so it is
labeled same-agent: it is not independent review and not manager acceptance.** No M7-08,
commit, push, or deploy. Concurrent M8 files, schema, migrations, previews, and the DRM
pin were preserved and never modified.

Baseline: platform HEAD `31ca60d3a2d832b704423060f3d55da7eae65ee3`; server manifest
SHA256 `A62D2E0C…149A` and lockfile `6DCC73AC…D828` unchanged since the M7-07 package
(the override is intact). DRM checkout/gitlink clean at `bad0c1df9f5d5844fe365c402fcccfee33ab6906`.

## 1. Override exactness + M8 drift accounting

- `server/package.json` overrides read exactly
  `{"@prisma/config@6.19.3":{"deepmerge-ts":"8.0.2"}}` — the assigned selector, no
  experiment label, no direct deepmerge dependency.
- Lockfile: `node_modules/deepmerge-ts` = 8.0.2 with the M7-07-recorded integrity;
  `@prisma/config` node still declares upstream 7.1.5 (maintenance condition holds).
- M8 drift (concurrent, not mine — preserved): new migration
  `20261001150000_m8_academic_access` (10 total, not 9), new server sources
  (`catalog/academic.ts`, `packages.ts`, `routes/packages.ts`, `wallet/purchase/packages.ts`),
  schema changes, and new tests (`unit/academic.test.ts`, `integration/m8-academic.test.ts`).
  Current tree: 21 unit files, 31 integration files. All expectations below use these
  current counts; the historical 9-migration / 159+251 baselines are reported as contained
  subsets, not expected totals.

## 2. Isolated reproduction (unique `m7-07v-*` names, no public ports)

- Frozen install (stock npm 10.9.9, TEMP copy): exit 0; `npm ls` shows exactly
  `prisma@6.19.3 → @prisma/config@6.19.3 overridden → deepmerge-ts@8.0.2 overridden`.
- Audit triplet on the real lockfile, valid JSON, real exit codes: full 0 entries
  (0/0/0/0) exit 0; `--omit=dev` 0 entries exit 0; serving `--omit=dev --omit=optional`
  0 entries exit 0.
- Genuine config-file load (preserved TEMP `$TEMP\m7-07-cfg\prisma.config.ts` with nested
  `migrations.seed` + copied real schema/migrations): `Loaded Prisma config from
  prisma.config.ts` through the installed 8.0.2 merger path, real schema validated,
  exit 0.
- Tracked `docker/verification/m7-07-merge-check.mjs` (unmodified) in the fresh image:
  14/14 PASS, exit 0 (six strict ESM+CJS cases incl. explicit undefined own-keys and
  Date instances, plus both-sides-cyclic handled).
- Fresh images from the CURRENT checkout (M8 sources included): test
  `sha256:5b585e25…93d5eb467b9`, migrate `sha256:d6056ece…f4a5801cf3`, runtime
  `sha256:339956c5…a49a92` — real frozen installs, no engine warnings.

## 3. Migrations, gates, serving image, runtime, suites

- Fresh `m7-07v-test` DB: migrate exit 0, `_prisma_migrations` count **10** (9 historical +
  M8 academic). Full current suites with machine-readable summaries and `$LASTEXITCODE`:
  unit **21 files / 171 tests**, integration **31 files / 263 tests**, overall exit 0 —
  zero failures/skips; the +12/+12 deltas are exactly the M8 academic additions, and the
  M7-era 159/251 assertions all still pass inside these totals.
- Fresh `m7-07v-runtime` DB: migrate exit 0, 10 rows.
- Digest-verified serving container (`sha256:339956c5…`): `prisma`/`@prisma/config`/
  `deepmerge-ts` absent; native `libquery_engine-debian-openssl-3.0.x.so.node` present;
  no `tests/` tree; user `app`. Real in-image Argon2 hash/verify true; `pg` 8.23.0,
  `socket.io` 4.8.3, `express` 4.22.3 load.
- Strengthened M7-03 helper (unmodified) through the new image, exit 0: registrations
  201, logins 200, student-approve 403 exact FORBIDDEN, approval 200 with exact 100000
  credit + ledger match, private RECHARGE_APPROVED notice, duplicate 409, purchase 201
  with exact 60000 debit / 40000 balance / exact 90-day span, renewal + zero-balance
  402s. M8's purchase/plan changes did not disturb these assertions.
- Compose-level failure gate (TEMP-only overlay): unreachable migration DB → migrate
  exit 1, Compose exit 1, server stays `Created`/unstarted.

## 4. Defects, failures, cleanup

- **No M7-07 defect found — nothing was fixed or changed.** The one anomaly met was
  procedural: the first migration-count query raced the one-shot migrate container
  (queried while `Up`, before it exited); re-query after exit 0 gave the documented
  count. No product, test, or config change resulted.
- Cleanup: fixtures removed (`users=3`, receipt unlinked); guard re-resolved
  project-scoped names before each `down -v`; all `m7-07v-test/runtime/fail`
  containers/networks/volumes removed (final volume list holds only pre-existing names).
  Concurrent `m8-03-opencode-*` run, all previews, and DRM untouched; no global prune,
  no secret output, no live DRM/media calls.
- Tracked files added by THIS followup: `docker/verification/compose.m7-07v-test.yml`,
  `compose.m7-07v-runtime.yml`, this report (+ index row below). TEMP-only:
  `m7-07v-run/` (fail overlay + empty receipt dir), `m7-07v-citest/`.

Same-agent verdict: the M7-07 override, closure, audits, config loading, merge behavior,
migrations (10, M8-inclusive), suites (171+263), serving image, native/runtime checks,
and failure gating all reproduce green on the current tree. Returned for manager review;
no M7 completeness, acceptance, or deployment is declared or inferred.
