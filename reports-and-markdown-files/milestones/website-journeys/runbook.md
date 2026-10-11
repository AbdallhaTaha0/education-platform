Latest delivery authority: [owner-requested commit/push](delivery-20261010.md). Earlier uncommitted/no-push statements below describe their historical checkpoints. Remaining verification and credential handoff are unchanged.

# Journey Regression Runbook

## Persisted-pass continuation

The extended manual-handoff harness includes saved passes for both required and
optional quizzes. Its API interception remains mocked UI evidence. For current
source on a machine without the handoff images, build uniquely tagged platform
images and use a local image-only override for the disposable journey Compose:

```powershell
docker build --target runtime -f client/Dockerfile -t fayq-journey-client:20261009 .
docker build --target runtime -f server/Dockerfile -t fayq-journey-server:20261009 .
docker build --target migrate -f server/Dockerfile -t fayq-journey-migrate:20261009 .
```

Override migrate with the new migrate image, seed/server with the new server
image and client with the new client image. Keep the exact isolated DB, network
and loopback port in journey.compose.yml. Do not retag or recreate owner-preview
services. If the ignored synthetic dump is absent, run the documented seed;
recreate quizzes through Admin controls, rather than claiming prior dump state.
The seed now initializes a zero student wallet through the platform ledger helper
and preserves an existing balance. READY media fixtures are not playback evidence.

When running automated UI regressions, resolve PREVIEW_HOST_IP from the isolated
journey nginx container and attach only to that project's network. Mount the
evidence directory and harness, and label the --rm runner. Never use a regression
runner to bypass a browser access block. Actual journeys must use the currently
authorized connected browser. For simultaneous Admin/Student testing, use
separate browser authentication contexts; two ordinary tabs share cookies.

Before stopping, save any required synthetic dump to a local ignored artifact,
inspect all project labels/mounts, clean only owned resources with the exact
Compose files, and verify both named and recorded anonymous volumes are absent.
See [continuation evidence and limits](persisted-pass-continuation-20261009.md).

Run from the platform root in PowerShell with the existing local Docker preview
and reusable browser image. These initial tests create temporary browser contexts
only. Manual-handoff responses are synthetic; the public smoke uses the actual
backend read-only. Neither is the complete end-to-end milestone.

```powershell
$evidence = (Resolve-Path docker/browser/evidence).Path
$ip = docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' fayq-local-preview-nginx-1
$test = (Resolve-Path docker/browser/assessment-manual-handoff.cjs).Path
docker run --rm --name fayq-manual-matrix --label website-journey-test=20261009 --network fayq-local-preview_default --env "PREVIEW_HOST_IP=$ip" --mount "type=bind,source=$evidence,target=/evidence" --mount "type=bind,source=$test,target=/srv/browser/assessment-manual-handoff.cjs,readonly" --entrypoint node fayq-seo-browser:20261006 /srv/browser/assessment-manual-handoff.cjs
$test = (Resolve-Path docker/browser/public-journey-smoke.cjs).Path
docker run --rm --name fayq-public-journey --label website-journey-test=20261009 --network fayq-local-preview_default --env "PREVIEW_HOST_IP=$ip" --mount "type=bind,source=$evidence,target=/evidence" --mount "type=bind,source=$test,target=/srv/browser/public-journey-smoke.cjs,readonly" --entrypoint node fayq-seo-browser:20261006 /srv/browser/public-journey-smoke.cjs
docker ps -a --filter label=website-journey-test=20261009 --format '{{.Names}}'
```

The final check must show no owned test containers. Evidence is intentionally
retained in the ignored evidence directory. No test volumes or networks are
created by these commands; do not remove the shared preview network. Save new
stage evidence separately and preserve credentials and owner records.

## Hands-On Brave Batch

The owner explicitly requires actual mouse/form operation in Brave for subsequent
journeys. Automated regressions supplement but do not replace that verification.
Use the disposable configuration for destructive, financial and synthetic-write
verification:

```powershell
docker compose -p fayq-journey-authoring-20261009 -f docker/browser/journey.compose.yml up -d --wait
```

Open http://127.0.0.1:8082/ar#/login in Brave. The compose/seed contain plainly
labelled synthetic test credentials only. Use the fixture admin/student accounts,
not owner accounts. Local file chooser automation requires the owner's explicit
extension permission. DRM is deliberately unconfigured in this initial stack;
real video processing remains a later API-boundary verification stage.

Before teardown, inspect project-labelled containers and resolved mounts/volume
ownership. Remove only this exact disposable project with compose down -v; verify
project-labelled containers, networks and volumes and every recorded mounted
volume are gone. Never remove the owner preview or globally prune Docker.

Later owner clarification on 2026-10-09: defer uploads and exercise the data
already present in the retained local website through Brave. Read-only navigation,
playback and reversible notification controls can be checked there. Do not delete
owner content, submit purchases/recharges, change credentials or reclassify users
as part of that batch. Record any incidental answer draft or progress change.
Use the currently signed-in role; ask the owner to sign in as admin when needed.

## Final 2026-10-09 continuation

Brave connected and the bounded synthetic checks completed. Use the final
[persisted-pass report](persisted-pass-continuation-20261009.md) as the current
coverage ledger; preceding blocked checkpoints are historical. The final dump is
verified-synthetic-final.dump under ignored persisted-pass-20261009 evidence,
155943 bytes, SHA256 97B149C82C0C8D39F6B5FB9DA2CA797BFE75E18DD6EA5C606B0B94AC409EB262.
Restore only into an inspected disposable journey_test database with the matching
20261009 images; never the owner preview database. The final dump has manually
authored quizzes and real synthetic journey history. Forced course expiry was
restored. Synthetic credentials remain unchanged; expired/logged-out sessions
require normal sign-in. No fixture placeholder qualifies playback or bank evidence.
All owned test stacks were removed after mount/label inspection. Owner preview
remains healthy. Temporary viewport overrides reset and the two test tabs closed.

## UX continuation — 2026-10-10

Read [the current evidence and limits](ux-continuation-20261010.md). The preceding
final dump is absent on this checkout; an older dump was actually restored and a
new `docker/browser/evidence/journey-ux-20261010/ux-continuation.dump` saved locally.
Verify the exact report hash and availability before restoration. Pulling Git
does not provide ignored dumps, prior screenshots or reusable local Docker images.

Current image override: `docker/browser/journey-ux.override.yml`. Build the client
and server runtime images with tags `fayq-journey-client:20261010` and
`fayq-journey-server:20261010` using the existing Dockerfiles. Start only:

```powershell
docker compose -p fayq-journey-ux-20261010 -f docker/browser/journey.compose.yml -f docker/browser/journey-ux.override.yml up -d --wait
```

Inspect project labels, mounts and `current_database()` before copying/restoring
a dump. Stop only this project's server during restore. Use `pg_restore` inside
its PostgreSQL container; never redirect binary dump output through text handling
or restore into an owner DB. Restart the isolated server and run its seed, which
preserves existing credentials/balances. If no retained dump exists, seed and
author quiz fixtures through Admin UI; do not claim historic pass restoration.

`journey-ux-fixture.cjs` is synthetic preparation, not browser evidence. It guards
the database host/name, prepares a pending no-transfer placeholder plus three
classified monthly DRAFT courses, and has explicit expiry/restore/session modes.
Copy into this project's server `/tmp`; run Node with
`NODE_PATH=/srv/server/node_modules`. Never approve the placeholder. Expiry mode
saves original dates to `/tmp/journey-ux-subscription.json`; restore them before
recreating the server or cleanup. These modes were not used in this continuation.

Resume actual Brave at the existing authorized loopback origin only after browser
control is available. First clear the native unsaved-support dialog if necessary,
reset/reapply viewport measurements, and use normal synthetic login. No browser
fallback to get around a permission block. Credential changes, binding agreements,
uploads, real payments, external delivery and owner publication require their
respective new authorization/handoff. IDE and DRM remain unconfigured/disabled.

Offline checks used `fayq-session-client-test:20261009` with current source mounted
read-only at `/srv/client/src`, `--network none`, `--rm`, label
`website-journey-test=20261010`, running `npm test` then `npm run typecheck`.
Mocked-hook render tests are not actual browser evidence. Save a fresh dump before
cleanup, inspect every mount including anonymous Redis, and remove only this
exact project with both Compose files and `down -v`. Verify all recorded volumes,
network and containers absent and owner preview intact. No global prune.


## Resumed browser checkpoint — 2026-10-10

[Latest resumed evidence and handoff](resumed-browser-20261010.md) supersedes the preceding current interruption/pending statements. Expiry/session guidance, draft package authoring and four offer modes now have bounded actual evidence. Final Docker client total is 391 plus TypeScript and matching runtime builds. Registration awaits owner credential-entry handoff; other controls remain partial. Owned test stack remains running for that handoff, owner preview preserved. New work uncommitted/unpushed; no full-site completion or acceptance.

Rebuild BOTH client and server runtime images after any client change: server SSR must reference the matching client chunks. Restore original synthetic expiry dates before recreating server. Native datetime controls required supported fresh AX setValue followed by actual save/reload; do not infer persisted React state from a displayed DOM value alone. Cleanup after handoff must inspect current anonymous Redis mount, not reuse the earlier removed volume name.
