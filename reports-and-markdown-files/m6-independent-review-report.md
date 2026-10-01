# M6 independent review report

Subsequent owner disposition: [M6 is accepted](m6-owner-acceptance.md), with explicit commit/push authority. The independent review below preserves its original verdict, evidence and limitations at review completion.

Date: 2026-10-01, Africa/Cairo. Reviewer: a separate reviewing agent that did not implement M6, dispatched after the owner's explicit approval. Authority: root AGENTS.md, agent responsibilities, D25/R17, the notification contract and the final review packet. This report records actual source inspection and fresh Docker reproduction; earlier implementation reports were treated as claims to check.

## Findings and disposition

**No unresolved acceptance-blocking application finding was observed.** No remaining suspected defect or new business-policy question requires resolution for this bounded notification review.

One **P3 operational diagnostic limitation** was observed in `server/prisma/migrations/20261001110000_m6_delivery/migration.sql:14–18`. An ARCHIVED course with unknown publication history correctly prevents activation. Direct execution exposes the intended exception, but Prisma deploy reports `current transaction is aborted` and hides the useful cause. Fresh reproduction confirms nonzero deployment exit, rollback of NotificationRollout and firstPublicationAt schema changes, and preservation of the archived source. There is no observed activation bypass or partial-data migration.

The manager addressed the diagnostic concern with the read-only pre-migration candidate query in `docker-and-operations.md:26`. I independently ran the exact documented SQL against six variants: unknown history, known prior PUBLISHED state, publishedAt evidence, COURSE_PUBLISHED audit evidence, COURSE_UNARCHIVED-to-PUBLISHED evidence, and an unrelated READY-unarchive audit. It returns exactly the unknown and unrelated-audit courses. This is an adequate troubleshooting path for this scope. Preserve already applied migration SQL/checksums; do not automatically infer or repair publication history, bypass the guard, or mark a failed migration applied. Production activation still requires inspection of the actual target database and owner resolution of any genuinely ambiguous history.

**Verdict: ACCEPTABLE FOR OWNER REVIEW**, for the locally verified M6 notification scope. This is independent functional review, not owner acceptance, production approval, capacity qualification or formal M5 acceptance.

## Reviewed checkout and boundaries

Platform HEAD remained `4b949cc394636c2df928d0b7642122da61e5301c`. The nested DRM repository and matching gitlink remained `bad0c1df9f5d5844fe365c402fcccfee33ab6906`; its working tree stayed clean. M6 is uncommitted working-tree code. I inventoried `git status --short`, actual tracked diffs and `git ls-files --others --exclude-standard`; new modules and tests were inspected explicitly, rather than omitted by relying on `git diff`.

Inspection covered both additive migrations and Prisma relationships; all eight notification server modules; recharge/publication transaction hooks; actual purchase, entitlement and catalog lock/lifecycle semantics; application mounting/startup/shutdown; actual Nginx routes; client store/context/realtime/API/types/page/header/auth integration; locale/route/title changes; new dependency declarations/locks; focused tests; and verification Compose, routing, fixture, crash, upgrade and browser helpers. Root rules/index/agent/decisions/design, the contract, plan and review packet were read.

I made no application, migration, existing-documentation or DRM edits. Reviewer additions are this report and two bounded reproduction artifacts: `docker/verification/m6-review-authority.test.ts` and `docker/verification/m6-review-ambiguity.mjs`. The manager changed only the acceptance runner's exact image guard after the fresh build and documentation recording dispatch/troubleshooting. The guard update was inspected before execution. No commit, push, production deployment, paid provisioning or external DRM operation occurred.

## Source conclusions

Recharge decision/credit/audit and notification intent commit in the same existing transaction. Failed intent transactions roll back the decision and credit. Dispatch and recovery consume durable intent; they never call approval, credit, purchase or source audit operations to retry delivery. Rejection payloads omit free-text decision details. Approval does not purchase access.

Publication holds the canonical course lock and freezes the STUDENT audience in one INSERT SELECT. An immutable firstPublicationAt marker suppresses retry/unarchive and post-retention rebroadcast. Administrators and later registrations are excluded from that captured audience. Migration baselines known legacy decisions/publications and installs an expiry rollout fence; it does not backfill historical notices.

Expiry uses the effective maximum subscription expiry and an independent subscription scan, so playback references are unnecessary. It acquires course SHARE followed by wallet UPDATE, rereads after those locks, and records intent plus the boundary marker atomically. Both renewal-first and scanner-first orders were reproduced; the scanner-first case uses the actual purchaseCourse operation. A valid historical lapse may precede a later renewal, and the surviving marker prevents its replay.

Per-recipient materialization, sequence/revision allocation and audience progress commit under the inbox lock. Tokened database leases, uniqueness constraints, pending-audience discovery and owner revision/deliveredRevision prevent omissions and duplicates after crashes. Retention hides exact-cutoff rows through authenticated APIs and physically removes notices under owner locks before deleting empty expired events. Source markers remain; financial/proof/audit/subscription data are outside notification cleanup.

HTTP authority comes from protected cookies and durable sessions, with recipient constraints on every query. Writes use existing exact-Origin/session-CSRF guards, strict fields and bounded sequences. Responses explicitly project bilingual generic notice content and safe targets; no proof, lesson, credential, source event key or recipient-routing metadata is returned. Foreign and expired identifiers are indistinguishable from missing ones.

Socket.IO stays on the same Express HTTP server and uses WebSocket-only transport under the cookie's /api path through Nginx. Handshake authority checks exact Origin, cookie access identity, session CSRF and allowed query/auth fields. Ongoing sends/heartbeats check Redis, durable session, role and access expiry. Only schemaVersion/revision reach browser signals. The pinned Redis adapter 8.3.0 implementation was inspected inside the rebuilt Docker runtime: its publish/subscription/teardown calls discard promises. The application wraps the relevant ioredis promises, awaits setup/publication and captures rejection; Redis acceptance is correctly treated as a resynchronization signal, not recipient receipt.

Client inspection and focused tests confirm transient per-owner state, disposed-request guards, BigInt revision ordering, bounded stale retries, pagination-window preservation, mutation recovery and the observed first-page mark-all fence. Existing coordinated cookie refresh is reused, without credential caching. Reconnect/visibility/online recovery refetch durable HTTP state. Arabic/English, RTL/LTR, semantic FAYQ themes, explicit read-state text, 44px controls and focus handling are present. No dismissal or unapproved notification producer was introduced.

## Fresh Docker results

Application builds, tests, typechecks, probes and Chromium ran only inside Docker. Host PowerShell/Node inspected files and orchestrated the resources. Each orchestration shell added the per-user Docker directory to PATH. Resources were inspected before mutation and scoped to disposable projects without published host ports or development-volume mounts.

| Fresh gate | Actual final result |
| --- | --- |
| Focused server integration | notifications 17/17; notification-delivery 18/18 |
| Notification server unit suite | 5/5 |
| Focused client suites | inbox 12/12; realtime 5/5 |
| Reviewer authority/renewal tests | 2/2, containing the missing Origin/cookie/CSRF/role and scanner-first cases |
| Server and client typechecks | Both pass; server includes existing test TypeScript configuration |
| Current checkout runtime/client build | Pass through guarded wrapper; source build/COPY layers cache-validated against current inputs |
| Guarded two-replica/crash/recovery/retention run | 65/65 behavioral assertions; 41 orchestration guards; final exit 0; no failed/skipped final assertions |
| Additional runtime Chromium decisions | 12/12 |
| Additional runtime Chromium expiry without playback | 5/5 |
| Real Redis stop/start Chromium recovery | 5/5; backend StartedAt unchanged |
| Populated migration 8→9 | Pass; six legacy table snapshots unchanged, two publication baselines, one recharge baseline, rollout row and zero historical events |
| Reviewer negative migration/diagnostic drill | Pass; exact documented candidates, intended SQL rejection, nonzero Prisma deploy, atomic schema rollback, preserved source; owned database removed |
| Actual Nginx syntax | Pass in acceptance environment |
| Final ownership/cleanup/preview checks | Pass; disposable resources/receipts absent; all five existing preview services healthy |

These are 40 focused server test cases, 17 focused client test cases and two reviewer test cases, plus the separately counted 65 and 22 runtime behavioral assertions. They are not the historical full server/client/DRM matrices, and no broader unrelated M5/DRM suite was rerun.

The 65 assertions include 15 two-peer browser checks, six PostgreSQL-outage browser checks, five publication-before-ack browser checks, 14 persisted checkpoint checks, 20 recovery checks and five retention checks. The actual five kill boundaries are source commit, dispatcher claim, first recipient commit, complete fanout before final event update, and Redis publication before deliveredRevision update. Regular application workers recover the saved work after SIGKILL and natural leases; leases are not shortened or removed. Every boundary preserves exact wallet/ledger/subscription/review/source-audit snapshots. Concurrent retention removes owned notices at the cutoff and surviving recharge/publication/expiry source evidence prevents regeneration.

Fresh browser checks prove cross-peer approval/publication delivery, recipient privacy, independent purchase, round-robin private reads, backend kill/reconnect, database fail-closed 503 and recovery without backend restart, minimal signals and harmless-only persistent browser preferences. The additional actual Redis stop/start closes sockets, reconnects and restores the same durable inbox without restarting the backend.

Four historical package-03 screenshots and their actual 54-check JSON/helper were inspected: Arabic dark and English light at desktop and 390px mobile. Their broader layout/contrast/focus/fault-interception matrix remains explicitly historical. The fresh package-05 Arabic screenshot and additional runtime screenshots were also inspected. The full 54-case layout matrix was not rerun; current UI source and fresh focused/browser checks supplied the affected behavior review.

## Exact images and source build evidence

The guarded actual-checkout build regenerated BuildKit attestation/index identities while every relevant application COPY/build layer was reported cached. The manager replaced the two literal expectedImages values with the inspected fresh identities, preserving the exact guard. It was not bypassed. Earlier package-04/05 image IDs remain historical. Direct old-index lookup was unavailable after rebuilding tags, so this report does not claim a separate old/new rootfs comparison; the actual checkout rebuild and fresh execution establish the reviewed source gate.

| Image tag | Independently observed image identity |
| --- | --- |
| edu-platform-server:0.5.0-m5-rs256verify | sha256:6eb02c11ffd7b3cb24a7577c747170889d6187e698b220a9c15e8624f6d3be16 |
| edu-platform-client:0.5.0-m5-rs256verify | sha256:f2b015d273f946bb7d6a6893792f39578f688c06ec4a0432cba06813e0d006c1 |
| edu-platform-migrate:0.5.0-m5-rs256verify | sha256:fa89c5579fbd85e8ca98c8011464241c5f60dd0becae063bbf4681c564fa3581 |
| edu-platform-server-test:0.6.0-m6-delivery | sha256:c4b02d05f4eb43c37035f64ddd508f2dbb4580b3a7bcee31a7c4b511571554ca |
| edu-platform-migrate-test:0.6.0-m6-delivery | sha256:e21ad0bc644205f0d51ca0b005a0b764e2d17adcdb3d9bca67e492b6e0fe856f |
| edu-platform-client-test:0.5.0-m5 | sha256:764f3eb64e5449d2086b943df79bd1e74a0b0cf1bafafd23d2274d74fa757336 |
| edu-platform-browser:0.6.0-m6-inbox | sha256:288ee8af0c68ff75231558c901e982c40979925cddcdf1e4975bd56a380656f6 |

Both acceptance peers had separate container IDs and the exact same inspected runtime image. The existing preview was not restarted/recreated or seeded during this review.

## Commands and retained evidence

Executed commands, from the repository root, included:

```powershell
$env:PATH = "$env:LOCALAPPDATA\Programs\DockerDesktop\resources\bin;$env:PATH"
node docker/verification/rs256-project.mjs check
node docker/verification/rs256-project.mjs build
docker compose -p m6-review-independent -f docker/compose.test.yml -f docker/verification/compose.m6-delivery-test.yml config --format json
docker compose -p m6-review-independent -f docker/compose.test.yml -f docker/verification/compose.m6-delivery-test.yml build test migrate client-test
docker compose -p m6-review-independent -f docker/compose.test.yml -f docker/verification/compose.m6-delivery-test.yml up -d --wait migrate redis
docker compose -p m6-review-independent -f docker/compose.test.yml -f docker/verification/compose.m6-delivery-test.yml run --rm test npx vitest run tests/integration/notifications.test.ts tests/integration/notification-delivery.test.ts tests/unit/notifications.test.ts
docker compose -p m6-review-independent -f docker/compose.test.yml -f docker/verification/compose.m6-delivery-test.yml run --rm test npm run typecheck
docker compose -p m6-review-independent -f docker/compose.test.yml run --rm client-test npx vitest run src/features/notifications/inbox.test.ts src/features/notifications/realtime.test.ts
docker compose -p m6-review-independent -f docker/compose.test.yml run --rm client-test npm run typecheck
docker compose -p m6-review-independent -f docker/compose.test.yml -f docker/verification/compose.m6-delivery-test.yml run --rm --no-deps -v "${PWD}/docker/verification/m6-delivery-upgrade.mjs:/srv/server/m6-delivery-upgrade.mjs:ro" test node /srv/server/m6-delivery-upgrade.mjs
docker compose -p m6-review-independent -f docker/compose.test.yml -f docker/verification/compose.m6-delivery-test.yml run --rm --no-deps -v "${PWD}/docker/verification/m6-review-authority.test.ts:/srv/server/tests/integration/m6-review-authority.test.ts:ro" test npx vitest run tests/integration/m6-review-authority.test.ts
docker compose -p m6-review-independent -f docker/compose.test.yml -f docker/verification/compose.m6-delivery-test.yml run --rm --no-deps -v "${PWD}/docker/verification/m6-review-ambiguity.mjs:/srv/server/m6-review-ambiguity.mjs:ro" -v "${PWD}/reports-and-markdown-files/docker-and-operations.md:/review/docker-and-operations.md:ro" test node /srv/server/m6-review-ambiguity.mjs
node docker/verification/m6-acceptance-project.mjs
docker compose -p m6-review-runtime -f docker/verification/compose.m6-delivery-browser.yml config --format json
docker compose -p m6-review-runtime -f docker/verification/compose.m6-delivery-browser.yml up -d --wait
docker cp docker/verification/m6-inbox-ui-fixtures.cjs m6-review-runtime-server-1:/tmp/m6-inbox-ui-fixtures.cjs
docker exec m6-review-runtime-server-1 node /tmp/m6-inbox-ui-fixtures.cjs seed-realtime
docker exec m6-review-runtime-server-1 node /tmp/m6-inbox-ui-fixtures.cjs expire
docker stop m6-review-runtime-redis-1
docker start m6-review-runtime-redis-1
docker exec m6-review-runtime-server-1 node /tmp/m6-inbox-ui-fixtures.cjs cleanup
docker compose -p m6-review-runtime -f docker/verification/compose.m6-delivery-browser.yml down -v
docker compose -p m6-review-independent -f docker/compose.test.yml -f docker/verification/compose.m6-delivery-test.yml down -v
```

Each additional runtime Chromium phase used `docker run` with the browser identity above, project label `com.docker.compose.project=m6-review-runtime`, network `m6-review-runtime_default`, shared-memory size 512m, `M6_INTERNAL=true`, and M6_PHASE decisions/expiry/outage. Read-only binds mounted `docker/browser/m6-realtime.mjs` at `/srv/browser/m6-realtime.mjs` and the temporary private receipt at `/fixtures/private.json`; the ignored evidence directory was mounted at `/evidence`. Entrypoint was Node running that mounted runner. The outage browser ran detached while host orchestration waited for its readiness/disconnect markers, inspected Redis ownership, then stopped/restarted only that Redis container. Its exit code and backend StartedAt were checked before removal. These phases were sequenced decisions → expiry fixture → expiry → outage.

Fresh sanitized acceptance evidence is in ignored `docker/browser/evidence/m6-05/2026-10-01-m6-05-1790821959945/`; additional runtime checks/screenshots are in ignored `docker/browser/evidence/m6-independent-review/redis/`. Final acceptance JSON records 65 passing assertions and successful receipt/volume cleanup. These evidence locations contain no surviving private credential receipt.

## Failed attempts, cleanup and limits

Passing final gates do not mean every reviewer orchestration attempt succeeded. Two initial negative-migration assertions expected Prisma to surface the deliberate exception; the generic aborted-transaction diagnostic failed those reviewer assertions and led to direct SQL verification. An initial runtime guard wrongly counted absent ports in PowerShell and stopped before resource creation. The first six-variant diagnostic fixture omitted AuditEvent's required actorUserId and failed before testing the query; its owned database was removed. These review-harness issues were corrected and targeted final reruns pass. No application assertion failure or application source repair occurred. Read-only lookups of superseded old image-index IDs were unavailable; they do not constitute a source-content comparison.

All three owned projects were cleaned: `m6-acceptance`, `m6-review-independent` and `m6-review-runtime`. Named PostgreSQL volumes, inspected owned anonymous Redis volumes, test containers/browser helpers and networks were removed, with ownership and mount guards checked first. All random upgrade/ambiguity databases and temporary migration directories were removed by the probes. Fixture cleanup removed only run-owned users/courses/events/audits; temporary private receipts were removed from host/container. Disposable-project container and volume queries are empty. Built images remain as local verification artifacts. No global prune, existing-volume deletion, production database access or DRM mutation occurred. The original preview's server/client/Nginx/PostgreSQL/Redis remained healthy and its guarded named volumes remained unchanged.

The READY media mapping, internal ADMIN, recharge receipt and shortened subscription intervals are clearly labeled isolated fixtures. Browser registration/login, approval/publication/purchase and cookie/Origin/CSRF behavior use actual supported APIs. Tests prove notification integrity and authorization; they do not prove a bank transfer, external media processing, real external playback termination, a commercial DRM provider or a 180-day elapsed-time endurance run. Retention uses the actual cleanup function with an injected boundary clock. The full historical UI matrix and broader M5/DRM suites were deliberately not rerun.

Migration impact is additive notification/outbox/inbox/audience and source/rollout metadata. Redis adapter and the explicit Nginx WebSocket path are runtime configuration impacts; no separate application/queue topology or public data-service port was added. Rollback uses reviewed prior immutable runtime/client images to stop new producers/transport while retaining additive schema, durable intent/inbox and deduplication markers. Any database rollback is separately reviewed; never reset finances/subscriptions or delete shared volumes.

Owner M6 acceptance remains open. Formal M5 owner acceptance remains unconfirmed. Production DRM/Widevine, hosting/TLS/secrets/monitoring, dependency debt, backup/recovery objectives and the 10,000-user qualification remain separate release gates. This review does not close or soften them.
