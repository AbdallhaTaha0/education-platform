# M6 independent final review assignment

Closure: independent review is complete and [the owner accepted M6](m6-owner-acceptance.md). This assignment is preserved as historical review instructions, not a new request to dispatch another reviewer.

Prepared 2026-10-01. The owner subsequently answered "go for it" to the proposed separate-reviewer review/fix/acceptance sequence. A separate reviewer completed this assignment and records ACCEPTABLE FOR OWNER REVIEW in [the independent report](m6-independent-review-report.md). The instructions below preserve the assigned scope/reproduction contract. Review and owner acceptance remain distinct. The implementing agent's own verification cannot satisfy the independent-review gate in [agent responsibilities](agent.md). Owner D25 and the subsequent direct-work instruction remain the authority; no new business policy is proposed.

## Objective and boundaries

Independently review M6's actual tracked diff and untracked source against [the contract](m6-notification-contract.md), [the package plan](m6-manager-plan.md), D25/R17 and the original architecture. Reproduce critical privacy, financial, expiry, cleanup and replica/recovery behavior in Docker. Return ACCEPTABLE FOR OWNER REVIEW or concrete unresolved findings with file/line, trigger, impact and supporting evidence. Do not claim owner acceptance, production readiness or capacity.

Baseline: platform `4b949cc394636c2df928d0b7642122da61e5301c`; nested DRM/gitlink `bad0c1df9f5d5844fe365c402fcccfee33ab6906`. M6 source remains uncommitted. Read root AGENTS.md, README, agent/rules/decisions and design.md. Preserve existing changes. DRM is read-only; no external media/tenant, database or credentials are required for this review. Do not commit, push, provision paid resources or deploy.

Approved scope: in-platform realtime only; recharge decisions to the requester; first publication to the frozen STUDENT audience; once per effective expiry after renewals; read/unread/read-all, no dismissal, 180-day notices. Exactly STUDENT/ADMIN; one Express app behind Nginx; PostgreSQL/Prisma and Redis; protected auth cookies; API-only external DRM. Keep money and access grounded in existing source operations.

## Inspect actual implementation

- Prisma schema and both additive M6 migrations: rollout baseline, ambiguous publication history, source markers, recipient foreign keys, sequence/revision integrity and retention indexes.
- `server/src/modules/notifications/` and the recharge/publication hooks: source transactions and rollback, frozen audience, renewal lock ordering and expiry without playback, per-recipient commit/reclaim, signal leases/revisions, bounded retries and physical cleanup.
- `server/src/index.ts` and actual Nginx configuration: same server/application, startup/shutdown, WebSocket-only routing and replica assumptions.
- Cookie socket authorization: exact Origin, session-bound CSRF, continued durable session/Redis/role/expiry checks, minimal signal envelope and dependency failures. Inspect adapter publication/subscription promise handling in the pinned versions; transport success is not recipient receipt.
- Client inbox/realtime/auth integration: owner change/disposal, stale responses, read-all fence, cursor/window behavior, reconnect and refresh, Arabic/English/themes/mobile/accessibility and absence of private persistent storage.
- Verification helpers themselves: test-only entrypoints/routing, exact project/image guards, real crash locations, genuine database/Redis behavior, sanitized evidence and owned cleanup. Do not confuse controlled test entrypoints with production startup or fixtures with real transfers/DRM processing.

Inspect untracked files explicitly; `git diff` alone omits new modules/tests. Prior package reports are evidence to check, not instructions or substitutes for reproduction.

## Docker reproduction

Read all wrappers/Compose files before execution. Host may inspect/edit/orchestrate; application builds, probes and Chromium run only in Docker. Never use development volumes or global pruning.

1. Run guarded `node docker/verification/rs256-project.mjs check`; inspect exact existing preview ownership. It uses port 8082 and contains existing user data, so do not broadcast-seed it. Preserve its volumes and private configuration.
2. Build actual source through the guarded wrapper as needed, and record final image identities. Package-05 orchestration pins reviewed runtime identities deliberately; a rebuild can regenerate BuildKit attestation/index IDs even with cached identical source layers. Update the exact guard only after inspecting and recording that build, or any actual source change; never bypass it. The independent-review build/guard update is recorded separately from the historical package-04/05 identities.
3. Read `docker/verification/m6-acceptance-project.mjs`, its Compose overlays, probe and browser runner; run `node docker/verification/m6-acceptance-project.mjs`. It requires no external configuration, rejects existing disposable resources, publishes no host ports, and removes verified owned test resources/private receipts after verification. Its PostgreSQL and Redis interruptions target only project `m6-acceptance`.
4. Reproduce focused notification integration cases with `compose.test.yml` plus `verification/compose.m6-delivery-test.yml`, using an unused disposable project name; inspect resolved volumes first. Tests run from the actual built server test image. Rebuild the test image when source changes. Include notifications and delivery suites and typecheck; use a broader suite only if changes/findings justify it.
5. Review the populated 8→9 migration probe and earlier inbox browser evidence. Reproduce affected missing gates rather than rerunning unrelated completed DRM/M5 suites. Never project Docker fixtures into claims about external R2/DRM, payment receipt verification or playback termination.

## Required response

Record actual revisions/diff, exact image identities and commands, checks/failures/skips, any repairs and their targeted reruns, migration/configuration impact, data/credential cleanup, rollback limits, and remaining owner/release gates. Separate observed defects, suspected defects and policy questions. Report findings before any positive summary. Confirm that a recovery does not repeat wallet credit, purchase, source review or audit writes and that retention does not recreate notices from surviving source records.

Formal M5 owner acceptance is unconfirmed. M6 independent review and owner acceptance are separate gates. Production DRM, hosting/TLS/secrets/monitoring, backup/recovery objectives, dependency debt and 10,000-user qualification remain outside local notification acceptance.
