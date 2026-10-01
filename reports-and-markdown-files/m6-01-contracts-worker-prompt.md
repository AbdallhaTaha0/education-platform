# OpenCode worker prompt — M6 package 01: notification contracts

Assignment status, 2026-10-01: the owner later assigned this agent to execute package 01 directly while downloading Docker again. The original bounded prompt below is preserved as the package definition, not a dispatch request. Completed documentation/source-review evidence is in `m6-01-contracts-worker-report.md`; no OpenCode worker was launched.

You are the implementation worker for one bounded documentation package. The owner dispatches this prompt manually and returns your result to the manager. Do not delegate, message other tasks, dispatch more packages, implement runtime features, commit, push or deploy.

## Objective and prerequisites

Prepare a concrete, reviewable M6 notification contract from confirmed D25 and existing code. The resulting contract must make the next backend package implementable without inventing policy. This package changes documentation only.

Read root `AGENTS.md`, the documentation index, `agent.md`, `rules.md`, `decisions.md`, `requirements.md`, `architecture.md`, `plan.md`, `implementation-plan.md`, `design.md`, `docker-and-operations.md`, `drm-integration.md`, `m5-manager-continuation-review.md`, `m6-local-handoff-review.md` and `m6-manager-plan.md`.

Starting platform checkpoint: `4b949cc`; independent DRM/gitlink: `bad0c1d`. Verify both working trees before work. Preserve subsequent owner/manager changes and do not reset the repositories. Historical M5 results remain historical on this machine. Formal M5 acceptance and local runtime readiness are separate gates for dependent product work; no commit implies acceptance.

Read the relevant current implementation and tests:

- `server/src/app.ts`, `index.ts`, `config.ts`, identity middleware/tokens/store/CSRF and session tests.
- `server/prisma/schema.prisma` and existing migrations.
- Wallet recharge review, purchase service and ledger; `wallet-review`, `wallet-purchase`, `wallet-integrity` integration tests.
- Catalog lifecycle, course transaction/locks; publication and course-lock integration tests.
- Learning entitlement and expiry reconciliation plus learning integration helpers/corrections.
- Client auth/API, routes, header, localization, theme and shared UI controls.
- Nginx configuration, Dockerfiles, Compose files and guarded verification wrapper.

## Approved requirements and boundaries

D25 authorizes realtime in-platform notifications only:

1. Recharge approval/rejection → requesting student.
2. First course publication → all students.
3. Subscription expiry → affected student, once per effective expiry after accounting for renewals.
4. Read/unread and mark-all-read; no dismissal; retain notices 180 days.

Preserve R01/R02/R03/R04/R05/R08/R09/R10/R11/R13/R14 and D04/D05/D09/D12/D14/D16/D21/D25. Exactly STUDENT and ADMIN; one Express application; PostgreSQL/Prisma and Nginx/Redis; Arabic default and both languages; current FAYQ design; protected authentication cookies; transient playback tokens. No live classes, chat, external delivery providers, automated purchase/credit, notification composer or general event framework is assigned.

`education-drm-service/` is read-only, including its configuration and Git registration. Do not access its database, add tenants, regenerate keys or change external services. Do not use historical DRM authorization for new work.

## Allowed deliverables

Create `reports-and-markdown-files/m6-notification-contract.md` and `m6-01-contracts-worker-report.md`. Update the documentation index and relevant requirements/implementation/operations/test-plan sections only for traceability to D25 and explicitly proposed contracts. Do not overwrite historical evidence or mark recommendations CONFIRMED. Do not change `client/`, `server/`, Docker/configuration files, lockfiles, Prisma migrations/schema, original JPEG/PDF or the DRM gitlink.

The contract must specify:

- Event names, authoritative triggers, recipient selection/time, bilingual content fields, safe links and versioned payload examples using fictional data. Define no retroactive handoff backfill by implication; surface any policy question explicitly.
- Logical event and recipient uniqueness, first-publication evidence despite unarchive resetting `publishedAt`, renewal-aware effective expiry and students with no playback references. Include concrete early-renewal, expired-renewal and concurrent-renewal timelines.
- Proposed persistence entities, indexes and transaction boundaries; notification/read state versus event intent versus financial/audit records. Give a non-executable schema sketch and additive migration/upgrade/rollback considerations. No migration is implemented now.
- Recipient-scoped list/pagination/unread-count/read-one/read-all API proposal, standard response/errors and ownership predicates. No caller-selected recipient or admin-global private-inbox privilege. Describe authentication/Origin/CSRF and mark-all-read behavior when notices arrive concurrently.
- Realtime transport matched to the original architecture's Socket.IO/Redis adapter. State alternatives/tradeoffs as recommendations if needed; do not introduce a different framework or topology silently. Specify cookie/session handshake, exact allowed origin, server-derived rooms, ongoing authorization, access refresh/logout/revocation/expiry, reconnect resync, duplicate signals and cross-replica reads/delivery. Include Nginx routing/upgrades/timeouts and affinity implications.
- Durable committed event production and delivery/fanout, bounded batch/retry/backoff/lease/recovery, failure observability and shutdown. No financial event may be emitted on a rolled-back credit; broker outages cannot repeat money or purchase operations. Avoid network I/O in wallet/publication database transactions.
- Retention start/boundary and independent idempotent cleanup; how dedup evidence prevents old event resurrection after cleanup; no coupling to the separate 180-day proof rule or preserved audit/ledger history. Identify interpretations that need owner clarification without converting them to requirements.
- Frontend contract and FAYQ interaction/accessibility states in Arabic/English, RTL/LTR, dark/light and mobile. Notification text must not expose protected lesson lists, proofs, sender identifiers, raw tokens, DRM secrets or signed media URLs.
- A traceability matrix and meaningful acceptance scenarios assigned to later packages: privacy/auth/CSRF, duplicate approval and credit integrity, transaction rollback, initial publication/republication/fanout, expiry/renewal races, offline recovery, Redis/process outages, session revocation, two replicas and retention.

## Docker and evidence

Read the wrappers before use. Use host tools only for file inspection and Docker orchestration. Start with `node docker/verification/rs256-project.mjs --selftest`, then `check`; this wrapper supplies exact isolated volume names, project, image tags and port 8082. Never bypass the guard, reuse default named development volumes in disposable tests, run global pruning or delete existing development volumes.

For this documentation-only package, inspect the manager's fresh environment smoke evidence and report any remaining engine/configuration blocker. Do not rebuild or repeat full suites merely for document edits. If a new environment check is required, use the wrapper's `build`/`up` only after resources, attachments and current-code identity are verified; keep output secret-free. Actual application verification stays in Docker. Mark a blocked or unrun check truthfully, and distinguish wrapper selftests from application acceptance.

Do not run key-generation, tenant-bootstrap, admin-bootstrap or real media lifecycle helpers. Do not output environment values, raw Compose config, credentials, private evidence or service inspection environments. Presence-only audit is the sanctioned ignored-file inspection.

## Acceptance, cleanup and rollback

The contract must have no contradictory recipient/lifecycle definitions, no unresolved required policy silently given a default, no implementation beyond the allowlist, and no framework/service/business deviation. Walk through rollback-before-credit, duplicate approval, lost post-commit dispatch, reconnect on another replica, revoked active connection, publication fanout interrupted mid-page, early renewal and retention replay. Explain how each scenario preserves privacy and converges without duplicate notices or money operations.

Validate Markdown links and source references against the actual checkout and inspect the final diff. No application tests are required solely for Markdown. Any temporary Docker resources must have verified ownership and isolated attachments; leave existing services/data untouched. Rollback is limited to your documentation hunks; never reset the tree or delete data.

Return changed files, requirement/decision IDs, exact commands and outcomes, concrete contract choices and their rationale, proposed future API/schema/config impacts, remaining questions, environment blockers, cleanup and rollback. Leave changes uncommitted for independent review. Stop after this package; do not begin backend, UI, producers or realtime implementation.
