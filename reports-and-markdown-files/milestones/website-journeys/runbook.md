# Journey Regression Runbook

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
