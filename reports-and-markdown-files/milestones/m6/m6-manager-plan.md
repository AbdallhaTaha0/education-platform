# M6 manager preparation plan

Date: 2026-10-01. Authority: owner handoff request and D25. This is a manager plan; the linked package reports contain implementation evidence. The owner assigned direct work during Docker download and repeated that instruction after restoring it. Packages 01–05 have bounded direct implementation/functional evidence. The owner then approved the proposed separate-reviewer review/fix/acceptance sequence with "go for it". [Independent review is complete](m6-independent-review-report.md): ACCEPTABLE FOR OWNER REVIEW, with no blocking application finding. [Owner M6 acceptance is recorded](m6-owner-acceptance.md), with explicit authorization to commit/push. No new user-owned chat was created. DRM remains outside this assignment.

## Checkpoint and prerequisite

Preserve platform `4b949cc` and independent DRM `bad0c1d`, including their matching gitlink. M1–M4 acceptance is recorded. M5's historical local functional review passed and is ready for owner review; formal owner acceptance is still awaiting confirmation here. The owner's subsequent direct-work instruction, repeated after Docker restoration, authorizes independent bounded M6 development. Docker smoke and the package-specific checks remain required; M5 acceptance is not inferred from that direction or from commits.

## Confirmed scope

| Event | Recipient | Trigger |
| --- | --- | --- |
| Recharge approved | Requesting student | Committed decision and wallet credit |
| Recharge rejected | Requesting student | Committed immutable rejection |
| Course available | All students | First successful publication only |
| Subscription expired | Affected student | Effective access expires, accounting for renewals; once per effective expiry |

In-platform realtime delivery only. Chat/email/WhatsApp are deferred. Provide read/unread and mark-all-read, no dismissal, and 180-day notification retention. Preserve FAYQ design, Arabic primary/RTL, English/LTR, both themes and mobile accessibility. No new admin notification editor, broadcasts for arbitrary events, reminder campaigns, purchases, refunds, password recovery or identifier verification are implied.

## Initial source observations used to prepare the contract

- `server/src/app.ts` mounts identity, catalog, wallet and learning in one Express application; `index.ts` runs internal reconciliation and cleanup tasks. M6 must remain an internal module.
- `wallet/recharge/service.ts::reviewRecharge` commits the status, credit and audit together. A realtime emission before commit could announce money that later rolls back. Persist notification intent in the authoritative transaction, then deliver after commit.
- `catalog/lifecycle/service.ts` has publication and unarchive paths. Unarchive can reset `publishedAt`, so that mutable timestamp alone cannot prove first publication. Specify a durable first-publication identity before adding a producer.
- `Subscription` has one row per purchase, including future intervals created by early renewal. Never notify for an old purchase row while a renewal still covers the student/course. Expiry notice scanning must cover all subscriptions, including students who never started playback. The playback reconciler scans playback references and cannot be the sole notification source.
- Identity authenticates protected cookies with durable session checks and Redis revocation state. Persistent connections require continued session authorization, not just a successful handshake.
- The original architecture transcription includes Socket.IO with a Redis adapter and BullMQ/Redis. No such notification runtime is currently present. Check that diagram path before selecting a transport; do not introduce a separate API, broker or provider.
- Nginx currently forwards ordinary HTTP with a 15-second read timeout and lacks an explicit socket upgrade configuration. A transport package must address its actual routing and multi-replica behavior.

## Engineering recommendations for contract review

These describe proposed mechanisms, not additional owner business decisions or existing functionality:

1. PostgreSQL stores durable event intent and recipient notification/read state; Redis coordinates delivery across existing backend replicas. Treat realtime as an update signal and the authenticated inbox as the durable authority.
2. Prefer the architecture's Socket.IO/Redis adapter inside the existing HTTP application. Document WebSocket-only versus fallback transport and any affinity requirement. Do not choose SSE or a different framework silently. Do not add a queue/service topology solely because BullMQ appears in the diagram.
3. Use deterministic event/recipient uniqueness and a durable dispatcher with bounded batches, retries and crash recovery. At-least-once signals may duplicate; the inbox and frontend must converge on one logical notice. Mark-read mutations must be idempotent and protected by existing session/Origin/CSRF controls.
4. Define recipient selection as students existing at the first-publication commit, with stable fanout pagination. Define how archived/deleted courses produce safe historical notices and inaccessible links without leaking protected lessons. State these interpretations explicitly in the contract and flag any additional business choice.
5. Define retention from notification creation, and preserve minimal event deduplication evidence where necessary after inbox cleanup. Do not purge wallet, proof-retention, subscription or audit records through notification cleanup.
6. Document the concurrency ordering between renewal and expiry-event commit using current course/wallet locks and current entitlement rules. Avoid rewriting accepted purchase semantics to simplify notifications.
7. Give realtime notices minimal identifiers; fetch private details through authenticated APIs. Do not put recipient IDs or tokens in caller-selected rooms or URLs. Reauthenticate after access-cookie refresh, and stop delivery on logout, revocation or expiry.

## Sequential work packages

| Package | Deliverable | Review gate |
| --- | --- | --- |
| 01 Contracts and traceability | Event/recipient/lifecycle table, API and realtime proposal, persistence/delivery design, failure/replica scenarios | Documentation-only; inspect current source, preserve approved scope, resolve policy ambiguities before code |
| 02 Backend persistence and APIs | Reviewed additive Prisma migration and internal notification module; recipient-scoped inbox/count/read APIs | Docker migration/upgrade and authorization/CSRF/idempotency checks; no event producers yet |
| 03 Bilingual inbox experience | Header entry, list/unread/read-all controls, empty/loading/error states following FAYQ | Arabic/English, dark/light, keyboard/mobile; sensitive data stays transient |
| 04 Event production and realtime | Reviewed committed producers, durable dispatch/fanout, realtime transport and Nginx configuration | Financial rollback/concurrency, first-publication uniqueness, renewal/expiry ordering, disconnect/retry/revocation and cross-replica delivery |
| 05 Focused end-to-end acceptance | Docker browser, failure/restart/replica and retention verification | Evidence reviewed independently; no release/capacity claims from local functionality |

Package 01's original assignment is preserved in `m6-01-contracts-worker-prompt.md` and is now performed directly under the owner's later instruction. See `m6-notification-contract.md` and `m6-01-contracts-worker-report.md` for the result and its source-review limits. Review each package before beginning the next. The owner's direct-work assignment changes who performs the work; it does not bypass Docker, business-policy or acceptance gates.

Packages 02–04 are implemented and verified directly following Docker restoration and the owner's continuation; see [the backend report](m6-02-backend-report.md), [the inbox report](m6-03-inbox-report.md) and [the delivery report](m6-04-delivery-report.md). [Package 05](m6-05-acceptance-report.md) passes 65 Docker assertions with separately deployed replicas, backend/database recovery, five crash boundaries and concurrent retention. The owner-authorized [separate reviewer](m6-independent-review-report.md) reproduced those assertions and critical server/client, authority/renewal, Redis and migration checks. A P3 Prisma diagnostic limitation is addressed by independently verified read-only operations guidance; applied migration history and app source remain unchanged. Current notices come from committed source operations and use Socket.IO/Redis with durable HTTP resynchronization. The owner subsequently [accepted M6](m6-owner-acceptance.md); [OpenCode package 01](../m7/m7-01-open-code-worker-prompt.md) begins with bounded M7 readiness preparation. Earlier same-agent reports remain historical evidence; they are not relabelled independent. Milestone closure and commit/push follow that explicit acceptance.

## Verification and stopping rules

Use Docker application images built from the actual checkout. The guarded `rs256-project.mjs` controls isolated platform project/port/volumes. Inspect volume attachments and resource ownership before mutation or cleanup. The engine being unavailable blocks runtime evidence, not documentation preparation. Host Node may orchestrate the wrapper; do not run application services or application suites on the host.

Do not repeat historical full M5/DRM suites without a new change, failure or missing gate. Notification acceptance should exercise targeted money, privacy, transaction failure, duplicates, retention, auth/session and two-replica behavior. Record image identities, commands, assertions, failure/skip/block counts and exact cleanup. A worker summary is insufficient acceptance.

After owner milestone acceptance, commit reviewed changes and push to the correct platform repository. DRM remains read-only: no new maintenance assignment exists. Keep secrets, local environment files, private evidence and media out of Git. Production remains unapproved pending commercial DRM/Widevine, hosting/TLS/secrets/monitoring, backup/restore/RPO/RTO/rollback, dependency remediation and the 10,000-user qualification.
