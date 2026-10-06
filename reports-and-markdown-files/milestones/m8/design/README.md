# M8 design review packet

Implementation update, 2026-10-01: [M8-02 now implements the application shell and landing page](../m8-02-shell-landing-report.md), with 103 final Docker browser checks. Review the actual built UI at http://localhost:8084/#/ while the read-only preview runs; its sample-data banner and disabled account/payment actions distinguish it from the platform. Planning-only statements below record the earlier design pass.

Owner direction: FAYQ for secondary students ages 15–18; full student/admin website redesign, supplied mobile dock pattern and FAYQ brand/logo, realistic landing page and dummy test content. Summary reports first, CSV later.

## Review material

- [Interactive design preview](preview.html): Arabic/English, dark/light, phone/desktop, sample discovery, student and admin views. Local review URL: `http://localhost:8083/preview.html` while its dedicated preview container is running.
- [Whole-site redesign brief](website-redesign-brief.md): source audit covering all 17 existing routes, proposed page structures, navigation, landing narrative, asset/demo rules and suggested additions.
- [Updated M8 plan](../m8-product-and-ui-plan.md): one package at a time, keeping feature policies and release gates distinct.
- [Codex implementation prompt](../m8-02-codex-redesign-prompt.md): the first bounded visual package, then stop for manager review; not dispatched.
- [Demo content](demo-content.json): illustrative bilingual courses/prices/durations and scenario inventory.
- [Asset provenance and generation prompt](assets/README.md), [brand board](reference/fayq-brand-board.png) and [mobile navigation reference](reference/mobile-bottom-nav.png).

The logo concept is a native-SVG reconstruction for visual comparison, not an extracted original. The hero is generated illustration. Production assets and actual application UI have not been changed by this planning/design packet.

## Verification actually performed

The in-app browser failed to initialize with `failed to write kernel assets`, OS path error. The existing application's authenticated pages were therefore not opened live in this pass. Source inspection and the prototype are separate evidence.

The standalone prototype ran in cached `edu-platform-browser:0.6.0-m6-inbox`, network disabled, Chromium headless, with read-only design mount and ignored evidence mount. Final run: **90 checks passed, zero failed**. All eight Arabic/English × dark/light × 390/1440 combinations were exercised. Assertions cover lang/dir, sample disclosure, hero reference, loaded logo, no horizontal overflow, four nav destinations, mobile dock bounds/44px targets, working sample search/no-results, progress sample, admin view and zero page/request errors. A visual-found missing `</>` symbol was fixed by escaping the sample text before HTML insertion; the final run adds an explicit assertion.

Sixteen screenshots were produced (landing and admin in each combination); representative Arabic dark phone, English light desktop and Arabic dark admin phone views were visually inspected, with affected final screenshots checked after corrections. This is not a complete production accessibility audit, real mobile-keyboard/fullscreen check, live backend test or DRM proof. Those remain in the implementation prompt.

Evidence is ignored under `docker/browser/evidence/m8-design-review/`, including the verifier, screenshots and results.json. Core command:

```powershell
docker run --rm --pull=never --network none --name m8-design-prototype-check --shm-size 512m --mount 'type=bind,source=A:\Projects\Work Projects\education-platform\reports-and-markdown-files\m8-design,target=/design,readonly' --mount 'type=bind,source=A:\Projects\Work Projects\education-platform\docker\browser\evidence\m8-design-review,target=/evidence' --entrypoint node edu-platform-browser:0.6.0-m6-inbox /evidence/verify.mjs
```

The test container is gone. A separate intended review container `m8-design-preview`, label `codex.scope=m8-design-preview`, serves only this read-only artifact directory through cached unprivileged Nginx on **127.0.0.1:8083**. It creates no named volume or application DB/fixtures. HTTP 200 was checked; the preview was opened in Codex. It remains running so the owner can review the design. To close it, first inspect its name/label/mount/port, then stop that exact container; `--rm` removes it. Do not stop the port-8082 app preview or OpenCode's resources.

All five existing application-preview services remained healthy with its completed migration job. Pinned DRM checkout stayed clean. No application changes, commits, pushes, production deployment or M8 worker dispatch. Shared index integration is deferred during concurrent OpenCode writes; plan/design/decision records link the packet directly.
