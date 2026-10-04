# Demo video failure — device identity repair and bounded recovery proposal

Owner authorization, 2026-10-04: the owner answered **yes** to the bounded external device-recovery assignment below and additionally requested an improvement review. This explicitly authorizes only the described external API/device recovery, regressions and local verification; earlier pending-authorization statements are historical. No feature-agent launch, production deployment, limit increase or commit/push is inferred.

Recovery outcome: [completed API recovery, real playback/fullscreen evidence and improvement review](course-video-recovery-20261004.md). The pending-approval wording and blocked playback below describe the earlier diagnosis, not the current recovered preview.

2026-10-04, Africa/Cairo. Owner reports that demo videos do not work. This defect work is separate from the pending four-feature plan and its two prepared OpenCode prompts.

## Confirmed cause

Reproduced the Arabic student page and pressed Start lesson. The platform returned HTTP 503 `PLAYBACK_UNAVAILABLE` before mounting a video. A Docker API probe using the selected existing student's cookie/CSRF session reproduced it. A trusted diagnostic inside the platform container minted the same signed assertion from platform records and called the **external API**, which returned HTTP **403 `DEVICE_LIMIT_EXCEEDED`**. Issuer/audience configuration matched; the external service was running. No DRM database was queried.

The platform's `deviceId()` claimed a stable browser identity but saved it only in `sessionStorage`, creating another identity for each new tab. The external service keeps device registrations, including after a playback session ends. Closing a tab therefore does not release its device slot. This behavior exhausts the account's slots during ordinary new-tab use and repeated browser tests. No video re-upload, quiz reset or device-limit increase is needed to address this identity defect.

## Platform repair (authorized defect scope)

- Persist **only the non-credential browser installation ID** across tabs in localStorage; existing auth/session/playback credentials remain in protected cookies or transient player memory and are never written there.
- Migrate an existing tab's legacy ID on first use when no persistent ID exists, preserving its existing registration. Prefer the shared persistent ID on subsequent tabs; use a stable in-memory fallback if browser storage is blocked.
- Validate saved IDs and generate fresh IDs with browser crypto. Clearing browser site storage intentionally makes a new installation; it does not bypass provider device limits.
- Recognize only three external playback-denial codes on the exact session-creation route and expected HTTP 403: device limit, revoked device, concurrent stream limit. Return safe platform categories and Arabic/English actionable messages. Unknown responses remain generic; raw provider error bodies, keys, IDs and tokens are not forwarded or logged.
- Device limits/revocation/concurrency remain enforced by the external service. This repair prevents recurrence; it **cannot clear registrations already accumulated**.

The repair is deployed on the retained localhost:8080 platform. It does not restore playback on an already saturated account; recovery and an advancing-time browser check remain pending explicit authorization below.

## Verification and retained-preview update

- Docker frontend: **93 Vitest tests and 2 DASH compatibility checks passed**. Five new device-ID regressions cover tabs/reload, legacy migration, a shared identity versus older tab IDs, blocked storage and invalid stored values. Production frontend build/typecheck passed.
- Docker backend: **191 unit tests passed**, including exact-route/status/allowlist handling, private upstream body suppression, no unsafe retries and safe learning-denial propagation before reference creation. Backend source/tests typecheck and runtime build passed.
- Disposable Docker integration: **28 learning-playback tests passed**, covering real platform routes/persistence with a labelled external HTTP fixture. This is not real DRM playback evidence.
- Retained real API after upgrade: selected account login succeeds; starting the demo now returns **403 `PLAYBACK_DEVICE_LIMIT`**, with a safe support-oriented message instead of misleading generic 503. The external limit remains enforced; no registrations, sessions, subscriptions, passes or wallet records were reset.
- In-app browser reproduced the original failure and verified the repaired Arabic support-oriented error; [screenshot](course-video-device-limit-20261004.png). No advancing-time playback is claimed while recovery is blocked. The agent-created browser tab was closed after inspection.
- Preview update passed the existing retained-volume/project guard. Replaced only platform server/client images and recreated Nginx to refresh upstream addresses; no migration, data-volume recreation or external service/configuration change.
- Serving images: backend `sha256:692809dd938d328a6c83b9f529dc20c6beb46a53ec89f3320480840eede2284a`, client `sha256:9fd506a723d8ec5c57f05fdb684cb8572b8582bd1bd5e8b172e9f9377d6327af`.
- Rollback tags preserve the pre-repair server/client under `fayq-platform-server:before-course-device-fix-20261004` and `fayq-platform-client:before-course-device-fix-20261004`. Reassign the normal preview tags to those images, recreate only server/client and Nginx with the existing compose/env files; do not migrate/reset volumes. Rollback restores the tab-ID bug and generic message, not device-slot availability.
- Cleanup: inspected disposable project labels and all resolved mounts before `down -v`; removed only `fayq-course-video-test-20261004` PostgreSQL/cache/migration resources. All other test/probe/typecheck containers used exact task labels and `--rm`. Final label checks found **zero owned test containers/networks/volumes**. Existing preview/DRM/data/images/private evidence are preserved; no global prune. External checkout is clean.

Changed implementation files: `client/src/features/learning/hooks/device.ts`, `device.test.ts`, `useLearning.ts`, `client/src/features/learning/pages/CourseLearningPage.tsx`, `server/src/modules/catalog/drmClient.ts`, `server/src/modules/learning/errors.ts`, `server/src/modules/learning/playback/service.ts`, and two focused backend unit-test files. These are platform changes only; the previous curriculum/fullscreen diff remains intact.

## Separate bounded external-maintenance approval requested

Root `AGENTS.md` states: “A DRM defect is authorization to repair that package only when the owner's explicit DRM-maintenance prompt assigns it.” The current public external API has no device-list/reset endpoint. Existing explicit maintenance approvals cover other named tasks, not device recovery. Therefore no external source change or direct database cleanup has been performed.

Proposed explicit assignment for approval:

> Implement only a tenant-scoped, application-authenticated device inspection/release API in the independently deployed `education-drm-service/`, plus regressions and Docker/browser verification. Then use that API to release stale device registrations for the local synthetic student `m8-final-39b72377-c7fe-42aa-b0c2-126324446131-student@example.test` so its demo videos can play. Preserve all uploaded assets, accounts, subscriptions, quiz/assignment passes and learning progress. Do not increase device/stream limits, disable DRM, access external persistence from platform code, or change unrelated external modules. No production deployment, commit/push or milestone acceptance.

Concrete safety/acceptance contract for that assignment:

1. Use application credentials and derive tenant solely from authenticated application. Resolve the platform student's opaque external user ID through trusted platform records; never accept another application's override. List only safe device metadata and activity state; no IP, secrets or unneeded identifiers.
2. Release a specifically selected **inactive ACTIVE** registration, idempotently and with an audit record, under the same per-user lock used by session creation. Refuse a device with an active, unexpired playback session. Preserve session/audit history and ensure the released browser can legitimately re-register without changing the maximum allowed devices. Correction from direct repository inspection: the current device count includes **ACTIVE registrations only**, not REVOKED rows as the earlier proposal incorrectly stated. Do not change a revocation to recover a slot or re-enable a banned device; preserve REVOKED registrations.
3. Use the new API to inspect this synthetic account and release only stale/inactive registrations needed for recovery. Preserve any active owner playback. If no inactive slots can be released, report that constraint instead of terminating owner sessions without authorization.
4. Test tenant isolation, missing/wrong credentials, active-device refusal, stale-session handling, repeated release, concurrent register/release and audit consistency. Keep platform business persistence/API boundary unchanged; platform code never queries DRM tables.
5. Reproduce real playback with advancing currentTime and fullscreen on the demo first lesson using the stable browser ID. Leave official assessment submissions to the owner and preserve current passes. Clean only owned Docker test resources after success, failure or stop, checking project labels and resolved mounts first; preserve retained preview/DRM/data/evidence and never prune globally.

This proposal is not an authorization to edit the nested package. Owner approval must explicitly assign this bounded device-maintenance task.
