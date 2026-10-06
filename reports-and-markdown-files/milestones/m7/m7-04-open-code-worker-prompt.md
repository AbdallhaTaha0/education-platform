# OpenCode — M7 package 04: server test-tooling security remediation

Complete this package only, submit the report and stop for manager review. Do not start package 05, commit, push or deploy.

## Objective and approved scope

Replace the server's vulnerable Vitest 2.1.9 test-tooling chain with exactly `vitest 4.1.11`, using an explicitly compatible `vite 6.4.3` dev dependency to bound Vite resolution. Remove the server's Vitest/mocker/Vite/esbuild advisory entries while preserving every existing test's behavioral assertions and the M7-03 minimal serving-image dependency assembly.

This package addresses server test tooling only. The client's Vitest 3.2.7 moderates and the Prisma build/migration chain remain separate future work. Do not upgrade client dependencies, Prisma, TypeScript or application dependencies, replace the backend module system, or change business behavior to make tests pass.

Read `AGENTS.md`, then `README.md`, `agent.md`, `rules.md`, `decisions.md`, `m7-01-manager-review.md`, `m7-03-manager-review.md`, `docker-and-operations.md` and `test-and-review-plan.md` under `reports-and-markdown-files/`. Inspect server manifests/lockfile, Vitest configuration, TS configs, Dockerfile build/test/runtime stages and all existing tests before editing.

Baseline platform HEAD remains `31ca60d3a2d832b704423060f3d55da7eae65ee3`. Preserve all uncommitted M7-01/02/03 implementation, review and index changes, including the strengthened runtime flow helper. DRM/gitlink remain `bad0c1df9f5d5844fe365c402fcccfee33ab6906`, read-only.

## Known prerequisite: npm resolver failure

The manager verified registry metadata for Vitest 4.1.11: it pins its internal mocker to 4.1.11, supports the Docker Node 22 line and permits Vite 6/7/8. The [redirect-mock advisory](https://github.com/advisories/GHSA-82fw-gwwq-j7x9) affects versions below 4.1.11; the older [UI-server advisory](https://github.com/advisories/GHSA-5xrq-8626-4rwp) also affects current server Vitest. Check current registry/advisory metadata before acting; package existence does not prove project compatibility.

In disposable manifest copies, npm 10.9.9 repeatedly failed lockfile-only resolution with `Cannot read properties of null (reading 'edgesOut')`, including direct update, remove/readd and explicitly paired Vite attempts. No resulting graph was accepted or applied to the project. Start by resolving this tooling issue in an isolated copy, not by modifying the real lockfile repeatedly.

You may use an exact, registry-verified supported npm version temporarily inside a disposable tool container if it resolves that bug. Record its version/Node engine compatibility and command; do not upgrade the production Node image or commit a global npm configuration. Do not use `--force`, `--legacy-peer-deps`, advisory suppression or blanket lockfile regeneration to hide constraints. If no supported resolution preserves the scoped graph, return the precise blocker and stop before applying a partial upgrade. A different Vitest/Vite major target requires manager review rather than silent substitution.

## Allowed files and compatibility changes

- `server/package.json`: exact Vitest 4.1.11 pin and exact Vite 6.4.3 dev pin; scripts only where the actual test invocation requires adjustment.
- `server/package-lock.json`: necessary server test-tooling dependency closure, with each changed package/path explained. Keep all application/Prisma dependency versions and the installed production graph stable.
- Server Vitest configuration and minimal test-only compatibility edits justified by the [v3 migration guide](https://v3.vitest.dev/guide/migration.html) and official v4 guidance/source. Preserve assertion meanings, cleanup ownership, concurrency, mocks and fixture behavior. If an ESM configuration file is required, a narrowly scoped `.mts` config rename plus its Docker COPY reference is allowed; do not change the Express application's CommonJS setup.
- Narrow Docker verification overrides/helpers; `m7-04-server-tooling-report.md` and its README index row.

No application source, financial/access logic, schema/migration, client/dash.js patch, runtime install omission flags, DRM source or gitlink edits. Report a genuine application defect separately instead of folding it into a test-runner migration.

## Implement and verify in Docker

1. Record baseline manifest/lockfile hashes, installed Node/npm/tool versions and the full server audit. Resolve the candidate graph in the controlled copy first. Compare the entire dependency diff before applying it; preserve all runtime package versions and explain test-only additions/removals/deduplication.
2. Build new uniquely tagged server test, migration and runtime images from the actual changed checkout through `server/Dockerfile`. A real frozen `npm ci` must succeed with lifecycle scripts enabled using the normal build environment; a lockfile-only result from an alternate tooling container is insufficient. Record resolved Vitest, mocker, Vite/esbuild and Node engines. No incompatible-engine warning is acceptable as a passing result.
3. Run server source/test typecheck and the complete existing unit/integration suites against a fresh disposable PostgreSQL/Redis database. The preceding baseline is 20 unit files/159 tests and 30 integration files/251 tests. Preserve all cases and explain any count change; no `.skip`, `.only`, excluded failing file, lowered assertion or blanket timeout increase. Keep files sequential because integration suites share a database; preserve the documented fixture/reset/bootstrap ownership rules.
4. Record machine-readable test summaries and real exit codes so stdout clipping or PowerShell `$?` does not replace evidence. If config/mock APIs changed, document the precise migration and rerun affected behavior before the final full suite. Tests must still prove money integrity, cookie/session/CSRF/role authorization, source transaction rollback, renewals/expiry, notification privacy/recovery and external contract handling.
5. Reaudit the final server lockfile. Require the Vitest/mocker/Vite/esbuild entries to be removed and no new advisory introduced; list any remaining Prisma-chain entries explicitly. Do not call the source tree clean merely because runtime omissions produce zero audit entries. Check the actual final serving image still excludes prisma/config/deepmerge-ts, retains its generated engine/native Argon2, starts as `app` and passes the strengthened M7-03 runtime API/financial flow.
6. Verify the migration image still has Prisma CLI 6.19.3, applies the same nine migrations on a fresh owned DB, and retains failed-migration startup gating. No migration/checksum or application dependency drift. Client/browser/real DRM suites need no full repeat for a server test-runner-only change unless a new failure or unexpected runtime diff requires it.

## Isolation, cleanup and rollback

Use unique M7-04 project/image/container names, private networks and newly inspected project-scoped volumes. Check resolved configuration and attachments before startup; a different Compose project name alone does not isolate explicit dev-volume names. Preserve the existing preview and earlier run evidence. Keep secrets/temporary receipts ignored and never print their values. No external DRM/media calls, paid provisioning, production migration or load run.

Before cleanup, inspect project labels and verify no existing/shared volume is selected. Remove only run-owned resources and receipts, then recheck preview health, original volumes, unchanged application/Prisma package versions and clean pinned DRM. Do not global-prune.

Rollback restores only this package's manifest/lockfile/config/test-compatibility hunks and rebuilds the preceding server images. Preserve M7-03's serving-image omission change and all other reviewed work; no database rollback is needed.

## Deliverable and stopping point

Return changed files, exact dependency/config/test diff, npm resolver disposition, before/after audits, Node/npm/image identities, actual Docker commands, machine-readable unit/integration counts, failed attempts/skips/blocks, migration/runtime/native/financial evidence, isolation/cleanup and rollback instructions. Map to R10/R11/R13 and preserved business contracts.

Submit `reports-and-markdown-files/milestones/m7/m7-04-server-tooling-report.md`, then stop. The manager reviews the actual diff and reproduces critical behavior before issuing another package. Package acceptance is not M7 owner acceptance, commercial DRM proof, production approval or 10,000-user qualification.
## Owner-required Docker test cleanup (2026-10-01)

After completing the assigned work, or after failure/interruption/stop, clean up the Docker test environment you created. Before removal, verify the exact project labels, resolved container/network/volume names and every mount; target only this assignment's owned disposable test resources and fixtures. Remove owned test containers, networks and volumes, including any owned anonymous volumes identified from container mounts. Never use global prune or delete unrelated data, the existing previews, reusable images needed for review, or saved reports/evidence. If a test resource must remain temporarily for an active check, record its owner and reason, then clean it when that check ends. Report the final cleanup verification and any resources that could not safely be removed. Every future prompt must include this requirement.
