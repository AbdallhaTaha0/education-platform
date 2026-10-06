# OpenCode agent 1 — backend, duration and protected materials

Copy this prompt into the first OpenCode agent. Run concurrently with agent 2 only after the owner dispatches the approved feature plan.

---

Implement the backend half of the course-learning enhancements, then stop for coordinator review. Work in `A:\Projects\Work Projects\education-platform`. Another agent owns the frontend and is working at the same time.

Read `AGENTS.md`, then `reports-and-markdown-files/README.md`, `agent.md`, `rules.md`, `decisions.md`, `design.md`, `../milestones/m6/m6-owner-acceptance.md`, `../milestones/m7/m7-01-open-code-worker-prompt.md`, the current M9 implementation contract/schema/API/Docker runbook/report, `course-ux-20261004/report.md`, `course-learning-enhancements-plan.md`, `course-learning-parallel-contract.md`, and `../playback/course-video-device-limit-20261004.md`. Later explicit owner clarifications supersede historical wording. The current dirty tree is intentional; preserve it, especially the playback device-identity/error repairs. Do not demand a clean checkout.

Own **only** `server/`, new `docker/course-learning-backend/` files and `reports-and-markdown-files/course-learning/course-learning-backend-report.md`. You are the sole Prisma schema/migration owner. Do not edit `client/`, existing shared Compose files, the plan/contract/index/design, another agent's harness/report, or `education-drm-service/`. Ask the coordinator about conflicting files/API assumptions and continue independent work. Do not reset, discard, stash or overwrite existing changes.

Implement the shared API contract exactly:

1. Read actual duration from the external DRM's existing status API, validate it, add nullable platform media-mapping duration through an additive migration, and expose it in the protected outline/materials response. Document an API-only bounded synchronization/backfill; never replace media or reset progress. Preserve unknown/invalid upstream duration as null. No DRM database access.
2. Build platform-owned private object-storage support for Arabic/English WebVTT pairs and lesson resources, separate from DRM video storage. Server credentials only; add configuration validation and a Docker storage fixture. No paid provider provisioning. Implement authenticated ADMIN authoring/validation/list/remove and STUDENT fetch/download endpoints from the contract.
3. Enforce publication/subscription/expiry/lesson-unlock on every student request, ADMIN/CSRF/Origin on mutation, file/body/label/type limits, sanitized download names, safe caption cue timestamps and text, no object key/public URL leaks, no sniffing and private/no-store. Preserve an old caption pair if replacement fails. No ZIP extraction or execution.
4. Implement retry-safe owned-object cleanup for replacements/removal/permanent course deletion; archive hides access and preserves objects. Cover failed upload, cleanup retries and concurrent deletion without leaking storage objects or changing wallet/submission/pass retention policies. Document recovery/rollback and any infrastructure-dependent limits.

Keep one horizontally replicable modular Express application, PostgreSQL/Prisma/Redis/Nginx, STUDENT/ADMIN only, bilingual content, cookie auth and current M9 isolated grading/progression. Never mount the Docker socket into web replicas or untrusted jobs. Do not change recharge, prices, access policy, notification behavior, grading sandbox or device-limit enforcement. Device recovery in the independent DRM is a separate assignment, not authority granted by this feature prompt.

Use Docker for all development and verification. Choose unique project/image names beginning `fayq-course-learning-backend-`; no shared localhost:8080 updates or owner-data destructive tests. Validate additive migration on populated disposable data and repeat apply. Run relevant typecheck/unit/integration/storage tests covering authorized success, anonymous/unsubscribed/expired/locked/archived/deleting refusal, cross-course isolation, malformed/oversized uploads, bilingual caption atomicity, missing duration, concurrent removal and cleanup retries. Do not call a mocked storage/DRM fixture real-provider evidence. Preserve private settings, signing keys, token/URL secrecy and existing data.

Hand off endpoint examples/schema, exact config names, migration impacts, changed files, rule traceability, Docker commands/results, failures/blocked checks, cleanup proof and rollback in your own report. Notify the coordinator that APIs are ready for agent 2's real integration; do not silently change the frozen contract or edit frontend files. Do not deploy, certify 10,000 users, accept a milestone, commit or push.

**Mandatory cleanup after success, failure or stop:** inspect Docker project/container labels and every resolved mount before deleting anything. Remove only your disposable containers/networks/volumes/fixtures. Preserve the existing owner preview, DRM services/data, unrelated projects, reusable images and saved evidence. Report final zero-owned-resource checks. Never use global Docker prune. Then stop for coordinator review.
