# Student phone watermark — 2026-10-05

Owner requested replacing the visible video watermark with the phone number. This explicitly supersedes the earlier masked-only visible presentation rule for this platform overlay.

The visible label uses the signed-in account phone returned by platform authentication, in canonical E.164 or existing Egyptian local (01...) form. External DRM placement policy, player overlay stacking, controls and fullscreen behavior are preserved. Missing/invalid account phone falls back to the dependency identity; absent watermark policy still renders no overlay. No phone is added to playback URLs, logs, tokens or local storage. No backend/schema/DRM changes or deployment to production.

Docker frontend runtime build passes. Focused watermark suite passes 13 tests plus 2 DASH compatibility checks. Browser fixture uses the real platform sign-in and a simulated media grant/position policy; checks require the exact synthetic account phone to replace the old masked identity. This verifies the visible platform overlay, not a modification of external DRM watermark processing or a claim of screen-capture prevention.

Local frontend image fayq-phone-watermark-client:20261005; rollback alias fayq-platform-client:before-phone-watermark-20261005. Final browser outcome recorded below. Earlier delivery commit remains 220d60b; no new commit/push is implied by this presentation request.

Final verification: 20 Docker browser checks pass, including exact synthetic phone visible on the video, progress persistence/retry/session recovery and logout. Phone overlay screenshot inspected. Disposable containers/networks/volumes removed; only retained frontend/proxy updated. Preview readiness healthy.

Owner screenshot follow-up: the original E.164-only phone check fell back to the masked DRM identity for both retained local accounts, which store Egyptian local 11-digit phones. Verified through aggregate/shape-only account inspection (no numbers logged); running image matched the update, so this was a formatting defect. Added local Egyptian phone support, unit coverage and a browser fixture using the same format. Account data and login behavior are unchanged.

Local-format correction verification: 13 watermark tests plus 2 DASH checks and 20 Docker browser checks pass with the exact synthetic local phone visible. Disposable resources removed. Updated local frontend image fayq-local-phone-watermark-client:20261005; rollback alias fayq-platform-client:before-local-phone-watermark-20261005. Readiness healthy.
