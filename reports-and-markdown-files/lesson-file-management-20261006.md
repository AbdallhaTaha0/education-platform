# Lesson file management restoration — 2026-10-06

The owner reported that every lesson showed “Could not load files” and that ADMIN had no controls for the feature. Investigation found an existing private materials API and component, but the component was no longer rendered by the redesigned course workspace. The retained backend also had all five storage settings absent, no running local object store, and no materials object volume. Existing lesson resource, caption and object-intent counts were all zero, so no attachment recovery or data replacement was required.

## Delivered behavior

- Course administration now has a clearly named **Lesson files & captions / ملفات الدروس والترجمة** tab. Select a section and lesson to manage its files separately from video and assessment controls.
- ADMIN can upload a protected file with mandatory Arabic and English labels, view its filename/type/size, and remove it after confirmation. Existing accepted formats remain PDF, ZIP, TXT, JS and JSON, up to 10 MB. Resource lists keep pagination.
- The same tab exposes the existing optional Arabic/English WebVTT caption pair workflow, including upload/replacement, validation and confirmed pair removal. Both languages remain required together; each file is limited to 1 MB.
- Successful uploads clear both state and native file pickers. Failed uploads preserve form values. Pending operations disable conflicting changes. Unsaved files/labels participate in the existing navigation warning.
- Archived/deleting courses and live courses with a working draft expose a read-only materials view with an explanation. Inherited draft materials retain their existing protection. Backend lifecycle rules remain authoritative; the published-version/working-copy contract is unchanged.
- Student metadata listing no longer requires storage credentials merely to return a PostgreSQL-backed list. An empty entitled lesson returns its true empty state. Uploads and file/caption downloads still require the configured private storage client and fail closed when unavailable. Role, subscription, course and lesson-progression checks remain intact.

## Local Docker storage

Restored the already approved local MinIO fixture design, separate from DRM video storage. `local-storage.mjs` refuses partial/non-local settings, checks ownership of existing network/volume names, requires ignored `.env`, and refuses fresh initialization if attachment metadata or an object volume needs recovery. It generates local credentials only when configuration is absent, keeps them in ignored `.env`, and exposes no host storage port.

Persistent project: `fayq-local-materials`; external object volume: `fayq-local-materials-objects`; external network: `fayq-local-materials`. Ownership label: `fayq.owner=local-materials`. Existing pinned image: `fayq-materials-minio-fixture:20261004`. Credentials are not in tracked files or browser assets. The platform server consumes this private store through its existing S3 adapter. No DRM credentials, source, database or media objects are involved.

The tested server and client were installed using guarded `web-up`, replacing only server, client and Nginx. The private bucket was initialized through the existing signer. No owner lesson files, demo users or fixtures were seeded; schema changes were unnecessary.

## Fresh verification

| Gate | Result |
| --- | --- |
| Backend TypeScript build and test typecheck | PASS |
| Materials validation/service unit tests | 56/56 PASS |
| Real PostgreSQL/Redis/MinIO materials integration | 26/26 PASS |
| Frontend TypeScript/Vite production build | PASS |
| Frontend unit suite | 173/173 PASS |
| Chromium ADMIN → API → private storage → STUDENT flow | 26/26 PASS |

The new backend regression explicitly removes the configured storage client: authenticated empty student/admin metadata still returns 200, anonymous listing returns 401, and uploads return 503 `MATERIAL_STORAGE_UNAVAILABLE`. Existing integration tests also prove entitlement, multipart validation, byte integrity, deletion cleanup and published/working-copy material isolation.

Browser coverage uses real cookie authentication, multipart uploads and storage, with synthetic accounts/course only in disposable services. It verifies the dedicated tab, empty student state, missing-label/file validation, Arabic labels, actual downloaded file bytes, private cache headers, student ADMIN-route denial, anonymous download denial, caption pair upload/removal, resource removal and denied subsequent download, unsaved navigation, Arabic controls and mobile horizontal fit. No DRM video playback is invoked or claimed by this file-management gate.

Harness corrections during verification: debugging-protocol response text capture did not preserve the binary representation of the UTF-8 fixture, so the authoritative check now compares the file actually saved by Chromium; that file matches exactly. The harness now waits for the caption operation to release disabled controls before resource removal, and initializes Arabic correctly on reload. These did not require product download changes. Failed attempts and final logs remain in ignored evidence.

Reproduce with matching current test/frontend images:

```text
node docker/course-learning-backend/run-tests.mjs --materials-only
node docker/ide/modes-verify.mjs --materials-only
```

Both disposable projects were cleaned after successful and failed attempts. Final inventories show zero owned containers, networks or volumes. Logs/screenshots and preservation baseline are retained under ignored `docker/browser/evidence/ide-modes/`.

## Delivery, preservation and rollback

Local preview: `http://localhost:8080`. ADMIN: **Courses → select course → Lesson files & captions → select lesson**. Students access attached files within the selected lesson, subject to their existing access rights.

Installed images: server `sha256:3a9f1cb5722e2c32daf199af91d695eaab7cd055b2ab7b45a04ac7329401d9ad`, client `sha256:92c8443b2591874787c9d40908d96bcd5bb800f9c678c49f9498c07fdcfa9184`, also retained under their `fayq-lesson-files-{server,client}:20261006` tags. Preview/readiness and external DRM health all return 200. Nine protected data, grading, migration and DRM containers retain their identities, image IDs and storage attachments. The storage container is healthy and publishes no ports. A local signed storage byte roundtrip passed, its exact temporary key was deleted and verified absent, and all three owner attachment tables remain empty.

Rollback images: `fayq-platform-server:before-lesson-files-20261006` and `fayq-platform-client:before-lesson-files-20261006`. Retag these to their respective `:0.9.0-m9` aliases and run `node docker/local-preview.mjs web-up` to revert serving code. Keep storage credentials and the persistent object volume: deleting storage would destroy newly uploaded lesson attachments. This task does not authorize such deletion.

No production deployment, new storage-provider decision, capacity qualification, DRM source edit, commit/push or milestone acceptance is implied. Earlier pending assessment and security changes remain preserved.
