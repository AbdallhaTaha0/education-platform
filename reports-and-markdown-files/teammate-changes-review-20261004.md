# Independent review of the October 4 teammate delivery

Follow-up: both findings are now corrected and verified in the working tree;
see [the fix report](material-refresh-caption-fixes-20261004.md). The review
below records the original pre-fix evidence. The running preview is unchanged.

## Scope and verdict

Reviewed platform commits `f206601` and `2c0d11f` relative to `a957c91`.
Platform HEAD: `2c0d11fc71ddb74553e701786de22b426520f751`.
Reviewed the nested DRM device-recovery diff read-only, `bad0c1d..dd66be3`.
Nested HEAD: `dd66be36fd817af694236fa8846582251c961f90`.
Both repositories were clean when the review began.

Two reproducible P2 functionality defects remain. Existing regression suites
pass; their coverage does not exercise these cases. No application or DRM
source was changed, and no commit/push or milestone acceptance was performed.

## Findings

### R1 — P2: Material byte/form requests bypass session refresh

Location: `client/src/features/learning/materials/api.ts:51–66` and the
multipart upload methods at lines 88 onward.

Caption downloads, resource downloads and multipart uploads call `fetch`
directly. A refreshable authentication failure is immediately thrown, with
no use of the existing coordinated refresh mechanism in `auth.tsx`.
The access cookie lasts 15 minutes, while the refresh session can still be
valid. A student who leaves the lesson open and later downloads a resource
or enables an uncached caption receives an error; retrying repeats the same
unauthenticated request. An admin leaving the editor open encounters the
same issue when uploading. Visiting another screen which refreshes the
session can make the material request work again.

Evidence reproduced in Docker:

- Three offline frontend transport probes: caption/resource/upload each
  received `401 TOKEN_MISSING`, made exactly one request, and never requested
  authentication refresh.
- Real authenticated HTTP with disposable PostgreSQL/Redis/private MinIO:
  remove only the access credential from the synthetic request cookie jar,
  preserving the valid refresh and CSRF credentials. Resource GET returned
  `401 TOKEN_MISSING`; normal refresh returned 200; the same resource GET
  with the newly issued access cookie returned 200 with exact bytes.
  This models the browser dropping the expired access cookie without
  changing system time or invalidating the actual session.

Recommended correction: provide a shared response transport for JSON,
bytes and FormData with coordinated authentication refresh. Retry reads
once on known refreshable codes; retry mutations only when authentication
rejection proves no mutation ran. Preserve CSRF, avoid refresh/retry loops,
and add expired-cookie regressions for both student reads and admin uploads.
Do not treat entitlement or subscription failures as refreshable.

### R2 — P2: Valid positioned WebVTT cues are rejected

Location: `server/src/modules/learning/materials/validation.ts:83–86`.

`validateTimestampLine` treats the entire text after `-->` as the end
timestamp. Legal cue settings such as `align:start position:10%` therefore
make the timestamp regex fail. Valid caption files exported with these
settings cannot be uploaded, and the admin sees `MATERIAL_INVALID`.

Minimal fixture:

```text
WEBVTT

00:00:00.000 --> 00:00:02.000 align:start position:10%
Caption
```

Evidence reproduced in Docker:

- Compiled backend validator: `valid=false`, `cueCount=1`, invalid timestamp
  error. The same cue without settings passes.
- Authenticated multipart caption-pair endpoint: HTTP 400,
  `MATERIAL_INVALID`, with this fixture in both language files.
- Offline real Chromium native subtitle track with exactly the same bytes:
  loaded successfully (`readyState=2`), one cue, `align=start`, `position=10`.

Recommended correction: parse the end timestamp separately from optional
WebVTT cue settings and validate the settings. Keep the client and server
formats consistent; add positioned-cue round-trip tests and malformed-setting
negatives. Preserve the atomic bilingual replacement and safe rendering.

## Independently reproduced checks

All builds used current workspace source and new review-only image tags.
No previously reported test results were counted as fresh evidence.

| Check | Result |
| --- | --- |
| Backend source/test typecheck | PASS |
| Frontend TypeScript/Vite build | PASS; existing chunk-size warnings |
| Backend unit tests | 230/230 |
| Frontend unit tests | 115/115 |
| DASH compatibility script checks | 2/2 |
| Learning playback integration | 28/28 |
| Playback recovery integration | 19/19 |
| Device-release DB regressions | 4/4 |
| Private material integration | 22/22 |
| Frontend defect-reproduction probes | 3/3 reproduced current defective behavior |
| Authenticated HTTP defect-reproduction probes | 2/2 reproduced current defective behavior |
| Native Chromium positioned-cue probe | Successful cue load |
| Fresh additive database migration | All 17 migrations applied |

The 73 integration checks used real disposable PostgreSQL/Redis; the 22
material checks also used private MinIO built from the existing pinned
fixture Dockerfile. Platform-to-DRM contract tests used the existing fixture,
not live DRM. The nested device-recovery implementation was inspected for
tenant scoping, registration-lock compatibility and preservation of active
playback/revoked registrations; its separate integration suite was not rerun.

This review does not reproduce the previous live-video browser delivery,
populated upgrade drill, commercial DRM, production deployment or 10,000-user
qualification. Those reports remain historical evidence, not new certification.
The withdrawn square-function screenshot is not an open defect.

## Preservation and cleanup

Review project: `fayq-review-oct4-20261004`; no published ports and no owner
environment files. Only synthetic credentials and data were used.

Before cleanup, inspected all three containers against resolved Compose
service images and exact volume mounts; checked volume labels and network
membership. An initial comparison refused cleanup because short container
IDs were compared with full network IDs. No removal occurred on that refusal.
Repeated with full IDs; all guards passed.

Removed and verified absent: three review containers, three review volumes,
the review network and three review image tags. Removed the exact known
temporary probe/Compose files after validating their temporary directory.
No global prune was used; shared base-image/build caches were not pruned.

The original nine owner-preview/DRM containers remained running throughout
and were still present after cleanup. No owner users, media, sessions, volumes,
credentials or real R2 objects were modified by this review. Only this report
and its documentation-index entry are new repository changes.
