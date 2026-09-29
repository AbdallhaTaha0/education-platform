# Confirmed product flows and pending details

Source: owner decisions D01-D21 and follow-ups through 2026-09-29. Proposed implementation controls are distinguished from remaining business choices.

## Manual EGP recharge

1. Student chooses InstaPay, bank transfer or mobile wallet and submits the EGP amount, channel, normalized transfer reference, sender name/phone, transfer date, and a JPG/PNG/PDF proof up to 5 MiB. Destination identifiers and instructions come from validated deployment configuration and are never hard-coded.
2. Request remains pending and wallet balance is unchanged.
3. Admin verifies actual receipt through the approved manual channel.
4. Admin approves the request; platform credits once and records request, amount, reviewer, time and audit evidence.
5. Student can use the credited wallet to purchase a course. Approval itself does not authorize an unrequested automatic purchase.

States are PENDING, APPROVED and REJECTED. A normalized reference is unique across the platform within its transfer channel. Rejection requires an admin reason, is immutable, and resubmission creates a new request. Concurrent/repeated approval must be idempotent. Never let a student mark a request approved, set credited amount authoritatively or reuse proof to obtain duplicate funds. Only ADMIN may open/download proof; the submitting student sees filename, status and scheduled deletion date. Proof bytes are removed 180 days after approval/rejection while sanitized audit metadata remains. Refunds, reversals and correction credits are excluded from M4 pending a later approved policy.

## Purchase and access

Public course offers include EGP price and an integer-day admin-configured duration. Backend validates trusted price and balance, then atomically debits and creates the purchase/access record. Insufficient balance cannot grant access. Price and duration are snapshotted so later plan edits affect only future purchases. A first or expired subscription starts immediately at successful purchase; early renewal of an active subscription extends from its existing expiry. No recurring billing, refund or reversal is implied.

Subscribed students see course segments/lessons and can request playback. Expired students see unsubscribed / needs renewal. Backend denies protected listings and new playback after expiry; active playback is stopped using frontend state and the external termination API. Test external enforcement, including direct renewal, and report any unsupported behavior.

## Admin video lifecycle

Admin creates a bilingual programming course, ordered sections and ordered lessons, with one external DRM video per lesson. Plans use a current EGP price, an integer duration in days, and may optionally show a higher previous price as a visual marketing offer. The course follows DRAFT, PROCESSING, READY and PUBLISHED states; ARCHIVED is reversible. Only PUBLISHED courses appear publicly.

The admin uploads each original video using the external DRM API's prescribed sequence. DRM owns processing, watermark/security and storage handling. Platform persists lesson/media identifiers and readiness in its own PostgreSQL and only enables publication when both translations exist and every required external asset is ready.

Production storage is Cloudflare R2, configured through external DRM. Local Docker verification uses an S3-compatible substitute; live R2 verification remains blocked pending credentials. Do not build a second pipeline or upload raw video blobs into platform business tables. Archive/unarchive changes platform visibility and is reversible. Permanent deletion must remove platform content and external stored media through the independently accepted DRM deletion API; it must never be imitated by deleting only platform records.

## Authentication and language

Platform authentication/session tokens use cookies, never local storage. HttpOnly and production Secure cookies plus CSRF/session controls are required implementation safeguards. A DRM playback token returned for player requests is a separate transient credential, not the platform login cookie.

Arabic is the primary/default interface, English secondary. Both content translations must be present before publication. Recorded programming lessons are in scope; live teaching is excluded.
