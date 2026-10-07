# OpenCode agent 1 — repair coordinator findings only

Read root AGENTS.md, reports-and-markdown-files/README.md, agent.md, rules.md, decisions.md, milestones/m10/m10-parent-reports-plan.md, m10-parallel-contract.md, m10-agent-1-coordinator-review.md, your report and frozen view-tracking contract.

Work only within agent-1 ownership. Preserve agents 2/3 and unrelated work; do not change shared tables/DTO meanings, paid services, course-access policies or DRM. No new agents, commit/push, production deployment or retained-preview upgrade. Stop for coordinator re-review after delivery.

Required repairs:

1. Accumulate real elapsed playing time using a monotonic clock, not video currentTime as duration. Preserve pause/buffer/seek exclusion, rate changes and sensible handling of delayed/background sampling. At 2x, 15 elapsed seconds must not reach the 30-second threshold; at 0.5x, 30 actual playing seconds can reach it. One session still counts once; refresh/successful reconnect counts another session after a fresh threshold.
2. Add bounded/cancellable retry for transient tracking-start failures and safe handling of time while start is pending. Keep one row per playback grant. Reject terminal failures without infinite retries and protect against old asynchronous starts/heartbeats writing into a newer grant's local state. Add hook lifecycle tests, including refresh, same-grant remount, delayed responses and teardown, not only pure accumulator tests.
3. Recheck current relevant learning/playback/media/publication protections on heartbeat so an ended/revoked/wrong/stale session cannot produce new counts. Preserve legitimate final flush/end ordering and media-version history. Add negative real PostgreSQL/API integration coverage for these conditions.
4. Make newlyCounted reflect exactly the one successful database threshold transition under concurrent calls. Verify with real PostgreSQL, including repeated threshold calls after counting; durable views must remain one and only one response may claim the transition.
5. Correct rollback/report/contract claims. Never advise deleting an applied migration or dropping M10 data merely to revert serving code. Keep the additive migration/SQL checksums and table names consumed by agent 2. Clearly distinguish actual Docker test runners from host tests against Docker databases.

Verification: all affected backend/client unit and real PostgreSQL integration checks inside Docker; server/client typechecks/build on current integrated source when peer work permits; populated pre-M10 upgrade drill with representative users/progress/playback/financial rows preserved; real-browser player-to-API counting flow at normal and changed speeds, refresh/reconnect, pause/buffer/seek, start retry and stale/end behavior. Separate fixture evidence from real DRM security. Keep unavailable peer-dependent gates BLOCKED; do not repair sibling files or fake passing evidence.

Update m10-agent-1-report.md and m10-view-tracking-contract.md with exact changed files, commands/results, findings addressed, failures/skips/blockers and safe rollback. Add repair evidence without erasing the initial verification history. Other workers may continue concurrently against stable contracts.

Mandatory Docker cleanup: after success, failure, interruption or stop, inspect exact project labels, resolved names and EVERY mount before deleting only owned disposable containers, networks, volumes (including verified anonymous mounts) and fixtures. Preserve previews, retained data, unrelated projects, reusable images and saved evidence. No global prune or down -v on retained platform/DRM stacks. Use a separate owned project/tag from peers and report the final resource check and any safely unremovable resources.
