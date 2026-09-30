# Prompt 04 — live DRM lifecycle and two-tenant isolation

Apply `00-worker-contract.md`; prerequisites: 02, plus 03 for browser-upload claims. Scope: test harness and real HTTP-contract verification, no DRM production rewrite.

Generate a fresh small H.264/AAC MP4 inside Docker. Use a unique run identity. Exercise registration → exact upload → completion → worker READY → manifest → authenticated packaged segment → development ClearKey license → session revocation → permanent deletion. Preserve evidence of unrelated objects and verify exact media source/package cleanup.

Extend the harness's active-asset negative callback to prove tenant A cannot access tenant B and B cannot access A where supported: asset status, playback creation, assertion application binding, service renewal, deletion, manifest/segment and license. State which credential authorizes each endpoint: application credentials and playback bearer credentials are different contracts. Do not falsely report isolation by supplying a malformed token that would fail for every tenant.

Use the correct tenant credential plus a valid signed but mismatched resource/application claim where needed. Include owning-tenant positive controls. Prove denied deletion leaves the owning asset playable. Match each expected 401/403/404 to the documented route contract; do not accept arbitrary non-200 failures.

Keep negative checks in the same process while assets/sessions exist. A standalone `negative` invocation after asset deletion is invalid proof. Ensure exact session cleanup even if expiry checks are disabled or an assertion fails. Add credential-free tests for new harness control flow and cleanup guards.

Acceptance: both lifecycle positive controls and tenant negatives pass against the real DRM/R2 service, no secrets leak, exact cleanup passes. Report ClearKey as development evidence only. Leave real-time expiry to 06.
