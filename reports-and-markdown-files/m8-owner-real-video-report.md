# Owner preview and real video verification — 2026-10-01

Same-agent implementation and verification. No commit, push or production deployment. The owner's latest instruction selects localhost:8080 because existing R2 browser permissions cover 8080/8081. No bucket CORS change was executed.

## Working result

The persistent `m8-owner-preview` now serves http://localhost:8080 with its existing database, accounts, academic catalog and synthetic wallet data preserved. The supplied 2,715,580-byte MP4 was uploaded through the real ADMIN uploader, processed by the independently deployed unchanged DRM service into R2, synchronized READY and published through the platform lifecycle. The student bought the explicitly labelled demonstration course through the normal purchase API for EGP 1 from synthetic funds, with access until removal.

- Student course: http://localhost:8080/#/learn/fayq-owner-real-video-test
- ADMIN course: http://localhost:8080/#/admin/courses/7cc20287-9fd9-4d4a-966b-86c1f9a0ed14
- Title: Real video test — From an idea to a website / تجربة فيديو حقيقي — من الفكرة إلى الموقع

Chromium verified protected student playback with currentTime greater than two seconds and no page errors. The playing screenshot was visually inspected. This is the owner's supplied tourism website demonstration video, not a fabricated academic lesson. Local ClearKey playback is proven; commercial Widevine production qualification is still open.

## Interrupted-upload repair

Real upload testing exposed an existing platform refusal: once an asset identifier had been recorded, an incomplete upload could not request a fresh upload URL. The platform now permits a retry only while the mapping is UPLOAD_PENDING and upload completion has not been recorded, preserves the same external asset and idempotency identifiers, refuses a different returned asset, and rechecks state under the course lock before recording success. Completed uploads remain protected against replacement. Signed URLs are never persisted.

Changed business files: `server/src/modules/catalog/media/intentService.ts`, `server/tests/fixtures/drmFixture.ts`, `server/tests/integration/catalog-media-intent.test.ts`. Two regression cases prove same-asset recovery/completed refusal and mismatched-asset rejection. No migration or dependency change, and no external DRM source edit.

## Verification and failures

Fresh Docker builds passed. Server typecheck passed; 21 unit files / 174 tests and 32 integration files / 272 tests passed, total **446**, exit 0. Serving image: `sha256:8301a079f1f675450323bfcfaf138dced1448e9c115d75ad83188f5b7eb32623`. Existing CLI exclusion/native-runtime smoke remains enforced by the build.

The initial 8085 upload was outside existing R2 origins; automatic approval review rejected a proposed persistent bucket CORS edit because that security change had not been authorized. It was not performed. The owner subsequently chose the already permitted 8080 origin. A retry before the platform repair returned MEDIA_EXISTS. An attempted login to the older 8082 preview failed without changing its accounts or data. The first server test harness omitted Redis and failed with ENOTFOUND; starting its project-scoped Redis corrected the harness and the entire suite then passed. Upload logging also recorded an aborted PUT, and playback logging recorded unauthenticated 401 requests around login; final processing, publication, authenticated purchase and timed playback all succeeded. Failed evidence is retained rather than presented as successful runs.

## Retention and cleanup

Only the disposable `owner-video-retry-test` Compose project was removed with its named PostgreSQL and anonymous Redis volumes and network. The prior M7-08 rehearsal was also cleaned. No global Docker prune. The owner preview and independent `m8-owner-drm` project, their persistent data, and this owner's actual processed R2 video are intentionally retained so the owner can watch it. Historical previews on 8082/8083/8084 were preserved. Credentials, signed URLs, connection settings, backups and media copies remain in ignored evidence, not this report or Git. Root and DRM secret files were not rewritten.

Evidence: ignored `docker/browser/evidence/m8-owner-video/` upload, publication, playback, build and regression logs; `student-playing.png`; private connection/fixture receipts. The unchanged DRM checkout remains at `bad0c1df9f5d5844fe365c402fcccfee33ab6906`.

M7 local preparation is complete as documented in M7-08; actual Railway deployment, commercial DRM, enabled recovery schedules/alerts and the agreed production capacity workload still require external setup and evidence. This demonstration does not constitute production or milestone acceptance.
