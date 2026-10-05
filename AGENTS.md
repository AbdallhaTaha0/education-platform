# Agent entry point

Read [the index](reports-and-markdown-files/README.md), [agent responsibilities](reports-and-markdown-files/agent.md), [rules](reports-and-markdown-files/rules.md), and [decisions](reports-and-markdown-files/decisions.md) before working.

The owner's original design is preserved; subsequent explicit owner clarifications govern interpretation. Unanswered questions are not permission to invent policies.

Use client/ and server/ for platform implementation. The backend is ONE Express application with separate internal modules, horizontally replicable behind Nginx. Exactly STUDENT and ADMIN roles.

education-drm-service/ is an independently deployed external dependency. Platform code consumes only its API and never accesses its database. Its technology choices remain independent of the platform's Nginx/Redis/PostgreSQL/Prisma stack. Default work must not edit it; however, the owner explicitly authorized bounded DRM-maintenance prerequisites on 2026-09-28 for permanent media deletion and on 2026-09-29 for retry-safe reissuance of an upload URL for the same existing UPLOADED asset. Only a prompt that explicitly assigns one of those bounded DRM tasks may edit the nested package.

Confirmed scope: recorded programming courses; admin-set fixed subscription duration; student-submitted manual recharge requests verified/approved by admins in EGP; Arabic primary and English secondary with both content translations mandatory; authentication/session tokens in cookies, never local storage; stop access on subscription expiry. External DRM owns video processing, security and watermarks. No live classes.

Milestone 1 is accepted at revision fce352f, Milestone 2 at revision b8080a8,
Milestone 3 at revision d520dd7, and Milestone 4 at code checkpoint 03e51eb.
The accepted nested DRM recovery checkpoint is 5293917. Follow the assigned
milestone's scope. Development and verification must use Docker. A DRM defect
is authorization to repair that package only when the owner's explicit
DRM-maintenance prompt assigns it; that permission does not merge DRM
persistence or internals into the platform backend.

Use reports-and-markdown-files/design.md as the current UI specification. The earlier generated Stitch pages are not an implementation source. Keep visual tokens easy to revise when the owner reviews colors.

On 2026-10-04 the owner explicitly approved the bounded DRM device recovery in reports-and-markdown-files/course-video-device-limit-20261004.md: application/tenant-scoped protected inspection and inactive ACTIVE registration release, audit/concurrency regressions, and recovery of the named local synthetic student through the API. Preserve active playback and REVOKED registrations; no limit increase, external persistence access from platform code, unrelated DRM maintenance, production release or commit/push. Outcome and limits: reports-and-markdown-files/course-video-recovery-20261004.md.

Later on 2026-10-04 the owner instructed the coordinator to fix remaining playback-handoff bugs directly, then commit and push the completed work and make a report. This authorizes delivery of verified platform fixes and previously completed website UX in this task; it does not accept unfinished course-material integrations, authorize nested DRM changes or production deployment. Preserve pending worker changes outside the delivered commit.

M6 notification functionality was independently reviewed and explicitly accepted by the owner on 2026-10-01, with commit/push authorized. Read reports-and-markdown-files/m6-owner-acceptance.md and m7-01-open-code-worker-prompt.md for the accepted scope and bounded M7 readiness handoff. This does not imply formal M5 acceptance or production/capacity approval and grants no new DRM maintenance scope.

On 2026-10-01 the owner explicitly assigned the bounded recorded-video DRM packaging repair: emit a static, finite-duration DASH manifest using Shaka Packager, add affected processing regressions, and verify real-browser playback. This permits only that worker/test maintenance; the external API-only architecture and persistence boundary remain unchanged. See reports-and-markdown-files/drm-recorded-manifest-repair-proposal.md.

M9 direct implementation was explicitly authorized on 2026-10-01. Read reports-and-markdown-files/m9-implementation-contract.md, m9-schema-api.md, m9-docker-runbook.md and m9-implementation-report.md. Earlier M9 planning-only restrictions are historical. The reusable web IDE, private isolated grading, allowance controls and required/optional progression preserve this one-backend architecture. Only the trusted grading controller may access the execution-host Docker socket; web replicas and untrusted execution jobs must not. The exact grading-only seccomp namespace/chroot allowances were owner-approved. No new DRM edit, production deployment, 10,000-user certification or milestone acceptance is granted. Commit/push follows explicit owner milestone acceptance.

Later owner instruction on 2026-10-04: finish the remaining course-material integration, commit/push/report, then shut down the laptop; subsequently clarified "push both the drm and the platform". This supersedes prior no-push/pending-material restrictions for this delivery. Deliver the completed platform integration and existing bounded DRM recovery, without new nested implementation or production deployment. See reports-and-markdown-files/course-materials-and-dual-repository-delivery-20261004.md for final evidence and retained-data recovery.

On 2026-10-06 the owner instructed "fix the drm" following the security audit, authorizing bounded F01 key-safe packaging/processing errors and F03 webhook public-address normalization/pinned HTTPS transport. The owner separately approved the TypeScript ESLint v8 tooling upgrade to remove the DRM F02 development chain; qualified version8.71.0 preserves the existing package-age policy. See reports-and-markdown-files/drm-security-repair-20261006.md. This grants no unrelated nested maintenance, historical data deletion, production deployment or commit/push; preserve the API-only platform persistence boundary.

Later on 2026-10-06 the owner instructed “do them” for the proposed security follow-up, authorizing an independent review and commit/push of the verified platform and bounded DRM security repairs. Private exposure triage and frontend/browser dependency follow-up are included. The owner confirmed no production deployment exists; no deployment is authorized or performed. See reports-and-markdown-files/security-delivery-20261006.md.
