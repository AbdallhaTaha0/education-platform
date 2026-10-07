# Charcoal theme and player controls — 2026-10-07

Owner authorized the planned charcoal/lime redesign and speed, available quality, volume, and single randomly moving watermark. Latest clarification keeps **dark as the default**, preserving saved light/dark preferences. Speed and quality now open behind a matching settings icon; they no longer occupy the bar as permanent dropdown boxes.

## Delivered

- Semantic charcoal canvas, surface, raised panel, field, hover, selected, disabled and control-border tokens, with explicit light counterparts. Shared fields, buttons, notices, dialogs, tabs, navigation and student-roster selection consume those roles. No permission/payment/report/view-count policy changes.
- Player speed 0.5–2x; quality Auto or actual manifest representations via the installed dash.js API. Activation no longer resets a user's quality selection. Selection failure restores Auto and shows a local explanation, preserving the video error lifecycle.
- Icon settings panel with labeled controls, initial keyboard focus, Escape/focus return, outside-pointer dismissal, and automatic dismissal on access loss. Volume slider adjusts 0–100%; mute/unmute preserves a positive volume. Compact controls fit a 320px viewport.
- One visible authenticated student-phone watermark, falling back to the existing dependency identity. It relocates every eight seconds and on resize/fullscreen within measured bounds above controls. Existing dependency policy and protected API boundary remain; no nested DRM source/persistence change.

Changed implementation: `client/index.html`, `client/tailwind.config.js`, `client/src/styles.css`, shared `components/ui/{Button,Dialog,Field,Notice,SectionTabs}.tsx`, parent-report `AdminCourseRoster.tsx`, player `{Player,PlayerControls,PlayerChrome}.tsx`, `watermark.ts`/tests and new `playbackOptions.ts`/tests. No migration or configuration secret changes. Design/decisions record the final owner direction.

## Docker verification

- Disposable `fayq-dark-player-client-test`, read-only client mount: `npm test && npm run build`. **296 Vitest tests in 36 files plus 10 tooling checks pass**; TypeScript, browser and SSR builds pass. Existing large-bundle/dynamic-import warnings remain warnings.
- `docker/dark-player-review/` is explicitly synthetic API/DASH transport around the actual React player with real Chromium and a locally recorded WebM. It is not evidence of external DRM delivery. Five Arabic/English, dark/light, 1280/390/320px scenarios pass: volume, mute restoration, rate, real callback wiring/manual/Auto/failure recovery, late activation preserving manual choice, watermark count/bounds/timer, fullscreen, expiry, no overflow or browser exceptions. Fresh storage defaults to dark; stored light is preserved in the light scenarios.
- Computed roster field text/border contrast: dark **16.90:1 / 4.29:1**; light **17.14:1 / 3.96:1**. These are targeted checks, not a whole-site accessibility certification. Desktop/mobile ADMIN roster screenshots and player/settings captures are retained in ignored `docker/browser/evidence/dark-player-20261007/`.
- Reproducible fixture commands: run `build.cjs` in `fayq-seo-client-test:20261006` with fixture, actual source and evidence mounts; run `check.mjs` in `fayq-seo-browser:20261006` on the isolated `fayq-dark-player-network`, serving before/current bundles with the existing synthetic ADMIN fixture. All runners carry `fayq.dark-player` labels and use `--rm`.

Initial probe failures were corrected or recorded: a live canvas MediaStream cannot verify playbackRate, so the fixture records finite WebM; the fixture CSS selector initially picked a stale hashed file, corrected to the exact index asset; a real course probe exposed activation resetting manual quality, repaired and covered. The local preview must use matching rebuilt client/server assets; updating the client before the corresponding SSR server caused a temporary asset mismatch during verification.

## Delivery and rollback

Local preview refresh, real protected-player outcome and owned-resource cleanup are recorded below. This delivery does not authorize a production release, commit/push, milestone acceptance or capacity certification. Rollback only the listed frontend/doc changes or rebuild the previous paired client/server revision; preserve existing DB/cache/media and the pre-existing nested DRM Git-reference difference.

## Preview incident and recovery

The coordinator mistakenly built the server Dockerfile's default final **test** stage under the preview tag. Its inherited test command ran against the retained local database, removing catalog/account fixture data. This was a destructive execution mistake, not a frontend defect. The server was stopped; the incident state was exported to ignored `incident-state.dump`. The original `m8-owner-preview_pgdata` volume remains intact for investigation.

Recovery restored the validated existing `platform-before-free.dump` (2026-10-07 07:08 local) into **new retained volume `fayq-dark-player-recovered-pgdata`**, verified seven courses/four accounts, and applied the missing free-course migration (26/26 now applied). Existing external DRM/media/cache volumes were not restored or removed. A recovered-state dump is retained. Activity after this backup is not claimed recovered. The ignored local environment now selects the recovered volume; historical commands hardcoding the previous volume must be updated. Recovery staging container/network were removed after checking project labels and the sole retained database mount.

The server was rebuilt explicitly with `--target runtime`; client/server share the final source assets. The preview compose now explicitly starts `node dist/index.js`, preventing inheritance of a test-stage command. Server/client/PostgreSQL/Redis/grading/Nginx are healthy; local preview is `http://localhost:8080`. Actual demo-account login and dashboard/wallet/practice checks pass after recovery. Actual protected-course playback is **BLOCKED by the external device-registration limit**, so the final external quality-switch/end-to-end result is not claimed PASS. No device-limit increase, DRM maintenance or external persistence access was performed.

Cleanup: task-labeled test/web/baseline containers and their isolated network were inspected for exact ownership and read-only bind mounts, then removed. Disposable runners used `--rm`; zero `fayq.dark-player` containers/networks/volumes remain. The explicitly retained recovered PostgreSQL volume uses the separate `fayq.recovery` label and is now mounted by the preview. Reusable images, private evidence/backups, original database, external DRM and all unrelated resources remain.
