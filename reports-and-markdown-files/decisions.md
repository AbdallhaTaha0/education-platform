# Decision register

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
