# M10 coordinator re-review and direct repairs — 2026-10-07

Owner instruction following agent 1's repair handoff: “if there anything fix it by yourself”. Re-reviewed current source and repaired the remaining player defects directly. No commit, push, deployment, retained-preview upgrade, nested DRM edit or milestone acceptance. Other worker work was preserved.

## Repairs

1. **Short idle gaps incorrectly credited.** `ElapsedPlayClock` anchored at the last inactive sample, so the first sample after a five-second pause could credit four seconds of that pause. Inactive samples now clear the anchor; resumption establishes a fresh anchor without credit. Corrected the existing expectations and added four regressions for paused/seeking/waiting/ended transitions.
2. **Player state changes were not sampled reliably.** `Player.tsx` previously sampled only timeupdates; paused or buffering elements need not emit those. Pause, waiting, actual playing, seeking, seeked and ended handlers now feed the real clock directly. The `play` request alone does not establish actual playing. A network `stalled` event is not treated as buffering by itself, because buffered playback may continue.
3. **Natural completion could wait indefinitely or call a newer grant's callback.** `finalViewFlush.ts` prefers final keepalive flush before completion, with a two-second wait limit. The server's existing 120-second fresh-ENDED grace still accepts eligible delayed requests. A grant generation/unmount guard suppresses stale completion callbacks. Four regressions cover success, failure, indefinitely pending transport and supersession.
4. **Fractional invalid values bypassed telemetry bounds.** Validation now checks original totals before truncating valid sub-millisecond fractions. `-0.5` and `86400000.5` are rejected; unit and real API bounds cases cover both.
5. **Shared security inventory omitted M10.** Added all seven new protected routes to malformed-credential coverage and the five admin routes to current-database-role coverage. Those checks pass.
6. **Report reader integration compile errors.** Two window readers referred to undefined `prisma` after conversion to an injectable `db` reader. Corrected only those references. Server application and test typechecks pass.
7. **Report test used the wrong media namespace.** The replacement fixture and assertion now use the actual current platform `MediaMapping.id`, rather than the external `assetId`. This preserves the production DTO and exercises the frozen agent-1 identity contract. Existing 17 report tests pass.

No schema/migration edits. Current migration SHA256: `D9517A4B78B5C1D365ECEEE034588D603A25F4F19790FE56EE02EA28995C05F2`.

## Independent Docker verification

All execution below occurred inside Docker; the host only orchestrated Docker and edited files. Current sources/tests were mounted read-only and copied into disposable runners, overriding the older reusable image source. Real PostgreSQL 16 and Redis 7 were isolated in project `m10-coordinator-repair`; no ports were published.

| Check | Result |
| --- | --- |
| Real migration deployment to empty disposable PostgreSQL | 25/25 applied |
| Client learning tests after final functional changes | 132/132 passed across 17 files |
| Client TypeScript build check | passed |
| Client Vite web bundle | passed; existing bundle-size/dynamic-import warnings |
| Tracking + learning playback/entitlement/corrections/indefinite integration and tracking unit tests | 96/96 passed |
| Updated security inventory + tracking unit/integration checks | 337/337 passed (306 security, 6 unit, 25 integration) |
| Server application and test typechecks after reader fix | passed |
| Existing report API integration tests after namespace fixture correction | 17/17 passed |
| Chromium actual React Player/hook event wiring | passed; controlled media states/clock and labeled DASH/auth/transport fixtures |

The Chromium wiring check mounts the actual `DashLessonPlayer`, `useViewTracking`, clock, manager and view API module. Five-second pause, buffering and seek gaps produce accumulated totals 1500ms, 2000ms and 2500ms respectively. A never-resolving final transport permits one completion after the deadline; replacing the grant during another pending flush leaves the completion count at one. No browser page errors. Fixture origin is intercepted inside Chromium and Docker networking is disabled. This verifies event wiring, not real DASH playback, external DRM security, a real parent report delivery or a WhatsApp send.

Reproducible harness: `docker/m10-coordinator-review/player-wiring/{build.cjs,entry.tsx,auth.ts,dash.ts,check.mjs}`. Saved output: `player-wiring/out/evidence.json`. Generated bundle is disposable and removed; rebuild it before rerunning.

Representative commands, from the repository root:

```powershell
docker compose -p m10-coordinator-repair -f docker/m10-agent-2/compose.test.yml up -d --wait postgres redis
docker compose -p m10-coordinator-repair -f docker/m10-agent-2/compose.test.yml run --rm migrate
```

Server test runners used `run --rm --volume '<root>/server/src:/review-src:ro' --volume '<root>/server/tests:/review-tests:ro' --entrypoint sh test`, copying each mount into `/srv/server` before `npm run typecheck` or `npx vitest run` with the specific files listed above. Database suites ran sequentially.

Client runner used `fayq-seo-client-test:20261006`, `--rm --network none --label m10.coordinator.review=repair`, current `client/src` mounted read-only, then `vitest run src/features/learning`, `tsc -b` and `vite build`. The browser harness was bundled using that image's esbuild and run with `edu-platform-m10a3-browser:0.1.0`, also network-disabled and labeled for coordinator ownership. No sibling browser container was used or stopped.

## Review boundaries and remaining work

Agent 1's five original repairs are implemented: elapsed clock, bounded start retries/generation guards, heartbeat access/version rechecks, exactly-once threshold claim and safe rollback documentation. Independent database tests exercise the revised server implementation, including concurrent claims and negative authorization cases.

The original review's wider Agent 2 findings remain assigned by `m10-agent-2-repair-prompt.md`: honest per-lesson historical coverage, week-specific assessment achievements and combined summary, coherent snapshots, version-aware presentation, bounded/contextual report parts and pagination/input regressions. Its source had changed since its completion report when this re-review began; the coordinator asked whether the worker was still active and limited cross-ownership changes to the two undefined reader references and the existing media test fixture. Passing the original 17 cases does **not** clear that wider review. Agent 3's final handoff/review is also outstanding. No claim of full M10 completion or acceptance is made.

No full server `test:ci` rerun, real DRM full-stack browser rerun, SSR bundle check or retained-data upgrade drill was claimed for this bounded coordinator repair. Earlier worker evidence remains labeled in its own report.

## Cleanup and rollback

Before cleanup, inspected all three owned containers' exact Compose project labels and every mount. PostgreSQL's sole volume was `m10-coordinator-repair_pgdata-m10a2`; Redis's sole anonymous volume was `0b325f8797698c5d353fabef81240a4cf40ce5d7321c8532f9ee80286141ce1c`, verified attached only to this project's Redis. Migration container had no mounts. Network endpoints belonged only to this project's PostgreSQL/Redis.

After that inspection, `docker compose -p m10-coordinator-repair -f docker/m10-agent-2/compose.test.yml down -v` removed only this disposable stack. Network-disabled test/browser runners used `--rm`. Reusable images and saved evidence were retained. No global prune or sibling/retained-stack cleanup.

Final checks: zero containers, networks or named volumes with project label `m10-coordinator-repair`; zero anonymous volume matching the inspected Redis name; zero containers with `m10.coordinator.review=repair`. No image was built/tagged by this run. Preserved running `edu-platform-m10a3-web-1`, `fayq-local-preview-grading-1` and `fayq-local-materials-materials-minio-1`. The sibling agent-3 browser runner had independently finished by the final snapshot; this coordinator did not stop it. External DRM Git reference difference and all unrelated working-tree changes remain untouched.

Rollback only these coordinator source changes if necessary, preserving worker work and tracking facts. Disable tracking writes for an operational rollback rather than deleting applied migrations or accumulated records. No persisted report artifact was introduced.
