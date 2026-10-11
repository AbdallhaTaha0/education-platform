# Railway migration from GitHub — 2026-10-07

Owner approved direct GitHub builds instead of private registry deployment.
Railway private-registry authentication requires Pro; the current account shows
a trial. This changes artifact delivery, not the API or persistence architecture.
Preparation is on `dev`, the testing service selects `testing`, and production
release remains on `deployment` after qualification. IDE stays disabled.

## Dedicated migration image

`docker/railway/platform-migrate.Dockerfile` uses the root repository context,
existing server lockfile, Node 22, OpenSSL and platform Prisma schema/migrations.
It runs as `app`, and its default command is `npx prisma migrate deploy`.
No frontend, web server, tests, DRM files or local environment files are copied.
Locked development dependencies are deliberately installed because Prisma CLI
is a development dependency; this is a one-shot tooling image, not a web image.
It needs no Railway build-target option or container-registry token.

## Service setup

Keep the existing `platform-migrate` service, no public networking and restart
policy `Never`. Set `DATABASE_URL=${{platform-postgres.DATABASE_URL}}`.
Set `RAILWAY_DOCKERFILE_PATH=docker/railway/platform-migrate.Dockerfile` before
connecting GitHub. Root Directory must be repository root, not `server/`.
Select `AbdallhaTaha0/education-platform`, branch `testing`; verify the candidate
commit before deployment. Disable automatic deployment for this migration job
if supported; run reviewed migrations deliberately before updating web services.
Require exit 0 and Prisma's completed migration output, not merely a green build.
A later repeat must report no pending migrations. A failure blocks backend start.

No database credentials belong in build arguments, Dockerfiles or this report.
Never connect this job to DRM PostgreSQL. Never drop migration records or owner
data to fix a deployment. Postgres/Redis cloud startup screenshots are not proof
of application authentication, SSL configuration or restart persistence.

The existing `.railway/railway.ts` describes registry-image sources. Do not apply
it over these GitHub-built services: it would change sources and still expects
published digests. Import/reconcile any managed graph before a future IaC apply.
The historical migration JSON is not required for this dashboard setup.

## Local verification

Use `docker/railway/verify-migrate.compose.yml` with a fresh disposable project.
No owner environment file, published port, external volume or DRM is used.
Build the migration image, apply the actual migrations to PostgreSQL 16, repeat,
inspect successful migration rows and verify an unreachable database exits nonzero.
Inspect non-root runtime, CLI availability and absence of source/environment files.
Before cleanup, verify project labels, volume ownership and actual mounts; then
remove only this project's containers/network/volume even if verification fails.
Preserve the owner preview, real media and reusable images.

Docker evidence: image `fayq-railway-migrate:github-20261007` built successfully
(`fe44126d3ad5`); all 26 real migrations applied to fresh PostgreSQL 16, exit 0.
The second run returned no pending migrations, exit 0; SQL confirmed 26 completed
rows, matching the migration directories. An unreachable database produced
`P1001` and exit 1. The runtime smoke confirmed a non-root user, Prisma CLI and
absence of root application source/tests/dist, environment files and DRM files.
Build-time npm audit reported one high advisory in the existing locked tooling
dependency tree; this task added no npm dependency or advisory remediation and
does not claim a clean security audit. Other deployment security gates remain.

`fayq-railway-migrate-test` was removed after ownership/mount checks: zero test
containers, networks or named volumes remain. The owner preview and independent
DRM were untouched. No failure occurred beyond the deliberate connection-failure
check. This document does not claim a cloud migration, backend/frontend release,
commercial DRM or capacity acceptance. The verified candidate is pushed on `dev`
and fast-forwarded to `testing`; `deployment` is unchanged.

Sources: [Railway private registries](https://docs.railway.com/builds/private-registries),
[Dockerfile path](https://docs.railway.com/builds/dockerfiles), and
[variable references](https://docs.railway.com/variables).
