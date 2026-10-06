# Permanent caption removal — 2026-10-06

The owner explicitly requested removing captions permanently from both backend and frontend while retaining lesson files. This supersedes earlier caption-pair requirements and the preceding player synchronization's caption-preservation choice. Bilingual course content and file labels remain required.

## Delivered

- Removed student caption selectors, player props/tracks/Blob logic, ADMIN caption uploads/removal, caption translations, API clients and caption-only styling/validation.
- ADMIN workspace is now **Lesson files / ملفات الدروس**. Existing file upload, bilingual labels, validation, pagination, unsaved-change protection and removal remain available.
- Removed caption read/upload/delete API routes, DTOs, services and course-working-copy caption replacement logic. Metadata responses contain lesson-file resources, with no captions field.
- Removed the Prisma `LessonCaption` model, `CaptionState` enum and lesson relation. Existing historical migrations remain unchanged.
- New migration `20261006230000_remove_lesson_captions` first durably records caption object deletion, including missing ledger entries and partial-upload intents, then removes the caption table/type atomically. Resource objects are excluded from prefix cleanup. The resource deletion trigger and retry-safe object reconciler remain.
- Preserved the new bottom player controls/fullscreen, videos, lessons, course publication/working-copy behavior and entitled file downloads. External DRM source/services were not changed.

## Docker evidence

- Populated upgrade and repeated deployment: pass. Synthetic bilingual caption rows disappear, all three known/partial caption intents become DELETE, retained course/lesson/file fingerprints match, and the file-deletion trigger still works. Fresh-schema migration also passes.
- Backend: typechecks, 23 materials unit checks and 20 real PostgreSQL/Redis/MinIO integration checks pass. Removed endpoints return 404; resource bytes, privacy, authentication, CSRF, expiry, progression locks, cascades, retry-safe cleanup and draft publication remain covered.
- Frontend: 166 unit tests pass. The count is lower because caption-only tests were retired; authenticated file/session tests were retained and retargeted to resources.
- Browser: 22 actual ADMIN/student file-flow checks pass: empty states, bilingual labels, upload, download byte equality/private headers, denied unauthorized access, removal, dirty-form navigation, Arabic/mobile layout and absence of caption controls.
- Initial integration run found an outdated test expecting 200 after file creation; corrected to the resource contract's 201, rebuilt and reran green. A read-only baseline script initially had malformed SQL string quoting; fixed before collecting the authoritative baseline. Neither error changed owner data.
- Both isolated Docker projects are cleaned: zero owned containers, networks and volumes. Temporary storage smoke object is removed; no fixtures remain in the owner database.

## Local delivery and preservation

Caption-free server, migration, frontend and grading-controller images were built and installed on the retained port 8080 preview. Server was briefly stopped before migration to prevent old caption handlers accessing a removed table. Existing PostgreSQL/Redis container IDs and all platform volume attachments remained unchanged; private file storage and independent DRM were left intact.

The local database held zero caption records before migration. After deployment the caption table/type are absent and zero caption deletion intents remain. Protected fingerprints match for User, Wallet, Subscription, Course, CourseSection, Lesson, LessonResource, MediaMapping, LessonProgress and Assessment. Actual frontend chunks contain no caption API/control markers, bottom player controls remain, and readiness is 200. Private file-storage PUT/GET/DELETE roundtrip passes after deployment.

Evidence is in ignored `docker/browser/evidence/caption-removal-20261006/`; browser evidence also remains in `docker/browser/evidence/ide-modes/`. Previously pending source changes and staged DRM reference are preserved. No commit, push, deployment or capacity qualification was performed.

## Recovery limitation

This is an intentionally destructive feature-removal migration. Queued caption objects may be permanently deleted; image rollback alone cannot restore caption data or the removed schema. Restoring captions would require an explicitly authorized schema/data restoration from an appropriate backup. Lesson files have not been removed or rewritten.
