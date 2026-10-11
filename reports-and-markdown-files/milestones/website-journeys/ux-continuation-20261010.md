Latest continuation: [resumed browser checkpoint](resumed-browser-20261010.md). Its current state supersedes historical interruption, pending controls, total and resource state below.

# Website journeys: UX continuation, 2026-10-10

Status: IN PROGRESS. Platform changes are uncommitted and unpushed. No milestone
acceptance, full-site completion, production deployment or new DRM maintenance.
Base remains `dev` at `47274ac57d3e898b25a328b0645da2d1d647f59f`.

This report adds the current continuation to the
[2026-10-09 persisted-pass evidence](persisted-pass-continuation-20261009.md).
Earlier completed coverage remains historical evidence, not a new retest.
AGENTS.md and its required project documents, plus the requested journey reports,
sequence, progress and runbook, were read before implementation.

## Repairs and qualification

| Finding | Platform change | Current verification |
|---|---|---|
| Expired quiz gives a generic failure | Bilingual expiry explanation and manual My learning renewal link on denied initial load | Error-label regressions pass; actual expired-quiz browser retest NOT RUN |
| Expired learning session offers Retry before login | Sign-in guidance and login link for missing/invalid tokens and expired/revoked sessions, from outline or playback; materials access disabled | 20 mocked-hook render regressions pass; actual session-expiry browser retest NOT RUN |
| Blank recharge rejection reason has generic validation | Inline bilingual reason error, textarea focus, aria-invalid/describedby; trimmed blank never submitted | Eight actual Brave language/size cases PASS; whitespace rejection and error clearing also observed |
| Added section is not selected/focused | Use the returned section identity after refresh, select it, clear section filtering and focus its heading | Eight actual Brave language/size cases PASS |
| Mobile Admin navigation requires excessive travel | Labelled destination selector, compact course-workspace selector, collapsible course shortcuts; desktop tabs retained | 56 actual panel navigation/layout cases PASS; remaining shortcut/dirty-form controls pending |

No grading result is reconstructed, no quiz auto-redirect is introduced, no
entitlement is granted by an error state, and no financial or publication policy
was relaxed. Existing cookie authentication and exactly STUDENT/ADMIN remain.

## Actual Brave controls and measured dimensions

Brave extension browser ID 3, dedicated synthetic tab 430329439, origin
`http://127.0.0.1:8082`. The existing owner tab was inspected without owner writes.
Viewport override and read-only DOM measurements confirmed the following sizes;
these are measured CSS viewport dimensions, not claims about native mobile apps.

| Language | Measured viewports | Section add/select/focus | Empty rejection reason | Admin course panels |
|---|---|---:|---:|---:|
| English | 1280×900, 1920×1080, 390×844, 360×800 | 4 PASS | 4 PASS | 28 PASS |
| Arabic | 1280×900, 1920×1080, 390×844, 360×800 | 4 PASS | 4 PASS | 28 PASS |

These 72 rows are individual control/layout cases, not 72 complete journeys.
All showed no horizontal document overflow. The seven course panels were
outline, assessments, materials, details, access, publish and students. Visible
panel identity matched the requested selection. A students information panel on
a working copy is navigation evidence, not a completed student-roster test.

Section additions used real Admin fields and save controls. New sections 3–10
were selected and the rendered selected-section heading received focus. Their
translated titles were retained across reload/language navigation. An editing
draft was opened through the existing confirmation controls; the live course
was not published or changed. Working copy:
`ec2741bd-b1dd-407b-bfea-4f80977ccdff`.

Recharge review used a labelled synthetic pending placeholder. Approval remained
disabled without receipt verification. The verification checkbox was never set;
no receipt was approved and no wallet was credited. Blank and whitespace-only
reasons kept the request pending; entering text cleared the inline error. Review
was closed without submitting a nonblank rejection.

Additional actual controls, outside the full matrix:

| Area/control | Observation | Limit |
|---|---|---|
| Duration offer: current 20 EGP, previous 30 EGP, 45 days | Saved through Admin controls and retained after full reload/reopening access | Synthetic working copy only; no purchase or new publication |
| Offer previous price 10 EGP below current 20 EGP | Rejected, no new offer | Generic validation/focus remains a UX follow-up |
| Term-end offer on unclassified course | Rejected | Academic year and term are prerequisites; generic feedback does not identify them |
| Support contact save | Synthetic `journey-support@example.test` and `01000000000` saved and public help showed the email plus normalized `+201000000000` after reload | No mailto/tel link activated; no external message/call |
| Support reload and public-help link | Opened current saved public contacts | Other help destinations/settings not fully exercised |
| Invalid support email | Browser validity rejected and focused the email field | Arabic 360×800 only |
| Invalid support phone `12` | Save rejected with bilingual-capable generic contact error | Arabic 360×800 only; field focus not qualified |

## Browser interruption

During support save/navigation the site displayed its unsaved-support dialog.
The browser-control call timed out; attempts to dismiss through the supported
dialog API and reconnect to the same tab/browser also timed out. Inventory
retrieval failed too. After the owner said “try again”, the same authorized Brave
tab was retried and still timed out. This is a connection interruption, not an
automatic-approval rejection or a proved application defect. No alternate
browser, hostname, port or automation method was used to continue actual claims.

Browser tab closure, logout, viewport reset and final screenshot saving could
not be confirmed. Earlier screenshots were visually inspected in tool output;
no retained screenshot file from this run is claimed. The last requested viewport
was 360×800 and the last site route was Arabic Admin support. A remaining native
site dialog may need the owner to choose Cancel before reconnecting. The test
stack is removed after saving its synthetic state, so the old tab URL will no
longer serve until this exact disposable environment is restored.

## Automated verification (separate from actual browser evidence)

- Offline Docker client suite: 371 Vitest checks in 44 files plus 10 Node checks,
  **381 total PASS**. Source mounted read-only, `--network none`, labelled `--rm`
  runner, no owner data mount.
- Final Docker TypeScript check PASS.
- Final Docker client/SSR runtime build PASS. Existing bundle-size and
  static/dynamic-import warnings remain. Server runtime build also passed earlier
  in this continuation; no backend application code changed.
- New checks: three assessment error-label cases; section-create response identity
  and credentialed POST; 20 learning render cases with mocked hooks. The latter
  cover four auth failures from outline/playback in both languages, distinguish
  subscription renewal from login, preserve Retry for unrelated failures, and
  verify materials access is disabled on auth/entitlement loss.
- Regression setup initially used a wrong mocked module path, then a missing
  required provider-children type. Both were corrected before the passing final
  checks/build. These were test setup failures, not observed website failures.
- The previous report's 109 backend integration and 48 mocked UI cases were not
  rerun here. They remain prior evidence. No automated concurrency result is an
  actual browser race pass. Pure IDE tests in the existing suite do not reopen or
  accept the suspended IDE.

## Fixture preparation and retained state

The final 2026-10-09 dump/evidence directory was absent. It was NOT restored.
The actually available older `journey-handoff.dump` was verified (147691 bytes,
SHA256 `C977C11211A3B4F9C4CA8C716E19970A3002230AE3DD065A63EF0A6B7B8430F5`)
and restored only into inspected isolated PostgreSQL `journey_test`.
Its two submissions/pass/draft are the older checkpoint; this does not restore
the later 70 EGP reconciled ledger or later optional-quiz/package evidence.
The current seed preserved credentials and initialized the missing synthetic
wallet at zero through the platform ledger helper.

Owned Compose project: `fayq-journey-ux-20261010`, using `journey.compose.yml` and
`journey-ux.override.yml`. Separate DB/network, loopback-only 8082, IDE disabled,
DRM unconfigured. The fixture helper adds one pending 50 EGP no-transfer proof
placeholder and three DRAFT monthly courses, slugs `journey-ux-month-1..3`.
These have FIRST_SECONDARY, year 2026/2027, term 1 and teaching months 2026-09..11.
They are package-authoring prerequisites, not evidence of authoring through UI,
real video, receipt validity or payment. Initial fixture module-resolution and
schema-input failures were corrected in this synthetic preparation only.

The helper's expiry/restore/session modes were prepared but NOT executed in this
run. No forced subscription/session change requires reversal. No new student
registration or package was created.

Retained new local ignored backup:
`docker/browser/evidence/journey-ux-20261010/ux-continuation.dump`, 150394 bytes,
SHA256 `34424C8D12CD845AC68EF0FEE0470272967755691BF5073BFC1FC8990693E4EA`.
`pg_restore --list` succeeded. This is not available merely by pulling Git and is
not a fresh full restore rehearsal. It retains the synthetic draft/sections,
duration offer, support contacts and pending placeholder. Passwords were not
reset.

Cleanup completed after inspecting all project-labelled containers and their
mounts. Only the exact Compose project was removed with both Compose files and
`down -v`. PostgreSQL volume `fayq-journey-ux-20261010_journey-pg`, network
`fayq-journey-ux-20261010_default`, and recorded anonymous Redis volume
`8b39a09774cbbd1dff3ada357821f5dc3779e0f27cdcfa7eb7ab965577fe03c9`
were absent in final inventories. No owned project or test-runner containers
remain. Reusable images and both synthetic dumps were retained locally. All five
existing owner-preview containers were healthy after cleanup; no global prune.

The existing owner preview containers had been stopped. Their project/mounts
were inspected and the same PostgreSQL, Redis, server, client and nginx containers
were started without recreation/migration/retagging. Owner PostgreSQL volume
`fayq-dark-player-recovered-pgdata` and Redis volume `m8-owner-preview_redis-final`
were preserved. This run's rebuilt images were applied only to the disposable
project. Nested DRM source and data were not edited or started; unrelated running
materials MinIO and suspended grading services were left alone.

## Remaining controls, prerequisites and authorization limits

1. Retest expired quiz renewal/link and expired/revoked learning session login
   through actual Brave controls in both languages/all four measured sizes.
   Restore the local dump if actually available, otherwise seed disposable data
   and author required quiz fixtures through the UI. Do not invent missing passes.
2. Complete support/settings inventory: empty contacts, valid save/cancel/reload,
   public help destinations, policy draft controls and payment receiving details.
   Do not adopt policy, create administrators, enter/reset credentials, contact
   support or upload QR/media without the corresponding explicit authorization.
3. Registration remains NOT RUN. Use labelled disposable identity data, never
   owner/national-ID data. Credential entry and any binding agreement must follow
   the browser handoff/confirmation rules; the current prompt does not authorize
   owner credential changes or acceptance of an agreement.
4. Financial offers: duration creation/reload has bounded actual evidence; free,
   until-removal, term/year-end, edit/retire and duplicate/stale controls remain.
   TERM_END needs academic year plus term; YEAR_END needs academic year. These are
   existing backend requirements, not a new policy. No purchase is needed to
   exercise Admin offer authoring.
5. Package authoring remains NOT RUN. Existing contract requires exactly three
   distinct available monthly courses with grade, academic year and teaching
   month, bilingual titles/descriptions, price and Cairo common deadline. Prepared
   synthetic DRAFT members satisfy authoring prerequisites; no owner reclassification
   or publication is needed for a draft test. Verify create/edit/reload/cancel,
   member order, validation and version conflict separately from purchase/presale.
6. Course-shortcut expand/search/switch/collapse and dirty-form cancellation on
   the new mobile selectors remain pending; panel selection/layout passes do not
   imply those passes.
7. Real video playback, fullscreen Escape, rendition switching, active-playback
   expiry/device enforcement and uploads remain unqualified. READY metadata is
   not playback evidence. Successful new-course creation still requires a cover.
8. Real receipt approval, guardian report generation, external delivery and
   browser concurrency races remain untested. No real payments, uploads, external
   messages, production deployment or external DRM edits are authorized here.
9. Suspended IDE remains intentionally disabled and outside this verification.

New work must receive explicit commit/push authorization after review. No previous
delivery authorization is reused for these changes.
