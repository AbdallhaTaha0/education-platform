# Shared contract for two parallel OpenCode agents

2026-10-04. Prepared at the owner's request. Feature implementation remains subject to approval of [the plan](course-learning-enhancements-plan.md). Dispatching the two prompts with an explicit instruction to implement this plan supplies that approval. No agent was launched by preparing these documents.

## Ownership and coordination

| Owner | Files and responsibilities |
| --- | --- |
| Agent 1 — backend | `server/`, including the sole Prisma schema/migration owner; new `docker/course-learning-backend/` harness files; `course-learning-backend-report.md`. All business/API/storage/duration/cleanup enforcement. |
| Agent 2 — frontend | `client/`; new `docker/course-learning-ui/` harness files; `course-learning-ui-report.md`. Search, duration labels/totals, ADMIN authoring panels, captions and resource UI. |
| Coordinator/owner | This shared contract, the main plan, README/design updates, shared existing Compose files and retained-preview integration. Neither worker edits them concurrently. |

Both agents can start together against this contract: backend builds real APIs while frontend builds typed clients and explicitly labelled test mocks. Mocks are never a production fallback or evidence that protection works. Agent 2 replaces mocks with real endpoints for final integrated verification after Agent 1's handoff. Do not let either agent replace the retained port-8080 preview while another agent or owner is testing. Final integration is sequential.

Preserve the current dirty tree and the video-diagnosis changes; never reset, stash away, discard or overwrite another worker's files. Same-directory work is permitted only within these ownership boundaries. Separate worktrees are also permitted if their starting point includes the coordinator's full current snapshot, including uncommitted files; do not start from stale HEAD and drop the course/player work. Do not apply duplicate migrations. Use distinct Docker project/container/image names and ports.

## Proposed API contract v1 (frozen at dispatch)

Paths below include the browser `/api` prefix; normal Nginx/backend routing still strips it. All JSON success responses use `{data: ...}`; errors use the existing safe `{error:{code,message}}` contract. Auth remains cookies, Origin and session CSRF for mutations. ADMIN checks, course-removal checks, subscription/publication and lesson-unlock checks remain server-side.

- Existing protected outline lessons gain `durationSeconds: number | null`, a finite nonnegative processed-video duration. Existing fields/IDs and progression stay intact. Missing/invalid upstream durations are null, never guessed; synchronization uses only the external DRM status API. Totals are computed on the client; unknown values distinguish partial totals.
- `GET /api/learning/lessons/:lessonId/materials` → `{lessonId, durationSeconds, captions, resources}`. Authorization includes current lesson access even when there are no materials. Captions/resources list only validated available items. No object keys, provider URLs or hidden assessment data.
- `captions` entries: `{id, language:'ar'|'en', labelAr, labelEn, byteSize}`. The published availability is a pair; neither language appears alone.
- `resources` entries: `{id, labelAr, labelEn, fileName, mimeType, byteSize}`.
- `GET /api/learning/captions/:id` → authenticated WebVTT bytes with `text/vtt; charset=utf-8`, `private, no-store`, no sniffing. Client fetches with cookies into a Blob URL and revokes it on lesson/access/unmount changes.
- `GET /api/learning/resources/:id/download` → authenticated bytes, safe attachment filename, validated MIME, `private, no-store`, no sniffing. Recheck access for each request; no permanent public URL or redirect to private storage.
- `GET /api/admin/learning/lessons/:lessonId/materials` → the same shape plus validation/lifecycle `state` on entries. ADMIN-only inspection may show unavailable items; storage keys remain private.
- `POST /api/admin/learning/lessons/:lessonId/captions` → multipart fields `ar` and `en` (one `.vtt` each), atomically replaces a validated pair. Return current materials shape. Preserve the old available pair on validation/storage failure.
- `DELETE /api/admin/learning/lessons/:lessonId/captions` → `{removed:true}`, idempotently removes availability and schedules owned-object cleanup.
- `POST /api/admin/learning/lessons/:lessonId/resources` → multipart fields `metadata` (JSON `{labelAr,labelEn}`) and `file`. Return `{resource}` with the public metadata shape. No resource is available before validation completes.
- `DELETE /api/admin/learning/resources/:id` → `{removed:true}`, idempotent tenant/course-safe removal and durable owned-object cleanup. Permanent course deletion uses the same owned-object lifecycle; archive only hides access.

Proposed limits from the plan: attachments PDF/ZIP/TXT/JS/JSON ≤10 MiB; WebVTT ≤1 MiB per language. Text labels are nonempty in both languages, bounded at 200 characters; filenames are safe display/download names, never paths. Reject malformed content, excessive bodies, invalid captions, traversal and cross-course access; ZIP is never extracted/executed. Reuse existing authorization error categories; new material validation/storage failures use stable `MATERIAL_INVALID`, `MATERIAL_TOO_LARGE`, `MATERIAL_NOT_FOUND`, `MATERIAL_STORAGE_UNAVAILABLE`. No raw provider diagnostics.

Provider secrets remain server-side. Agent 1 documents exact configuration names and storage fixture; Agent 2 never invents browser credentials. Storage must be private, platform-owned and separate from external DRM objects. Local unavailable configuration produces a clear safe error; it never makes protected data public. Paid infrastructure/provisioning is outside dispatch authority.

Any incompatible contract change must be written up for coordinator review and agreed before editing the other worker's assumptions. Backend optional/additive compatibility is allowed; frontend must tolerate nullable duration and empty materials.

## Final integration gates

Backend handoff: migrations/typecheck/security/lifecycle/private-storage Docker evidence. Frontend handoff: typed contract, bilingual responsive and accessibility evidence with mocked versus real calls separated. Coordinator then runs real combined Docker/browser checks, including actual finite video playback, captions in fullscreen, downloads under allowed/expired/locked access, preserved existing progress and duration comparison. No production deployment, DRM source edit, commit/push, capacity certification or milestone acceptance.

Every worker must clean only its own disposable Docker environment on success, failure or stop, after verifying project labels and resolved mounts. Preserve owner preview/data, nested DRM, reusable images and retained evidence. No global prune.
