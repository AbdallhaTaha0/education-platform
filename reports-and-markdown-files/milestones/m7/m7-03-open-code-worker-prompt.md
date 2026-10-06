# OpenCode — M7 package 03: remove unused Prisma CLI from the serving image

Complete this package only, return evidence, then stop for manager review. No commit, push, production deployment or package 04 work.

## Objective and authority

Remove the unused `prisma` CLI, `@prisma/config` and `deepmerge-ts` packages from the platform HTTP-serving runtime image. Preserve Prisma Client, its generated native query engine, every required application dependency, and the independent one-shot migration image's CLI capability.

The M7-01 manager review proved these packages are currently installed in the serving image despite `npm ci --omit=dev`, and the production-tree audit reports three high rollup entries for one underlying deepmerge-ts advisory. This package reduces serving-image exposure; it does not patch the remaining build/migration toolchain or prove a remotely reachable exploit. Do not claim that all dependency security work is complete afterward.

Read `AGENTS.md`, then `README.md`, `agent.md`, `rules.md`, `decisions.md`, `m7-01-manager-review.md`, `m7-02-manager-review.md`, `docker-and-operations.md` and `test-and-review-plan.md` under `reports-and-markdown-files/`. Inspect `server/Dockerfile`, manifests/lockfile, Prisma generation and engine-copy steps, existing runtime smoke, migrations and Docker verification stacks.

Platform baseline remains `31ca60d3a2d832b704423060f3d55da7eae65ee3`; preserve all accepted-but-uncommitted M7-01/02 changes, including the manager's browser stability correction. DRM checkout/gitlink remain clean at `bad0c1df9f5d5844fe365c402fcccfee33ab6906`, read-only. This prompt authorizes bounded image packaging and verification changes, not dependency-major upgrades or business changes.

## Allowed implementation

- `server/Dockerfile`: narrowly adjust only production dependency installation/runtime assertions needed to exclude the unused CLI chain. Retain the separate full build/test/migration dependency assembly and non-root runtime.
- Narrow Docker verification artifacts under `docker/verification/` or `docker/browser/` to reproduce installed-package absence, native runtime operation, migrations and supported API behavior.
- `reports-and-markdown-files/milestones/m7/m7-03-runtime-dependencies-report.md` and its README row; update operational wording only where directly affected.

No manifest/lockfile version upgrades, schema/migrations, application source, client changes, DRM internals or gitlink changes are planned. If a required application dependency cannot operate with the bounded packaging change, reproduce the failure and report it before expanding scope. Do not work around it by copying the full build-stage node_modules into runtime.

## Investigate and implement one minimal change

1. Record before-state installed package paths/versions in the serving image and the server lockfile's `devOptional`/peer metadata. Distinguish the installed filesystem from the full lockfile audit.
2. The manager's disposable inventory probe used `npm ci --omit=dev --omit=optional --ignore-scripts`. It retained Prisma Client 6.19.3, argon2 0.45.1, pg 8.23.0 and Socket.IO 4.8.3, while the three CLI-chain packages were absent. This is only a feasibility hint: lifecycle scripts were suppressed, so it did NOT prove native or application compatibility.
3. Evaluate `npm ci --omit=dev --omit=optional` specifically in the `prod-deps` stage. Follow the [npm 10 documentation](https://docs.npmjs.com/cli/v10/commands/npm-ci/). Leave lifecycle scripts enabled in the real image build and preserve frozen lockfile installs. Inspect all omitted optional packages and confirm none is needed by the serving application. Do not apply omission to the full build, test or migration stages or globally through an npm configuration file.
4. Preserve the existing generated `@prisma/client` and `.prisma/client` copies, required OpenSSL/native libraries and construction smoke. Add an image-build assertion that the CLI/config/deepmerge-ts package directories are absent from FINAL runtime and the generated client remains usable. Keep version pins unchanged; no broad pruning/manual engine deletion.

If this candidate does not preserve runtime behavior, submit the exact failure and a narrower alternative for review rather than weakening tests or removing required components.

## Docker verification gates

Build unique M7-03 tags from the actual changed checkout for server runtime, migration and test targets. Do not overwrite or recreate the existing preview. Inspect ownership and resolved Compose configuration before any isolated startup.

Require:

- Frozen installs and successful server typecheck/build. Existing unit/integration suites pass against fresh disposable PostgreSQL/Redis, with actual counts and failures/skips reported. Tests running with full dev dependencies are regression evidence, not proof of the final runtime's package selection.
- Direct inspection of FINAL runtime: unwanted CLI/config/deepmerge-ts directories absent; Prisma Client and its exact generated query engine present. Runtime starts as the existing non-root user and has no copied full build dependency tree.
- Real final-runtime database operations against the isolated migrated database: Prisma Client construction AND successful query/write, not require-only. Exercise normal registration/login/CSRF and Argon2 hash verification, authenticated catalog/inbox reads, and a run-owned admin recharge approval/student purchase flow proving wallet/subscription writes still work. Inspect exact financial results and authorization failures. Use supported APIs and existing labelled fixture helpers; do not add a test-only application route or access DRM persistence.
- New migration image retains Prisma CLI, successfully applies all nine existing migrations on a fresh owned database, and rejects an unreachable database with nonzero exit before dependent application start. Keep migration history/checksums unchanged. Record that its full dependency chain remains separate security debt.
- Compare serving-image audit/inventory before and after using omission flags matching its actual install. A full source-lockfile audit can still include development/optional tooling: preserve that result and explain why it differs. Never edit audit JSON, lock metadata or severities to manufacture a clean result.
- Confirm reviewed PostCSS client and M6 behavior are preserved. Use the M7-02 client image in any browser stack. Full CSS/theme screenshots and external playback suites need no repeat for a server packaging-only change unless a new failure supplies a reason.

## Isolation, cleanup and rollback

Use a unique M7-03 project with new project-scoped PostgreSQL/Redis volumes, private networking and no published dependency ports. `compose.dev.yml` has explicit development volume names: a different project name alone is unsafe. Reuse reviewed private test/browser bases only with inspected image overrides and owned mounts.

Do not touch existing preview services/data, regenerate local signing keys, expose environment values, call live DRM/media endpoints or run external load. Keep temporary credentials and receipts ignored. Before cleanup, inspect labels, resolved volumes and attachments; delete only unshared run-owned resources. Recheck preview health, original volumes and clean DRM. No global prune.

Rollback reverts only this package's Dockerfile/verification hunks and rebuilds the previous runtime. No database rollback, data deletion, schema change or external maintenance is needed.

## Report and stopping point

Return changed files, exact Dockerfile diff, before/after installed-package inventory and image IDs, omission rationale, actual commands, unit/integration and final-runtime API results, native-engine/Argon2 evidence, migration failure result, audit scope/remaining debt, failures/skips/blocks, cleanup and rollback instructions. Map to R10/R11/R13 and preserved wallet/subscription/notification contracts.

State explicitly: serving-image exposure reduced does not remediate build/migration tooling, prove commercial DRM, authorize production or qualify 10,000 users. Stop after submitting `m7-03-runtime-dependencies-report.md`; the manager reviews and reproduces critical behavior before issuing another package.
## Owner-required Docker test cleanup (2026-10-01)

After completing the assigned work, or after failure/interruption/stop, clean up the Docker test environment you created. Before removal, verify the exact project labels, resolved container/network/volume names and every mount; target only this assignment's owned disposable test resources and fixtures. Remove owned test containers, networks and volumes, including any owned anonymous volumes identified from container mounts. Never use global prune or delete unrelated data, the existing previews, reusable images needed for review, or saved reports/evidence. If a test resource must remain temporarily for an active check, record its owner and reason, then clean it when that check ends. Report the final cleanup verification and any resources that could not safely be removed. Every future prompt must include this requirement.
