# Open Code worker prompt — bounded DRM processing job-status correction

## Owner authorization and scope

The owner is explicitly authorizing one bounded follow-up inside the independent `education-drm-service/` repository: repair the pre-existing PostgreSQL parameter-type failure in `updateJobStatus` so an uploaded/completed asset can progress through the existing worker pipeline to `READY`.

By dispatching this prompt, the owner also ratifies the already implemented `requestChecksumCalculation: "WHEN_REQUIRED"` setting in `packages/drm-core/src/providers/s3-storage.provider.ts` as a necessary part of the upload-URL recovery prerequisite. Independent manager reproduction proved that first-registration and recovered presigned PUTs work with the setting and the accepted deletion suite remains green. Preserve that change; do not broaden it.

This authorization does not permit general DRM cleanup or redesign. Do not change the platform application, media registration/recovery contract, permanent deletion behavior, S3/storage behavior beyond preserving the accepted checksum setting, playback, packaging policy, watermarking, commercial DRM, migrations, schemas, queues, API routes, or unrelated defects.

## Read and inspect first

Work from the platform repository root. Read completely:

```text
AGENTS.md
reports-and-markdown-files/README.md
reports-and-markdown-files/agent.md
reports-and-markdown-files/rules.md
reports-and-markdown-files/decisions.md
reports-and-markdown-files/drm-integration.md
reports-and-markdown-files/test-and-review-plan.md
reports-and-markdown-files/drm-upload-url-recovery-open-code-worker-prompt.md
reports-and-markdown-files/drm-upload-url-recovery-implementation-report.md
reports-and-markdown-files/drm-job-status-correction-open-code-worker-prompt.md
```

Then inspect the actual nested DRM diff and the processing worker path, especially:

```text
education-drm-service/packages/database/src/repositories/jobs.repository.ts
education-drm-service/apps/worker/
education-drm-service/apps/api/src/services/upload.service.ts
education-drm-service/apps/api/src/tests/media-upload-recovery-lifecycle.integration.test.ts
education-drm-service/docker/docker-compose.deletion-test.yml
```

Record the starting platform and nested DRM branches, HEADs, `origin/main` revisions, Git statuses, and the platform gitlink. Preserve all existing uncommitted M3 platform changes and all accepted upload-recovery changes. Never reset, clean, stash, amend, checkout over, delete, or hide another worker's changes.

Do not commit, push, deploy, open a PR, provision paid services, remove development volumes, or modify production data. Leave everything uncommitted for independent manager review.

## Independently reproduced defect

The unchanged `updateJobStatus` query currently fails before execution for every status because PostgreSQL infers incompatible types for parameter `$2`:

```text
ERROR 42P08: inconsistent types deduced for parameter $2
DETAIL: text versus character varying
```

`$2` is assigned to the varchar `status` column and also compared in `CASE`/`IN` expressions whose literals infer text. The independent manager reproduced the failure with a bare `PREPARE` against a disposable PostgreSQL database. As a result, the real worker cannot update job state and an uploaded/completed asset cannot reach `READY`.

## Objective

Make `updateJobStatus` type-stable for every valid `VideoProcessingJob["status"]` without changing its business semantics. Use explicit compatible casts or another minimal parameter-typing correction. Preserve:

- atomic updates of status, attempts, start time, completion time, and optional error fields;
- one attempts increment when entering `RUNNING` under the existing call contract;
- `started_at` set only on the first `RUNNING` transition;
- `completed_at` set for terminal `COMPLETED` and `FAILED` states only;
- existing error-message/category retention when optional values are absent;
- parameterized SQL with no interpolation;
- existing worker retry, queue, media-state, and deletion behavior.

Do not add a migration unless independently proven necessary; this defect is in query parameter typing, not schema shape.

## Required regression tests

Add focused tests that would fail on the current query and prove:

1. `PENDING → RUNNING` succeeds, increments attempts exactly once for that update, and sets `started_at`.
2. A subsequent progress update remains unaffected.
3. `RUNNING → COMPLETED` succeeds and sets `completed_at` without introducing an error value.
4. `RUNNING → FAILED` succeeds, records the supplied safe error fields, and sets `completed_at`.
5. Every valid job status accepted by the shared type can be passed without `42P08`.
6. A real source uploaded through the first-registration URL can be completed, consumed by the real worker, and reach the existing `READY` state in the disposable Docker topology.
7. The same end-to-end path also works when the source is uploaded through an idempotently recovered URL; it must remain the same asset, job, and source key.
8. No duplicate asset, processing job, queue identity, or storage key is created.
9. The upload-recovery 38-case suite and accepted deletion 44-case suite remain green.
10. Existing unit, integration, media, and end-to-end suites remain green.

Use real disposable PostgreSQL, Valkey, SeaweedFS, API, and worker containers. A mocked repository test is useful for isolated branches but cannot replace the real worker-to-`READY` proof.

If reaching `READY` exposes a different defect, do not silently expand scope. Record the exact failing behavior, affected file/contract, and evidence for the owner. Fix only the authorized `updateJobStatus` typing defect.

## Docker and safety requirements

Use a separately named disposable Compose project and separate volumes. Never run destructive tests against the platform development project or nested DRM development data. Use `down -v` only for the disposable project after evidence is collected. Confirm the platform development stack and data remain intact.

Run and report at minimum:

- the new focused repository/integration regression;
- real first-registration upload → completion → worker → `READY`;
- real recovered-URL upload → completion → worker → `READY`;
- upload-recovery suite;
- permanent-deletion suite;
- DRM unit, integration, media, and end-to-end suites;
- typecheck and configured lint status;
- migration-startup failure gate;
- runtime image non-root/source-test exclusion and secret scans;
- `git diff --check`.

Do not print secrets, signed URLs, object keys, client secrets, credentials, or private keys in logs or the report. Live Cloudflare R2 remains unavailable; SeaweedFS is S3-compatible local evidence, not live R2 proof.

## Clean-code constraints

Keep the production correction minimal and focused. Do not grow a god file or restructure unrelated worker/storage code. Prefer a small repository-level fix with tests organized by concern. Handwritten production files should remain focused and preferably below 250 lines; document any unavoidable larger pre-existing file rather than refactoring it outside scope.

No frontend work is authorized. If frontend work becomes necessary in a future platform assignment, Tailwind and the existing feature-based component structure remain mandatory.

## Report and stop

Create `reports-and-markdown-files/drm-job-status-correction-implementation-report.md` at the platform repository level. Include:

- starting and ending revisions/status for both repositories;
- exact files changed and line-count impact;
- root cause and final SQL/type contract;
- Docker commands actually run, exact test counts, image IDs, and PASS/FAIL/BLOCKED results;
- first-registration and recovered-upload lifecycle evidence through `READY`;
- regression, secret-scan, migration-gate, and runtime-image evidence;
- confirmation that upload recovery and permanent deletion remain unchanged;
- remaining risks and rollback instructions.

Use this exact blocker if credentials remain unavailable:

`BLOCKED — live Cloudflare R2 upload, processing, and deletion verification could not be performed because the required Cloudflare R2 endpoint and credentials were not supplied.`

Do not claim production readiness, M3 acceptance, or 10,000-user capacity. Stop after the report and handoff. Leave changes uncommitted so the independent manager can inspect the actual diff and reproduce the critical Docker tests.
