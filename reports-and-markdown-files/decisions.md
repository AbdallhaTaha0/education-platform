# Decision register

## Later owner instruction — finish materials, push both, shut down (2026-10-04)

The owner asked to finish the remaining integration, commit/push/report and shut down the laptop, then explicitly clarified "push both the drm and the platform". This authorizes delivery of the completed platform materials integration and existing bounded DRM recovery. It supersedes the earlier pending-material preservation/DRM no-push restriction for this delivery; no new nested DRM implementation or production permission is inferred. See [completed integration](course-materials-and-dual-repository-delivery-20261004.md).

## Owner delivery instruction — 2026-10-04

After the playback recovery correction handoff, the owner asked the coordinator to fix any remaining bugs directly, then commit and push completed work and make a report. This authorizes the verified platform recovery/website UX delivery documented in [the completed-work report](completed-work-and-playback-delivery-20261004.md). Preserve unfinished materials changes outside that commit, the retained preview and the independent nested DRM repository. No production deployment, milestone acceptance or new DRM maintenance is inferred.

## Owner commit/push authorization (2026-10-02)

After the completed platform UX, profile/dashboard navigation, support settings and final login/logout placement were verified and served on localhost:8080, the owner explicitly requested "commit and push". Commit and push the completed platform work and its sanitized verification reports. Earlier pending commit/push statements are historical. Preserve private local settings, backups, retained data and the unchanged independent DRM repository. This delivery authorization does not adopt draft legal policies, approve production deployment or certify capacity.

## D28 — Railway and delegated recovery baseline (2026-10-01)

Owner selected Railway; custom domain is undecided. Owner delegated recovery choices to the manager. Selected objectives: RPO at most 15 minutes, RTO at most four hours, Railway PostgreSQL PITR and separately protected daily logical exports retained 30 days. These are selected preparation requirements, not provider setup, measured guarantees, spend authorization or production acceptance. [Runbook](m7-railway-runbook.md) and [local evidence](m7-08-railway-preparation-report.md). External commercial DRM and capacity workload choices remain unanswered.


## D27 — academic courses, three-member packages and optional expiry (2026-10-01, CONFIRMED)

Initial coverage is first and second secondary, each with terms 1 and 2, monthly explanation courses and revision courses. Every package contains three specifically identified monthly courses with one common ADMIN-selected Cairo deadline, independent of standalone access. Unpublished package members are permitted with a clear warning and no viewing before publication. Active overlapping ownership warns without blocking package purchase or shortening earlier access; no overlap discounts or refunds are introduced.

ADMIN chooses standalone access explicitly: DURATION, TERM_END, YEAR_END or UNTIL_REMOVAL. The last mode has no expiry until permanent ADMIN removal, as the owner clarified in Arabic on 2026-10-01. Omitted duration alone never implies indefinite access. ADMIN supplies real term/year deadlines; none are inferred. Cairo date/time and price/access terms are snapshotted at purchase; later offer changes affect new purchases only. Fixed-deadline repurchase is allowed only when it adds access; existing indefinite ownership prevents redundant standalone payment. Three included months do not mean 90-day validity. Publication/archive/removal protection, cookie authentication, manual recharge and external API-only DRM remain unchanged.

Affected documents: [school catalog contract](m8-school-catalog-contract.md), R18, conceptual schema, design and M8 plan. Verification must cover one atomic debit/three package grants, warning-only overlap, unpublished content refusal, finite/indefinite unions, nullable migration preservation, expiry notification/session exclusions, immutable snapshots and no-extension refusal. These approvals do not accept the milestone or authorize production, a new role, live classes or DRM maintenance.

## D26 — M8 audience and whole-site design direction (2026-10-01, CONFIRMED)

Execution follow-up, 2026-10-01: the owner stated "you work on the M8", assigning direct Codex implementation. [M8-02](m8-02-shell-landing-report.md) implements the youth shell/landing with same-agent Docker evidence and isolated read-only sample content. No new saved-course/report schema, financial policy, communications channel, DRM maintenance, production authority or milestone acceptance is inferred.

The owner selected new product features and UI improvements for both student/admin areas, with summary report screens first and CSV deferred. The owner then specified a **15–18-year-old** target audience, a mobile bottom-navigation design matching the supplied reference's structure, a complete website redesign using the FAYQ board/logo, and dummy data for testing/a realistic landing page. [The M8 plan](m8-product-and-ui-plan.md) and [redesign brief](m8-design/website-redesign-brief.md) record this direction.

This confirms the audience, design/testing direction and reporting format. It does not confirm every proposed saved-course/search/report rule, add an age-verification field, enable AI-assistant/certificate/quiz/chat/payment features seen or implied in artwork, change money/access rules, or authorize production deployment/DRM maintenance. Implementation remains bounded and reviewed one package at a time. The draft Codex prompt has not been dispatched.

Affected documents: design.md, the M8 plan and redesign brief/prompt/demo assets. Acceptance checks: reusable logo/source comparison; all existing routes accounted for; Arabic/English, RTL/LTR, dark/light, desktop/mobile; functional role-based dock and safe-area/focus/keyboard/fullscreen behavior; actual API-backed landing and isolated synthetic fixtures; preserved financial, cookie, entitlement and external-DRM contracts. The prototype provides design evidence only. Add the documentation-index links during integration after the concurrent worker's changes are reviewed.

Updated 2026-09-29 from owner answers and follow-up responses. CONFIRMED is explicit owner direction; PARTIAL means remaining details are listed. Recommendations are not decisions.

| ID | Status | Owner decision | Remaining detail / consequence |
| --- | --- | --- | --- |
| D01 | CONFIRMED | DRM is external and API-only to platform code, with its own technologies. Send required requests and return frontend-safe responses. The owner separately authorized the bounded D17 maintenance inside their DRM package. | No platform work may replace its Caddy, Valkey, SQL, gateway or packaging, and platform code never accesses DRM persistence. |
| D02 | PARTIAL | Recorded videos only; no live classes or live courses. | 10,000 concurrent users remains the target. Viewing/browsing mix and performance thresholds remain open; chat/email/WhatsApp release scope is unanswered. |
| D03 | CONFIRMED | DRM remains external, including persistence. Platform uses PostgreSQL/Prisma. | No DRM ORM migration, shared-table access or cross-service foreign keys. External physical hosting is not a platform persistence decision. |
| D04 | CONFIRMED | Admin sets an integer-day course-plan duration. A new subscription starts immediately at purchase. Early renewal extends an active subscription from its existing expiry; an expired subscription starts immediately. Purchased price, duration and expiry are snapshotted, so later plan edits affect only future purchases. | No recurring billing. Expiry enforcement and external playback termination remain WP5 work. |
| D05 | CONFIRMED | Manual EGP recharge supports InstaPay, bank transfer and mobile wallet. Student submits amount, channel, reference, sender name/phone, transfer date and a JPG/PNG/PDF proof up to 5 MiB. Admin verifies receipt before approval; no automated gateway. | Destination identifiers/instructions are deployment configuration, never committed values. Proof is admin-only, removed 180 days after decision, with audit metadata retained. |
| D06 | PARTIAL | Follow-up confirms Cloudflare R2 configured through external DRM for videos; local development runs through Docker. | Confirm permitted Docker local substitute and how the unchanged external DRM deployment is configured. Hosting/recovery targets remain open. |
| D07 | CONFIRMED | DRM handles video security, watermarking and video-related processing. | Platform workers test only the API integration. Internal DRM maintenance requires a separate explicit owner assignment such as D17. |
| D08 | PARTIAL | Admin uploads original video; lifecycle leads to object storage and a platform PostgreSQL record. | Store metadata/references/status in PostgreSQL, not assumed video blobs. Original retention, subsequent download and removal policies are unanswered. |
| D09 | CONFIRMED | Authentication and session tokens are stored in cookies, never local storage. Students provide both unique email and phone identifiers and may sign in with either plus a password. Access tokens last 15 minutes; refresh sessions last 30 days and rotate on use. Both credentials use HttpOnly cookies, with server-side revocation and refresh-token reuse detection. | Password recovery is deliberately excluded until an email/SMS delivery channel is approved. Email/phone verification is not implied. Cookie security and CSRF controls remain mandatory engineering safeguards. |
| D10 | PARTIAL | Expiry stops viewing and changes access to unsubscribed / needs renewal. | Enforce on server plus external session termination. Measure external enforcement latency. Device/stream policies remain external. |
| D11 | CONFIRMED | Arabic primary, English secondary; both translations mandatory. Programming courses have video lessons/segments; listing is shown after subscription. | Required translated platform content does not imply two dubbed recordings. Promotion rules remain open. |
| D12 | CONFIRMED | Follow-up: one Express backend with separate internal modules; external DRM separate. | Replicas run the same backend image. No separate auth/course/wallet microservices. |
| D13 | CONFIRMED | The first admin is created through a one-time Docker bootstrap command. Once an admin exists, only an authenticated ADMIN may create another admin. | The bootstrap must refuse to create additional admins and must not contain committed credentials. The M2 worker must provide the owner with local test credentials outside tracked files. |
| D14 | CONFIRMED | Subscription-plan duration is stored as a positive bounded integer number of days and snapshotted at purchase. | Renewal behavior is defined by D04; later plan edits do not rewrite existing purchases. |
| D15 | CONFIRMED | Catalog hierarchy is Course → ordered Sections → ordered Lessons, with each lesson mapped to one external DRM video asset. | Reordering must be deterministic and admin-only. |
| D16 | CONFIRMED | Course publication uses the full lifecycle DRAFT → PROCESSING → READY → PUBLISHED, with ARCHIVED as a reversible state that may return to an appropriate active state. | Only PUBLISHED courses appear publicly; invalid transitions and publication with missing translations or unready media must fail. |
| D17 | CONFIRMED | Archive is reversible at any time. Permanent delete must remove the platform content permanently and free its external video storage. The owner authorized adding the missing media-deletion capability to the independently deployed DRM package before M3. | The bounded DRM deletion API is accepted at nested revision `6e1e01c`. M3 must use that API; platform-only deletion remains prohibited. |
| D18 | CONFIRMED | A plan may optionally show a higher previous price and a lower current selling price as a visual marketing offer selected by the admin. | Require current price to be lower than the previous price when enabled. No coupon, stacking, eligibility or scheduled promotion engine is implied. |
| D19 | CONFIRMED | M3 implements the complete platform DRM adapter and all non-live verification. Real upload verification remains BLOCKED until external DRM credentials/storage configuration are supplied. | The code must be deployable and require configuration only; tests use an HTTP contract fixture, while reports clearly separate fixture proof from real external proof. |
| D20 | CONFIRMED | On 2026-09-29 the owner authorized a separate bounded DRM maintenance change so retrying registration for the same existing `UPLOADED` asset can return a fresh presigned upload URL. | Preserve the same DRM asset and platform identifiers; do not create an orphan replacement asset, persist signed URLs, broaden DRM scope, or change the API-only platform boundary. M3 acceptance requires independent recovery verification. |
| D21 | CONFIRMED | M4 manual-funding policy: a normalized transfer reference is globally unique within its channel; rejection requires a reason, is immutable and resubmission creates a new request; only ADMIN may open/download proof while the student sees filename/status/deletion date; refunds and reversals are excluded from M4. | Approval credits once but never auto-purchases. Corrections/refunds/reversals require a later owner-approved feature. Proof bytes expire 180 days after approval/rejection while sanitized audit metadata remains. |
| D22 | CONFIRMED | M4 includes a site-wide UI/UX improvement with dark mode as the default visual experience, an accessible light alternative, and a refined navy/teal/amber semantic palette. | Implement through Tailwind semantic tokens and reusable components. Persist only the non-sensitive theme preference in browser storage; verify contrast, RTL/LTR parity, responsive behavior and no theme flash. |
| D23 | CONFIRMED | On 2026-09-30 the owner explicitly authorized bounded DRM maintenance to fix the reviewed M5 playback security and platform assertion/renewal contract. | Limit changes to strict device binding, tenant-scoped service renewal, RS256/JWKS interoperability, and their regression tests. Preserve the independently deployed API-only boundary; no platform access to DRM persistence and no unrelated DRM rewrite. |

## 2026-09-30 M5 gate-closure pass — items resolved and items still open

Nothing in this table is a new owner decision. It records what the pass resolved
under existing approved policy, and what remains genuinely undecided.

| Item | Status | Basis |
| --- | --- | --- |
| Concurrent identical purchase retries must converge on one purchase and one debit | RESOLVED under existing policy | `rules.md` already requires "transactional, idempotent financial operations". The defect was that idempotency was re-checked before the wallet lock, so a loser re-decided affordability after the winner's debit and answered `402 INSUFFICIENT_FUNDS`. Fixed in the product; no new business policy was invented. |
| Browser-route vs platform-route renewal | RESOLVED under D23 | Browser `renew` is bearer and device bound; platform `renew-admin` is application-credentialed and tenant scoped. The two must never be conflated, and a labeled test double must implement the corrected contract. |
| Browser watermark content and presentation | RESOLVED from `design.md` | A subtle masked watermark over the 16:9 player, never a claim that it prevents screen capture. Implemented as a visible, privacy-conscious label only. |
| Widevine as the production DRM | **OWNER DECISION REQUIRED** | All five `WIDEVINE_*` keys are empty. Widevine needs an external license provider, packaging keys, certificates and a commercial agreement. Until the owner decides, ClearKey is the only exercised path and it is not a production substitute. |
| R2 CORS configuration | **OWNER ACTION REQUIRED** | Requires visibility into, or authority over, the bucket's CORS rules, plus an explicitly approved browser origin. |
| Second DRM tenant | **OWNER ACTION REQUIRED** | A tenant can be created through the supported `POST /v1/applications` bootstrap, but the owner must approve creating and later removing a disposable tenant and its data. |
| Production deployment shape | **OWNER DECISION REQUIRED** | No platform production Compose artifact exists. Hosting, replicas, secrets injection, TLS termination, DNS and monitoring are undecided. |
| Capacity target | **OWNER DECISION REQUIRED** | `rules.md` records 10,000 concurrent users as the qualification target. No load test has been run, so nothing is claimed. If the intended target differs, the owner must say so. |
| RPO, RTO, backup retention | **OWNER DECISION REQUIRED** | Unchanged from the Pre-M5 report. |

## Pending immediate follow-up

Answered: Cloudflare R2 through external DRM; subscription duration and all M4 recharge/purchase/renewal policies. M4 may proceed under D04, D05, D14 and D21. Actual transfer destination values remain required deployment configuration, not a code-policy blocker.

Identity/session choices needed by M2 are answered. Other questions block only their dependent work: media retention before unrelated destructive media actions and notification scope before notifications. They do not block M4.

Catalog structure, integer-day plans, lifecycle states, reversible archive, visual compare-at pricing and the credential-blocked DRM adapter are approved for M3. Permanent deletion depends on completing and accepting the separately authorized DRM media-deletion prerequisite; it must never be simulated by deleting only platform rows.

Owner update 2026-09-28: the owner confirmed that education-drm-service is their package and explicitly authorized correcting the missing DRM functionality required by the platform. The immediate bounded prerequisite is durable permanent media deletion that frees external object storage. This authorization changes the previous default read-only instruction only for explicitly assigned DRM maintenance and does not change the platform's API-only integration architecture.

Owner update 2026-09-29: the owner explicitly authorized the narrowly scoped upload-URL recovery prerequisite recorded as D20. A repeated idempotent registration may issue a fresh short-lived upload URL only for the owning application's same existing asset while it remains `UPLOADED`. A dedicated prompt assigns this work; unrelated DRM changes remain prohibited. Affected documents: `AGENTS.md`, the documentation index, this register, `drm-integration.md`, `test-and-review-plan.md`, and the new worker prompt. Acceptance checks cover tenant authentication, stable asset identity, fresh URL issuance, state rejection, concurrency, expiry, secret/log safety, Docker regression, and unchanged platform/DRM boundaries.

## Approval and verification record

These answers update agent rules, architecture, requirements, plans, schema, integration, operations, tests and worker instructions. Original JPEG/PDF design sources remain untouched. The separately authorized DRM deletion change is tracked and independently deployed. Verify the platform boundary through diffs and API-only adapters; verify manual credit, fixed duration, cookie auth, bilingual publication and expiry through test-and-review-plan.md.

Owner update 2026-09-28: email and phone identity, admin bootstrap, session lifetimes/rotation and password-recovery exclusion were approved for M2. Affected documents: requirements, implementation plan, conceptual schema, design notes and the M2 worker prompt. Acceptance checks cover either-identifier login, duplicate identifiers, admin creation boundaries, cookie/CSRF policy, rotation/reuse, revocation and absence of auth credentials from browser storage.

Manager acceptance 2026-09-28: M2 passed independent source review and fresh Docker reproduction: 45 unit tests, 52 PostgreSQL/Redis integration tests, and 20 Chromium assertions through Nginx. Replay revocation, Redis cold-start concurrency, CSRF session lifetime, Argon2 bounds, durable logout failure handling and atomic rate limiting were specifically rechecked. The external DRM repository remained unchanged. This acceptance does not authorize M3.

Manager acceptance 2026-09-28: the owner-authorized DRM permanent-deletion prerequisite passed source review and fresh disposable Docker reproduction. The deletion suite passed twice consecutively at 44/44; unit tests passed 38/38; existing integration, media and end-to-end suites passed 3/3, 3/3 and 2/2. Verification covered durable DB-to-queue handoff, truthful duplicate scheduling, deterministic concurrency, retained terminal jobs, storage prefixes above 1,000 objects, session revocation, tenant isolation, graceful shutdown, migration failure, minimal production images, and zero proxy-validation or secret-log hits. Live Cloudflare R2 verification remains blocked until credentials are supplied.

Manager acceptance 2026-09-29: M3 and the bounded D20 upload-recovery/job-status prerequisites passed independent source review and Docker reproduction from the then-uncommitted trees. Platform unit tests passed 76/76, PostgreSQL/Redis integration tests 110/110, Chromium assertions 58/58, and typecheck passed. DRM processing passed 7/7, upload recovery 38/38 twice, deletion 44/44, and unit tests 48/48. The upload-URL contract blocker is lifted; no evidence-backed M3 code defect remains. Acceptance covers the locally verified implementation only. Live Cloudflare R2 and real external DRM upload/deletion verification remain blocked, so this does not certify production readiness or capacity. Following explicit owner authorization, local DRM (`5293917`) and platform checkpoints were created; nothing was pushed or deployed, and no PR or development-volume removal occurred.

Manager acceptance 2026-09-29: M4 at platform checkpoint `03e51eb` passed
independent source review and fresh Docker reproduction with nested DRM
`5293917` clean and unchanged. The focused financial/review/retention suite
passed 42/42 three consecutive times, the full server matrix passed 91 unit
and 152 PostgreSQL/Redis integration tests, typecheck and the client production
build passed, and Chromium passed 81/81 through Nginx. The exact concurrent
spending race yielded one 201, three 402 responses, one debit and a reconciled
40000-piastres balance. Six migrations applied from empty state; the persisted
development database upgraded from two to six migrations with 4 users and 5
sessions preserved across restart. Migration failure blocked server startup,
runtime/secret/redaction checks passed, and the dev stack remains healthy.
Dependency audit findings remain recorded in `m4-implementation-report.md`.
Live Cloudflare R2 and real external DRM upload/deletion verification remain
blocked; M4 acceptance does not certify production readiness or capacity.

Future answers must record owner/date, approved policy, affected documents and acceptance checks. Do not quietly promote recommendations to approved requirements.

## D24 — recorded-video manifest repair (2026-10-01, CONFIRMED)

The owner explicitly approved the prepared bounded DRM packaging repair after reproduction showed a dynamic MPD for recorded courses. Add `--generate_static_live_mpd` in the independent worker, add affected processing regression coverage, rebuild in Docker and verify real-browser playback. No existing media is automatically regenerated, no license enforcement changes, and no platform access to DRM persistence is authorized. The original architecture remains unchanged.

## D25 — M6 realtime in-platform notifications (2026-10-01, CONFIRMED)

Current milestone disposition: the owner [accepted M6 on 2026-10-01](m6-owner-acceptance.md) after the separate review and explicitly authorized commit/push and a teammate handoff. The execution/review notes below preserve their earlier states. This accepts local notification functionality; it does not approve production, certify capacity, formally accept M5 or expand DRM maintenance scope.

The owner first answered "real time", then explicitly selected "Approve this proposed policy" for the following complete proposal:

- In-platform notifications with realtime delivery; chat, email and WhatsApp are deferred.
- Recharge approval/rejection goes to the requesting student.
- First course publication goes to all students.
- Subscription expiry goes to the affected student, once per expiry after accounting for renewals.
- Read/unread state and mark-all-read; no dismissal.
- Notifications are retained for 180 days.

This approves notification policy only. Recharge approval still requires verified receipt, credits once, and never buys a subscription. Notifications do not grant access or change wallet/subscription terms. Both languages, cookie authentication, the two-role boundary, one Express application, PostgreSQL/Prisma, Nginx/Redis and external API-only DRM remain mandatory.

Affected documents: this register, the documentation index, `m6-manager-plan.md`, the first contracts worker prompt and its future reviewed contract; subsequent bounded packages will update relevant requirements, implementation, operations and verification documentation. Existing pending notification wording describes the earlier baseline and is superseded only by this explicit scope. No password recovery, identifier verification or external delivery channel is authorized.

Acceptance checks: recipient-only list/count/read/realtime access; no protected content or credential disclosure; committed-event production; duplicate/retry/crash recovery; renewal-aware expiry including students without playback references; durable reconnect recovery; cookie/session revocation; multiple backend replicas; bilingual, RTL/LTR, accessible dark/light UI; 180-day retention independent of financial/audit retention. Delivery framework and persistence contracts must be reviewed against the existing architecture before implementation. Formal M5 owner acceptance remains unconfirmed in this manager session.

Execution follow-up, 2026-10-01: the owner stated that Docker is being downloaded again and explicitly asked this agent to work instead of OpenCode in the meantime. Direct contract preparation and source review are therefore assigned to this agent; no worker is dispatched. This changes the executor, not the approved notification policy, Docker requirement, DRM boundary, milestone acceptance or production authority.

Execution continuation, 2026-10-01: the owner restored Docker and repeatedly instructed continuation/"next". Packages 01–05 now have direct bounded implementation/functional evidence, including [65 package-05 Docker replica/recovery/crash/retention assertions](m6-05-acceptance-report.md). [Independent final review is prepared](m6-final-review-prompt.md), not dispatched or performed. No additional notification policy, owner milestone acceptance, commit/push or production authorization is inferred.

Review assignment, 2026-10-01: the owner answered "go for it" to the proposed separate-reviewer M6 review, repair/reverification of findings and subsequent owner acceptance. A separate reviewer is assigned [the review packet](m6-final-review-prompt.md). This authorizes review/reproduction and necessary fixes; it does not predeclare the findings/verdict or owner milestone acceptance. The implementing agent coordinates repairs and the reviewer verifies affected behavior independently. No production or DRM scope change is implied.

Independent review completion, 2026-10-01: [the separate reviewer](m6-independent-review-report.md) records ACCEPTABLE FOR OWNER REVIEW after source inspection and fresh Docker reproduction: 40 focused server tests, 17 client tests, two added authority/renewal cases, both typechecks, 65 acceptance assertions, 22 runtime browser assertions and migration drills. No unresolved blocking application defect remains. An obscured Prisma migration diagnostic is addressed by an independently verified read-only troubleshooting query, preserving applied SQL/checksums. All owned disposable resources/private receipts were removed, the existing preview remains healthy and DRM remains unchanged. Owner M6 acceptance is still unrecorded; this independent verdict does not imply production approval or formal M5 acceptance.

## Owner clarification — optional course expiry (2026-10-01)

The owner explicitly clarified that a course may remain accessible after purchase without any expiry, until permanent removal by ADMIN. This supersedes the earlier mandatory-duration wording for M8 standalone offers. ADMIN chooses DURATION, TERM_END, YEAR_END or UNTIL_REMOVAL explicitly. UNTIL_REMOVAL stores a null expiry, not a fabricated distant date. Existing paid terms are immutable; later offer changes apply only to new purchases. Indefinite access dominates finite grants, produces no subscription-expiry notification and must not trigger expiry-based playback termination. Publication/archive/deletion protection and the external DRM API-only boundary still apply. Packages retain the previously approved one shared ADMIN-set deadline.

The owner also confirmed: SECOND_SECONDARY has terms 1 and 2; packages may contain unpublished monthly courses with clear presale labels and no viewing before publication; overlapping ownership warns without blocking package purchase; repeat standalone purchases with a fixed deadline are permitted only when they add access. Existing indefinite access prevents redundant standalone payment. These answers resolve the corresponding pending owner questions; historical proposals remain historical.

Acceptance: nullable-expiry migration preserves finite records; guarded offer creation/edit, one debit and idempotent replay; immutable indefinite purchase snapshot; indefinite entitlement despite expired finite rows; no expiry notice or termination; unpublished package purchase without content leakage; fixed-deadline extension/no-extension cases; bilingual admin/student access labels.

## M9 owner clarifications — IDE and assessments (2026-10-01)

Owner testing correction (same date): prevent another standalone course charge while the student already holds active course access, including package-derived and indefinite grants. Exact idempotent receipt replay remains available; a new purchase after expiry starts immediately. This supersedes the earlier active duration renewal and fixed-deadline extension purchase policy for standalone courses; explicitly approved overlapping package sales are unchanged. Preserve historical financial records. ADMIN exercise code is private by default; sharing starter source requires an explicit choice. Numeric console output `2` must match `console.log(2)`; correctness is still behavior-based, not source matching. Submission browsing must use bounded paginated summaries and selected-answer detail. See the M9 contract and follow-up report for implementation/evidence.

**Current authority:** the owner later instructed complete direct implementation and approved all first-release contract questions. [The implementation contract](m9-implementation-contract.md) supersedes the planning-only restriction and pending contract paragraphs below. Approved: all checks/questions pass, no deadlines/timers, multiple independently edited assessments per lesson, private behavior tests/safe feedback, earned passes survive edits, server drafts, 180-day submission history, course-owned code/draft deletion, browser previews plus isolated Docker checking with external network/libraries disabled. Accepted official code-error Runs count; duplicate/denied controls do not; lower custom limits leave zero. The owner additionally approved grading-only Docker-default seccomp adjustments for clone/clone3/unshare/setns and chroot, without new capabilities or changes to platform/DRM containers. These decisions authorize this local implementation, not production/capacity certification or immediate commit/push. See [runbook](m9-docker-runbook.md) for exact isolation controls and [report](m9-implementation-report.md) for evidence. Earlier planning paragraphs below are historical.

Planning only: the owner explicitly said not to implement yet. The [M9 manager plan](m9-ide-assessments-manager-plan.md) contains the draft contracts, use cases, recommendations and implementation gates.

Confirmed: one reusable IDE serves standalone subscriber practice and quiz/assignment solving; runtime includes normal browser JavaScript, HTML, CSS and DOM manipulation; ADMIN can add exercises in the video/lesson authoring workflow. Standalone practice has a daily limit. Choosing Solve on an assignment/quiz opens that context in the shared IDE; submission must show automatic correct/incorrect feedback. The previous manual-review-first recommendation is superseded.

Subsequent owner answers, same date: count standalone practice Run clicks per student per day and reset at midnight Cairo time; assignment/quiz solving is exempt from this allowance. ADMIN defines expected outputs and DOM checks, with no source-text, pattern or model-snippet comparison. Practice requires subscription to at least one course rather than a special category of eligible courses. Exercise retries are unlimited until the answer is correct, for educational purposes; no finite attempt cap is authorized.

Further owner answers, same date: default practice allowance is **50 Run clicks per Cairo day**. ADMIN must be able to change the allowance for specific students and reset the student's allowance/time. Standalone practice requires **at least one currently active course subscription**, including indefinite access; once no active subscription remains, practice is locked. Quota adjustments do not grant course access or change wallet/exercise attempts.

Final quota answers in this exchange: ADMIN reset starts a **new 24-hour period for that student**, rather than retaining the next Cairo-midnight boundary. The owner subsequently confirmed **continue resetting every 24 hours**: successive windows remain anchored to that reset instead of reverting to midnight. A student-specific custom allowance persists until ADMIN changes it or restores default 50. No intervening midnight reset is applied. This is an explicit exception to normal Cairo-calendar reset, not an authorization to change every student's schedule. Restoring default changes the limit; no schedule-restoration action is inferred.

Further answers: quizzes must support **coding and multiple-choice**. The owner accepted the recommended **Checking state and bounded, fair grading queue while the IDE remains usable**, and explicitly requires architecture planning for 10,000 simultaneous IDE users. No numeric grading SLA, execution worker count or paid environment is approved. The owner separately confirmed **lock the next lesson until assessments are passed**; this supersedes the earlier optional-progression recommendation and requires backend prerequisite checks in addition to existing entitlement/publication rules.

Progression follow-up: the owner chose **ADMIN marks assessments required or optional**, rather than every published assessment being mandatory. Only required assessments block progression. The owner also confirmed **preserve already reached lessons for existing students at launch**, applying new requirements to progression afterward. Preservation does not bypass subscription expiry/publication or fabricate assessment grades. The exact reached-lesson evidence and rollout snapshot need a technical contract.

Still unanswered: allowed override bounds, lower-limit/restore-default details and failure/refund reservation behavior; visibility/aggregation of tests, numeric scoring and partial success; deadlines/timers and post-correct behavior; course ordering, required/optional creation default, rollout evidence and later content-edit transitions; draft/history retention; exercise placement/multiplicity and external libraries/network capabilities. No passing percentage or additional policy is inferred.

The [architecture and capacity review](m9-architecture-and-capacity-review.md) proposes local isolated previews, durable submission/outbox processing and an independently scalable trusted grading execution pool. Existing one-Express business architecture remains mandatory. Runtime isolation, quota durability, topology and measured grading objectives require a reviewed contract; this proposal does not certify 10,000-user capacity or authorize deployment/load spending.

Automatic checking must not trust a client-provided success flag or execute student code inside Express. The concrete isolated grading runtime and daily quota design remain proposals requiring contract/architecture review before implementation; this feature request does not authorize a new business backend or DRM edits. Acceptance will require reusable web execution, approved quota behavior, entitlement/privacy, immutable/idempotent submissions, actual correct/incorrect checks including DOM behavior, service-error distinction, and isolated Docker cleanup. No code, migration, execution service or worker is started by these clarifications.


Owner JavaScript-only follow-up (2026-10-01): defer HTML/CSS editing and visible DOM preview for now. The reusable IDE exposes JavaScript only and places a substantially larger console in the former preview column. New ADMIN checks use console/function results; preserve historical source/revisions and explicit legacy-rule removal. This supersedes the HTML/CSS UI portion of the initial M9 contract, without accepting the milestone or changing external DRM/production boundaries.


2026-10-02: owner requested easier ADMIN coding quiz/assignment authoring with explicit output-value types and clearer check selection. The delivered UI uses typed value/input controls and nested object/array builders over the existing private console/function contracts. Console remains displayed-text comparison; strict typed/structured answers use function returns. No grading-policy change or automatic conversion of existing revisions is inferred.




## Website UX and account follow-up (2026-10-02)

The owner explicitly requested implementation of all recommendations in [the UX review](ux-review-20261002/report.md), including optional features after collecting decisions. Password recovery remains through admin assistance until a delivery provider is ready. Account editing permits display name and password only; password changes require the current password and sign out other sessions. Login email and phone remain unchanged. Support contact details will follow. Prepare bilingual terms/privacy/refund drafts for owner review, clearly labelled and never presented as adopted policies. No legal entitlement, refund deadline, support address, identifier-verification process or admin password-reset process is inferred. The existing one-backend, cookie-session, two-role and external DRM boundaries remain. This does not constitute milestone acceptance or authorize commit/push.

## Input/output problem follow-up (2026-10-02)

The owner approved the proposed Codeforces-style JavaScript input/output workflow. New coding questions default to PROGRAM: public bilingual input/output descriptions and samples, a separate private reference solution, and integer-range or isolated custom input generation. Students use readline() and console.log(); local sample input never controls official grading. Save → prepare in restricted execution → review → publish freezes generated cases. The reference must match public samples and give identical output on two executions per input. Every frozen case must pass. Whole-output comparers are whitespace-separated tokens, normalized exact text or strict JSON. Existing CODING/function/console and CHOICE questions remain compatible, with unchanged passes/history/privacy/quota/progression. See [the input/output guide](m9-input-output-guide.md). This authorizes bounded local implementation, not DRM changes, deployment, capacity qualification or milestone acceptance.

## Editable support contact follow-up (2026-10-02)

The owner supplied aliibrahim3600@gmail.com and 01062419263 and explicitly requested both be changeable. Public support contacts may be persisted in platform PostgreSQL and edited by ADMIN with existing cookie/origin/CSRF protections. This does not change login identifiers, introduce provider-backed recovery, adopt legal/refund drafts, accept a milestone or authorize commit/push.

## Dashboard/navigation follow-up (2026-10-02)

The owner selected the unified workspace and explicitly requested a reference-style four-item mobile dock, a retained desktop top navbar, and Profile opening the role-appropriate dashboard with sidebar navigation. Student learning and personal profile/security belong in one workspace; ADMIN retains every existing management destination and its personal profile. Standalone form submit/page-action groups are centred in Arabic and English, including profile saves/logout, rather than only login. Contextual row/editor/navigation controls remain attached to their context.

After dispatching the prepared OpenCode prompt, the owner stopped OpenCode and assigned this agent to complete its actual changes without waiting for further input, then explicitly requested all website changes on localhost:8080. This authorizes bounded local completion, Docker verification, guarded preview update and restoration of unchanged local runtime dependencies; no DRM source edit, new backend/schema policy, owner data rewrite, milestone acceptance or commit/push is inferred. See [the completion report](dashboard-navigation-20261002/worker-report.md).

## Bounded device recovery owner authorization (2026-10-04)

The owner explicitly answered **yes** to the quoted [bounded DRM recovery assignment](course-video-device-limit-20261004.md), then requested an improvement search. This permits only the external application's protected tenant-scoped device inspection/inactive ACTIVE registration release API, concurrency/audit regressions, named local synthetic-account recovery through that API and Docker/browser verification. Preserve active playback, revoked-device bans, configured limits, existing data and the API-only persistence boundary. No production deployment, unrelated DRM maintenance, feature-agent launch, acceptance or commit/push is inferred. [Outcome and recommendations](course-video-recovery-20261004.md) distinguish verified playback from browser-harness cleanup failures and additional proposed work.

## IDE modes clarification — 2026-10-04

Owner approved three independent IDE tabs/categories: HTML/CSS/JavaScript,
JavaScript and Python, sharing the existing practice allowance. Python uses
input()/print() problems, private reference solutions/generated tests, no
external packages/network initially and isolated Docker execution. Existing
exercise exemptions, unlimited retries, admin limit/reset controls and required
or optional progression remain. See ide-modes-implementation-20261004.md.

## Student registration details — 2026-10-04

The owner required national ID for new students and rejected duplicate IDs, then approved the recommended required guardian phone, school year and governorate, optional school name and existing full-name field. Historical accounts retain access with voluntary completion; students edit contacts/education and ADMIN corrects existing national IDs. Shape validation is not official identity verification. See [the contract and evidence](student-registration-data-contract-20261004.md). No DRM maintenance, deployment, capacity certification, milestone acceptance or commit/push is inferred.

Owner follow-up (2026-10-04): school-year choices and new/update API validation are restricted to SECONDARY_1 (أولى ثانوي) and SECONDARY_2 (تانية ثانوي). Existing saved records are not rewritten or used to block historical access.

## Published-course lesson additions — 2026-10-05

The owner answered **yes** to allowing ADMIN to add lessons to published courses. This supersedes the draft-only guard for appending lessons and their initial recorded-video upload workflow. Existing lessons and the course remain published while new media processes; student playback still requires READY media and the existing subscription/progression checks. Existing section editing, lesson renaming/reordering, media replacement, archive/deletion protections and PROCESSING/READY lifecycle guards retain their prior rules. No DRM internals, new schema, production deployment or commit/push is authorized by this clarification.
