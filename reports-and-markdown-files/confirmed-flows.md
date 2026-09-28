# Confirmed product flows and pending details

Source: owner D01-D12 answers and follow-ups, 2026-09-27. Proposed implementation controls are distinguished from remaining business choices.

## Manual EGP recharge

1. Student submits a recharge request with the agreed transfer reference/proof and EGP amount.
2. Request remains pending and wallet balance is unchanged.
3. Admin verifies actual receipt through the approved manual channel.
4. Admin approves the request; platform credits once and records request, amount, reviewer, time and audit evidence.
5. Student can use the credited wallet to purchase a course. Approval itself does not authorize an unrequested automatic purchase.

Proposed states: PENDING, APPROVED, REJECTED. Rejection reasons, resubmission and corrections require policy confirmation. Concurrent/repeated approval must be idempotent. Never let a student mark a request approved, set credited amount authoritatively or reuse proof to obtain duplicate funds.

## Purchase and access

Public course offers include EGP price and admin-configured duration. Backend validates price and balance, then atomically debits and creates the purchase/access record. Insufficient balance cannot grant access. Duration begins immediately at successful purchase. Duration units and early renewal rules remain pending; do not infer them.

Subscribed students see course segments/lessons and can request playback. Expired students see unsubscribed / needs renewal. Backend denies protected listings and new playback after expiry; active playback is stopped using frontend state and the external termination API. Test external enforcement, including direct renewal, and report any unsupported behavior.

## Admin video lifecycle

Admin creates a bilingual programming course, ordered sections and ordered lessons, with one external DRM video per lesson. Plans use a current EGP price, an integer duration in days, and may optionally show a higher previous price as a visual marketing offer. The course follows DRAFT, PROCESSING, READY and PUBLISHED states; ARCHIVED is reversible. Only PUBLISHED courses appear publicly.

The admin uploads each original video using the external DRM API's prescribed sequence. DRM owns processing, watermark/security and storage handling. Platform persists lesson/media identifiers and readiness in its own PostgreSQL and only enables publication when both translations exist and every required external asset is ready.

Production storage is Cloudflare R2, configured through external DRM. Local Docker verification uses an S3-compatible substitute; live R2 verification remains blocked pending credentials. Do not build a second pipeline or upload raw video blobs into platform business tables. Archive/unarchive changes platform visibility and is reversible. Permanent deletion must remove platform content and external stored media through the independently accepted DRM deletion API; it must never be imitated by deleting only platform records.

## Authentication and language

Platform authentication/session tokens use cookies, never local storage. HttpOnly and production Secure cookies plus CSRF/session controls are required implementation safeguards. A DRM playback token returned for player requests is a separate transient credential, not the platform login cookie.

Arabic is the primary/default interface, English secondary. Both content translations must be present before publication. Recorded programming lessons are in scope; live teaching is excluded.
