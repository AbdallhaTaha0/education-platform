# Automatic video return after a correct assessment — 2026-10-05

The owner requested automatic continuation of the lesson video after solving an assessment correctly.

The assessment page now replaces its route with the originating course and lesson only after the submission API confirms `CORRECT`. Incorrect results, grading errors, pending results and completion notifications without a confirmed result stay on the assessment. The learning page requests playback once through the existing access checks, and the player attempts playback from the saved position. A browser autoplay refusal retains the normal Play control and does not create a second playback request.

Docker verification passed: frontend typecheck and production build, 173 frontend tests, two DASH patch tests and 13 Chromium checks in Arabic and English. Browser checks exercised incorrect/error/pending results, confirmed success navigation, a generated 12-second DASH video resuming at the saved two-second position, and simulated autoplay refusal followed by manual recovery. Authentication and course outline used the isolated application; grading and playback grant responses were explicit browser fixtures. This verifies client behavior, not real grading or encrypted DRM playback.

The guarded browser runner removed all disposable containers, networks and volumes. Evidence is retained under the ignored `docker/browser/evidence/ide-modes/` directory. The local frontend was refreshed on port 8080. No backend or nested DRM implementation, retained database or uploaded media was changed for this feature; no production deployment or commit/push was performed.

## Reproducing the browser fixture

After building the existing verification images, generate the clear synthetic clip in the evidence mount, then run the guarded browser verification. The worker image supplies FFmpeg only; no external DRM source or persistence is accessed.

```powershell
docker run --rm --entrypoint ffmpeg --mount "type=bind,source=$PWD/docker/browser/evidence/ide-modes,target=/evidence" fayq-drm-worker:0.8.0-local -hide_banner -loglevel error -f lavfi -i color=c=blue:s=320x180:r=24 -t 12 -an -c:v libx264 -preset ultrafast -g 24 -sc_threshold 0 -f dash -seg_duration 1 -use_template 1 -use_timeline 0 /evidence/assessment-return.mpd
node docker/ide/modes-verify.mjs --assessment-return-only --browser-only
```

Delivery follow-up: the owner subsequently requested commit and push of the completed fixes. Earlier unrelated phone-watermark changes remain outside this delivery. This authorization grants no production deployment or milestone acceptance.
