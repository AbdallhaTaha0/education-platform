# M7/M8 local continuation and fresh Docker preview

2026-10-01. Owner assignment: follow the teammate handoff, defer its item 4 (recovery/monitoring), clean obsolete Docker containers/images, and rebuild the local site on port 8080. The owner subsequently explicitly deferred deployment, commercial DRM and capacity qualification as well. This report records direct code review and newly reproduced verification by the same manager agent. It is not a separate-agent review or owner milestone acceptance.

## Result and source

The persistent preview is available at **http://localhost:8080**. The independent external DRM API is available to this PC at **http://localhost:3000**. Both are bound to loopback; database/cache ports are not published. This HTTP development preview deliberately uses development cookies and local ClearKey. Those settings must not be reused for deployment.

`git pull --ff-only` advanced the clean platform checkout from `4b949cc` to `9b4e8ad`. The nested DRM checkout and platform gitlink match `bad0c1df9f5d5844fe365c402fcccfee33ab6906`; its sources remain clean and unchanged. The original architecture and UI specification are preserved.

Read the entry-point documents, teammate handoff, M8 completion and real-video reports, Railway preparation/runbook, relevant Docker files, academic validators, course/package purchasing, entitlement handling, summary queries and upload recovery. The review covered exactly-three-course packages, unpublished-member purchase without playback, explicit indefinite access, Cairo deadlines, immutable purchase snapshots, wallet locking and idempotency, upload reuse constraints, and aggregate-only ADMIN summaries. No new business rule or application source change was introduced.

The teammate's `m8-owner-preview` database and actual owner-video course are not on this PC. Git transfers their source/report, not their local users, volumes or uploaded media records. The exact `fayq-owner-real-video-test` course is absent here. This refresh retains the existing local M5-era records rather than inventing the teammate's data. Both retained media mappings returned 200 through the supported DRM status API. This is availability evidence, not a new browser playback or commercial DRM proof. No R2 object was uploaded, deleted or changed by this continuation.

## Changed files

- `docker/compose.local.yml`, `docker/compose.local-drm.yml`, and `docker/local-preview.mjs`: fresh serving/migration images, localhost ingress, independent DRM wiring, retained external volumes, and a wrapper that checks volumes, mounts, service images and ports before actions. The wrapper never deletes volumes or emits resolved secret configuration.
- `docker/compose.local-review.yml` and `docker/verification/local-m8-review.mjs`: isolated backend/frontend reproduction with checked exits and owned cleanup in `finally`.
- `docker/compose.local-ui-review.yml` and `docker/verification/local-m8-ui-review.mjs`: existing M8 fixtures/browser harness against current serving images, private fixture receipt removed afterward, owned teardown on success/failure.
- `docker/compose.local-release-review.yml` and `docker/verification/local-release-review.mjs`: existing Railway configuration exercised with two production-mode backend replicas in a disposable project, ephemeral fixture signing material, no provider deployment.
- `.gitattributes`, `docker/railway/15-validate-platform-env.sh` and `docker/railway/edge.Dockerfile`: fix the reproduced Windows-to-Linux shell-entrypoint failure. The existing script and future shell checkouts are normalized to LF; the edge build also strips CRLF for older checkouts/archives.
- This report, the bounded remaining-work plan, and the documentation index.

The ignored `docker/local-settings.env.local` contains only the four retained volume names. Existing ignored platform/DRM `.env` files supply credentials; their values were not changed or printed. Backup, full logs, fixture screenshots and scalar results remain in ignored `docker/browser/evidence/local-refresh-20261001/`. No credentials, account identifiers, signed URLs or private media belong in tracked reports. No commits or pushes were made during this review.

## New verification

| Check | Reproduced result |
| --- | --- |
| Serving/migration builds | Seven independent application images rebuilt with `--no-cache --pull`; successful exits |
| Backend typecheck and tests | Typecheck PASS; 174 unit + 272 integration = **446 PASS** on isolated PostgreSQL/Redis |
| Frontend typecheck and tests | Typecheck PASS; **76 Vitest + 2 dash.js checks PASS** |
| M8 browser matrix | **81/81 PASS**, zero page errors; Arabic/English, light/dark, 390/1280 widths, student/admin flows |
| Actual 8080 preview | Six agent-browser checks PASS; RTL landing, desktop/mobile fit, catalog, login form and zero page errors; screenshots inspected |
| Schema upgrade | Existing populated database advanced from seven to **eleven applied migrations**, migration exit 0 |
| Platform readiness | 200, `ready`, version `0.8.0-local`, PostgreSQL/Redis ready |
| Independent DRM health | 200; database, Redis and R2 storage health checks `ok` |
| Platform-to-DRM app authentication | Non-mutating invalid-body probe returned expected 400 after authentication |
| Public signing keys | JWKS 200, one RSA RS256 public key, no private parameters; reachable from independent DRM |
| Retained media references | Two mappings, both external status requests returned 200 |
| Existing R2 CORS for local ADMIN uploads | Presigned-URL OPTIONS returned 204 with exact `http://localhost:8080` origin allowed; no PUT/object creation or bucket changes |
| Railway candidate | Two healthy production-mode replicas; edge paths, public JWKS, Secure/SameSite CSRF cookie and anonymous ADMIN refusal PASS |
| Bounded local catalog smoke | 200 requests, concurrency 20, zero failures, measured p95 **92 ms**; not capacity qualification |

The first Railway candidate failed with exit 127: the Docker entrypoint could not execute `15-validate-platform-env.sh`. A network-free reproduction and byte inspection proved all fifteen lines had CRLF. The LF rule and defensive build normalization corrected this; the complete affected rehearsal then passed. Both failed and passing projects were torn down. No runtime security checks were disabled. A final scan of fourteen changed/new tracked candidates found zero matches against the actual local secret values; JavaScript syntax and whitespace checks passed.

Fresh serving-image IDs recorded by Docker (manifest/image-store IDs, not registry release digests): server `efb003b67e63`, migrate `f43f9eb5d733`, client `5dc2dcd33bc6`, Nginx `d6a8de73a839`; independent DRM API `46bf19e5cca5`, worker `21059a017a5c`, migrate `ee43ed86f672`. All use `:0.8.0-local` tags under the `fayq-platform-*`/`fayq-drm-*` names. The separate repaired Railway edge is `fayq-railway-edge:0.8.0-local-review` and is not deployed.

There was no reason to repeat historical live DRM lifecycle, recovery drills or all earlier milestone suites. The current full platform suite and M8 matrix were each reproduced once; only the faulty edge rehearsal was repeated after its repair.

## Data preservation and cleanup

Before removing old containers, a private custom-format database dump was saved and six sorted projections were hashed. After the migration, all six hashes and row counts matched exactly:

| Preserved projection | Rows | Before/after |
| --- | ---: | --- |
| User IDs | 51 | Identical |
| Course identity, slug and lifecycle state | 1 | Identical |
| Wallet identity, owner and integer-piastre balance | 46 | Identical |
| Media identity, lesson, asset references and state | 2 | Identical |
| Subscription identity, student/course, start and expiry | 42 | Identical |
| Purchase identity, student, amount, duration and creation | 42 | Identical |

Removed **18 obsolete project containers**, their **three empty networks**, **18 obsolete application/test image tags**, and the temporary browser-helper image. No forceful image removal or global prune was used. **All eleven original volumes remain**, including older/orphan volumes of unknown content. The prior DRM Valkey anonymous volume is explicitly reattached as an external volume, so replacement does not silently lose its state.

The three disposable projects (`fayq-m8-review-20261001`, `fayq-m8-ui-review-20261001`, `fayq-release-review-20261001`) each ended with **zero containers, networks and volumes**. UI fixture users/catalog data were removed before teardown; their private credential receipt was removed from the host evidence folder. Scratch browser containers were auto-removed. Reusable fresh review images remain.

Only the two intentional persistent stacks remain: `fayq-local-preview` and `education-drm-service`, with nine running services and two successfully exited migration containers. Build cache was not globally pruned; image cleanup does not imply immediate Windows virtual-disk compaction.

## Reproduction and operation

From the repository root with Docker and Node available:

```powershell
node docker/local-preview.mjs check
node docker/local-preview.mjs status
node docker/local-preview.mjs up
node docker/local-preview.mjs stop
```

`stop` preserves all data. `build` performs the no-cache serving/migration rebuild. The ignored settings file must name the actual existing platform PostgreSQL/Redis and independent DRM PostgreSQL/Valkey volumes; the wrapper refuses missing volumes, unexpected mappings, non-volume mounts and public dependency ports. Do not substitute an empty database or run `down -v` on these persistent projects. Existing ignored `.env` files are required and remain private.

Isolated review commands, after building the appropriate current test images:

```powershell
docker compose -p fayq-m8-review-20261001 -f docker/compose.test.yml -f docker/compose.local-review.yml build test client-test
docker build -f docker/browser/Dockerfile -t fayq-review-browser:0.8.0-local .
node docker/verification/local-m8-review.mjs
node docker/verification/local-m8-ui-review.mjs
node docker/verification/local-release-review.mjs
```

The UI runner defaults to `fayq-review-browser:0.8.0-local` (override with `LOCAL_UI_BROWSER_IMAGE`). The historical Chromium/Puppeteer tool image used for this execution was removed during cleanup; its replacement is built from the current repository Dockerfile. Serving application images must be built from current source; a browser-tool image alone is not application evidence. Fixture data is confined to disposable databases.

## Scope, rollback and remaining gates

Handoff item 1 is reproduced and ready for owner review. Item 2's concrete Railway candidate is prepared and rehearsed locally; deployment is deferred by the owner's subsequent reply, "i won't deploy right now." No services or images were published. Items 3 and 5 are also explicitly deferred by the reply, "don't do this now skip it for now." All five local Widevine fields are empty; local ClearKey does not satisfy commercial DRM. The bounded proposed qualification plan is retained for a future assignment, not execution now.

**Item 4, recovery/monitoring, is explicitly deferred.** No recovery schedules, alert destinations, restore drills, health-monitor automation or external load were configured or run. Ordinary startup/readiness checks and the preservation dump are part of the authorized local replacement, not execution of item 4.

Do not start an older pre-M8 application against this upgraded database: the nullable indefinite-expiry schema is not backward compatible with those application assumptions. Prefer a forward fix. A rollback to older application/schema would require a coordinated, explicitly approved restore of the private pre-upgrade dump and could discard newer writes. All old data volumes remain available; removing obsolete images does not authorize restoring over current data.

M8 functional review, milestone acceptance, Railway deployment, commercial video qualification and 10,000-user capacity are distinct decisions. No production readiness or owner milestone acceptance is inferred from this local refresh.
