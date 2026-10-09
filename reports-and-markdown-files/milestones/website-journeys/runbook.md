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
