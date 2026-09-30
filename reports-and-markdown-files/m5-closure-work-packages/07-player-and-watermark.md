# Prompt 07 — browser player and watermark verification

Apply `00-worker-contract.md`; prerequisites: 05 and 06. Scope: browser verification and evidenced UI/player fixes, preserving the FAYQ design system.

Exercise the real subscribed student path through Nginx and the real DRM-backed player. Confirm actual advancing playback, not only a loaded manifest or successful license response. Verify pause/resume/progress, renewal, lesson navigation/end-session, expiry stop and clear renewal/network/error states. Browser suite fixture evidence remains useful but must be labeled separately from real playback.

Inspect Arabic/English × desktop/mobile × dark/light. Verify masked watermark during playback, error transitions and fullscreen, control visibility and readable contrast. Use safe screenshots with throwaway identities; do not capture tokens, URLs, licenses, or private data. State that the DOM/CSS watermark is visible presentation, not forensic watermark or screen-capture prevention. Do not claim existing DRM forensic behavior unless separately observed.

If a fix is necessary, keep it small and add regression coverage for the observed defect. Reuse existing tokens/components and verify both languages/themes. Acceptance: real video plays and renews; expiry stops it; lifecycle/error states and watermark matrix pass; no privileged credential/browser persistence leak. Report unsupported device/browser cases truthfully.
