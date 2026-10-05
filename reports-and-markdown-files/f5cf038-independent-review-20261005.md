# Independent review — f5cf038 — 2026-10-05

Reviewed latest platform commit `f5cf038c0c7ffc044156edcee1bce2ae6304c5d9` against parent `08640ab`. The starting tree was clean. Scope is the phone-watermark commit, not a new acceptance/review of every preceding milestone.

## Conclusion

No blocking code defect found in the reviewed change. The visible player overlay reads the authenticated account phone from the existing auth context, supports E.164 and Egyptian local mobile formats, and falls back to the dependency's masked identity for missing/invalid phone data. No policy still means no overlay. Position clamping, label count, pointer-event exclusion, React text escaping and external DRM boundaries remain intact. The owner clarification is recorded in `phone-watermark-20261005.md`.

This changes the visible account label only. It does not modify external DRM processing or establish forensic watermark/screen-capture protection. The phone is not added to storage, URLs or new tokens by this diff. The existing local-phone fixture is a deliberately seeded legacy-format account; it is not evidence that new-registration canonicalization changed.

## Fresh Docker evidence

- Frontend runtime build/typecheck: passed from reviewed source.
- Full frontend suite: **173/173 unit tests**, including **13 watermark tests**.
- DASH compatibility: **2/2 passed**.
- Guarded disposable Chromium player/progress regression: **20/20 passed**. Real fixture account sign-in and platform progress persistence are exercised; media grant/policy and playback events are simulated, not live commercial DRM playback.
- Screenshot visually inspected: exact synthetic local phone appears at the supplied watermark position.
- Separate network-disabled Chromium direction probe: the current `dir="auto"` span keeps the E.164 plus prefix before digits under Arabic RTL, matching the LTR control.

Built `fayq-review-watermark-client:test` and `fayq-review-watermark-client:preview` without changing tracked implementation. Used the existing server test image because this commit changes no backend source; this is not fresh qualification of the parent backend changes. The runner's frontend test alias was restored after the test. Failed/skipped tests: none in these runs. The production bundle-size warning remains historical and is not treated as load evidence.

## Local runtime discrepancy

The retained localhost:8080 client currently uses image `ce31dbae0a557ae404748c14cadc940511378eb9cb94f74e86ddd5227e70ca22`, identical to the earlier centered-auth frontend. That build predates this phone-watermark change. The freshly built reviewed frontend is `80660603ea693680476aecd1325d38649ccc06d31e7359b58b4a322744b63d37`.

Therefore the code review passes, but the latest commit is **not yet served by this PC's retained preview**. The teammate's historical local-refresh report does not prove this machine refreshed after pulling. A bounded client/proxy refresh using the reviewed frontend is the next local action; no database migration or DRM change is needed. This review did not replace the preview.

## Preservation

The guarded test runner reported zero owned containers, networks and volumes after cleanup. Transient unit/probe containers used `--rm`. No owner account, course, video, database or DRM setting was changed. Retained services are preserved; nested DRM remains clean at `dd66be3`. No implementation fixes, commit, push, deployment or milestone acceptance were performed. Only this review document and its index entry are added.
