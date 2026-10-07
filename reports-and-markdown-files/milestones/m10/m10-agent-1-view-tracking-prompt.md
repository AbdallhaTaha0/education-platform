# OpenCode agent 1 — M10 video-view tracking

Implement this package only, concurrently with agents 2 and 3, then stop for coordinator review. Do not launch/delegate agents yourself. Read m10-parallel-contract.md first and obey exclusive file ownership and its fixed persistence contract. This prompt is prepared for dispatch; preparing it did not implement M10.

## Read first

Root AGENTS.md; reports-and-markdown-files/README.md, agent.md, rules.md, decisions.md, design.md, and milestones/m10/m10-parent-reports-plan.md. Inspect existing changes and preserve them, including the nested DRM Git-reference difference. Later owner clarifications in the M10 plan govern counting.

## Your one responsibility

Deliver platform-owned video-view tracking, including its player integration. No course-roster UI, parent report generation or WhatsApp implementation.

1. Inspect server/src/modules/learning/, server/prisma/schema.prisma, client/src/features/learning/player/Player.tsx, player/session.ts, pages/CourseLearningPage.tsx and existing progress APIs. Preserve current resume/completion, DRM recovery, watermark, fullscreen and entitlement behavior.
2. Define and implement a bounded viewing-session contract. A session counts ONCE after 30 seconds of actual playing time. Continued playback at 60/90 seconds adds nothing. A page refresh, successful playback reconnect or later new viewing session starts a new countable session with a fresh 30-second threshold. Failed reconnect attempts do not count. Pause/resume and token renewal without a restart stay in the same session. Seeking/buffering are not playing time. Deduplicate repeated telemetry, React remount effects and transport retries within one session; do not deduplicate away the owner's intentional refresh/reconnect counts.
3. Document successful-reconnect detection from the real player's lifecycle. Do not infer a new view from every network retry or external session renewal. Use authenticated platform identity and validate course/lesson/media/playback binding and current access server-side. Use existing Origin/CSRF, validation and rate-limiting patterns. Client measurements represent reported playback activity, not proof of human attention; never claim fraud-proof tracking.
4. Add the additive, indexed M10VideoViewSession and M10ViewTrackingState schema defined in m10-parallel-contract.md; you exclusively own schema/migration edits. Publish field semantics and migration path early in your handoff so agent 2 can integrate while you finish. Preserve existing LessonProgress and all accepted migration checksums. Counts must survive restarts and concurrent requests/replicas without duplicates. Bind facts to the actual media version so replacing video does not misattribute old views. Do not turn old completion rows into historical view counts. Record tracking coverage so agent 2 can distinguish unknown from zero. Do not invent raw-event retention/deletion policies. State the treatment of videos shorter than 30 seconds without silently lowering the approved threshold.
5. Use bounded telemetry frequency, payload sizes and queries; no request per video frame. Tracking failure must not break legitimate playback, and retries must not inflate counts. Never store login or playback credentials in browser persistence or new database rows.

## Required verification

Use Docker and synthetic data. Verify 29s=0, 30s=1, 90s continuous=1; refresh/reconnect followed by 30s creates another count; failed reconnect=0; pause/resume/renewal does not add a count; seek/buffer does not advance playing time; duplicate/concurrent writes count once. Check role/ownership, expiry, wrong course/media, replacement, retry and October/November separation. Run affected backend/client checks, typechecks and a real-browser player-to-API counting flow. Contract fixtures prove platform integration only, not real DRM security. Show migration upgrade preservation in a disposable database. No owner-data fixture or DRM edit.

## Handoff and limits

Write milestones/m10/m10-agent-1-report.md and m10-view-tracking-contract.md under reports-and-markdown-files/. Provide exact methods/paths, request/response/error shapes, session restart rules, tables/indexes, coverage meaning and aggregate queries needed by agent 2. Include changed files, M10 requirement mapping, actual Docker commands/results, failures/skips/blockers and rollback guidance. Stop for review; do not claim milestone acceptance.

Preserve one Express backend, exactly STUDENT/ADMIN, cookie authentication and API-only external DRM. No nested DRM edits, entitlement/purchase changes, paid services, production deployment, retained-preview upgrade, commit or push.

## Mandatory Docker cleanup

After success, failure, interruption or stop, clean every disposable test resource you created. Before removal verify exact project labels, resolved container/network/volume names and EVERY mount; remove only owned test containers, networks, volumes (including verified owned anonymous mounts) and fixtures. Preserve existing previews/data, unrelated projects, reusable images and evidence. Never use global prune or down -v on retained platform/DRM projects. Report the final owned-resource check and anything that could not safely be removed.
