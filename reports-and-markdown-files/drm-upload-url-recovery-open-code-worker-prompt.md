# Open Code worker prompt — DRM upload URL recovery prerequisite

## Read first and boundaries

Work from the repository root. Read `AGENTS.md`, `reports-and-markdown-files/README.md`, `agent.md`, `rules.md`, `decisions.md`, `drm-integration.md`, `test-and-review-plan.md`, and this prompt completely before editing. Inspect both the platform and nested `education-drm-service/` Git status and record their starting revisions.

The owner explicitly authorized this bounded maintenance assignment inside `education-drm-service/` on 2026-09-29. That authorization applies only to retry-safe upload URL recovery for the same existing `UPLOADED` asset. The platform remains an HTTP API-only consumer and must never access DRM persistence, queues, keys, or storage credentials.

Do not edit platform application code in this assignment. Do not change catalog behavior, permanent deletion semantics, playback, packaging, watermarks, commercial DRM, storage providers, or unrelated DRM internals. Do not commit, push, deploy, open a PR, provision paid resources, or remove platform development volumes. Leave all changes uncommitted for independent review.

No frontend work is authorized here. Tailwind remains mandatory for future platform frontend changes; do not add CSS or UI code in this prerequisite. Apply clean-code principles, use the best feature/module structure available in the DRM package, avoid god files, and keep new handwritten production files focused and preferably below 250 lines. Any file above 300 lines must be decomposed unless it is generated or an unavoidable migration fixture, with justification in the report.

## Independently reproduced defect

`POST /v1/media` is idempotent by `externalAssetId`, but an idempotent repeat currently returns only the existing `assetId`, status, and idempotent flag. It omits `uploadUrl`.

If external asset creation succeeds but the response or the platform result write is lost, the platform retries with the same stable `externalAssetId` and idempotency key. It correctly converges on one DRM asset but receives no upload URL, so the administrator cannot upload the original file. Creating a second asset would orphan the first; persisting a signed URL would be insecure and would still fail after expiry.

## Objective

Make the existing idempotent registration contract recovery-safe. Repeating the same authenticated registration for the owning application's same asset must return:

- the same internal `assetId`;
- the current safe status;
- `idempotent: true`;
- a newly generated, short-lived presigned upload URL when and only when the existing asset is still `UPLOADED` and eligible to receive its original source.

The retry must never create a second media asset, processing job, storage key, or audit identity. It must use the existing server-owned source object key and the request's validated content type when generating the replacement URL.

## Required security and state behavior

- Keep existing `X-Client-Id` and `X-Client-Secret` authentication and application scoping.
- Match by both owning application and the stable external asset identity used by current idempotency behavior.
- Return no information for another application's asset.
- Issue a URL only while the current asset state is exactly `UPLOADED` and no permanent deletion is pending or running.
- Reject recovery in `PROCESSING`, `TRANSCODING`, `PACKAGING`, `READY`, `FAILED`, `DELETING`, `DELETE_FAILED`, or any later/unknown state with a stable machine-readable conflict code. Do not silently return a URL.
- Do not change an asset state merely by reissuing the URL.
- Preserve the original source key; never accept an object key from the caller.
- Revalidate the content type using the existing registration schema. Do not permit content-type confusion relative to the upload-completion checks.
- Do not return or log the source key, credentials, signing inputs, full signed URL, secrets, stack traces, or storage configuration.
- Do not persist the signed URL in PostgreSQL, Redis, jobs, audit metadata, or logs.
- Concurrent identical retries must return the same asset and may each receive independently generated short-lived URLs, without duplicate database rows or jobs.
- Preserve the current URL lifetime unless a documented security reason requires a narrower value.

Prefer the smallest compatible API change. Updating the existing idempotent `POST /v1/media` response is expected because it avoids introducing another recovery route, but use the implementation that best matches the current package conventions. Document the final response and error contract precisely.

## Transaction and external-I/O rules

Do not hold a database transaction or row lock while generating a signed storage URL or making other external storage calls. Read and validate an immutable ownership/state snapshot safely, generate the URL outside the transaction, and ensure a concurrent state transition cannot cause a URL to be issued after upload eligibility ended. Use a short compare-and-set/version check, lease, or equivalent safe design if required; explain and test the chosen ordering.

Do not weaken upload completion validation. A stale URL that was issued before a state transition must not make a non-`UPLOADED` asset playable or re-open processing; completion must continue to enforce the current state and object metadata.

## Required Docker tests

Use the DRM package's disposable Docker test topology and retain all existing tests.

Add tests proving:

1. First registration returns an asset and upload URL.
2. Repeating the identical idempotent request returns the same asset ID, a fresh usable upload URL, and no duplicate asset, processing job, storage key, or audit identity.
3. A simulated lost response followed by retry can PUT the original through the recovered URL and complete the existing asset normally.
4. Concurrent retries converge on one asset and remain usable.
5. A different application cannot discover or recover another application's asset.
6. Missing/invalid credentials, malformed identifiers, invalid content types, and mismatched request identity fail safely.
7. Recovery is rejected after processing, readiness, failure, or deletion begins.
8. URL expiry is enforced by the real local S3-compatible provider path where supported.
9. No signed URL, storage key, client secret, or credential appears in database rows, Redis, audit rows, logs, test artifacts, or final runtime images.
10. Existing registration, upload completion, processing, playback, deletion, authentication, health, migration, and security suites remain green.
11. Production and migration images remain minimal/non-root and migration failure still gates startup.

Use real disposable PostgreSQL, Redis, and local S3-compatible storage for integration proof. A mocked signer may cover isolated error branches but cannot replace the end-to-end recovered PUT/completion test. Live Cloudflare R2 remains blocked without credentials and must not be represented by the local provider or a fixture.

## Report and stop

Create `reports-and-markdown-files/drm-upload-url-recovery-implementation-report.md` at the platform repository level. Include:

- starting and ending platform/nested revisions and Git status;
- exact changed DRM files and any migration/config impact;
- final request/response/state/concurrency contract;
- exact Docker commands, test counts, image IDs, and PASS/FAIL/BLOCKED results;
- evidence for stable identity, recovered PUT/completion, tenant isolation, state rejection, concurrency, expiry, and secret scans;
- line counts and clean-code/file-structure decisions;
- remaining risks and rollback/recovery instructions.

Use this exact live-environment blocker:

`BLOCKED — live Cloudflare R2 upload-URL recovery verification could not be performed because the required Cloudflare R2 endpoint and credentials were not supplied.`

Do not claim production readiness, M3 acceptance, or 10,000-user capacity. Do not modify the platform's existing uncommitted M3 implementation. Stop after the report and handoff so the manager can independently inspect the actual DRM diff and reproduce critical Docker tests.
