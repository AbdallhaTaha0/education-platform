# M6 package 01 report — performed directly

Date: 2026-10-01, Africa/Cairo. Executor: this agent, after the owner explicitly assigned direct work instead of OpenCode while Docker downloads again. No external worker, subagent or other chat was dispatched. This is a documentation package; no application implementation or independent runtime acceptance is claimed.

## Result

Created `m6-notification-contract.md`: concrete event/recipient/lifecycle definitions; bilingual safe content; proposed persistence and source markers; transactional producers and expiry/renewal lock ordering; recipient-scoped APIs and read-all fences; Socket.IO/Redis transport consistent with the original architecture; ongoing cookie/session authorization; reconnect and failure recovery; retention; migration/activation/rollback; and N01–N11 later acceptance scenarios.

Requirements trace to R01/R02/R03/R04/R05/R08/R09/R10/R11/R13/R14 and new R17, under D25 plus preserved D04/D05/D09/D12/D14/D16/D21. Technical mechanisms and tuning defaults are explicit implementation-contract proposals, not new owner business policies.

The contract is ready for the next source-review/implementation stage after Docker readiness and M5 acceptance are established. Package 01 itself needs no application test run. This agent reviewed its own contract against the implementation; that is same-agent source review, not an independent reviewer or milestone acceptance.

## Material source findings and corrections

- Existing access cookies have path `/api`. A conventional root `/socket.io` connection would not receive them; the proposed route remains under `/api` without moving or exposing cookies.
- A connection-time auth check is insufficient for a long-lived socket. Per-signal durable session/Redis checks and an access-expiry disconnect prevent a blind room broadcast from bypassing ongoing authorization. Minimal realtime signals plus authenticated refetch reduce privacy exposure.
- Socket delivery/Redis Pub/Sub are transient, so the contract stores durable inbox rows and never marks them read/received from a successful emit. Reconnect and synchronization recover missed signals.
- Unarchive changes publishedAt. An immutable first-publication marker plus a frozen transaction audience prevents duplicate announcements and newly selected retry recipients.
- Expiry must scan subscription groups, not playback references. Lock ordering matches course SHARE then wallet UPDATE, followed by a fresh latest-expiry query; old purchase boundaries are suppressed when a renewal extends access.
- Read-all uses a recipient sequence fence so concurrent arrivals, including delayed fanout of older source events, remain unread. Retention cleanup does not reset source deduplication markers or erase financial evidence.

## Changes and future impacts

Created the notification contract and this report. Updated README, requirements, architecture transcription, delivery/implementation plans, Docker/operations and test/review plans for D25/R17 traceability. Updated decisions and manager/package/handoff documents to record the later direct-work assignment. Historical M5 evidence and original design files remain unchanged.

Future package 02 proposes additive platform notification tables/indexes and recipient-only APIs; package 04 proposes source delivery markers, producers, Socket.IO dependencies inside the same app, Redis adapter connections and one Nginx socket route. No schema migration, configuration/ignored-file edit, dependency install, product change or DRM change has been made now. No new service/provider/queue/public port is proposed.

## Commands and evidence

| Activity | Result |
| --- | --- |
| `git status --short --branch`, `git rev-parse HEAD`, independent DRM status | Platform remains `4b949cc`; pre-existing manager documentation preserved; DRM clean at `bad0c1d` |
| File reads/searches of locks, ledger, purchase, recharge review, publication, entitlement/expiry, identity cookies/session, routes, Nginx and tests | Source contract review; no application execution |
| Official Socket.IO documentation inspection | Verified transport/affinity, Redis-adapter recovery limits, connection-middleware lifecycle and delivery limitations; supporting links are adjacent to claims in the contract |
| Local Markdown link, UTF-8 replacement-character and date-example checks | PASS across 13 documentation files; 2026-10-01 + 180 days equals 2027-03-30 in the example; file inspection only |
| `git diff --check` and scope inspection | PASS; documentation-only change set, DRM remains clean at `bad0c1d` |
| Docker/application tests, migrations/builds, real DRM/R2 journey | NOT RUN; owner is reinstalling Docker |

The preceding session's 20/20 wrapper selftests and successful Compose isolation guard are preserved in the handoff report, not rerun or presented as M6 runtime evidence. No host application service or application test suite was used as a substitute for Docker.

## Review limits and next gate

Formal owner M5 acceptance remains unconfirmed. The direct-work instruction is authorization to do the assigned work, not acceptance of M5 or production. Docker installation is controlled by the owner; this agent did not modify it during the download. Restore Docker before applying migrations, installing runtime dependencies, starting services or running application checks.

Recipient selection at the publication transaction's snapshot, 180 days from logical notification creation, and no historical backfill are stated engineering interpretations. No historical event synthesis is authorized. If implementation evidence reveals a requirement for a new channel, historic campaign, source-retention policy, service or framework, stop only that dependent change and obtain owner direction. Keep notification content within the approved scope.

Production gates remain: commercial DRM/Widevine, hosting/TLS/secrets/monitoring/topology, backup/restore/recovery/rollback, dependency remediation and 10,000-user qualification. No commit, push or deployment was performed.

## Cleanup and rollback

No containers, volumes, tenants, users, media, secrets or scratch resources were created by package 01. No data cleanup is needed. Rollback consists of selecting only this package's documentation hunks; preserve earlier manager changes and owner changes, never reset the working tree or nested checkout. Leave the source/report uncommitted for review.
