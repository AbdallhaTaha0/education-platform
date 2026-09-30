# Bounded DRM repair proposal: recorded-video DASH manifest

Date: 2026-10-01. Status: explicitly authorized by the owner on 2026-10-01 and implemented in
the uncommitted worker/test changes. No production object or existing manifest
has been rewritten. The full real-browser run passed 65/65 checks; owner
acceptance and production qualification remain separate.

## Reproduced defect

`apps/worker/src/services/video-processing/packaging.service.ts` invokes Shaka
Packager originally used segmented output without `--generate_static_live_mpd`.
Using the pre-repair worker image, the same arguments, a generated one-second
local clip and dummy encryption keys produces:

| Packaging arguments | MPD type | availabilityStartTime | minimumUpdatePeriod | mediaPresentationDuration |
| --- | --- | --- | --- | --- |
| Original | dynamic | present | present | absent |
| Authorized static flag | static | absent | absent | present |

Both reproductions ran in a transient Docker container with `--network none`,
without R2 access, credentials, persistent volumes or database access.

The pre-repair Chromium flow proved successful manifest/init delivery and
ClearKey license 200, but video remained unbuffered (`readyState=1`,
`buffered.length=0`) and the dynamic manifest refreshes repeatedly. Recorded
videos must not be packaged as an indefinitely advancing live stream. These
observations establish a concrete packaging defect; final advancing-browser
proof was required after its repair and is recorded below.

## Exact proposed change

Only the worker packaging invocation changes:

```diff
     "--mpd_output", join(outputDir, "manifest.mpd"),
+    "--generate_static_live_mpd",
     "--segment_duration", String(segmentDuration),
```

This changes DASH metadata for recorded content. The external API, encryption,
watermarks, license authorization, storage ownership and platform architecture
stay independent. Do not work around the defect by disabling authorization,
injecting content keys into the frontend, or rewriting manifests in platform
code.

## Required verification after assignment

1. Add a packaging regression that checks the flag is passed and rejects a
   generated dynamic MPD in the recorded-processing integration path.
2. Build the worker and its test image in Docker. Run the affected packaging and
   real local processing regression, followed by required DRM regression suites
   sequentially on guarded disposable PostgreSQL/Valkey/SeaweedFS services.
3. Reload only the corrected worker image, preserving development volumes and
   independent deployments. Generate new run-owned media through supported
   APIs; assert the returned manifest is static with a finite duration.
4. Rerun `node docker/verification/run-real-browser.mjs` to prove advancing
   playback, pause/resume, progress restore, renewal, lesson switching, expiry,
   masked watermark visibility and exact API-driven cleanup.
5. Restore the 300-second local API token TTL, preserve sanitized evidence,
   update the manager review and leave changes uncommitted for acceptance.

Previously packaged assets are not automatically changed by the new invocation.
Record any affected existing assets for a separately authorized regeneration
plan; do not delete or replace them by broad prefix or directly access DRM
persistence from platform code.

## Authorization boundary

The root `AGENTS.md` states: “Only a prompt that explicitly assigns one of those
bounded DRM tasks may edit the nested package.” Its existing exceptions cover
permanent deletion and upload-URL recovery. The owner explicitly supplied that assignment on 2026-10-01. D24 records the
bounded permission; only the worker packaging invocation and affected processing
regression were edited inside DRM.

## Verification after authorization

The rebuilt compiled `packageWithShakaPackager` function produced an encrypted,
segmented static manifest using a transient network-none Docker probe with dummy
media and keys. The real processing suite passed 7/7, including assertions on
actual stored output after both initial and recovered uploads. Fresh sequential
DRM suites passed: unit 51, deletion 44, upload recovery 38, integration 3, media 3,
and e2e 2 (148 total including processing). The independent development worker
was reloaded without replacing database or Valkey containers.

The subsequent full Docker Chromium run (`real-a851ffd29ab3`) passed 65 checks
with zero failures/blocks/skips and runner exit 0. It verified static finite
manifests, decoded advancing video through the actual frontend, renewal,
progress restore, lesson switching, watermark/fullscreen across both languages,
themes and screen sizes, and subscription expiry. Course/media deletion reached
COMPLETED; sessions ended, users logged out, scratch/env files were removed and
the API TTL was restored to 300. These are local ClearKey results, not Widevine
or 10,000-user production qualification.
