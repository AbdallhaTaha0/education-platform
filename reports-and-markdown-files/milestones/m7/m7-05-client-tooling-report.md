# M7 package 05 — client test-tooling security update

Date: 2026-10-01. Executor: the manager, directly assigned by the owner to perform package 05 while OpenCode performs package 04. This is implementation plus same-agent verification, not an independent review or M7 owner acceptance. No commit, push or deployment.

## Scope and concurrent ownership

Updated the client's resolved Vitest 3.2.7 to an exact `4.1.11` manifest pin. This removes its two remaining moderate audit entries, Vitest and its mocker. The [reviewed advisory](https://github.com/advisories/GHSA-82fw-gwwq-j7x9) identifies 4.1.11 as patched. Its described risk concerns development-server mock handling; this report does not claim that the static production client was exposing a test server.

Package 04 owns server test-tooling files and its report/index changes. This executor edited no server files, existing verification helpers, shared README, decision register or DRM files. Package 05 does not depend on package 04 succeeding. The shared index row is deferred until manager integration, to avoid a concurrent write with OpenCode. All package-01/02/03 changes were preserved, especially PostCSS 8.5.28.

Requirements: R10 (Docker), R11 (dependency and security verification), R13 (review/evidence); existing bilingual, cookie, playback and notification behavior is preserved. No schema, migration, configuration, environment variable, business policy or application source changes.

## Dependency change and resolver outcome

Baseline client manifest SHA256: `329c342e48925eb6337fb1ac8993684b9d3b200a514163f068f7fa0a6d785f40`.

Baseline client lockfile SHA256: `db82ababee43b23317eb54b1b607ccf8e0cd87d0c0a4b31103124202e463c0c3`.

Final client manifest SHA256: `1b50760a1e2f0ffcb6761bebd833f019624ed997907ca5194f4309a3d4d6586b`; final lockfile SHA256: `a6b89890fd991b035c0a6382e9c8ef0068059226fb7fa7fa80de7c1ef7ecc34f`.

The normal cached Node image contains Node 22.23.3/npm 10.9.9. A lockfile-only install in a disposable manifest copy failed with `Cannot read properties of null (reading 'edgesOut')`, exit 1, before any real manifest was edited. This failure is retained in ignored evidence.

Registry metadata verified npm 11.21.0 requires Node `^20.17.0 || >=22.9.0`, compatible with the existing container. Installing that exact npm temporarily inside a second disposable container resolved the same copied graph successfully. No host npm, global project configuration or Dockerfile version was changed. Both candidate attempts suppressed lifecycle scripts because they only resolved a lockfile. Actual image installation subsequently used the normal npm 10.9.9, frozen `npm ci` and enabled scripts, and passed.

Structural comparison against the pre-package client lockfile found exactly **26 changed package nodes**, including the manifest mirror. All 38 non-dev package nodes are unchanged, including integrity, dependency metadata and versions. Existing build tools are unchanged: Vite 6.4.3, esbuild 0.25.12, PostCSS 8.5.28, React plugin 4.7.0, TypeScript 5.9.3 and Node types 26.6.3. No force, legacy-peer-deps, audit suppression or blanket lockfile regeneration was used.

| Test-tooling closure | Changes |
| --- | --- |
| Root mirror | Vitest range becomes exact 4.1.11 |
| Vitest and seven internal packages | 3.2.7 → 4.1.11: expect, mocker, pretty-format, runner, snapshot, spy, utils |
| Assertion/runner dependencies | chai 5.3.3 → 6.3.0; es-module-lexer 1.7.0 → 2.3.2; std-env 3.10.0 → 4.3.0; tinyexec 0.3.2 → 1.3.1; tinyrainbow 2.0.0 → 3.2.0 |
| Newly required dependencies | @standard-schema/spec 1.1.0 and obug 2.2.1 |
| Removed old dependencies | cac, check-error, deep-eql, loupe, pathval, strip-literal and its nested js-tokens, tinypool, tinyspy, vite-node |

The [version-specific official migration guide](https://raw.githubusercontent.com/vitest-dev/vitest/v4.1.11/docs/guide/migration.md) was checked. Existing ESM configuration, Node test environment and explicit test-file include work unchanged; no config/test compatibility edits were needed. No tests, assertions, timeouts, skips or concurrency settings were modified. Registry integrity matches were verified independently for vitest 4.1.11 and @vitest/mocker 4.1.11.

## Actual Docker results

| Check | Result |
| --- | --- |
| Test image build through client/Dockerfile | Exit 0; normal frozen npm ci and dash.js postinstall successful |
| Source/test typecheck | Exit 0 |
| Complete existing Vitest suite | 8 files, 70/70 passed, zero failed/pending; JSON success true |
| Existing dash.js compatibility tests | 2/2 passed; zero failures/skips/cancellations |
| Installed dependency tree | Vitest/mocker 4.1.11; one Vite 6.4.3; one PostCSS 8.5.28, deduplicated; dash.js 5.2.1; exit 0 |
| Production build/runtime target | Exit 0, tsc and Vite build successful; normal lifecycle scripts enabled |
| Fresh full audit of installed image lockfile | Exit 0, zero findings, previously two moderates |
| Fresh production-scope audit | Exit 0, zero findings |
| Registry integrity comparison | Both patched package integrities match |
| New vs reviewed package-02 static assets | CSS, JS and index.html byte-identical |
| Runtime image configuration/rootfs | Identical config digest to reviewed package 02, UID 101 |

Build logs contain no incompatible-engine warning. Tests ran without network access. Audits ran in a separate disposable container with registry access; transport/parse failures were not treated as a clean audit.

Test image: `edu-platform-client-test:0.7.0-m7-05-tooling`, index `sha256:72b1f9d77ff1f602c8075e60a76c7b60e1479ec3cbf9768f8dc1befd2cfdaa3a`, config `sha256:fdce58a084d8ddccd3775c3826f7100e753094448782f5769b591357223b6681`.

Runtime image: `edu-platform-client:0.7.0-m7-05-tooling`, index `sha256:7802e5d2d9e007c80478230e350519832ee276cadb57a05515b58c6c8959f06a`, config `sha256:1dcda1fd0f087e70d17a6feaec1625b6150aac6c7509b5be2e04d06871852233`. Different index/attestation digests do not indicate different static content; the runtime config and file hashes match the package-02 reviewed image.

Asset SHA256 values:

- `index-DpzOW-wN.css`: `b2190b96fa690d8e7a8d0ce4ac128c08c5569b61c2c08c4f59d8b79072b9bbed`.
- `index-3JsyFGF4.js`: `0a973eadbd6e0894796ecc3dd52928697e677c057716172f54e4edd8939cc2d7`.
- `index.html`: `99fed9ee10f2e4c6c5c24f2adf4b11306c793f64c6014fba448b03b85eabbebe`.

Browser, server suites, migrations, financial flows and external DRM were not rerun in package 05. There is no application/backend/build-tool drift, and identical final static content creates no new rendering change to investigate. Earlier browser evidence remains historical evidence from package 02, not a new package-05 browser run. No production or capacity claim.

## Commands and evidence

The resolver copied only package.json/package-lock.json from a read-only client mount into `/tmp/client-candidate`. First attempt used npm 10.9.9; second used temporary npm 11.21.0. Main in-container command:

```sh
npm install --global --ignore-scripts npm@11.21.0
npm install --save-dev --save-exact --package-lock-only --ignore-scripts vitest@4.1.11
```

After comparing the candidate graph, only the two client manifest files were copied back. Actual verification commands:

```powershell
docker build --target test --tag edu-platform-client-test:0.7.0-m7-05-tooling --file client/Dockerfile .
docker build --target runtime --tag edu-platform-client:0.7.0-m7-05-tooling --file client/Dockerfile .
docker run --rm --pull=never --network none --name m7-05-client-tests --mount 'type=bind,source=A:\Projects\Work Projects\education-platform\docker\browser\evidence\m7-05-manager,target=/evidence' edu-platform-client-test:0.7.0-m7-05-tooling sh -c 'npm run typecheck --silent && npm test --silent -- --reporter=json --outputFile=/evidence/unit.json && npm ls vitest @vitest/mocker vite postcss dashjs --all'
```

Audits used a Node spawn helper invoking `npm audit --json` and `npm audit --omit=dev --json`, asserting exit 0, valid JSON and zero totals. Integrity checks used `npm view <package>@4.1.11 dist.integrity --json`. Asset comparison used network-disabled disposable runtime containers with an explicit shell entrypoint and `sha256sum` for built CSS/JS/HTML. No preview command execution was necessary.

Evidence: ignored `docker/browser/evidence/m7-05-manager/`, containing pre-package snapshots, failed npm-10 output, npm-11 candidate/audits/diff, build logs, tests.log, unit.json and final audit JSON. Evidence contains no real user credentials. Disposable tooling/test/audit/asset containers used `--rm --pull=never`; no images were pulled and no networks/volumes/fixtures or published ports were created. Built images remain as verification artifacts.

## Cleanup, rollback and review boundary

Final inspection confirms no package-05 container remains. Existing preview services stay healthy with their original two volumes. OpenCode's package-04 containers/volumes were observed and left untouched, including its anonymous volume; their cleanup belongs to that executor. Do not interpret their presence as package-05 leakage.

Platform checkpoint remains `31ca60d3a2d832b704423060f3d55da7eae65ee3`. Independent DRM/gitlink remain clean at `bad0c1df9f5d5844fe365c402fcccfee33ab6906`.

Rollback restores only the pre-package-05 Vitest manifest/lockfile closure from the preserved snapshots, retaining package-02 PostCSS and all server/package-04 work, then rebuilds client images. Never use a blanket checkout of client manifests from HEAD, because that would discard the reviewed PostCSS update. No database rollback is needed.

Changed tracked files for this assignment: `client/package.json`, `client/package-lock.json`; new `reports-and-markdown-files/milestones/m7/m7-05-client-tooling-report.md`. All existing uncommitted files remain. A proposed Compose override was briefly created during planning and removed unused; no package-05 Compose/browser stack was run or claimed.

**Disposition: implementation and same-agent verification complete; available for review.** Package-04 manager review and shared-index integration remain separate work after OpenCode returns. No package 06 work started.
