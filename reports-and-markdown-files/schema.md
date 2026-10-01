# Conceptual schema

M8 current update, 2026-10-01: confirmed D27 is implemented as academic course fields, CoursePackage/PackageMember, immutable PackagePurchase/PackagePurchaseItem snapshots, and explicit AccessMode (DURATION/TERM_END/YEAR_END/UNTIL_REMOVAL). Subscription expiry is nullable only to represent indefinite access. Package grants retain a shared finite deadline. The older conceptual table below describes the pre-M8 baseline; the owner clarification at the end governs current access. Migrations 10 and 11 are additive; old purchases remain unchanged.

DRAFT model updated with confirmed decisions; not executable Prisma or migration SQL. Prisma owns only platform tables.

| Entity | Responsibility and confirmed fields/concepts | Pending details |
| --- | --- | --- |
| User | Identity; exactly STUDENT or ADMIN; unique normalized email and phone; password hash; basic display name and timestamps | Email/phone verification, recovery and retention are outside M2 |
| AuthSession | Server-side session/family validity; refresh-token hash/rotation state; access-token session binding; 30-day absolute expiry; revocation/reuse metadata and timestamps | Device naming and session-history retention |
| Course | Programming course; required Arabic/English title/description; DRAFT, PROCESSING, READY, PUBLISHED and reversible ARCHIVED lifecycle | Permanent deletion coordinates with the accepted external DRM deletion API |
| CourseSection / Lesson | Course → ordered sections → ordered lessons; mandatory translated labels/content; one opaque external DRM video asset per lesson | Asset replacement/versioning |
| SubscriptionPlan | Course/package, current EGP price, positive integer duration in days, optional higher previous price for visual marketing | Purchase-time snapshot and plan edit policy; starts at purchase |
| Promotion | No promotion engine in M3; optional previous/current plan price display only | Coupon, scheduling, eligibility, stacking and accounting policy remain future decisions |
| Wallet | Student EGP account/balance | Approved numeric bounds |
| RechargeRequest | Student request, amount, transfer reference/proof, review state, reviewer and review time | Evidence fields, deduplication scope, rejection/resubmission |
| WalletEntry | Durable EGP credit/debit and source reference | Reversal/refund policy |
| Purchase | Student/plan and trusted purchase terms | Renewal/cancellation rules |
| Enrollment / Entitlement | User/course access and fixed validity interval | First/expired purchase starts immediately; active renewal extends from current expiry; purchased terms are snapshotted |
| MediaMapping | Lesson to external application/asset IDs and observed readiness | Permanent removal uses the accepted external delete operation and retained status reference |
| PlaybackReference | External session reference bound to student/entitlement | Retention and termination reconciliation |
| LessonProgress | Student lesson progress | Completion definition |
| AuditEvent | Actor, action, target, time and outcome | Retention/redaction policy |
| NotificationEvent / NotificationAudience | D25/R17 committed intent and frozen recipients; unique event key; four approved types; creation plus 180-day expiry; tokened event lease and atomic per-recipient progress | Package 04 supplies bounded producer/fanout/cleanup work; final restart/replica qualification remains pending |
| Notification / NotificationInboxState | Recipient-owned read state; unique event/recipient and recipient/sequence; monotonic lastSequence/revision; safe presentation; coalesced durable deliveredRevision and tokened signal retry | HTTP APIs, bilingual inbox and minimal realtime signals implemented; recipient receipt is not inferred from signal publication |
| NotificationRollout / NotificationExpiryMarker | Activation timestamp suppresses historical backfill; last effective expiry per student/course survives notice cleanup | Minimal source metadata, not retained message text; no FK into the removable course |
| Course.firstPublicationAt / RechargeRequest.notificationRecordedAt | Immutable application source markers committed with the authoritative source transaction; existing source history baselined in migration | Prevent regenerated publication/recharge notices after retention cleanup; do not change money or catalog lifecycle policy |

## Proposed constraints for final schema review

- Precise EGP amounts; integer piastres are the recommended representation, with explicit bounds and safe API serialization. Never floating-point wallet arithmetic.
- Admin approval of a pending recharge, its wallet credit and its audit evidence commit atomically. Unique source reference prevents a request credit from appearing twice; actual transfer duplicate detection requires agreed reference rules.
- Wallet debit, purchase and entitlement commit atomically under concurrency-safe balance checks. Stable idempotency keys reject mismatched retries.
- Snapshot trusted price/duration at purchase as a proposed protection against later plan edits. Do not hard-code 30 days or assume lifetime access.
- Subscription validity uses server time and persisted start/end timestamps with confirmed integer-day duration. First/expired purchase starts at successful purchase; active renewal anchors at the current expiry. Later plan edits do not rewrite the purchased snapshot.
- Both translations are mandatory at publication. Schema representation (paired fields or translation table) remains an implementation design choice to document; it does not imply translated video tracks.
- Plan duration is a positive bounded integer number of days. Optional previous-price display is valid only when enabled and strictly higher than the current price.
- Archive is reversible. Never claim permanent deletion or delete only platform rows while external video objects remain; complete deletion must coordinate through a supported external DRM API and fail safely on partial errors.
- Validate course/lesson/media relationships before issuing external playback authorization.
- Protected lesson-list endpoints enforce entitlement regardless of frontend route visibility.
- No cascading deletion of financial history without explicit retention policy.
- Choose indexes from query paths: active entitlement lookup, course lesson order, pending review queue, wallet history, idempotency references and expiry/session reconciliation.
- Normalize email and phone before uniqueness checks; accept either identifier at login without exposing which accounts exist. Store only password hashes and refresh-token digests, never plaintext credentials or reusable raw tokens.
- Public registration fixes role to STUDENT. The bootstrap path creates the first ADMIN only when no admin exists; later admin creation is an authenticated ADMIN operation.

## External DRM

Do not model DRM keys, internal sessions, migrations or watermark tables in Prisma. Platform references are opaque external IDs, with no cross-database foreign keys. Store video metadata/status/references in platform PostgreSQL; binary media goes through the external service to object storage.

## Owner clarification — optional course expiry (2026-10-01)

The owner explicitly clarified that a course may remain accessible after purchase without any expiry, until permanent removal by ADMIN. This supersedes the earlier mandatory-duration wording for M8 standalone offers. ADMIN chooses DURATION, TERM_END, YEAR_END or UNTIL_REMOVAL explicitly. UNTIL_REMOVAL stores a null expiry, not a fabricated distant date. Existing paid terms are immutable; later offer changes apply only to new purchases. Indefinite access dominates finite grants, produces no subscription-expiry notification and must not trigger expiry-based playback termination. Publication/archive/deletion protection and the external DRM API-only boundary still apply. Packages retain the previously approved one shared ADMIN-set deadline.

The owner also confirmed: SECOND_SECONDARY has terms 1 and 2; packages may contain unpublished monthly courses with clear presale labels and no viewing before publication; overlapping ownership warns without blocking package purchase; repeat standalone purchases with a fixed deadline are permitted only when they add access. Existing indefinite access prevents redundant standalone payment. These answers resolve the corresponding pending owner questions; historical proposals remain historical.

Acceptance: nullable-expiry migration preserves finite records; guarded offer creation/edit, one debit and idempotent replay; immutable indefinite purchase snapshot; indefinite entitlement despite expired finite rows; no expiry notice or termination; unpublished package purchase without content leakage; fixed-deadline extension/no-extension cases; bilingual admin/student access labels.
