# Prompt 05 — real student playback through platform RS256

Apply `00-worker-contract.md`; prerequisites: 02 and 04. Scope: dedicated test-only platform RS256 stage and evidenced platform defects only.

The existing platform lifecycle proves admin ingestion/deletion, not protected student playback. Add a distinct stage without falsely renaming the existing evidence.

1. Authenticate disposable ADMIN and STUDENT through cookie/CSRF/origin HTTP contracts.
2. Create bilingual test course/section/lesson and plan; ingest fresh media through platform to READY and publish through valid lifecycle transitions.
3. Establish the student's entitlement using supported wallet/recharge approval/purchase behavior. Any direct fixture setup is limited to disposable platform persistence and must be explicitly labeled; it cannot count as financial-flow proof.
4. Request playback through the actual platform learning endpoint. The platform must issue the RS256 assertion; a harness-signed assertion alone does not satisfy this positive proof.
5. Confirm real DRM acceptance and tenant/user/asset/device binding through public API behavior and positive/negative access controls. Exercise platform-mediated renewal via DRM `/renew-admin` and exact end-session behavior.
6. Test missing, malformed, expired, wrong-key, unknown-kid, issuer/audience/application/asset mismatches, replay and HS256-confusion assertions against real DRM. Harness-generated negative assertions are allowed, clearly labeled; do not expose any assertion or private key. Maintain valid control assertions to distinguish signature validation failures from networking failures.
7. Confirm unsubscribed students cannot obtain sessions and privileged credentials do not enter frontend storage/bundles. Clean exact test sessions/media/course.

Acceptance: actual platform HTTP playback and renewal succeed against real DRM; all contract-specific negative cases fail safely; JWKS private-material scan and exact cleanup pass. Retain in-memory session context needed by 06 only within an explicitly coordinated run. Stop for review before expanding scope.
## Owner-required Docker test cleanup (2026-10-01)

After completing the assigned work, or after failure/interruption/stop, clean up the Docker test environment you created. Before removal, verify the exact project labels, resolved container/network/volume names and every mount; target only this assignment's owned disposable test resources and fixtures. Remove owned test containers, networks and volumes, including any owned anonymous volumes identified from container mounts. Never use global prune or delete unrelated data, the existing previews, reusable images needed for review, or saved reports/evidence. If a test resource must remain temporarily for an active check, record its owner and reason, then clean it when that check ends. Report the final cleanup verification and any resources that could not safely be removed. Every future prompt must include this requirement.
