# M6 notification contract — package 01

Date: 2026-10-01, Africa/Cairo. Prepared directly after the owner assigned this agent to work instead of OpenCode while Docker downloads. Original package-01 status was documentation/source review only. Packages 02–04 subsequently implement storage, inbox, producers and delivery; their reports distinguish executed checks from pending final acceptance. Engineering mechanisms and numerical tuning defaults below are contract choices for implementation review, not additional owner business decisions.

## 1. Authority and scope

D25 confirms realtime in-platform notices, with no chat/email/WhatsApp: recharge decisions to the requesting student; first course publication to all students; subscription expiry to the affected student once per effective expiry after accounting for renewals; read/unread and mark-all-read; no dismissal; retain notices for 180 days.

Preserve R01/R02/R03/R04/R05/R08/R09/R10/R11/R13/R14, D04/D05/D09/D12/D14/D16/D21, and FAYQ `design.md`. Notification receipt never credits money, purchases access, renews a subscription or authorizes playback. Notification cleanup never removes proof, ledger, purchase, subscription or audit records. DRM remains an independently deployed API-only dependency and read-only in this assignment.

Keep all platform functionality inside the existing Express application and React client. PostgreSQL/Prisma is the durable authority; Redis connects existing replicas. Use the diagram's Socket.IO/Redis-adapter path. No new external delivery provider, broker, service or BullMQ queue topology is needed for this bounded feature.

## 2. Source findings

| Source | Existing behavior | Contract consequence |
| --- | --- | --- |
| `wallet/recharge/service.ts::reviewRecharge` | Pending decision, wallet credit and audit commit together; concurrent losers receive 409 | Insert durable notice intent in the same transaction; dispatch later; never replay a financial operation to retry delivery |
| `catalog/lifecycle/service.ts` | Publication validates translations/readiness under a course lock; unarchive can overwrite `publishedAt` | Use separate immutable first-publication evidence; unarchive cannot emit another first-publication notice |
| `wallet/purchase/service.ts` and `wallet/ledger.ts` | Purchase holds course SHARE, then wallet UPDATE; one subscription per purchase | Expiry notification transaction must serialize with this lock order and reread subscription state after acquiring the wallet lock |
| `learning/access/entitlement.ts` | Effective expiry is the maximum expiry for student/course; the exact expiry instant is exclusive | Do not notify per old purchase row; early-renewal rows suppress the old boundary |
| `learning/expiry/reconciler.ts` | Scans playback references for external termination | Add independent notification scanning of subscription groups; a student need not have a playback session |
| Identity middleware/store/cookies | Access cookie path `/api`, refresh path `/api/auth`; durable session checks and Redis revocation | Socket path must be under `/api`; ongoing connections need expiry/revocation enforcement |
| `docker/nginx/nginx.conf` | Generic `/api/` strips prefix; no socket upgrade headers; 15-second timeout | Add one explicit future socket route with deliberate path mapping and longer idle timeout |
| `client/src/routes.ts` | Hash routes for wallet, dashboard and public course offers | Notices link only to safe existing destinations or the new inbox; no protected outline data in payloads |

These findings are from source inspection, not Docker execution. Existing M5 tests are historical; package 01 changes no runtime files.

## 3. Event contracts

| Type | Authoritative trigger | Recipient set | Logical key |
| --- | --- | --- | --- |
| `RECHARGE_APPROVED` | Successful committed APPROVE with the credit ledger entry | Request owner | `recharge:<requestId>:decision` |
| `RECHARGE_REJECTED` | Successful committed immutable REJECT | Request owner | Same decision key; a request cannot have both final decisions |
| `COURSE_PUBLISHED` | First successful publication transaction | Committed STUDENT rows captured by the recipient-selection query in that transaction | `course:<courseId>:first-publication` |
| `SUBSCRIPTION_EXPIRED` | Scanner locks and confirms effective expiry at backend time | Subscription-group owner | `expiry:<studentId>:<courseId>:<effectiveExpiryIso>` |

Event keys stay server-side. The public identifier is a notification UUID, not its source key. Per-event/per-recipient uniqueness is enforced in PostgreSQL, not by a Redis lease alone.

Recipient selection is an explicit engineering interpretation of “all students”: capture the set once inside first publication, not at delayed delivery time. Students registering concurrently are ordered by the database selection snapshot. New registrations after that snapshot receive no retrospective broadcast. This avoids selecting additional recipients during retries. Use a set-based audience insert in the transaction, not one network request or application loop per student. Measure transaction cost in Docker before acceptance; a large registered audience may require a different reviewed snapshot mechanism, not silently broader delivery semantics.

No notification to administrators, no recharge-submission alert, no purchase confirmation, no pre-expiry reminder and no archive/unarchive announcement is assigned. Do not add historical notification backfill without owner direction. Migration records already-published courses as having crossed first publication, including archived courses with historical publication evidence, so unarchive does not announce them as new. If historical evidence is insufficient to distinguish a previously published course, report the affected row and block that producer's activation rather than invent its history.

## 4. Content, links and privacy

Use four versioned templates with required Arabic and English title/body fields. Values are formatted on the client using the selected locale; store monetary amounts as integer piastres and dates as ISO UTC. Never use floats for balances.

| Type | English copy | Arabic copy | Target |
| --- | --- | --- | --- |
| Approved | “Recharge approved” / “Your wallet has been credited. You can review the balance.” | “تمت الموافقة على طلب الشحن” / “تمت إضافة الرصيد إلى محفظتك. يمكنك مراجعة الرصيد.” | Own wallet |
| Rejected | “Recharge request rejected” / “Review the decision in your recharge history.” | “تم رفض طلب الشحن” / “راجع القرار في سجل طلبات الشحن.” | Own wallet/history |
| Published | “A new course is available” / “Explore the course and its subscription options.” | “دورة جديدة متاحة” / “تعرّف على الدورة وخيارات الاشتراك.” | Public offer if still public |
| Expired | “Subscription expired” / “Your access period has ended. Review renewal options.” | “انتهى الاشتراك” / “انتهت مدة وصولك إلى الدورة. راجع خيارات التجديد.” | Current public offer or dashboard |

Generic publication/expiry text avoids persisting protected course/lesson snapshots. Optionally include safe structured variables only after the allowlist is reviewed: own amountPiastres and effective expiry. Do not copy rejection free text, sender details or transfer references into realtime or list payloads; the already-authorized recharge detail API remains their authority.

Server returns a structured target such as `{kind:"WALLET"}` or `{kind:"COURSE_OFFER",slug:"example-course"}`, never an arbitrary URL. Encode a validated slug when generating `#/courses/:slug`. Reevaluate availability when serializing: archive, pending deletion or permanent deletion yields `target:null` with an unavailable label. Retained expiry history remains true after later renewal; show the recorded expiry time and read current subscription state at the destination. Do not present an old notice as the authority for current entitlement.

Forbid proof bytes/names, emails, phone numbers, sender identifiers, reviewer identity, lesson lists, asset/session IDs, privileged credentials, JWTs, playback tokens, signing material, watermarks, signed URLs and raw external responses in these payloads/logs. User IDs in internal routing never reach the browser notification envelope.

## 5. Proposed persistence sketch

This is a non-executable sketch. No Prisma schema or migration has been changed.

| Record | Fields and constraints | Purpose |
| --- | --- | --- |
| `NotificationEvent` | UUID; unique eventKey; enum type; schemaVersion=1; source reference; occurredAt; recordedAt; expiresAt; fanout cursor/status; attempt/lease/error fields | Transactional outbox intent; excludes sensitive source content |
| `NotificationAudience` | eventId, recipientId, unique pair; stable recipient ordering; pending/materialized status | Frozen recipient set; recipient FK to platform User only |
| `Notification` | UUID; eventId; recipientId; recipientSequence; createdAt; occurredAt; expiresAt; readAt nullable; signal retry fields; type/version/course reference resolved through its retained event | Durable inbox with unique event/recipient and unique recipient/sequence; avoids duplicated event fields |
| `NotificationInboxState` | userId unique; lastSequence and revision as BigInt; updatedAt | Serializes inbox mutations; next allocation is lastSequence+1; provides monotonic read-all/reconnect fences |
| Source deduplication markers | Immutable first-publication marker; recharge intent-recorded marker; student/course last expiry recorded | Prevents source re-emission after outbox/inbox retention cleanup |

Index inbox by `(recipientId, recipientSequence DESC)`, `(recipientId, readAt, expiresAt)` and `expiresAt`; index due outbox work by `(status,nextAttemptAt,id)`, audience by `(eventId,recipientId)`, and expiry tracking by due effective expiry/group. Review actual PostgreSQL query plans before performance claims.

Package-02 representation (2026-10-01): the unique recipient/sequence index supports reverse scans; NotificationAudience uses nullable materializedAt; event status is named deliveryStatus. Recharge references use deterministic opaque event keys and source markers, not free-text metadata. The additive migration and recipient-only HTTP APIs are Docker-verified in [the package-02 report](m6-02-backend-report.md). Package 04 implements producers, physical cleanup, source markers and realtime in [the delivery report](m6-04-delivery-report.md).

Course and request references in notices are opaque IDs, with no cascading foreign key into removable catalog/source records. User references cascade on user deletion if a separately approved deletion flow ever exists; this does not introduce such a flow. A source marker has the lifetime of its existing source/entitlement metadata. It is minimal delivery evidence, not a second permanent copy of notice text. Purge expired audience, safe payloads and inbox rows; do not introduce indefinite retention of message content. Review marker minimization together with future approved source-data deletion policies.

`createdAt` is the event's recordedAt for all recipients; `expiresAt = createdAt + 180 * 86400 seconds`. Fanout retries do not extend it. `occurredAt` distinguishes the actual expiry boundary from when the scanner recorded it. Always hide rows at `expiresAt <= backendNow`, even if physical cleanup is delayed. Never materialize or signal an already expired event.

## 6. Transaction and failure protocol

Recharge review: preserve its existing transaction and compare-and-set; append event, single-recipient audience and source marker after the decision/credit assertions within that transaction. An insert failure rolls back the complete transaction. No pre-commit signal, broker call or provider request. The current duplicate-review 409 behavior remains intact. Delivery retry only consumes committed intent.

First publication: under the existing course UPDATE lock, validate, set the immutable marker, insert event and audience using the query's committed STUDENT snapshot, then commit. Unarchive/readiness retries see the marker and do not produce another broadcast. Do not infer first publication from current status or mutable publishedAt alone.

Expiry: scan subscription groups in bounded stable pages, using the same latest-expiry rule as entitlement. For a candidate whose boundary may have passed, acquire course SHARE then the existing wallet UPDATE lock, reread MAX(expiresAt) for that user/course and sample backend time after the locks. If still expired and the matching boundary was not recorded, insert intent/audience/marker atomically. The wallet already exists for purchased subscriptions. No money changes occur. If the course has been removed, use an explicit course-independent path that still takes the wallet lock and preserves renewal serialization; its target is unavailable. Check lock order against catalog deletion and purchase in Docker.

The source marker tracks the last recorded boundary; a later renewal advances effective expiry, not the historical notice. Scanning cannot depend on a playback reference. Work that was discovered before acquiring locks must always reread after acquiring them.

| Timeline | Correct outcome |
| --- | --- |
| Old expiry T; early renewal committed before T, extending to T2 | No notice at T; one at T2 if no further renewal |
| Expiry scanner commits notice at T; student buys later at T+10m | One historical notice at T; no second for T; future T2 may notify |
| Renewal owns wallet lock first | Scanner waits, sees extended expiry, emits nothing for T |
| Scanner owns wallet lock first at T | It records the valid lapse; renewal waits then extends from purchase time under existing D04 |
| Scanner discovered old boundary, then renewal committed before it got the lock | Reread suppresses stale notice |
| Old purchase expired but a newer early-renewal row remains active | Maximum expiry remains future; no notice |

Dispatcher runs inside existing backend replicas. Claim bounded due work with a tokened PostgreSQL lease/compare-and-set; commit the claim before network activity. Commit each recipient's notice, inbox state and audience progress atomically; discover remaining audience independently of the event cursor. Insert uniqueness plus source markers prevents duplication; don't catch a PostgreSQL constraint error and continue in an aborted transaction—use upsert/ON CONFLICT deliberately.

For each recipient, lock InboxState, allocate a strictly increasing sequence/revision and insert the notification atomically. Reprocessing an existing event/recipient must not allocate a second notice or sequence. Redis publishes only after these commits. A crash after insert but before publication leaves signal work due; a crash after publication but before completion can repeat an update signal, which is harmless. Never mark a recipient as having read/received the notice merely because an emit call returned.

Implemented tuning defaults: 100 recipients per fanout batch; 1-second work ticks; 30-second renewable claim lease; bounded deterministic exponential retry from 1 second up to 5 minutes. After 10 consecutive attempt failures, expose a FAILED category, then retry at the capped interval until success or notification expiry; no public retry/admin composer endpoint. Database state retains pending work across crashes. No unbounded in-memory backlog. Shutdown stops claims, lets owned work finish within a deadline, and leaves interrupted claims reclaimable. Logs record safe counts/categories/attempts, not payloads.

Package-04 implementation refinement: each recipient's notice, inbox revision and audience materializedAt commit in one short transaction. Recovery selects the remaining materializedAt-null audience, so fanoutCursor is a progress hint rather than a correctness gate; a crash between recipient commits and the event-status update safely repeats discovery. Owner-level revision/deliveredRevision in InboxState coalesces all durable signals, including read changes and cleanup; the earlier per-notice signal fields are not the delivery authority. PostgreSQL tokened 30-second leases serialize event and signal claims. Actual retries use capped deterministic exponential delay without jitter; fanout errors become FAILED after ten consecutive failures but remain retryable. The worker ticks once per second, processes up to 100 recipients for one event and 20 owner signals, scans up to 100 due expiry groups every five ticks, and cleans bounded retained data every sixty ticks. These limits are engineering tuning, not measured latency/capacity guarantees.

## 7. Recipient-only HTTP contract

Public paths below include Nginx's `/api` prefix; Express internal paths omit that prefix. Reuse standard `{data:...}` / `{error:{code,message,details?}}` envelopes and `Cache-Control: no-store`. Authenticate using existing cookie and durable session guards on every operation. Either existing role may access its own inbox; current event producers target STUDENT only. ADMIN never gains private student-inbox access.

| Method/path | Request | Response/behavior |
| --- | --- | --- |
| GET `/api/notifications` | `limit` 1–50 (default 20); `unreadOnly` boolean; optional bounded cursor | Items newest recipientSequence first; nextCursor; current unreadCount, revision and throughSequence |
| GET `/api/notifications/unread-count` | No recipient input | Own nonexpired unread count, revision, throughSequence |
| PUT `/api/notifications/:id/read-state` | Exactly `{read:boolean}` | Own nonexpired updated item and count/revision; repeating same state is a no-op |
| POST `/api/notifications/read-all` | Exactly `{throughSequence:"<decimal BigInt>"}` from inbox response | Mark own nonexpired unread rows up to the observed sequence; return changedCount, count/revision |

All writes require exact allowed Origin and session CSRF. Validate UUID, booleans, unknown fields, decimal boundaries, query multiplicity and cursor length. A cursor carries only a validated sequence bound, never credentials or recipient authority; every query independently constrains authenticated userId. Use JavaScript-safe decimal strings for BigInts. Reject throughSequence above that recipient's current maximum instead of marking future arrivals accidentally.

Each response obtains items/count/revision/fence from a coherent transaction snapshot. Pagination is creation-order stable; later read-state changes remain current rather than promising frozen historical unread filtering. Read-all serializes with materialization/cleanup on InboxState: notices inserted afterward have larger sequence and remain unread, even when their source event occurred earlier. Reads/counts exclude expired rows. Missing, expired and another user's item produce the same 404. Auth/Origin/CSRF failure uses existing 401/403; invalid input 400; dependency outage fails closed 503; no caller-selected recipient, create, delete/dismiss or global inbox endpoint exists.

Example safe item (fictional IDs):

```json
{
  "id": "a927d7f2-8621-4f64-a160-f936b5caaf35",
  "type": "RECHARGE_APPROVED",
  "schemaVersion": 1,
  "sequence": "41",
  "titleAr": "تمت الموافقة على طلب الشحن",
  "titleEn": "Recharge approved",
  "bodyAr": "تمت إضافة الرصيد إلى محفظتك. يمكنك مراجعة الرصيد.",
  "bodyEn": "Your wallet has been credited. You can review the balance.",
  "createdAt": "2026-10-01T08:00:00.000Z",
  "occurredAt": "2026-10-01T08:00:00.000Z",
  "expiresAt": "2027-03-30T08:00:00.000Z",
  "readAt": null,
  "target": {"kind": "WALLET"}
}
```

## 8. Realtime and ongoing authorization

Use Socket.IO 4.x with the compatible Redis adapter and existing ioredis connection infrastructure, with versions pinned only in the Docker implementation package after compatibility review. Attach to the existing HTTP server; do not launch another backend application. Engine path is `/api/notifications/socket.io/` externally, mapped deliberately to `/notifications/socket.io/` internally; namespace `/notifications`. Both endpoints allow WebSocket transport only. That retains normal round-robin routing without requiring polling affinity; restrictive networks may fail to connect, so the inbox remains available with a disconnected state. [Socket.IO multiple-node documentation](https://socket.io/docs/v4/using-multiple-nodes/) explains this transport tradeoff.

Use fresh Redis publisher/subscriber connections against existing platform Redis; never put a normal command client into subscriber-only mode. Give this module a unique channel prefix. Do not enable Redis Streams, sharded topology or a separate broker. The ordinary Redis adapter uses transient Pub/Sub and does not support built-in connection-state recovery. Its disconnected-server behavior cannot be treated as durable delivery. [Redis adapter documentation](https://socket.io/docs/v4/redis-adapter/).

Handshake validates exact Origin, access cookie, expected issuer/audience/algorithm/lifetime, durable active session, user ownership/role and Redis revocation. Do not send tokens through query strings, Socket.IO auth payloads, browser storage or local credential caches. The browser supplies protected cookies automatically under the `/api` path. Do not offer caller-defined join-room, recipient selection or socket write operations.

Connection middleware alone is insufficient: it runs once per connection. [Socket.IO middleware documentation](https://socket.io/docs/v4/middlewares/). Record only verified server-side session identity and original access-token expiry. Disconnect at that expiry; reconnect after the existing HTTP client refreshes the cookie. A connected socket cannot silently acquire a refreshed browser cookie. Recheck durable session and Redis state before each client-directed signal and during a proposed 5-second heartbeat authorization check. On check errors pause delivery/disconnect; logout UI closes its socket and other replicas still consult durable revocation. Test the measurable revocation interval, and don't promise instantaneous removal of already queued bytes.

A shared room emit must not bypass those checks. Use Redis-adapter inter-server invalidation to notify each replica of affected user/revision; each replica looks up only its locally attached sockets, revalidates them and sends a minimal signal. Internal user/session IDs are never included in browser messages. There is no client `join` event. Verify inter-server behavior with the pinned adapter in Docker.

Server signal: `notifications:changed` with exactly `{schemaVersion:1, revision:"42"}`. It carries no notice details, identifiers, count or user data. UI coalesces signals and refetches authenticated count/current inbox. The library's default delivery is not durable, so signal success is not recipient receipt; durable inbox resync is mandatory. [Socket.IO delivery guarantees](https://socket.io/docs/v4/delivery-guarantees/).

Package 04 pins Socket.IO server/client 4.8.3 and Redis adapter 8.3.0. Handshake auth contains only the readable session CSRF synchronizer; protected authentication cookies stay implicit. No bearer/session token is sent in auth or query parameters. Setup awaits the adapter's initial Redis subscriptions. Delivery uses inter-server invalidation with an awaited actual Redis PUBLISH; it does not interpret an adapter/client acknowledgement as durable recipient receipt. Adapter publication/subscription promise failures are captured to avoid detached rejection paths. The sender retains retryable PostgreSQL work on publication failure; each recipient replica rechecks session and token expiry before emitting locally. The realtime module uses its own publisher/subscriber connections and never switches the identity command client into subscription mode.

On successful handshake, send a current revision signal after authorization so mutations missed between initial HTTP loading and connection are reconciled. Reconnect always fetches current inbox/count even if revisions match; gaps do not need replaying every socket packet. On Redis recovery, force a revision refresh to active local sockets. A proposed 30-second online synchronization plus window-focus refresh handles an undetected missed signal; this is a recovery check, not the primary approved realtime channel. Stop it and erase inbox memory on logout/account change. No private inbox persistence in localStorage, sessionStorage or IndexedDB.

The Nginx route forwards Upgrade/Connection and ordinary cookie/Origin/forwarded headers, strips `/api` exactly once and keeps other API timeout behavior. Socket `proxy_read_timeout` 75s exceeds the pinned 25s pingInterval plus 20s pingTimeout. [Socket.IO reverse-proxy guidance](https://socket.io/docs/v4/reverse-proxy/). No new public port, sticky-session cookie, client-side host list or platform microservice. [Package 05](m6-05-acceptance-report.md) verifies HTTP requests on a different deployed replica from the connected socket, round-robin private reads and convergence after killing/restarting the socket owner; its test-only routing instrumentation is recorded separately from production configuration.

## 9. Frontend behavior

Authenticated STUDENT and ADMIN headers gain an accessible entry to their own inbox/unread badge and a dedicated `#/notifications` route using existing semantic FAYQ components. This follows package 02's role-neutral own-inbox API; approved producers still target only students. Reading a notice's link alone does not implicitly change read state; provide an explicit read/unread control and mark-all-read. No dismissal/trash control. Badge counts represent retained unread notices; show a localized capped visual label with the actual count in its accessible description.

Default Arabic/RTL, English/LTR, dark and light, keyboard focus and 44px mobile targets follow `design.md`. Keep date/reference fragments directionally isolated. Present loading, empty, failure/retry, reconnecting and target-unavailable states with text and icons rather than color alone. Use a polite status announcement for updates and avoid announcing every reconnect or flooding screen readers with a publication fanout. No toast stacking is required. Preserve scroll/pagination when refreshing and apply revisions rather than appending duplicated signals.

On read mutation failure restore the displayed state and refetch; do not silently keep a failed optimistic unread count. On 401 use the existing coordinated cookie-refresh path once, reconnect with current cookies after success, and clear notification state on final auth failure. Realtime failure leaves the authenticated inbox usable and exposes connection status; do not manufacture notifications or money-success messages.

## 10. Retention and replay

An inbox row is visible strictly before its createdAt+180-day boundary. Cleanup in bounded batches serializes recipient deletion/count revision changes on InboxState and may trigger the same safe update signal. Repeated concurrent cleanup is idempotent. Cleanup failure affects physical deletion latency, not the API's retention cutoff. Verify exact boundary with injected time in Docker.

After completion/expiry remove expired event audience/payload and delivery work without resetting source deduplication markers. Recharge-review immutability and its recorded marker prevent regenerating old decisions. An immutable first-publication marker prevents regenerated broadcasts. The recorded effective-expiry marker prevents recreating the same boundary; a later expiry after an explicit renewal can legitimately create a new notice. Scans never synthesize historical events solely because an inbox row disappeared. This is delivery metadata; do not copy message text into permanently retained audit records.

No change to financial audit retention, 180-day proof deletion, subscription snapshots, external media deletion or DRM revocation is involved. Do not run cleanup on existing development volumes during acceptance; use the guarded disposable database only.

## 11. Migration, activation and rollback

The original preparation gate required Docker and M5 acceptance before package 02. The owner's subsequent direct-work instruction, repeated after Docker restoration, authorizes independent bounded M6 work as recorded in the manager plan; formal M5 acceptance remains unconfirmed. Package 02 added inbox/state/outbox/audience structures and APIs and verified the populated seven-to-eight migration upgrade. Package 03 added the private bilingual HTTP inbox. Package 04 added source markers/producers and verified the populated eight-to-nine upgrade. Notices now follow committed source operations; there is no public event-creation endpoint or historical notification backfill.

Producer activation needs an explicit rollout fence and baseline source markers so pre-feature decisions/publications/expiries are not accidentally replayed. No historic backfill is approved. Inspect source evidence rather than resetting publishedAt or modifying financial outcomes. If the owner wants a backlog of notices from earlier history, that is a separate business assignment.

Package-04 migration `20261001110000_m6_delivery` adds the singleton rollout timestamp, baselines previously reviewed recharges and known publication evidence, and rejects ambiguous archived publication history. Expiry boundaries at or before rollout are excluded; later effective boundaries are recorded under the purchase course/wallet lock order, even without playback. Cleanup removes expired notice/event/audience content while retaining the minimal source and revision markers. It does not modify financial or playback expiry behavior.

Use additive migrations, indexes and server-only configuration; no frontend secret settings. Production delivery remains outside this assignment. Proposed internal flags can disable producers/transport while preserving APIs/data, if required for staged Docker validation. Do not add production deployment files or expose data-service ports. Reverting a runtime package stops its producers/transport and deploys the reviewed previous application image; retain additive data/schema until a separately reviewed rollback, never delete wallet/subscription records or downgrade a shared database blindly.

## 12. Acceptance scenarios and traceability

| ID | Scenario and required observation | Package / requirement |
| --- | --- | --- |
| N01 | Anonymous denied; student B cannot list/count/read/subscribe to A; ADMIN cannot select another inbox; foreign/absent Origin and wrong CSRF denied on writes | 02/04, R02/R13 |
| N02 | Six concurrent approvals: one credit, one decision intent/notice; losers preserve current 409; rejection has no credit; approval never purchases | 04, R04/R05/D21 |
| N03 | Force rollback after event insert: neither credit/decision nor intent survives; force Redis failure after commit: credit/intent survive and notice delivery recovers without repeating credit | 04, R04/R05/R09 |
| N04 | First publication validates bilingual/readiness; exact frozen STUDENT audience; retry/unarchive emits no second event; interrupted fanout resumes without omissions/duplicates | 04, R01/D16/D25 |
| N05 | Early renewal and both wallet-lock race orders; effective max expiry; no playback references; multiple purchases; once per boundary and next boundary after renewal | 04, R03/R14/D04/D14 |
| N06 | List/mark-all fence: concurrent new notice remains unread; mark-read/unread retries converge; owned expired and foreign IDs are indistinguishable; cursor cannot escape ownership | 02/03, R13/D25 |
| N07 | Disconnect during emit, reconnect to other replica, kill dispatcher at each commit boundary: durable inbox correct; duplicate signals do not duplicate rows/count | 04/05, R09/R10/D25 |
| N08 | Revoke/logout/access-expire an active socket; no later private update bypasses ongoing checks; Redis/DB failure pauses delivery; refresh/reconnect restores valid access | 04/05, R13 |
| N09 | Connect socket on replica A, commit on B, read on either; no polling-affinity assumptions; Redis outage/recovery and a restarted replica still converge | 04/05, R09/D12 |
| N10 | Exact 180-day cutoff, delayed/concurrent cleanup and post-cleanup scanner retry: no old notice resurrection; ledger/audit/proof policy unchanged | 04/05, D25/D21 |
| N11 | Arabic/English, RTL/LTR, both themes, mobile/keyboard/reader states; no private storage or credential/lesson/proof leak; archived/deleted targets safe | 03/05, R01/R08/R13 |

These rows define acceptance specifications. Package 01 passed source-reference, policy-consistency, privacy-envelope, failure-timeline, link and diff review. Docker was initially unavailable; the owner has since restored it. Executed package-02 API/storage, package-03 inbox and package-04 producer/realtime/cleanup checks are recorded in [the backend report](m6-02-backend-report.md), [the inbox report](m6-03-inbox-report.md) and [the delivery report](m6-04-delivery-report.md). [Package 05](m6-05-acceptance-report.md) adds 65 real-container replica/recovery/crash/retention assertions. The owner subsequently approved [the separate-reviewer assignment](m6-final-review-prompt.md); [its completed report](m6-independent-review-report.md) records ACCEPTABLE FOR OWNER REVIEW after independent source inspection and fresh critical Docker reproduction. Earlier same-agent reports keep their original evidence labels. [Owner M6 acceptance is recorded](m6-owner-acceptance.md); the next bounded work is [M7 readiness preparation](../m7/m7-01-open-code-worker-prompt.md). Formal M5 acceptance remains unconfirmed and is not inferred from the direct-work assignment.
