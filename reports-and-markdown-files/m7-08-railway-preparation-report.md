# M7-08 — Railway preparation and local recovery verification

2026-10-01. Direct manager implementation and same-agent verification. **Local preparation complete; M7 production qualification remains OPEN.** No production deployment, commit, push or paid provisioning.

## Authorization and policy

The owner requested completion, selected Railway and left the custom domain undecided. The owner delegated recovery choices: “do what is best for business.” The manager selected a 15-minute RPO, four-hour RTO, Railway Postgres PITR and 30 days of separately protected daily logical exports. These are objectives awaiting actual provider configuration and measured staging recovery, not demonstrated guarantees. [The Railway runbook](m7-railway-runbook.md) gives the concrete service layout, configuration, release ordering, monitoring, recovery and outstanding provider steps.

## Changes and verification

Added a Railway Nginx edge image derived from the reviewed M8 frontend image; no client dependencies or assets changed. It serves the SPA and strips `/api` for the separate Express backend, supports Socket.IO upgrade, proxies public JWKS, supports IPv4/IPv6 and resolves private backend DNS at runtime. Its production ingress trust contract is Railway's supplied client IP and TLS termination, with forwarding headers replaced for the existing single trusted Nginx hop. It validates runtime host/ports and runs as `nginx`, not root. Effective image ID: `sha256:d97e8807cddc6a9fca425eb96f0027b69246cc2db20a4f08b0f2a183da6ad06a`. Railway JSON settings are prepared; service sources, effective provider schema/settings, quotas, credentials and origin still require staging configuration.

Added operator Docker PostgreSQL backup/restore scripts. The backup validates its custom archive and records SHA256; restore verifies the checksum and creates a new prefixed database transactionally. It never overwrites/drops existing targets. The complete platform database includes private recharge proofs; Redis and external DRM/media are outside this archive. Evidence is ignored at `docker/browser/evidence/m7-08/`.

| Check | Result |
| --- | --- |
| Production-mode isolated startup | PASS: PostgreSQL/Redis healthy, eleven migrations exit 0, server healthy; two backend replicas healthy |
| Gateway behavior | PASS: SPA, edge/liveness/readiness, JWKS, production Secure/SameSite CSRF cookie, security header and anonymous admin refusal |
| Local catalog smoke | 200 requests, concurrency 20, zero failures, measured p95 **57 ms**; localhost hardware only, not 10,000-user qualification |
| Source synthetic business invariants | PASS: two users, four courses, one standalone indefinite purchase, one three-member package, 465000 piastre wallet/ledger, private proof SHA256 |
| Backup/restore | PASS: custom archive, manifest, eleven restored migrations; all source financial/access/proof invariants reproduced on new `m7_restore_verified` database |
| Refusal guards | PASS: wrong project, existing backup output, existing restore database and checksum mismatch refused; checksum failure occurs before creating target |
| Monitoring | PASS: three healthy probes; Redis stop yields readiness 503 and probe exit 1 while edge/liveness remain 200; restart returns all three checks to 200 |
| Configuration | PASS: missing production DRM refused, insecure production cookies refused, malformed edge host refused; Nginx syntax valid |
| External secrets | Presence-only check: existing R2 and platform RS256/application fields present; all five Widevine fields empty; values never emitted |

Full application tests were already verified in [M8 completion](m8-04-completion-report.md): 444 server tests, 78 client checks and 81 browser checks. This operations package changes no business source or dependencies, so it adds focused operations evidence rather than representing those suites as rerun. The dedicated serving/migration separation and M7-07 override are preserved. No schema migration added by M7-08.

## Failures and corrections

Initial production startup refused absent DRM settings as designed; the positive configuration rehearsal used a disposable RSA key and a nonexistent external URL. No DRM request or playback claim was made. The initial edge could not write its inherited root-owned config; image-build ownership was corrected while keeping serving non-root. IPv6 localhost health probing exposed a missing IPv6 listener, corrected explicitly. Duplicate upstream/edge security headers were consolidated without dropping protection. The first load probe used the wrong catalog URL and returned 404 for all 200 requests; the harness was corrected to `/api/catalog/courses`, with the final successful measurement reported above. The synthetic proof seed initially violated the normalized-reference constraint; the fixture reference was corrected, without weakening the database check. Failed logs are retained.

## Cleanup and limits

Inspected project labels and every mount: only `m7-08-rehearsal_pgdata` and `m7-08-rehearsal_redisdata` were writable attached volumes. Scoped `down -v` removed all rehearsal containers/network/volumes, including the restored database and synthetic fixtures. Final resource queries found none. Disposable key file deleted. One-off test containers auto-removed. Archive/manifest/logs/images are retained as private ignored review evidence; no global prune. The user's 8082/8083/8084/8085 previews are preserved. The 8085 accounts are intentionally retained for owner testing, not abandoned disposable verification fixtures.

Actual Railway deployment/TLS/private-network behavior, resource sizing and spend cap, enabled PITR/export schedules, alert destination, measured RPO/RTO, commercial DRM credentials, 10,000-user workload/budgets and formal milestone owner acceptance remain open. No valid way exists to certify those from a local container rehearsal. Production settings never use the fixture RSA key, nonexistent DRM URL, synthetic accounts or preview payment data. The owner's subsequent real-video request is a separate continuation connecting an unchanged independent DRM deployment to R2; its evidence must not be invented from this package.

Files: `.dockerignore`; `docker/railway/` edge/configuration/health tools; `docker/verification/platform-backup.ps1`, `platform-restore-drill.ps1`, `compose.m7-08.yml`, `m7-08-data.cjs`, `m7-08-edge-check.mjs`; runbook/report/index and delegated decision record. No external DRM source edit. Withdraw only these specific operations artifacts if needed; preserve concurrent M7/M8 work and existing data.

Subsequent owner-video continuation: the persistent owner preview moved from 8085 to 8080 without losing its accounts/data. The owner's actual MP4 was uploaded through ADMIN, processed in R2 by the unchanged independent DRM and verified playing as a student. See [the separate report](m8-owner-real-video-report.md). Existing bucket CORS was reused, not modified. This proves local ClearKey playback and does not close the commercial DRM or Railway production gates above.
