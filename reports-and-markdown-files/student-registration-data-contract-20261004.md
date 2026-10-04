# Student registration details — implementation contract and report

Status: owner-approved requirements implemented locally on 2026-10-04; no milestone acceptance, commit, deployment or capacity certification implied.

## Approved behavior

New STUDENT registrations require full student name (the existing name field), national ID, parent/guardian phone, school year and governorate. School name is optional. Egyptian national IDs are 14-digit strings; Arabic-Indic and Persian digits normalize to ASCII. This is format validation, not government identity verification. No birth-date/gender inference, document upload or age eligibility rule was added.

Existing accounts keep their access and can complete details voluntarily. Students can edit their guardian and education details, and provide an initially missing national ID. Only ADMIN can correct an existing national ID. Guardian numbers may be shared by siblings and may equal the student number; existing international-capable phone normalization is preserved. No guardian account or automatic messaging is introduced.

## Persistence and privacy

The additive 20261004180000_student_profiles migration creates a nullable one-to-one StudentProfile relation without fabricating old student or ADMIN data. New user, profile and session creation is atomic. A database unique constraint on the keyed normalized-ID fingerprint rejects duplicates, including concurrent requests; failures leave no partial user/session.

National IDs use AES-256-GCM with random nonces and user-bound authenticated data. A separate HMAC-SHA256 index key supplies equality lookup. Plain IDs and unkeyed hashes are not stored. Responses return only the masked last four digits. Generic auth/session responses, JWTs, DRM assertions and browser storage do not receive these details. Private profile edits and ADMIN views are audited without field values. Updates require a version to prevent stale overwrites; authorization, session validity, origin, CSRF and rate limits remain enforced.

## API and UI

- GET/PATCH /api/auth/student-profile: the authenticated student's own details.
- GET/PATCH /api/admin/students/:studentId/profile: ADMIN-only selected student details.
- Registration sends required details through the existing registration API.

Arabic and English forms share validation and localized errors. ADMIN opens details on demand inside the paginated student directory. Stored national IDs are masked; the ADMIN replacement field is blank and leaving it blank preserves the current ID. Failed submissions keep form values, and changing students with unsaved edits asks for confirmation.

## Configuration and recovery

STUDENT_DATA_ENCRYPTION_KEY_B64 and STUDENT_DATA_INDEX_KEY_B64 must be distinct canonical Base64 32-byte keys. They remain in the ignored local .env and are passed only to the backend. docker/verification/configure-student-data.mjs generates missing keys inside a network-disabled Docker container, stores them without printing values and refuses to replace saved keys or a half-present pair. It is a local configuration helper, not a production provisioning tool.

Back up both keys securely alongside database recovery material. Losing the encryption key prevents decrypting stored IDs; losing/changing the index key breaks duplicate equality with old records. Never rotate either by merely changing environment values. A separate controlled rotation procedure must decrypt/re-encrypt and rebuild every fingerprint atomically with uniqueness validation before adopting new keys. That procedure is not implemented or authorized here.

If both keys are absent, historical login/access remains available but new registration and national-ID writes fail closed with 503. Invalid/partial key configuration refuses startup. Keep registration disabled during any rollback to an older serving image that lacks the required-field policy. The additive table can remain during a serving rollback; do not drop it or restore an older database over new registrations.

## Docker verification

- Backend app/test typecheck passed.
- Server unit suite: 271/271 passed, including normalization, authenticated encryption, unique fingerprints, key configuration, contact validation and log redaction.
- Real PostgreSQL/Redis identity integration: 51/51 passed, including missing fields, normalized duplicate races, atomicity, shared guardian numbers, legacy access/completion, stale versions, ADMIN-only corrections and value-free audits.
- Chromium through Nginx: 16/16 passed, including registration, Arabic digits/RTL, masked details, edits, duplicate feedback, legacy access, ADMIN correction, browser-storage privacy and zero browser errors.
- All disposable verification resources were cleaned after failures and success. No owner users or real IDs were used as fixtures.

Local preview application uses the retained-volume guard, a protected database dump, comparison of all pre-existing tracked table columns/row fingerprints, repeated migration and readiness verification. Rollback images carry before-student-details-20261004 tags. DRM source and runtime are outside this change. Detailed transient evidence and backups are ignored under docker/browser/evidence/ide-modes; they must not be committed.

## Local preview result

The guarded localhost:8080 upgrade completed with all 23 pre-existing table fingerprints unchanged, a protected pre-upgrade dump and repeated migration success. A read-only Chromium check of the retained preview confirmed all four new required detail fields, optional school name, readiness 200 and zero page errors. Test containers/volumes and the transient preview probe were absent after cleanup. Nested DRM working tree remained clean. Local encryption/index keys were generated into the ignored .env without printing values. Nothing was committed or pushed.

## School-year follow-up

Owner restricted school-year choices to أولى ثانوي / First secondary and تانية ثانوي / Second secondary. Registration and student/ADMIN editing share these options; the backend rejects other newly supplied years. Historical stored values and account access are preserved. No schema migration is needed.

Follow-up verification: both accepted values and four excluded school-year categories checked in network-disabled Docker; 16/16 isolated registration/profile browser checks passed and owned resources cleaned. Retained localhost:8080 browser confirmed the two exact Arabic labels, zero page errors; all 24 pre-existing table fingerprints remained unchanged during guarded preview update. No new migration, DRM edit or commit.
