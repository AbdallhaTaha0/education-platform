# Railway release and recovery runbook

2026-10-01. Owner selected Railway; custom domain undecided. Owner delegated recovery choices to the manager. This runbook is prepared locally, not an executed Railway deployment.

## Service layout

Create one Railway project with separate staging and production environments. Platform services are PostgreSQL 16, Redis with persistence, one replicated Express backend, a public Nginx frontend/edge and a dedicated one-shot migration service. External DRM remains independently deployed and API-only. No external DRM database or infrastructure is changed.

Only the edge gets a public HTTPS domain. Initially a Railway-generated domain can be used after the owner approves the actual origin. The backend, PostgreSQL, Redis and migration service have no public domain or TCP proxy. The edge trusts Railway's supplied `X-Real-IP`; do not expose this image directly to untrusted public HTTP or another proxy without revisiting that trust contract. It replaces upstream forwarding headers and fixes the scheme to HTTPS. Backend `trust proxy=1` therefore sees one Nginx hop and the Railway-provided client address.

Use reviewed, immutable registry images. Build from the repository root:

```powershell
docker build --target runtime -f server/Dockerfile -t YOUR_REGISTRY/platform-server:RELEASE .
docker build --target migrate -f server/Dockerfile -t YOUR_REGISTRY/platform-migrate:RELEASE .
docker build --target runtime -f client/Dockerfile -t YOUR_REGISTRY/platform-client:RELEASE .
docker build -f docker/railway/edge.Dockerfile --build-arg CLIENT_IMAGE=YOUR_REGISTRY/platform-client:RELEASE -t YOUR_REGISTRY/platform-edge:RELEASE .
```

Publishing images and applying Railway changes require a separately authorized release. Record image digests, not tags alone. Do not point Railway's automatic builder directly at `server/Dockerfile`: its last target is the test runner, not the serving runtime. Do not install Prisma CLI in the serving image. Use the dedicated migration image. The per-service JSON files under `docker/railway/` configure deployment settings; they do not provision services, secrets, quotas or image sources. Import these settings explicitly in Railway and verify their effective deployment values.

## Variables and startup

Backend: `NODE_ENV=production`, `COOKIE_SECURE=true`, `PORT=3000`, exact HTTPS `ALLOWED_ORIGINS`, private database/Redis connection references, unique production `AUTH_JWT_SECRET`, issuer and audience. Use strong production Argon2 defaults. Configure the approved receiving account labels and Arabic/English manual recharge instructions; never use test payment destinations.

DRM configuration is mandatory in production: HTTPS API/public origins, application identity/secret, RS256 assertion issuer/audience/key ID and a base64 PKCS#8 RSA private key. The corresponding public JWKS must be reachable at the edge's well-known path. Keep secrets in Railway service variables and its access controls, never `VITE_*`, Git, Docker build arguments or logs. Fixture values in `compose.m7-08.yml` are not production settings. Generate separate staging and production credentials.

Edge: `BACKEND_HOST` is the backend's private Railway hostname, `BACKEND_PORT=3000`, and `PORT=8080`. Runtime DNS resolution accommodates backend replacement and supports IPv4/IPv6. Backend replicas share PostgreSQL and Redis and receive the same image and signing configuration. Start with two backend replicas in one region selected by measured latency to Egyptian students; this is a starting topology, not a capacity guarantee. Use resource caps and billing alerts in Railway before provisioning; actual values need sizing evidence and an owner-approved spend limit.

## Release gate

1. Verify candidate digests, zero outstanding blocking findings, environment/credential presence, backup health, exact origins and external DRM readiness. No test accounts or synthetic courses in production.
2. Create a pre-migration recovery point and record the latest restorable timestamp. For a fresh environment, run all eleven migrations first.
3. Run the dedicated migration image against the private database. Require successful job exit and the expected migration records before deploying the backend. Disable automatic deployment triggers on these services until a pipeline explicitly enforces this cross-service sequence. Railway does not inherit Compose dependency ordering.
4. Deploy the backend candidate and require `/health/ready` to pass. Then deploy the frontend/edge; its readiness path is `/api/health/ready`, not merely its static page.
5. Exercise real HTTPS admin/student cookie login, CSRF refusal, manual approval idempotency, wallet reconciliation, course/package purchase, presale visibility and protected playback. Check external license/session expiry and termination.
6. Bootstrap the first real ADMIN through `node dist/bootstrap.js` with temporary server-side bootstrap variables; remove those variables afterward. Do not seed the synthetic preview fixture. Any subsequent ADMIN is created by an authenticated ADMIN.

Prisma `migrate deploy` cannot be used as a Railway backend pre-deploy command because the minimal serving image intentionally lacks the CLI. A separate migration job plus an explicit release gate preserves that boundary. The locally tested Compose gate is evidence for the local rehearsal only.

## Recovery baseline selected under owner delegation

Targets: **RPO at most 15 minutes**, **RTO at most four hours**. These are business objectives, not demonstrated service guarantees. Enable Railway PostgreSQL PITR and verify archive lag stays below the RPO; scheduled daily dumps alone cannot meet it. Railway currently documents a roughly four-week Postgres PITR window with weekly full and daily differential backups. Also retain encrypted daily logical exports for 30 days in a separate restricted backup destination/account, with no public read access; provision that destination and schedule only after credentials and spend approval are available. Take an extra recovery point before every migration. Perform a staging restore monthly and after material schema/recovery changes. Backups include personal data and private recharge proofs: restrict access, protect exported files and use the same privacy controls as the source.

The local `platform-backup.ps1` writes a validated custom-format PostgreSQL archive and SHA256 manifest. `platform-restore-drill.ps1` verifies the checksum and restores transactionally into a new `m7_restore_*` database; it refuses existing targets and never drops a database. These are local Docker operator tools, not a claim that a Railway backup schedule is already enabled. They cover the complete platform database, including recharge proof bytes. Redis, external DRM/media and signing/service secrets need their own recovery configuration; coordinate external DRM through its operator and supported API only.

For an incident: pause financial writes, establish the recovery timestamp, restore into a sibling database, compare migration records and ledger/wallet totals plus purchase/grant/proof integrity, rotate/revoke compromised sessions when relevant, then switch database connections on every replica and verify readiness and critical flows. Reconcile any payments after the recovery point against actual receipts before resuming manual approvals. Keep the original database isolated for investigation. Record achieved recovery time and data loss.

Do not roll M8 indefinite-access data back into an older non-null application/schema. Prefer forward-compatible repair. A coordinated restore requires explicit approval because it may discard newer purchases and approvals.

## Monitoring and capacity

Railway deployment healthchecks only gate startup; they are not continuous uptime monitoring. Run `docker/railway/health-probe.mjs` every minute from an independent uptime runner with the actual HTTPS `PLATFORM_ORIGIN`. It returns nonzero for network/timeout, redirect or unhealthy edge/liveness/readiness. Route failures to an operator using an explicitly configured alert destination. No alerts or recurring automation have been activated by this package.

Before launch, configure provider CPU/memory/restarts, database connection/storage, Redis memory/persistence, HTTP error/latency and billing alerts. Alert on three consecutive failed probes, a backup/archive age approaching 15 minutes, failed migrations, reconciliation failures and sustained resource saturation. Log safe request IDs and error categories; never log cookies, private proofs, keys or raw DRM payloads. Verify the selected provider plan supports alerting and retention; archive operational logs as required.

The committed local smoke is only 200 catalog GETs at concurrency 20. Qualifying 10,000 users requires the owner to specify browsing/viewing mix and video bitrates, a staging environment sized for the target, startup/latency/error/rebuffer thresholds and permission for external media/license traffic. Railway's documented per-domain connection limit also needs review when websocket connections and video requests are combined. Do not equate a platform connection limit with demonstrated application capacity.

## Scope and cleanup

No production deployment, paid provisioning, image push, domain registration, DRM edit or external load is authorized by this runbook. Local test stacks must be cleaned at finish/failure/stop after verifying project labels and mounts; remove only owned test fixtures/containers/networks/volumes. Preserve the user's 8082/8083/8084/8085 previews, unrelated projects, reusable images and evidence. Never use global Docker prune.

## Sources checked on 2026-10-01

- [Railway Dockerfiles](https://docs.railway.com/builds/dockerfiles) and [config reference](https://docs.railway.com/config-as-code/reference): build/deployment settings and effective service configuration.
- [Railway private networking](https://docs.railway.com/networking/private-networking) and [public networking limits/headers](https://docs.railway.com/networking/public-networking/specs-and-limits): private service communication, ingress headers and TLS.
- [Railway pre-deploy commands](https://docs.railway.com/deployments/pre-deploy-command): failure gates and same-image dependency requirements.
- [Railway PITR](https://docs.railway.com/volumes/point-in-time-recovery): archive/restore workflow and retention; target guarantees still require measured drills.
- [Railway healthchecks](https://docs.railway.com/deployments/healthchecks): deployment-only checking.

## SEO launch configuration (2026-10-06 implementation)

Build/release the matching server, client and edge images together: public HTML is now rendered by the internal SEO module of the same Express application. An old backend image lacks that module. Keep `SEO_INDEXING_ENABLED=false` for staging. After a preferred HTTPS domain and an authorized release are verified, set backend `SEO_PUBLIC_ORIGIN` to that origin only and deliberately enable public indexing. Never copy the synthetic `seo.example.test` fixture setting into deployment. Follow the [SEO report and exact launch checks](../../seo/seo-audit-20261006.md) before submitting the sitemap; no production deployment or ranking result is implied.
