# M8 implementation handoff after owner stop

Date: 2026-10-01. The owner explicitly stopped direct Codex implementation and requested a prompt for OpenCode. Source and evidence are preserved. No commit, push, deployment or milestone acceptance.

## Current state

The backend portion of M8 academic catalog/access has been implemented in the working tree and verified by the same implementing agent. It has not had independent review. Student/admin academic and package UI has not been implemented. The readonly localhost:8084 preview is unchanged; it still shows the earlier generic sample catalog and has no real backend/accounts/payments.

Confirmed owner policy: first/second secondary initially; monthly explanation and revision courses; first-secondary terms 1/2; a package contains exactly three specified monthly courses and has one common ADMIN-selected deadline; standalone access can use duration, term-end or year-end. Explicit Cairo date/time and immutable purchased deadlines are approved. Overlapping active access warns but does not prohibit package purchase. Unpublished package-member eligibility remains unanswered; current code retains the platform's published-only sale boundary and does not implement pre-sales.

M7-07's report is received, not independently accepted by this handoff. Its exact-parent deepmerge-ts override is already present and was preserved throughout M8. Do not revert or reimplement it. Current manifest SHA256: `A62D2E0CDD252A0380F1DCED0C5D8882A26A00952DDF66B59B8891CD91EA149A`; server lockfile: `6DCC73ACD2D0CEC30358FDE9C89C017DB87B56410138277AB18336AC2D34D828`. Client manifest/lockfile are unchanged by this M8 backend package.

## Implemented backend files

- server/prisma/schema.prisma and new migration `20261001150000_m8_academic_access/migration.sql`.
- server/src/modules/catalog/academic.ts: explicit placement, duration/deadline discrimination and Cairo wall-time/offset validation.
- catalog/courses/service.ts: admin academic payload and safe public metadata/filtering; legacy unclassified courses retained.
- catalog/plans/service.ts and types.ts: optional duration only when a fixed deadline is selected; mandatory explicit access shape.
- catalog/packages.ts and routes/packages.ts; routes/index.ts and routes/public.ts: versioned bilingual package administration and safe public summaries.
- wallet/purchase/service.ts: fixed-date standalone snapshots, expiry refusal and cross-kind idempotency conflict; legacy days/renewal preserved; purchase history queries grants by selected purchase IDs.
- wallet/purchase/packages.ts and routes/student.ts: student-only review/warnings, one debit/three grants, stored replay, own package history.
- tests/unit/academic.test.ts and tests/integration/m8-academic.test.ts.
- docker/verification/compose.m8-03-test.yml, m8-03-upgrade.cjs and m8-03-runtime.cjs.

## Technical choices versus the earlier proposal

The design document was a candidate, not an applied model. Implementation uses validated nullable academic columns directly on Course, with an explicit academicYear string and teaching month; no inferred categories or seeded calendar. Separate PackagePurchase/PackagePurchaseItem historical snapshots preserve the legacy single-course Purchase and its singular subscription API. Subscription.purchaseId remains unique but becomes nullable for a package source; packagePurchaseId/courseId is unique and a database CHECK requires exactly one purchase source.

Course and package operations check the same student idempotency namespace under the wallet lock. Package purchases use one PACKAGE_PURCHASE ledger source, not three invented price allocations. Course-scoped entitlement union/expiry notifications remain authoritative. A shorter package deadline never overwrites a longer standalone grant. No external DRM internals are changed.

## Evidence actually completed

Evidence directory, ignored: `docker/browser/evidence/m8-03/`.

- Final Docker backend build and production/test typecheck: exit 0.
- Final server suite: **21 unit files / 171 tests**, **31 integration files / 263 tests**, all passed, exit 0; 434 total. `final-server.log` is the final-source result. Earlier full run passed 431 before three additional integration tests and final corrections.
- Fresh test database: 10 migrations applied. Populated second database: old image applied nine migrations; historical snapshot seeded; new image applied the tenth; `upgrade-verify.log` confirms unchanged recorded user/course/plan/purchase/grant IDs, terms, dates, wallet and ledger data, plus default DURATION and no guessed placement. This drill does not claim exhaustive progress/media/notification populated coverage.
- Final serving image runtime smoke: CLI chain absent; native Prisma/argon2 usable. `runtime-flow.log` uses compiled serving services, a guarded isolated DB and no external/media fixture: one 90000-piastre debit, 110000 remaining from 200000 test credit, exactly three common-expiry grants, idempotent replay and exact expiry refusal. This is a service/native test, not a deployed HTTP/browser or real-video qualification.
- Integration checks include overlap warning/permitted purchase, longer existing access, suppression of premature expiry notice, changed versions, expired offers, insufficient funds, archive/public privacy, own history/role guards, shared idempotency and injected SQL failure rollback.
- New test image: `edu-platform-server-test:0.8.0-m8-03`, manifest-list `sha256:e559d72873d3f91250c5b45f247835287a01afedcd6abe454987f7287d62a681`.
- Serving image: `edu-platform-server:0.8.0-m8-03`, manifest-list `sha256:4b9c6611bb8734eec23995edf17915eae712b3cf4828c9a8e0974de90700fdfb`.
- Migration image: `edu-platform-migrate:0.8.0-m8-03`, manifest-list `sha256:816e3705b08186fc4bf1d7ab6b507ce5f5ee5a8f3eee72aa06eb48707e3b1c89`. Schema/migration bytes match the final migration; later service-only corrections are in final test/runtime images.

## Cleanup and preserved work

At the owner stop, verified project labels and mount ownership, then removed only `m8-03-test` containers/network and its `pgdata-test`/`redis-test` volumes. Both fixture databases are gone. Images and ignored evidence are preserved. No active build/test sessions remain from this package.

Existing platform preview on 8082 remains healthy; design 8083 and readonly UI 8084 remain running. Only original `education-platform-rs256_pgdata` and `education-platform-rs256_redisdata` volumes remain. DRM is unchanged/clean at the existing pin. All pre-existing M7 and M8 visual/docs work is preserved.

## Required continuation limits

OpenCode must review the actual implementation before calling the backend package complete. In particular, validate concurrent cross-kind replay, multi-course lock ordering with archive/deletion, status/version races, SQL access constraints, snapshot preservation and HTTP authorization/CSRF. Add meaningful missing coverage where a real concern remains; do not rewrite passing tests merely to match implementation.

The current client assumes every plan/receipt has numeric durationDays and has no package/editor/discovery UI. Do not deploy fixed-date/package offers with that client or advertise the preview as updated. Complete client compatibility in a following bounded package after backend review. Date conversion must not use the browser/host timezone. Calendar metadata and fixed-date renewal rules beyond explicit owner direction remain proposals.

The next OpenCode assignment is [the continuation prompt](m8-03-open-code-continuation-prompt.md). It completes/reviews the backend package first, reports evidence and stops for manager review; student/admin UI follows as a separately assigned package. No M7-08 or unrelated dependency changes are assigned.
