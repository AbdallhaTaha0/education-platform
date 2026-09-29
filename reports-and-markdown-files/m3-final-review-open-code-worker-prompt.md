# Open Code worker prompt — M3 final independent review and correction

## Role and repository layout

You are the Open Code implementation worker performing a bounded final correction and evidence pass under independent manager review. The owner will paste this prompt into your session. Do not delegate the acceptance decision, declare the milestone accepted, or treat a prior worker summary as proof.

The working directory must be the platform repository root containing:

```text
./
├── client/
├── server/
├── docker/
├── reports-and-markdown-files/
└── education-drm-service/   # independent nested repository
```

If that layout is not present, locate the directory containing both `AGENTS.md` and `reports-and-markdown-files/README.md` before running dependent commands. Run platform commands from that root and nested DRM commands only from `education-drm-service/`.

## Start condition and authority

Start this assignment only after both bounded DRM workers have stopped and the manager's focused timing-race correction is present in the uncommitted tree: (1) upload-URL recovery, (2) the separately owner-authorized processing job-status correction, and (3) the manager-completed deterministic recovery-test correction recorded in both DRM reports. Read all implementation evidence before reviewing the combined result.

Read all of the following before planning or editing:

```text
AGENTS.md
reports-and-markdown-files/README.md
reports-and-markdown-files/agent.md
reports-and-markdown-files/rules.md
reports-and-markdown-files/decisions.md
reports-and-markdown-files/requirements.md
reports-and-markdown-files/confirmed-flows.md
reports-and-markdown-files/architecture.md
reports-and-markdown-files/plan.md
reports-and-markdown-files/implementation-plan.md
reports-and-markdown-files/schema.md
reports-and-markdown-files/drm-integration.md
reports-and-markdown-files/docker-and-operations.md
reports-and-markdown-files/test-and-review-plan.md
reports-and-markdown-files/design.md
reports-and-markdown-files/m2-implementation-report.md
reports-and-markdown-files/drm-media-deletion-implementation-report.md
reports-and-markdown-files/m3-implementation-report.md
reports-and-markdown-files/drm-upload-url-recovery-open-code-worker-prompt.md
reports-and-markdown-files/drm-upload-url-recovery-implementation-report.md
reports-and-markdown-files/drm-job-status-correction-open-code-worker-prompt.md
reports-and-markdown-files/drm-job-status-correction-implementation-report.md
reports-and-markdown-files/drm-job-status-review-correction-open-code-worker-prompt.md
```

Then inspect the actual platform and DRM API code. Reports are evidence to reproduce, not unquestionable proof. Do not modify `design.md`, the owner's system-design image, or the original DRM PDF.

Inspect and record both Git working trees before doing anything:

- platform root revision, branch, remote revision, status, and diff;
- nested `education-drm-service/` revision, branch, remote revision, status, and diff;
- accepted M1 `fce352f`, accepted M2 `b8080a8`, and accepted DRM deletion prerequisite `6e1e01c`;
- the complete uncommitted M3 platform work and uncommitted DRM upload-recovery work.

Preserve every valid existing change. Do not reset, clean, checkout over, stash, amend, or discard another worker's files. Do not commit, push, deploy, open a PR, provision paid services, remove development volumes, or run destructive database commands. Leave the final result uncommitted for manager review.

The manager, not this worker, will decide acceptance and perform any eventual milestone commit and push. Never make the worktree look clean by deleting or hiding uncommitted work.

This is an independent M3 platform review. The nested DRM package is read-only in this assignment. You may inspect and test the authorized DRM upload-recovery diff, but do not edit it. If the DRM implementation has a defect, document the exact evidence and stop that dependent verification; a separate explicit DRM correction assignment is required.

## Preserved architecture and exclusions

Preserve these non-negotiable constraints:

- Arabic is primary/default RTL; English is secondary LTR; required course content has both translations.
- Exactly `STUDENT` and `ADMIN` roles exist.
- The frontend is React/TypeScript.
- The backend is one horizontally replicable Express/TypeScript application with internal modules behind Nginx.
- Platform persistence is PostgreSQL/Prisma; Redis supports runtime coordination.
- Authentication/session credentials use protected cookies, never browser storage.
- The DRM service is independently deployed and consumed only through HTTP APIs.
- Platform code never queries DRM tables, imports DRM packages, accesses DRM queues, receives storage credentials, processes video, or manages DRM keys/watermarks.
- Cloudflare R2 is production video storage through the DRM service.
- Docker is required for development, tests, and packaging.
- 10,000 concurrent users is a future qualification target, not demonstrated capacity.

M3 covers catalog, administration, lifecycle, pricing, media registration/upload coordination, deletion coordination, and the platform DRM HTTP adapter. Do not implement wallet operations, recharge approval, purchasing, subscriptions, entitlement enforcement, playback authorization, lesson progress, refunds, renewals, notifications, new roles, live classes, or unrelated refactors.

## Known starting evidence — verify, do not trust blindly

The current handoff reports 76 unit, 108 integration, and 58 browser assertions passing, with lint/typecheck clean. Reproduce the relevant suites yourself in Docker and report actual counts. Do not copy prior PASS claims without execution evidence.

The platform also contains a later isolated frontend correction that must be retained and reviewed:

- `client/Dockerfile` copies `postcss.config.js` and `tailwind.config.js` into the build stage so the production image contains generated Tailwind utilities;
- the home route uses one `<main id="main">` landmark and one primary `<h1>`;
- reusable home content is extracted to `client/src/features/home/pages/HomePage.tsx` rather than enlarging `App.tsx`;
- the stale “M1 foundation environment” footer was replaced in both Arabic and English;
- the corrected frontend production image builds successfully in Docker and the live page has no console errors or horizontal overflow.

Independently verify these statements and add regression coverage where useful. Do not regress the accepted M1/M2 identity behavior.

## Objective

Perform the final source review, integration review, and Docker reproduction needed to determine whether M3 can be accepted after the authorized DRM upload-URL recovery change. Fix only evidence-backed platform defects within M3 scope. Update the M3 report truthfully with final evidence and remaining blockers.

Review actual code and behavior, not only the report. Prioritize:

1. authorization, origin, CSRF, cookie, and ADMIN boundaries;
2. course-scoped transaction ordering and lock-then-validate behavior;
3. retry-safe media registration/completion without network I/O inside database transactions;
4. compatibility with the recovered DRM idempotent registration response;
5. replica-safe, restart-safe permanent deletion and external-storage release coordination;
6. public catalog privacy: never reveal lessons or media identifiers before subscription scope permits it;
7. lifecycle, archive/unarchive, deterministic ordering, compare-at pricing, and bilingual validation;
8. production frontend packaging, responsive Arabic RTL/English LTR behavior, accessibility landmarks, and failure/retry states;
9. migrations, startup gating, non-root/minimal images, secret redaction, and rollback safety.

## Frontend and clean-code rules

Use Tailwind CSS for platform UI changes. Do not reintroduce large handwritten component CSS or a CDN. Keep `styles.css` limited to Tailwind entry directives, centrally revisable tokens/base behavior, and genuinely global accessibility rules.

Maintain the feature-based structure under `client/src/features/*`, shared UI under `client/src/components/ui/*`, layout components under `client/src/components/layout/*`, and translations under `client/src/locales/*`. Prefer small focused components and hooks. Do not create god files. Handwritten production files should preferably remain below 200 lines; any file above 250 lines must be decomposed unless there is a strong documented reason. Apply the same single-responsibility approach to backend modules instead of growing service or route files.

Do not change the owner's semantic design tokens without evidence and an explicit reason. Preserve Arabic as the default, RTL/LTR switching, both mandatory translations, 390px no-horizontal-overflow behavior, EGP display, and cookie-only authentication.

## Upload-URL recovery acceptance

After the DRM worker finishes, verify the nested implementation independently and then prove the platform consumes it correctly:

- a first registration returns one asset and an upload URL;
- a lost-response/lost-platform-write retry uses the same external identity and returns the same DRM asset with a fresh usable URL;
- the retry creates no replacement asset, orphan object, duplicate job, or duplicate platform mapping;
- concurrent retries converge safely;
- the recovered URL can PUT the original file and complete the existing asset;
- recovery is rejected after the asset leaves its eligible upload state;
- tenant authentication and ownership isolation remain intact;
- signed URLs, object keys, credentials, and secrets are never persisted or logged;
- the platform still fails safely with `UPLOAD_URL_UNAVAILABLE` or `DRM_MALFORMED` if an incompatible or malformed provider response is encountered.

Use a real disposable local PostgreSQL/Redis/S3-compatible DRM topology where the DRM package supports it. A labeled platform fixture may verify platform branches but cannot replace independent DRM recovery proof. Do not call local fixture behavior “real external DRM” or “Cloudflare R2.”

## Required Docker verification

Use separately named disposable Compose projects and preserve the development database and volumes. At minimum reproduce and record:

- complete server unit and integration suites;
- complete browser workflow through Nginx, including a real selected video file;
- frontend production Docker build with Tailwind utilities present in the emitted CSS;
- one main landmark/ID and one H1 on the home route, Arabic default RTL, English LTR, and no overflow at 390px;
- fresh M1 → M2 → M3 → corrections migration on an empty disposable database;
- upgrade migration against preserved development data without reset;
- migration failure gating server startup;
- unconfigured/partial/production-insecure DRM configuration rejection;
- two-replica deletion lease/concurrency, restart recovery, failure retention, and retry-to-completion;
- registration lost-write, timeout, concurrency, recovered-URL PUT/completion, and no open transaction during external delay;
- runtime image contents, non-root users, source/test/fixture exclusion, secret scans, and dependency audits;
- `git diff --check`, typecheck, and lint where configured.

Add focused regression tests for every defect you change. Do not weaken assertions or delete tests to obtain a green result. Record failures and blocked checks explicitly.

Before running destructive, migration-failure, browser, or integration scenarios, confirm they target a separately named disposable Compose project with separate volumes. Use `down -v` only for those disposable projects. Never use `down -v`, `migrate reset`, destructive SQL, or volume removal against the development project. Confirm a normal service restart preserves development data.

Do not print secrets. Do not overwrite an existing `.env`. Confirm `.env` remains ignored. Use local/test-only credentials and never copy DRM or storage credentials into frontend configuration.

## Reports and handoff

Update `reports-and-markdown-files/m3-implementation-report.md` only after inspecting both current diffs and executing the verification. Reconcile stale claims, commands, counts, file lists, image IDs, recovery behavior, and blocker language. Preserve the separate DRM recovery report as independent evidence.

The final M3 report must include:

- starting and ending revisions/status for both repositories;
- exact platform files changed by this review and why;
- all Docker commands actually run, test counts, image IDs, and PASS/FAIL/BLOCKED results;
- contract and concurrency evidence for upload recovery and deletion;
- Tailwind production-build and accessibility/responsive evidence;
- migration/configuration impact, audit findings, rollback instructions, and remaining risks;
- confirmation that no commit, push, deployment, PR, production data deletion, or development-volume removal occurred.

If no live Cloudflare R2 credentials are supplied, retain this exact blocker:

`BLOCKED — live Cloudflare R2 and real external DRM upload/deletion verification could not be performed because the required DRM endpoint, application credentials, and R2-backed external configuration were not supplied.`

Do not retain the old upload-URL contract blocker if and only if the authorized DRM recovery change passes independent verification and the platform integration is proven compatible. Otherwise report the precise failure and keep M3 blocked. Do not claim production readiness, M3 acceptance, or 10,000-user capacity; the manager decides acceptance after reviewing the actual diff and evidence.

## Expected first response and final response

Do not merely describe a future plan. First perform the safe read-only onboarding checks. Your first progress response must state:

1. platform branch, HEAD, `origin/main`, and dirty/clean status;
2. nested DRM branch, HEAD, `origin/main`, and dirty/clean status;
3. whether the platform Git link still points to the accepted DRM baseline;
4. Docker Engine and Compose versions;
5. development-stack health without modifying volumes;
6. the exact uncommitted work you will preserve;
7. any mismatch or blocker before dependent work.

Your final response must give the owner a concise handoff: actual files changed, defects fixed, Docker commands run, exact test counts, image IDs, PASS/FAIL/BLOCKED results, reports updated, remaining blockers, and rollback instructions. Explicitly confirm that changes remain uncommitted and that you did not push, deploy, open a PR, alter production data, remove development volumes, or edit the nested DRM package.
