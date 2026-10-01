# M7 package 03 manager review

Date: 2026-10-01. Reviewed the actual Dockerfile diff, new Compose overrides, runtime flow helper and worker report. All earlier uncommitted M7-01/02 changes are preserved. Platform HEAD remains `31ca60d3a2d832b704423060f3d55da7eae65ee3`; independent DRM/gitlink remain clean at `bad0c1df9f5d5844fe365c402fcccfee33ab6906`.

**Disposition: package 03 accepted after independent manager reproduction and strengthened verification assertions.** No blocking application/image-packaging finding remains for its bounded scope. M7 owner acceptance, production deployment, commercial DRM and capacity qualification remain open. No commit/push/deployment belongs to this review.

## Source and verification review

The only new product-impacting change is the two Dockerfile hunks: `prod-deps` omits dev and optional dependencies with lifecycle scripts enabled, and the final image asserts CLI/config/deepmerge-ts absence while constructing Prisma Client and loading Argon2. The full build/test/migration assembly, generated client/native engine copies, non-root user, application source and migration history are unchanged. Server manifests/lockfile are unchanged; the previously reviewed client PostCSS change is preserved.

The worker helper rounded subscription duration to days and accepted any inbox row as approval-notice evidence. The manager strengthened only that test helper: require the exact 90-day millisecond difference; require a RECHARGE_APPROVED notice; confirm the other student has no private notice; confirm duplicate approval leaves the 100000-piastre balance unchanged; assert the exact FORBIDDEN code. No application correction or relaxed assertion was needed. The strengthened flow passes against the final runtime.

The worker's standalone failed migration command proves job refusal but does not itself demonstrate a dependent service was blocked. The manager exercised actual Compose startup with an unreachable migration database and verified the server stayed in `created` state with `Running=false`, while the migration and Compose both exited 1. The required startup dependency gate is now reproduced, not merely inferred.

## Actual independent Docker evidence

| Check | Result |
| --- | --- |
| Current checkout builds: runtime, migrate and test targets | PASS; relevant source/build layers cache-validated |
| Server source/test typecheck | PASS, exit 0 before full CI |
| Full server CI on fresh isolated PostgreSQL/Redis | Exit 0; integration 30 files / 251 passing tests |
| Unit count verification | 20 files / 159 tests, zero failed/pending, JSON summary success true |
| Fresh migrations | Nine completed rows independently verified in both test and runtime databases |
| Final runtime inventory | prisma, @prisma/config, deepmerge-ts and pg-cloudflare absent; src/tests trees absent; non-root UID 999 |
| Native runtime smoke | Generated `libquery_engine-debian-openssl-3.0.x.so.node` present; Prisma Client constructs; real Argon2 hash/verify succeeds |
| Supported final-runtime API/financial flows | PASS: registration/login, 401/403, exact 100000 credit, reconciliation, private approval notice, duplicate 409 without credit, 60000 purchase/40000 balance, exact 90-day entitlement, 402 refusals |
| Migration image CLI | Prisma/client 6.19.3, CLI version command exits 0 with network disabled |
| Actual failed-migration startup | Migration exit 1, Compose exit 1, dependent server never starts |
| Full source-lockfile audit | Eight entries: 1 critical / 4 high / 3 moderate, preserved |
| Old serving-install audit scope (`--omit=dev`) | Three high Prisma-chain entries |
| New serving-install audit scope (`--omit=dev --omit=optional`) | Zero entries, exit 0 |

Installed-package inspection and actual native/database/financial behavior establish serving-image compatibility; the full-tooling tests alone would not. Audit omission scopes match the respective install flags and do not erase the source-lockfile findings. Build/migration/test vulnerabilities remain separate debt.

The full CI output was large enough that tool delivery clipped its unit aggregate. CI exit 0 and integration 251 were retained. Only the short unit suite was rerun with JSON reporting to verify its exact 159-test/20-file summary; the full integration suite was not repeated. Intentional readiness/outage tests emit error logs; the full CI passed with no unexpected failure.

## Image identities and commands

Independent current-checkout rebuilds produced:

- Runtime `edu-platform-server:0.7.0-m7-03-review`: `sha256:a2f54c8aa137210ac3921c9d3067d1ebbca58a485a6aa9cd4b42321b016b9965`; runtime config `sha256:519a8ea3eb12173aa02eadda98ccaee749feccb163cb497594ebab2b3aed4713`, matching the worker config.
- Migrate `edu-platform-migrate:0.7.0-m7-03-review`: `sha256:1eeba07bdf79cd008077f17ba771f826a182f7fcac5b09f55e9a701ca17a7c22`.
- Test `edu-platform-server-test:0.7.0-m7-03-review`: `sha256:81897b91cd3ec87a8e19bffb3cd6c321cf722d27855d8e93626caf5d4ff82fbd`.

Index IDs changed on rebuilt attestations while relevant layers were cached. This is not source drift; the reviewed runtime was inspected against the actual serving container before fixtures.

Main reproduced commands:

```powershell
docker build --target runtime --tag edu-platform-server:0.7.0-m7-03-review --file server/Dockerfile .
docker build --target migrate --tag edu-platform-migrate:0.7.0-m7-03-review --file server/Dockerfile .
docker build --target test --tag edu-platform-server-test:0.7.0-m7-03-review --file server/Dockerfile .
docker compose -p m7-03-manager-test -f docker/compose.test.yml -f docker/browser/evidence/m7-03-manager/compose.test.yml up -d --wait postgres redis migrate
docker compose -p m7-03-manager-test -f docker/compose.test.yml -f docker/browser/evidence/m7-03-manager/compose.test.yml run --rm test sh -c 'npm run typecheck --silent && npm run test:ci --silent'
docker compose -p m7-03-manager-runtime -f docker/verification/compose.m6-delivery-browser.yml -f docker/browser/evidence/m7-03-manager/compose.runtime.yml up -d --wait
docker cp docker/verification/m7-03-runtime-flows.cjs m7-03-manager-runtime-server-1:/tmp/m7-03-runtime-flows.cjs
docker exec m7-03-manager-runtime-server-1 node /tmp/m7-03-runtime-flows.cjs seed
docker exec m7-03-manager-runtime-server-1 node /tmp/m7-03-runtime-flows.cjs cleanup
docker compose -p m7-03-manager-fail -f docker/verification/compose.m6-delivery-browser.yml -f docker/browser/evidence/m7-03-manager/compose.runtime.yml -f docker/browser/evidence/m7-03-manager/compose.fail.yml up -d --wait server
```

The final command is expected to fail: the additional private override sets only the migration job's URL to unreachable localhost. Both live database migration counts used `psql` against the run-owned PostgreSQL with `SELECT COUNT(*) FROM "_prisma_migrations" WHERE finished_at IS NOT NULL`. The runtime inventory/native check used `--network none --entrypoint node` and inspected package paths, UID, native engine and actual Argon2 hash/verify. Migration CLI verification directly invoked `node_modules/prisma/build/index.js --version` without network. Audit validation used a read-only server mount in cached Node 22, `spawnSync` with a 60-second timeout, npm status 0/1 and valid non-error JSON.

## Isolation, cleanup and remaining limits

All three projects were new, with inspected project-scoped volumes and no published ports. Test and final-runtime databases were distinct. Before API fixtures, verified server project label and exact image identity. Before cleanup, inspected all containers' project labels and volume attachments, refusing existing/shared volumes. The strengthened helper removed only its three owned users and linked course/financial/notification/audit rows and unlinked the credential receipt inside the disposable server.

Removed all three projects, their private networks and unshared owned volumes. Final Docker state has only the six pre-existing preview containers, five healthy services and its two named volumes. The preview was never recreated, stopped or mutated; DRM remains untouched. No secret values, live external operations or global prune. Images remain as build evidence; private Compose/evidence artifacts remain ignored.

Rollback remains selecting only this package's Dockerfile/verification hunks and rebuilding the prior runtime, without schema/data/media rollback. No browser/CSS matrix or external DRM suite was rerun for this packaging-only change; previous client output and accepted M6 behavior are preserved.

## Next-package preparation

[M7-04](m7-04-open-code-worker-prompt.md) addresses only the server's vulnerable Vitest/Vite test-tooling chain. Registry metadata confirms Vitest 4.1.11 exists, pins its mocker to 4.1.11 and supports the Docker Node 22 line. A 5.0.3 metadata comparison was also made; no version change was applied to project files.

Scratch lockfile-only resolution with npm 10.9.9 failed with `Cannot read properties of null (reading 'edgesOut')`: direct Vitest update, diagnostic repeat, remove/readd and explicitly paired Vite 6.4.3 attempts all encountered that resolver error. Every attempt was confined to a disposable container copy with scripts suppressed; no project manifest/lockfile was changed and no candidate graph or test compatibility is claimed. The next prompt records this prerequisite instead of inventing a resolved upgrade. The worker must use supported resolution, preserve peer constraints and prove the resulting scoped graph before accepting the dependency change.
