# Course learning enhancements — proposed for owner approval

**Owner-authorized completion (2026-10-04):** This planning/dispatch record is historical. The owner later instructed the coordinator to finish pending work and push both repositories. Search, truthful durations, bilingual captions and protected resources are now implemented and integrated; see [final delivery and verification](course-materials-and-dual-repository-delivery-20261004.md).

Status: **PENDING APPROVAL**, 2026-10-04. These four enhancements are a proposal, not implemented features. The curriculum/progress/fullscreen changes are already available on the retained local preview; see [their report](course-ux-20261004/report.md).

## Proposed student experience

| Feature | Proposed behavior | Acceptance evidence |
| --- | --- | --- |
| Lesson search | Search lesson and section titles inside the protected curriculum. Match Arabic and English, ignore case and Arabic diacritics, expand matching sections, show result count, clear action and an empty state. Keep the selected lesson and progress visible. | Arabic/English searches, locked matches remain locked, no autoplay or progress changes, keyboard and mobile checks. |
| Accurate durations | Show actual processed video duration beside each lesson, plus section/course totals when every duration is known. Show a partial total when some are unknown; never invent a duration or present a partial total as complete. Use m:ss or h:mm:ss, round consistently to the nearest whole second. | Compare against external DRM status duration and actual player metadata, including subminute, hour-long, fractional and unknown values. |
| Captions | ADMIN uploads validated Arabic and English WebVTT tracks. When captions are supplied, both translations are required before making them available. Player offers Arabic, English and Off, works in fullscreen, and reports loading errors accessibly. Caption availability is optional per lesson; videos without captions remain playable with a clear availability label. | Cue timing/format/size checks, bilingual selection, fullscreen/mobile playback, access revocation and safe text rendering. |
| Protected resources | ADMIN adds bilingual labels to lesson attachments. Authorized students download from the lesson through authenticated backend routes. Check subscription, publication and lesson unlock each time; prevent public links, path traversal and caching of protected responses. | Unauthorized/expired/locked refusal, working authorized download, size/type validation, replacement/deletion and cross-course isolation. |

## Architecture and boundaries

- Keep `client/` and the single modular Express `server/`; keep STUDENT and ADMIN only, cookie authentication, CSRF and current required/optional assessment progression.
- Search uses only the curriculum already returned after authorization. It creates no public lesson index and exposes no private assessment data.
- Read video duration through the external DRM's existing tenant-scoped status API. Validate and persist a nullable duration on the platform media mapping during synchronization; do not read DRM persistence or modify the nested DRM package. Backfill existing mappings through that API without replacing videos or resetting progress. Unknown duration remains unknown; record upstream mismatches for ADMIN review.
- Proposed captions/resources storage: private platform-owned object storage, isolated from DRM-owned video objects. Bucket/prefix, credentials and limits remain server-side. This needs local configuration and Docker storage verification before release; creating paid provider infrastructure is not authorized by this plan.
- Proposed tables store lesson association, bilingual labels, safe MIME, byte size, opaque storage key and lifecycle state. Captions also store language, validation state and cue metadata. Uploads remain unavailable until validated; attachments are not embedded in the public course offer. Use transactional metadata updates and durable cleanup for owned objects.
- Proposed initial attachment allowlist: PDF, ZIP, TXT, JS and JSON, maximum 10 MiB per file; WebVTT maximum 1 MiB. ZIP is downloadable only and never extracted or executed. Validate MIME/content consistency and filenames; use attachment disposition and no sniffing. These limits/types are proposed owner choices, not established policy.
- Serve resources through entitlement-checked backend downloads with `Cache-Control: private, no-store`; no permanent public URLs. Fetch captions after the same access checks and create short-lived browser Blob URLs, revoked on lesson change/unmount/access loss. Previously downloaded files cannot be remotely recalled; download protection controls new access and does not provide video-style DRM for files.
- Archiving hides access and preserves objects. Permanent course removal includes durable cleanup of platform-owned captions/resources only, using the existing removal workflow. Replacements must not reset student passes/progress; do not invent financial or submission retention policies.

## Delivery sequence after approval

Owner follow-up, 2026-10-04: prepare **two OpenCode prompts to run concurrently**. No worker is launched merely by this planning request. Feature approval/dispatch remains explicit. Use [agent 1: backend](course-learning-agent-1-backend-prompt.md) and [agent 2: frontend](course-learning-agent-2-frontend-prompt.md), governed by the [shared API and file-ownership contract](course-learning-parallel-contract.md). Backend owns all migrations; frontend can build typed clients and labelled test mocks immediately. Final real-API integration and retained-preview update are sequential after both handoffs.

The owner also reported nonworking demo videos. [Playback diagnosis and scoped recovery](course-video-device-limit-20261004.md) is a separate defect task; feature prompts must preserve its fixes and do not grant new external DRM maintenance authority.

1. Search and duration synchronization/display: narrow frontend/API changes, additive migration, existing-data preservation.
2. Private storage module and ADMIN upload/validation, captions integration and authenticated resources UI; no new backend application.
3. Docker verification: unit/integration security checks, real-browser Arabic/English and RTL/LTR, dark/light, desktop/mobile, native fullscreen and fallback; test expiry/publication/locked lessons while open. Use disposable test projects and preserve the retained preview and all existing data.
4. Show the owner screenshots, real demo instructions and a report before requesting acceptance. No production deployment, capacity certification, DRM maintenance or commit/push is implied by approving this feature plan.

## Additional recommended polish within this proposal

Include a visible reason for locked lessons and links to required work; caption/resource availability labels; an accessible no-results state; retry actions for failed caption/resource requests. Preserve current resume, next/previous, completion counts and fullscreen behavior. Certificates, chat, live classes, automatic transcription and new payment flows are outside this proposal.

## Separately authorized demo data

The owner requested a real uploaded video, quiz and assignments to try. Populate a **new clearly labelled local demo course**, using existing public/admin platform APIs and the external DRM upload API contract. Preserve existing courses, purchases and progress. Use the selected synthetic student account `m8-final-39b72377-c7fe-42aa-b0c2-126324446131-student@example.test`.

Use a normal 1 EGP test offer, payable by the owner from the account's existing synthetic wallet through the normal subscription page. Do not create fake recharge approvals, grant direct database access, debit the account on its behalf or complete assessments for it. Keep its new course progress fresh. Real processing/preparation results and the demo guide will be recorded separately; captions/resources/search/duration enhancements remain pending approval.

## Approval requested

Approve the four feature rows and the proposed bilingual caption rule, file allowlist/limits and private-storage/download design, or identify changes. Approval authorizes their local implementation and Docker verification within the boundaries above.
