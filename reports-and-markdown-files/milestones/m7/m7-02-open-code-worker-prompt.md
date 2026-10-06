# OpenCode — M7 package 02: bounded PostCSS security update

Complete this package only, submit evidence, then stop for manager review. Do not begin package 03, commit, push or deploy.

## Objective and prerequisites

Update the client's directly pinned PostCSS from `8.4.49` to exactly `8.5.28` and verify the affected dependency graph, build and rendered UI in Docker. M7-01's registry audit identifies this as a same-major fix; this assignment authorizes that bounded update, not broad dependency remediation.

Read root `AGENTS.md`, then `README.md`, `agent.md`, `rules.md`, `decisions.md`, `design.md`, `../m6/m6-owner-acceptance.md`, `m7-01-readiness-report.md`, `m7-01-manager-review.md`, `docker-and-operations.md` and `test-and-review-plan.md` under `reports-and-markdown-files/`. Inspect `client/package.json`, its lockfile, `client/Dockerfile`, PostCSS/Tailwind/Vite configuration, dash.js patch/tests and existing browser verification helpers.

Expected platform baseline: `31ca60d3a2d832b704423060f3d55da7eae65ee3`. Preserve all existing uncommitted M7 report/review/prompt/index changes. Record newer commits instead of resetting. DRM checkout and gitlink remain `bad0c1df9f5d5844fe365c402fcccfee33ab6906`, read-only.

The corrected M7-01 review identifies installed Prisma-chain server exposure, not just dev-tool findings. That remains a separate future package. Do not upgrade Prisma, Vitest, Vite, React, dash.js or any server dependency here. Keep `dashjs 5.2.1` and its compatibility patch intact. No new business policy is required for this package.

## Allowed changes

- `client/package.json`: change only the PostCSS pin.
- `client/package-lock.json`: update PostCSS and only its necessary transitive resolution/integrity closure. Explain each changed package; do not accept a blanket lockfile refresh.
- Add a narrow M7-02 Docker/browser verification artifact if existing helpers cannot verify the newly built client safely. Keep it under `docker/verification/` or `docker/browser/`; no application test endpoint or security bypass.
- Add `reports-and-markdown-files/milestones/m7/m7-02-postcss-report.md` and its README index row. Preserve prior reports and evidence.

No application, CSS token, schema, migration, server configuration, external DRM or gitlink edits are planned. If a genuine compatibility defect requires other source changes, reproduce it and report the precise affected files before expanding this package.

## Implementation sequence

1. Inspect Docker resources and existing preview ownership. Record baseline lockfile hashes, resolved package versions and fresh client audit. The current expected audit is one PostCSS high entry plus two Vitest/mocker moderate entries, but report actual registry results.
2. Verify `postcss@8.5.28` metadata and compatible Node engines using Docker. Update the manifest/lockfile inside a disposable Node 22 container. A suitable bounded operation is `npm install --save-dev --save-exact --package-lock-only --ignore-scripts postcss@8.5.28`, applied to a controlled copy or the authorized client mount. Review the full diff immediately. Use the existing npm/lockfile format and reject unrelated version drift; do not use `npm audit fix --force`.
3. Build unique M7-02 client test and runtime images from the actual changed checkout through `client/Dockerfile`. Run a clean `npm ci` through those images so the guarded dash.js postinstall is exercised. Host Node/npm must not replace Docker installs/builds/tests.
4. Record `npm ls postcss --all`, check the installed exact direct version and every affected PostCSS instance, and rerun the client audit. Require no remaining PostCSS advisory and no newly introduced finding. Remaining Vitest/mocker moderate findings are explicitly deferred, not disguised as a clean full audit. If remediation needs an unrelated dependency upgrade, report the dependency path and stop that expansion.

## Required verification

- Client typecheck, full existing client test suite and both dash.js compatibility tests, with actual counts and exit codes. Do not rewrite tests merely to make them pass.
- Production client build and a served-bundle/stylesheet smoke from the newly built runtime image. Record image IDs and prove the browser reached this image, rather than the older port-8082 preview.
- Docker Chromium checks against a separately named disposable platform/Nginx stack. Use actual supported cookie login/API flows and only run-owned fixtures. Reuse M6 fixture/helpers where appropriate; inspect their assumptions first. The existing `m6-inbox.mjs` hardcodes a host-gateway route, while `m6-realtime.mjs` supports internal Nginx resolution. Adapt routing in a bounded verification helper if needed; do not accidentally browse the existing preview.
- Exercise Arabic/RTL and English/LTR, dark and light themes, at desktop and approximately 390px mobile width. Cover the common navigation, rendered text, buttons and notification inbox/read controls. Check stylesheet loading, no page errors, no horizontal overflow, theme/direction state and keyboard access. Save screenshots for all eight language/theme/width combinations and visually inspect them for broken layout or missing styles. Synthetic inbox fixtures must be labelled; they do not prove external playback or real bank receipt.
- Preserve transient credentials and the existing cookie/session/CSRF contract. Do not perform live DRM/media operations or rerun full server, money, crash/failover and DRM suites for a client build-tool-only change unless a new failure demonstrates the need.

## Isolation and cleanup

Use unique M7-02 image tags, project/container/network names and disposable volumes. Read resolved Compose configuration and inspect attachments before startup. `compose.dev.yml` contains explicit development volume names; changing just the project name is insufficient. Prefer the private M6 browser Compose as a reviewed base with explicit M7 image overrides and no public ports.

Do not recreate, stop or mutate the existing preview. Keep credentials, temporary fixture receipts and screenshots in ignored evidence paths. Cleanup must verify ownership before removing only run-created resources; never global-prune or delete existing data. Verify preview health, unchanged existing volumes and clean DRM afterward. An unavailable old image-index ID is not permission to bypass image provenance checks.

Rollback for this package means reverting only its manifest/lockfile hunks and rebuilding the earlier client image. No database rollback, migration or external media repair is involved.

## Deliverable and stopping point

In `m7-02-postcss-report.md`, provide the changed-file list, exact manifest/dependency diff, before/after audit entries, package/runtime image identities, Docker commands actually run, test/browser counts, screenshot paths and visual findings, failures/skips/blocks, cleanup and rollback instructions. Map to R10/R11/R13 and preserved D22/FAYQ and D25 behavior where relevant. State that no production deployment or 10,000-user capacity claim was made.

Submit the report and stop. The manager will inspect the actual changes and reproduce important checks before issuing the next package. The owner has accepted M6; M7 acceptance is still a future gate.
## Owner-required Docker test cleanup (2026-10-01)

After completing the assigned work, or after failure/interruption/stop, clean up the Docker test environment you created. Before removal, verify the exact project labels, resolved container/network/volume names and every mount; target only this assignment's owned disposable test resources and fixtures. Remove owned test containers, networks and volumes, including any owned anonymous volumes identified from container mounts. Never use global prune or delete unrelated data, the existing previews, reusable images needed for review, or saved reports/evidence. If a test resource must remain temporarily for an active check, record its owner and reason, then clean it when that check ends. Report the final cleanup verification and any resources that could not safely be removed. Every future prompt must include this requirement.
