# Railway preparation

The owner approved one Railway project with separate services and independent
platform/DRM persistence. This is a central operations graph, not a merged backend.
The configuration is prepared, not applied. No provider resources exist from this task.

The pinned SDK is installed/type-checked in Docker. Railway CLI must be at least
5.42.1 for this SDK. Authenticate/link to the owner's selected project only at
release time. Use `testing` for qualification and `production` for the approved
release; environment names are checked. Do not run `apply` as a preparation check.

Set these orchestration variables to published immutable registry digests:
`PLATFORM_RUNTIME_IMAGE`, `PLATFORM_MIGRATE_IMAGE`, `PLATFORM_GATEWAY_IMAGE`,
`DRM_API_IMAGE`, `DRM_WORKER_IMAGE`, `DRM_VALKEY_IMAGE`. Use the currently approved
Valkey image for the latter, pinned by registry digest. The SDK rejects tags without a digest.
Also select `PLATFORM_POSTGRES_IMAGE`, `DRM_POSTGRES_IMAGE`, `PLATFORM_REDIS_IMAGE`:
compatible Railway-managed PG16 and Redis7 images, pinned by digest. Their configured
mounts are `/var/lib/postgresql/data` and `/bitnami` respectively; validate provider
template startup/variables/mounts before planning. Do not substitute a plain Redis
image that ignores managed password variables. New major versions require separate
qualification; the SDK convenience helpers would currently choose PG18/Redis8.2.
These variables are public artifact references, not application secrets.

Secrets/domains are `preserve()` variables: set missing values directly in each
provider service before applying; preserve does not generate or validate secrets.
Use the env examples and deployment runbook. Never apply with missing required
variables. Database references point only at their corresponding persistence pair.

Set the environment shared variable `DRM_REDIS_URL` to the authenticated private
Valkey URL, using the password stored as `VALKEY_PASSWORD` on `drm-valkey`.
Keep that shared variable scoped to DRM services, never the platform backend.
Valkey retains its existing technology and has its own persistent `/data` volume.

**Migration gate:** this graph describes steady state, not ordered orchestration.
Railway does not inherit Compose dependency ordering. Provision persistence and
run BOTH one-shot migrations to exit zero before starting/releasing backend,
DRM API or DRM worker. Use the migration image for Prisma; serving images lack its
CLI. On subsequent releases migrate before updating serving-image references.
Do not apply the full graph to an empty environment with automatic service startup.
Use manual staged setup for the initial release, then pull/compare its graph before
the first managed apply. Do not compensate by adding destructive startup migrations.

Only gateway and DRM API need public generated domains. Set them in Railway's
domain settings after owner approval; backend, workers, migrations and databases
remain private. DRM production calls use its HTTPS public API as current platform
validation requires; do not relax TLS merely because services share a project.

Never apply to an existing project before importing/comparing all existing resources:
omission from a whole-project graph can delete them. Review `railway config plan`
for deletions, volumes, secrets, sources and restart effects. No apply was run here.
Legacy `docker/railway/*.railway.json` files remain historical; do not attach them
to these new services. Current Railway documentation supersedes that format.

See [deployment runbook](../reports-and-markdown-files/deployment/railway-vercel-20261007.md).
