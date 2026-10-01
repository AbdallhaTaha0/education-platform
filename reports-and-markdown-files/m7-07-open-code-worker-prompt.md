# OpenCode — M7 package 07: apply the reviewed Prisma dependency remedy

Execute this package only, then stop for manager review. Read AGENTS.md, the index, agent.md, rules.md, decisions.md, the M7-03/04 reviews, the M7-06 assessment and **m7-06-manager-review.md**. Preserve all existing uncommitted M7/M8 changes, especially client source/assets, both design previews and the external DRM pin. No commit, push, production deployment or package-08 work.

## Assignment and reviewed baseline

The manager independently reproduced the M7-06 candidate: a one-node merge dependency replacement, frozen stock-npm installs, advisory negative control, actual config-file loading, all 410 server tests, native serving behavior, financial/notification flows, nine migrations and startup refusal on migration failure. The candidate is suitable for bounded implementation. It is a tested compatibility override, not an upstream-supported update.

Apply exactly this **version-qualified** parent override in `server/package.json`:

```json
"overrides": {
  "@prisma/config@6.19.3": {
    "deepmerge-ts": "8.0.2"
  }
}
```

The worker assessment's earlier unqualified selector is superseded by the manager review. Do not copy its disposable `//m7-06-experiment` field into the application. No direct deepmerge dependency, broad global override, Prisma major update or audit suppression.

## Work in order

1. Record current checkout, hashes, Docker image/resource ownership and clean DRM pin. Current server manifest and lockfile hashes should match the M7-06 manager record. If unrelated work has changed them, compare the actual changes before proceeding; do not overwrite concurrent edits or reset the tree. Existing M8 client code must remain untouched.

2. Add the single override block and regenerate the real server lockfile through a disposable Docker resolver. Normal npm 10 may repeat its edgesOut bug; the exact npm 12.2.0 resolver on the verified Node 22 image is an allowed tool prerequisite. Record its engines, actual failures and result. Use lockfile-only resolution with install scripts disabled for that resolver step; subsequently prove a real frozen install with normal image npm and lifecycle scripts enabled. No force, legacy peer flags, manual integrity substitution or host npm.

3. Compare the complete dependency closure against the reviewed current baseline. The expected installed lockfile change is **only node_modules/deepmerge-ts 7.1.5 → 8.0.2**, with its correct integrity/metadata. All Prisma/client/runtime/test-tool versions and package scripts must remain unchanged. Account for any root manifest mirror metadata explicitly. An extra package movement is a finding to resolve, not permission to expand scope. Verify one installed 8.0.2 instance and the intended exact-parent override with npm ls.

4. Preserve the server Dockerfile, schema, SQL migrations, test configuration and product source. Build fresh unique test/migration/runtime tags from the actual changed checkout. Keep full build/test/migration installs; serving dependencies retain `--omit=dev --omit=optional`, generated engines and non-root execution. Do not change stage assembly or drop CLI functionality merely to obtain a clean audit.

5. Verify CLI version 6.19.3, actual schema validation/client generation, and a genuine temporary config-file load in an isolated copy. Preserve that generated test config outside the application. Include meaningful old-version cyclic failure versus candidate handling and strict representative record/array/undefined/null merges. Avoid JSON-stringification comparisons that silently discard undefined properties. A narrowly useful tracked verification helper is allowed; no new product config or tests that merely mirror the override string.

6. Run unchanged full server typecheck, 159 unit and 251 integration tests against fresh project-owned PostgreSQL/Redis. Save machine-readable results and real exit codes, without skips, lowered assertions or compatibility changes unless an evidenced defect is separately reviewed. Apply nine migrations from empty state, re-run deploy to prove idempotence, and use current Compose to prove unreachable migration database exits nonzero and leaves the server unstarted.

7. Inspect the actual final serving image. Assert prisma/@prisma/config/deepmerge-ts absence, generated client/native engine presence, native Argon2 hash/verify, required pg/socket.io/express loading, no source/test tree and non-root user. Reuse the strengthened M7-03 financial helper only in an owned private project: real cookie login/authorization, exact approval and ledger credit, recipient-only notification, duplicate handling, purchase debit/balance/exact-duration and insufficient-funds refusals. Its simulated media records prove financial behavior, never real DRM publication/playback.

8. Reaudit the real changed lockfile and actual applicable install scopes: full build/test/migrate, omit-dev, and serving omit-dev/optional. Expected result: zero entries, valid JSON, exit 0. Record metadata/time and distinguish this observed registry state from a universal security guarantee. Keep explicit documentation that the parent still declares 7.1.5 upstream and the project overrides it outside that constraint; an eventual Prisma config version change requires reassessment.

## Isolation and deliverable

Use unique `m7-07-*` disposable projects and tags with no public ports. Inspect resolved volumes, labels, bind paths and existing attachments before starting or deleting resources. Docker base Redis may create anonymous volumes: inspect container mounts rather than assuming all volumes are named in Compose. Remove only exclusively owned fixtures/receipts/containers/networks/volumes. Preserve `education-platform-rs256`, `m8-design-preview`, `m8-ui-preview`, unrelated work and independently deployed DRM. Never prune globally or print actual secrets.

Save `reports-and-markdown-files/m7-07-prisma-override-report.md`, add one index row from the fresh current README, and document exact edits, hashes, scoped override maintenance condition, install/resolver outcomes, image identities, actual commands, full suite/audit/config/migration/runtime evidence, failures and cleanup. Requirements: Docker R10, security/dependency verification R11, review evidence R13; unchanged architecture, cookie, access, wallet, notification and bilingual contracts.

Rollback restores only this package's override and deepmerge lock node to the recorded pre-package state and rebuilds previous images. Preserve M7-03/04/05 and every M8 source hunk. No database migration rollback is involved. Do not propose blanket checkout/reset or deleting only the manifest override while leaving an inconsistent lockfile.

Stop with the changed-file list and evidence for manager review. Do not declare M7 complete or independently reviewed from this self-report, infer owner acceptance, deploy, start load qualification or make unrelated UI/DRM changes. M7-05 separate review and production operations/capacity/commercial DRM gates remain distinct.
## Owner-required Docker test cleanup (2026-10-01)

After completing the assigned work, or after failure/interruption/stop, clean up the Docker test environment you created. Before removal, verify the exact project labels, resolved container/network/volume names and every mount; target only this assignment's owned disposable test resources and fixtures. Remove owned test containers, networks and volumes, including any owned anonymous volumes identified from container mounts. Never use global prune or delete unrelated data, the existing previews, reusable images needed for review, or saved reports/evidence. If a test resource must remain temporarily for an active check, record its owner and reason, then clean it when that check ends. Report the final cleanup verification and any resources that could not safely be removed. Every future prompt must include this requirement.
