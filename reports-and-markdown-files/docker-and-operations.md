# Docker and operations plan

Platform development, tests and deployment use Docker. External DRM remains unchanged and is consumed through its API.

| Service | Requirement |
| --- | --- |
| client/ | Separate platform frontend image/container |
| server/ | Separate modular Express image; replicas use that same image |
| Nginx | Platform reverse proxy/load balancing |
| PostgreSQL | Platform database container/persistence; Prisma migrations own platform schema only |
| Redis | Platform cache/session/job/realtime infrastructure per approved contracts |
| Migrations/tests | One-shot jobs and isolated test volumes |
| Confirmed platform workers | Separate container/image when required by approved work package |
| External DRM | Independently operated package; reference API endpoint and server credentials, no internal edits |
| Object storage | Cloudflare R2 through external DRM in production; Docker local substitute/setup still to confirm |

For local real media integration, connect to the unchanged external DRM distribution via a reachable API URL. Its own existing containers remain its responsibility. Do not copy its code into platform images or merge its database. A Docker contract double is permissible for isolated platform tests only and cannot prove real video security. Cloudflare's hosted service is not assumed to run inside Docker.

## Foundation acceptance

Provide documented clean build/start commands, separate logs, pinned dependencies, health/readiness, startup ordering, persistent development volumes and disposable test volumes. Basic platform startup should work without paid/live service credentials. Storage-specific and real-DRM tests must clearly state their external/local dependency requirements.

Validate browser/public URLs separately from Docker service names. Keep privileged credentials out of frontend build args and bundles. Do not expose production data-service ports. No local FFmpeg/Packager installation or platform video-worker implementation is required.

## Production review

Check non-root application users, runtime contents, graceful shutdown, resource limits, secret injection, TLS/proxy boundaries, cookie policy, network access and replica readiness. Verify Prisma migration ordering, failure recovery and app rollback compatibility. Containerization alone does not establish high availability.

Back up and restore platform data/configuration. Obtain separate external DRM/media/key recovery evidence from that dependency's operator; do not take over its database/key internals. Set recovery objectives with the owner.

Monitor API latency/errors, DB pool waits, Redis failures, job retries, manual approval audit, wallet reconciliation, subscription expiry and failed external termination, as well as observed DRM readiness/playback errors. External service metrics require an agreed monitoring contract.

The prior assessment could not reach Docker Engine. No new runtime verification is claimed by this documentation update.
