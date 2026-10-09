# Silent-video transcoding repair - 2026-10-09

## Authorization and Boundary

The owner explicitly approved diagnosis and repair of the local DRM transcoding
failure after the platform automatic-status update exposed FAILED processing.
This repair changes only the external worker's handling of an absent audio
track and its packaging input. Platform code still consumes the DRM API only.
No database, source-video or authored-course edits, deployment, commit or push
were performed. Existing platform UX edits remain uncommitted and preserved.

## Evidence and Repair

- Worker logs reported TRANSCODE failure, exit code 234, across processing retries.
- Read-only ffprobe of `wandering-samurai.3840x2160.mp4` found H.264 video,
  3840x2160, duration 12.433333 seconds, and no audio track.
- An isolated silent-video reproduction failed at FFmpeg's mandatory `0:a:0`
  mapping with the same exit code. Probe validation already accepted silent video.
- The worker now passes detected audio presence to the transcoder. Absent audio
  returns a null audio input; Shaka packages video-only DASH without inventing
  a soundtrack. Sources with audio retain AAC extraction and audio packaging.
- No security/error sanitization or key handling was relaxed.

## Docker Verification

The build used `apps/worker/Dockerfile` from the independent DRM repository:

```powershell
docker build --target build -f apps/worker/Dockerfile -t fayq-drm-transcode-build:20261009 .
docker build --target runtime -f apps/worker/Dockerfile -t fayq-drm-worker:transcode-20261009 .
```

The isolated build container ran, from `apps/api`:

```text
pnpm exec vitest run --config vitest.transcode.config.ts
pnpm exec vitest run --config vitest.security.config.ts
```

Results: 2 real FFmpeg/Shaka tests passed for video-only and audio/video sources;
52 existing security tests passed. TypeScript workspace build passed.

The actual owner's file was mounted read-only into an isolated Docker container.
Real transcoding produced 1080p, 720p and 480p; real encrypted packaging produced
six media segments and a finite static manifest. Only synthetic fixture keys
were used, not existing DRM asset keys. Chromium played the encrypted output,
decoded 65 frames at the sampled time, reported duration 12.433333 seconds and
all three qualities, and passed seeking and finite-end checks. Screenshot
inspection confirmed the source image rendered. Protected video canvas reads
returned black, so the browser test uses decoded-frame counts and screenshot
inspection rather than treating canvas access as a playback failure.

This verifies the real native processing pipeline and encrypted browser playback,
not an owner-asset queue retry or a production/capacity qualification. Failed
owner assets were not requeued or rewritten: the current API has no supported
FAILED retry endpoint. The owner can use the existing remove/replace flow and
upload the same file again after the worker refresh.

## Local Runtime and Rollback

Only the worker was refreshed, using the preserved private env files and an
additional image-only override:

```powershell
docker compose --env-file education-drm-service/.env --env-file docker/local-settings.env.local -p education-drm-service -f education-drm-service/docker/docker-compose.yml -f docker/compose.local-drm.yml -f docker/compose.local-drm-transcode.yml up -d --no-deps --no-build worker
```

The previous `fayq-drm-worker:0.8.0-local` image remains available. To roll back,
run the same command without `-f docker/compose.local-drm-transcode.yml`.
Databases, storage, API credentials, API container and platform preview are
unchanged. There are no configuration-schema or database migrations.

All temporary containers used `--rm` and label `transcode-repair=20261009`.
Tests used container-local scratch space or the ignored evidence directory
`docker/browser/evidence/transcode-20261009`; no test volumes or networks were
created. Existing preview containers, retained data and reusable images remain.
