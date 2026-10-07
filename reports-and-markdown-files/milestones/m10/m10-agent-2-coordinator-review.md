# M10 agent 2 coordinator review

2026-10-07, Africa/Cairo. Verdict: REPAIRS REQUIRED. No package/milestone acceptance, production action, retained-preview upgrade, commit or push. Agent 1 repairs remain an independent integration gate.

## Findings

1. P2 — Unknown weeks are labeled not viewed. reportServer.ts:204-219 checks tracking===null but not whether an entire week precedes trackingStartedAt. The coverage note correctly says unknown while the individual lesson line says not viewed. Controlled generation with tracking beginning three days before the cutoff produces Week 1/4: "This week falls entirely before tracking began; viewing is unknown" followed by "Lesson A: not viewed". Partial tracking/membership periods also require honest per-lesson status, and lessons added later must not be described as missed before they existed. Repair classification, not just disclaimer copy.

2. P2 — Weekly assessment sections inherit later outcomes. reportServer.ts:226-234 applies passes and latest submission at the overall cutoff to every week. A pass earned in Week 4 appears as passed in Week 1/2/3. This makes composed reports misleading. Put present earned status in a clearly labeled overall summary, and derive weekly attempts/pass achievements from events within the relevant week; do not invent historical pending/failure states that existing records cannot reconstruct. Preserve earned passes without retroactively attributing them to earlier weeks. Include the deduplicated combined-period summary specified in the plan; the current template only repeats weekly lists.

3. P2 — Cutoff excludes neither future threshold transitions nor all boundary ambiguity. viewFacts.ts:85-91 selects startedAt in the window and countedAt IS NOT NULL without countedAt<cutoff. A real PostgreSQL probe placed a synthetic session start one second before cutoff and its countedAt one second after; sessionsInWindow returned it. Also, a session starting before a weekly boundary and counting afterward is assigned using start time rather than the frozen tracking contract's threshold/count timestamp. Align weekly event semantics with countedAt and enforce half-open cutoff boundaries. All contributing reads need consistent report generation semantics; a shared Date alone does not establish a database snapshot.

4. P2 — Per-video identity/coverage mixes platform and DRM IDs. reportService.ts:187/210 returns MediaMapping.assetId, which is an opaque external DRM asset ID. Agent 1 stores MediaMapping.id as mediaAssetId. The detail DTO therefore identifies a different namespace. It also sums historical-version totals against that current identifier. lessonCoverage marks a replaced lesson KNOWN when only its old media has counted views because there is only one recorded version. Return the agreed platform mapping identity and compare historical facts with current media explicitly; distinguish current-version count/status and old-version evidence without losing the owner's counts or claiming the replacement was viewed. Coordinate any DTO extension with agent 3; do not edit the producer's schema.

5. P2 — Long text parts are not bounded. text.ts:191-216 splits only between lines; a line longer than 1000 remains intact, and numbering is appended after the limit check. A Docker probe returned one 2500-character part while MAX_PART_CHARS=1000. Course/lesson titles or accumulated report content must not break click-to-chat handling or be truncated. Split oversized lines safely, account for the final label and encoded URL budget, preserve text exactly, and keep sufficient student/course/week context in each part. Use WhatsApp-readable emphasis and a clear deduplicated summary as requested by the owner.

Additional validation defects to address in the same bounded repair: studentCourseViews decodes a cursor lesson but does not verify it belongs to the requested course; an unknown cursor silently resets paging. Roster q is silently sliced to 100 while the handoff claims a 400. Null generation bodies can throw instead of returning validation. Test these with malformed/cross-course inputs. The roster's archive/publication comments and API eligibility prose contradict actual historical roster behavior; document current-vs-history clearly without changing owner access policy.

## Independent verification

- Owned project m10-coordinator-a2 created from docker/m10-agent-2/compose.test.yml using retained reusable test/migrate images, no image rebuild.
- Real fresh PostgreSQL/Redis; actual 25 migrations including 20261007100000_m10_view_tracking applied successfully.
- Current server src/tests mounted read-only and copied into the disposable runner filesystem. Docker Vitest: tests/integration/m10-parent-reports.test.ts 17/17 PASS. No full 437/572 suite rerun is claimed.
- docker/m10-coordinator-review/agent2-probes.cjs: controlled generation reproduced pre-tracking not-viewed/later-pass errors; actual PostgreSQL ViewFactsReader reproduced post-cutoff counted session inclusion; pure text probe reproduced 2500-character output under a 1000-character limit.
- Initial controlled-generation probe transpiled with TypeScript's old default target and incorrectly omitted Set iteration. Rerun using ES2022 restored actual code behavior; only the corrected probe output supports findings. This was review setup, not a product defect.
- No report sending, real parent contact, private owner fixture or WhatsApp navigation was used. Probe inputs and database contents are synthetic. Test request logging showed redacted cookie/CSRF and did not emit generated report text; no broader logging audit is claimed.

## Cleanup and outcome

Before cleanup inspected project labels and all mounts: PostgreSQL named volume m10-coordinator-a2_pgdata-m10a2; Redis exact owned anonymous /data volume ac6b4b11182260638904881441865de3d0ed9741822a86365b43506a46307a69; migration no mounts; network project label m10-coordinator-a2. Remove only this owned stack and verify named/anonymous volume absence. Preserve workers' resources, previews, DRM, reusable images and evidence; no global prune. Final cleanup results are recorded after removal.

Final cleanup: docker compose down -v removed the three owned services, named PostgreSQL volume and owned network. Subsequent project container, named-volume, exact anonymous Redis-volume and network checks all returned no entries. No owned review resource remains; peer/retained resources and reusable images were preserved.

Agent 3 may continue UI work on stable routes, but report semantics/media DTO integration and final end-to-end acceptance wait for repair. The repair prompt is m10-agent-2-repair-prompt.md. No prompt was dispatched and no worker implementation files were changed during this review.
