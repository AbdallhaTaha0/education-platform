# Prompt 07 — browser player and watermark verification

Apply `00-worker-contract.md`; prerequisites: 05 and 06. Scope: browser verification and evidenced UI/player fixes, preserving the FAYQ design system.

Exercise the real subscribed student path through Nginx and the real DRM-backed player. Confirm actual advancing playback, not only a loaded manifest or successful license response. Verify pause/resume/progress, renewal, lesson navigation/end-session, expiry stop and clear renewal/network/error states. Browser suite fixture evidence remains useful but must be labeled separately from real playback.

Inspect Arabic/English × desktop/mobile × dark/light. Verify masked watermark during playback, error transitions and fullscreen, control visibility and readable contrast. Use safe screenshots with throwaway identities; do not capture tokens, URLs, licenses, or private data. State that the DOM/CSS watermark is visible presentation, not forensic watermark or screen-capture prevention. Do not claim existing DRM forensic behavior unless separately observed.

If a fix is necessary, keep it small and add regression coverage for the observed defect. Reuse existing tokens/components and verify both languages/themes. Acceptance: real video plays and renews; expiry stops it; lifecycle/error states and watermark matrix pass; no privileged credential/browser persistence leak. Report unsupported device/browser cases truthfully.
## Owner-required Docker test cleanup (2026-10-01)

After completing the assigned work, or after failure/interruption/stop, clean up the Docker test environment you created. Before removal, verify the exact project labels, resolved container/network/volume names and every mount; target only this assignment's owned disposable test resources and fixtures. Remove owned test containers, networks and volumes, including any owned anonymous volumes identified from container mounts. Never use global prune or delete unrelated data, the existing previews, reusable images needed for review, or saved reports/evidence. If a test resource must remain temporarily for an active check, record its owner and reason, then clean it when that check ends. Report the final cleanup verification and any resources that could not safely be removed. Every future prompt must include this requirement.
