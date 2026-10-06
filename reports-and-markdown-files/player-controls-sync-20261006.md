# Player control synchronization — 2026-10-06

## Cause

The teammate commit `06ccfbd` (`fix: simplify lesson player controls and enable bottom fullscreen`) exists on `origin/main`, but the retained local checkout is still `73a77c1`. The previous full rebuild correctly built that local working tree, which did not contain this commit. Rebuilding alone cannot import remote source changes.

## Bounded local repair

Fetched remote references and applied the commit's player, bottom-controls, fullscreen keyboard-focus and stylesheet changes to the current working tree. Preserved pending assessment authoring, lesson-file and security work; no broad pull/merge, reset, stash, commit or push. Other remote commits (`6537113` and `1a3ad8d`) have not been merged as part of this player request.

Unlike the original commit, this local integration preserves existing caption props, tracks and caption selector wiring, keeping captions within the whole-player frame. The native video controls and upper fullscreen button are replaced with one bottom bar: play/pause, elapsed/duration, mute, fullscreen and seek. Whole-frame fullscreen continues to include the watermark.

## Verification

- Frontend runtime build/typecheck succeeds in Docker.
- Frontend unit suite: 173/173 pass.
- Synthetic actual PlayerControls + fullscreen-hook Chromium probe: 11/11 pass. Checks cover one custom fullscreen control/no native duplicate, bottom positioning, duration/seek event synchronization, play/pause, seeking, mute, native fullscreen and exit, watermark/caption frame membership, refused-fullscreen fallback/Escape, mobile fit, and disabled playback with fullscreen still available.
- The initial browser probe used a container hostname Vite rejects. Corrected to a localhost origin resolved to the disposable UI container; the repeat passed. This was a test-hostname problem, not a product failure.
- Browser containers/network are removed in guarded finally blocks; no volumes were created and no real account/video was used.
- Local preview updated through the guarded client-only wrapper; backend, grading, external DRM, PostgreSQL, Redis/Valkey and material objects preserved.

## Operator note

The source synchronization is a pending local change, not an assertion that the local branch now contains the remote commits. The selected player patch should be reconciled when the owner's remaining uncommitted delivery and later remote changes are formally integrated. Refresh the lesson page after the preview update; use a hard refresh if an already-open tab still holds its old JavaScript bundle.
