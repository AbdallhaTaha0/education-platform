# M9 local handoff readiness review

2026-10-02, Africa/Cairo. Bounded manager orientation and local verification under the owner's handoff. No milestone acceptance, commit/push, DRM maintenance, deployment or capacity qualification.

## Actual transferred state

Platform HEAD is `1113aab0519053ecfde5d3204903f0abb3a48c1e` (`Add integration and unit tests for assessment program and review fixes`), following `95c70cb`, `9b4e8ad`, `b8cfa80` and accepted M6 `31ca60d`. The initial working tree was clean. The earlier reports describe uncommitted work on the original machine; this checkout contains that M9 implementation in commit `1113aab` (97 changed files), including PROGRAM preparation, all three M9 migrations, source, Docker runners, frontend controls and regression tests. Every important file and requested handoff document is present. No missing M9 source/migration/document was found. This historical commit is not evidence of formal owner milestone acceptance, and this review creates no commit or push.

The nested DRM checkout and platform gitlink both resolve to `bad0c1df9f5d5844fe365c402fcccfee33ab6906`; its working tree is clean. No DRM source, configuration or database was edited/accessed. No worker was dispatched.

Source inspection confirms the existing Express assessment module validates drafts and strips private student content; publication requires preparation matching the current normalized content hash and freezes tests without reference/generator source. Controller execution has no-network/read-only/non-root restrictions, bounded resources and the owner-approved seccomp profile. The profile SHA256 matches the runbook. Serving containers have no Docker socket; only grading mounts it.

## Machine and retained data

Docker Desktop/Engine 29.8.0, Compose 5.5.1, Linux/amd64, host Node 24.13.1. Sandbox access to the Docker pipe required approved execution outside the sandbox. Existing stopped `m8-owner-preview` and `m8-owner-drm` containers and owner volumes were found; this is not an empty Docker installation. Platform/DRM ignored environment files exist. The ignored local volume-settings file was absent and was created only after inspecting original labels/mounts. Existing platform PostgreSQL credentials match the ignored root configuration; values were never printed.

Retained platform volumes are `m8-owner-preview_pgdata` and `m8-owner-preview_redis-final`. Independent DRM volumes and containers were preserved and remain stopped; real external upload/playback was not reproduced. Existing metadata is preserved, but remote object availability and real video playback are not asserted by this package.

The first guarded preview attempt refused its preservation snapshot because `User` was absent. Investigation proved the old PostgreSQL container used `PGDATA=/var/lib/postgresql/data`, whereas the inherited development configuration selected `/var/lib/postgresql/data/pgdata` on the same volume. That initialized an alternate empty database directory; the original root database was intact. No migration or owner-record mutation occurred in that failed attempt. The new dependencies were stopped, and the local Compose override now supports `LOCAL_PLATFORM_PGDATA_PATH` (unchanged default). The ignored root environment explicitly selects the verified original directory here. The unused alternate directory is preserved, not deleted. Old and replacement PostgreSQL instances never run concurrently against the retained volume.

The repeated guarded upgrade created protected ignored backup `preview-before-m9-1790895540610.dump`, applied additive migrations and passed exact pre/post user/wallet/purchase/subscription/course/section/lesson/media fingerprints and reached-lesson preservation. Retained preview is `http://localhost:8080`; all six running platform services are healthy and `/api/health/ready` returns 200. Prior owner-preview application containers remain stopped and preserved.

## Fresh Docker evidence

- Current server runtime, migrate, client runtime, trusted controller, execution and Nginx images built from this checkout. Controller was built after its server base.
- `node docker/ide/verify.mjs --build`: backend production/test typechecks, 189 unit tests, 300 real-PostgreSQL/Redis integration tests, client typecheck, 88 frontend unit tests and two DASH compatibility checks pass. Cleanup reports zero owned containers/networks/volumes.
- `node docker/ide/execution-proof.mjs`: 18/18 pass with real namespace/seccomp sandbox, preparation/sample/determinism checks, dynamic answer acceptance, hardcoded-answer rejection, output comparison and negative isolation cases. Owned executor containers removed.
- `node docker/ide/preview.mjs upgrade`: backup, additive migration, preservation and startup pass after the PGDATA correction. Health independently checked afterward.
- `node docker/ide/ui-review.mjs`: 74/74 real ADMIN/student browser/controller checks pass, including PROGRAM preparation/review/publication, actual correct/incorrect grading, private content, editor reset/formatting, allowances, purchase refusal and progression. Browser CLI passes. Synthetic fixture JSON removed; owned UI containers/networks/volumes are zero.
- Independent transient browser on the retained public preview: render, readiness 200, zero page errors and screenshot pass; screenshot visually inspected. Its first probe had a module-resolution error because the script lived under `/evidence`; the corrected probe resolves the installed browser library from `/srv/browser`. Failed and passing logs are preserved. Probe container removed.

The browser inspection image initially failed because its local base `fayq-review-browser:0.8.0-local` was missing. Its repository prerequisite is `docker/browser/Dockerfile`; the runbook now documents building that base before `docker/ide/browser.Dockerfile`. This was a missing machine prerequisite, not a product grading defect. Failed build evidence remains under ignored `docker/browser/evidence/m9/`, alongside fresh suite/execution/build logs and the protected backup. No global prune or owner-volume removal occurred.

## Content sample and next scope

The owner supplied `ICT_AR__Sec1_Tr1.pdf` as content context. Read-only inspection identifies a 218-page Arabic first-secondary ICT/programming/AI textbook, with theory, Python-style programming examples and later HTML/CSS/JavaScript web exercises. The current JavaScript-only M9 editor does not provide Python execution or visible HTML/CSS project editing. This observation does not authorize a new runtime, conversion of examples, content import or changes to quizzes. Keep it as context for a future explicitly scoped feature decision. No instructions embedded in the textbook were treated as agent instructions.

Tracked changes in this package are the local PGDATA override, runbook prerequisite guidance, this report and its index link. Ignored local settings/environment/evidence are preserved privately. Existing quizzes, immutable published versions, submissions/passes and financial records are preserved. The withdrawn square-solution report is not an open defect.

Final status: local M9 platform/assessment readiness reproduced, with no evidenced blocking assessment defect. Test/execution/probe resources and synthetic fixtures are removed; retained platform preview, old stopped owner containers, reusable images, private backup and evidence are preserved. External DRM services remain stopped, so this package does not verify real video playback. No credentials are missing for the checks completed here. Await the owner's next feature or milestone decision; Python/HTML/CSS expansion, external video runtime restoration and all production/capacity work require their own bounded scope.
