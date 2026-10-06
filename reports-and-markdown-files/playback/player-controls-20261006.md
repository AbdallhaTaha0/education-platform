# Lesson player controls — 2026-10-06

Owner requested removing the overlaid captions selector and extra Play button and making the bottom fullscreen control work.

The lesson player now has one bottom control bar: play/pause, elapsed/total time, seek, mute/unmute and fullscreen. The captions selector, subtitle tracks and duplicate overlaid controls are removed from student playback; stored caption files and ADMIN materials authoring remain intact. Fullscreen expands the complete player frame so the existing account watermark stays inside it. The existing expanded-view fallback remains available when the browser refuses fullscreen, including Escape, focus restoration and keyboard navigation through the seek slider. Session handling, DASH/EME, progress reporting, expiry and retry behavior are retained.

Changed source: CourseLearningPage.tsx, player/Player.tsx, new player/PlayerControls.tsx, player/fullscreen.ts and styles.css. No schema or environment-setting changes; no external DRM implementation edits.

## Docker verification

- Typecheck passed on final source.
- Client suite: 191 Vitest checks, eight build-tool guards and two DASH guards passed.
- Frontend browser/SSR builds, matching backend runtime build and Nginx build passed.
- Docker Chromium tested the actual bottom controls/fullscreen hook with a finite synthetic video in Arabic and English at 390px and 1280px: play, pause, keyboard seek, mute/unmute, native whole-frame fullscreen, watermark containment, exit, rejected-fullscreen fallback, Escape/focus restoration, focus cycling and disabled playback/seek controls passed.
- The first video fixture was unsuitable for decoding; a disposable Docker-generated finite video replaced it. Browser checking caught stale controlled-slider state; seeking now updates state immediately and listens to seeking/seeked. Windows bind-mount development caching required restarting the fixture server. The final browser run passed all cases.
- The isolated fixture verifies controls and frame containment; it does not requalify commercial DRM or production mobile browsers. Protected playback transport and authorization were not modified.
- Local preview was refreshed with matching client/server/edge images. The backend receives the matching public-render HTML/assets through its normal Docker build. Arabic/English public pages and their script/style assets returned 200 in Docker Chromium with no page errors; readiness returned 200. Initial network-idle navigation checks timed out; the explicit page/asset check passed with direct Chromium networking.
- Whitespace check passed.

Ignored evidence: docker/browser/evidence/player-controls-20261006/ (fixture, check.mjs, results.json, screenshots and local Compose image override).

## Local preview and cleanup

The existing localhost:8080 preview was updated after verifying its project labels, absence of mounts on replaced serving containers, external retained data volumes and localhost-only ingress. Only server, client and Nginx were recreated with --no-deps; no migration or data cleanup ran. Existing grading, PostgreSQL, Redis, storage and DRM services were retained.

New images: fayq-player-controls-client/server/nginx:20261006. Normal preview image tags also point to those builds. Prior images are retained as fayq-platform-client/server/nginx:before-player-controls-20261006 for rollback with the original Compose configuration.

The temporary fayq-player-controls-check container was removed after inspecting its label and two read-only mounts (client source and this task's ignored evidence). All other test containers used --rm. Final check of the fayq-player-controls-20261006 project label returned no containers. No dedicated test networks or volumes were created. Reusable images, evidence and the retained local preview were preserved.

The owner subsequently authorized committing and pushing this completed change on 2026-10-06. No production deployment is authorized or performed.
