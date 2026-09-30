# Prompt 09 — production decision brief, no deployment

Apply `00-worker-contract.md`. This is a separate operational planning package, not permission to widen M5 implementation or delay independent local verification.

Read current production artifacts and original architecture. Prepare one concise owner decision brief covering:

- Commercial DRM/Widevine provider and provisioning. No invented credentials and no production ClearKey waiver inferred from development success.
- Hosting/deployment shape, domains/TLS, replicas, secret injection, private dependencies and independently deployed DRM. Do not choose paid resources or change infrastructure without owner approval.
- Recovery policy: RPO/RTO and backup retention. Prepare disposable PostgreSQL backup/restore and rollback drill instructions; qualify measured results without inventing owner targets.
- Capacity: preserve the established 10,000 simultaneous-user target; ask for browsing/playback mix, latency percentile, error budget, duration and infrastructure budget. Registered-user count alone cannot satisfy concurrency. Prepare a reproducible load plan; obtain external-service load authorization before execution.
- Monitoring/alerts and image/version control. Inspect absent production artifacts and propose a bounded subsequent implementation prompt after decisions.

Deliver recommendations, tradeoffs, exact missing owner inputs, dependency order and future acceptance tests. No paid provisioning, DNS/CORS writes, deployment, external stress test or release certification. These results feed a separate production release verdict; they do not rewrite historical M5 evidence.
