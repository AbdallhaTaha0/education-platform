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
