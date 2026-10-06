# Open Code correction prompt — remove timing race from preserved recovery proof

## Boundary

This is a focused correction after independent manager review of the bounded DRM job-status fix. Preserve every existing platform and nested DRM production change. Do not edit production code, SQL, storage behavior, routes, worker behavior, migrations, schemas, or platform files. Only the affected DRM test/evidence wiring and the two DRM implementation reports may be changed if necessary.

Do not commit, push, deploy, open a PR, remove development volumes, or discard uncommitted work. Use a separately named disposable Docker project and leave the correction uncommitted for review.

Read `AGENTS.md`, the documentation index/rules/decisions, both DRM worker prompts, both DRM implementation reports, and the actual current diffs before editing.

## Independently reproduced failure

The job-status production correction itself passed independent review: the new processing suite passed 7/7, including first-registration and recovered uploads reaching `READY` through the real worker.

However, a fresh independent run of the preserved upload-recovery suite produced **37/38**, contradicting the reported 38/38:

```text
media-upload-recovery-lifecycle.integration.test.ts
"refuses a new recovery and re-uses of completion after the asset left UPLOADED"
expected playback session status 409, received 201
```

The manager queried the same disposable database after failure. The asset was legitimately `READY`, so playback 201 was correct. The test contains a scheduling race: before the job-status fix, or when processing is slower, it observes a non-READY asset and expects 409; after the fix, the real worker may reach `READY` before the playback request, making 201 correct.

The required recovery invariants did hold: the stale URL did not reopen completion, a second completion returned 409, further URL recovery was refused, and no second processing job was created. The defect is the timing-dependent playback assertion, not evidence of a production regression.

## Required correction

Make the lifecycle test deterministic without weakening its intended security assertions:

- keep the stale presigned PUT proof;
- keep the second completion rejection (`UPLOAD_ALREADY_COMPLETED`);
- keep refusal to issue another recovery URL after leaving `UPLOADED`;
- keep the exactly-one-asset/job/source-identity assertions;
- explicitly observe the asset state before asserting playback behavior;
- do not require 409 after the asset has legitimately reached `READY`;
- preferably wait for the real worker's terminal state, require `READY`, then require playback creation to succeed only after that observed `READY` state;
- if non-READY playback denial is retained, test it under an explicitly controlled non-READY state rather than racing the real worker.

Do not solve this by accepting either status without checking the corresponding asset state. Do not add sleeps as the correctness mechanism. Use bounded polling or existing helpers.

Update the implementation reports truthfully: record the independent 37/38 reproduction, its exact cause, the corrected deterministic assertion, and the new rerun evidence. Do not hide the failed manager run.

## Docker verification

From a freshly rebuilt current test image and a disposable project, run:

1. processing lifecycle 7/7;
2. upload recovery 38/38 twice consecutively;
3. accepted deletion 44/44;
4. unit 48/48 and existing integration/media/e2e scaffolds;
5. typecheck and `git diff --check`.

Report exact commands, counts, failures, and image IDs. Live R2 remains blocked and must not be represented by SeaweedFS.

Stop after updating the relevant reports and handoff. Confirm no production file changed as part of this correction.
## Owner-required Docker test cleanup (2026-10-01)

After completing the assigned work, or after failure/interruption/stop, clean up the Docker test environment you created. Before removal, verify the exact project labels, resolved container/network/volume names and every mount; target only this assignment's owned disposable test resources and fixtures. Remove owned test containers, networks and volumes, including any owned anonymous volumes identified from container mounts. Never use global prune or delete unrelated data, the existing previews, reusable images needed for review, or saved reports/evidence. If a test resource must remain temporarily for an active check, record its owner and reason, then clean it when that check ends. Report the final cleanup verification and any resources that could not safely be removed. Every future prompt must include this requirement.
