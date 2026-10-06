# Prompt 03 — narrow R2 CORS and browser upload proof

Apply `00-worker-contract.md`; prerequisite: 02 and approval for the exact browser origin. Scope: CORS verification/harness only.

Previous approval covers `http://localhost:8080`. The disposable helper currently uses `http://localhost:8082`; obtain explicit approval for that origin or choose an already-approved origin with safe port coordination. Never treat origins as interchangeable.

1. Read current `cors.mjs` and S3 helpers. Read configuration if authorized. A 403 is a visibility blocker, not proof that CORS is absent. Owner dashboard evidence can establish the narrow rule without granting broader account privileges.
2. Prepare the exact rule: approved origin, PUT and Content-Type; add GET/HEAD only when the exercised flow requires them. No wildcard origins. Do not write Cloudflare configuration without exact owner authorization.
3. Verify OPTIONS status, allowed origin/method/headers. Check an unapproved origin receives no usable CORS permission.
4. Execute a real Chromium page from the approved origin, request a presigned upload through the intended API and upload a fresh small test object/video. Browser enforcement must succeed; server-side fetch with an Origin header alone is insufficient.
5. Clean the exact probe and verify its unique prefix is empty. Keep raw signed URLs and browser-network secrets out of output/artifacts.

Acceptance: configuration evidence and browser behavior reported separately, approved browser PUT succeeds, unapproved origin blocked by browser, exact cleanup and preservation controls pass. Run affected harness/browser checks only. If owner action is pending, preserve a concrete rule for review and mark blocked.
## Owner-required Docker test cleanup (2026-10-01)

After completing the assigned work, or after failure/interruption/stop, clean up the Docker test environment you created. Before removal, verify the exact project labels, resolved container/network/volume names and every mount; target only this assignment's owned disposable test resources and fixtures. Remove owned test containers, networks and volumes, including any owned anonymous volumes identified from container mounts. Never use global prune or delete unrelated data, the existing previews, reusable images needed for review, or saved reports/evidence. If a test resource must remain temporarily for an active check, record its owner and reason, then clean it when that check ends. Report the final cleanup verification and any resources that could not safely be removed. Every future prompt must include this requirement.
