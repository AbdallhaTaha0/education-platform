# M8-03A academic data and purchase design

Execution follow-up: the later owner instruction "implement" started the backend code recorded in [the stop handoff](m8-03-codex-stop-handoff.md). The owner then stopped Codex and assigned continuation to OpenCode. This document remains the earlier candidate design; actual storage differences, evidence and outstanding UI/review gates are in that handoff. Proposed model names below are not claims about the applied Prisma schema.

Date: 2026-10-01. Status: source-reviewed design package, not an applied migration or accepted implementation. Authority: [D27](decisions.md), [R18](requirements.md) and [the school catalog contract](m8-school-catalog-contract.md). Explicit owner answers outrank proposed details below.

## Outcome and scope

Design an additive academic catalog and a transactional purchase model for first/second secondary, monthly explanation courses, revisions, first-secondary terms and packages of exactly three specified monthly courses. Standalone courses support duration, term-end or academic-year-end access. A package grants all three members until one common ADMIN-selected deadline.

This package does not modify application code, Prisma schema, lockfiles, existing subscriptions, Docker resources or external DRM. It defines a concrete candidate for review and separates unresolved business rules from engineering requirements. The current localhost:8084 preview still illustrates the earlier visual shell and generic sample catalog.

## Verified current constraints

| Source | Actual behavior | Consequence |
| --- | --- | --- |
| server/prisma/schema.prisma: Course / SubscriptionPlan | Course has no grade/year/term/month/type; each plan belongs to one course and requires durationDays | Academic placement and explicit expiry modes need persisted fields, not title parsing |
| server/prisma/schema.prisma: Purchase / Subscription | Purchase snapshots one course/plan/price/duration; Subscription.purchaseId is unique | One purchase cannot currently grant three subscriptions |
| server/src/modules/wallet/purchase/service.ts | Course read lock, trusted published plan, wallet lock, idempotent replay, one debit and one subscription | Preserve transaction/replay protections while extending the purchase cardinality |
| server/src/modules/learning/access/entitlement.ts | Effective access uses the latest course expiry; at the exact expiry instant access is denied | Package deadline must become real per-course subscription expiry; do not add client-only access |
| server/src/modules/notifications/producers.ts | Expiry notifications group by student/course and maximum expiresAt, coordinated with course/wallet locks | Preserve renewal-aware course notification semantics when one purchase has three items |
| server/src/modules/learning/playback/service.ts and expiry/reconciler.ts | Platform rechecks entitlement and coordinates external sessions | New access modes must flow through the existing external API boundary |

The current evaluator does not test startsAt: legacy early renewal records start at the previous expiry while prior rows cover access. Do not introduce future-start package grants or claim scheduled release support without a separately tested interval rule.

## Proposed academic data

Names below are candidate model/API names, not generated Prisma types.

| Record | Proposed fields and constraints | Migration treatment |
| --- | --- | --- |
| AcademicYear | id, bilingual label, admin-maintained identifier; optional explicit year deadline | No inferred year from titles or current date |
| AcademicTerm | id, academicYearId, grade FIRST_SECONDARY or SECOND_SECONDARY, term code, bilingual label; optional explicit deadline | First-secondary terms 1/2 supported; do not seed second-secondary terms as approved policy |
| Course academic placement | academicYearId, grade, optional termId, kind MONTHLY_EXPLANATION or REVISION; teachingMonth for monthly courses | Nullable legacy placement; admin assigns classification before inclusion in new academic discovery |
| Teaching month | Explicit YYYY-MM month stored separately from access validity | Required for a classified monthly explanation course; not guessed from title |
| CoursePackage | id, bilingual title/description, status DRAFT/PUBLISHED/ARCHIVED, price in integer piastres, endsAt, version | New records only; no generated live packages |
| PackageMember | packageId, courseId, position 1..3; unique package/course and package/position | Three distinct monthly explanation courses; membership validated under transaction locks |

Recommended validation: members share grade and academic year. Cross-term packages, consecutive versus selected nonconsecutive months, and multiple monthly courses for one month are not owner decisions. Do not enforce these additional restrictions silently. A draft can be incomplete; publishing and purchase require exactly three valid members. Both content translations remain mandatory.

Academic dates describe content placement. A teaching month is not a 30-day entitlement, and three selected months are not a 90-day entitlement.

## Proposed standalone access representation

Extend SubscriptionPlan with accessMode = DURATION / TERM_END / YEAR_END, nullable durationDays and nullable accessEndsAt. The existing course editor presents the access choice alongside pricing; plan records remain the existing priced offer boundary. If a course has multiple plans, preserve them during migration rather than silently collapsing their distinct purchased terms.

Database and service validation must allow exactly one shape:

- DURATION: bounded durationDays 1–3650; accessEndsAt absent. Existing immediate purchase / early renewal extension remains unchanged.
- TERM_END: durationDays absent; explicit accessEndsAt and matching academic term required.
- YEAR_END: durationDays absent; explicit accessEndsAt and matching academic year required.

A missing duration never means unlimited access. The deadline cannot be supplied or overridden by a purchasing student. A new fixed-deadline purchase requires deadline > authoritative transaction time. Updating calendar labels or course classification cannot recalculate old purchased expiry.

Owner-confirmed: ADMIN enters a date and time in Africa/Cairo; purchase preserves that instant, and later edits affect new purchases only. The server resolves and validates it as UTC. Do not use the execution host timezone or an inferred midnight. If date-only input is later chosen, its cutoff needs an explicit rule before implementation.

Recommendations pending review for fixed-deadline repeat purchase: reject when the new offer adds no access; do not apply legacy duration extension arithmetic to an absolute deadline. Whether a later deadline can be purchased as an extension, and how overlap with a package is handled, remain policy decisions.

## Proposed purchase and access records

Recommended single financial purchase model, with child items:

1. Purchase gains kind COURSE/PACKAGE, optional packageId snapshot and an offer version snapshot. Existing planId/courseId/durationDays fields become nullable only for new shapes; legacy COURSE rows keep their original values. Preserve unique (studentId, idempotencyKey) across both purchase kinds.
2. PurchaseItem snapshots purchaseId, courseId, optional planId, bilingual course labels, accessMode, optional durationDays, startsAt and expiresAt. Exactly one item for a standalone course; exactly three for a package. Unique (purchaseId, courseId). Package items snapshot the same common deadline and have no synthetic 90-day duration.
3. Subscription remains the authoritative per-course grant. Replace unique purchaseId with unique (purchaseId, courseId), preserving existing rows/ids and adding three grants for a successful package purchase. An item-to-grant association must be unambiguous and validated.
4. One WalletEntry with source PURCHASE / purchaseId records the total debit. Do not create three independent charges or divide package price into invented course prices. Course-attributed revenue requires a later allocation rule; total spending can use the purchase total.

Keep history snapshots independent of live catalog deletion, as current Purchase strings already are. Package retirement, course archive or later membership changes do not rewrite financial history. Existing course lifecycle access restrictions still apply; no new refund or continued access to archived media policy is implied.

Legacy response adapters must return the original standalone purchase shape. New package responses include kind, package snapshot, total price and items[3]. Audit clients of the singular subscription field before changing shared types; use an explicit package API contract rather than pretending one subscription represents all three courses.

## Proposed API and UI contracts

Exact paths are proposals to align with existing catalog/wallet router mounts during implementation.

| Operation | Proposed contract |
| --- | --- |
| ADMIN academic metadata | Authenticated ADMIN endpoints for year/term metadata and course placement; CSRF for writes; reject unknown fields and invalid grade/year/term combinations |
| ADMIN standalone plan | Existing plan endpoints accept the discriminated access shape; old duration-only payloads retain DURATION behavior |
| ADMIN package management | Draft/edit/publish/archive; three distinct member IDs, total piastre price, bilingual copy and explicit common deadline; optimistic version conflict prevents overwriting concurrent edits |
| Public academic catalog | Bounded grade/year/term/kind/month filters over published metadata; safe labels/prices/access terms only; no lesson outline, external asset ID or signing data |
| Public package details | Three ordered course summaries, total EGP price and shared end date; truthful unavailable state when a member becomes unavailable |
| STUDENT package purchase | packageId, expectedOfferVersion, idempotencyKey only; price, membership and deadline loaded from trusted server state |
| My purchases / My learning | One purchase total with three grant items; course grouping uses persisted academic metadata and real effective expiry |

Offer changes between review and first purchase should return a conflict requiring the student to review current terms. Successful idempotent replay returns its stored purchase even if the current offer changed, expired or was archived. Never re-evaluate affordability before recognizing a committed retry.

Student flow: choose grade → first-secondary term where applicable → monthly/revision/package offerings → review exact contents and expiry → explicit wallet purchase → three courses in My learning. Recharge approval remains wallet credit only. ADMIN flow separates academic placement, media publication, price/access and package composition.

## Transaction and concurrency design

The implementation must reconcile its lock order with the existing course lock helper, wallet ledger, deletion and notification paths. Candidate order: lock package row/version, acquire member course locks in sorted ID order, then wallet lock. Do not lock wallet first and later request member course locks; existing expiry production locks course before wallet.

Inside one transaction:

1. Validate identity, input and idempotency. Replay an existing matching purchase; conflicting kind/offer is 409.
2. Lock the package and three members; reload published state, membership/version, trusted price and deadline.
3. Lock the wallet, then recheck committed replay before funds or eligibility decisions.
4. Apply approved overlap/publication rules; reject expired offers before any debit. Sample backend time after lock waits for the eligibility decision; all items use that same instant.
5. Create one purchase and three immutable items, post one total debit, create all three subscriptions and write the sanitized audit event.
6. Commit once; any failure rolls back the entire operation. Return stored terms, not a later live catalog read.

Testing must prove actual database constraints and deadlock/retry behavior, not merely the number of service calls. A unique-constraint loser rereads the winning transaction and converges without a second charge. A failure after any item insert must leave no purchase, grant or debit.

## Owner follow-up and remaining policy responses

The owner answered the two initial questions:

- Existing active member access requires a clear warning, **not a purchase prohibition**. The overlap rejection recommendation is rejected. Purchase review should identify overlapping courses and show the package's total price/common deadline before explicit purchase. Do not invent a discount, proration or rewrite of the student's existing grant; existing entitlement union must not shorten earlier purchased access.
- Explicit date/time in Africa/Cairo, snapshotted per purchase, with later edits applying to new purchases only is approved.

One focused clarification is pending: does warning-only permission cover overlap alone with all members published, or also packages containing an unpublished member? The earlier compound question included both; do not treat the warning answer as automatic permission to sell unreleased content.

Other unresolved cases: fixed-deadline extension purchases, second-secondary terms, package/member classification constraints beyond the confirmed three monthly members, and the handling of existing future renewal grants in the overlap warning. No discounted upgrade, proration, refund, gifting or scheduled course release is implied.

## Migration and rollout plan

Use a fresh disposable Docker project and populated migration drill. Candidate expand migration adds metadata tables/nullable placement, accessMode default DURATION, package tables, purchase-kind default COURSE and item snapshots. Backfill existing items directly from original Purchase + Subscription values; do not recompute deadlines or assign academic categories. Fail and investigate missing/duplicate legacy grant associations instead of inventing history.

Replace the old Subscription purchaseId uniqueness only after backfill invariants are checked. Audit every findUnique({purchaseId}) and purchase-to-subscription map: leaving these singular assumptions in runtime is a blocker. Existing listMyPurchases independently limits purchases and subscriptions to 100; package items require fetching by selected purchase IDs to avoid dropping grants from the response.

Do not enable package writes while an older server replica still assumes one subscription per purchase. Use a disabled feature gate or coordinated compatible rollout with the expanded schema. Discovery should consume actual classified data and keep legacy records reachable through existing routes until ADMIN classification; do not silently remove existing purchased courses.

Rollback before package writes can restore the prior application with the expanded compatible schema. After package purchases, old code cannot safely read the new cardinality: disable new writes and roll forward a repair. Do not drop package purchase data or truncate financial history to force a down migration. Exact operational steps belong in the implementation report.

## Required implementation evidence

- Populated migration preserves balances, ledger amounts, purchase IDs/terms, subscription IDs/expiry, progress, notification markers and media mappings; unclassified courses remain unguessed.
- Duration early/expired renewal remains correct; fixed dates tested just before/at/after expiry, under invalid/ambiguous date inputs and after admin edits.
- Valid three-course purchase debits once and grants all three until the common deadline; two/four/duplicate/revision member sets fail; policy-dependent grade/month restrictions stay unimplemented until agreed.
- Replay after changed offer/expiry returns original terms; concurrent duplicate/different purchases and injected transaction failures preserve financial integrity.
- Member archive/deletion/publish and package edit races cannot sell a stale unavailable offer; deterministic multi-course lock order is exercised.
- Existing learning, native runtime, renewal, session termination and course-scoped notification checks include package grants; no progress-only access or direct DRM persistence.
- Student/admin authorization, CSRF, protected outline privacy, Arabic/English, RTL/LTR, dark/light, 320/390 mobile and desktop; actual reviewed Docker fixtures only.

## Package completion and next handoff

This design is completed as documentation with source traceability and explicit open decisions. No migration, build or runtime test was run or claimed for this document-only package. No milestone acceptance, commit, push or deployment is implied.

Next: resolve the publication clarification, finalize the candidate schema/API contract, then implement one bounded backend persistence/access package with Docker migration and financial evidence. Academic discovery and admin UI follow that reviewed backend; saved/search/report additions retain their separate contracts.
