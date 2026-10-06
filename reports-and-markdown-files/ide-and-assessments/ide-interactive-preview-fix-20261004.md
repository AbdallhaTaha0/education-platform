# Interactive web preview correction — 2026-10-04

The owner's counter/live-text application registered listeners correctly, but
the preview's instrumented functions all shared a deadline anchored at Run.
After two seconds of wall time, a later click/input callback threw
`Execution stopped: time limit` before updating the DOM. Idle time was incorrectly
counted as execution time.

The preview now uses a self-contained task execution guard. The first
instrumented call starts the budget and schedules its reset at a subsequent
browser task. Synchronous function calls, recursion, loops and chained promise
microtasks share that task's existing two-second/200,000-step budget. Later
events and timers get fresh budgets; idle time is free. It does not refresh the
budget on every function call or loop iteration. Captured clock, scheduler and
Error bindings are retained. This is the existing responsiveness defense, not
an OS memory quota or a claim of protection against every native browser API.

Changed application files: `client/src/features/ide/execution-budget.ts` and
`preview.ts`, with five new budget regression tests. No backend, database,
grading, quota policy or DRM changes. Opaque-origin allow-scripts iframe,
dynamic-code restrictions, console bounds and network-denying CSP remain.
The separate HTML/CSS/JavaScript editors supply the actual code; external
Google Fonts and external resource URLs remain deliberately unavailable.

## Docker verification

Runtime build/typecheck passes. Focused frontend tests pass 15/15 (five task
budget, seven instrumentation/document-boundary and three mode/format tests),
alongside two existing DASH patch checks.

`node docker/ide/modes-verify.mjs --preview-only` passes 14 Chromium checks in a
fresh synthetic platform project: full HTML plus separate CSS, counter
increase/decrease/reset after the old deadline, text input after another pause,
empty-input fallback, no false timeout, opaque-origin/CSP boundaries, delayed
timer, actual infinite event-loop interruption, recovery on Run, Stop and exactly
four charged Runs regardless of extra interactions. The example includes its
relative stylesheet/script tags and external font import to verify editor
content still works under the unchanged network boundary.

Browser harness fixes handled mode selection rendering, opaque iframe replacement
and polling without Chromium helpers that depend on the blocked Function
constructor. These were test-automation failures, not additional product
defects. Final verification reports zero owned test containers, networks and
volumes after guarded cleanup. Logs remain in ignored verification evidence.

## Local preview and delivery

The frontend-only localhost:8080 update recreates client and Nginx; server,
grading controller, DRM, accounts, videos and retained volumes are preserved.
Rollback client alias: `fayq-platform-client:before-web-preview-fix-20261004`.
Restore that alias and recreate client/Nginx only if rollback is needed. No
commit/push, production deployment, capacity qualification or milestone
acceptance is inferred.
