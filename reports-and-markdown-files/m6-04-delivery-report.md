# M6 package 04 — committed events and realtime delivery

Date: 2026-10-01, Africa/Cairo. Authority: D25/R17, the owner's direct implementation assignment and "next" following package 03. Implemented and verified directly in this chat. This is same-agent source review and Docker evidence, not independent milestone acceptance. Platform HEAD remains `4b949cc394636c2df928d0b7642122da61e5301c`; nested DRM/gitlink remain `bad0c1df9f5d5844fe365c402fcccfee33ab6906`, unchanged and clean. Earlier uncommitted packages are preserved.

## Bounded result

Actual platform recharge decisions, first publication and effective subscription expiry now create durable notification intent. Existing backend replicas materialize the frozen audience and send minimal Socket.IO revision signals through platform Redis. The browser refetches its own authenticated inbox automatically, shows connection status, and recovers on reconnect. Notification receipt changes neither money nor access.

The implementation includes source deduplication, rollout baselines, renewable event/signal leases, retries, bounded expiry scanning and physical 180-day cleanup. It remains one Express application behind Nginx, with exactly STUDENT/ADMIN and implicit protected authentication cookies. No DRM code, configuration, database, container or media was changed.

Package 05 remains the focused final acceptance package: separately deployed backend replicas behind Nginx, backend termination/restart at delivery boundaries, broader failure and recovery combinations, and independent review. This report does not close M6 or infer M5 owner acceptance. Nothing was committed, pushed or deployed to production.

## Changes and source integrity

| Files | Result | Traceability |
| --- | --- | --- |
| `server/prisma/schema.prisma`, `20261001110000_m6_delivery/migration.sql` | Add first-publication/recharge markers, a rollout singleton, last effective-expiry markers, owner-level deliveredRevision and leased signal retries; partial due-signal index and checks | D25/R17; N04/N05/N10 |
| `notifications/producers.ts`, `wallet/recharge/service.ts`, `catalog/lifecycle/service.ts` | Notification intent commits inside the authoritative source transaction; one set-based publication audience insert; expiry rereads under course SHARE then existing wallet UPDATE | R04/R05/R13/R14; N02–N05 |
| `notifications/delivery.ts` | Tokened PostgreSQL claims, short atomic recipient materialization, crash-safe progress discovery, coalesced durable revision signalling, cleanup and bounded scheduler | R09/R10; N06/N07/N10 |
| `notifications/realtime.ts`, `server/src/index.ts` | Socket.IO attached to the existing HTTP server; independent Redis publisher/subscriber; ongoing session checks, token-expiry disconnect, inter-server invalidation and graceful stop | R02/R09/R13; N01/N08/N09 |
| `docker/nginx/nginx.conf` | Dedicated socket route strips /api once, forwards upgrade/cookies/Origin, and uses 75s timeout; ordinary API retains 15s | Existing architecture; N09 |
| Client notification `realtime.ts`, `context.tsx`, page and both locales | Same-origin cookie WebSocket, CSRF handshake, 100ms coalescing, reconnect resync, visible connection state and 30s visible-online recovery check | R01/R08/R13; N08/N11 |
| Both package manifests/locks | Pin server/client Socket.IO 4.8.3 and Redis adapter 8.3.0; server-side test client is development-only | Architecture compatibility |
| Integration/client tests, browser/fixture helpers, isolated Compose files and upgrade drill | Transaction, rollback, publication, retention, race, socket and real runtime/browser evidence | Docker/review rules |

Recharge review keeps its compare-and-set and single ledger credit; concurrent losers still receive ALREADY_REVIEWED. Rejection contains no notification copy of its private reason. FirstPublicationAt is set only under the existing course lock after publication validation; archive/unarchive leaves it unchanged. Audience membership is the committed STUDENT snapshot, excluding ADMIN and later registrations.

Expiry uses MAX(expiresAt) for each student/course and samples time after obtaining the existing purchase lock order. It does not depend on a playback reference. A missing/deleted course can still produce a valid historical expiry with an unavailable destination; it creates no wallet or financial entry. Renewals committed before the scanner gets its wallet lock suppress the stale boundary. A boundary already recorded remains historical if the student buys later; only a subsequent effective expiry may generate another notice.

## Migration and delivery choices

The ninth migration is additive. It records one activation timestamp, baselines prior final recharge decisions and course publication evidence, and raises an explicit error for an archived course whose publication history is ambiguous. Boundaries at or before rollout do not generate historical expiry backfill. Financial values, subscription intervals, current lifecycle status and original publishedAt are preserved.

Per-recipient notice, sequence/revision and audience materializedAt commit together. Fanout resumes from pending audience rather than trusting a cursor saved in a later transaction. Event leases renew while working; a stale token cannot finalize another owner's claim. One InboxState revision outbox covers insertion, read changes and cleanup; later mutations during publication leave a newer revision due. The package-02 per-notice signal fields remain historical internal fields, not the delivery authority.

The worker ticks once per second: one event/up to 100 recipients and up to 20 owner signals; up to 100 due expiry groups every five ticks; bounded cleanup every sixty ticks. Retry delay doubles from one second to a five-minute cap without jitter. Ten consecutive fanout failures expose FAILED while retries continue. Shutdown stops claims and awaits current work within the application's existing ten-second force deadline; interrupted work stays reclaimable. These are tuning defaults, not capacity or latency qualification.

Cleanup locks each affected inbox before deleting expired notice rows and advancing revision. It removes only empty expired events and their audience after those transactions, preserving minimal source markers and allocation/revision metadata. API visibility still ends at expiresAt even if cleanup is delayed. No proof, ledger, purchase, subscription, playback or audit retention policy changes.

## Transport, authorization and failure handling

Socket.IO uses WebSocket-only transport, engine path `/api/notifications/socket.io/` externally and `/notifications/socket.io/` internally, namespace `/notifications`. It requires no polling affinity or new public port. Exact Origin, verified access cookie, active durable session, Redis revocation and session-bound CSRF are checked at connection. Auth contains only the readable CSRF synchronizer; session/bearer credentials never enter URLs or auth payloads.

Each server-side invalidation is resolved against only local sockets. Before every client signal, that node rechecks durable session/revocation and original token expiry. A five-second authority heartbeat and a token-expiry timer disconnect stale sessions. Already queued bytes cannot be recalled. No client room/recipient/write protocol exists.

The only browser update envelope is `{schemaVersion:1,revision:"<decimal>"}`. Handshake/reconnect sends the current revision; the authenticated inbox is the durable authority. Redis PUBLISH success is not a delivery receipt. The pinned adapter has detached publication/subscription promises; the module captures their failures, awaits initial subscriptions and actual publication promises, and avoids its detached async acknowledgement path. Publication failure leaves PostgreSQL work retryable. Redis disconnection closes local sockets; reconnect resync and the 30s online recovery check cover missed transient signals.

Official compatibility/recovery references reviewed: [Redis adapter](https://socket.io/docs/v4/redis-adapter/), [server API](https://socket.io/docs/v4/server-api/), [client options](https://socket.io/docs/v4/client-options/). This follows the existing diagram's Socket.IO/Redis path.

## Docker verification

All application installs/builds/typechecks/tests and Chromium ran inside Docker. Host tools edited files and orchestrated containers. The guarded preview still uses `education-platform-rs256`, localhost:8082 and its two existing named volumes. Both preview and isolated browser runtimes used the final server image below.

| Image | Final observed identity |
| --- | --- |
| `edu-platform-server:0.5.0-m5-rs256verify` | `sha256:3554daf9abf72aa4f65b6e4dbb293c903869c720f0334cfb8925e62be7635f9b` |
| `edu-platform-migrate:0.5.0-m5-rs256verify` | `sha256:6c9eeaaff0cd8641f9374049e3d123f6aedf6cedca0ecebf2a875b6866d574ea` |
| `edu-platform-client:0.5.0-m5-rs256verify` | `sha256:43d53c90c980aebe9df7c1ee39a9891c42ab57ab2d93749cca78724377ec0f07` |
| Final server test image `:0.6.0-m6-delivery` | `sha256:4f2403308e11fd8d538a75f5f3b4f8f5148ee6802965aaf5520cf3de1693ef6a` |
| Client test image `:0.6.0-m6-delivery` | `sha256:46dbb41ef070185fd9576d5b00527f2ac24b2d846780264af15d2c51dd0cda71` |

| Gate | Observed result |
| --- | --- |
| Final server build/typecheck, including tests | PASS |
| Focused PostgreSQL/Redis integration | 18/18, zero failures/skips; rerun on a newly created isolated database after the final transport fix |
| Full server CI | Unit suite PASS and 251/251 integration across 30 files; exit 0 |
| Final client typecheck/tests | 70/70 Vitest, eight files; existing compatibility checks 2/2; zero failures/skips |
| Guarded production client/runtime builds | PASS; Prisma final runtime constructibility smoke PASS |
| Populated upgrade drill | 8→9; six legacy table snapshots unchanged, two historical publication markers and one decision baseline, zero historical events; private probe database removed |
| Nginx configuration | Syntax validation and reload PASS; actual WebSocket handshake through the same routes in isolated browser stack |
| Final Chromium producer journey | Decisions/publication 12/12, expiry 5/5, real Redis outage/recovery 5/5; total 22/22, zero failures/skips |
| Final repository checks | Tracked diff whitespace, strict UTF-8/untracked whitespace, 63 local documentation links and actual/test Nginx parity PASS; private fixture receipt removed |
| External DRM | No edits or external verification claimed; clean checkpoint preserved |

Full server CI ran at test-image identity `sha256:27a74dd88928c817e3b0bea2d225edeaf8c413e5300ec788e6262c4c00308877`, before the final transport-only detached-promise correction. Financial, publication, expiry, storage and client source did not change afterward. The affected 18 integration checks and all 22 runtime/browser checks were rerun on final source; the full unrelated server matrix was not repeated.

The eighteen cases cover six concurrent approval reviewers, rejection privacy, forced rollback after intent insertion, frozen recipients/later registrations, invalid and valid publication, unarchive suppression, source markers after retention, partial fanout, concurrent consumers, reclaim of a crashed lease, controlled publisher failure/retry, revision changes during publication, historical/early-renewal expiry without playback, a scanner waiting for renewal's wallet lock, exact retention cutoff, minimal cross-node signals, forbidden recipient/CSRF handshake, revocation and access expiry.

The two-node socket case starts two independent HTTP/Socket.IO servers and separate Redis-adapter connections inside the Docker test runner. It proves actual adapter inter-server delivery and recipient checks; it is not the separately deployed/restarted backend-container topology reserved for package 05.

## Real runtime browser journey and boundaries

The existing preview contained one STUDENT, so the fixture guard rejected broadcast seeding before creating accounts or events there. Broadcast checks moved to `m6-delivery-browser`, an isolated runtime project with no published host ports or development volumes. Its Nginx configuration is generated from the actual source, differing only in internal listen port 8082. Chromium resolves the same localhost:8082 origin to that private Nginx service. The server uses explicit test-only credentials and no DRM connection.

Two students and one admin log in through normal frontend controls in separate browser contexts. A labelled READY course/media mapping and pending recharge are internal fixtures, not proof of a real transfer or external media processing. No synthetic notification is seeded. Approval, publication and purchase use supported cookie/Origin/CSRF APIs. The open student inbox receives approval automatically; the other student and admin receive none. A duplicate review remains 409. First publication reaches both students and excludes ADMIN. An explicit purchase succeeds separately; reload/reconnect preserves exactly two notices.

The owned subscription's interval is then shortened only in the isolated fixture database. The real runtime expiry scanner creates the third notice, without a playback reference, and its actual WebSocket signal updates the open page. This verifies notification production, not external playback termination.

For the final outage check, Chromium first reports readiness to an ignored marker file. Host orchestration verifies the Redis container's project ownership, stops only that Redis service, waits for the page to show disconnected, then restarts it. The browser reconnects and retains exactly three durable notices. The backend's StartedAt remains unchanged; it did not restart to recover. All captured browser signals have exactly schemaVersion/revision. Persistent browser storage contains only language/theme preferences.

Final sanitized checks and two inspected Arabic screenshots are in ignored `docker/browser/evidence/m6-04/2026-10-01-m6-04-final-1790819255817/`. Earlier pre-correction browser evidence remains historical. Layout/theme mechanics were fully checked in package 03; this package adds only translated connection status.

## Corrections, limits and cleanup

Initial development found and corrected: a missing verified expiry projection in the socket identity type; test helper signature mismatch; fixture transfer-reference normalization, historical interval and one-based section/lesson positions; a test confusing the initial revision with the later update; and the real adapter startup bug caused by subscribing before Redis readiness. Final source review also found the adapter's detached async acknowledgement failure path and replaced it with awaited actual publication, including subscription/teardown rejection handling. Build and focused tests were rerun after relevant corrections. Final recorded gates above have no failures/skips.

Dependency debt is not closed. Full server install reports eight advisories; runtime production install reports three high advisories. A Docker production-filter audit against the test installation identifies Prisma/deepmerge-related packages, not the added Socket.IO packages. Client installation reports two moderate/one high inherited advisories. No unrelated dependency upgrade or production approval is implied.

After verification, fixture cleanup removes only run-owned source events/audit rows/users/course, and the receipt is removed from both container and host. Both isolated projects, their verified named PostgreSQL volumes and owned Redis anonymous volumes are removed. The existing preview and its data remain running; no original student, development volume, financial history or external media is deleted. No environment file, credential receipt or private evidence enters Git.

Rollback deploys the previous reviewed runtime/client by immutable identity, stopping new producers and transport. Retain the additive migration, rollout/source markers and durable intent/inbox data pending a separately reviewed database rollback. Never reset wallet/subscription state or delete shared volumes. Do not infer a historical backfill policy from rollback.

## Commands and next gate

Executed commands include Docker-only package-lock updates for the pinned dependencies; server/client test-image builds; `rs256-project.mjs check/build/up`; isolated `compose.m6-delivery-test.yml` with `compose.test.yml`; focused Vitest/typecheck then `npm run test:ci --silent`; the `m6-delivery-upgrade.mjs` mounted probe; Nginx test/reload; and isolated `compose.m6-delivery-browser.yml` runtime startup.

Browser runs use the existing Chromium image `edu-platform-browser:0.6.0-m6-inbox`, the isolated network, the runner mounted read-only, a private receipt mounted read-only and one ignored evidence-directory mount. `M6_INTERNAL=true` preserves the approved browser origin without publishing ports; phases are decisions, expiry and outage. The copied server fixture helper exposes seed-realtime, expire and cleanup only under its database/origin/non-production guard. Outage mutation targets the verified test Redis container only. Both projects are cleaned with their exact Compose files and `down -v` after inspecting ownership/mounts; no global pruning is used.

Package 04 passes bounded same-agent implementation review. Next is package 05's separately deployed replica/restart/commit-boundary verification and independent final review, followed by owner milestone acceptance. Commercial DRM, production deployment and 10,000-user qualification remain outside this package.
