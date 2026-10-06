# Open Code worker prompt — DRM permanent media deletion prerequisite

## Read first

Work from the repository root. Read `AGENTS.md`, `reports-and-markdown-files/README.md`, `agent.md`, `rules.md`, `decisions.md`, `drm-integration.md`, and this prompt before editing. Inspect the actual nested `education-drm-service/` code and its Git status before work.

The owner explicitly authorized this bounded maintenance assignment inside their DRM package. This supersedes the former read-only restriction only for the work below. The education platform must still consume DRM solely through HTTP APIs; do not give platform code access to DRM tables, keys, queues, or storage credentials.

Milestones 1 and 2 of the platform are accepted. Do not implement the platform catalog, wallet, subscriptions, or playback UI in this assignment. Do not edit platform application code. Do not commit, push, deploy, or provision paid Cloudflare resources. Leave changes uncommitted for independent review.

## Observed gap

The DRM service exposes media registration, upload completion, and media status, but it has no application-facing endpoint that permanently removes a media asset and all of its stored objects. The storage provider can delete one known key, while packaged output is a directory/prefix containing a manifest and many rendition/segment files. Deleting only the `media_assets` row would cascade database records but leak source, packaged, or personalized objects and would not free R2 space.

## Objective

Add a production-oriented, application-authenticated, asynchronous permanent media-deletion lifecycle. A successful request must immediately make the asset unusable, revoke its active playback sessions, and enqueue an idempotent cleanup operation. The worker must delete every storage object owned by the asset, then remove its DRM persistence while preserving a safe audit/deletion record. Failures must be visible and retryable without allowing playback or cross-tenant deletion.

## Required API contract

Implement and document these application-authenticated routes using the existing `X-Client-Id` and `X-Client-Secret` mechanism:

- `DELETE /v1/media/:assetId`: request permanent deletion. Require an explicit confirmation value containing the asset's `externalAssetId` (use a documented header or validated body field consistently). Return `202` with a safe deletion operation ID and state. Never accept an object key or application ID from the caller.
- `GET /v1/admin/media-deletions/:deletionId`: return the owning application's deletion state and safe timestamps/error category. Never expose storage keys, secrets, stack traces, or another application's operation.
- Repeating DELETE while the same asset is already pending/running must return the existing operation rather than enqueue duplicates. A failed operation may be retried safely through the same DELETE contract or a narrowly documented retry route.

Use stable machine-readable errors, including not found, confirmation mismatch, deletion busy, invalid state, and dependency failure. Maintain the existing error envelope conventions where possible.

## State and persistence design

Add an additive migration after the existing migrations; never edit an applied migration.

- Extend media state with deletion states such as `DELETING` and `DELETE_FAILED`.
- Add a durable deletion-operation table containing a stable UUID, owning application, nullable media reference, immutable snapshots of internal/external asset IDs needed for audit, state (`PENDING`, `RUNNING`, `COMPLETED`, `FAILED`), bounded attempts, safe error category, and timestamps.
- Preserve the completed operation after the media row is removed. Do not store storage credentials, content keys, raw client credentials, signed URLs, or secret material in it.
- Add ownership and status indexes used by the routes and worker.
- Record a non-secret audit event for request, completion, and failure. Retain the deleted asset ID/external ID in safe metadata because the media foreign key becomes null after deletion.

The DELETE request must lock/transition the asset atomically. Reject deletion while video processing is `PROCESSING`, `TRANSCODING`, or `PACKAGING`; do not race a worker that may upload new objects after cleanup. `UPLOADED`, `READY`, `FAILED`, and `DELETE_FAILED` must have explicitly tested behavior. Once deletion starts, every playback/license/media gateway path must reject the asset because it is no longer `READY`.

Revoke all active playback sessions for the asset when the deletion state is committed. New sessions, heartbeats, renewals, licenses, manifests, and byte-range media requests must no longer succeed. Do not rely only on eventual object removal for access denial.

## Queue and worker behavior

Use BullMQ/Redis and the existing worker service. A separate named deletion queue/worker is preferred so video-processing concurrency and retry policy stay clear. Ensure graceful shutdown closes every queue and worker.

The deletion job must be retry-safe and perform this sequence:

1. Load the deletion operation and media row scoped to the recorded application.
2. Validate stored object keys against server-derived ownership rules. Never delete an arbitrary caller-supplied key or an empty/root prefix.
3. Delete the source object if it still exists. Source deletion must tolerate the existing `DELETE_SOURCE_AFTER_PROCESSING=true` behavior, where the source is already absent.
4. Delete every packaged object below the server-derived `assets/{assetId}/` prefix, including manifests, audio/video renditions, and segments.
5. Delete every personalized variant object recorded for the media asset, even if it is outside the packaged prefix.
6. Verify that no owned object remains. Handle S3/R2 pagination beyond 1,000 keys and batched deletion limits correctly.
7. In a database transaction, remove the media asset and cascading secret/session/license/job records, mark the durable deletion operation completed, and write safe audit evidence.

If storage cleanup fails, retain the media row in a non-playable `DELETE_FAILED` state, mark the operation failed with a safe category, and allow an idempotent retry. Never delete database ownership metadata first and then lose the list of objects requiring cleanup. A retry after partial deletion must treat already absent objects as success.

If the job crashes after storage deletion but before the database transaction, retry must finish the database cleanup safely. If enqueueing fails after the API transition, either atomically restore the previous allowed state or leave a durable pending operation that reconciliation can enqueue; do not strand an asset silently.

## Storage provider requirements

Extend the storage abstraction and S3-compatible provider with the minimum safe prefix operations needed for deletion. Use the AWS S3 APIs compatible with Cloudflare R2 and the existing local S3-compatible Docker service.

- Paginate `ListObjectsV2` until completion.
- Delete in valid batches using `DeleteObjects`; support more than 1,000 keys.
- Treat missing objects as idempotent success.
- Reject empty, root, traversal-like, or ownership-mismatched prefixes before issuing deletion calls.
- Surface partial batch errors and verify the prefix is empty before declaring completion.
- Do not log full storage keys when they could expose tenant information; never log credentials or signed URLs.

Do not change storage providers, weaken encryption/watermarking, or add direct R2 credentials to the platform.

## Security and concurrency

- Enforce application ownership on the initial DELETE, status query, retry, worker lookup, and every database mutation.
- A client from application A must receive no information about application B's asset or deletion operation.
- Concurrent DELETE requests for one asset produce one durable operation and one effective cleanup.
- Use server-generated prefixes and database-owned variant keys only.
- Reject malformed UUIDs safely.
- Use request/body limits and existing rate controls.
- Redact client secrets, authorization values, signed URLs, storage credentials, content keys, and confirmation values from logs.
- Retain auditability without retaining DRM content keys or personal watermark data unnecessarily.

## Docker and compatibility

All builds, migrations, tests, and demonstrations must run through the DRM package's Docker setup. Preserve existing API/worker/Redis/PostgreSQL/storage topology and current upload/playback behavior. Update container health or startup ordering only if required for the new queue/worker, and document why.

The migration must apply to an existing database containing READY assets and must not rewrite or drop existing history. Demonstrate migration failure blocks dependent startup. Document forward compatibility and recovery; do not implement destructive automatic rollback.

Cloudflare credentials are not currently available. Verify real object removal against the existing local S3-compatible Docker storage. Mark live Cloudflare R2 deletion verification `BLOCKED — credentials unavailable`; do not call a fixture or mock equivalent to live R2 proof. The finished service should require only real environment configuration to run the same provider code against R2 later.

## Required tests

Add meaningful tests at the correct layers and retain all existing DRM tests:

1. Application authentication and tenant isolation for DELETE and deletion-status routes.
2. Exact confirmation mismatch denial and unknown/malformed IDs.
3. State matrix: allowed terminal/uploaded states, rejection during active processing, and non-playability immediately after the deletion transition.
4. Concurrent duplicate DELETE requests create one operation/job.
5. Active playback sessions are revoked and subsequent heartbeat, renewal, license, manifest, and range requests fail.
6. Source present and source already absent.
7. Packaged-prefix cleanup containing nested renditions/segments.
8. More than 1,000 objects to prove pagination and batching.
9. Personalized variant cleanup.
10. Partial storage failure produces `DELETE_FAILED`, preserves metadata, exposes a safe status, and succeeds on retry.
11. Crash/retry after objects are removed but before database cleanup.
12. Queue-enqueue failure does not silently strand the asset.
13. Completed deletion removes media, keys, processing jobs, sessions, licenses, watermarks, variants, and revocation rows according to current foreign keys while retaining deletion/audit evidence.
14. Existing upload, processing, playback, license, watermark, webhook, auth, range, health, and security suites still pass.
15. Logs and final images contain no credentials, content keys, signed URLs, or secret confirmation values.

Use real disposable PostgreSQL, Redis, and local S3-compatible storage containers for integration tests. Mocks may cover SDK error branches but cannot replace the end-to-end local object deletion proof.

## Scope limits

Do not implement platform course deletion, catalog UI, wallet logic, subscriptions, or M3 Prisma models. Do not add download/export behavior, commercial Widevine/PlayReady/FairPlay credentials, or unrelated DRM refactors. Report other defects separately unless they directly prevent safe deletion; do not silently expand scope.

## Completion report and stop

Create `reports-and-markdown-files/drm/drm-media-deletion-implementation-report.md` at the platform repository level. Include:

- exact changed DRM files and migration name;
- final API/state/queue/storage contracts;
- object ownership and deletion invariants;
- commands, test counts, image IDs, and PASS/FAIL/BLOCKED results;
- proof for >1,000 objects, concurrency, tenant isolation, failure/retry, playback denial, cascade cleanup, and secret scans;
- explicit `BLOCKED` status for live Cloudflare R2 verification;
- before/after nested DRM Git status and commit identity;
- remaining risks and rollback/recovery procedure.

Do not claim production readiness or 10,000-user capacity. Do not commit or push. Leave the development platform stack and its data untouched. Stop after the report and final handoff so the manager can independently review the DRM changes.
## Owner-required Docker test cleanup (2026-10-01)

After completing the assigned work, or after failure/interruption/stop, clean up the Docker test environment you created. Before removal, verify the exact project labels, resolved container/network/volume names and every mount; target only this assignment's owned disposable test resources and fixtures. Remove owned test containers, networks and volumes, including any owned anonymous volumes identified from container mounts. Never use global prune or delete unrelated data, the existing previews, reusable images needed for review, or saved reports/evidence. If a test resource must remain temporarily for an active check, record its owner and reason, then clean it when that check ends. Report the final cleanup verification and any resources that could not safely be removed. Every future prompt must include this requirement.
