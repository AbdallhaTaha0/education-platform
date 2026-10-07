# Player settings refinement — 2026-10-07

Owner requested further improvement and supplied the screenshot of oversized native dropdowns. Replaced both dropdown boxes with compact Speed/Quality rows, each opening its own choice grid. Selected values use lime with dark text; the panel has a simple back action, correct Arabic direction, capped scrolling for many quality options, and a standard sliders icon matching the playback controls. Dark remains default; available qualities, volume, authenticated watermark and protected playback rules are preserved.

Keyboard focus moves to the selected choice, supports ordinary Tab/Enter selection, returns to settings on Escape, and dismisses when focus or a pointer leaves the panel. No native select borders remain. The choice panel was measured inside the actual frame at 320px.

Files: `client/src/features/learning/player/PlayerControls.tsx`, `client/src/styles.css`, and the explicitly synthetic browser runner `docker/dark-player-review/check.mjs`. No backend source, schema, migration or external DRM changes.

Verification: isolated read-only client source container `fayq-player-polish-test` ran `npm test && npm run build`: **296 Vitest tests plus 10 tooling checks pass**, TypeScript/browser/SSR builds pass. Five real-Chromium scenarios (Arabic/English, dark/light, 1280/390/320px) pass with synthetic API/DASH transport and real recorded WebM: keyboard option selection, selected state, Tab/outside/Escape dismissal, submenu bounds, volume/mute, rate, manual quality/Auto/error recovery, late stream activation, fullscreen, expiry and single moving watermark. Screenshots/results remain in ignored `docker/browser/evidence/dark-player-20261007/`. This does not certify actual external DRM switching; the prior protected-course probe remains blocked by its device limit.

Both production images were built with **explicit `--target runtime`**. Preview refresh first checked the server command equals `node dist/index.js` and the PostgreSQL mount equals `fayq-dark-player-recovered-pgdata`, then exported a private pre-refresh backup. Only client/server were refreshed with `--no-deps`; the retained database/cache/grading/DRM were not recreated or tested against. Nginx was restarted to resolve the new runtime addresses. No commit/push or production deployment.

Actual preview smoke PASS: hydrated login/home, matching asset responses, fresh dark default, saved light preference across reload and no mobile overflow/browser exceptions. All retained services are healthy. This check performed no authenticated or database mutations.

Cleanup completed after checking exact `fayq.player-polish` labels and mounts/endpoints: removed the read-only client test and synthetic before/current web containers and their isolated network. Zero task-labeled containers/networks/volumes remain. Reused images, ignored evidence and every retained preview volume remain. Rollback only this control/CSS refinement and rebuild the paired runtime images; no database rollback is needed.

## Owner delivery authorization

On 2026-10-07 the owner explicitly instructed **commit and push** after reviewing these improvements. This supersedes the earlier no-commit/push task boundary for the verified charcoal theme, player controls, synthetic verification harness, preview startup guard and documentation. The pre-existing nested DRM Git-reference difference is outside this UI delivery and remains unstaged. Private settings, database backups, browser evidence and credentials remain ignored. No production deployment or milestone acceptance is inferred.
