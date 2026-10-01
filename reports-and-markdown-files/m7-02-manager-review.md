# M7 package 02 manager review

Date: 2026-10-01. Reviewed the actual PostCSS manifest/lockfile diff, browser helpers, Compose override, worker report and retained evidence. Preserved all pre-existing M7-01 documentation. Platform HEAD remains `31ca60d3a2d832b704423060f3d55da7eae65ee3`; DRM and gitlink remain clean at `bad0c1df9f5d5844fe365c402fcccfee33ab6906`.

**Disposition: package 02 accepted after independent manager reproduction and a bounded verification-helper correction.** No blocking application defect remains for this PostCSS change. This is package review, not owner acceptance of M7 or production qualification. No commit/push/deployment was performed.

## Diff and findings

The client manifest changes only the exact PostCSS pin, 8.4.49 to 8.5.28. A structural comparison against HEAD proves exactly three changed lockfile nodes: the root manifest mirror, top-level PostCSS version/integrity/dependency range, and removal of the Vite-scoped duplicate. All unrelated package entries are unchanged. dash.js, application source, CSS tokens, server code and migrations are unchanged.

The worker's repaint wait sampled only the card background and heading colour and returned success on its eight-second timeout whenever a card existed. The contrast assertion itself still applied the unchanged 4.5 threshold, so this was not an observed acceptance bypass. The manager tightened the helper to sample every foreground colour used by the contrast check and return false on timeout. This is the only manager verification-code correction; no application fix was needed.

A negative control injected a heading colour equal to the card background in a private copy of the corrected runner. It failed exactly at the first contrast assertion: 12 preceding checks passed, one expected contrast failure, browser exit 1. The real runner then passed all 68 checks. This verifies that waiting for stable colours does not waive a real contrast failure. The worker's two earlier contrast failures remain reported; identical served bytes and timing-sensitive outcomes are consistent with a repaint race, not conclusive proof of every compositor detail.

Minor worker-report wording is corrected: three logical lockfile nodes span four textual diff hunks; images are retained while project resources are removed; package review does not claim session revocation coverage from a rendering-only runner.

## Actual Docker reproduction

| Verification | Result |
| --- | --- |
| Build current checkout through `client/Dockerfile`, test and runtime targets | PASS; build/COPY layers cache-validated against actual inputs |
| Client typecheck | Exit 0 |
| Full existing client tests | 70/70, 8 files, no failures/skips |
| dash.js compatibility | 2/2, no failures/skips |
| `npm ls postcss --all` | One 8.5.28 instance; all consumers deduplicated; exit 0 |
| Fresh changed-lockfile `npm audit --json` in read-only Node container | Exit 1 for two deferred moderate Vitest/mocker entries; no PostCSS/high/critical entry |
| Structural lockfile comparison | Exactly the three scoped nodes above; no other package changed |
| Corrected browser runner on fresh disposable stack | 68/68, zero failures/skips; all eight language/theme/width combinations |
| Contrast negative control | Expected contrast refusal, no unrelated failure |
| Eight screenshots | All visually inspected; correct dark/light, RTL/LTR and mobile stacking, no missing stylesheet or broken layout observed |
| Served CSS/JS hashes vs existing preview | Both assets byte-identical; preview inspection was read-only |

Reviewed image identities:

- Manager test: `edu-platform-client-test:0.7.0-m7-02-review`, index `sha256:847956499b959e8423ede360f865ad33e1b5842db4e056061f61b2a23587ea7a`.
- Manager runtime: `edu-platform-client:0.7.0-m7-02-review`, index `sha256:0055091a07114c9642cdece31bdf4e317e70e709bfda6d54e7b7c327179bc43e`; config `sha256:1dcda1fd0f087e70d17a6feaec1625b6150aac6c7509b5be2e04d06871852233`, matching the worker runtime config. Rebuilding regenerated attestations/index IDs while source/build layers were cached.
- Unchanged server: `sha256:6eb02c11ffd7b3cb24a7577c747170889d6187e698b220a9c15e8624f6d3be16`.
- Browser: `sha256:288ee8af0c68ff75231558c901e982c40979925cddcdf1e4975bd56a380656f6`.

Served asset hashes, independently read from both the disposable new client and existing preview:

- `index-DpzOW-wN.css`: `b2190b96fa690d8e7a8d0ce4ac128c08c5569b61c2c08c4f59d8b79072b9bbed`.
- `index-3JsyFGF4.js`: `0a973eadbd6e0894796ecc3dd52928697e677c057716172f54e4edd8939cc2d7`.

## Commands, isolation and cleanup

Actual main commands:

```powershell
docker build --target test --tag edu-platform-client-test:0.7.0-m7-02-review --file client/Dockerfile .
docker build --target runtime --tag edu-platform-client:0.7.0-m7-02-review --file client/Dockerfile .
docker run --rm --pull=never --name m7-02-manager-tests edu-platform-client-test:0.7.0-m7-02-review sh -c 'npm run typecheck --silent && npm test --silent && npm ls postcss --all'
docker compose -p m7-02-manager -f docker/verification/compose.m6-delivery-browser.yml -f docker/browser/evidence/m7-02-manager/compose.override.yml config --format json
docker compose -p m7-02-manager -f docker/verification/compose.m6-delivery-browser.yml -f docker/browser/evidence/m7-02-manager/compose.override.yml up -d --wait
docker cp docker/verification/m6-inbox-ui-fixtures.cjs m7-02-manager-server-1:/tmp/m6-inbox-ui-fixtures.cjs
docker exec m7-02-manager-server-1 node /tmp/m6-inbox-ui-fixtures.cjs seed
docker exec m7-02-manager-server-1 node /tmp/m6-inbox-ui-fixtures.cjs cleanup
docker compose -p m7-02-manager -f docker/verification/compose.m6-delivery-browser.yml -f docker/browser/evidence/m7-02-manager/compose.override.yml down --volumes
```

The independent audit used cached Node 22 with a read-only `/audit` client mount; Node `spawnSync` invoked `npm audit --json` with timeout 60 seconds, checked status 0/1 and valid non-error JSON, and required no PostCSS entry. Both Chromium runs used the inspected browser image with `--rm --pull=never --network m7-02-manager_default --shm-size 512m`, project label, read-only runner/receipt mounts, and an ignored evidence mount. Runner resolves internal Nginx; the browser never reached the port-8082 preview. The positive entrypoint ran the corrected tracked helper; the negative entrypoint ran its private injected copy.

Guarded resolved configuration before startup: new project name, new `m7-02-manager_pgdata`, exact rebuilt client image, no published ports or existing volume. Before fixtures, inspected server label and actual client image. Before cleanup, inspected every container's project label and every volume's attachments; no shared/existing volume was eligible for removal.

Fixture cleanup verified users=3, courses=2, events=54. Removed all six disposable services, network, inspected owned volumes and private credential receipt. Final Docker state contains only the six pre-existing preview containers and its two named volumes; all five preview services are healthy. No global prune or preview mutation. Images remain as verification artifacts.

Manager evidence is in ignored `docker/browser/evidence/m7-02-manager/positive/` (68-check JSON and eight inspected PNGs) and `negative/` (expected refusal JSON). The private receipt is absent. Original worker TEMP evidence is retained and not overwritten. This review does not claim live playback, full server/financial/DRM reruns or a production deployment; the dependency diff and byte-identical output gave no new trigger for those suites.

## Next bounded package

[M7-03](m7-03-open-code-worker-prompt.md) removes the unused Prisma CLI/config/deepmerge-ts chain from the HTTP-serving image while preserving the generated Prisma Client/engines and unchanged migration tooling. A manager feasibility probe copied only server manifests to a disposable container, then used `npm ci --omit=dev --omit=optional --ignore-scripts`. Inventory retained Prisma Client 6.19.3, argon2 0.45.1, pg 8.23.0 and Socket.IO 4.8.3 while the three unwanted packages were absent. This proves inventory feasibility only; lifecycle scripts were suppressed, so actual image builds, native hashing, database queries and migration/runtime separation must be verified by the worker before accepting any Dockerfile change.
