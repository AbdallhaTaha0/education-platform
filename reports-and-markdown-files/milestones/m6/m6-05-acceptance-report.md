# M6 package 05 — replica and recovery verification

Subsequent status: [the owner-authorized independent review](m6-independent-review-report.md) is complete, with verdict ACCEPTABLE FOR OWNER REVIEW. [Owner M6 acceptance is now recorded](m6-owner-acceptance.md). The package-05 report below preserves its original same-agent evidence and status at completion.

Date: 2026-10-01, Africa/Cairo. Authority: owner D25/R17 and "next" after package 04. **Bounded Docker functional verification passes: 65/65 assertions, zero failures/skips. Independent review and owner milestone acceptance remain open.** This is the implementing agent's source review and reproduction, not an independent reviewer verdict. No other agent/chat was dispatched. [The independent review packet](m6-final-review-prompt.md) is prepared for that remaining gate.

Platform HEAD remains `4b949cc394636c2df928d0b7642122da61e5301c`; nested DRM and matching gitlink remain `bad0c1df9f5d5844fe365c402fcccfee33ab6906`, clean and unchanged. Existing uncommitted M6 work is preserved. This package changes verification artifacts/documentation only; no application source, schema, dependency, business policy or production configuration was changed. Nothing was committed, pushed or deployed to production. Formal M5 owner acceptance remains unconfirmed.

## Actual result

Two separately deployed containers run the same Express application/runtime image, sharing isolated platform PostgreSQL/Redis behind private Nginx. Browser evidence identifies which upstream handled the socket handshake and source HTTP request. An approval/publication committed on B reaches the student's socket on A. Ordinary inbox reads reach both peers without affinity. Killing A reconnects the open browser to B with the same durable inbox; restarting A restores its matching HTTP view.

A real PostgreSQL stop/start disconnects ongoing private realtime authority and returns sanitized HTTP 503 with no-store. Both backend processes remain running across recovery; the browser regains its unchanged inbox. Five deterministic dispatcher crashes recover committed source, recipient and signal work without duplicate notices or changes to wallet, ledger, subscriptions, review records or source audits. Concurrent physical retention cleanup preserves financial/proof metadata and source markers, with no recharge/expiry replay.

## Added artifacts and scope

| Artifact | Purpose |
| --- | --- |
| `docker/verification/compose.m6-acceptance.yml` | Extend the package-04 isolated runtime stack with a second identical backend, read-only verification entrypoint and ignored evidence mount |
| `docker/verification/nginx.m6-acceptance.conf` | Test-only two-peer routing, optional peer-selection header and upstream response provenance; default round robin |
| `docker/verification/compose.m6-acceptance-listener.yml` | Controlled signal test: real app/HTTP/realtime on both peers, with schedulers deliberately absent while an isolated dispatcher owns the checkpoint |
| `docker/verification/m6-acceptance-probe.cjs` | Call compiled actual source/dispatcher/cleanup functions, freeze immediately after chosen commits, inspect durable progress and compare exact financial snapshots |
| `docker/browser/m6-acceptance.mjs` | Normal-cookie Chromium journey, cross-peer delivery, backend kill, database outage and publication-before-ack evidence |
| `docker/verification/m6-acceptance-project.mjs` | Host Docker orchestration with project/image/volume guards, checkpoint coordination, exact owned cleanup and private receipt removal |
| [Independent review packet](m6-final-review-prompt.md) | Concrete scope, source hotspots, reproduction commands and verdict/evidence requirements; prepared, not dispatched |

All application execution and Chromium ran inside Docker. Host Node only inspected configuration, started/stopped inspected containers and coordinated files. Project is `m6-acceptance`; its named PostgreSQL volume is `m6-acceptance_pgdata`. It publishes no host ports and uses no development volume, external DRM configuration, application environment file or Docker socket browser mount.

The test Nginx file derives from the actual platform routes, adding two backend addresses, internal listen port 8082, controlled peer selection/provenance and an explicit equivalent /api rewrite for variable upstream selection. Cookie, Origin, WebSocket upgrade and timeout behavior remain the actual route contract. These instrumentation differences are deliberately confined to the verification config; it is not a production deployment artifact or a claim of configuration parity beyond the stated changes. Chromium resolves localhost:8082 to private Nginx inside the isolated network.

## Image and source evidence

No application changes required rebuilding package-04 images. Orchestration explicitly rejected different identities, existing acceptance containers/volumes and any published ports. Both regular backend containers used separate IDs with the same verified runtime identity.

| Image | Observed identity |
| --- | --- |
| Server runtime `edu-platform-server:0.5.0-m5-rs256verify` | `sha256:3554daf9abf72aa4f65b6e4dbb293c903869c720f0334cfb8925e62be7635f9b` |
| Client runtime `edu-platform-client:0.5.0-m5-rs256verify` | `sha256:43d53c90c980aebe9df7c1ee39a9891c42ab57ab2d93749cca78724377ec0f07` |
| Browser `edu-platform-browser:0.6.0-m6-inbox` | `sha256:288ee8af0c68ff75231558c901e982c40979925cddcdf1e4975bd56a380656f6` |

The runtime source is the final package-04 source already built and tested in Docker. No broader unrelated server/DRM suites were repeated. The package-04 report's distinction between its earlier 251-test full matrix and final affected-source reruns remains explicit; this package supplies missing real-container topology/restart evidence rather than retroactively relabelling earlier runs.

## Executed assertions

| Gate | Assertions | Observation |
| --- | ---: | --- |
| Two-replica Chromium journey | 15/15 | Socket A/source B; private approval; duplicate review 409 on A; publication on B; frozen student audience/admin exclusion; foreign ID 404 on B; explicit purchase; round-robin reads; kill/reconnect/restart; minimal signals and private storage |
| PostgreSQL outage Chromium | 6/6 | Initial peer confirmed; authority disconnect; sanitized unavailable private API; exact inbox recovery without backend restart; minimal signals/storage |
| Publication-before-ack Chromium | 5/5 | Separate listener A receives the controlled sender's actual Redis publication; one new notice; minimal signals/storage |
| Durable checkpoint inspection | 14/14 | Exact committed notice/audience state at five real commit boundaries; processing event/signal lease retained where expected |
| Recovery after five killed dispatchers | 20/20 | Four checks per boundary: completion/revision catch-up, exactly one notice per recipient, no audience omission, exact financial/review/audit snapshot unchanged |
| Concurrent retention | 5/5 | Exact cutoff cleanup; financial/proof/audit/subscription preservation; publication/expiry markers survive; immutable recharge retry and expiry replay suppression |
| **Functional total** | **65/65** | **Zero failures/skips, orchestration exit 0** |

The successful runner also records 41 orchestration/resource/evidence guards, separately from the 65 behavioral assertions. Cleanup records two additional successful volume guards and private-receipt removal. Nginx syntax validation passed. After cleanup the guarded existing preview and all five services remain healthy on localhost:8082 with their original named data volumes; its server remains at the final package-04 image with RestartCount 0.

Final repository checks passed: tracked diff whitespace, strict UTF-8/untracked whitespace, 85 local documentation links, aggregate 65/65 recorded behavioral assertions and absence of private test receipts. The final Arabic screenshot was inspected. Nested DRM remains clean at the unchanged checkpoint.

## Crash boundaries and evidence limits

| Boundary | Saved state before kill | Recovery |
| --- | --- | --- |
| Source commit | Actual approval/credit/review/audit/intent committed; no notice | Regular restarted workers materialize and signal once; no source replay |
| Dispatcher claim | PROCESSING event and real 30-second lease committed; zero audience materialized | Workers wait for the untouched lease to expire, then reclaim |
| First recipient | One notice/inbox revision/audience progress committed; second recipient pending | Remaining frozen recipient finishes; prior notice stays unique |
| Full fanout | Both recipient commits complete; event completion/cursor update not committed | Repeated discovery finds no pending audience and completes the event |
| Redis publication | Actual publication reached listener/browser; deliveredRevision update not committed; signal lease still owned | After natural lease expiry, revision publication may repeat; durable rows/count and source finances stay unchanged |

Checkpoint instrumentation wraps the actual Prisma transaction return or dispatcher finalization/publisher callback in a separate runtime-image container. It pauses after completed durable work and is killed with SIGKILL. Recovery uses regular `dist/index.js` workers in the two backend containers. Leases are not shortened, deleted or time-travelled for recovery.

The controlled signal step runs the same app and realtime through a verification entrypoint with no competing schedulers. This lets a real socket remain connected while the controlled sender is killed after publishing. It is distinguished from the earlier kill of an ordinary full backend, and from a claim that production includes checkpoint controls. No failpoint or bypass was added to application source/images.

The two normal students register/login through real cookie/Origin/CSRF flows. The internal ADMIN, pending recharge and READY media mapping are labelled isolated fixtures. Source approval/publication/purchase in the replica journey use supported APIs. Later crash probes call the actual internal source operations with owned fixture IDs, never synthetic notification insertion. A successful test approval is not proof of an actual bank transfer, and fixture media readiness is not external processing or playback proof.

Retention calls the actual cleanup function with a test-only clock equal to the latest owned notice expiry, without changing global/container time. A real owned subscription expiry is recorded without playback, then its surviving marker rejects replay after cleanup. This tests retention mechanics and source deduplication; it is not a 180-day wall-clock endurance run or a new financial/proof retention policy.

## Source review and traceability

Same-agent final inspection covered cookie/session/socket authorization, explicit API projections, recipient/sequence ownership and read-all fencing, source transaction hooks, first-publication locking/baselines, renewal/expiry ordering, lease/token/revision recovery, cleanup locking and client stale-response/disposal/reconnect handling. No new evidenced application defect was found in this package. The independent reviewer must still inspect these directly; the prepared packet lists the files and missing verdict explicitly.

N01/N02/N04/N09 are exercised across real peers in the replica journey; N03/N07 use actual persisted boundaries and SIGKILL; N08 adds database outage to package-04 Redis/revocation/expiry checks; N10 adds concurrent cleanup/source replay checks. N05/N06 and the broader N11 language/theme/mobile/keyboard matrix retain their specific Docker evidence in packages 02–04; this package adds private storage/minimal envelope checks and an inspected Arabic screenshot. It does not claim all those earlier matrices were rerun.

## Corrections and cleanup

Two initial harness attempts failed and were cleaned: the new browser script was mounted outside the image's module-resolution directory; a storage assertion listed invented preference key names instead of the application's existing `edu-platform-lang`/`edu-platform-theme`. The first stopped before browser assertions; the second passed 14 replica checks then failed that assertion. The harness was corrected from the image/source, without changing application storage or dependencies. Both are historical evidence, not passing final gates.

Final sanitized JSON and the inspected Arabic screenshot are in ignored `docker/browser/evidence/m6-05/2026-10-01-m6-05-1790820985727/`. The final run passed every behavioral assertion. Its copied credential receipt, financial/source/checkpoint receipts and final private data snapshot were removed. Run-owned fixture cleanup removed three users and three courses and their owned source events/audits; the logged zero event-prefix count is the synthetic-prefix category, not proof that no real source events existed. Exact-project cleanup removed both backend peers, helpers/browser jobs, Nginx/client/migration, PostgreSQL/Redis, the inspected named/anonymous test volumes and network. No global pruning or development data removal occurred. No secret/private evidence enters Git.

Commands executed include `rs256-project.mjs check`, immutable image inspections, `node docker/verification/m6-acceptance-project.mjs`, its resolved Compose checks, private test stack `up --wait`, Docker-only fixture/probe/Chromium calls, Nginx test/reloads, inspected backend/dispatcher SIGKILL, inspected PostgreSQL stop/start, owned fixture cleanup and exact `down -v`. The runner is the reproducible detailed command record; each probe/browser writes sanitized pass/fail assertions.

## Remaining acceptance and rollback

Packages 01–05 now have bounded direct implementation/functional verification evidence. Independent final review is prepared but unperformed; owner milestone acceptance is also unrecorded. [Agent responsibilities](../../agent.md) says "the worker's self-report alone cannot close a milestone"; this same-agent report does not close it. No new business decision is required by these tests. Formal M5 acceptance and the existing production DRM/hosting/TLS/secrets/monitoring/backup/recovery/dependency/capacity gates remain distinct.

Verification rollback removes only the owned disposable project. Application rollback remains the package-04 guidance: use a reviewed prior immutable runtime/client, stop new producers/transport, retain additive schema/intent/inbox/source markers pending a separately reviewed database rollback, and never reset financial/subscription state or blindly downgrade a shared database. Commit/push awaits recorded milestone acceptance.
