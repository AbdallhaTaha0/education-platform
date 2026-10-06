# DRM security repair and webhook status correction — 2026-10-06

After the [independent review](drm-security-independent-review-20261006.md), the owner explicitly requested: **“fix all these bugs.”** This assigns the bounded external-DRM webhook correction, local runtime refresh, dependency-reference correction and missing reports. It preserves the independent DRM API/persistence boundary and does not authorize a production deployment or new feature scope.

## Corrected behavior

The earlier DRM commit `52853b3` sanitizes video-processing failures before they reach logs, SQL or BullMQ and pins webhook connections to validated public addresses while retaining TLS identity checks. This follow-up keeps those protections and fixes per-destination outcome persistence.

Previously, `sendWebhookEvent()` updated every row with the shared `event_id`. When one destination succeeded and another failed, the later result overwrote the earlier result's status, attempts and error message. The update now matches **both `event_id` and `webhook_endpoint_id`**. Payloads, signatures, transport/retry rules and the API contract are unchanged.

No schema migration, credential change, data repair or historical delivery rewrite is required. Historical overwritten outcomes cannot be reconstructed safely from the affected status alone; retained rows are preserved.

## Regression evidence

`education-drm-service/apps/api/security-integration/webhook-delivery-status.test.ts` uses real PostgreSQL, the actual endpoint encryption/signing and actual service SQL. Only URL resolution and external delivery are mocked. Two cases cover success/failure and failure/success for destinations sharing one event, asserting distinct statuses, attempts, error messages and attempt timestamps.

Both cases **failed before the fix**, reproducing the overwrite; both passed afterward. The existing two PostgreSQL/BullMQ failure-sink regressions also passed. The final isolated run passed **103 unit/security tests plus four integration tests**. Frozen-lockfile Docker builds passed the configured supply-chain policy and workspace TypeScript build. No new vulnerability audit or real remote webhook TLS qualification is claimed.

The disposable project, its network and both volumes were removed after the failing reproduction and after the passing run. Existing volume names were verified preserved. Sanitized logs are ignored under `docker/browser/evidence/security-fix-20261006/`.

## Local delivery

The local preview helper now supports guarded `drm-build` and `drm-up` operations. Both retain its existing project/image/volume/mount/origin guards. The bounded refresh builds API/worker only and recreates those containers with `--no-deps`; it does not restart PostgreSQL/Valkey, run a new migration, rebuild the platform or reset volumes.

See [delivery evidence and rollback](security-delivery-20261006.md) for the corrected dependency revision, running-image proof, retained-data verification and final local health results. This report fills the missing parent documentation reference; it does not invent evidence from the earlier teammate's unavailable reports.
