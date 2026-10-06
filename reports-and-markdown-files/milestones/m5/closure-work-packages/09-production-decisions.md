# Prompt 09 — production decision brief, no deployment

Apply `00-worker-contract.md`. This is a separate operational planning package, not permission to widen M5 implementation or delay independent local verification.

Read current production artifacts and original architecture. Prepare one concise owner decision brief covering:

- Commercial DRM/Widevine provider and provisioning. No invented credentials and no production ClearKey waiver inferred from development success.
- Hosting/deployment shape, domains/TLS, replicas, secret injection, private dependencies and independently deployed DRM. Do not choose paid resources or change infrastructure without owner approval.
- Recovery policy: RPO/RTO and backup retention. Prepare disposable PostgreSQL backup/restore and rollback drill instructions; qualify measured results without inventing owner targets.
- Capacity: preserve the established 10,000 simultaneous-user target; ask for browsing/playback mix, latency percentile, error budget, duration and infrastructure budget. Registered-user count alone cannot satisfy concurrency. Prepare a reproducible load plan; obtain external-service load authorization before execution.
- Monitoring/alerts and image/version control. Inspect absent production artifacts and propose a bounded subsequent implementation prompt after decisions.

Deliver recommendations, tradeoffs, exact missing owner inputs, dependency order and future acceptance tests. No paid provisioning, DNS/CORS writes, deployment, external stress test or release certification. These results feed a separate production release verdict; they do not rewrite historical M5 evidence.
## Owner-required Docker test cleanup (2026-10-01)

After completing the assigned work, or after failure/interruption/stop, clean up the Docker test environment you created. Before removal, verify the exact project labels, resolved container/network/volume names and every mount; target only this assignment's owned disposable test resources and fixtures. Remove owned test containers, networks and volumes, including any owned anonymous volumes identified from container mounts. Never use global prune or delete unrelated data, the existing previews, reusable images needed for review, or saved reports/evidence. If a test resource must remain temporarily for an active check, record its owner and reason, then clean it when that check ends. Report the final cleanup verification and any resources that could not safely be removed. Every future prompt must include this requirement.
