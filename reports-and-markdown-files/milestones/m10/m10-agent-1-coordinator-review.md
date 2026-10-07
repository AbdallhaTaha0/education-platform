# M10 agent 1 coordinator review

2026-10-07, Africa/Cairo. Verdict: REPAIRS REQUIRED before package acceptance. No M10 acceptance, deployment, preview upgrade, commit or push. Review preserves all parallel worker changes and the independent DRM checkout.

## Findings

1. P2 — Watching time is media progress, not elapsed playing time. client/src/features/learning/player/viewTracking.ts:77 adds currentTime deltas. A network-disabled Docker probe at 2x produced 30,000 reported ms after 15 seconds of playing; at 0.5x it produced 15,000 ms after 30 seconds. The owner approved 30 seconds of actual playback. Use a monotonic elapsed-time basis gated on actual playback and handle seek/buffer/pause/resume, rate changes and sampling gaps without silently counting skipped footage as time.

2. P2 — One transient start failure disables tracking for the entire unchanged grant. useViewTracking.ts:113-135 makes one start request and catches failure by leaving viewId null; its heartbeat timer is installed only after success, and observe ignores all samples while viewId is null. A controlled hook-callback Docker probe reproduced one failed start, zero retry timers and zero accumulated ms during continued playback. Add bounded retry for transient failures, cancel on grant/user/navigation change, and keep one server row per grant. Do not retry terminal authorization/access failures indefinitely. Handle playback while start is pending/retrying without attributing it to the wrong session.

3. P2 — Heartbeat accepts stale playback state. server/src/modules/learning/tracking/service.ts:228-286 verifies student subscription and lesson-course binding but does not check the recorded playback reference is still active/valid or resolve current publication/progression/media readiness. A view started legitimately can still reach its threshold after session termination or content withdrawal while the subscription remains active. This contradicts the worker report's heartbeat-binding claim. Recheck relevant existing learning protections at write time; preserve version snapshots and avoid breaking a legitimate final flush through a poorly ordered player end. Add actual integration tests for stale reference/publication/media conditions, not just wrong bindings at start.

4. P2 — newlyCounted can be true for both concurrent threshold calls. service.ts:264 snapshots wasCounted before the atomic UPDATE and returns !wasCounted && counted at line 288. Both readers can see null before their serialized updates, so both responses announce a new count. A controlled database-ordering probe reproduced [true,true] while representing one counted row. The durable count remains one; the response contract is incorrect. Derive newlyCounted from the transaction/atomic transition itself and reproduce using real PostgreSQL concurrency.

5. P2 documentation — Rollback guidance tells operators to delete the new migration without restricting this to a never-applied disposable/pre-release checkout. Once deployed anywhere, preserve its SQL/checksum and additive schema. Correct the rollback guidance: older compatible code can run with additive tables retained; any data/schema recovery is separately authorized. Agent 2 already consumes these tables, so schema-model removal is not an integrated rollback plan.

## Independent evidence

- Docker client learning suite against current mounted source: 105/105 pass, including the eight accumulator tests. This is a separate current-source run, not a repetition of the worker's 100-test baseline.
- Network-disabled Docker probes verify the rate-dependent timing defect above.
- docker/m10-coordinator-review/agent1-probes.cjs reproduces failed-start tracking loss and concurrent response metadata with controlled callbacks/database ordering. These are source probes, not real React-browser or PostgreSQL concurrency tests; do not present them as such.
- Initial probe failed to resolve TypeScript from the mounted script location; rerun with NODE_PATH=/srv/client/node_modules passed. This was review setup, not a product defect.
- No full backend integration reproduction, populated upgrade drill or real-browser counting journey was completed in this coordinator review. The worker reported these latter gates blocked/skipped; they remain open. Exact runner commands in the worker report do not clearly establish that all test processes ran inside Docker; repair evidence must show Docker-contained runners, not only containerized databases.
- SQL review confirms additive tables and unchanged existing migration files in this delivered diff. This does not replace populated upgrade preservation evidence.

## Review environment and cleanup

Used the existing fayq-seo-client-test:20261006 image in --rm, --network none containers labeled m10.coordinator.review=agent1. Mounts were only read-only source/probe directories; no retained database, Docker socket, secret files, new volumes or networks. Current client sources were copied into the container's disposable filesystem for the test run; host source was not rewritten. All probe/test containers exited and were auto-removed; final label check must report zero. Existing agent-3 services, retained fayq-local services, images, source and evidence were preserved. No global prune or retained cleanup.

## Next step

Send agent 1 the bounded repair prompt m10-agent-1-repair-prompt.md. Agents 2/3 may continue independent work against the unchanged table/DTO contract; final integration cannot be accepted until these repairs and the missing browser/upgrade gates pass. No prompt was dispatched by the coordinator during this review.
