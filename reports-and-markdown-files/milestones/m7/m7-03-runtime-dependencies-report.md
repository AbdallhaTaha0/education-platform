# M7 package 03 — remove unused Prisma CLI chain from the serving image

Date: 2026-10-01. Worker package: `reports-and-markdown-files/milestones/m7/m7-03-open-code-worker-prompt.md`.
Scope: exclude the unused `prisma` CLI / `@prisma/config` / `deepmerge-ts` chain (plus
workers-only `pg-cloudflare`) from the HTTP-serving runtime image while preserving Prisma
Client, its generated native engine, argon2/pg/Socket.IO, the full build/test/migration
assembly, and non-root runtime. No manifest/lockfile version changes, no schema/migration,
no application source, no client changes, no DRM/gitlink changes, no commits/pushes, no
production deployment. No acceptance is claimed; the manager reproduces before any package 04.

Subsequent disposition: [manager review](m7-03-manager-review.md) independently reproduced the native/runtime/financial checks, 159 unit and 251 integration tests, audit scopes and actual migration-dependent startup refusal. The verification helper now asserts exact duration, approval-notice type/privacy and duplicate-credit invariance. Package 03 is accepted for its bounded scope; owner M7/production acceptance remains open. Original worker evidence and failed-attempt notes below are preserved.

Baseline: platform `31ca60d3a2d832b704423060f3d55da7eae65ee3` (still HEAD, `0 0` vs
`origin/main`); all accepted-but-uncommitted M7-01/02 changes preserved, including the
manager's browser stability correction. DRM checkout/gitlink clean at
`bad0c1df9f5d5844fe365c402fcccfee33ab6906`, read-only.

## 1. Changed files

- `server/Dockerfile` (modified, only file with product impact — two hunks, §2).
- `docker/verification/compose.m7-03-test.yml` (new) — pins migrate/test to the new images
  for the `m7-03-test` suite project.
- `docker/verification/compose.m7-03-runtime.yml` (new) — pins server/migrate to the new
  images and client to the reviewed M7-02 image for the `m7-03-runtime` stack.
- `docker/verification/m7-03-runtime-flows.cjs` (new) — labelled run-owned seed + supported
  API flow + cleanup for the final runtime (register/login/CSRF, inbox/catalog reads,
  admin approval, purchase/renewal, 403/409/402/401 negatives).
- `reports-and-markdown-files/milestones/m7/m7-03-runtime-dependencies-report.md` (this file) + README row.

## 2. Exact Dockerfile diff

```diff
-# Production-only dependencies.
+# Production-only dependencies. `--omit=optional` additionally excludes the unused
+# Prisma CLI chain (prisma, @prisma/config, deepmerge-ts: devOptional via the
+# @prisma/client optional peer) and workers-only pg-cloudflare, which the Node.js
+# serving runtime never loads. Lifecycle scripts stay enabled so kept native
+# packages (argon2) still build. Build/test/migration stages keep full installs.
 FROM base AS prod-deps
 COPY server/package.json server/package-lock.json ./
-RUN npm ci --omit=dev && npm cache clean --force
+RUN npm ci --omit=dev --omit=optional && npm cache clean --force
```

```diff
-# Smoke: PrismaClient must be CONSTRUCTIBLE in the final runtime image
-# (require-only is insufficient). Never connects: dummy URL + disconnect.
+# Smoke: the unused CLI chain must be absent from FINAL runtime while the generated
+# Prisma Client stays usable and argon2's native binding loads. PrismaClient must be
+# CONSTRUCTIBLE (require-only is insufficient). Never connects: dummy URL + disconnect.
 RUN DATABASE_URL=postgresql://127.0.0.1:5432/prisma_smoke \
-  node -e 'const {PrismaClient}=require("@prisma/client"); const c=new PrismaClient(); c.$disconnect().then(()=>console.log("prisma client smoke ok"));'
+  node -e 'const assert=require("assert");const fs=require("fs");for (const p of ["prisma","@prisma/config","deepmerge-ts"]) assert(!fs.existsSync("node_modules/"+p),p+" must be absent from serving runtime");const {PrismaClient}=require("@prisma/client");const c=new PrismaClient();c.$disconnect().then(()=>{require("argon2");console.log("runtime smoke ok: cli chain absent, prisma client usable, argon2 loads");});'
```

Build/test/migrate stages, non-root `app` user, copy assembly (no full-tree copy into
runtime), and migration history/checksums are untouched. Version pins unchanged.

## 3. Before-state inventory (why the change is safe)

Serving image before (read-only `docker exec` in the healthy preview, no app import, no
env printed): `prisma 6.19.3`, `@prisma/config 6.19.3`, `deepmerge-ts 7.1.5` INSTALLED
alongside `@prisma/client 6.19.3`, `argon2 0.45.1`, `pg 8.23.0`, `socket.io 4.8.3`;
process user `app`. Top-level `node_modules` entries: 179.

Lockfile (unchanged, read-only container): `prisma`, `@prisma/config`, `deepmerge-ts`
are all `devOptional=true` (arrive via the `@prisma/client` optional peer, confirmed by
reverse-deps: `prisma <- @prisma/client`, `@prisma/config <- prisma`,
`deepmerge-ts <- @prisma/config`); `@prisma/client`, `argon2`, `pg`, `socket.io` are
regular entries. All 86 optional/devOptional lockfile nodes were inspected: besides the
CLI chain they are dev-toolchain platform binaries (`@esbuild/*`, `@rollup/*`, `fsevents`
via rollup/vite, `@napi-rs/lzma` via rollup), mac-only `fsevents`, and `pg-cloudflare`
(optional dep of `pg`, loaded only in Cloudflare Workers runtimes — never on Node.js).
No serving-required package is optional on linux x64.

Application source audit: no file under `server/src` imports `prisma`, `@prisma/config`
or `deepmerge-ts`; runtime value imports are `@prisma/client` (`infra/prisma.ts`,
`bootstrap.ts`, plus `Prisma` value uses from the client package) and `argon2`
(`identity/password.ts`). Engines reach runtime exclusively through the existing
`.prisma/client` + `@prisma/client` copies, which are preserved.

Omission rationale (npm 10 `npm ci` documentation): `--omit=dev --omit=optional` keeps
frozen-lockfile installs with lifecycle scripts ENABLED (argon2 still compiles), and
applies ONLY to the `prod-deps` stage — never to build/test/migrate and never via a
global npm config file.

## 4. Images built from the changed checkout

- `edu-platform-server:0.7.0-m7-03-runtime` — index
  `sha256:5285beceed96085852368343c5e3e4f9b1cdacef7838c5d7bb2bd6e452d11f95`,
  config `sha256:519a8ea3eb12173aa02eadda98ccaee749feccb163cb497594ebab2b3aed4713`.
  prod-deps install: `added 161 packages, audited 162, found 0 vulnerabilities`.
  Build-time smoke: `runtime smoke ok: cli chain absent, prisma client usable, argon2 loads`.
- `edu-platform-migrate:0.7.0-m7-03-runtime` — index `sha256:1f7d9fd9…cdfad`
  (full-dependency stages CACHED: Dockerfile change touches only prod-deps/runtime layers,
  proving migration tooling is byte-identical in assembly).
- `edu-platform-server-test:0.7.0-m7-03-runtime` — index `sha256:d8761262…49e7`
  (same cache evidence for the test assembly).

## 5. Typecheck, build, unit + integration (fresh disposable DB, project `m7-03-test`)

- `npm run typecheck --silent` in the new test image → exit 0.
- `prisma generate` + `tsc` build: green inside the image build (cached layers validated
  against unchanged inputs; explicit typecheck above re-proves the sources).
- `migrate` one-shot on the fresh `m7-03-test_pgdata-test` volume: exit 0, all 9
  migrations applied (`_prisma_migrations` count 9, names M1..M6-delivery listed).
- `run --rm test` (`test:ci`): unit 20 files / 159 tests passed; integration 30 files /
  251 tests passed; 0 failures/skips. Reran once more capturing `$LASTEXITCODE`: exit 0
  with identical counts (the first invocation's `echo $?` capture printed False through a
  shell-quoting artifact while the log itself showed all-green; the rerun is the exit
  evidence). These suites run with full dev dependencies — regression evidence for
  unchanged behavior, not proof of the final runtime's package selection (that proof is §6).

## 6. FINAL runtime verification (project `m7-03-runtime`, image `sha256:5285bece…`)

Stack: delivery-browser base + M7-03 override, no published ports, project-scoped
`m7-03-runtime_pgdata`; server/migrate = new images, client = reviewed M7-02 PostCSS
image (M6 behavior preserved without rerunning CSS/theme suites for a server
packaging-only change). All services healthy, migrate exited 0.

Direct inspection of the RUNNING server container (digest matches the new manifest):

- `prisma`, `@prisma/config`, `deepmerge-ts`: ABSENT.
- `@prisma/client 6.19.3`, `argon2 0.45.1`, `pg 8.23.0`, `socket.io 4.8.3`,
  `express 4.22.3`: INSTALLED (express version is the pre-existing lockfile resolution).
- `pg-cloudflare`: ABSENT (workers-only; pg queries below prove it is unneeded on Node).
- Generated engine present: `node_modules/.prisma/client/` contains
  `libquery_engine-debian-openssl-3.0.x.so.node` (+ wasm/bg).
- `dist/index.js` present, `tests/` absent (no full build-tree copy). User `app`.
- Top-level `node_modules` entries: 152 vs 179 before (−27 dirs).

Real database operations through the final runtime (`m7-03-runtime-flows.cjs`, executed
from a container of the NEW runtime image on the disposable network — exit 0,
`M7-03 runtime flows PASS`):

- Student A/B registration 201 via supported API (Argon2 hashing + Prisma writes
  through the serving runtime + CSRF/Origin contract).
- Admin + student API logins 200 (Argon2 verification through the serving runtime).
- Wallet reads: new balance exactly 0; anonymous `/api/notifications` → 401.
- Authenticated inbox/catalog reads 200; published fixture course listed.
- Student approve attempt → 403 FORBIDDEN (exact code recorded).
- Admin approval → 200; wallet exactly 100000 piastres; `/wallet/reconcile` matches true.
- Approval notice visible to the requester (1 item after dispatcher poll — async
  materialization confirmed; a first single-shot read raced it, the poll is the honest
  mechanism, matching M6 realtime semantics). D25 preserved.
- Duplicate approval → 409 (immutable decision).
- Purchase → 201, price exactly 60000, subscription span exactly 90 days, wallet exactly
  40000, ledger matches true.
- Repeat purchase with 40000 balance and zero-balance purchase → 402 each (exact
  insufficient-funds behavior; renewal-extension math stays covered by integration tests).

## 7. Migration image gates

- Fresh owned database: all 9 migrations applied, exit 0 (§5; history/checksums unchanged).
- Failure gate: `run --rm --no-deps -e DATABASE_URL=postgresql://bad:bad@127.0.0.1:5999/nope
  migrate` → `Error: P1001: Can't reach database server at 127.0.0.1:5999`, exit 1;
  dependent application start stays gated. The throwaway `m7-03-migfail` volume/network
  were removed afterwards.
- CLI retained where required: `npx prisma --version` in the migrate image → prisma
  6.19.3 / client 6.19.3 / debian-openssl-3.0.x, exit 0. Its full dependency chain
  (including the CLI advisory) remains separate, explicitly recorded security debt.

## 8. Audit scope comparison (same unchanged lockfile)

- Full source-lockfile `npm audit --audit-level=low --json`: 8 entries (1 critical / 4 high /
  3 moderate) — UNCHANGED from M7-01. Preserved as the record; it includes dev and optional
  tooling never shipped in runtime.
- `--omit=dev` (matches the OLD serving install): 3 high — `prisma`, `@prisma/config`,
  `deepmerge-ts` (one underlying deepmerge-ts recursive-merge advisory). This is the
  exposure the old image shipped.
- `--omit=dev --omit=optional` (matches the NEW serving install): 0 entries, exit 0.
  No audit JSON, lock metadata, or severity was edited to manufacture this; the scopes
  differ because dev/optional packages are install-time sets, not claims about the source
  tree. Remaining debt: build/migrate/test tooling advisories (vitest critical/moderate,
  vite/esbuild, Prisma CLI chain) are NOT remediated by this package.

## 9. Requirement mapping

- R10 (Docker throughout): installs, builds, typecheck, suites, migrations, audits,
  fixture flows, and browser-stack reuse all ran in Docker under unique `m7-03-*`
  projects/tags; host npm performed nothing.
- R11 (preserve architecture): one Express app, same replicable image shape, non-root
  runtime, unchanged migration job capability; only unused optional packages excluded
  from serving layers.
- R13 (cookie identity): register/login/CSRF/Origin flows, 401/403 negatives, and
  storage-free sessions exercised against the final runtime.
- Wallet/subscription/notification contracts: exact approval credit (100000), purchase
  debit (60000 → 40000), 90-day subscription span, ledger reconciliation true,
  409 duplicate-approval immutability, 402 insufficient funds, and requester-visible
  approval notice — all preserved with the slimmer image.

## 10. Failures, skips, blocks

- Initial single-shot inbox read after approval raced async dispatcher materialization
  (reported, not hidden); a bounded 10×3s poll is the committed mechanism.
- First suite invocation's exit capture printed False via a PowerShell `$?` artifact while
  its log showed 159+251 green; a rerun with `$LASTEXITCODE` gave exit 0 with identical
  counts — the rerun is the exit evidence.
- Skipped by design with no new trigger: full client/browser reruns (M7-02 image reused
  as-is; served bytes unchanged), crash/failover suites, DRM internals, external load.

## 11. Cleanup (ownership-verified)

- Flow cleanup: owned users/courses/requests/wallet/notification/audit rows deleted
  (`users=3`), receipt unlinked.
- `m7-03-test` and `m7-03-runtime` (plus throwaway `m7-03-migfail`): guard re-resolved
  project-scoped names before each `down -v`; all run containers, networks, and volumes
  removed. Final `ps/volume/network` state shows only the six pre-existing preview
  containers (all healthy, original uptimes) and its two guarded volumes. No global
  prune, no preview mutation, no signing-key regeneration, no secret output, no live
  DRM/media calls. DRM re-verified clean at the pin. New images retained as build
  evidence; TEMP receipt dir is empty (evidence lives in this report, not in screenshots —
  none were needed for a packaging-only change).

## 12. Rollback

Revert the two `server/Dockerfile` hunks (§2) and rebuild the previous runtime
(`npm ci --omit=dev` + old smoke). No database rollback, data deletion, schema change,
or external maintenance is involved (disposable databases were destroyed; preview data
untouched).

Serving-image exposure is reduced; this does NOT remediate build/migration tooling
advisories, prove commercial DRM, authorize production, or qualify 10,000 users.
