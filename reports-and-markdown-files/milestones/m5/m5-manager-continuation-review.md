# M5 manager continuation review

Date: 2026-10-01. Assignment: recover the interrupted OpenCode work, review it,
and continue implementation directly. This report supplements the historical
M5 and pre-M5 reports; it does not retroactively change their evidence.

## Current status

Platform HEAD is `b04d84f`; the nested DRM checkout and parent gitlink both
record `015392b`. M5 implementation was already committed before this closure.
The closure changes are uncommitted. There is no `.gitmodules`: this is a
gitlink-only nested repository, not a registered submodule.

Traceability: R06 (authorized dashboard/lessons), R08 (external DRM API boundary),
R10 (Docker and isolation), R11 (preserved architecture), R13 (cookie credentials,
no browser credential storage), R14 (expiry and renewal UI), R15 (real R2 through
DRM), and explicit D24 (bounded recorded-manifest maintenance). R12's capacity
target remains unqualified; local playback success does not establish it.

The assigned M5 local functional continuation is **PASS, ready for owner
review**: the authorized [recorded-manifest repair](../../drm/drm-recorded-manifest-repair-proposal.md),
148 DRM regression tests and the final 65-check real-browser journey passed.
Changes remain uncommitted pending acceptance. Production release remains
**NOT APPROVED**. Widevine provisioning,
deployment topology, capacity qualification and recovery objectives remain
separate owner-controlled gates. No 10,000-user capacity claim is made.

## Recovered work and corrections

The interrupted work contained the guarded isolated Compose wrapper, tenant
bootstrap helpers, browser CORS proof, live lifecycle runner, real tenant
isolation, platform RS256/renewal, token expiry and subscription expiry stages.
Those files were preserved. The standalone real-browser driver was unfinished;
it required orchestration, real media preparation, cleanup and product fixes.

New product corrections:

- Real DRM watermark responses contain a signed `payload` envelope. The platform
  now reads that envelope and selects only masked display fields, excluding the
  signature and trace identifier. Unix expiry seconds become an ISO date.
- Renewal updates the current grant reference before rearming its timer. Late
  responses cannot resurrect an ended or switched session. Lesson release keeps
  the old reference until its external session is ended.
- Progress updates retain the selected lesson. A refused renewal stops playback
  and presents the renewal-required state.
- DASH relative filenames are routed through the external session's `media/`
  gateway. The request adapter rejects foreign origins, other session paths and
  encoded traversal before attaching the in-memory bearer.
- Remote license requests explicitly use `application/octet-stream`, as the
  external API requires for raw EME challenge bytes. Renewed credentials update
  license headers without rebuilding the player.
- dash.js 5.2.1 incorrectly selects `keyids` for binary PSSH init data in the
  remote ClearKey path. A small install-time patch removes that condition;
  explicit local-key configurations retain `keyids`, while remote PSSH uses
  `cenc`. The dependency is pinned to 5.2.1 and the patch refuses an unexpected
  version/signature. Vite uses the patched ESM distribution and minifies it;
  dash logging is disabled. No content keys are embedded or license checks
  bypassed. Re-evaluate this patch before any dash.js upgrade.
- Retry now closes the old external session and requests a fresh grant through
  the normal UI. A bilingual fullscreen control requests fullscreen on the
  video-plus-watermark frame; the test uses that product control, not an injected
  test button. Video-only native fullscreen is disabled where supported.
- Player surfaces and overlays have explicit contrast tokens in both themes.
  Safe numeric DASH error codes support diagnosis without exposing URLs or
  license bodies. Only the known early missing-init-data notification is deferred
  until the encrypted init segment arrives; other errors remain visible.
- The real browser exposed dash.js bitrate/media preference caching as an extra
  local-storage entry. Both caches are now disabled; the browser requires only
  the site's language/theme keys and the non-credential tab device identifier.

Before the new owner assignment, no DRM source or deployment architecture was
changed. On 2026-10-01 the owner explicitly approved D24: only the worker
packaging invocation and affected API processing regression were subsequently
edited inside DRM. The independent architecture is unchanged. The ignored local DRM
CORS setting was extended to the already owner-approved `http://localhost:8082`,
preserving existing origins. This is local verification configuration only.

## Fresh Docker evidence

| Verification | Observed result |
| --- | --- |
| Server unit | 154/154 PASS, including signed-watermark envelope/privacy regression |
| Server integration | 216/216 PASS against fresh PostgreSQL and Redis |
| Server source/test typecheck and production image build | PASS |
| Client pure logic | 53/53 PASS |
| dash.js compatibility patch | 2/2 PASS; binary-vs-JSON semantics, idempotence and unknown-signature refusal |
| Client typecheck and production build | PASS |
| Runner, bootstrap and summary tests | 11 node:test entries PASS; runner script includes 50+ assertions, tenant bootstrap 10 checks, summary 9 cases |
| Isolated Compose wrapper | 20/20 selftests PASS; resolved live volume guard PASS |
| Subscription SQL fixture guards | 4/4 PASS |
| Fresh migration | 7 migrations applied successfully on disposable platform DB |
| M4 to M5 upgrade drill | PASS: 6 to 7 migrations, users 2 to 2, courses 1 to 1, both M5 tables present; probe database removed |
| Migration failure drill | Nonzero exit (P1001), as required |
| Real-browser student lifecycle | 65/65 checks PASS, 0 failed/blocked/skipped; 67 evidence records agree, runner exit 0 |
| Full fresh DRM regression | PASS: unit 51, deletion 44, upload recovery 38, processing 7, integration 3, media 3, e2e 2 (148 total) |
| Worker packaging reproduction | Original arguments reproduced a dynamic MPD; corrected compiled function produced an encrypted segmented static MPD with finite duration, network-none dummy-key probe |
| Secret exposure scan | 345 platform text files, serving JS bundle, three platform/worker image histories: 0 matches for current ignored privileged values |
| Marker handshake regression | Shared writer requires Docker `-i`; real isolated Docker write/read roundtrip PASS, probe volume removed; runner failure-path suite PASS |
| Final state | API health 200 (DB/Redis/storage all ok), five platform verification services healthy, TTL 300 confirmed; both regression stacks removed after volume/container ownership guards |

Fresh platform regression uses `m5-final-regression`, whose PostgreSQL volume is
project-scoped. The real browser uses `education-platform-rs256`, guarded by the
wrapper, with only its two explicitly isolated volumes. Original platform
development containers remain stopped and their volumes preserved. The disposable
`m5-final-regression` stack and its only PostgreSQL volume were removed after
checking resolved names and container ownership. The nested
DRM HEAD remains `015392b`, with exactly two authorized uncommitted source/test
changes for the recorded-manifest repair.

## Running image snapshot

Docker container `.Image` identifiers at the end of this continuation:

| Service | Identifier (prefix) |
| --- | --- |
| Isolated server | `ed117418ba07` |
| Isolated client | `0eab259c4353` |
| Completed isolated migration container | `90a1275f4000` |
| DRM API | `25c6ab65de45` |
| DRM worker | `3617babd1dce` |
| Chromium image | `d09cd62152f3` |

Docker image-tag/manifest identifiers can change on a rebuild with provenance
metadata even when layers are cached; the table identifies actual containers,
not an assumed tag-to-container match. No commit or push was created.

## Browser evidence and failure history

The repeatable entry point is `node docker/verification/run-real-browser.mjs`.
It runs Chromium in Docker at the approved localhost origin against the real
platform and external DRM, using locally provisioned RS256/JWKS credentials.
It prepares two 120-second test videos, uses a temporary test TTL of 60 seconds,
and restores the ignored DRM configuration in `finally`. Subscription expiry
uses the existing exact-row guarded fixture in the disposable platform DB only.
No DRM database access is used.

Evidence is saved under the ignored `docker/browser/evidence/real-<run>/`.
Checks/logs contain safe scalars, screenshots use throwaway masked identities,
and credentials remain in ignored files or temporary owner-only env files.

The final full run is `real-a851ffd29ab3/checks.log`: 65 checks, zero failures,
zero blocks, zero skips; its 67 records (including summary/result) independently
recount to PASS with no disagreement. The driver proves actual decoded and
advancing video, pause/resume, progress persistence/restore, automatic renewal
without player recreation, session end on navigation and lesson switching,
visible error/retry through real controls, masked watermark/fullscreen, Arabic
and English in both themes at desktop/mobile widths, permitted storage keys,
and subscription expiry stopping playback and showing renewal required. Zero
page errors occurred. The final playback screenshot was visually reviewed.

Failures were kept visible rather than counted as acceptance:

1. Binary PSSH passed as `keyids` caused DASH_113 before licensing. The versioned
   frontend compatibility patch corrects that protocol selection.
2. The next real browser reached licensing but received 400 because challenge
   content type was absent. Explicit raw challenge content type produced 200.
3. The driver waited for decoded frames before calling Play, although the player
   intentionally preloads metadata only. The driver now starts muted playback
   after metadata is available, before checking decoded readiness, and still
   requires advancing video time. This sequencing correction did not solve the
   remaining empty buffer.

4. The original packaging invocation produced a dynamic live MPD for recorded
   courses. A network-none reproduction with the worker image verifies both the
   defect and the proposed static flag. The owner then explicitly authorized the two-file DRM repair; real processing
   and the full affected regression passed. The next browser reached decoded,
   advancing video, renewal, saved progress and lesson switching, then correctly
   refused the unexpected bitrate preference key. The final full run subsequently
   passed storage, watermark/fullscreen and expiry as well.
5. Interrupted OpenCode configuration had left the ignored API TTL at 60
   seconds. Runner restoration correctly matched that file, but the documented
   local baseline was 300. It has now been restored to 300 and verified in the
   running API; subsequent runners restore the corrected baseline.
6. The next browser passed playback, renewal, progress, storage and the entire
   watermark/fullscreen matrix, but the fixture marker was empty: `docker run`
   without `-i` closed stdin before the marker write. The shared writer now
   keeps stdin open, and the browser runner consumes that same helper. Its
   regression assertion passes; the failed run remains failed, with evidence
   preserved. A manual late marker write did not rescue or count that run.
   A real Docker marker roundtrip and the subsequent complete browser run passed
   with the corrected shared helper, without intervention.

Every completed failed attempt ended its sessions, deleted its own course/media
through supported APIs to COMPLETED, logged out, removed scratch resources and
restored the API TTL. A published course from before this continuation was
preserved; no broad prefix was treated as authorization for deletion.

## Next action and remaining release gates

The owner assigned the bounded [recorded-manifest repair](../../drm/drm-recorded-manifest-repair-proposal.md)
on 2026-10-01. Its implementation, regression, real-browser proof, cleanup and
evidence review are complete. Owner acceptance is the next step for this
reviewed scope. Repeat tests only for a new defect or change. No redesign or
broader DRM maintenance was performed.

Earlier worker reports describe successful real R2/CORS, bidirectional tenant
isolation, platform-issued RS256 grants/renewal, token expiry and subscription
expiry. These remain attributed historical evidence until rerun here. ClearKey
is local functional evidence, not proof of Widevine or commercial DRM.

The dependency audit reports one high finding in the pinned build-time PostCSS
dependency and two moderate findings in Vitest/@vitest/mocker. They are not
serving-image Node packages (the client runtime is static Nginx), but build/test
dependency remediation remains a release task; no blanket force-upgrade was
performed during playback repair.

Do not start another milestone or commit/push until the owner accepts the
reviewed scope. Full production readiness requires the outstanding operations,
provider and capacity decisions, not additional repetitions of already passing
local tests.

Final cleanup confirms the run's course deletion COMPLETED and all session-end
and logout requests succeeded. Only the one pre-existing PUBLISHED course
remains in the isolated DB. Financial/audit rows and disposable students remain
per retention policy. No lifecycle scratch, marker-probe or regression volumes
remain, and the three latest run env files are absent. Original platform dev
containers remain stopped; original platform/DRM volumes and the DRM Valkey
anonymous attachment remain present. Verification and DRM services are left
running for review. No deployment, commit or push was performed.

## Configuration, migration and rollback impact

The recorded-manifest repair needs no migration, new environment variable or
API change. Its effect applies to newly processed assets only; existing media
was not repackaged. The platform watermark/player corrections also add no
schema migration. Local test TTL changes are runtime-only and restored from
the ignored DRM configuration after each run.

Both repositories retain their pre-continuation HEADs and all changes remain
reviewable. Do not broadly reset the working trees: they include the recovered
worker's work. If this bounded repair must be withdrawn, remove only its two
DRM hunks and rebuild the independent worker; note that the previous packaging
defect then returns for future processing. No storage deletion, database rollback
or existing-media rewrite is necessary. Reverting the platform continuation
requires selecting its reviewed hunks, rebuilding server/client and rerunning
the affected checks; do not erase the recovered closure artifacts.
