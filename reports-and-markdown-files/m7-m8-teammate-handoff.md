# Teammate continuation prompt — M7/M8 checkpoint

Owner instruction, 2026-10-01: commit and push the completed platform work and prepare this handoff. That instruction does not authorize production deployment or certify production readiness. Earlier reports' statements that no commit/push was made describe their execution time; this handoff supersedes that delivery status. M8 implementation is locally complete and ready for owner review; M7 dependency remediation and local operations preparation are complete, with external production gates open.

## Your assignment

Continue this repository from the pushed checkpoint; do not restart the implementation. Read `AGENTS.md`, `reports-and-markdown-files/README.md`, `agent.md`, `rules.md`, `decisions.md` and `design.md` first. Then read `m8-04-completion-report.md`, `m8-owner-real-video-report.md`, `m7-08-railway-preparation-report.md` and `m7-railway-runbook.md`. Work one bounded package at a time. Inspect the actual diff and reproduce relevant checks before recording your review. Distinguish historical evidence, your own newly reproduced results and checks blocked by provider access.

The platform remains React/TypeScript plus ONE modular Express application with PostgreSQL/Prisma, Redis and Nginx. Exactly STUDENT and ADMIN. Arabic is primary; both content translations are mandatory. Cookie authentication and CSRF remain required; never persist authentication tokens in local storage. Wallet amounts are integer piastres, manual recharge requires verified ADMIN approval, and purchases are atomic/idempotent. No live classes or automatic payment provider has been added.

`education-drm-service/` is an independent external API dependency pinned at `bad0c1df9f5d5844fe365c402fcccfee33ab6906`. No nested source edit is included in this checkpoint. Do not access its database from platform code or edit the nested package without a new explicit bounded DRM assignment.

## What is done

M7 packages remediate PostCSS/client and server test tooling, exclude optional Prisma CLI/config dependencies from the serving image, and apply the exact tested `@prisma/config@6.19.3` → `deepmerge-ts: 8.0.2` override. Dependency audits were zero in the documented final scopes. Reassess this override when its parent changes; do not run forceful audit upgrades. Serving, migration and test images have separate dependency responsibilities.

M7-08 supplies the Railway edge image/configuration, migration/release instructions, production-mode two-replica local rehearsal, health monitoring probe, and guarded PostgreSQL backup/restore tools. The restore drill reproduced financial/access records and private proof bytes in a separate database. It is not proof of a scheduled production recovery system. Local catalog smoke measured 200 requests at concurrency 20, zero failures and p95 57 ms; this is not the 10,000 simultaneous-user qualification.

M8 provides the FAYQ youth-oriented landing, brand assets, bilingual dark/light responsive student/admin screens, mobile navigation, academic filtering, package management and aggregate ADMIN summaries. First and second secondary both have terms 1 and 2. Monthly explanation courses and revisions are supported. Summary screens are implemented; CSV remains deferred.

Standalone access may be duration-based, a Cairo term/year deadline, or UNTIL_REMOVAL with null expiry. ADMIN explicitly selects the rule; changes apply only to future purchases. Indefinite access has no expiry notice or expiry-driven playback termination. Fixed-deadline repurchase must add access. Packages contain exactly three specified monthly courses with one price and one shared ADMIN-set deadline. Unpublished members may be purchased with clear presale labels, but cannot be watched until published. Existing ownership warns without blocking a package or shortening longer access. Purchase snapshots remain immutable. The two new migrations bring the schema to eleven migrations; populated 9→11 upgrade preservation was verified. Never rewrite applied migrations.

The owner provided a real MP4. It was uploaded through ADMIN, processed in private R2 by the unchanged external DRM, published and purchased using synthetic funds. Chromium proved actual protected student playback. Interrupted uploads now safely reissue a URL for the same pending, uncompleted asset; completed/replaced assets are refused and URLs are not stored. This demonstrates local ClearKey, not production commercial Widevine.

Final server regression after the upload repair: **174 unit + 272 integration = 446**, with typecheck passing. Earlier final M8 evidence: **76 client Vitest + 2 dash.js checks**, production client build/typecheck, **81 browser checks**, migration failure gate and upgrade drill. The later server-only fix did not rerun the client matrix; report counts with their actual provenance. Reports document failed attempts and harness corrections.

## Local review and reproduction

The owner's current persistent site is http://localhost:8080. The real course is `/#/learn/fayq-owner-real-video-test`. R2 already allows the local 8080/8081 origins; no bucket CORS change was made. Historical previews on 8082/8083/8084 remain preserved. `m8-owner-preview` and `m8-owner-drm` are intentionally retained owner environments, not disposable tests. Accounts, ignored connection settings and local media/data do not travel through Git. Ask the owner for credentials through a private channel; do not write them into reports or commits. A fresh clone must provision its own local secrets and external DRM environment through the documented setup; pushed source alone cannot reproduce this machine's signed URLs, R2 objects or database accounts.

For backend reproduction in Docker, choose a NEW project name such as `teammate-m7m8-review`. Build the current source rather than trusting cached historical tags:

```powershell
docker compose -p teammate-m7m8-review -f docker/compose.test.yml build migrate test client-test
docker compose -p teammate-m7m8-review -f docker/compose.test.yml up -d --wait postgres redis
docker compose -p teammate-m7m8-review -f docker/compose.test.yml run --rm migrate
docker compose -p teammate-m7m8-review -f docker/compose.test.yml run --rm test npm run typecheck
docker compose -p teammate-m7m8-review -f docker/compose.test.yml run --rm test npm run test:ci
docker compose -p teammate-m7m8-review -f docker/compose.test.yml run --rm client-test npm run typecheck
docker compose -p teammate-m7m8-review -f docker/compose.test.yml run --rm client-test npm test
```

Inspect every command's exit status; stop dependent verification if migration fails. Use the final UI/runtime/upgrade harnesses under `docker/browser/` and `docker/verification/` for the relevant package, adapting only project names and current image tags. Do not point fixtures at the owner's preview. Build contexts exclude ignored browser evidence. Do not import synthetic accounts, reduced-cost test settings or fixture signing keys into production.

## What to do next, one package at a time

1. Review the pushed M7/M8 implementation and reproduce critical purchase/access/upload checks in isolation. Fix evidenced defects, preserve approved policies and report file changes, migration impact, results and cleanup. Do not invent new M8 features.
2. Prepare the concrete Railway release using `m7-railway-runbook.md`: separate edge, replicated backend, PostgreSQL, Redis and migration image; correct private networking, HTTPS, cookies, secrets and independent DRM endpoints. Obtain the owner's provider access and domain choice. Produce a reviewable configuration before requesting permission for paid provisioning or production deployment. The current handoff does not grant that permission.
3. Qualify production video with actual commercial DRM credentials and the final website's exact R2/browser origin. Preserve private media and entitlement/publication enforcement. Do not use ClearKey or weaken authentication to close the gate.
4. Configure and verify recovery/monitoring. Delegated business targets: RPO 15 minutes, RTO 4 hours, roughly four weeks of PITR and separately encrypted daily exports retained 30 days. Verify provider capabilities, actual schedules, alert destination and a timed restore; the local tools do not enable these automatically.
5. Define and run the approved 10,000 simultaneous-user workload with realistic catalog, authenticated purchase, notification and protected-playback behavior, resource sizing and cost limits. Record bottlenecks and measured results. Do not extrapolate from the small local smoke.
6. Submit the evidence and remaining decisions for owner milestone acceptance and final deployment approval. Keep M8 functional completion separate from M7 production qualification.

If access or credentials are missing, identify the exact blocked check and continue independent preparation. Do not claim the gate passed or silently replace the service.

## Mandatory Docker cleanup and reporting

After success, failure, interruption or stop, clean YOUR disposable Docker test environment. First verify Compose project labels and every resolved mount. Remove only owned test containers, networks, named/anonymous volumes and synthetic fixtures; retain evidence and reusable images. Preserve the owner's `m8-owner-preview`, `m8-owner-drm`, real video, R2 data and unrelated previews/projects. No global Docker prune or broad deletion.

For the example project, after confirming ownership:

```powershell
docker compose -p teammate-m7m8-review -f docker/compose.test.yml down -v
docker ps -a --filter label=com.docker.compose.project=teammate-m7m8-review
docker volume ls --filter label=com.docker.compose.project=teammate-m7m8-review
docker network ls --filter label=com.docker.compose.project=teammate-m7m8-review
```

Track anonymous volumes from the initial mount inventory and confirm they are removed too. Each package report must include changed files, requirement/decision mapping, commands and actual exit/results, failures and reruns, security/configuration/migration impact, rollback limits, remaining external gates and final cleanup evidence. Never include secrets, signed URLs, real proof/media contents or account passwords in tracked evidence.
