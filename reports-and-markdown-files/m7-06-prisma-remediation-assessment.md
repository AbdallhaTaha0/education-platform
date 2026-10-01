# M7 package 06 — Prisma remediation assessment

Date: 2026-10-01. Worker package: `reports-and-markdown-files/m7-06-open-code-worker-prompt.md`.
Scope: ASSESSMENT ONLY. Determine a defensible remedy for the remaining Prisma
build/migration findings (prisma / @prisma/config / deepmerge-ts highs) without touching
application manifests, lockfiles, Dockerfile, schema, or business behavior. No commit, push,
deployment, M7-complete declaration, M8 implementation, or inferred risk acceptance.

Baseline: platform HEAD `31ca60d3a2d832b704423060f3d55da7eae65ee3` (`0 0` vs origin/main);
every uncommitted M7-01…05 package file and M8 design file preserved (concurrent M8 UI and
package-05 client work continued in this tree during assessment — none of it touched here).
Server manifest SHA256 `F39139BC…F51`, lockfile `BD3A5891…FE` (unchanged, match M7-04
review). DRM checkout/gitlink clean at `bad0c1df9f5d5844fe365c402fcccfee33ab6906`,
read-only. Previews `education-platform-rs256` (:8082) and `m8-design-preview` (:8083)
kept running and untouched; other active projects/volumes (e.g. `m8-02-ui-*`) never selected.

## 1. Recommendation

**Adopt the narrowly scoped npm override `"@prisma/config": { "deepmerge-ts": "8.0.2" }`
as the follow-on implementation edit** (package.json `overrides` + regenerated lockfile
entry `deepmerge-ts 7.1.5 → 8.0.2`, single lock node, zero version drift elsewhere), **after
manager review of this assessment** — not in this package. It is a tested override, NOT a
supported upstream solution: no released @prisma/config (6.19.3 or 7.10.0) adopts
deepmerge-ts 8, so npm will always report this edge as an intended manual override.

Why this, and not the alternatives:

- **No compatible supported update exists.** @prisma/config@6.19.3 pins exact
  `deepmerge-ts 7.1.5`; the latest stable @prisma/config (7.10.0, Prisma 7 line) still pins
  exact 7.1.5. A Prisma 6→7 major upgrade would NOT remediate the finding, and its scope
  (new client/driver/engines/generator/config changes, plus Prisma 8 RC instability:
  `latest` is currently `8.0.0-rc.19`) was never approved. Rejected as remedy.
- **Doing nothing** leaves the 3-high audit entries open indefinitely in build/migration
  scope. Documented as the fallback if the owner rejects even a tested override.
- **The tested override** (this assessment): single-node closure change, advisory
  regression fixed, full suites + financial flows + migration gates green, serving image
  unchanged (chain stays excluded). Proposed follow-on edits are listed verbatim in §8.

Build/migration debt is NOT serving exposure at any point: the serving image installs with
`--omit=dev --omit=optional`, excludes this chain, and audits zero in that scope — before
and after the candidate.

## 2. Advisory facts vs reachability (no invented exploit)

Confirmed advisory facts (registry audit JSON, 2026-10-01): GHSA-ggr8-5vv4-36mx,
"DeepmergeTS has stack exhaustion when merging recursive object graphs", severity high,
CWE-674 (uncontrolled recursion), CVSS not populated in npm audit metadata (GitHub
currently reports CVSS v4 8.2; see manager review), vulnerable range `<8.0.0`
(7.1.6 included), fix release 8.0.0. Full server audit retains exactly these 3 high rollup
entries (prisma → @prisma/config → deepmerge-ts); serving-scope audit is zero.

Reachability, from the installed `@prisma/config@6.19.3` source (read-only Docker
inspection of `dist/index.js`, 1001 lines): exactly ONE deepmerge use —
`const { deepmerge } = await import("deepmerge-ts")` passed as c12's `merger` in
`loadConfigTsOrJs`, which merges layered Prisma config-file sources at CLI time
(`prisma generate` / `migrate deploy` / `validate`). Inputs are the project's local
`prisma.config.*` file (evaluated through jiti — already code execution context) plus
c12 defaults. This project HAS no `prisma.config.*` (datasource comes from `env()` in
`schema.prisma`), so the merger path is dormant for current project inputs. Remote HTTP
bodies never reach it; JSON cannot encode cycles. A cyclic payload requires a malicious
local config file, whose author already has arbitrary code execution via that same file.
A triggered overflow aborts the local CLI process (fail-closed: no migration runs).
Limited reachability does NOT erase the audit finding — it scopes its blast radius to
local build/migration tooling availability, not remote compromise or data corruption.

## 3. deepmerge-ts 8 vs actual usage

- v8.0.2 exports still include the named `deepmerge` used by @prisma/config (export map
  shape unchanged; engines `>=16.9.0`, OK on Node 22).
- 8.0.0 changelog breaking changes: `deepmergeInto` leak-mutation fix (c12 uses plain
  `deepmerge`, unaffected); TYPE-ONLY renames (MetaMetaData→MergeInfo, MM→MI,
  IntoFunctionUtils→IntoUtils) — and `@prisma/config`'s `dist/index.d.ts` contains ZERO
  deepmerge imports, so nothing typechecks against the renamed types; colliding Map-key
  merges (new deep-merge behavior — inputs here are JSON-shaped plain records, no Maps).
- Differential probe (disposable container, packed 7.1.5 vs 8.0.2): all 4
  prisma-config-shaped record merges byte-identical; both-sides-cyclic input reproduces
  `RangeError: Maximum call stack size exceeded` on 7.1.5 and returns on 8.0.2 (6/6 PASS).
  Single-sided cycles assign by reference on both versions (no recursion either way).

## 4. Candidate probe (disposable copy ONLY — project files unchanged)

- Copy: full `server/` tree to untracked TEMP (`$TEMP\m7-06-cand\server`); added the scoped
  override + an explicit experiment label to the COPY's package.json.
- npm 10.9.9 repeats its `edgesOut` resolver failure on lockfile-only re-resolution; per
  M7-04 precedent used disposable-container `npm@12.2.0` (engines `^22.22.2`, satisfied by
  Node 22.23.3) for the lockfile-only step: success, `found 0 vulnerabilities`. Then
  proved frozen install with NORMAL Docker npm 10.9.9 and lifecycle scripts enabled
  (`npm ci` green; `npm ls` shows `prisma@6.19.3 → @prisma/config@6.19.3 overridden →
  deepmerge-ts@8.0.2 overridden`, single instance). No `--force`/peer bypass/suppression.
- Closure diff vs project lockfile: EXACTLY ONE node — `deepmerge-ts 7.1.5 → 8.0.2`;
  added 0, removed 0; Prisma/client, all runtime deps, vitest/vite/typescript identical.
- Real-input CLI checks in the installed copy: `prisma --version` 6.19.3 exit 0,
  `prisma validate` → schema valid, `prisma generate` → client v6.19.3 generated,
  installed-tree merge checks 5/5 (4 record cases match v7 outputs exactly + cyclic
  handled). (Bare-node OpenSSL fallback warnings are environmental; project images ship
  OpenSSL via Dockerfile.)

## 5. Candidate image + suite + flow verification

Built from the disposable context (repo Dockerfile, unique tags): test
`sha256:41010652…`, migrate `sha256:f5095fb7…`, runtime `sha256:46f5c863…`.
Real frozen installs inside the builds; M7-03 smoke re-passed in the candidate runtime
build (chain absent, client usable, argon2 loads).

- Typecheck exit 0; fresh disposable DB migrations 9/9 exit 0; full suites with
  machine-readable summaries and `$LASTEXITCODE`: unit 20 files / 159 tests, integration
  30 files / 251 tests, overall exit 0 — identical to baseline, zero failures/skips.
- Candidate serving container (digest-verified): CLI chain absent, native
  `libquery_engine-debian-openssl-3.0.x.so.node` present, user `app`, no `tests/` tree.
- Strengthened M7-03 runtime flows (unmodified) through the candidate image, exit 0:
  registrations 201, logins 200, student-approve 403 exact FORBIDDEN, approval 200 with
  exact 100000 credit + ledger match, private RECHARGE_APPROVED notice, duplicate 409,
  purchase 201 with exact 60000 debit / 40000 balance / exact 90-day span, 402 refusals.
- Compose-level failure gate with the candidate: unreachable migration DB → migrate
  exit 1, Compose exit 1, server stays `Created`/unstarted.

## 6. Reaudit (machine-readable, exit codes recorded)

- Candidate full lockfile audit: 0 entries (all scopes zero), exit 0 — including the
  serving scope `--omit=dev --omit=optional` (0 entries, exit 0).
- Project (unchanged) full audit: still 3 highs — the debt this assessment scopes.
- Nothing was deleted, suppressed, or rewritten to manufacture zeros: the candidate
  keeps the full Prisma CLI/migration/test tooling installed (only the vulnerable
  transitive node is swapped), and the serving image exclusion is unchanged M7-03 behavior.

## 7. Commands, cleanup, files

Key commands (all Docker; disposable names `m7-06-*`; pre-run `ps/volume` inspection;
guard re-resolved project-scoped names before each `down -v`): registry `npm view`
probes; read-only `node -e` source/grep inspections; `npm pack` + tarball diff probe;
TEMP-copy override + npm@12.2.0 lockfile-only resolution; stock-npm `npm ci`; CLI
validate/generate/version; three image builds from the TEMP context; `compose.test.yml`
suite project (migrate + `run --rm -e NO_COLOR=1 test`); delivery-browser runtime project
+ strengthened flows seed/cleanup; compose-level fail-gate project with a TEMP-only
overlay; scoped reaudit triplet.

Cleanup verified: flow fixtures removed (`users=3`, receipt unlinked); all
`m7-06-cand-test`, `m7-06-cand-runtime`, `m7-06-cand-fail` containers/networks/volumes
removed; final state holds only pre-existing preview/M8 projects and volumes (concurrent
M8 containers/volumes never selected; one anonymous volume of unknown-but-not-mine
provenance left untouched — all my projects used named volumes only). No global prune,
no preview/DRM mutation, no secret output, no live DRM/media calls.

Tracked files added by this package: `docker/verification/compose.m7-06-candidate-test.yml`,
`docker/verification/compose.m7-06-candidate-runtime.yml`, this report + README row.
TEMP-only (untracked, outside the repo): `m7-06-dm8/` (tarballs, export/diff probes),
`m7-06-cand/` (candidate tree + builds), `m7-06-run/` (fail overlay + empty receipt dir).
No copied application tree, dependency directory, or raw sensitive log is tracked.

## 8. Proposed follow-on edits (for manager review — NOT applied)

1. In `server/package.json`, add the experiment label + scoped override exactly as probed:
   `"overrides": { "@prisma/config": { "deepmerge-ts": "8.0.2" } }`.
2. Regenerate `server/package-lock.json` (disposable npm@12.2.0 lockfile-only step is
   proven; verify the single-node diff before accepting).
3. Re-run: frozen `npm ci`, reaudit triplet, image trio build, typecheck, full suites,
   migration + failure gates, strengthened flows — i.e., repeat §5 against the real tree.
4. Rollback (either now or after a future apply): delete the override block (and the
   two tracked compose helpers if unwanted); TEMP contexts are already outside the repo.
   No database/schema/media rollback involved.

If the owner rejects even a tested-but-unsupported override, the honest fallback is the
status quo documented here: serving scope stays at zero findings via M7-03 exclusion,
build/migration scope keeps 3 highs with locally-dormant reachability, and no Prisma
major upgrade is recommended (7.x does not fix the finding; 8.x is release-candidate).
This assessment does not declare M7 complete, start M8 implementation, or accept risk on
the owner's behalf.

Manager follow-up, 2026-10-01: [independent review passed](m7-06-manager-review.md).
For the next implementation, the reviewed selector is specifically
`"@prisma/config@6.19.3": { "deepmerge-ts": "8.0.2" }`, with no disposable experiment
label in the application manifest. This supersedes §8's earlier unqualified selector
and label proposal. [Package 07](m7-07-open-code-worker-prompt.md) assigns the real-tree
edit and regression; rollback must restore both the package-07 manifest and lockfile
hunks consistently. No application dependency change has been made by this assessment
or its manager review. The base Redis images may create anonymous volumes; manager
cleanup checked actual mounts and attachments rather than assuming named volumes only.
