# Course editor repair and Docker cleanup — 2026-10-05

The owner reported an unexpected error when selecting **Add lesson**, then asked to check and try the related actions. The owner also explicitly approved clearing unused build cache across projects, briefly stopping Docker, and compacting its disk while preserving databases and uploads.

## Finding and changes

The affected local course is PUBLISHED. Its Add lesson request returned HTTP 409 with `COURSE_NOT_DRAFT`. The existing backend permits structural editing only for DRAFT courses, but the frontend offered those controls and had no translation for that response.

The frontend now explains the existing restriction in Arabic and English and disables section/lesson creation, rename, ordering and video upload when the server would reject them. Archive and pending-deletion reasons follow the server's precedence. Video status synchronization remains available. Material and assessment permissions remain governed by their existing APIs. No publication policy or backend permission was changed.

Section/lesson forms validate required bilingual fields and the server's 300-character limit. Reordering prevents duplicate submissions while saving. Catalog error responses now have bilingual explanations, including media, readiness and deletion failures. The wallet balance display avoids accidental text selection highlighting.

## Verification

Development and verification used Docker:

- Final frontend build and typecheck passed; 172 frontend tests and two DASH compatibility checks passed.
- Current-source backend test image: 271 unit tests passed.
- All 12 catalog integration files: 53 tests passed.
- Private file-storage regression suite: 24 tests passed with real isolated PostgreSQL, Redis and MinIO. Coverage includes bilingual captions, resources, protected download authorization, session refresh, replacement and cleanup.
- Final real-browser course editor flow: **37 checks passed**, with no browser runtime errors. This exercised published-course restrictions and real backend rejection; Arabic mobile layout; course/section/lesson creation; bilingual validation; renaming and ordering; course details; price creation/edit/removal; publication readiness/refusal; archive/restore; opening/canceling JavaScript, web and Python assessment editors; exact deletion confirmation; and permanent deletion of synthetic lessons, sections and course.

The browser fixture intentionally has no material storage and verifies clear storage-unavailable/retry feedback. Successful material upload/download coverage is supplied by the real MinIO integration suite; this report does not claim successful browser uploads or a new real-video playback qualification. The browser exercise opens/cancels assessment editors; it does not certify every assessment grading workflow.

Disposable course-editor containers, network and volumes were verified absent after every run. The temporary frontend/server/browser test image tags were removed after checking that no container referenced their image IDs. Evidence remains in the ignored local Docker evidence directory.

The running local client and proxy were refreshed. Both `http://localhost:8080/` and `/api/health/ready` returned 200. Retained platform, material storage and external DRM services remain running.

## Docker disk result and remaining limitation

Earlier cleanup removed 45 explicitly identified unused test/old runtime image tags. Runtime, grading, rollback images, stopped owner containers, databases and uploads were preserved. The approved initial build-cache cleanup reported 29.66 GB reclaimed inside Docker. The final post-verification cleanup reported another 1.04 GB; build cache is now **0 B**. Trimming reported 35.1 GiB initially and 81.8 MiB after final cleanup.

The Windows file `C:\Users\pc\AppData\Local\Docker\wsl\disk\docker_data.vhdx` still measures **53,915,680,768 bytes (50.2 GiB)**. Windows disk compaction could not finish: the initial attempt required administrator access and the subsequent Windows elevation prompt was canceled. Docker was restarted. Logical cache reclamation is not a verified reduction of this Windows file, and physical disk cleanup remains incomplete. Final measured C: free space was 76,043,587,584 bytes.

Final Docker inventory: 11.86 GB images, 241.5 MB volumes, 5.616 MB container data, and zero build cache. Remaining reclaimable images/volumes include retained rollback and stopped-owner resources; they were not deleted.

## Delivery boundaries

The requested pull advanced main from `220d60b` to `0bb73a6`; pre-existing local edits were reapplied and preserved. The safety stash remains. This work is uncommitted; no push, production deployment, nested DRM edits or milestone acceptance was performed.
