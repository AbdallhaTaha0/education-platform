# M7 package 04 — manager review

Date: 2026-10-01. Disposition: **accepted as the bounded server test-tooling package**, after source review and independent Docker reproduction of the [worker report](m7-04-server-tooling-report.md). This does not close M7 or authorize production, commits or pushes.

## Reviewed change

Server Vitest is exactly 4.1.11 and Vite exactly 6.4.3. Scripts, configuration, source, tests, Prisma schema and migrations are unchanged. The lockfile comparison against the committed baseline contains 65 changed logical nodes: 38 common entries (37 version changes and the manifest mirror), 10 additions and 17 removals. All 197 pre-existing non-dev entries are structurally identical. The M7-03 serving-image dependency omission remains intact.

Reviewed server manifest SHA256: `F39139BCB85C53587E930A248031ACCD5AA69529935F0B0834D388542C997F51`; lockfile SHA256: `BD3A5891CF6307991AE7381501B97E81954298D90D7D7828771D3605251B9AFE`.

Fresh registry audits produced three high findings in the full and old production scope: Prisma, @prisma/config and deepmerge-ts. The serving installation scope `--omit=dev --omit=optional` produced zero findings. These are separate scopes; an empty serving audit does not resolve build/migration debt. The worker's exact npm 12.2.0 resolver has Node engines compatible with the Docker Node 22.23.3 environment. Manager image rebuilds reused validated build cache; they are not a claim of a second uncached registry installation.

## Independent evidence

- Rebuilt test, migration and serving targets from the reviewed checkout under `0.7.0-m7-04-review` tags. Serving image index: `sha256:8e18ea57645bc65e019bcf4d17c3545b3a8c8ecfd145d73f96d05d19cd7a50f4`.
- Typecheck passed. On a fresh disposable PostgreSQL/Redis project, unit tests passed 159/159 across 20 files and integration tests 251/251 across 30 files, with no failed or pending tests. The combined invocation exited 0; machine-readable Vitest results were saved.
- Actual serving-image API flows passed: native password registration/login, forbidden student approval, exactly 100000 piastres credit with ledger reconciliation, private RECHARGE_APPROVED notice, duplicate approval 409, exactly 60000 debit and 40000 remaining balance, exact 90-day access, and insufficient-funds renewal/purchase 402 responses.
- The actual non-root serving process ran as UID 999. Prisma CLI/config/deepmerge-ts and tests were absent; PrismaClient 6.19.3 constructed, its native engine remained present, native Argon2 hashing/verification passed, and pg/socket.io/express loaded.
- Both fresh test and runtime databases contained nine successfully applied migrations. The migration image's CLI remained 6.19.3. In a separate current-Compose failure drill, unreachable migration database produced P1001, migration exit 1 and Compose exit 1; the server remained created and unstarted.

Ignored local evidence is in `docker/browser/evidence/m7-04-manager/`: lock comparison/audit JSON, build logs, unit/integration JSON, runtime flow log and failure-gate log. No real DRM/media or browser retest was required by this tooling-only diff. Existing client/browser evidence remains separate.

## Cleanup and remaining work

Three owned runtime users and their fixtures were removed; the private fixture receipt was unlinked. Before removal, every mounted volume's container attachments were checked against the exact manager project label. All `m7-04-manager-test`, `m7-04-manager-runtime` and `m7-04-manager-fail` containers, networks and named/anonymous volumes were removed. Only the two pre-existing platform volumes remain. The healthy port-8082 platform preview and the intentionally retained port-8083 M8 design preview were preserved. DRM is clean at `bad0c1df9f5d5844fe365c402fcccfee33ab6906`. No commit, push or deployment occurred.

The worker's package-05-in-flight wording is historical: [package 05 implementation and same-agent verification are now complete](m7-05-client-tooling-report.md); its independent review is still pending. [M8 design work](m8-design/README.md) remains a prototype and plan, not a platform release.

The next bounded assignment is [M7-06 Prisma remediation assessment](m7-06-open-code-worker-prompt.md). It must establish a concrete compatible remedy before changing the application dependency contract. M5 formal acceptance, M7 owner acceptance, commercial DRM, production operations and capacity qualification remain separate open gates.
