# M7 package 04 — server test-tooling security remediation report

Date: 2026-10-01. Worker package: `reports-and-markdown-files/m7-04-open-code-worker-prompt.md`.
Scope: replace the server's vulnerable Vitest 2.1.9 chain with exactly `vitest 4.1.11` plus
an explicit exact `vite 6.4.3` dev pin, preserving every test's behavioral assertions and
the M7-03 minimal serving-image assembly. No client/Prisma/TypeScript/application changes,
no business changes, no commits/pushes/deployment. No acceptance is claimed; the manager
reproduces before any package 05 assignment (note: package 05 client tooling is concurrently
executed by the manager in this same tree — §9; its files are preserved and untouched).

Baseline: platform HEAD `31ca60d3a2d832b704423060f3d55da7eae65ee3` (unchanged, `0 0` vs
`origin/main`); all uncommitted M7-01/02/03 work preserved, including the strengthened
runtime flow helper (used as-is). DRM checkout/gitlink clean at
`bad0c1df9f5d5844fe365c402fcccfee33ab6906`, read-only.

## 1. Changed files (this package only)

- `server/package.json` — exact `vitest 4.1.11` pin (was `^2.1.5`) + exact `vite 6.4.3`
  dev pin (new line). No script changes: `test:unit`/`test:integration` invocations work
  unchanged under v4.
- `server/package-lock.json` — test-tooling closure only (767-line diff stat; families §4).
- `docker/verification/compose.m7-04-test.yml` (new) — pins migrate/test images for
  project `m7-04-test`.
- `docker/verification/compose.m7-04-runtime.yml` (new) — pins server/migrate images (and
  reviewed M7-02 client) for project `m7-04-runtime`.
- `reports-and-markdown-files/m7-04-server-tooling-report.md` (this file) + README row.

Deliberately unchanged: `server/vitest.config.ts` (v4 loads it with no migration — probe
§5), no `.mts` rename (not required), zero test-file edits, `server/Dockerfile` (M7-03
omissions preserved; production graph untouched), all runtime/Prisma versions.

## 2. Baseline records

- `server/package.json` SHA256 `1AC9C94B…CE` (1614 bytes); `server/package-lock.json`
  SHA256 `122D7260…83A3` (154,579 bytes, lockfileVersion 3).
- Toolchain: `node:22-bookworm-slim` = Node v22.23.3, npm 10.9.9.
- Installed: vitest 2.1.9, vite 5.4.21, @vitest/mocker 2.1.9, vite-node 2.1.9,
  esbuild 0.21.5.
- Full server audit (read-only mount, exit 1 for findings): 8 entries, 1 critical /
  4 high / 3 moderate, 340 deps — `@prisma/config, @vitest/mocker, deepmerge-ts,
  esbuild, prisma, vite, vite-node, vitest`.

## 3. npm resolver disposition (known prerequisite)

- Reproduced in an isolated copy (`$TEMP\m7-04-resolve`, manifests only): npm 10.9.9
  `npm install --save-dev --save-exact --package-lock-only --ignore-scripts
  vitest@4.1.11 vite@6.4.3` fails with `npm error Cannot read properties of null
  (reading 'edgesOut')`. The copy's hashes after the failure still matched baseline —
  nothing was applied.
- Registry metadata (disposable container, before acting): `vitest@4.1.11` exists,
  engines `^20.0.0 || ^22.0.0 || >=24.0.0` (covers Docker Node 22), dependencies pin
  `@vitest/mocker 4.1.11` (the fixed version for GHSA-82fw-gwwq-j7x9, which affects
  <4.1.11) and permit `vite ^6.0.0 || ^7.0.0 || ^8.0.0` (also a peer range); `vite@6.4.3`
  exists, engines `^18.0.0 || ^20.0.0 || >=22.0.0`. Package existence was not treated as
  compatibility proof — the suites below are.
- Supported newer npm, used ONLY inside the disposable tool container: `npm@12.2.0`
  (registry latest dist-tag at run time), engines `^22.22.2 || ^24.15.0 || >=26.0.0`
  (satisfied by Node v22.23.3). Command: `npm install -g npm@12.2.0` (container-local),
  then the same lockfile-only command with `--ignore-scripts`. Result: success
  (`audited 285 packages`, only the 3 Prisma highs noted). No `--force`,
  `--legacy-peer-deps`, advisory suppression, or blanket regeneration; no global npm
  config committed; production Node image unchanged (still builds with npm 10.9.9).
- No incompatible-engine warning is accepted as passing: neither the tool-container
  resolution, nor the real `npm ci` build log (§6), emitted any EBADENGINE warning.

## 4. Dependency diff (resolved copy reviewed BEFORE applying; applied files hash-match)

`server/package.json` diff (entire change):

```diff
+    "vite": "6.4.3",
-    "vitest": "^2.1.5"
+    "vitest": "4.1.11"
```

(TypeScript and application/Prisma versions untouched; Vite was previously transitive-only.)

Lockfile node comparison (repo baseline vs resolved copy, same result in final files):
37 changed versions, 10 added, 17 removed — ALL inside the test-tooling chain:

- Changed: `@esbuild/*` 0.21.5→0.25.12 (23 platform entries), `@vitest/*`
  (expect/mocker/pretty-format/runner/snapshot/spy/utils) 2.1.9→4.1.11, `chai` 5.3.3→6.3.0,
  `es-module-lexer` 1.7.0→2.3.2, `esbuild` 0.21.5→0.25.12, `std-env` 3.10.0→4.3.0,
  `tinyrainbow` 1.2.0→3.2.0, `vite` 5.4.21→6.4.3, `vitest` 2.1.9→4.1.11. No vite 5 remains.
- Added: `@esbuild/netbsd-arm64|openbsd-arm64|openharmony-arm64@0.25.12` (new esbuild
  platform entries), `@types/chai@5.2.3`, `@types/deep-eql@4.0.2`,
  `convert-source-map@2.0.0`, `fdir@6.5.0`, `obug@2.2.1`, `picomatch@4.0.7`,
  `tinyglobby@0.2.17` (vitest 4's own file-watching/glob stack).
- Removed: v2-only `vite-node@2.1.9` (+ nested debug/ms/pathe), `tinypool@1.1.1`,
  `tinyspy@3.0.2`, `cac@6.7.14`, `deep-eql@5.0.2`, `loupe@3.2.1`, `pathval@2.0.1`,
  `check-error@2.1.3`, nested `pathe@1.1.2`/`debug`/`ms`/`tinyexec@0.3.2` duplicates.
- Preserved exactly (16/16 verified incl. all application deps): `@prisma/client` 6.19.3,
  `@socket.io/redis-adapter` 8.3.0, `argon2` 0.45.1, `cors` 2.8.6, `dotenv` 16.6.1,
  `express` 4.22.3, `helmet` 8.3.0, `ioredis` 5.11.1, `jsonwebtoken` 9.0.3,
  `libphonenumber-js` 1.13.14, `pg` 8.23.0, `pino` 9.14.0, `pino-http` 10.5.0,
  `socket.io` 4.8.3, `prisma` 6.19.3. Installed production graph stable.

Final applied hashes: `server/package.json` SHA256 `F39139BC…F51`,
`server/package-lock.json` SHA256 `BD3A5891…FE` — identical to the reviewed copy.

## 5. Compatibility: zero migration edits required

- Early probe (full server copy in TEMP, real `npm ci --include=dev` with stock npm
  10.9.9 — the same frozen-install path the image build uses): install green.
- `tsc --noEmit -p tsconfig.json` exit 0; existing `vitest.config.ts` (CJS package,
  `fileParallelism: false`, 30s timeouts) loaded by v4.1.11 with no error, no rename,
  no option change: single-file probe `config.test.ts` 25/25.
- Full-suite evidence (§7) confirms no mock/config API breakage across all 50 files.
  The v3 migration guide and v4 guidance were consulted; no change they describe applies
  to this config or these tests (basic describe/it/expect/beforeAll/afterAll, supertest
  HTTP assertions, no removed APIs). No `.skip`/`.only`, no exclusions, no lowered
  assertions, no blanket timeout increase; files stay sequential (`fileParallelism: false`
  preserved) per the isolation contract.

## 6. Images from the changed checkout (server/Dockerfile, normal build env)

- Test `edu-platform-server-test:0.7.0-m7-04-tooling`, index
  `sha256:fef5c0bf…5e9265af`. Real frozen `npm ci --include=dev` (npm 10.9.9):
  284 added / 285 audited, only the 3 Prisma highs noted, no engine warnings;
  `prisma generate` (client v6.19.3) + `tsc` build green. (Prisma's "update available
  6.19.3 → 8.0.0-rc.19" notice is informational; upgrading is out of scope.)
- Migrate `edu-platform-migrate:0.7.0-m7-04-tooling`, index `sha256:d3a96c29…9644995`.
- Runtime `edu-platform-server:0.7.0-m7-04-tooling`, index
  `sha256:570bb887…b54352e0f` (config `sha256:c6cb72ff…432677a`); prod-deps 161 packages;
  M7-03 smoke `runtime smoke ok: cli chain absent, prisma client usable, argon2 loads`.

## 7. Typecheck + complete suites (fresh disposable PostgreSQL/Redis, project `m7-04-test`)

- `npm run typecheck --silent` in the new test image (both `tsconfig.json` and
  `tsconfig.tests.json`, incl. `vitest.config.ts` against v4 types): exit 0.
- Fresh `migrate` one-shot: exit 0; `_prisma_migrations` count 9 on the disposable DB.
- `run --rm test` (`test:ci`), machine-readable plain summaries (NO_COLOR=1) with real
  `$LASTEXITCODE` (PowerShell `$?` is not used as evidence after the M7-03 artifact):
  `Test Files 20 passed (20)` / `Tests 159 passed (159)` (unit) and `Test Files
  30 passed (30)` / `Tests 251 passed (251)` (integration); overall exit 0.
- Counts are IDENTICAL to baseline (20/159, 30/251): all cases preserved, zero failed,
  zero skipped; the 502/503/500 lines in output are the suites' own intentional
  negative-path assertions (DRM fixture failures, outage/readiness gates), same as prior
  packages. Money, cookie/session/CSRF/role, rollback, renewal/expiry, notification
  privacy/recovery, and external-contract assertions all execute in these suites.

## 8. Final lockfile reaudit + serving-image re-verification + runtime flows

- Full `npm audit --audit-level=low --json` on the final lockfile: 3 entries, 0 critical /
  0 moderate / 3 high — `@prisma/config, deepmerge-ts, prisma` ONLY. The
  `@vitest/mocker`, `vitest`, `vite`, `vite-node`, `esbuild` entries are REMOVED and no
  new advisory was introduced. Remaining Prisma-chain entries are explicitly listed, not
  hidden; the source tree is not called clean on runtime-omission grounds.
- Scoped comparison (same final lockfile): `--omit=dev` → the same 3 Prisma highs
  (old serving scope, unchanged — no drift in that chain); `--omit=dev --omit=optional`
  → zero entries (current serving scope, exit 0).
- Final serving container (digest `sha256:570bb887…` = new image): `prisma`,
  `@prisma/config`, `deepmerge-ts` ABSENT; `@prisma/client` 6.19.3, `argon2` 0.45.1,
  `pg` 8.23.0, `socket.io` 4.8.3 present; generated
  `libquery_engine-debian-openssl-3.0.x.so.node` present; no `tests/` tree; user `app`.
- Strengthened M7-03 runtime flows (unmodified) against the new serving image on project
  `m7-04-runtime` (server/migrate = new images, client = reviewed M7-02 image, no ports):
  exit 0 — registrations 201, logins 200, student-approve 403 exact FORBIDDEN, approval
  200 with exact 100000 credit + ledger match, RECHARGE_APPROVED notice to requester
  (after dispatcher poll), duplicate 409, purchase 201 with exact 60000 debit / 40000
  balance / exact 90-day span / ledger match, renewal + zero-balance 402s.

## 9. Migration gates, isolation, concurrent package-05 note

- New migrate image on the runtime DB: 9/9 applied (verified by count query).
- `npx prisma --version` in the migrate image: prisma/client 6.19.3, exit 0 (CLI retained).
- Failure gate: unreachable DB → `P1001: Can't reach database server`, exit 1; the
  throwaway `m7-04-migfail` network/volume removed. (Compose-level server-startup
  refusal was already reproduced by the manager in M7-03; gating code/flags unchanged.)
- Client/browser/real-DRM suites not rerun: server test-runner-only change, M7-02 client
  image reused as-is, no runtime diff beyond M7-03's proven assembly.
- Concurrent work: package 05 (client Vitest 4.1.11 remediation, manager-executed) is
  in flight in this same tree — its `client/package.json|lockfile` hunks and
  `m7-05-client-tooling-report.md` are NOT this package and were never touched here.
  My verification images were built from immutable tags / server-only inputs, so the
  parallel client edits cannot affect this evidence. HEAD has no newer commits to record.
- Cleanup: flow fixtures removed (`users=3`, receipt unlinked); guard re-resolved
  project-scoped names before each `down -v`; `m7-04-test`, `m7-04-runtime`,
  `m7-04-migfail` containers/networks/volumes all removed. Final state: only the six
  pre-existing preview containers (all healthy, original uptimes) + two guarded volumes;
  no `m7-04-*` residue, no global prune, no preview mutation, no secret output, no live
  DRM/media calls, no external load. DRM re-verified clean at the pin. TEMP resolve/probe
  copies live outside the repo (ignored by location); no repo pollution.

## 10. Requirement mapping + rollback

- R10: every install/build/typecheck/test/audit/fixture ran in Docker under unique
  `m7-04-*` names/tags (plus one disposable npm-12 tool container for resolution only);
  host npm performed nothing.
- R11: one Express app, same image topology, non-root runtime, unchanged migration
  capability; only the dev test-runner chain moved major.
- R13: cookie login/CSRF/Origin/role assertions re-proven by the full suites (exit 0)
  and the final-runtime flows.
- Business contracts: wallet/subscription/notification behavior preserved — exact
  financial assertions in §8 plus the unchanged 410-test suite behind them.
- Rollback: restore this package's `server/package.json|lockfile` hunks (config/tests
  need no revert — none changed) and rebuild prior server images. Preserves M7-03's
  serving-image omission and all other reviewed work; no database rollback needed.

Serving-image exposure reduction (M7-03) is preserved; test-tooling advisories for the
server chain are remediated; this is not M7 owner acceptance, commercial-DRM proof,
production approval, or 10,000-user qualification. Remaining debt: client Vitest 3.2.7
(package 05, in flight) and the Prisma build/migration chain (future work).


Manager follow-up, 2026-10-01: [independent review passed](m7-04-manager-review.md). Package 05 is now implemented with [same-agent verification](m7-05-client-tooling-report.md), with independent review pending. The preceding in-flight status records the worker submission time. Remaining full-server findings are the Prisma build/migration chain; serving scope remains separately clean.
