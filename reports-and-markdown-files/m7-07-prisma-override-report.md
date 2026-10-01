# M7 package 07 — apply the reviewed Prisma dependency remedy

Date: 2026-10-01. Worker package: `reports-and-markdown-files/m7-07-open-code-worker-prompt.md`.
Scope: apply exactly the manager-reviewed version-qualified parent override in
`server/package.json` and regress it fully in Docker. No Prisma major update, no direct
deepmerge dependency, no audit suppression, no unrelated changes. No commit, push,
production deployment, or package-08 work. This self-report claims no independent review,
no M7 completeness, and no owner acceptance.

Baseline: platform HEAD `31ca60d3a2d832b704423060f3d55da7eae65ee3`; pre-package server
manifest SHA256 `F39139BC…F51` and lockfile `BD3A5891…FE` matched the M7-06 manager record
exactly (no concurrent server edits; M8 client work elsewhere in the tree untouched).
DRM checkout/gitlink clean at `bad0c1df9f5d5844fe365c402fcccfee33ab6906`, read-only.
Previews `:8082` (platform), `:8083` (M8 design), `:8084` (M8 UI) kept running; unrelated
projects/volumes never selected.

## 1. Exact edits (application)

`server/package.json` — one added block, version-qualified parent selector, no experiment
label, no direct dependency:

```diff
   "engines": {
     "node": ">=20"
+  },
+  "overrides": {
+    "@prisma/config@6.19.3": {
+      "deepmerge-ts": "8.0.2"
     }
   }
 }
```

`server/package-lock.json` — regenerated through the disposable resolver below. Post-edit
hashes: manifest SHA256 `A62D2E0C…149A`, lockfile SHA256 `6DCC73AC…D828`.

Dockerfile, schema, migrations, vitest config, tests, and product source: unchanged.
The M7-03 serving-image omission flags and M7-04 tooling pins are preserved byte-for-byte.

## 2. Resolver disposition + frozen-install proof

- npm 10.9.9's `edgesOut` re-resolution failure is recorded across M7-04/06; this package
  did not re-trigger it against the real tree. Used the allowed tool prerequisite once,
  inside a disposable container only: `npm install -g npm@12.2.0` (registry-verified;
  engines `^22.22.2 || ^24.15.0 || >=26.0.0`, satisfied by Docker Node v22.23.3), then
  `npm install --package-lock-only --ignore-scripts` against the real `server/` mount:
  success, resolver audit `found 0 vulnerabilities`. No `--force`, legacy-peer flags,
  manual integrity substitution, host npm, or global config.
- Lockfile consistency firewall (stock npm 10.9.9, TEMP copy of the two new files):
  `npm ci --ignore-scripts` exit 0 with no out-of-sync error, and `npm ls deepmerge-ts
  --all` prints exactly `prisma@6.19.3 → @prisma/config@6.19.3 overridden →
  deepmerge-ts@8.0.2 overridden` (single instance). Lifecycle-enabled proof came from the
  image builds (§4), which run the normal `npm ci` with scripts on.

## 3. Closure comparison (complete, vs HEAD-committed lockfile)

65 differing lock nodes, every one classified: 38 version changes (37 = M7-04's accepted
vitest/vite/esbuild/chai-family upgrades; **1 = `deepmerge-ts 7.1.5 → 8.0.2`, this
package**), 17 removals + 10 additions (all M7-04 v2-toolchain removals/additions),
plus the root manifest mirror (M7-04 devDeps + this package's `overrides` block).
Zero runtime/Prisma/client/typescript drift — every non-listed node identical.

Lockfile metadata: `node_modules/deepmerge-ts` = 8.0.2, registry tarball URL, integrity
`sha512-uqbvqLUMrc6p0MO+WBRtTxY55hmyh94WRwI5a++PZe54X+bfVh59FSN7uWCBCW1CCVjzjnrwzfI8zidE2obMMw==`;
the `@prisma/config` node still declares upstream `deepmerge-ts: 7.1.5` (upstream
constraint preserved in metadata; enforcement comes from the package.json override at
install time — no lockfile `overrides` marker exists in v3 format for this shape, which
is normal and does not affect frozen installs, as proven in §2). An extra movement would
have been a scope finding; none occurred. Root scripts unchanged.

## 4. Images from the changed checkout (normal build env, scripts enabled)

- Test `edu-platform-server-test:0.7.0-m7-07-override`, index
  `sha256:c1bd0493…26587a9bc1`: frozen `npm ci` 284 added / 285 audited, no engine
  warnings; `prisma generate` v6.19.3 green.
- Migrate `edu-platform-migrate:0.7.0-m7-07-override`, index `sha256:79da1089…00dac346`.
- Runtime `edu-platform-server:0.7.0-m7-07-override`, index
  `sha256:6ef05da7…841b410` (config `sha256:c6cb72ff…432677a`): prod-deps 161 packages;
  M7-03 smoke re-passed at build time (chain absent, client usable, argon2 loads).

## 5. CLI, generation, genuine config-file load, strict merges

- `npx prisma --version` in the migrate image: prisma/client 6.19.3, exit 0.
- Genuine temporary config load (isolated TEMP copy, preserved outside the application
  at `$TEMP\m7-07-cfg\prisma.config.ts`, content recorded verbatim below): nested
  `migrations.seed` block plus real copied schema/migrations, loaded through the CLI
  (`Loaded Prisma config from prisma.config.ts`, c12+deepmerge merger path with installed
  8.0.2), resolving the real schema and validating successfully, exit 0. First attempt
  without `DATABASE_URL` failed cleanly on the missing env (P1012, reported not hidden);
  with a dummy URL the schema validated. No product config was added.

```ts
import { defineConfig } from "@prisma/config";
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { seed: "node --version" },
});
```

- Tracked helper `docker/verification/m7-07-merge-check.mjs` (new; behavior gates, not a
  version-string mirror): six strict cases on BOTH the ESM and CJS entries of the
  installed 8.0.2 — nested records, array concat, undefined with explicit own-key
  presence (JSON comparison would silently drop it), null-wins, Date source-wins as Date
  instance, generator block — plus both-sides-cyclic returns without stack exhaustion
  (the GHSA-ggr8-5vv4-36mx regression; v7 RangeError re-established from packed 7.1.5 in
  a disposable container this package). Result: 14/14 PASS, exit 0 in the new test image.

## 6. Suites, migrations, failure gate (owned projects, no public ports)

- Typecheck exit 0 in the new test image.
- Fresh `m7-07-test` DB: migrate exit 0, `_prisma_migrations` count 9.
- `run --rm -e NO_COLOR=1 test` with machine-readable summaries and `$LASTEXITCODE`:
  unit 20 files / 159 tests, integration 30 files / 251 tests, overall exit 0 —
  identical to baseline, zero failures/skips, no `.skip`/exclusions/lowered assertions.
  (The 502/503 log lines are the suites' own intentional negative-path assertions.)
- Fresh `m7-07-runtime` DB: migrate exit 0, 9 rows; idempotent re-deploy →
  `No pending migrations to apply`, exit 0, still 9 rows.
- Compose-level failure gate (TEMP-only overlay, content as recorded in prior packages):
  unreachable migration DB → migrate exit 1, Compose exit 1, server stays
  `Created`/unstarted.

## 7. Final serving image + financial flows (owned private project)

Digest-verified container (`sha256:6ef05da7…` = new image): `prisma`, `@prisma/config`,
`deepmerge-ts` ABSENT; generated `libquery_engine-debian-openssl-3.0.x.so.node` present;
no `tests/` tree; user `app`. Native check in-image: real Argon2 hash/verify true;
`pg` 8.23.0, `socket.io` 4.8.3, `express` 4.22.3 load.

Strengthened M7-03 helper (unmodified) through the new image, exit 0: registrations 201,
logins 200, student-approve 403 exact FORBIDDEN, approval 200 with exact 100000 credit +
ledger match, private RECHARGE_APPROVED notice, duplicate 409, purchase 201 with exact
60000 debit / 40000 balance / exact 90-day span, renewal + zero-balance 402s. Simulated
media records prove financial behavior only — never real DRM publication/playback.

## 8. Reaudit triplet (real changed lockfile, valid JSON, exit codes)

Observed 2026-10-01 registry state (not a universal guarantee): full
`--audit-level=low` → 0 entries (0/0/0/0), exit 0; `--omit=dev` → 0 entries, exit 0;
serving `--omit=dev --omit=optional` → 0 entries, exit 0. The three Prisma highs are gone
in every scope with nothing added.

Maintenance condition (explicit): the parent `@prisma/config@6.19.3` still declares 7.1.5
upstream — this project overrides it outside that constraint. Any parent version change
or upstream adoption of a patched dependency requires reassessment; the override is a
project-maintained compatibility choice, not upstream endorsement.

## 9. Requirements, cleanup, rollback

- R10 (Docker): all resolution/installs/builds/tests/audits/fixtures ran in Docker under
  unique `m7-07-*` names/tags; host npm performed nothing.
- R11 (security/dependency verification): scoped audits, installed-tree inventory, native
  behavior, and financial evidence above; architecture unchanged.
- R13 (review evidence): machine-readable suite/audit/config results with real exit codes;
  cookie/access/wallet/notification/bilingual contracts preserved via unchanged suites +
  exact financial assertions.
- Cleanup: fixtures removed (`users=3`, receipt unlinked); guard re-resolved
  project-scoped names before each `down -v`; all `m7-07-test/runtime/fail`
  containers/networks/volumes removed (Redis anonymous-volume caveat checked — final
  volume list holds only pre-existing names). Previews, concurrent M8 work, and DRM
  untouched; no global prune, no secret output, no live DRM/media calls.
- Tracked files: `docker/verification/compose.m7-07-test.yml`,
  `compose.m7-07-runtime.yml`, `m7-07-merge-check.mjs`, this report + README row.
  TEMP-only: `m7-07-cfg/` (config + copied schema/migrations), `m7-07-run/` (fail overlay
  + empty receipt dir), `m7-07-citest/`, `m7-07-base-lock.json`, `m7-07-ref/`.
- Rollback: restore this package's `server/package.json` override block and the single
  `deepmerge-ts` lock node to the recorded pre-package state (`F39139BC`/`BD3A5891`),
  rebuild prior images. Preserves M7-03/04/05 and every M8 hunk. No database migration
  rollback involved. Never delete only the manifest override while leaving an
  inconsistent lockfile.

M7-05 separate review and production operations/capacity/commercial-DRM gates remain
distinct. No M7 completeness or acceptance is declared or inferred.
